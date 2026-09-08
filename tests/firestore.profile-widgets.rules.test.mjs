import {after, before, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {deleteDoc, doc, getDoc, setDoc, updateDoc} from 'firebase/firestore';

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
