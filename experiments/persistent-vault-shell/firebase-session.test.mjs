import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, terminate} from 'firebase/firestore';
import {createFirebaseSession} from './firebase-session.mjs';

assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099', 'Auth emulator is required');
assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085', 'Firestore emulator is required');
const projectId = 'demo-vault-shell';
const source = await readFile(new URL('../../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url), 'utf8');
const cryptoApi = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const marker = 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1';
const loginPassword = 'LOGIN-SOLO-EMULATORE!123';
const masterA = 'MASTER-FITTIZIA-A!123', masterB = 'MASTER-FITTIZIA-B!123';

test('Firebase SDK Auth/Firestore and protected Vault work together in local emulators', async t => {
    const clients = [];
    let session;
    t.after(async () => {
        session?.dispose();
        for (const client of clients) { await terminate(client.db); await deleteApp(client.app); }
    });
    function client(name) {
        const app = initializeApp({projectId, apiKey: 'demo-key'}, name + crypto.randomUUID());
        const auth = initializeAuth(app, {persistence: inMemoryPersistence});
        connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
        const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
        const value = {app, auth, db}; clients.push(value); return value;
    }
    async function seed(client, master, suffix) {
        const email = `${suffix}-${crypto.randomUUID()}@example.invalid`;
        const {user} = await createUserWithEmailAndPassword(client.auth, email, loginPassword);
        const key = cryptoApi.generateVaultKey();
        const verifier = await cryptoApi.createVaultVerifier(marker, master);
        const vaultKeyEnvelope = await cryptoApi.wrapVaultKey(key, master);
        await setDoc(doc(client.db, 'users', user.uid, 'settings', 'security'), {verifier, vaultKeyEnvelope});
        const ciphertext = await cryptoApi.encrypt(`SECRET-FITTIZIO-${suffix}`, key);
        await setDoc(doc(client.db, 'users', user.uid, 'accounts', 'private'), {ownerId: user.uid, _encrypted: true, password: ciphertext});
        await setDoc(doc(client.db, 'users', user.uid, 'aziende', 'company', 'accounts', 'company-record'), {ownerId: user.uid, _encrypted: true, username: ciphertext});
        return {uid: user.uid, email, ciphertext};
    }
    const a = client('a'), b = client('b');
    const ownerA = await seed(a, masterA, 'A');
    const ownerB = await seed(b, masterB, 'B');
    let password = masterA, context;
    session = createFirebaseSession({auth: a.auth, db: a.db, cryptoApi,
        requestPassword: async () => password,
        routes: {overview: value => { context = value; }, private: value => { context = value; }}
    });

    await t.test('login alone does not unlock; Master Password opens the original private ciphertext', async () => {
        await session.navigate('private');
        assert.equal(context.unlocked, false);
        await assert.rejects(context.readAccount({id: 'private', field: 'password'}), /VAULT_LOCKED/);
        await session.unlock(); await session.navigate('private');
        assert.equal(await context.readAccount({id: 'private', field: 'password'}), 'SECRET-FITTIZIO-A');
        const stored = (await getDocFromServer(doc(a.db, 'users', ownerA.uid, 'accounts', 'private'))).data();
        assert.equal(stored.password, ownerA.ciphertext);
        assert.notEqual(stored.password, 'SECRET-FITTIZIO-A');
    });
    await t.test('company records use the same unlocked context and owner-bound reader', async () => {
        assert.equal(await context.readAccount({id: 'company-record', companyId: 'company', field: 'username'}), 'SECRET-FITTIZIO-A');
    });
    await t.test('paths and fields outside the account reader are rejected', async () => {
        await assert.rejects(context.readAccount({id: '../other', field: 'password'}), /INVALID_RECORD_ID/);
        await assert.rejects(context.readAccount({id: 'private', field: 'vaultKeyEnvelope'}), /FIELD_NOT_ALLOWED/);
        await assert.rejects(context.readAccount({id: 'missing', field: 'password'}), /RECORD_NOT_FOUND/);
    });
    await t.test('current Rules reject another authenticated owner on the server', async () => {
        await assert.rejects(getDocFromServer(doc(b.db, 'users', ownerA.uid, 'accounts', 'private')), error => error.code === 'permission-denied');
    });
    await t.test('wrong Master Password never unlocks an authenticated Firebase user', async () => {
        session.lock(); password = 'WRONG-FIXTURE';
        await assert.rejects(session.unlock(), /INVALID_MASTER_PASSWORD/);
        assert.equal(session.check(), false);
        password = masterA; await session.unlock(); await session.navigate('private');
    });
    await t.test('plaintext and conflicting owner metadata are rejected instead of silently repaired', async () => {
        await setDoc(doc(a.db, 'users', ownerA.uid, 'accounts', 'plain'), {password: 'ONLY-FIXTURE-PLAINTEXT'});
        await assert.rejects(context.readAccount({id: 'plain', field: 'password'}), /CIPHERTEXT_REQUIRED/);
        await setDoc(doc(a.db, 'users', ownerA.uid, 'accounts', 'conflicting'), {ownerId: ownerB.uid, password: ownerA.ciphertext});
        await assert.rejects(context.readAccount({id: 'conflicting', field: 'password'}), /OWNER_MISMATCH/);
    });
    await t.test('Firebase sign-out aborts the view and denies both new unlock and anonymous server read', async () => {
        const old = context; await session.logout();
        assert.equal(a.auth.currentUser, null);
        assert.equal(old.signal.aborted, true);
        await assert.rejects(old.readAccount({id: 'private', field: 'password'}), /VIEW_DISPOSED/);
        await assert.rejects(session.unlock(), /AUTH_REQUIRED/);
        await assert.rejects(getDocFromServer(doc(a.db, 'users', ownerA.uid, 'accounts', 'private')), error => error.code === 'permission-denied');
    });
    await t.test('signing into the second user requires its own Master Password and returns only its data', async () => {
        await signInWithEmailAndPassword(a.auth, ownerB.email, loginPassword);
        password = masterA; await assert.rejects(session.unlock(), /INVALID_MASTER_PASSWORD/);
        password = masterB; await session.unlock(); await session.navigate('private');
        assert.equal(context.user.uid, ownerB.uid);
        assert.equal(await context.readAccount({id: 'private', field: 'password'}), 'SECRET-FITTIZIO-B');
    });
    await t.test('dispose closes the active route and prohibits future reads and unlocks', async () => {
        const old = context; session.dispose();
        assert.equal(old.signal.aborted, true);
        await assert.rejects(old.readAccount({id: 'private', field: 'password'}), /VIEW_DISPOSED/);
        await assert.rejects(session.unlock(), /SESSION_DISPOSED/);
    });
    await t.test('an unconfigured Vault is not automatically provisioned or migrated', async () => {
        const c = client('unconfigured');
        const {user} = await createUserWithEmailAndPassword(c.auth, `${crypto.randomUUID()}@example.invalid`, loginPassword);
        const fresh = createFirebaseSession({auth: c.auth, db: c.db, cryptoApi,
            requestPassword: async () => { assert.fail('No password prompt for a missing envelope'); }, routes: {overview() {}}});
        try {
            await assert.rejects(fresh.unlock(), /MIGRATION_REQUIRED/);
            assert.equal((await getDocFromServer(doc(c.db, 'users', user.uid, 'settings', 'security'))).exists(), false);
        } finally { fresh.dispose(); }
    });
});
