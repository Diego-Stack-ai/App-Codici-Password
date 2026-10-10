import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {deleteDoc, doc, getDoc, setDoc, updateDoc} from 'firebase/firestore';

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

const ownerDb = () => testEnv.authenticatedContext(OWNER, {email: 'owner@example.invalid'}).firestore();

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
