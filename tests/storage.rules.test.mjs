import {after, before, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import {deleteObject, getBytes, ref, uploadBytes} from 'firebase/storage';

const PROJECT_ID = 'codici-password-rules-test';
const OWNER_UID = 'owner-user';
const OTHER_UID = 'other-user';
let testEnv;

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
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
