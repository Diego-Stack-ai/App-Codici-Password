import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword, deleteUser} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, terminate} from 'firebase/firestore';

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');

// Load Admin and the original callable only after the localhost/demo guards.
// .run exercises the real Firestore transaction, not HTTP, App Check or triggers.
const requireFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const {restoreBackupChunk} = requireFunctions('./index.js');
const {getApps, deleteApp: deleteAdminApp} = requireFunctions('firebase-admin/app');
const {getFirestore: getAdminFirestore, Timestamp} = requireFunctions('firebase-admin/firestore');

test('original backup callable enforces preview CAS and protected retries in the demo emulator', async t => {
    const clients = [], admin = getAdminFirestore();
    t.after(async () => {
        const cleanup = await Promise.allSettled(clients.map(async client => {
            try {
                if (client.uid) {
                    await admin.recursiveDelete(admin.doc(`users/${client.uid}`));
                    await admin.recursiveDelete(admin.doc(`mutationResults/${client.uid}`));
                }
                if (client.auth.currentUser) await deleteUser(client.auth.currentUser);
            } finally { await terminate(client.db); await deleteApp(client.app); }
        }));
        for (const app of getApps()) { await getAdminFirestore(app).terminate(); await deleteAdminApp(app); }
        const failed = cleanup.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
    });
    async function createClient(label) {
        const id = crypto.randomUUID();
        const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'}, `backup-${label}-${id}`);
        const auth = initializeAuth(app, {persistence: inMemoryPersistence});
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
        const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
        const client = {app, auth, db}; clients.push(client);
        const {user} = await createUserWithEmailAndPassword(auth, `backup-${label}-${id}@example.invalid`, 'LOGIN-SYNTHETIC!123');
        client.uid = user.uid;
        return client;
    }
    const a = await createClient('A'), b = await createClient('B');
    const profileRef = admin.doc(`users/${a.uid}`);
    const accountRef = id => profileRef.collection('accounts').doc(id);
    const receiptRef = operationId => admin.doc(`mutationResults/${a.uid}/operations/${operationId}`);
    const auditRef = operationId => profileRef.collection('auditEvents').doc(operationId);
    const run = (data, client = a) => restoreBackupChunk.run({auth: {uid: client.uid}, data});
    const command = (operationId, records) => ({expectedOwnerUid: a.uid, operationId,
        backupId: 'synthetic-backup', chunkIndex: 0, chunkCount: 1, mode: 'preview', records});
    const recordsFor = id => [
        {scope: 'profile', id: a.uid, data: {displayName: 'Restored synthetic profile'}},
        {scope: 'private-account', id, data: {nomeAccount: 'Restored synthetic account', password: 'SYNTHETIC-CIPHERTEXT'}}
    ];
    const applyFor = (input, preview, overwrite = true) => ({...input, mode: 'apply', overwriteExisting: overwrite,
        confirmation: overwrite ? 'RESTORE_SELECTED_OVERWRITE' : 'RESTORE_VALIDATED',
        records: input.records.map((record, index) => ({...record, expectedVersion: preview.entries[index].expectedVersion}))});
    const assertUnchanged = (before, after) => {
        assert.equal(after.exists, before.exists);
        assert.deepEqual(after.data(), before.data());
        if (before.exists) assert.equal(after.updateTime.isEqual(before.updateTime), true);
    };

    await t.test('profile collision needs overwrite consent and preview versions match real snapshots', async () => {
        await profileRef.set({displayName: 'Original synthetic profile', preserved: 'synthetic existing field'});
        const input = command('profile-account-apply', recordsFor('created'));
        const original = await profileRef.get(), preview = await run(input);
        assert.equal(preview.status, 'collision'); assert.equal(preview.collisionCount, 1);
        assert.deepEqual(preview.entries.map(entry => entry.status), ['changed', 'missing']);
        assert.deepEqual(preview.entries[0].expectedVersion, {exists: true, updateTime: {
            seconds: original.updateTime.seconds, nanoseconds: original.updateTime.nanoseconds
        }});
        assert.deepEqual(preview.entries[1].expectedVersion, {exists: false});
        assert.equal(JSON.stringify(preview).includes('Original synthetic profile'), false);
        assert.equal((await receiptRef(input.operationId).get()).exists, false);
        assert.equal((await run(applyFor(input, preview, false))).status, 'collision');
        assertUnchanged(original, await profileRef.get());
        assert.equal((await accountRef('created').get()).exists, false);
        assert.equal((await auditRef(input.operationId).get()).exists, false);
        const result = await run(applyFor(input, preview));
        assert.deepEqual(result, {status: 'applied', duplicate: false, recordCount: 2});
        assert.equal((await profileRef.get()).data().displayName, 'Restored synthetic profile');
        assert.equal((await profileRef.get()).data().preserved, 'synthetic existing field');
        assert.equal((await accountRef('created').get()).data().password, 'SYNTHETIC-CIPHERTEXT');
        const receipt = (await getDocFromServer(doc(a.db, 'mutationResults', a.uid, 'operations', input.operationId))).data();
        assert.equal(receipt.domain, 'backup-restore'); assert.equal(receipt.ownerUid, a.uid);
        assert.match(receipt.operationHash, /^[a-f0-9]{64}$/);
        assert.equal(JSON.stringify(receipt).includes('SYNTHETIC-CIPHERTEXT'), false);
        assert.equal((await profileRef.collection('backupRestoreOperations').doc(input.operationId).get()).exists, false);
    });

    await t.test('profile modification and account creation/deletion after preview block the whole chunk with no receipt', async () => {
        for (const scenario of ['profile-change', 'account-created', 'account-deleted']) {
            const id = `stale-${scenario}`, target = accountRef(id);
            await profileRef.set({displayName: `Original ${scenario}`});
            if (scenario === 'account-deleted') await target.set({nomeAccount: 'Original synthetic account'});
            const input = command(`operation-${scenario}`, recordsFor(id));
            const preview = await run(input), apply = applyFor(input, preview);
            if (scenario === 'profile-change') await profileRef.update({displayName: 'Concurrent synthetic edit'});
            if (scenario === 'account-created') await target.set({nomeAccount: 'Concurrent synthetic creation'});
            if (scenario === 'account-deleted') await target.delete();
            const before = await Promise.all([profileRef.get(), target.get()]);
            const result = await run(apply);
            assert.equal(result.status, 'stale-preview'); assert.equal(result.staleCount, 1);
            assert.deepEqual(result.staleIndexes, [scenario === 'profile-change' ? 0 : 1]);
            const after = await Promise.all([profileRef.get(), target.get()]);
            before.forEach((snapshot, index) => assertUnchanged(snapshot, after[index]));
            assert.equal((await receiptRef(input.operationId).get()).exists, false);
            assert.equal((await auditRef(input.operationId).get()).exists, false);
        }
    });

    await t.test('trusted retry precedes CAS and leaves later data, receipt and audit versions untouched', async () => {
        const input = command('trusted-retry', recordsFor('retry'));
        const apply = applyFor(input, await run(input));
        assert.equal((await run(apply)).status, 'applied');
        await profileRef.update({displayName: 'Newer profile must survive'});
        await accountRef('retry').update({password: 'NEWER-SYNTHETIC-CIPHERTEXT'});
        const refs = [profileRef, accountRef('retry'), receiptRef(input.operationId), auditRef(input.operationId)];
        const before = await Promise.all(refs.map(ref => ref.get()));
        assert.deepEqual(await run(apply), {status: 'applied', duplicate: true, recordCount: 2});
        const after = await Promise.all(refs.map(ref => ref.get()));
        before.forEach((snapshot, index) => assertUnchanged(snapshot, after[index]));
        const changed = {...apply, records: apply.records.map((record, index) => index ? {...record, data: {...record.data, password: 'DIFFERENT-SYNTHETIC'}} : record)};
        await assert.rejects(run(changed), error => error.details?.reason === 'BACKUP_RESULT_UNVERIFIED');
        assertUnchanged(before[1], await accountRef('retry').get());
    });

    await t.test('owner mismatch and absent Auth cannot create records or results under either UID', async () => {
        const input = command('owner-mismatch', [{scope: 'private-account', id: 'owner-mismatch', data: {nomeAccount: 'Synthetic'}}]);
        for (const mode of ['preview', 'apply']) {
            const data = {...input, mode, confirmation: 'RESTORE_VALIDATED', records: input.records.map(record => ({...record, expectedVersion: {exists: false}}))};
            await assert.rejects(run(data, b), error => error.code === 'failed-precondition' && error.details?.reason === 'BACKUP_OWNER_MISMATCH');
            await assert.rejects(restoreBackupChunk.run({data}), error => error.code === 'unauthenticated');
        }
        for (const uid of [a.uid, b.uid]) for (const path of [
            `users/${uid}/accounts/owner-mismatch`, `mutationResults/${uid}/operations/owner-mismatch`,
            `users/${uid}/backupRestoreOperations/owner-mismatch`, `users/${uid}/auditEvents/owner-mismatch`
        ]) assert.equal((await admin.doc(path).get()).exists, false);
    });

    await t.test('real Buffer and Timestamp serialize for preview and restore through Admin factories', async () => {
        const target = accountRef('typed-values');
        const initial = {nomeAccount: 'Synthetic typed values', bytes: Buffer.from([0, 1, 254, 255]), at: new Timestamp(1700000000, 123456000)};
        await target.set(initial);
        const encoded = {nomeAccount: initial.nomeAccount, bytes: {$type: 'bytes', value: [0, 1, 254, 255]},
            at: {$type: 'timestamp', seconds: 1700000000, nanoseconds: 123456000}};
        const input = command('typed-values', [{scope: 'private-account', id: 'typed-values', data: encoded}]);
        assert.equal((await run(input)).entries[0].status, 'unchanged');
        input.records[0].data = {...encoded, bytes: {$type: 'bytes', value: [5, 4, 3]},
            at: {$type: 'timestamp', seconds: 1700000001, nanoseconds: 987654000}};
        const preview = await run(input); assert.equal(preview.entries[0].status, 'changed');
        assert.equal((await run(applyFor(input, preview))).status, 'applied');
        const restored = (await target.get()).data();
        assert.equal(Buffer.isBuffer(restored.bytes), true); assert.deepEqual([...restored.bytes], [5, 4, 3]);
        assert.equal(restored.at instanceof Timestamp, true);
        assert.equal(restored.at.seconds, 1700000001); assert.equal(restored.at.nanoseconds, 987654000);
        assert.equal((await run({...input, operationId: 'typed-repreview'})).entries[0].status, 'unchanged');
    });

    await t.test('client Rules cannot forge protected backup receipts or read another owner receipt', async () => {
        await assert.rejects(setDoc(doc(a.db, 'mutationResults', a.uid, 'operations', 'forged'), {
            status: 'applied', ownerUid: a.uid, bindingVersion: 1, operationHash: '0'.repeat(64)
        }), error => error.code === 'permission-denied');
        await assert.rejects(getDocFromServer(doc(b.db, 'mutationResults', a.uid, 'operations', 'trusted-retry')),
            error => error.code === 'permission-denied');
        assert.equal((await receiptRef('forged').get()).exists, false);
    });
});
