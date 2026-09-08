import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc, updateDoc} from 'firebase/firestore';

const PROJECT_ID = 'codici-password-offline-sync-test';
const OWNER = 'fixture-owner';
const OTHER = 'fixture-other';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({projectId: PROJECT_ID, firestore: {
    rules: await readFile(new URL('../experiments/offline-sync/firestore.candidate.rules', import.meta.url), 'utf8')
  }});
});
beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv?.cleanup());

async function seed() {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users', OWNER, 'syncRecords', 'record-1'), {revision: 3, payload: 'ciphertext'});
    await setDoc(doc(context.firestore(), 'users', OWNER, 'operationResults', 'device-a-1'), {status: 'applied', revision: 3});
  });
}

test('il proprietario legge record ed esito puntuali, gli altri no', async () => {
  await seed();
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  const otherDb = testEnv.authenticatedContext(OTHER).firestore();
  await assertSucceeds(getDoc(doc(ownerDb, 'users', OWNER, 'syncRecords', 'record-1')));
  await assertSucceeds(getDoc(doc(ownerDb, 'users', OWNER, 'operationResults', 'device-a-1')));
  await assertFails(getDoc(doc(otherDb, 'users', OWNER, 'syncRecords', 'record-1')));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'users', OWNER, 'operationResults', 'device-a-1')));
});

test('nessun client crea o aggiorna record ed esiti di sincronizzazione', async () => {
  await seed();
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(updateDoc(doc(ownerDb, 'users', OWNER, 'syncRecords', 'record-1'), {revision: 4}));
  await assertFails(setDoc(doc(ownerDb, 'users', OWNER, 'operationResults', 'forged'), {status: 'applied'}));
});
