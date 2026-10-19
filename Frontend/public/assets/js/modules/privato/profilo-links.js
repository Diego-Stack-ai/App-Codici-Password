import { auth, db } from '../../firebase-config.js?v=1.2.208';
import { collection, doc, runTransaction, deleteField, Timestamp } from "/assets/js/vendor/firebase-runtime.js";
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
import { showProfileAccountPicker } from './profilo-modal.js';
import {listPrivateAccounts, listCompanies, listCompanyAccounts, getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed} from '../data/vault-repository.js';
import {
    buildProfileAccountLinkDraft,
    isDefinitiveProfileDocumentDeadlineReference,
    normalizeProfileDateInputValue,
    profileAccountUrl,
    profileAccountReferences
} from './profile-model.js';
import {getCurrentLanguage, t} from '../../translations.js';
import {deadlineDateDisplay} from '../scadenze/deadline-model.js';

export async function readLinkedEmailAccountPassword(email) {
    const uid = auth.currentUser?.uid;
    if (!uid || !email?.linkedAccountId) throw new Error('Account non collegato.');
    const key = await ensureVaultKeyMaterial();
    if (!key || auth.currentUser?.uid !== uid) throw new Error('Sblocca il Vault per leggere la password.');
    const offline = globalThis.navigator?.onLine === false;
    const account = email.linkedAccountCompanyId
        ? await (offline ? getCompanyAccount : getCompanyAccountConfirmed)(uid, email.linkedAccountCompanyId, email.linkedAccountId)
        : await (offline ? getPrivateAccount : getPrivateAccountConfirmed)(uid, email.linkedAccountId);
    if (!account || account.isArchived) throw new Error('Account collegato non disponibile.');
    if (auth.currentUser?.uid !== uid || (Object.hasOwn(account, 'ownerId') && account.ownerId !== uid)) throw new Error('Sessione cambiata.');
    const password = await decryptRequiredValue(account.password, key);
    if (auth.currentUser?.uid !== uid) throw new Error('Sessione cambiata.');
    return password || '';
}

export function openLinkedAccount(accountId, companyId = '') {
    if (accountId) window.location.href = profileAccountUrl(accountId, companyId);
}

export const connectEmailAccount = (email, syncData) => connectContactAccount(email, syncData, 'email');
export const connectUtilityAccount = (utility, syncData) => connectContactAccount(utility, syncData, 'utility');
export const connectDocumentAccount = (document, syncData) => connectContactAccount(document, syncData, 'document');
export const connectPhoneAccount = (phone, syncData) => connectContactAccount(phone, syncData, 'phone');

async function connectContactAccount(contact, syncData, contactType) {
    const user = auth.currentUser;
    if (!user || !contact?.id) return;
    const openForm = async ({ id = '', companyId = '' }) => {
        await syncData();
        sessionStorage.setItem('profile-account-link-draft', JSON.stringify({
            ...buildProfileAccountLinkDraft(contact, contactType), ownerUid: user.uid, companyId
        }));
        window.location.href = profileAccountUrl(id, companyId, { edit: true, contactId: contact.id });
    };
    try {
        if (contact.linkedAccountId) {
            await openForm({ id: contact.linkedAccountId, companyId: contact.linkedAccountCompanyId || '' });
            return;
        }
        const [personal, companyRecords, key] = await Promise.all([
            listPrivateAccounts(user.uid), listCompanies(user.uid), ensureVaultKeyMaterial()
        ]);
        const companies = companyRecords.filter(company => !company.isArchived).map(company => ({
            id: company.id, name: company.ragioneSociale || 'Azienda senza nome'
        })).sort((a, b) => a.name.localeCompare(b.name, 'it'));
        const companyAccounts = await Promise.all(companies.map(async company =>
            (await listCompanyAccounts(user.uid, company.id)).map(account => ({ ...account, companyId: company.id, companyName: company.name }))
        ));
        const accounts = await Promise.all([...personal.map(account => ({ ...account, companyId: '' })), ...companyAccounts.flat()]
            .filter(data => !data.isArchived && !data._isGuest && !data.shared && !data.isMemoShared &&
                data.visibility !== 'shared' && !['memo', 'memorandum'].includes(data.type) && !data.isMemo && !data.hasMemo)
            .map(async data => {
                let username = '';
                try { username = data._encrypted && data.username ? await decrypt(data.username, key) : (data.username || ''); } catch { username = ''; }
                if (username === '--ERRORE--') username = '';
                return { id: data.id, companyId: data.companyId, companyName: data.companyName || '', name: data.nomeAccount || 'Account', username };
            }));
        accounts.sort((a, b) => a.name.localeCompare(b.name, 'it') || a.companyName.localeCompare(b.companyName, 'it'));
        showProfileAccountPicker({
            title: {phone:'Collega Account telefono',email:'Collega Account email',utility:'Collega Account utenza',document:'Collega Account documento'}[contactType],
            accounts, companies, onSelect: openForm
        });
    } catch {
        showToast('Impossibile caricare gli Account. Controlla la connessione e riprova.', 'error');
    }
}

function deadlineIsoDate(deadline = {}) {
    const value = deadline.dueDate || deadline.date || '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    return '';
}

export async function createDeadlineFromDocument(documentItem, syncData, profile = {}, {
    openWhenCurrent = true
} = {}) {
    const user = auth.currentUser;
    if (!user || !documentItem?.id) return {action: 'none'};
    const dueDate = normalizeProfileDateInputValue(documentItem.expiry_date);
    if (!dueDate) {
        showToast(t('pilot_deadline_date_required'), 'warning');
        return {action: 'date-required'};
    }

    if (isDefinitiveProfileDocumentDeadlineReference(documentItem.expiryReference)) {
        const deadlineId = documentItem.expiryReference.deadlineId;
        const deadlineRef = doc(db, 'users', user.uid, 'scadenze', deadlineId);
        const profileRef = doc(db, 'users', user.uid);
        let deadline;
        try {
            deadline = await runTransaction(db, async transaction => {
                const [profileSnapshot, deadlineSnapshot] = await Promise.all([
                    transaction.get(profileRef), transaction.get(deadlineRef)
                ]);
                if (!profileSnapshot.exists() || !deadlineSnapshot.exists()) {
                    throw new Error('PROFILE_DOCUMENT_DEADLINE_LINK_BROKEN');
                }
                const sourceDocument = (profileSnapshot.data()?.documenti || [])
                    .find(item => item?.id === documentItem.id);
                if (!sourceDocument
                    || !isDefinitiveProfileDocumentDeadlineReference(sourceDocument.expiryReference)
                    || sourceDocument.expiryReference.deadlineId !== deadlineId) {
                    throw new Error('PROFILE_DOCUMENT_DEADLINE_LINK_CHANGED');
                }
                const current = deadlineSnapshot.data();
                const currentSourceId = current?.sourceRef?.type === 'profileDocument'
                    ? current.sourceRef.id : current?.sourceDocumentId;
                if (current?.linkKind !== 'profile-document-deadline-v1'
                    || currentSourceId !== documentItem.id) {
                    throw new Error('PROFILE_DOCUMENT_DEADLINE_SOURCE_CHANGED');
                }
                return current;
            });
            if (deadlineIsoDate(deadline) !== dueDate) {
                const confirmed = await showConfirmModal(
                    t('profile_deadline_update_title'),
                    t('profile_deadline_update_message').replaceAll('{date}', deadlineDateDisplay(dueDate, getCurrentLanguage())),
                    t('profile_deadline_configure_action'),
                    t('cancel')
                );
                if (!confirmed) return {action: 'declined', deadlineId};
                await runTransaction(db, async transaction => {
                    const [profileSnapshot, deadlineSnapshot] = await Promise.all([
                        transaction.get(profileRef), transaction.get(deadlineRef)
                    ]);
                    if (!profileSnapshot.exists() || !deadlineSnapshot.exists()) {
                        throw new Error('PROFILE_DOCUMENT_DEADLINE_LINK_BROKEN');
                    }
                    const sourceDocument = (profileSnapshot.data()?.documenti || [])
                        .find(item => item?.id === documentItem.id);
                    if (!sourceDocument
                        || sourceDocument.expiryReference?.deadlineId !== deadlineId
                        || sourceDocument.expiryReference?.linkKind !== 'profile-document-deadline-v1') {
                        throw new Error('PROFILE_DOCUMENT_DEADLINE_LINK_CHANGED');
                    }
                    const storedDeadline = deadlineSnapshot.data();
                    const storedSourceId = storedDeadline?.sourceRef?.type === 'profileDocument'
                        ? storedDeadline.sourceRef.id : storedDeadline?.sourceDocumentId;
                    if (storedDeadline?.linkKind !== 'profile-document-deadline-v1'
                        || storedSourceId !== documentItem.id) {
                        throw new Error('PROFILE_DOCUMENT_DEADLINE_SOURCE_CHANGED');
                    }
                    transaction.update(deadlineRef, {
                        dueDate,
                        completed: false,
                        status: 'active',
                        sourceValueAtLink: dueDate,
                        sourceStatus: 'active',
                        sourceIssue: '',
                        notificationsEnabled: true,
                        pilotDeliveryDisabled: false,
                        updatedAt: Timestamp.now()
                    });
                });
                deadline = {...deadline, dueDate, completed: false, status: 'active', updated: true};
            }
        } catch (error) {
            showToast(t('profile_deadline_error'), 'error');
            return {action: 'error', deadlineId, error: error?.message || 'PROFILE_DOCUMENT_DEADLINE_ERROR'};
        }
        if (deadline?.updated) {
            showToast(t('profile_deadline_updated'), 'success');
        }
        if (openWhenCurrent) {
            window.location.href = `dettaglio_scadenza.html?id=${encodeURIComponent(deadlineId)}`;
        }
        return {action: 'current', deadlineId};
    }

    const legacyDeadlineId = documentItem.expiryReference?.deadlineId
        || documentItem.compatibleDeadlineId
        || documentItem.pilotDeadlineReference?.deadlineId
        || '';
    const confirmed = await showConfirmModal(
        t('profile_deadline_configure_title'),
        t(legacyDeadlineId
            ? 'profile_deadline_configure_existing_message'
            : 'profile_deadline_configure_message')
            .replaceAll('{type}', documentItem.type || t('document'))
            .replaceAll('{date}', deadlineDateDisplay(dueDate, getCurrentLanguage())),
        t('profile_deadline_configure_action'),
        t('cancel')
    );
    if (!confirmed) return {action: 'declined'};

    await syncData?.();
    if (auth.currentUser?.uid !== user.uid) return {action: 'cancelled-account-changed'};
    const {buildLinkedDocumentDeadlineDraft} = await import('./profile-document-deadline-link.js?v=1.2.208');
    const draft = await buildLinkedDocumentDeadlineDraft(user.uid, documentItem, profile);
    if (auth.currentUser?.uid !== user.uid) return {action: 'cancelled-account-changed'};
    sessionStorage.setItem('profile-deadline-link-draft', JSON.stringify({...draft, ownerUid: user.uid}));
    window.location.href = `aggiungi_scadenza.html?profileDocumentId=${encodeURIComponent(documentItem.id)}`;
    return {action: 'configure', legacyDeadlineId};
}

export async function refreshProfileAccountReferences(accountId, companyId='') {
    const uid=auth.currentUser?.uid;
    if(!uid || !accountId) return;
    try {
        await runTransaction(db,async tx=>{
            const ref=doc(db,'users',uid,...(companyId?['aziende',companyId]:[]),'accounts',accountId);
            const profile=await tx.get(doc(db,'users',uid));
            const account=await tx.get(ref);
            if(!account.exists())return;
            const links=profileAccountReferences(profile.data() || {},accountId,companyId);
            tx.update(ref,{linkedProfileFields:links,linkedProfileField:links[0] || deleteField()});
        });
    } catch { showToast('Il contatto è stato eliminato. Riferimenti Account da aggiornare alla prossima connessione.','warning'); }
}
