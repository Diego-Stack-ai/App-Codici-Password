import { auth, db } from '../../firebase-config.js?v=1.2.144';
import { collection, getDocsFromServer, limit, query, doc, updateDoc } from '/assets/js/vendor/firebase-runtime.js';

export async function setCompanyPinned(uid, companyId, isPinned) {
    await updateDoc(doc(db, 'users', uid, 'aziende', companyId), { isPinned });
}

export async function deleteCompany(uid, companyId) {
    const fail = code => { throw Object.assign(new Error(code), {code}); };
    const check = () => {
        if (!uid || auth.currentUser?.uid !== uid) fail('COMPANY_DELETE_SESSION_CHANGED');
    };
    check();
    if (typeof companyId !== 'string' || !companyId || companyId.includes('/')) fail('COMPANY_DELETE_INVALID_ID');
    const accounts = await getDocsFromServer(query(collection(db, 'users', uid, 'aziende', companyId, 'accounts'), limit(1)));
    check();
    if (accounts.empty !== true) fail('COMPANY_NOT_EMPTY');
    // An empty query is NOT a deletion lock: another client may create a child
    // immediately afterwards. Until all writers share the server protocol,
    // preserve the company too. Never fall back to the former direct delete.
    fail('COMPANY_DELETE_PROTOCOL_REQUIRED');
}

export function companyDeletionMessage(error) {
    return ({
        COMPANY_NOT_EMPTY: "L'azienda contiene ancora Account, anche eventualmente archiviati. Spostali o eliminali prima di eliminare l'azienda.",
        COMPANY_DELETE_SESSION_CHANGED: 'Sessione cambiata: eliminazione annullata.',
        COMPANY_DELETE_PROTOCOL_REQUIRED: "Eliminazione non disponibile: il percorso di cancellazione sicura deve essere completato. L'azienda non è stata eliminata."
    })[error?.code] || "Impossibile verificare la cancellazione. L'azienda non è stata eliminata. Riprova quando sei online.";
}
