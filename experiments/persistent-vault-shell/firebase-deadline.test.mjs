import test from 'node:test';
import assert from 'node:assert/strict';

import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword, deleteUser} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, deleteDoc, runTransaction, getDocFromServer, terminate} from 'firebase/firestore';

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');

// Admin is initialized only after the localhost/demo guards. The operation under
// test is extracted unchanged from the canonical UI module; only browser setup
// is omitted. Transaction retries and commits belong to the real Web SDK.
const requireFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp: initializeAdminApp, deleteApp: deleteAdminApp} = requireFunctions('firebase-admin/app');
const {getFirestore: getAdminFirestore} = requireFunctions('firebase-admin/firestore');
const source = await readFile(new URL('../../Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js', import.meta.url), 'utf8');
const marker = 'async function deleteScadenza(userId, scadenzaId, sourceRef, active) {';
const start = source.indexOf(marker);
assert.ok(start >= 0, 'Canonical deadline deletion function is missing');
assert.equal(source.indexOf(marker, start + marker.length), -1, 'Canonical deletion function must be unique');
const end = source.indexOf('\nfunction clearDeadline(', start);
assert.ok(end > start, 'Canonical deletion function boundary has changed');
const deletionSource = source.slice(start, end);
assert.match(deletionSource, /await runTransaction\(db, async transaction =>/);
assert.doesNotMatch(deletionSource, /getUserProfile|writeBatch/);
const createDeletion = new Function('db', 'doc', 'deleteDoc', 'runTransaction', deletionSource + '; return deleteScadenza;');

test('canonical deadline deletion uses real SDK optimistic retries in the demo emulator', {timeout: 120000}, async t => {
    const clients = [];
    const adminApp = initializeAdminApp({projectId: 'demo-vault-shell'}, `deadline-cas-${crypto.randomUUID()}`);
    const admin = getAdminFirestore(adminApp);
    t.after(async () => {
        const cleanup = await Promise.allSettled(clients.map(async client => {
            try {
                if (client.uid) await admin.recursiveDelete(admin.doc(`users/${client.uid}`));
                if (client.auth.currentUser) await deleteUser(client.auth.currentUser);
            } finally { await terminate(client.db); await deleteApp(client.app); }
        }));
        await admin.terminate(); await deleteAdminApp(adminApp);
        const failed = cleanup.find(result => result.status === 'rejected');
        if (failed) throw failed.reason;
    });
    async function createClient(label) {
        const id = crypto.randomUUID();
        const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'}, `deadline-${label}-${id}`);
        const auth = initializeAuth(app, {persistence: inMemoryPersistence});
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
        const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
        const client = {app, auth, db}; clients.push(client);
        const {user} = await createUserWithEmailAndPassword(auth, `deadline-${label}-${id}@example.invalid`, 'LOGIN-SYNTHETIC!123');
        client.uid = user.uid;
        return client;
    }
    function deletionFor(client, {beforeAttempt = async () => {}, afterGet = async () => {}} = {}) {
        const stats = {attempts: 0, reads: 0};
        const deleteCanonical = createDeletion(client.db, doc, deleteDoc,
            (db, callback) => runTransaction(db, async transaction => {
                const attempt = ++stats.attempts;
                await beforeAttempt(attempt);
                return callback({
                    get: async reference => {
                        const snapshot = await transaction.get(reference);
                        stats.reads++;
                        await afterGet(snapshot, attempt);
                        return snapshot;
                    },
                    delete: reference => transaction.delete(reference),
                    update: (reference, data) => transaction.update(reference, data)
                });
            })
        );
        return {stats, run: (active = () => true) => deleteCanonical(client.uid, 'deadline', {type: 'profileDocument', id: 'document'}, active)};
    }

    await t.test('a real conflict retries and preserves concurrent profile edits with atomic unlink and deletion', async () => {
        const client = await createClient('concurrent');
        const profile = admin.doc(`users/${client.uid}`), deadline = profile.collection('scadenze').doc('deadline');
        await profile.set({displayName: 'Synthetic owner', documenti: [{id: 'document', note: 'Original synthetic note', expiryReference: {deadlineId: 'deadline'}}]});
        await deadline.set({title: 'Synthetic deadline', sourceRef: {type: 'profileDocument', id: 'document'}});
        let observedRetryBeforeCommit = false;
        const operation = deletionFor(client, {
            afterGet: async (_snapshot, attempt) => {
                if (attempt !== 1) return;
                await profile.update({documenti: [
                    {id: 'document', note: 'Concurrent synthetic note', expiryReference: {deadlineId: 'deadline'}},
                    {id: 'concurrent-document', note: 'New synthetic document', expiryReference: {deadlineId: 'other-deadline'}}
                ]});
            },
            beforeAttempt: async attempt => {
                if (attempt < 2) return;
                const [currentProfile, currentDeadline] = await Promise.all([profile.get(), deadline.get()]);
                assert.equal(currentDeadline.exists, true);
                assert.equal(currentProfile.data().documenti[0].expiryReference.deadlineId, 'deadline');
                observedRetryBeforeCommit = true;
            }
        });
        await operation.run();
        assert.ok(operation.stats.attempts >= 2, 'The real SDK must retry after the Admin edit');
        assert.equal(observedRetryBeforeCommit, true);
        const [currentProfile, currentDeadline] = await Promise.all([
            getDocFromServer(doc(client.db, 'users', client.uid)),
            getDocFromServer(doc(client.db, 'users', client.uid, 'scadenze', 'deadline'))
        ]);
        assert.equal(currentDeadline.exists(), false);
        assert.equal(currentProfile.data().displayName, 'Synthetic owner');
        assert.equal(currentProfile.data().documenti[0].note, 'Concurrent synthetic note');
        assert.equal(currentProfile.data().documenti[0].expiryReference, null);
        assert.equal(currentProfile.data().documenti[1].id, 'concurrent-document');
        assert.equal(currentProfile.data().documenti[1].expiryReference.deadlineId, 'other-deadline');
    });

    await t.test('newer link is untouched and an absent profile is not created', async () => {
        for (const scenario of ['newer-link', 'missing-profile']) {
            const client = await createClient(scenario);
            const profile = admin.doc(`users/${client.uid}`), deadline = profile.collection('scadenze').doc('deadline');
            if (scenario === 'newer-link') await profile.set({documenti: [{id: 'document', note: 'Synthetic unchanged note', expiryReference: {deadlineId: 'newer-deadline'}}]});
            await deadline.set({title: 'Synthetic deadline', sourceRef: {type: 'profileDocument', id: 'document'}});
            const before = await profile.get();
            await deletionFor(client).run();
            const after = await profile.get();
            assert.equal((await deadline.get()).exists, false);
            assert.equal(after.exists, before.exists);
            assert.deepEqual(after.data(), before.data());
            if (before.exists) assert.equal(after.updateTime.isEqual(before.updateTime), true);
        }
    });

    await t.test('lock between real SDK attempts prevents all deletion and unlink commits', async () => {
        const client = await createClient('locked');
        const profile = admin.doc(`users/${client.uid}`), deadline = profile.collection('scadenze').doc('deadline');
        await profile.set({documenti: [{id: 'document', note: 'Original synthetic note', expiryReference: {deadlineId: 'deadline'}}]});
        await deadline.set({title: 'Synthetic preserved deadline', sourceRef: {type: 'profileDocument', id: 'document'}});
        const beforeDeadline = await deadline.get();
        let active = true, concurrentSnapshot;
        const operation = deletionFor(client, {
            afterGet: async (_snapshot, attempt) => {
                if (attempt !== 1) return;
                await profile.update({documenti: [{id: 'document', note: 'Concurrent synthetic note', expiryReference: {deadlineId: 'deadline'}}]});
                concurrentSnapshot = await profile.get();
            },
            beforeAttempt: async attempt => { if (attempt > 1) active = false; }
        });
        await operation.run(() => active);
        assert.ok(operation.stats.attempts >= 2);
        assert.equal(operation.stats.reads, 1);
        const [afterProfile, afterDeadline] = await Promise.all([profile.get(), deadline.get()]);
        assert.deepEqual(afterProfile.data(), concurrentSnapshot.data());
        assert.equal(afterProfile.updateTime.isEqual(concurrentSnapshot.updateTime), true);
        assert.deepEqual(afterDeadline.data(), beforeDeadline.data());
        assert.equal(afterDeadline.updateTime.isEqual(beforeDeadline.updateTime), true);
    });
});
