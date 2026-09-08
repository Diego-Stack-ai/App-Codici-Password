import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {Timestamp, doc, setDoc} from 'firebase/firestore';
import {getBytes, ref, uploadBytes} from 'firebase/storage';

const PROJECT_ID = 'codici-password-sharing-storage-test';
const OWNER = 'fixture-owner';
const RECIPIENT = 'fixture-recipient';
const STRANGER = 'fixture-stranger';
const RECORD = 'fixture-record';
const OBJECT_PATH = `sharedRecords/${RECORD}/attachments/fixture.bin`;
const CONTENT = new Uint8Array([7, 11, 23]);
let testEnv;

async function seed({recordGeneration = 1, grantOverrides = {}} = {}) {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'sharedRecords', RECORD), {
      ownerUid: OWNER,
      keyGeneration: recordGeneration,
      schemaVersion: 2
    });
    await setDoc(doc(db, 'recordAccess', RECORD, 'members', RECIPIENT), {
      ownerUid: OWNER,
      recipientUid: RECIPIENT,
      role: 'viewer',
      status: 'accepted',
      keyGeneration: 1,
      ...grantOverrides
    });
    await uploadBytes(ref(context.storage(), OBJECT_PATH), CONTENT, {
      contentType: 'application/octet-stream',
      customMetadata: {encrypted: 'record-key-v1'}
    });
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: await readFile(new URL('../experiments/sharing-key-prototype/firestore.candidate.rules', import.meta.url), 'utf8')
    },
    storage: {
      rules: await readFile(new URL('../experiments/sharing-key-prototype/storage.candidate.rules', import.meta.url), 'utf8')
    }
  });
});

beforeEach(async () => {
  await testEnv.clearFirestore();
  await testEnv.clearStorage();
});
after(async () => testEnv?.cleanup());

test('il proprietario scarica l’allegato cifrato', async () => {
  await seed();
  const ownerBytes = await assertSucceeds(getBytes(ref(testEnv.authenticatedContext(OWNER).storage(), OBJECT_PATH)));
  assertBytes(ownerBytes);
});

test('il destinatario con grant attivo scarica l’allegato cifrato', async () => {
  await seed();
  const recipientBytes = await assertSucceeds(getBytes(ref(testEnv.authenticatedContext(RECIPIENT).storage(), OBJECT_PATH)));
  assertBytes(recipientBytes);
});

test('estraneo e client anonimo non scaricano l’allegato', async () => {
  await seed();
  await assertFails(getBytes(ref(testEnv.authenticatedContext(STRANGER).storage(), OBJECT_PATH)));
  await assertFails(getBytes(ref(testEnv.unauthenticatedContext().storage(), OBJECT_PATH)));
});

test('revoca, scadenza e generazione obsoleta negano lo stesso oggetto', async () => {
  for (const options of [
    {grantOverrides: {status: 'revoked'}},
    {grantOverrides: {expiresAt: Timestamp.fromMillis(Date.now() - 60_000)}},
    {recordGeneration: 2}
  ]) {
    await testEnv.clearFirestore();
    await testEnv.clearStorage();
    await seed(options);
    await assertFails(getBytes(ref(testEnv.authenticatedContext(RECIPIENT).storage(), OBJECT_PATH)));
  }
});

test('nessun client può creare o sovrascrivere allegati condivisi', async () => {
  await seed();
  await assertFails(uploadBytes(
    ref(testEnv.authenticatedContext(OWNER).storage(), `sharedRecords/${RECORD}/attachments/new.bin`),
    CONTENT,
    {contentType: 'application/octet-stream'}
  ));
  await assertFails(uploadBytes(
    ref(testEnv.authenticatedContext(RECIPIENT).storage(), OBJECT_PATH),
    CONTENT,
    {contentType: 'application/octet-stream'}
  ));
});

function assertBytes(value) {
  if (!(value instanceof ArrayBuffer)) throw new Error('Download Storage non binario');
  const actual = new Uint8Array(value);
  if (actual.length !== CONTENT.length || actual.some((byte, index) => byte !== CONTENT[index])) {
    throw new Error('Contenuto allegato inatteso');
  }
}
