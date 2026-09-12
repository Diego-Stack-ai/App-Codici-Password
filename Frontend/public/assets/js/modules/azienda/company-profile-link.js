import { auth, db } from '../../firebase-config.js?v=1.2.113';
import { doc } from '/assets/js/vendor/firebase-runtime.js';
import { getCompany } from '../data/vault-repository.js';
import { findCompanyProfileContact, companyContactLinkPatch, companyAccountReferences } from './company-profile-model.js';
export async function loadCompanyProfileContact(uid, draft) {
    const company = await getCompany(uid, draft.sourceCompanyId);
    const contact = company && findCompanyProfileContact(company, draft.contactType, draft.profileContactId);
    if (!contact || (contact.address || contact.number) !== draft.contactValue) throw new Error('Contatto aziendale modificato: torna al Profilo.');
    return contact;
}
export async function prepareCompanyProfileLink(transaction, { uid, draft, targetId, targetCompanyId = '', oldData, data, isEditing, baseRevision, baseUpdatedAt }) {
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
    const backlinks = companyAccountReferences(oldData, {companyId:draft.sourceCompanyId,type:draft.contactType,id:contact.id});
    return { backlinks, ref, patch: companyContactLinkPatch(company, contact, draft.contactType, {linkedAccountId: targetId, linkedAccountCompanyId: targetCompanyId}), backlink: { companyId: draft.sourceCompanyId, type: draft.contactType, id: contact.id } };
}
