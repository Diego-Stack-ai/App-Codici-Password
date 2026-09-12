import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createLegacyAdapter} from './legacy-adapter.mjs';
const source = await readFile(new URL('../../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url), 'utf8');
const cryptoApi = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const master = 'SOLO-FIXTURE!123456';
const marker = 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1';
const randomKey = cryptoApi.generateVaultKey();
const verifier = await cryptoApi.createVaultVerifier(marker, master);
const envelope = await cryptoApi.wrapVaultKey(randomKey, master);
const ciphertext = await cryptoApi.encrypt('fixture-current', randomKey);
function fixture(options = {}) {
    let user = {uid: 'a'}, observer, unsubscribed = false;
    const adapter = createLegacyAdapter({
        getUser: () => user,
        subscribeUser: fn => { observer = fn; return () => { unsubscribed = true; }; },
        loadSecurity: async () => ({verifier, vaultKeyEnvelope: envelope}),
        requestPassword: async () => master, cryptoApi,
        ...options
    });
    return {adapter, changeUser(value) { user = value; observer(value); }, get unsubscribed() { return unsubscribed; }};
}

test('current v2 verifier/envelope decrypt the original record without rewriting it', async () => {
    const f = fixture();
    const record = Object.freeze({ownerId: 'a', ciphertext});
    await f.adapter.unlock();
    assert.equal(await f.adapter.read(record), 'fixture-current');
    assert.equal(record.ciphertext, ciphertext);
    f.adapter.dispose();
    assert.equal(f.unsubscribed, true);
    await assert.rejects(f.adapter.read(record), /AUTH_REQUIRED/);
});

test('CPVK2 keyring retains the existing legacy fallback without migration', async () => {
    const legacy = 'FIXTURE-LEGACY-KEY';
    const ring = cryptoApi.createVaultKeyring(randomKey, legacy);
    const wrapped = await cryptoApi.wrapVaultKey(ring, master);
    const f = fixture({loadSecurity: async () => ({verifier, vaultKeyEnvelope: wrapped})});
    await f.adapter.unlock();
    const oldCipher = await cryptoApi.encrypt('fixture-legacy', legacy);
    assert.equal(await f.adapter.read({ownerId: 'a', ciphertext: oldCipher}), 'fixture-legacy');
    assert.equal(await f.adapter.read({ownerId: 'a', ciphertext}), 'fixture-current');
});

test('wrong Master Password does not unlock or invoke a migration', async () => {
    const f = fixture({requestPassword: async () => 'wrong-fixture'});
    await assert.rejects(f.adapter.unlock(), /INVALID_MASTER_PASSWORD/);
    assert.equal(f.adapter.isUnlocked(), false);
});

test('missing envelope is rejected instead of automatically provisioning data', async () => {
    const f = fixture({loadSecurity: async () => ({verifier})});
    await assert.rejects(f.adapter.unlock(), /MIGRATION_REQUIRED/);
    assert.equal(f.adapter.isUnlocked(), false);
});

test('tampered envelope cannot unlock', async () => {
    const f = fixture({loadSecurity: async () => ({verifier, vaultKeyEnvelope: {...envelope, wrappedKey: 'AAAA'}})});
    await assert.rejects(f.adapter.unlock());
    assert.equal(f.adapter.isUnlocked(), false);
});

test('other owner and plaintext cannot enter the private ciphertext reader', async () => {
    const f = fixture();
    await f.adapter.unlock();
    await assert.rejects(f.adapter.read({ownerId: 'b', ciphertext}), /OWNER_MISMATCH/);
    await assert.rejects(f.adapter.read({ownerId: 'a', ciphertext: 'plaintext'}), /CIPHERTEXT_REQUIRED/);
});

test('logout while waiting for Master Password invalidates unlock', async () => {
    let release, entered;
    const waiting = new Promise(resolve => { entered = resolve; });
    const f = fixture({requestPassword: () => { entered(); return new Promise(resolve => { release = resolve; }); }});
    const unlocking = f.adapter.unlock();
    const rejected = assert.rejects(unlocking, /AUTH_REQUIRED/);
    await waiting;
    f.changeUser(null);
    release(master);
    await rejected;
    assert.equal(f.adapter.isUnlocked(), false);
});

test('switching owner clears the unlocked memory context', async () => {
    const f = fixture();
    await f.adapter.unlock();
    f.changeUser({uid: 'b'});
    assert.equal(f.adapter.isUnlocked(), false);
    await assert.rejects(f.adapter.read({ownerId: 'b', ciphertext}), /VAULT_LOCKED/);
});
