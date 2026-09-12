import { auth, db } from '../../firebase-config.js?v=1.2.116';
import { doc, runTransaction, deleteField } from '/assets/js/vendor/firebase-runtime.js';
import { showConfirmModal, showToast } from '../../ui-core-v129.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
import { listPrivateAccounts, listCompanies, listCompanyAccounts } from '../data/vault-repository.js';
import { showProfileAccountPicker } from '../privato/profilo-modal.js';
import { findProfileAccountItem, patchProfileAccountItem, profileAccountReferences } from '../privato/profile-model.js';
import { findCompanyProfileContact, companyContactLinkPatch, companyAccountReferences } from '../azienda/company-profile-model.js';

const accountRef = (uid, id, companyId = '') => doc(db, 'users', uid, ...(companyId ? ['aziende', companyId] : []), 'accounts', id);
const eligible = account => account && !account.isArchived && !account._isGuest && !account.shared && account.visibility !== 'shared' && !account.isMemo && !account.hasMemo && !account.isMemoShared && !['memo', 'memorandum'].includes(account.type);

// Cambia soltanto i riferimenti: credenziali, contatto e altri collegamenti rimangono intatti.
export async function replaceAccountLink({ contact, type, sourceCompanyId = '', parentAddressId = '' }, selection = null) {
    const uid = auth.currentUser?.uid;
    if (!uid || !contact?.linkedAccountId) throw new Error('Collegamento non disponibile.');
    const expectedId = contact.linkedAccountId;
    const expectedCompanyId = contact.linkedAccountCompanyId || '';
    if (selection && !selection.id) throw new Error('Seleziona un Account esistente.');
    if (selection?.id === expectedId && (selection.companyId || '') === expectedCompanyId) return;
    await runTransaction(db, async tx => {
        if (auth.currentUser?.uid !== uid) throw new Error('Sessione cambiata.');
        const sourceRef = doc(db, 'users', uid, ...(sourceCompanyId ? ['aziende', sourceCompanyId] : []));
        const sourceSnap = await tx.get(sourceRef);
        const source = sourceSnap.exists() ? sourceSnap.data() : null;
        const draft = { contactType: type, profileContactId: contact.id, parentAddressId };
        const current = source && (sourceCompanyId ? findCompanyProfileContact(source, type, contact.id) : findProfileAccountItem(source, draft));
        if (!current || current.linkedAccountId !== expectedId || (current.linkedAccountCompanyId || '') !== expectedCompanyId) throw new Error('Collegamento modificato: ricarica la pagina.');
        const oldRef = accountRef(uid, expectedId, expectedCompanyId);
        const oldSnap = await tx.get(oldRef);
        const nextRef = selection ? accountRef(uid, selection.id, selection.companyId || '') : null;
        const nextSnap = nextRef ? await tx.get(nextRef) : null;
        if (selection && (!nextSnap.exists() || !eligible(nextSnap.data()))) throw new Error('Il nuovo Account non è disponibile.');
        if (selection?.companyId) {
            const company = await tx.get(doc(db, 'users', uid, 'aziende', selection.companyId));
            if (!company.exists() || company.data().isArchived) throw new Error('Azienda non disponibile.');
        }
        const link = { linkedAccountId: selection?.id || '', linkedAccountCompanyId: selection?.companyId || '' };
        const patch = sourceCompanyId ? companyContactLinkPatch(source, current, type, link) : patchProfileAccountItem(source, draft, { ...current, ...link });
        const updated = { ...source, ...patch };
        const reference = { companyId: sourceCompanyId, type, id: current.id };
        const referencesPatch = (snapshot, id, companyId, remove) => {
            const links = sourceCompanyId ? companyAccountReferences(snapshot.data(), reference, remove) : profileAccountReferences(updated, id, companyId);
            return sourceCompanyId ? { linkedCompanyProfileFields: links, linkedCompanyProfileField: links[0] || deleteField() } : { linkedProfileFields: links, linkedProfileField: links[0] || deleteField() };
        };
        if (oldSnap.exists()) tx.update(oldRef, referencesPatch(oldSnap, expectedId, expectedCompanyId, true));
        if (nextSnap) tx.update(nextRef, referencesPatch(nextSnap, selection.id, selection.companyId || '', false));
        tx.update(sourceRef, patch);
    });
}

export async function unlinkProfileAccount(context, onChanged = () => window.location.reload()) {
    const uid = auth.currentUser?.uid;
    if (!await showConfirmModal('Scollega Account', 'Rimuovere solo questo collegamento? La scheda, l’Account, le password e gli altri collegamenti saranno conservati.', 'Scollega', 'Annulla')) return;
    try {
        if (!uid || auth.currentUser?.uid !== uid) throw new Error('Sessione cambiata.');
        await replaceAccountLink(context);
        showToast('Account scollegato.', 'success');
        await onChanged();
    } catch { showToast('Account non scollegato. Ricarica la pagina e riprova.', 'error'); }
}

export async function changeProfileAccount(context, onChanged = () => window.location.reload()) {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    try {
        const [personal, companyRecords, key] = await Promise.all([listPrivateAccounts(uid), listCompanies(uid), ensureVaultKeyMaterial()]);
        const companies = companyRecords.filter(c => !c.isArchived).map(c => ({ id: c.id, name: c.ragioneSociale || 'Azienda' }));
        const nested = await Promise.all(companies.map(async c => (await listCompanyAccounts(uid, c.id)).map(a => ({ ...a, companyId: c.id, companyName: c.name }))));
        const accounts = await Promise.all([...personal.map(a => ({ ...a, companyId: '' })), ...nested.flat()].filter(eligible)
            .filter(a => a.id !== context.contact.linkedAccountId || (a.companyId || '') !== (context.contact.linkedAccountCompanyId || ''))
            .map(async a => {
                let username = '';
                try { username = await decryptRequiredValue(a.username, key); } catch { /* Ricerca per nome sempre disponibile. */ }
                return { id: a.id, companyId: a.companyId || '', companyName: a.companyName || '', name: a.nomeAccount || 'Account', username };
            }));
        accounts.sort((a,b) => a.name.localeCompare(b.name, 'it'));
        showProfileAccountPicker({ title: 'Cambia Account collegato', accounts, companies, allowCreate: false, confirmLabel: 'Collega questo Account', onSelect: async selected => {
            if (auth.currentUser?.uid !== uid) throw new Error('Sessione cambiata.');
            await replaceAccountLink(context, selected);
            showToast('Account collegato aggiornato.', 'success');
            await onChanged();
        } });
    } catch { showToast('Impossibile caricare gli Account. Il collegamento attuale è conservato.', 'error'); }
}
