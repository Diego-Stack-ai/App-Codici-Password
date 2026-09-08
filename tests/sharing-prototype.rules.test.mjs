import {after, before, beforeEach, test} from 'node:test';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {Timestamp, deleteDoc, doc, getDoc, setDoc, updateDoc} from 'firebase/firestore';

const PROJECT_ID = 'codici-password-sharing-rules-test';
const OWNER = 'fixture-owner';
const RECIPIENT = 'fixture-recipient';
const STRANGER = 'fixture-stranger';
const RECORD = 'fixture-record';
let testEnv;

const record = generation => ({
  schemaVersion: 2,
  cryptoProtocol: 'record-key-v1',
  ownerUid: OWNER,
  keyGeneration: generation,
  payload: {ciphertext: 'fixture-ciphertext', iv: 'fixture-iv'}
});

const grant = overrides => ({
  ownerUid: OWNER,
  recipientUid: RECIPIENT,
  role: 'viewer',
  status: 'accepted',
  keyGeneration: 1,
  envelope: {wrappedKey: 'fixture-envelope'},
  ...overrides
});

async function seed({recordGeneration = 1, grantOverrides = {}} = {}) {
  await testEnv.withSecurityRulesDisabled(async context => {
    const db = context.firestore();
    await setDoc(doc(db, 'sharedRecords', RECORD), record(recordGeneration));
    await setDoc(doc(db, 'recordAccess', RECORD, 'members', RECIPIENT), grant(grantOverrides));
    await setDoc(doc(db, 'cryptoPublicKeys', RECIPIENT), {algorithm: 'ECDH-P256', publicKey: {kty: 'EC'}});
    await setDoc(doc(db, 'users', RECIPIENT, 'cryptoIdentity', 'current'), {privateKeyEnvelope: 'fixture-private-envelope'});
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {rules: await readFile(new URL('../experiments/sharing-key-prototype/firestore.candidate.rules', import.meta.url), 'utf8')}
  });
});

beforeEach(async () => testEnv.clearFirestore());
after(async () => testEnv?.cleanup());

test('proprietario e destinatario attivo leggono, estraneo no', async () => {
  await seed();
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(OWNER).firestore(), 'sharedRecords', RECORD)));
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(RECIPIENT).firestore(), 'sharedRecords', RECORD)));
  await assertFails(getDoc(doc(testEnv.authenticatedContext(STRANGER).firestore(), 'sharedRecords', RECORD)));
});

test('revoca, scadenza e generazione obsoleta negano il record', async () => {
  for (const options of [
    {grantOverrides: {status: 'revoked'}},
    {grantOverrides: {expiresAt: Timestamp.fromMillis(Date.now() - 60_000)}},
    {recordGeneration: 2}
  ]) {
    await testEnv.clearFirestore();
    await seed(options);
    await assertFails(getDoc(doc(testEnv.authenticatedContext(RECIPIENT).firestore(), 'sharedRecords', RECORD)));
  }
});

test('il destinatario legge soltanto il proprio grant', async () => {
  await seed();
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(RECIPIENT).firestore(), 'recordAccess', RECORD, 'members', RECIPIENT)));
  await assertFails(getDoc(doc(testEnv.authenticatedContext(STRANGER).firestore(), 'recordAccess', RECORD, 'members', RECIPIENT)));
});

test('nessun client modifica record, grant o identità crittografiche', async () => {
  await seed();
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  const recipientDb = testEnv.authenticatedContext(RECIPIENT).firestore();
  await assertFails(updateDoc(doc(ownerDb, 'sharedRecords', RECORD), {keyGeneration: 2}));
  await assertFails(deleteDoc(doc(ownerDb, 'sharedRecords', RECORD)));
  await assertFails(updateDoc(doc(recipientDb, 'recordAccess', RECORD, 'members', RECIPIENT), {role: 'owner'}));
  await assertFails(setDoc(doc(recipientDb, 'cryptoPublicKeys', RECIPIENT), {publicKey: 'sostituita'}));
  await assertFails(setDoc(doc(recipientDb, 'users', RECIPIENT, 'cryptoIdentity', 'next'), {privateKeyEnvelope: 'sostituita'}));
});

test('chiave pubblica autenticata e identità privata isolata', async () => {
  await seed();
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(OWNER).firestore(), 'cryptoPublicKeys', RECIPIENT)));
  await assertFails(getDoc(doc(testEnv.unauthenticatedContext().firestore(), 'cryptoPublicKeys', RECIPIENT)));
  await assertSucceeds(getDoc(doc(testEnv.authenticatedContext(RECIPIENT).firestore(), 'users', RECIPIENT, 'cryptoIdentity', 'current')));
  await assertFails(getDoc(doc(testEnv.authenticatedContext(STRANGER).firestore(), 'users', RECIPIENT, 'cryptoIdentity', 'current')));
});
