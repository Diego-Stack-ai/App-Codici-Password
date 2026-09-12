import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, terminate} from 'firebase/firestore';
import {createFirebaseSession} from './firebase-session.mjs';
import {preparePrivateAccountMutation} from './prepare-private-account-mutation.mjs';

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');

// Import only after emulator guards. .run invokes the original handler directly:
// no Functions server, HTTP/App Check validation, scheduled work or trigger dispatch.
const requireFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const {applyPrivateAccountMutation} = requireFunctions('./index.js');
const {getApps, deleteApp: deleteAdminApp} = requireFunctions('firebase-admin/app');
const {getFirestore: getAdminFirestore} = requireFunctions('firebase-admin/firestore');
const source = await readFile(new URL('../../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url), 'utf8');
const cryptoApi = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('original private-account handler persists prepared ciphertext in the demo Firestore emulator', async t => {
    const clients = [];
    t.after(async () => {
        for (const client of clients) { client.session?.dispose(); await terminate(client.db); await deleteApp(client.app); }
        for (const app of getApps()) { await getAdminFirestore(app).terminate(); await deleteAdminApp(app); }
    });
    async function seed(suffix) {
        const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'}, `mutation-${suffix}-${crypto.randomUUID()}`);
        const auth = initializeAuth(app, {persistence: inMemoryPersistence});
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
        const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
        const client = {app, auth, db}; clients.push(client);
        const {user} = await createUserWithEmailAndPassword(auth, `mutation-${suffix}-${crypto.randomUUID()}@example.invalid`, 'LOGIN-SYNTHETIC!123');
        client.uid = user.uid;
        const master = `MASTER-SYNTHETIC-${suffix}!123`, key = cryptoApi.generateVaultKey();
        await setDoc(doc(db, 'users', user.uid, 'settings', 'security'), {
            verifier: await cryptoApi.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', master),
            vaultKeyEnvelope: await cryptoApi.wrapVaultKey(key, master)
        });
        const record = {ownerId: user.uid, schemaVersion: 1, revision: 1, type: 'account', visibility: 'private', _encrypted: true,
            nomeAccount: 'Titolo legacy sintetico', url: 'https://example.invalid'};
        for (const field of ['username', 'account', 'password', 'note']) record[field] = await cryptoApi.encrypt(`ORIGINAL-${suffix}-${field}`, key);
        await setDoc(doc(db, 'users', user.uid, 'accounts', 'fixture'), record);
        client.originalPassword = record.password;
        client.session = createFirebaseSession({auth, db, cryptoApi, requestPassword: async () => master,
            routes: {overview: context => { client.context = context; }}});
        await client.session.unlock(); await client.session.navigate('overview');
        return client;
    }
    const a = await seed('A'), b = await seed('B');
    const recordRef = client => doc(client.db, 'users', client.uid, 'accounts', 'fixture');
    const stored = async client => (await getDocFromServer(recordRef(client))).data();
    const prepare = async (client, value, operationId) => preparePrivateAccountMutation({
        context: client.context, source: {...await stored(client), id: 'fixture'}, changes: {password: value},
        domain: 'private', uid: client.uid, recordId: 'fixture', expectedRevision: 1,
        operationId, deviceId: 'emulator-test-device', hasProfileLink: false
    });
    const operation = await prepare(a, 'UPDATED-SYNTHETIC-A', 'mutation-a');
    const run = (client, data) => applyPrivateAccountMutation.run({auth: {uid: client.uid}, data});

    await t.test('preparation alone does not write; the original handler applies ciphertext and increments revision', async () => {
        assert.equal((await stored(a)).password, a.originalPassword);
        const result = await run(a, operation);
        assert.equal(result.status, 'applied'); assert.equal(result.revision, 2); assert.equal(result.duplicate, false);
        const saved = await stored(a);
        assert.equal(saved.password, operation.record.password);
        assert.equal(cryptoApi.isEncryptedValue(saved.password), true);
        assert.equal(saved.revision, 2);
        assert.equal(await a.context.readAccount({id: 'fixture', field: 'password'}), 'UPDATED-SYNTHETIC-A');
    });
    await t.test('retrying the same operation is idempotent', async () => {
        const before = await stored(a), result = await run(a, operation), after = await stored(a);
        assert.equal(result.status, 'applied'); assert.equal(result.revision, 2); assert.equal(result.duplicate, true);
        assert.equal(after.password, before.password); assert.equal(after.revision, before.revision);
        assert.equal(after.updatedAt.isEqual(before.updatedAt), true);
    });
    await t.test('a stale revision conflicts without modifying the record or recording an applied result', async () => {
        const result = await run(a, {...operation, operationId: 'stale-operation'});
        assert.equal(result.status, 'conflict'); assert.equal(result.currentRevision, 2);
        assert.equal((await stored(a)).revision, 2);
        const audit = await getAdminFirestore().doc(`users/${a.uid}/operationResults/stale-operation`).get();
        assert.equal(audit.exists, false);
    });
    await t.test('operation identifiers cannot be reused for another record', async () => {
        await assert.rejects(run(a, {...operation, recordId: 'another-record'}), error => error.code === 'already-exists');
    });
    await t.test('another authenticated UID writes only its own namespace and remains separately decryptable', async () => {
        const second = await prepare(b, 'UPDATED-SYNTHETIC-B', 'mutation-a');
        const result = await run(b, second);
        assert.equal(result.status, 'applied'); assert.equal(result.revision, 2);
        assert.equal(await b.context.readAccount({id: 'fixture', field: 'password'}), 'UPDATED-SYNTHETIC-B');
        assert.equal(await a.context.readAccount({id: 'fixture', field: 'password'}), 'UPDATED-SYNTHETIC-A');
        assert.notEqual((await stored(b)).password, (await stored(a)).password);
    });
    await t.test('missing Auth context and invalid plaintext are rejected by the original handler', async () => {
        await assert.rejects(applyPrivateAccountMutation.run({data: operation}), error => error.code === 'unauthenticated');
        await assert.rejects(run(a, {...operation, operationId: 'invalid-plain', record: {...operation.record, password: 'plain'}}),
            error => error.code === 'invalid-argument');
        assert.equal((await stored(a)).revision, 2);
    });
});
