import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, collectionGroup, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where} from 'firebase/firestore';

const PROJECT_ID = 'demo-codici-password-rules-test';
const OWNER = 'purge-owner';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
  });
});

after(async () => testEnv?.cleanup());
beforeEach(async () => testEnv.clearFirestore());

async function seedLock(status = 'active', fields = {}) {
  await testEnv.withSecurityRulesDisabled(async context => setDoc(
    doc(context.firestore(), 'archivePurgeLocks', OWNER),
    {schemaVersion: 1, ownerUid: OWNER, operationId: 'op', targetPath: `users/${OWNER}/accounts/a`,
      digest: 'a'.repeat(64), status, ...fields}
  ));
}

const ownerDb = () => testEnv.authenticatedContext(OWNER, {email: 'owner@example.invalid', email_verified: true}).firestore();

test('lock attivo blocca writer client root, discendenti, azienda e invito', async () => {
  await seedLock('active');
  const db = ownerDb();
  await assertFails(setDoc(doc(db, 'users', OWNER), {displayName: 'Bloccato'}, {merge: true}));
  await assertFails(setDoc(doc(db, 'users', OWNER, 'accounts', 'a'), {title: 'Bloccato'}));
  await assertFails(setDoc(doc(db, 'users', OWNER, 'aziende', 'c'), {name: 'Bloccato'}));
  await assertFails(setDoc(doc(db, 'invites', 'i'), {
    inviteId: 'i', recipientEmail: 'guest@example.invalid', accountId: 'a', accountName: 'A',
    ownerId: OWNER, senderId: OWNER, senderEmail: 'owner@example.invalid', type: 'private',
    status: 'pending', createdAt: 'now', notifyPush: false, notifyEmail: false, cycle: 0
  }));
  await assertSucceeds(getDoc(doc(db, 'users', OWNER)));
});

test('lock rilasciato valido riapre i writer ordinari', async () => {
  await seedLock('released');
  const db = ownerDb();
  await assertSucceeds(setDoc(doc(db, 'users', OWNER), {displayName: 'Consentito'}, {merge: true}));
  await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'accounts', 'a'), {title: 'Consentito'}));
  await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'aziende', 'c'), {name: 'Consentito'}));
});

test('lock malformato fallisce chiuso e nessun client gestisce il namespace', async () => {
  await seedLock('released', {ownerUid: 'other'});
  const db = ownerDb();
  await assertFails(setDoc(doc(db, 'users', OWNER, 'accounts', 'a'), {title: 'Bloccato'}));
  const lockRef = doc(db, 'archivePurgeLocks', OWNER);
  await assertFails(getDoc(lockRef));
  await assertFails(updateDoc(lockRef, {status: 'released'}));
  await assertFails(deleteDoc(lockRef));
});

const recoveryFence = (status, fields = {}) => ({schemaVersion: 1, ownerUid: OWNER, operationId: 'recovery',
  planDigest: 'a'.repeat(64), digest: createHash('sha256').update(JSON.stringify([1, OWNER, 'recovery', 'a'.repeat(64)])).digest('hex'), status, ...fields});
async function seedRecovery(status, fields = {}) {
  await testEnv.withSecurityRulesDisabled(context => setDoc(doc(context.firestore(), 'vaultRecoveryLocks', OWNER), recoveryFence(status, fields)));
}
const ownedPaths = [
  `users/${OWNER}`, `users/${OWNER}/accounts/a`, `users/${OWNER}/accounts/a/attachments/file`,
  `users/${OWNER}/aziende/c`, `users/${OWNER}/aziende/c/accounts/ca`,
  `users/${OWNER}/aziende/c/accounts/ca/attachments/file`,
  ...['auditEvents', 'profileDocumentAttachments', 'operationResults', 'accountWidgets', 'sharedVaultData',
    'receivedDeadlines', 'notifications', 'cryptoIdentity', 'profileWidgets', 'contacts', 'pushDevices',
    'notificationDeliveries', 'deadlineNotifications'].map(name => `users/${OWNER}/${name}/current`),
  `cryptoPublicKeys/${OWNER}`
];
async function seedRecoveryContent() {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    for (const path of ownedPaths) await setDoc(doc(db, path), {title: 'fixture', isArchived: false,
      sharedWithUids: ['guest'], sharedWithEmailByUid: {guest: 'guest@example.invalid'},
      sharedReadyRecipientUids: ['guest'], recipientEmail: 'owner@example.invalid'});
    await setDoc(doc(db, 'invites/i'), {ownerId: OWNER, senderId: OWNER, recipientEmail: 'guest@example.invalid', status: 'accepted'});
  });
}

test('recovery absent/released controls read owner and guest grants and current accepted-invite query', async () => {
  await seedRecoveryContent();
  const guest = testEnv.authenticatedContext('guest', {email: 'guest@example.invalid', email_verified: true}).firestore();
  for (const status of [null, 'released']) {
    if (status) await seedRecovery(status);
    for (const path of ownedPaths) await assertSucceeds(getDoc(doc(ownerDb(), path)));
    await assertSucceeds(getDoc(doc(guest, `users/${OWNER}/accounts/a`)));
    await assertSucceeds(getDoc(doc(guest, `users/${OWNER}/aziende/c/accounts/ca`)));
    await assertSucceeds(getDoc(doc(guest, `users/${OWNER}/accounts/a/attachments/file`)));
    await assertSucceeds(getDoc(doc(guest, `users/${OWNER}/aziende/c/accounts/ca/attachments/file`)));
    const result = await assertSucceeds(getDocs(query(collection(guest, 'invites'), where('recipientEmail', '==', 'guest@example.invalid'), where('status', '==', 'accepted'))));
    if (result.size !== 1) throw Error('ACCEPTED_INVITES_QUERY_CONTROL_EMPTY');
    // No first-party collectionGroup Account caller exists at this base.
    await assertFails(getDocs(query(collectionGroup(guest, 'accounts'), where('sharedWithUids', 'array-contains', 'guest'))));
    await assertSucceeds(getDoc(doc(guest, 'invites/i')));
    await assertSucceeds(setDoc(doc(ownerDb(), `users/${OWNER}/accounts/new`), {title: 'write'}));
    await assertSucceeds(deleteDoc(doc(ownerDb(), `users/${OWNER}/accounts/new`)));
  }
});

test('active/malformed recovery blocks owner and guest content grants, fence metadata stays server-owned', async () => {
  await seedRecoveryContent();
  const guest = testEnv.authenticatedContext('guest', {email: 'guest@example.invalid', email_verified: true}).firestore();
  for (const [status, fields] of [['active', {}], ['released', {ownerUid: 'other'}], ['unknown', {}], ['released', {planDigest: 'bad'}]]) {
    await seedRecovery(status, fields);
    for (const path of ownedPaths) await assertFails(getDoc(doc(ownerDb(), path)));
    await assertFails(getDoc(doc(guest, `users/${OWNER}/accounts/a`)));
    await assertFails(getDoc(doc(guest, `users/${OWNER}/aziende/c/accounts/ca`)));
    await assertFails(getDoc(doc(guest, `users/${OWNER}/accounts/a/attachments/file`)));
    await assertFails(getDoc(doc(guest, `users/${OWNER}/aziende/c/accounts/ca/attachments/file`)));
    await assertFails(getDocs(query(collectionGroup(guest, 'accounts'), where('sharedWithUids', 'array-contains', 'guest'))));
    await assertFails(getDoc(doc(guest, 'invites/i')));
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}/accounts/new`), {title: 'write'}));
    const lock = doc(ownerDb(), 'vaultRecoveryLocks', OWNER);
    await assertSucceeds(getDoc(lock));
    await assertFails(updateDoc(lock, {status: 'released'}));
    await assertFails(deleteDoc(lock));
    await assertFails(getDoc(doc(guest, 'vaultRecoveryLocks', OWNER)));
  }
});

test('released recovery binding digest must match canonical UID operation and plan', async () => {
  await seedRecoveryContent(); await seedRecovery('released');
  await assertSucceeds(getDoc(doc(ownerDb(), `users/${OWNER}/accounts/a`)));
  for (const fields of [{digest: '0'.repeat(64)}, {operationId: 'tampered'}, {planDigest: 'c'.repeat(64)}]) {
    await seedRecovery('released', fields);
    await assertFails(getDoc(doc(ownerDb(), `users/${OWNER}/accounts/a`)));
    await assertFails(setDoc(doc(ownerDb(), `users/${OWNER}/accounts/new`), {title: 'blocked'}));
  }
});
