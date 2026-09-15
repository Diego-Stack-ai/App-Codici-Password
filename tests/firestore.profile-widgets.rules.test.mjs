import {after, before, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc} from 'firebase/firestore';

const PROJECT_ID = 'codici-password-rules-test';
const OWNER_UID = 'owner-user';
const OTHER_UID = 'other-user';
let testEnv;

const validWidget = (fields = []) => ({
  title: 'Dati personali', description: '', icon: 'widgets', color: '#3b82f6',
  tab: 'personal', order: 0, size: 'medium', collapsed: false,
  fields, updatedAt: '2026-09-05T00:00:00.000Z', schemaVersion: 1,
});

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
  });
});

after(async () => testEnv?.cleanup());

test('profilo, Account personali e aziendali: anonimo e altro UID non leggono né scrivono', async () => {
  const owner = testEnv.authenticatedContext(OWNER_UID).firestore();
  const paths = [`users/${OWNER_UID}`, `users/${OWNER_UID}/accounts/isolation`,
    `users/${OWNER_UID}/aziende/isolation`, `users/${OWNER_UID}/aziende/isolation/accounts/bank`,
    `users/${OWNER_UID}/settings/security`];
  for (const path of paths) {
    await assertSucceeds(setDoc(doc(owner, path), {synthetic: true}));
    await assertSucceeds(getDoc(doc(owner, path)));
    for (const db of [testEnv.unauthenticatedContext().firestore(), testEnv.authenticatedContext(OTHER_UID).firestore()]) {
      await assertFails(getDoc(doc(db, path)));
      await assertFails(setDoc(doc(db, path), {synthetic: 'unauthorized'}));
      await assertFails(updateDoc(doc(db, path), {sharedWithUids: [OTHER_UID]}));
      await assertFails(deleteDoc(doc(db, path)));
    }
  }
});

test('liste Account e aziende non enumerabili da anonimo o altro UID', async () => {
  for (const path of [`users/${OWNER_UID}/accounts`, `users/${OWNER_UID}/aziende`,
    `users/${OWNER_UID}/aziende/isolation/accounts`, `users/${OWNER_UID}/accountWidgets`,
    `users/${OWNER_UID}/sharedVaultData`]) {
    await assertSucceeds(getDocs(collection(testEnv.authenticatedContext(OWNER_UID).firestore(), path)));
    for (const db of [testEnv.unauthenticatedContext().firestore(), testEnv.authenticatedContext(OTHER_UID).firestore()]) {
      await assertFails(getDocs(collection(db, path)));
    }
  }
});

test('ospite esplicitamente condiviso legge solo il record concesso e perde accesso dopo revoca', async () => {
  const owner = testEnv.authenticatedContext(OWNER_UID).firestore();
  const guest = testEnv.authenticatedContext(OTHER_UID).firestore();
  for (const path of [`users/${OWNER_UID}/accounts/shared-isolation`, `users/${OWNER_UID}/aziende/isolation/accounts/shared-isolation`]) {
    await setDoc(doc(owner, path), {synthetic: true, sharedWithUids: [OTHER_UID]});
    await assertSucceeds(getDoc(doc(guest, path)));
    await assertFails(updateDoc(doc(guest, path), {synthetic: false}));
    await assertFails(deleteDoc(doc(guest, path)));
    await assertFails(getDoc(doc(guest, `${path}/private/child`)));
    await updateDoc(doc(owner, path), {sharedWithUids: []});
    await assertFails(getDoc(doc(guest, path)));
  }
});

test('solo il proprietario può creare, leggere ed eliminare un widget valido', async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
  const widgetRef = doc(ownerDb, 'users', OWNER_UID, 'profileWidgets', 'w1');
  await assertSucceeds(setDoc(widgetRef, validWidget()));
  await assertSucceeds(getDoc(widgetRef));
  await assertFails(getDoc(doc(testEnv.authenticatedContext(OTHER_UID).firestore(), 'users', OWNER_UID, 'profileWidgets', 'w1')));
  await assertSucceeds(deleteDoc(widgetRef));
});

test('schema non previsto, tab non valida e oltre 30 campi vengono respinti', async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
  const base = doc(ownerDb, 'users', OWNER_UID, 'profileWidgets', 'invalid');
  await assertFails(setDoc(base, {...validWidget(), unexpected: true}));
  await assertFails(setDoc(base, {...validWidget(), tab: 'overview'}));
  await assertFails(setDoc(base, validWidget(Array.from({length: 31}, (_, id) => ({id})))));
});

test('i contatti sono gestibili dal proprietario ma la cancellazione diretta è bloccata', async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
  const contactRef = doc(ownerDb, 'users', OWNER_UID, 'contacts', 'contact-1');
  await assertSucceeds(setDoc(contactRef, {
    nome: 'Maria', cognome: 'Rossi', email: 'maria@example.com',
    emailNormalized: 'maria@example.com', active: true,
  }));
  await assertSucceeds(getDoc(contactRef));
  await assertFails(deleteDoc(contactRef));
});

test('la scadenza ricevuta è leggibile solo dal destinatario e non è scrivibile dal client', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users', OWNER_UID, 'receivedDeadlines', 'received-1'), {
      ownerUid: OTHER_UID,
      sourceDeadlineId: 'deadline-1',
      recipientEmail: 'owner@example.com',
      permission: 'manage',
      dueDate: '2027-09-08',
    });
  });
  const ownerRef = doc(
    testEnv.authenticatedContext(OWNER_UID).firestore(),
    'users', OWNER_UID, 'receivedDeadlines', 'received-1'
  );
  const otherRef = doc(
    testEnv.authenticatedContext(OTHER_UID).firestore(),
    'users', OWNER_UID, 'receivedDeadlines', 'received-1'
  );
  await assertSucceeds(getDoc(ownerRef));
  await assertFails(getDoc(otherRef));
  await assertFails(updateDoc(ownerRef, {dueDate: '2028-09-08'}));
  await assertFails(deleteDoc(ownerRef));
});

test('l’indice tecnico delle scadenze condivise non è accessibile ai client', async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
  const shareRef = doc(ownerDb, 'deadlineShares', 'share-1');
  await assertFails(getDoc(shareRef));
  await assertFails(setDoc(shareRef, {ownerUid: OWNER_UID, recipientUids: [OTHER_UID]}));
});

test('i nuovi domini protetti sono leggibili dal proprietario ma scrivibili solo dal backend', async () => {
  await testEnv.withSecurityRulesDisabled(async context => {
    const adminDb = context.firestore();
    await setDoc(doc(adminDb, 'users', OWNER_UID, 'accountWidgets', 'w1'), {title: 'Domande'});
    await setDoc(doc(adminDb, 'users', OWNER_UID, 'sharedVaultData', 's1'), {title: 'Codice app'});
    await setDoc(doc(adminDb, 'users', OWNER_UID, 'sharedVaultLinks', 'l1'), {sharedDataId: 's1'});
  });
  const ownerDb = testEnv.authenticatedContext(OWNER_UID).firestore();
  const otherDb = testEnv.authenticatedContext(OTHER_UID).firestore();
  for (const [collectionName, id] of [
    ['accountWidgets', 'w1'], ['sharedVaultData', 's1'], ['sharedVaultLinks', 'l1']
  ]) {
    await assertSucceeds(getDoc(doc(ownerDb, 'users', OWNER_UID, collectionName, id)));
    await assertFails(getDoc(doc(otherDb, 'users', OWNER_UID, collectionName, id)));
    await assertFails(setDoc(doc(ownerDb, 'users', OWNER_UID, collectionName, 'new'), {title: 'Non ammesso'}));
  }
});
