import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, updateDoc, deleteDoc, getDocFromServer, terminate} from 'firebase/firestore';
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
const {applyPrivateAccountMutation, applyOfflineMutation} = requireFunctions('./index.js');
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
        const receipt = (await getDocFromServer(doc(a.db, 'mutationResults', a.uid, 'operations', operation.operationId))).data();
        assert.equal(receipt.operationId, operation.operationId); assert.equal(receipt.bindingVersion, 1);
        assert.match(receipt.operationHash, /^[a-f0-9]{64}$/);
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
        const audit = await getAdminFirestore().doc(`mutationResults/${a.uid}/operations/stale-operation`).get();
        assert.equal(audit.exists, false);
    });
    await t.test('operation identifiers cannot be reused for another record', async () => {
        await assert.rejects(run(a, {...operation, recordId: 'another-record'}), error => error.code === 'already-exists');
    });
    await t.test('a committed operation identity cannot be reused with changed ciphertext, device or expected revision', async () => {
        const before = await stored(a);
        const changedPassword = await a.context.encrypt('DIFFERENT-SYNTHETIC-PAYLOAD');
        for (const altered of [
            {...operation, record: {...operation.record, password: changedPassword}},
            {...operation, deviceId: 'different-device'},
            {...operation, expectedRevision: operation.expectedRevision + 1}
        ]) await assert.rejects(run(a, altered), error => error.code === 'already-exists');
        const after = await stored(a);
        assert.equal(after.password, before.password); assert.equal(after.revision, before.revision);
        assert.equal(after.updatedAt.isEqual(before.updatedAt), true);
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
        const result = await getDocFromServer(doc(client.db, 'mutationResults', client.uid, 'operations', operationId));
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
        await assert.rejects(getDocFromServer(doc(b.db, 'mutationResults', a.uid, 'operations', 'lost-response-reconcile')),
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
        for (const altered of [{domain: 'another-domain'}, {recordId: 'another-record'}, {ownerUid: b.uid}, {operationId: 'another-operation'}]) {
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
        const adminResult = await getAdminFirestore().doc(`mutationResults/${a.uid}/operations/${input.operationId}`).get();
        assert.equal(adminResult.exists, false);
    });

    await t.test('client Rules prevent forged applied receipts and the legitimate handler still commits once', async () => {
        const input = await inputFor(a, 'blocked-forged-result', 'LEGITIMATE-SYNTHETIC-UPDATE');
        const envelope = await preparePrivateAccountMutation({...input, context: a.context});
        const before = await stored(a);
        const resultRef = doc(a.db, 'mutationResults', a.uid, 'operations', input.operationId);
        await assert.rejects(setDoc(resultRef, {
            domain: 'private-account', recordId: input.recordId, ownerUid: a.uid,
            deviceId: input.deviceId, status: 'applied', revision: input.expectedRevision + 1, duplicate: false
        }), error => error.code === 'permission-denied');
        assert.equal((await getDocFromServer(resultRef)).exists(), false);
        assert.equal((await stored(a)).revision, before.revision);
        const applied = await run(a, envelope);
        assert.equal(applied.status, 'applied'); assert.equal(applied.duplicate, false);
        assert.equal(applied.revision, input.expectedRevision + 1);
        const after = await stored(a);
        assert.equal(after.revision, before.revision + 1); assert.equal(after.password, envelope.record.password);
        const retried = await run(a, envelope);
        assert.equal(retried.duplicate, true); assert.equal(retried.revision, after.revision);
    });

    await t.test('the owner can read but cannot overwrite, update or delete a backend result', async () => {
        const resultRef = doc(a.db, 'mutationResults', a.uid, 'operations', 'blocked-forged-result');
        const before = (await getDocFromServer(resultRef)).data();
        assert.equal(before.ownerUid, a.uid);
        await assert.rejects(setDoc(resultRef, {...before, revision: 999}), error => error.code === 'permission-denied');
        await assert.rejects(updateDoc(resultRef, {status: 'conflict'}), error => error.code === 'permission-denied');
        await assert.rejects(deleteDoc(resultRef), error => error.code === 'permission-denied');
        const after = (await getDocFromServer(resultRef)).data();
        assert.equal(after.revision, before.revision); assert.equal(after.status, before.status);
        await assert.rejects(setDoc(doc(b.db, 'mutationResults', a.uid, 'operations', 'blocked-forged-result'), {status: 'applied'}),
            error => error.code === 'permission-denied');
    });

    await t.test('private and generic offline mutations cannot reuse each other operation identities', async () => {
        const offline = {schemaVersion: 1, operationId: operation.operationId, recordId: 'sync-fixture',
            deviceId: operation.deviceId, expectedRevision: 0, encryptedPayload: operation.record.password};
        const runOffline = data => applyOfflineMutation.run({auth: {uid: a.uid}, data});
        await assert.rejects(runOffline(offline), error => error.code === 'already-exists');
        const ownOffline = {...offline, operationId: 'offline-bound-operation'};
        const applied = await runOffline(ownOffline);
        assert.equal(applied.status, 'applied'); assert.equal(applied.revision, 1);
        assert.equal((await runOffline(ownOffline)).duplicate, true);
        await assert.rejects(runOffline({...ownOffline, encryptedPayload: await a.context.encrypt('DIFFERENT-OFFLINE-SYNTHETIC')}),
            error => error.code === 'already-exists');
        await assert.rejects(run(a, {...operation, operationId: ownOffline.operationId}), error => error.code === 'already-exists');
        const saved = await getAdminFirestore().doc(`users/${a.uid}/syncRecords/${offline.recordId}`).get();
        assert.equal(saved.data().revision, 1); assert.equal(saved.data().encryptedPayload, ownOffline.encryptedPayload);
    });

    await t.test('a legacy result without a new server-bound receipt requires explicit reconciliation instead of claiming success', async () => {
        const input = await inputFor(a, 'legacy-unverified-result', 'MUST-REMAIN-UNAPPLIED');
        const envelope = await preparePrivateAccountMutation({...input, context: a.context});
        const before = await stored(a);
        await assert.rejects(setDoc(doc(a.db, 'users', a.uid, 'operationResults', input.operationId), {status: 'applied'}),
            error => error.code === 'permission-denied');
        await getAdminFirestore().doc(`users/${a.uid}/operationResults/${input.operationId}`).set({
            domain: 'private-account', operationId: input.operationId, recordId: input.recordId, ownerUid: a.uid,
            deviceId: input.deviceId, status: 'applied', revision: input.expectedRevision + 1, duplicate: false
        });
        await assert.rejects(run(a, envelope), error => error.code === 'failed-precondition');
        const after = await stored(a);
        assert.equal(after.revision, before.revision); assert.equal(after.password, before.password);
        assert.equal(await readResult(a, input.operationId), null);
        const old = await getAdminFirestore().doc(`users/${a.uid}/operationResults/${input.operationId}`).get();
        assert.equal(old.exists, true, 'legacy evidence is preserved, not migrated or deleted');
    });

    await t.test('a valid server-bound receipt remains authoritative when a conflicting legacy receipt exists', async () => {
        const before = await stored(a);
        await getAdminFirestore().doc(`users/${a.uid}/operationResults/${operation.operationId}`).set({
            domain: 'private-account', recordId: 'wrong-record', ownerUid: b.uid, status: 'applied', revision: 999
        });
        const result = await run(a, operation);
        assert.equal(result.status, 'applied'); assert.equal(result.duplicate, true); assert.equal(result.revision, 2);
        const after = await stored(a);
        assert.equal(after.revision, before.revision); assert.equal(after.password, before.password);
        assert.equal(after.updatedAt.isEqual(before.updatedAt), true);
    });

    await t.test('a malformed server-bound receipt never falls back to plausible legacy success', async () => {
        const input = await inputFor(a, 'malformed-trusted-result', 'MUST-REMAIN-UNAPPLIED');
        const envelope = await preparePrivateAccountMutation({...input, context: a.context});
        const before = await stored(a);
        const malformed = {domain: 'private-account', recordId: input.recordId, ownerUid: a.uid,
            deviceId: input.deviceId, operationId: input.operationId, status: 'applied', revision: input.expectedRevision + 1};
        await getAdminFirestore().doc(`mutationResults/${a.uid}/operations/${input.operationId}`).set(malformed);
        await getAdminFirestore().doc(`users/${a.uid}/operationResults/${input.operationId}`).set(malformed);
        await assert.rejects(run(a, envelope), error => error.code === 'failed-precondition');
        const after = await stored(a);
        assert.equal(after.revision, before.revision); assert.equal(after.password, before.password);
    });

    await t.test('authoritative current scope rejects a reduced private payload without changing any document or creating receipts', async () => {
        const scopes = {
            shared: {sharedWithUids: [b.uid], sharedWith: {[b.uid]: {role: 'viewer'}}},
            banking: {isBanking: true, banking: [{iban: 'SYNTHETIC-BANK-REFERENCE'}]},
            profile: {linkedProfileFields: [{id: 'synthetic-phone', type: 'phone'}]},
            archive: {isArchived: true, archivedAt: '2026-09-12T00:00:00.000Z'}
        };
        for (const [scope, fields] of Object.entries(scopes)) {
            const recordId = `scope-${scope}`, operationId = `scope-reject-${scope}`;
            const reference = getAdminFirestore().doc(`users/${a.uid}/accounts/${recordId}`);
            await reference.set({...operation.record, ownerId: a.uid, revision: 1, ...fields});
            const before = await reference.get();
            // The incoming payload deliberately omits the server's scope markers.
            const request = {...operation, recordId, operationId, expectedRevision: 1};
            await assert.rejects(run(a, request), error => error.code === 'failed-precondition' &&
                error.details?.reason === 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED');
            const after = await reference.get();
            assert.deepEqual(after.data(), before.data());
            assert.equal(after.updateTime.isEqual(before.updateTime), true);
            assert.equal((await getAdminFirestore().doc(`mutationResults/${a.uid}/operations/${operationId}`).get()).exists, false);
            assert.equal((await getAdminFirestore().doc(`users/${a.uid}/operationResults/${operationId}`).get()).exists, false);
        }
    });

    await t.test('an isolated current record applies once and its trusted retry survives a later scope change', async () => {
        const recordId = 'scope-isolated', operationId = 'scope-isolated-apply';
        const reference = getAdminFirestore().doc(`users/${a.uid}/accounts/${recordId}`);
        await reference.set({...operation.record, ownerId: a.uid, revision: 1});
        const request = {...operation, recordId, operationId, expectedRevision: 1};
        const applied = await run(a, request);
        assert.equal(applied.status, 'applied'); assert.equal(applied.revision, 2); assert.equal(applied.duplicate, false);
        assert.equal((await reference.get()).data().password, request.record.password);
        const receiptRef = getAdminFirestore().doc(`mutationResults/${a.uid}/operations/${operationId}`);
        const receiptBefore = await receiptRef.get();
        assert.equal(receiptBefore.data().recordId, recordId);
        // A subsequent server-authorized operation changes scope and revision.
        await reference.update({sharedWithUids: [b.uid], isArchived: true, revision: 3});
        const before = await reference.get();
        const retried = await run(a, request);
        assert.equal(retried.status, 'applied'); assert.equal(retried.revision, 2); assert.equal(retried.duplicate, true);
        const after = await reference.get(), receiptAfter = await receiptRef.get();
        assert.deepEqual(after.data(), before.data());
        assert.equal(after.updateTime.isEqual(before.updateTime), true);
        assert.deepEqual(receiptAfter.data(), receiptBefore.data());
        assert.equal(receiptAfter.updateTime.isEqual(receiptBefore.updateTime), true);
        await assert.rejects(run(a, {...request, operationId: 'scope-new-write', expectedRevision: 3}),
            error => error.code === 'failed-precondition' && error.details?.reason === 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED');
        assert.equal((await getAdminFirestore().doc(`mutationResults/${a.uid}/operations/scope-new-write`).get()).exists, false);
    });

    await t.test('malformed existing revisions are rejected without record changes or receipts in both mutation domains', async () => {
        for (const [index, revision] of [null, '0', -1, 0.5, Number.MAX_SAFE_INTEGER + 1].entries()) {
            for (const domain of ['private', 'offline']) {
                const recordId = `invalid-${domain}-${index}`, operationId = `invalid-revision-${domain}-${index}`;
                const path = `users/${a.uid}/${domain === 'private' ? 'accounts' : 'syncRecords'}/${recordId}`;
                const reference = getAdminFirestore().doc(path);
                const original = domain === 'private' ? {...operation.record, revision} : {revision, encryptedPayload: operation.record.password};
                await reference.set(original);
                const request = domain === 'private' ? {...operation, recordId, operationId, expectedRevision: 0} : {
                    schemaVersion: 1, operationId, recordId, deviceId: operation.deviceId, expectedRevision: 0,
                    encryptedPayload: operation.record.password
                };
                const handler = domain === 'private' ? applyPrivateAccountMutation : applyOfflineMutation;
                await assert.rejects(handler.run({auth: {uid: a.uid}, data: request}), error => error.code === 'failed-precondition');
                const after = (await reference.get()).data();
                assert.equal(after.revision, revision);
                assert.equal(after[domain === 'private' ? 'password' : 'encryptedPayload'], operation.record.password);
                assert.equal((await getAdminFirestore().doc(`mutationResults/${a.uid}/operations/${operationId}`).get()).exists, false);
            }
        }
    });
});
