import {getDocSmart, getDocsSmart} from '/assets/js/offline-firestore.js';
import {db} from '../../firebase-config.js?v=1.2.52';
import {collection, doc, limit, orderBy, query, where} from '/assets/js/vendor/firebase-runtime.js';
import {coalesceRead} from './request-coordinator.js';

const records = snapshot => snapshot.docs.map(item => ({id: item.id, ...item.data()}));
const readRecords = (key, reference) => coalesceRead(key, () => getDocsSmart(reference)).then(records);
const readRecord = (key, reference) => coalesceRead(key, () => getDocSmart(reference)).then(snapshot =>
    snapshot.exists() ? {id: snapshot.id, ...snapshot.data()} : null);

export const listPrivateAccounts = uid => readRecords(`accounts:${uid}`,
    collection(db, 'users', uid, 'accounts'));

export const listTopPrivateAccounts = (uid, maximum = 10) => readRecords(`top-accounts:${uid}:${maximum}`,
    query(
        collection(db, 'users', uid, 'accounts'), orderBy('views', 'desc'), limit(maximum)
    ));

export const listAcceptedInvites = email => {
    const normalizedEmail = String(email || '').trim().toLowerCase();
    return readRecords(`accepted-invites:${normalizedEmail}`, query(
        collection(db, 'invites'),
        where('recipientEmail', '==', normalizedEmail),
        where('status', '==', 'accepted')
    ));
};

export const getRecordByPath = recordPath => readRecord(`record:${recordPath}`, doc(db, recordPath));

export const getPrivateAccount = (uid, accountId) => getRecordByPath(`users/${uid}/accounts/${accountId}`);

export const findPrivateAccountByLegacyId = (uid, accountId) => coalesceRead(`legacy-account:${uid}:${accountId}`, async () => {
    const snapshot = await getDocsSmart(query(
        collection(db, 'users', uid, 'accounts'), where('id', '==', accountId), limit(1)
    ));
    return snapshot.empty ? null : {id: snapshot.docs[0].id, ...snapshot.docs[0].data()};
});

export const getCompany = (uid, companyId) => getRecordByPath(`users/${uid}/aziende/${companyId}`);
export const getCompanyAccount = (uid, companyId, accountId) =>
    getRecordByPath(`users/${uid}/aziende/${companyId}/accounts/${accountId}`);
export const getUserSetting = (uid, settingId) => getRecordByPath(`users/${uid}/settings/${settingId}`);

export const listCompanies = uid => readRecords(`companies:${uid}`,
    collection(db, 'users', uid, 'aziende'));

export const listCompanyAccounts = (uid, companyId) => readRecords(`company-accounts:${uid}:${companyId}`,
    collection(db, 'users', uid, 'aziende', companyId, 'accounts'));

export const listDeadlines = uid => readRecords(`deadlines:${uid}`,
    collection(db, 'users', uid, 'scadenze'));

export const listContacts = uid => readRecords(`contacts:${uid}`,
    collection(db, 'users', uid, 'contacts'));

export const listProfileWidgets = uid => readRecords(`profile-widgets:${uid}`,
    collection(db, 'users', uid, 'profileWidgets'));

export const getUserProfile = uid => readRecord(`profile:${uid}`, doc(db, 'users', uid));
