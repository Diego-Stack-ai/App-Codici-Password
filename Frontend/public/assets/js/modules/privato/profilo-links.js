import { auth, db } from '../../firebase-config.js?v=1.2.198';
import { collection, doc, runTransaction, deleteField } from "/assets/js/vendor/firebase-runtime.js";
import { showToast } from '../../ui-core-v129.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
import { showProfileAccountPicker } from './profilo-modal.js';
import {listPrivateAccounts, listCompanies, listCompanyAccounts, getPrivateAccount, getCompanyAccount, getPrivateAccountConfirmed, getCompanyAccountConfirmed} from '../data/vault-repository.js';
import {
    buildProfileAccountLinkDraft, profileAccountUrl, profileAccountReferences
} from './profile-model.js';

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

export async function createDeadlineFromDocument(documentItem, syncData, profile = {}) {
    const pilot = await import('./profile-document-deadline-pilot.js?v=1.2.198');
    return pilot.reconcileProfileDocumentDeadlinePilot({
        documentItem,
        profile,
        openWhenCurrent: true,
        ensureDocumentPersisted: syncData
    });
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
