import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc} from 'firebase/firestore';
const PROJECT_ID = 'demo-codici-password-history-test'; const OWNER = 'owner'; const OTHER = 'other'; let testEnv;
before(async () => { testEnv = await initializeTestEnvironment({projectId: PROJECT_ID, firestore: {rules: await readFile(new URL('../experiments/history-recovery/firestore.candidate.rules', import.meta.url), 'utf8')}}); });
beforeEach(async () => testEnv.clearFirestore()); after(async () => testEnv?.cleanup());
async function seed() { await testEnv.withSecurityRulesDisabled(async context => { for (const name of ['trash', 'recordHistory', 'auditEvents']) await setDoc(doc(context.firestore(), 'users', OWNER, name, 'entry-1'), {recordId: 'r1', payload: 'ciphertext'}); }); }
test('solo il proprietario legge cestino, cronologia e audit', async () => {
  await seed(); const own = testEnv.authenticatedContext(OWNER).firestore(); const other = testEnv.authenticatedContext(OTHER).firestore();
  for (const name of ['trash', 'recordHistory', 'auditEvents']) {
    await assertSucceeds(getDoc(doc(own, 'users', OWNER, name, 'entry-1')));
    await assertSucceeds(getDocs(collection(own, 'users', OWNER, name)));
    await assertFails(getDoc(doc(other, 'users', OWNER, name, 'entry-1')));
  }
});
test('nessun client crea, modifica o cancella gli archivi di recupero', async () => {
  await seed();
  const own = testEnv.authenticatedContext(OWNER).firestore();
  const other = testEnv.authenticatedContext(OTHER).firestore();
  for (const name of ['trash', 'recordHistory', 'auditEvents']) {
    await assertFails(setDoc(doc(own, 'users', OWNER, name, 'forged'), {payload: 'x'}));
    await assertFails(updateDoc(doc(own, 'users', OWNER, name, 'entry-1'), {payload: 'x'}));
    await assertFails(deleteDoc(doc(own, 'users', OWNER, name, 'entry-1')));
    await assertFails(setDoc(doc(other, 'users', OWNER, name, 'forged'), {payload: 'x'}));
  }
  // L'evento di audit è ancora leggibile dal proprietario: nessuna scrittura è passata.
  await assertSucceeds(getDoc(doc(own, 'users', OWNER, 'auditEvents', 'entry-1')));
});
