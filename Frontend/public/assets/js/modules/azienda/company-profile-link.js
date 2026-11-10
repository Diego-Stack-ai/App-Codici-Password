import { auth, db } from '../../firebase-config.js?v=1.2.268';
import { doc } from '/assets/js/vendor/firebase-runtime.js';
import { getCompany } from '../data/vault-repository.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
import { showConfirmModal } from '../../ui-core-v129.js';
import { findCompanyProfileContact, companyContactLinkPatch, companyAccountReferences, classifyCompanyProfilePassword } from './company-profile-model.js';
export async function loadCompanyProfileContact(uid, draft) {
    const company = await getCompany(uid, draft.sourceCompanyId);
    const contact = company && findCompanyProfileContact(company, draft.contactType, draft.profileContactId);
    if (!contact || (contact.address || contact.number) !== draft.contactValue) throw new Error('Contatto aziendale modificato: torna al Profilo.');
    return contact;
}

export async function promptCompanyProfilePasswordChoice({uid, draft, accountName = 'Account', accountPassword = '', vaultKeyMaterial}) {
    const unchanged = {proceed: true, accountPassword, clearProfilePassword: false, expectedProfilePassword: null, outcome: 'not-applicable'};
    if (!draft?.sourceCompanyId || draft.contactType !== 'email') return unchanged;
    if (auth.currentUser?.uid !== uid) throw new Error('Sessione cambiata.');
    const contact = await loadCompanyProfileContact(uid, draft);
    const expectedProfilePassword = String(contact.password || '');
    if (!expectedProfilePassword) return {...unchanged, expectedProfilePassword, outcome: 'profile-empty'};
    const profilePassword = await decryptRequiredValue(expectedProfilePassword, vaultKeyMaterial);
    if (auth.currentUser?.uid !== uid) throw new Error('Sessione cambiata.');
    // Il form precompila la password del Profilo quando l'Account era vuoto.
    // Il marker è solo RAM e non viene scritto nella bozza di sessione.
    const prefilledEmptyAccount = draft._accountPasswordInitiallyEmpty === true && (!accountPassword || accountPassword === profilePassword);
    const state = prefilledEmptyAccount ? 'account-empty' : classifyCompanyProfilePassword(profilePassword, accountPassword);
    const safeName = String(accountName || 'Account').trim() || 'Account';

    if (state === 'same') {
        const remove = await showConfirmModal(
            'PASSWORD GIÀ PRESENTE NELL’ACCOUNT',
            `Hai collegato “${safeName}”. Le due password coincidono. Vuoi eliminare la password dal Profilo aziendale e mantenerla soltanto nell’Account collegato? Se scegli di conservarle, vedrai due campi password.`,
            'Mantieni solo quella dell’Account',
            'Conserva entrambe'
        );
        return {proceed: true, accountPassword, clearProfilePassword: remove, expectedProfilePassword, outcome: remove ? 'removed-duplicate' : 'kept-duplicate'};
    }
    if (state === 'account-empty') {
        const transfer = await showConfirmModal(
            'PASSWORD DISPONIBILE NEL PROFILO',
            `L’Account “${safeName}” non contiene una password. Vuoi trasferire quella del Profilo aziendale nell’Account e rimuoverla dal Profilo?`,
            'Trasferisci nell’Account',
            'Mantieni nel Profilo'
        );
        return {proceed: true, accountPassword: transfer ? profilePassword : '', clearProfilePassword: transfer, expectedProfilePassword, outcome: transfer ? 'transferred' : 'kept-profile'};
    }
    const proceed = await showConfirmModal(
        'PASSWORD DIVERSE',
        `La password del Profilo aziendale e quella dell’Account “${safeName}” sono diverse. Per sicurezza nessuna password verrà cancellata. Vuoi collegare comunque l’Account e conservarle entrambe?`,
        'Collega e conserva entrambe',
        'Annulla'
    );
    return {proceed, accountPassword, clearProfilePassword: false, expectedProfilePassword, outcome: proceed ? 'kept-different' : 'cancelled'};
}

export async function prepareCompanyProfileLink(transaction, { uid, draft, targetId, targetCompanyId = '', oldData, data, isEditing, baseRevision, baseUpdatedAt, passwordChoice = null }) {
    if (!draft?.sourceCompanyId) return null;
    if (draft.ownerUid !== uid || auth.currentUser?.uid !== uid || (draft.companyId || '') !== targetCompanyId || !['email', 'phone'].includes(draft.contactType)) throw new Error('Collegamento aziendale non valido.');
    const ref = doc(db, 'users', uid, 'aziende', draft.sourceCompanyId);
    const snapshot = await transaction.get(ref);
    const company = snapshot.exists() ? snapshot.data() : null;
    const contact = company && findCompanyProfileContact(company, draft.contactType, draft.profileContactId);
    if (!contact || (contact.address || contact.number) !== draft.contactValue) throw new Error('Contatto aziendale modificato: ricarica.');
    if (contact.linkedAccountId && (contact.linkedAccountId !== targetId || (contact.linkedAccountCompanyId || '') !== targetCompanyId)) throw new Error('Contatto già collegato.');
    if (isEditing && (!oldData || (targetCompanyId ? (oldData.updatedAt || '') !== baseUpdatedAt : Number(oldData.revision || 0) !== Number(baseRevision)))) throw new Error('Account modificato: ricarica.');
    if (company.isArchived || oldData?.isArchived || oldData?.visibility === 'shared' || oldData?.shared || oldData?._isGuest || oldData?.isMemo || oldData?.hasMemo || oldData?.isMemoShared || ['memo','memorandum'].includes(oldData?.type) || data.visibility === 'shared' || ['memo','memorandum'].includes(data.type)) throw new Error('Scegli un Account attivo non condiviso.');
    if (passwordChoice?.expectedProfilePassword !== null && passwordChoice?.expectedProfilePassword !== undefined && contact.password !== passwordChoice.expectedProfilePassword) {
        throw new Error('Password del Profilo modificata: ricarica e riprova.');
    }
    const backlinks = companyAccountReferences(oldData, {companyId:draft.sourceCompanyId,type:draft.contactType,id:contact.id});
    return { backlinks, ref, patch: companyContactLinkPatch(company, contact, draft.contactType, {linkedAccountId: targetId, linkedAccountCompanyId: targetCompanyId}, {clearPassword: Boolean(passwordChoice?.clearProfilePassword)}), backlink: { companyId: draft.sourceCompanyId, type: draft.contactType, id: contact.id } };
}
