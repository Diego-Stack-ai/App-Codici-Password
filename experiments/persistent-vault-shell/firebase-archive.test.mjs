import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword, deleteUser, onAuthStateChanged} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, runTransaction, deleteField, terminate} from 'firebase/firestore';

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const requireFunctions = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp: initializeAdminApp, deleteApp: deleteAdminApp} = requireFunctions('firebase-admin/app');
const {getFirestore: getAdminFirestore} = requireFunctions('firebase-admin/firestore');
const source = (await readFile(new URL('../../Frontend/public/assets/js/modules/settings/archive-account-service.js', import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const createRestore = new Function('auth', 'db', 'doc', 'runTransaction', 'deleteField', 'onAuthStateChanged', `${source}\nreturn restoreArchivedAccount;`);

test('canonical archive restore compares current state in real SDK transactions', {timeout: 120000}, async t => {
    const adminApp = initializeAdminApp({projectId: 'demo-vault-shell'}, `archive-${crypto.randomUUID()}`);
    const admin = getAdminFirestore(adminApp);
    const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'}, `archive-${crypto.randomUUID()}`);
    const auth = initializeAuth(app, {persistence: inMemoryPersistence});
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
    let uid;
    t.after(async () => {
        try { if (uid) await admin.recursiveDelete(admin.doc(`users/${uid}`)); if (auth.currentUser) await deleteUser(auth.currentUser); }
        finally { await terminate(db); await deleteApp(app); await admin.terminate(); await deleteAdminApp(adminApp); }
    });
    ({user: {uid}} = await createUserWithEmailAndPassword(auth, `archive-${crypto.randomUUID()}@example.invalid`, 'SYNTHETIC-LOGIN!123'));
    const reference = admin.doc(`users/${uid}/accounts/record`);
    const initial = {isArchived: true, revision: 3, archivedAt: 1, password: 'SYNTHETIC-CIPHERTEXT'};
    const identity = {id: 'record', context: 'privato', revision: 3};
    const operation = hook => createRestore(auth, db, doc, (database, callback) => runTransaction(database, async tx => callback({
        get: async ref => { const snapshot = await tx.get(ref); await hook?.(snapshot); return snapshot; },
        update: (ref, value) => tx.update(ref, value)
    })), deleteField, onAuthStateChanged);
    await t.test('successful restore increments revision while preserving unrelated ciphertext', async () => {
        await reference.set(initial); await operation()(uid, identity);
        const after = (await reference.get()).data();
        assert.equal(after.revision, 4); assert.equal(after.isArchived, false); assert.equal(after.password, initial.password);
    });
    await t.test('stale revision and already restored state remain byte and timestamp unchanged', async () => {
        for (const state of [{...initial, revision: 4}, {...initial, isArchived: false}]) {
            await reference.set(state); const before = await reference.get();
            await assert.rejects(operation()(uid, identity));
            const after = await reference.get(); assert.deepEqual(after.data(), before.data()); assert.ok(after.updateTime.isEqual(before.updateTime));
        }
    });
    await t.test('concurrent change after transaction read triggers retry and cannot restore stale snapshot', async () => {
        await reference.set(initial); let changed = false, concurrent;
        await assert.rejects(operation(async () => {
            if (changed) return; changed = true;
            await reference.update({revision: 4}); concurrent = await reference.get();
        })(uid, identity));
        const after = await reference.get(); assert.deepEqual(after.data(), concurrent.data()); assert.ok(after.updateTime.isEqual(concurrent.updateTime));
    });
    await t.test('session loss after read prevents commit', async () => {
        await reference.set(initial); const before = await reference.get(); let active = true;
        await assert.rejects(operation(() => { active = false; })(uid, identity, {isActive: () => active}));
        const after = await reference.get(); assert.deepEqual(after.data(), before.data()); assert.ok(after.updateTime.isEqual(before.updateTime));
    });
});
