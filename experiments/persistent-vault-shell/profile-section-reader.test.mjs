import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileSectionReader} from './profile-section-reader.mjs';
function fixture(record, overrides = {}) {
    let uid = 'owner', locked = false; const signal = new AbortController(), reads = [];
    const context = {user: {uid}, signal: signal.signal, assertUnlocked() { if (locked) throw new Error('VAULT_LOCKED'); },
        read: async ({ciphertext}) => { reads.push(ciphertext); return ciphertext.slice(4); }, ...overrides.context};
    const read = createProfileSectionReader({context, getUser: () => ({uid}), repository: {getUserProfile: overrides.load || (async requested => { assert.equal(requested, 'owner'); return record; })}, isEncryptedValue: value => value.startsWith('enc:')});
    return {read, reads, signal, change: () => { uid = 'other'; }, lock: () => { locked = true; }};
}
test('canonical contact fields are projected, and credentials and arbitrary properties never decrypted', async () => {
    const f = fixture({contactEmails: [{address: 'enc:a@example.invalid', password: 'enc:DO-NOT-READ'}], contactPhones: [{number: 'enc:000', value: 'enc:WRONG-FIELD', pin: 'enc:DO-NOT-READ'}]});
    assert.deepEqual((await f.read('contacts')).map(row => row.value), ['a@example.invalid', '000']);
    assert.deepEqual(f.reads, ['enc:a@example.invalid', 'enc:000']);
});
test('canonical address and document fields work with explicitly supported legacy plaintext', async () => {
    const f = fixture({userAddresses: [{address: 'enc:Via fittizia', civic: '1', street: 'wrong'}], documenti: [{num_serie: 'enc:ABC', numero: 'wrong', pin: 'enc:secret'}]});
    assert.deepEqual((await f.read('addresses')).map(row => row.value), ['Via fittizia', '1']);
    assert.deepEqual((await f.read('documents')).map(row => row.value), ['ABC']);
});
test('locked Vault, wrong owner, unknown section and malformed data fail closed', async () => {
    const f = fixture({nome: 'legacy'}); f.lock(); await assert.rejects(f.read('personal'), /VAULT_LOCKED/);
    await assert.rejects(fixture({ownerId: 'other'}).read('personal'), /OWNER_MISMATCH/);
    await assert.rejects(fixture({}).read('password'), /PROFILE_SECTION_INVALID/);
    await assert.rejects(fixture({contactPhones: {}}).read('contacts'), /PROFILE_SHAPE_INVALID/);
    await assert.rejects(fixture({nome: {nested: 'secret'}}).read('personal'), /PROFILE_VALUE_INVALID/);
});
test('a missing profile is distinct from a legitimately empty section', async () => {
    await assert.rejects(fixture(null).read('personal'), /PROFILE_NOT_FOUND/);
    assert.deepEqual(await fixture({}).read('contacts'), []);
});
for (const boundary of ['change', 'abort', 'lock']) test(`late profile read is discarded after ${boundary}`, async () => {
    let release; const f = fixture(null, {load: () => new Promise(resolve => { release = resolve; })});
    const pending = f.read('personal'); const rejected = assert.rejects(pending, /AUTH_CHANGED|VIEW_DISPOSED|VAULT_LOCKED/);
    if (boundary === 'abort') f.signal.abort(); else f[boundary](); release({nome: 'enc:late'}); await rejected;
    assert.deepEqual(f.reads, []);
});
test('decrypt failure is not displayed as ciphertext or treated as legacy plaintext', async () => {
    const f = fixture({nome: 'enc:corrupt'}, {context: {read: async () => { throw new Error('DECRYPT_FAILED'); }}});
    await assert.rejects(f.read('personal'), /DECRYPT_FAILED/);
});
