import {
    getDocServerConfirmed, getDocsServerConfirmed, getDocSmart, getDocsSmart
} from '/assets/js/offline-firestore.js';
import {db} from '../../firebase-config.js?v=1.2.110';
import {collection, doc, limit, orderBy, query, where} from '/assets/js/vendor/firebase-runtime.js';
import {coalesceRead} from './request-coordinator.js';

const record = snapshot => ({...snapshot.data(), id: snapshot.id});
const records = snapshot => snapshot.docs.map(record);
const readRecords = (key, reference) => coalesceRead(key, () => getDocsSmart(reference)).then(records);
const readRecord = (key, reference) => coalesceRead(key, () => getDocSmart(reference)).then(snapshot =>
    snapshot.exists() ? record(snapshot) : null);
const readFirstRecord = (key, reference) => coalesceRead(key, () => getDocsSmart(reference)).then(snapshot =>
    snapshot.empty ? null : record(snapshot.docs[0]));
const readConfirmedRecords = reference => getDocsServerConfirmed(reference).then(records);
const readConfirmedRecord = reference => getDocServerConfirmed(reference).then(snapshot =>
    snapshot.exists() ? record(snapshot) : null);

export const listPrivateAccounts = uid => readRecords(`accounts:${uid}`,
    collection(db, 'users', uid, 'accounts'));

export const listPrivateAccountsConfirmed = uid => readConfirmedRecords(
    collection(db, 'users', uid, 'accounts'));

export const getFirstPrivateAccount = uid => readFirstRecord(`first-account:${uid}`, query(
    collection(db, 'users', uid, 'accounts'), limit(1)
));

export const listArchivedPrivateAccounts = uid => readRecords(`archived-accounts:${uid}`, query(
    collection(db, 'users', uid, 'accounts'), where('isArchived', '==', true)
));

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
export const getPrivateAccountConfirmed = (uid, accountId) => readConfirmedRecord(
    doc(db, 'users', uid, 'accounts', accountId));

export const findPrivateAccountByLegacyId = (uid, accountId) => coalesceRead(`legacy-account:${uid}:${accountId}`, () =>
    getDocsSmart(query(
        collection(db, 'users', uid, 'accounts'), where('id', '==', accountId), limit(1)
    ))).then(snapshot => snapshot.empty ? null : record(snapshot.docs[0]));

export const getCompany = (uid, companyId) => getRecordByPath(`users/${uid}/aziende/${companyId}`);
export const getCompanyAccount = (uid, companyId, accountId) =>
    getRecordByPath(`users/${uid}/aziende/${companyId}/accounts/${accountId}`);
export const getCompanyAccountConfirmed = (uid, companyId, accountId) => readConfirmedRecord(
    doc(db, 'users', uid, 'aziende', companyId, 'accounts', accountId));
export const getUserSetting = (uid, settingId) => getRecordByPath(`users/${uid}/settings/${settingId}`);

export const listCompanies = uid => readRecords(`companies:${uid}`,
    collection(db, 'users', uid, 'aziende'));

export const listCompaniesConfirmed = uid => readConfirmedRecords(
    collection(db, 'users', uid, 'aziende'));

export const getFirstCompany = uid => readFirstRecord(`first-company:${uid}`, query(
    collection(db, 'users', uid, 'aziende'), limit(1)
));

export const listCompanyAccounts = (uid, companyId) => readRecords(`company-accounts:${uid}:${companyId}`,
    collection(db, 'users', uid, 'aziende', companyId, 'accounts'));

export const listCompanyAccountsConfirmed = (uid, companyId) => readConfirmedRecords(
    collection(db, 'users', uid, 'aziende', companyId, 'accounts'));

export const listDeadlines = uid => readRecords(`deadlines:${uid}`,
    collection(db, 'users', uid, 'scadenze'));

export const listReceivedDeadlines = uid => readRecords(`received-deadlines:${uid}`,
    collection(db, 'users', uid, 'receivedDeadlines'));

export const getDeadline = (uid, deadlineId) =>
    getRecordByPath(`users/${uid}/scadenze/${deadlineId}`);

export const getReceivedDeadline = (uid, receivedDeadlineId) =>
    getRecordByPath(`users/${uid}/receivedDeadlines/${receivedDeadlineId}`);

export const getDeadlineNotification = (uid, notificationId) =>
    getRecordByPath(`users/${uid}/deadlineNotifications/${notificationId}`);

export const listDeadlineNotifications = uid => readRecords(`deadline-notifications:${uid}`,
    collection(db, 'users', uid, 'deadlineNotifications'));

export const listCompanyAccountAttachments = (uid, companyId, accountId) =>
    readRecords(`company-account-attachments:${uid}:${companyId}:${accountId}`, query(
        collection(db, 'users', uid, 'aziende', companyId, 'accounts', accountId, 'attachments'),
        orderBy('createdAt', 'desc')
    ));

export const listPrivateAccountAttachments = (uid, accountId) =>
    readRecords(`private-account-attachments:${uid}:${accountId}`, query(
        collection(db, 'users', uid, 'accounts', accountId, 'attachments'),
        orderBy('createdAt', 'desc')
    ));

export const getInvite = inviteId => getRecordByPath(`invites/${inviteId}`);
export const getPushDevice = (uid, deviceId) => getRecordByPath(`users/${uid}/pushDevices/${deviceId}`);

export const listContacts = uid => readRecords(`contacts:${uid}`,
    collection(db, 'users', uid, 'contacts'));

export const listProfileWidgets = uid => readRecords(`profile-widgets:${uid}`,
    collection(db, 'users', uid, 'profileWidgets'));
export const listSharedVaultData = uid => readRecords(`shared-vault-data:${uid}`,
    collection(db, 'users', uid, 'sharedVaultData'));
export const listSharedVaultDataConfirmed = uid => readConfirmedRecords(
    collection(db, 'users', uid, 'sharedVaultData'));
export const listSharedVaultLinks = uid => readRecords(`shared-vault-links:${uid}`,
    collection(db, 'users', uid, 'sharedVaultLinks'));
export const listSharedVaultLinksConfirmed = uid => readConfirmedRecords(
    collection(db, 'users', uid, 'sharedVaultLinks'));
export const listAccountWidgets = uid => readRecords(`account-widgets:${uid}`,
    collection(db, 'users', uid, 'accountWidgets'));
export const listAccountWidgetsConfirmed = uid => readConfirmedRecords(
    collection(db, 'users', uid, 'accountWidgets'));
export const listEmbeddedAccountWidgets = async (uid, account) => (await listAccountWidgets(uid))
    .filter(widget => widget.kind === 'embedded' && widget.context === account.context &&
        widget.accountId === account.accountId &&
        (account.context !== 'company' || widget.companyId === account.companyId))
    .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));
export const listEmbeddedAccountWidgetsConfirmed = async (uid, account) =>
    (await listAccountWidgetsConfirmed(uid))
        .filter(widget => widget.kind === 'embedded' && widget.context === account.context &&
            widget.accountId === account.accountId &&
            (account.context !== 'company' || widget.companyId === account.companyId))
        .sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

export const getUserProfile = uid => readRecord(`profile:${uid}`, doc(db, 'users', uid));

// M8: fotografia server-confermata dei soli domini proprietari ammessi dal
// contratto backup. Non usa cache perché un file incompleto sembrerebbe valido.
export const getBackupProfile = uid => readConfirmedRecord(doc(db, 'users', uid));
export const listBackupSettings = uid => readConfirmedRecords(collection(db, 'users', uid, 'settings'));
export const listBackupPrivateAccounts = uid => readConfirmedRecords(collection(db, 'users', uid, 'accounts'));
export const listBackupCompanies = uid => readConfirmedRecords(collection(db, 'users', uid, 'aziende'));
export const listBackupCompanyAccounts = (uid, companyId) => readConfirmedRecords(
    collection(db, 'users', uid, 'aziende', companyId, 'accounts'));
export const listBackupDeadlines = uid => readConfirmedRecords(collection(db, 'users', uid, 'scadenze'));
export const listBackupContacts = uid => readConfirmedRecords(collection(db, 'users', uid, 'contacts'));
export const listBackupProfileWidgets = uid => readConfirmedRecords(collection(db, 'users', uid, 'profileWidgets'));
export const listBackupPrivateAttachments = (uid, accountId) => readConfirmedRecords(
    collection(db, 'users', uid, 'accounts', accountId, 'attachments'));
export const listBackupCompanyAttachments = (uid, companyId, accountId) => readConfirmedRecords(
    collection(db, 'users', uid, 'aziende', companyId, 'accounts', accountId, 'attachments'));
export const listBackupAccountWidgets = uid => readConfirmedRecords(
    collection(db, 'users', uid, 'accountWidgets'));
export const listBackupSharedVaultData = uid => readConfirmedRecords(
    collection(db, 'users', uid, 'sharedVaultData'));
export const listBackupSharedVaultLinks = uid => readConfirmedRecords(
    collection(db, 'users', uid, 'sharedVaultLinks'));

// Punto d'integrazione M5 deliberatamente inattivo: i chiamanti esistenti
// continuano a usare i record legacy finché il cutover non viene autorizzato.
export const getMigratingRecord = async options => {
    const {readMigratingRecord} = await import('./shared-record-reader.js');
    return readMigratingRecord(options);
};
