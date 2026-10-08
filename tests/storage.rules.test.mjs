import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {deleteObject, getBytes, ref, uploadBytes, updateMetadata} from 'firebase/storage';
import {Timestamp, doc, setDoc, deleteDoc} from 'firebase/firestore';

const PROJECT_ID = 'demo-codici-password-rules-test';
const OWNER_UID = 'owner-user';
const OTHER_UID = 'other-user';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8'),
    },
    storage: {
      rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await testEnv?.cleanup();
});

test('il proprietario può caricare, leggere ed eliminare un file consentito', async () => {
  const storage = testEnv.authenticatedContext(OWNER_UID).storage();
  const objectRef = ref(storage, `users/${OWNER_UID}/accounts/a1/attachments/file.pdf`);
  const content = new Uint8Array([1, 2, 3]);

  await assertSucceeds(uploadBytes(objectRef, content, {contentType: 'application/pdf'}));
  const downloaded = await assertSucceeds(getBytes(objectRef));
  assert.deepEqual(new Uint8Array(downloaded), content);
  await assertSucceeds(deleteObject(objectRef));
});

test('un altro utente e un client anonimo non accedono allo spazio del proprietario', async () => {
  const ownerStorage = testEnv.authenticatedContext(OWNER_UID).storage();
  const objectPath = `users/${OWNER_UID}/accounts/a1/attachments/private.txt`;
  await assertSucceeds(uploadBytes(ref(ownerStorage, objectPath), new Uint8Array([1]), {
    contentType: 'text/plain',
  }));

  await assertFails(getBytes(ref(testEnv.authenticatedContext(OTHER_UID).storage(), objectPath)));
  await assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), objectPath)));
});

test('upload fuori dallo spazio UID, MIME non consentito e file oltre 25 MB sono respinti', async () => {
  const storage = testEnv.authenticatedContext(OWNER_UID).storage();

  await assertFails(uploadBytes(ref(storage, 'public/file.pdf'), new Uint8Array([1]), {
    contentType: 'application/pdf',
  }));
  await assertFails(uploadBytes(
    ref(storage, `users/${OWNER_UID}/accounts/a1/attachments/file.html`),
    new Uint8Array([1]),
    {contentType: 'text/html'},
  ));
  await assertFails(uploadBytes(
    ref(storage, `users/${OWNER_UID}/accounts/a1/attachments/too-large.pdf`),
    new Uint8Array(25 * 1024 * 1024 + 1),
    {contentType: 'application/pdf'},
  ));
});

test('il formato binario è ammesso soltanto se marcato come allegato cifrato v1', async () => {
  const storage = testEnv.authenticatedContext(OWNER_UID).storage();
  const plainBinary = ref(storage, `users/${OWNER_UID}/accounts/a1/attachments/plain.bin`);
  const encryptedBinary = ref(storage, `users/${OWNER_UID}/accounts/a1/attachments/encrypted.bin`);
  await assertFails(uploadBytes(plainBinary, new Uint8Array([1]), {contentType: 'application/octet-stream'}));
  await assertSucceeds(uploadBytes(encryptedBinary, new Uint8Array([1]), {
    contentType: 'application/octet-stream',
    customMetadata: {encrypted: 'v1'},
  }));
});

test('un destinatario accettato legge i byte cifrati e la revoca blocca subito il download', async () => {
  const accountId = 'shared-memo';
  const objectPath = `users/${OWNER_UID}/accounts/${accountId}/attachments/shared.bin`;
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users', OWNER_UID, 'accounts', accountId), {
      type: 'memo', visibility: 'shared', isArchived: false, sharedWithUids: [OTHER_UID]
    });
  });
  await assertSucceeds(uploadBytes(
    ref(testEnv.authenticatedContext(OWNER_UID).storage(), objectPath),
    new Uint8Array([4, 5, 6]),
    {contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}}
  ));
  await assertSucceeds(getBytes(ref(testEnv.authenticatedContext(OTHER_UID).storage(), objectPath)));
  await testEnv.withSecurityRulesDisabled(context => setDoc(
    doc(context.firestore(), 'users', OWNER_UID, 'accounts', accountId),
    {type: 'memo', visibility: 'private', isArchived: false, sharedWithUids: []}
  ));
  await assertFails(getBytes(ref(testEnv.authenticatedContext(OTHER_UID).storage(), objectPath)));
});

test('un estraneo non usa il percorso allegati aziendale e la revoca vale anche lì', async () => {
  const companyId = 'company-1', accountId = 'shared-company';
  const objectPath = `users/${OWNER_UID}/aziende/${companyId}/accounts/${accountId}/attachments/shared.bin`;
  await testEnv.withSecurityRulesDisabled(async context => {
    await setDoc(doc(context.firestore(), 'users', OWNER_UID, 'aziende', companyId, 'accounts', accountId), {
      type: 'memo', visibility: 'shared', isArchived: false, sharedWithUids: [OTHER_UID]
    });
  });
  await assertSucceeds(uploadBytes(
    ref(testEnv.authenticatedContext(OWNER_UID).storage(), objectPath),
    new Uint8Array([7, 8, 9]),
    {contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}}
  ));
  await assertSucceeds(getBytes(ref(testEnv.authenticatedContext(OTHER_UID).storage(), objectPath)));
  await assertFails(getBytes(ref(testEnv.authenticatedContext('stranger').storage(), objectPath)));
  await testEnv.withSecurityRulesDisabled(context => setDoc(
    doc(context.firestore(), 'users', OWNER_UID, 'aziende', companyId, 'accounts', accountId),
    {type: 'memo', visibility: 'private', isArchived: false, sharedWithUids: []}
  ));
  await assertFails(getBytes(ref(testEnv.authenticatedContext(OTHER_UID).storage(), objectPath)));
});

test('i contenuti editoriali sono leggibili dagli utenti autenticati ma non modificabili dal client', async () => {
  const mediaPath = 'app-media/presentazione/codici-password-v2.mp4';
  const adminStorage = testEnv.unauthenticatedContext().storage();

  await testEnv.withSecurityRulesDisabled(async (context) => {
    await uploadBytes(ref(context.storage(), mediaPath), new Uint8Array([1, 2, 3]), {
      contentType: 'video/mp4',
    });
  });

  await assertSucceeds(getBytes(ref(testEnv.authenticatedContext(OWNER_UID).storage(), mediaPath)));
  await assertFails(getBytes(ref(adminStorage, mediaPath)));
  await assertFails(uploadBytes(
    ref(testEnv.authenticatedContext(OWNER_UID).storage(), mediaPath),
    new Uint8Array([4]),
    {contentType: 'video/mp4'},
  ));
  await assertFails(deleteObject(ref(testEnv.authenticatedContext(OWNER_UID).storage(), mediaPath)));
});

const stageId = n => n.toString(16).padStart(64, '0');
const stagePath = id => `users/${OWNER_UID}/restoreObjects/${id}`;
async function seedStage(id, patch = {}) {
  const value = {id, storagePath: stagePath(id), status: 'pending', size: 3,
    expiresAt: Timestamp.fromMillis(Date.now() + 60000), ...patch};
  await testEnv.withSecurityRulesDisabled(context =>
    setDoc(doc(context.firestore(), 'backupObjects', OWNER_UID, 'items', id), value));
  return value;
}
const uploadStage = (id, content = new Uint8Array([1, 2, 3]), uid = OWNER_UID) =>
  uploadBytes(ref(testEnv.authenticatedContext(uid).storage(), stagePath(id)), content, {contentType: 'application/pdf'});

test('M8: solo il server crea oggetti; client owner può leggere ma non creare, sostituire o eliminare', async () => {
  const id = stageId(1), object = ref(testEnv.authenticatedContext(OWNER_UID).storage(), stagePath(id));
  await seedStage(id);
  await assertFails(uploadStage(id));
  await testEnv.withSecurityRulesDisabled(context => uploadBytes(ref(context.storage(), stagePath(id)),
    new Uint8Array([1, 2, 3]), {contentType: 'application/pdf'}));
  await assertFails(uploadStage(id, new Uint8Array([4, 5, 6])));
  await assertFails(updateMetadata(object, {customMetadata: {changed: 'yes'}}));
  await assertFails(deleteObject(object));
  assert.deepEqual(new Uint8Array(await assertSucceeds(getBytes(object))), new Uint8Array([1, 2, 3]));
  await assertFails(getBytes(ref(testEnv.authenticatedContext(OTHER_UID).storage(), stagePath(id))));
  await assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), stagePath(id))));
});

test('M8: prenotazione assente, scaduta, pubblicata, in pulizia o incongruente non autorizza upload', async () => {
  await assertFails(uploadStage(stageId(2)));
  const patches = [{expiresAt: Timestamp.fromMillis(0)}, {expiresAt: 'tomorrow'},
    {status: 'published'}, {status: 'deleting'}, {id: stageId(999)},
    {storagePath: `users/${OTHER_UID}/restoreObjects/${stageId(3)}`}, {size: 4}];
  for (let i = 0; i < patches.length; i++) {
    const id = stageId(10 + i);
    await seedStage(id, patches[i]);
    await assertFails(uploadStage(id));
  }
  const id = stageId(30);
  await seedStage(id);
  await assertFails(uploadStage(id, new Uint8Array([1, 2, 3]), OTHER_UID));
});

test('M8: il client non può creare, modificare o eliminare prenotazioni server', async () => {
  const id = stageId(40), db = testEnv.authenticatedContext(OWNER_UID).firestore();
  const target = doc(db, 'backupObjects', OWNER_UID, 'items', id);
  await assertFails(setDoc(target, {status: 'pending'}));
  const value = await seedStage(id);
  await assertFails(setDoc(target, {...value, expiresAt: Timestamp.fromMillis(Date.now() + 999999)}));
  await assertFails(deleteDoc(target));
});

test('M8: nessun catch-all consente sottopercorsi o identificatori diversi nel namespace riservato', async () => {
  const storage = testEnv.authenticatedContext(OWNER_UID).storage();
  for (const suffix of ['not-a-hash', `${stageId(1)}/nested.pdf`, '']) {
    const object = ref(storage, `users/${OWNER_UID}/restoreObjects/${suffix}`);
    await assertFails(uploadBytes(object, new Uint8Array([1]), {contentType: 'application/pdf'}));
  }
  // Single-component legacy owner paths must keep their previous permissions.
  const legacy = ref(storage, `users/${OWNER_UID}/legacy-avatar.png`);
  await assertSucceeds(uploadBytes(legacy, new Uint8Array([1]), {contentType: 'image/png'}));
  await assertSucceeds(deleteObject(legacy));
});

test('M8: neppure due creazioni client concorrenti possono scrivere nel namespace server', async () => {
  const id = stageId(50);
  await seedStage(id);
  const contents = [new Uint8Array([7, 8, 9]), new Uint8Array([10, 11, 12])];
  const outcomes = await Promise.allSettled(contents.map(bytes => uploadStage(id, bytes)));
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 0);
  assert.equal(outcomes.filter(result => result.status === 'rejected').length, 2);
});
