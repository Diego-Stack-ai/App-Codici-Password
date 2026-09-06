import {getDocSmart, getDocsSmart} from '/assets/js/offline-firestore.js';
import {db} from '../../firebase-config.js?v=1.2.52';
import {collection, doc, limit, orderBy, query, where} from '/assets/js/vendor/firebase-runtime.js';
import {coalesceRead} from './request-coordinator.js';

const records = snapshot => snapshot.docs.map(item => ({id: item.id, ...item.data()}));

export const listPrivateAccounts = uid => coalesceRead(`accounts:${uid}`, async () =>
    records(await getDocsSmart(collection(db, 'users', uid, 'accounts'))));

export const listTopPrivateAccounts = (uid, maximum = 10) => coalesceRead(`top-accounts:${uid}:${maximum}`, async () =>
    records(await getDocsSmart(query(
        collection(db, 'users', uid, 'accounts'), orderBy('views', 'desc'), limit(maximum)
    ))));

export const listAcceptedInvites = email => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return coalesceRead(`accepted-invites:${normalizedEmail}`, async () => records(await getDocsSmart(query(
        collection(db, 'invites'),
        where('recipientEmail', '==', normalizedEmail),
        where('status', '==', 'accepted')
    ))));
};

export const getRecordByPath = recordPath => coalesceRead(`record:${recordPath}`, async () => {
    const snapshot = await getDocSmart(doc(db, recordPath));
    return snapshot.exists() ? {id: snapshot.id, ...snapshot.data()} : null;
});

export const listCompanies = uid => coalesceRead(`companies:${uid}`, async () =>
    records(await getDocsSmart(collection(db, 'users', uid, 'aziende'))));

export const listCompanyAccounts = (uid, companyId) => coalesceRead(`company-accounts:${uid}:${companyId}`, async () =>
    records(await getDocsSmart(collection(db, 'users', uid, 'aziende', companyId, 'accounts'))));

export const listDeadlines = uid => coalesceRead(`deadlines:${uid}`, async () =>
    records(await getDocsSmart(collection(db, 'users', uid, 'scadenze'))));

export const listContacts = uid => coalesceRead(`contacts:${uid}`, async () =>
    records(await getDocsSmart(collection(db, 'users', uid, 'contacts'))));

export const getUserProfile = uid => coalesceRead(`profile:${uid}`, async () => {
    const snapshot = await getDocSmart(doc(db, 'users', uid));
    return snapshot.exists() ? {id: snapshot.id, ...snapshot.data()} : null;
});
