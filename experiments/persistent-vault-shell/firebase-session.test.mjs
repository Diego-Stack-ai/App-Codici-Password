import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, setDoc, getDocFromServer, terminate} from 'firebase/firestore';
import {createFirebaseSession} from './test-support/firebase-session.mjs';
import {preparePrivateAccountPatch} from './prepare-private-account-patch.mjs';
import {createSyntheticTestAdmission} from './test-support/synthetic-admission.mjs';

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
        await setDoc(doc(client.db, 'users', user.uid, 'aziende', 'company'), {ownerId: user.uid, name: `Company ${suffix}`});
        await setDoc(doc(client.db, 'users', user.uid, 'aziende', 'company', 'accounts', 'company-record'), {ownerId: user.uid, _encrypted: true, username: ciphertext});
        return {uid: user.uid, email, ciphertext};
    }
    const a = client('a'), b = client('b');
    const ownerA = await seed(a, masterA, 'A');
    const ownerB = await seed(b, masterB, 'B');
    let password = masterA, context, queueScope, queueClosed = 0;
    const browserTarget = new EventTarget(), browserDocument = new EventTarget();
    browserTarget.document = browserDocument;
    const ticks = new Set();
    browserTarget.setInterval = callback => {ticks.add(callback); return callback;};
    browserTarget.clearInterval = callback => ticks.delete(callback);
    const previousStorage = Object.getOwnPropertyDescriptor(globalThis, 'sessionStorage');
    const legacyStorage = new Map(['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry', 'preference'].map(name => [name, 'synthetic-only']));
    Object.defineProperty(globalThis, 'sessionStorage', {configurable: true, value: {removeItem: name => legacyStorage.delete(name)}});
    t.after(() => { if (previousStorage) Object.defineProperty(globalThis, 'sessionStorage', previousStorage); else delete globalThis.sessionStorage; });
    const syntheticAdmission = createSyntheticTestAdmission({getUser: () => a.auth.currentUser});
    const begunIdentities = [];
    const presentation = {...syntheticAdmission.presentation,
        beginIdentity() {begunIdentities.push(a.auth.currentUser?.uid); return syntheticAdmission.presentation.getTicket();}};
    session = createFirebaseSession({...syntheticAdmission, presentation, auth: a.auth, db: a.db, cryptoApi, browserTarget,
        requestPassword: async () => password,
        createQueueClient: async scope => {
            assert.equal(await cryptoApi.decryptRequiredValue(ownerA.ciphertext, scope.vaultKeyMaterial), 'SECRET-FITTIZIO-A');
            queueScope = {uid: scope.uid, signal: scope.signal};
            const client = {close() { queueClosed++; }};
            for (const name of ['enqueue', 'flush', 'pendingForRecord', 'discard', 'replace']) client[name] = async () => ({ok: true});
            return client;
        },
        routes: {overview: value => { context = value; }, private: value => { context = value; }}
    });

    assert.deepEqual([...legacyStorage.keys()], ['preference'], 'Firebase shell startup purges old unlock material');

    await t.test('shared observer begins initial identity once despite SDK initial callback', async () => {
        await new Promise(resolve => setImmediate(resolve));
        assert.deepEqual(begunIdentities, [ownerA.uid]);
    });

    await t.test('login alone does not unlock; Master Password opens the original private ciphertext', async () => {
        await session.navigate('private');
        assert.equal(context.unlocked, false);
        await assert.rejects(context.encrypt('BLOCCATO'), /VAULT_LOCKED/);
        await assert.rejects(context.readAccount({id: 'private', field: 'password'}), /VAULT_LOCKED/);
        await session.unlock(); await session.navigate('private');
        assert.equal(await context.readAccount({id: 'private', field: 'password'}), 'SECRET-FITTIZIO-A');
        const stored = (await getDocFromServer(doc(a.db, 'users', ownerA.uid, 'accounts', 'private'))).data();
        assert.equal(stored.password, ownerA.ciphertext);
        assert.notEqual(stored.password, 'SECRET-FITTIZIO-A');
    });
    await t.test('bootstrap queue factory receives the unwrapped key and route change closes its capability', async () => {
        const queue = await session.openMutationQueue({signal: context.signal, domain: 'private-account'});
        assert.equal(queueScope.uid, ownerA.uid); assert.equal(context.openMutationQueue, undefined);
        assert.equal(queue.vaultKeyMaterial, undefined); assert.deepEqual(await queue.flush(), {ok: true});
        await session.navigate('overview'); assert.equal(queueScope.signal.aborted, true); assert.equal(queueClosed, 1);
        await assert.rejects(queue.flush()); await session.navigate('private');
    });
    await t.test('Firebase bootstrap owns background, freeze and bfcache invalidation without entry-point listeners', async () => {
        assert.equal(ticks.size, 1);
        for (const type of ['visibilitychange', 'freeze', 'pageshow']) {
            const old = context;
            const event = new Event(type);
            if (type === 'pageshow') Object.defineProperty(event, 'persisted', {value: true});
            browserDocument.hidden = true;
            (type === 'pageshow' ? browserTarget : browserDocument).dispatchEvent(event);
            assert.equal(session.check(), false);
            assert.equal(old.signal.aborted, true);
            await assert.rejects(old.readAccount({id: 'private', field: 'password'}), /VIEW_DISPOSED/);
            browserDocument.hidden = false;
            await session.unlock(); await session.navigate('private');
            assert.equal(await context.readAccount({id: 'private', field: 'password'}), 'SECRET-FITTIZIO-A');
        }
    });
    await t.test('binary methods cross Firebase session and original envelope without persisting plaintext or rewriting settings', async () => {
        const reference = doc(a.db, 'users', ownerA.uid, 'settings', 'security');
        const before = (await getDocFromServer(reference)).data();
        const bytes = Uint8Array.of(4, 3, 2, 1), aad = `synthetic:${ownerA.uid}:document:image`;
        const sealed = await context.sealImage({bytes, aad});
        const opened = await context.openImage({...sealed, aad});
        assert.deepEqual(opened, bytes); opened.fill(0);
        await assert.rejects(context.openImage({...sealed, aad: 'foreign'}));
        assert.deepEqual((await getDocFromServer(reference)).data(), before);
        assert.deepEqual([...legacyStorage.keys()], ['preference']);
        const old = context;
        await session.navigate('overview');
        await assert.rejects(old.openImage({...sealed, aad}), /VIEW_DISPOSED/);
        session.lock();
        await assert.rejects(context.sealImage({bytes, aad}), /VIEW_DISPOSED|VAULT_LOCKED/);
        await session.unlock(); await session.navigate('private');
    });
    await t.test('route encryption round-trips through the protected reader without writing the source document', async () => {
        const reference = doc(a.db, 'users', ownerA.uid, 'accounts', 'private');
        const before = (await getDocFromServer(reference)).data();
        const encrypted = await context.encrypt('MODIFICA-SOLO-FIXTURE');
        assert.equal(cryptoApi.isEncryptedValue(encrypted), true);
        assert.equal(await context.read({ownerId: ownerA.uid, ciphertext: encrypted}), 'MODIFICA-SOLO-FIXTURE');
        assert.deepEqual((await getDocFromServer(reference)).data(), before);
        const previous = context;
        await session.navigate('overview');
        await assert.rejects(previous.encrypt('VISTA-PRECEDENTE'), /VIEW_DISPOSED/);
        await session.navigate('private');
    });
    await t.test('private patch preparation encrypts all six fields and leaves Firestore unchanged', async () => {
        const reference = doc(a.db, 'users', ownerA.uid, 'accounts', 'private');
        const before = (await getDocFromServer(reference)).data();
        const sourceRecord = Object.freeze({...before, id: 'private', type: 'account', visibility: 'private'});
        const changes = Object.freeze({nomeAccount: 'Titolo fittizio', username: 'utente-fittizio', account: 'codice-fittizio', password: 'password-fittizia', note: 'Nota fittizia\nSeconda riga', url: 'https://example.invalid/fixture'});
        const patch = await preparePrivateAccountPatch({context, source: sourceRecord, changes, hasProfileLink: false});
        assert.deepEqual(Object.keys(patch), Object.keys(changes));
        for (const [field, value] of Object.entries(changes)) {
            assert.equal(cryptoApi.isEncryptedValue(patch[field]), true);
            assert.equal(await context.read({ownerId: ownerA.uid, ciphertext: patch[field]}), value);
        }
        assert.deepEqual(sourceRecord, {...before, id: 'private', type: 'account', visibility: 'private'});
        assert.deepEqual((await getDocFromServer(reference)).data(), before);
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
    await t.test('explicit empty or invalid owner metadata is rejected, while absent metadata remains readable', async () => {
        for (const ownerId of [null, false, '', 0]) {
            await setDoc(doc(a.db, 'users', ownerA.uid, 'accounts', 'invalid-owner'), {ownerId, password: ownerA.ciphertext});
            await assert.rejects(context.readAccount({id: 'invalid-owner', field: 'password'}), /OWNER_MISMATCH/);
        }
        await setDoc(doc(a.db, 'users', ownerA.uid, 'accounts', 'absent-owner'), {password: ownerA.ciphertext});
        assert.equal(await context.readAccount({id: 'absent-owner', field: 'password'}), 'SECRET-FITTIZIO-A');
    });
    await t.test('Firebase sign-out aborts the view and denies both new unlock and anonymous server read', async () => {
        const old = context; await session.logout();
        assert.equal(a.auth.currentUser, null);
        assert.equal(old.signal.aborted, true);
        await assert.rejects(old.encrypt('SESSIONE-TERMINATA'), /VIEW_DISPOSED/);
        await assert.rejects(old.readAccount({id: 'private', field: 'password'}), /VIEW_DISPOSED/);
        await assert.rejects(session.unlock(), /AUTH_REQUIRED/);
        await assert.rejects(getDocFromServer(doc(a.db, 'users', ownerA.uid, 'accounts', 'private')), error => error.code === 'permission-denied');
    });
    await t.test('signing into the second user requires its own Master Password and returns only its data', async () => {
        await signInWithEmailAndPassword(a.auth, ownerB.email, loginPassword);
        assert.deepEqual(begunIdentities, [ownerA.uid, ownerB.uid], 'one explicit begin per identity, not per internal listener');
        password = masterA; await assert.rejects(session.unlock(), /INVALID_MASTER_PASSWORD/);
        password = masterB; await session.unlock(); await session.navigate('private');
        assert.equal(context.user.uid, ownerB.uid);
        assert.equal(await context.readAccount({id: 'private', field: 'password'}), 'SECRET-FITTIZIO-B');
    });
    await t.test('dispose closes the active route and prohibits future reads and unlocks', async () => {
        const old = context; session.dispose();
        assert.equal(old.signal.aborted, true);
        await assert.rejects(old.encrypt('SESSIONE-TERMINATA'), /VIEW_DISPOSED/);
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
    await t.test('initial observer failure preserves falsy error and removes browser resources', () => {
        let disposed = 0, begins = 0;
        const errors = [];
        assert.throws(() => createFirebaseSession({auth: a.auth, db: a.db, cryptoApi, browserTarget,
            requestPassword: async () => masterB, routes: {}, onError: value => errors.push(value),
            presentation: {invalidate() {throw null;}, dispose() {disposed++;}, beginIdentity() {begins++;}}
        }), /AUTH_OBSERVER_INITIALIZATION_FAILED/);
        assert.deepEqual(errors, [null]);
        assert.equal(disposed, 1); assert.equal(begins, 0); assert.equal(ticks.size, 0);
    });
    await t.test('observer failure after unlock revokes live context before reporting and disposes once', async () => {
        const fixture = createSyntheticTestAdmission({getUser: () => a.auth.currentUser});
        let fail = false, disposed = 0, begins = 0, live;
        const errors = [];
        const fresh = createFirebaseSession({...fixture, auth: a.auth, db: a.db, cryptoApi, browserTarget,
            requestPassword: async () => masterB, routes: {private: value => {live = value;}},
            onError: error => {assert.equal(live.signal.aborted, true); errors.push(error);},
            presentation: {...fixture.presentation,
                invalidate() {if (fail) throw undefined; fixture.presentation.invalidate();},
                beginIdentity() {begins++; return fixture.presentation.getTicket();},
                dispose() {disposed++; fixture.presentation.dispose();}}
        });
        try {
            await fresh.unlock(); await fresh.navigate('private');
            assert.equal(fresh.check(), true);
            fail = true;
            await signOut(a.auth);
            await new Promise(resolve => setImmediate(resolve));
            assert.deepEqual(errors, [undefined]);
            assert.equal(disposed, 1); assert.equal(begins, 1);
            assert.equal(fresh.check(), false); assert.equal(ticks.size, 0);
            await assert.rejects(fresh.unlock(), /SESSION_DISPOSED/);
            await assert.rejects(live.readAccount({id: 'private', field: 'password'}), /VIEW_DISPOSED/);
        } finally {fresh.dispose();}
        assert.equal(disposed, 1);
    });
    await t.test('dispose reentered from lock notification prevents later identity begin', async () => {
        await signInWithEmailAndPassword(a.auth, ownerB.email, loginPassword);
        const fixture = createSyntheticTestAdmission({getUser: () => a.auth.currentUser});
        let fresh, closeOnState = false, begins = 0, disposed = 0;
        fresh = createFirebaseSession({...fixture, auth: a.auth, db: a.db, cryptoApi, browserTarget,
            requestPassword: async () => masterB, routes: {},
            onState() {if (closeOnState) fresh.dispose();},
            presentation: {...fixture.presentation,
                beginIdentity() {begins++; return fixture.presentation.getTicket();},
                dispose() {disposed++; fixture.presentation.dispose();}}
        });
        try {
            await fresh.unlock(); closeOnState = true;
            await signOut(a.auth);
            await new Promise(resolve => setImmediate(resolve));
            assert.equal(disposed, 1); assert.equal(begins, 1); assert.equal(ticks.size, 0);
            await assert.rejects(fresh.unlock(), /SESSION_DISPOSED/);
        } finally {fresh.dispose();}
    });
});
