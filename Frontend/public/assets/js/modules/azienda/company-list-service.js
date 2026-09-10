import { db } from '../../firebase-config.js?v=1.2.92';
import { deleteDoc, doc, updateDoc } from '/assets/js/vendor/firebase-runtime.js';

export async function setCompanyPinned(uid, companyId, isPinned) {
    await updateDoc(doc(db, 'users', uid, 'aziende', companyId), { isPinned });
}

export async function deleteCompany(uid, companyId) {
    await deleteDoc(doc(db, 'users', uid, 'aziende', companyId));
}
