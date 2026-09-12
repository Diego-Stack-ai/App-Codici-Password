import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, terminate} from 'firebase/firestore';
import {createFirebaseSession} from './firebase-session.mjs';
import {preparePrivateAccountMutation} from './prepare-private-account-mutation.mjs';
import {createPrivateAccountSaveController} from './private-account-save-controller.mjs';

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

    const inputFor = async (client, operationId, password) => {
        const source = {...await stored(client), id: 'fixture'};
        return {source, changes: {password}, domain: 'private', uid: client.uid, recordId: 'fixture',
            expectedRevision: source.revision, operationId, deviceId: 'emulator-save-controller', hasProfileLink: false};
    };
    const readResult = async (client, operationId) => {
        const result = await getDocFromServer(doc(client.db, 'users', client.uid, 'operationResults', operationId));
        return result.exists() ? result.data() : null;
    };
    const makeController = (client, overrides = {}) => createPrivateAccountSaveController({
        context: client.context, getUser: () => client.auth.currentUser,
        prepare: input => preparePrivateAccountMutation({...input, context: client.context}),
        submit: envelope => run(client, envelope), lookupResult: operationId => readResult(client, operationId),
        ...overrides
    });

    await t.test('lost response after commit becomes unknown and reconciles from the original result without another write', async () => {
        const input = await inputFor(a, 'lost-response-reconcile', 'RECONCILED-SYNTHETIC');
        let submits = 0;
        const controller = makeController(a, {submit: async envelope => {
            submits++; await run(a, envelope); throw new Error('SIMULATED_RESPONSE_LOST');
        }});
        const pending = await controller.save(input);
        assert.equal(pending.status, 'unknown');
        const committed = await stored(a);
        assert.equal(committed.revision, input.expectedRevision + 1);
        const result = await readResult(a, input.operationId);
        assert.equal(result.domain, 'private-account'); assert.equal(result.recordId, 'fixture'); assert.equal(result.ownerUid, a.uid);
        const reconciled = await controller.reconcile();
        assert.equal(reconciled.status, 'applied'); assert.equal(reconciled.revision, committed.revision);
        assert.equal(submits, 1);
        const after = await stored(a);
        assert.equal(after.revision, committed.revision); assert.equal(after.password, committed.password);
        assert.equal(after.updatedAt.isEqual(committed.updatedAt), true);
        assert.equal(await a.context.readAccount({id: 'fixture', field: 'password'}), 'RECONCILED-SYNTHETIC');
    });

    await t.test('retry after a lost response reuses the same prepared envelope and operation identity', async () => {
        const input = await inputFor(a, 'lost-response-retry', 'RETRY-SYNTHETIC');
        const submitted = []; let preparations = 0;
        const controller = makeController(a, {
            prepare: async value => { preparations++; return preparePrivateAccountMutation({...value, context: a.context}); },
            submit: async envelope => {
                submitted.push(envelope); const result = await run(a, envelope);
                if (submitted.length === 1) throw new Error('SIMULATED_RESPONSE_LOST');
                return result;
            }
        });
        assert.equal((await controller.save(input)).status, 'unknown');
        const committed = await stored(a), retried = await controller.retry();
        assert.equal(retried.status, 'applied'); assert.equal(retried.duplicate, true);
        assert.equal(preparations, 1); assert.equal(submitted.length, 2); assert.equal(submitted[0], submitted[1]);
        assert.equal(submitted[1].operationId, input.operationId);
        const after = await stored(a);
        assert.equal(after.revision, committed.revision); assert.equal(after.password, committed.password);
        assert.equal(after.updatedAt.isEqual(committed.updatedAt), true);
    });

    await t.test('client Rules deny reading another UID operation result', async () => {
        await assert.rejects(getDocFromServer(doc(b.db, 'users', a.uid, 'operationResults', 'lost-response-reconcile')),
            error => error.code === 'permission-denied');
        const own = await readResult(a, 'lost-response-reconcile');
        assert.equal(own.ownerUid, a.uid); assert.equal(own.recordId, 'fixture');
    });

    await t.test('reconciliation rejects mismatched result domain, record and owner before accepting the matching original result', async () => {
        const input = await inputFor(a, 'reconcile-identity', 'IDENTITY-SYNTHETIC');
        let mismatch = {};
        const controller = makeController(a, {submit: async envelope => {
            await run(a, envelope); throw new Error('SIMULATED_RESPONSE_LOST');
        }, lookupResult: async operationId => ({...await readResult(a, operationId), ...mismatch})});
        assert.equal((await controller.save(input)).status, 'unknown');
        for (const altered of [{domain: 'another-domain'}, {recordId: 'another-record'}, {ownerUid: b.uid}]) {
            mismatch = altered;
            assert.equal((await controller.reconcile()).status, 'unknown');
        }
        mismatch = {};
        assert.equal((await controller.reconcile()).status, 'applied');
        assert.equal((await stored(a)).revision, input.expectedRevision + 1);
    });

    await t.test('abort before submission detaches and leaves neither mutation nor result', async () => {
        const input = await inputFor(a, 'abort-before-submit', 'ABORTED-SYNTHETIC');
        const signalController = new AbortController(), context = {...a.context, signal: signalController.signal};
        let release, entered;
        const gate = new Promise(resolve => { release = resolve; });
        const started = new Promise(resolve => { entered = resolve; });
        let submits = 0;
        const controller = makeController(a, {context,
            prepare: async value => {
                const envelope = await preparePrivateAccountMutation({...value, context});
                entered(); await gate; return envelope;
            },
            submit: async envelope => { submits++; return run(a, envelope); }
        });
        const before = await stored(a), saving = controller.save(input);
        await started; signalController.abort(); release();
        assert.equal((await saving).status, 'detached'); assert.equal(submits, 0);
        const after = await stored(a);
        assert.equal(after.revision, before.revision); assert.equal(after.password, before.password);
        assert.equal(after.updatedAt.isEqual(before.updatedAt), true);
        assert.equal(await readResult(a, input.operationId), null);
        const adminResult = await getAdminFirestore().doc(`users/${a.uid}/operationResults/${input.operationId}`).get();
        assert.equal(adminResult.exists, false);
    });

    await t.test('known gate: owner-writable operation results can forge a duplicate applied response without changing the record', async () => {
        const input = await inputFor(a, 'known-gate-forged-result', 'MUST-NOT-BE-APPLIED');
        const envelope = await preparePrivateAccountMutation({...input, context: a.context});
        const before = await stored(a);
        // Characterization of existing Rules/handler trust, not a corrected path.
        // This write uses the ordinary authenticated client, not Admin privileges.
        await setDoc(doc(a.db, 'users', a.uid, 'operationResults', input.operationId), {
            domain: 'private-account', recordId: input.recordId, ownerUid: a.uid,
            deviceId: input.deviceId, status: 'applied', revision: input.expectedRevision + 1, duplicate: false
        });
        const claimed = await run(a, envelope);
        assert.equal(claimed.status, 'applied'); assert.equal(claimed.duplicate, true);
        assert.equal(claimed.revision, input.expectedRevision + 1);
        const after = await stored(a);
        assert.equal(after.revision, before.revision); assert.notEqual(after.revision, claimed.revision);
        assert.equal(after.password, before.password); assert.notEqual(after.password, envelope.record.password);
        assert.equal(after.updatedAt.isEqual(before.updatedAt), true);
    });
});
