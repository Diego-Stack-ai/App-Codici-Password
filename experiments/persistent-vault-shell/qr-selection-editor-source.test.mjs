import test from 'node:test';
import assert from 'node:assert/strict';
import {createQrSelectionEditorSource} from './qr-selection-editor-source.mjs';
function fixture({decrypt} = {}) {
    let uid = 'owner', online = true, locked = false; const abort = new AbortController(), reads = [];
    const profile = {contactPhones: [{id: 'phone', number: 'enc:111', password: 'enc:SECRET'}]}, setting = {phones: [0]};
    const repository = {};
    for (const suffix of ['', 'Confirmed']) {
        repository['getUserProfile' + suffix] = async () => structuredClone(profile);
        repository['getUserSetting' + suffix] = async () => structuredClone(setting);
    }
    const source = createQrSelectionEditorSource({context: {user: {uid}, signal: abort.signal,
        assertUnlocked() {if (locked) throw Error('LOCKED');}, async read({ciphertext}) {reads.push(ciphertext); return decrypt ? decrypt(ciphertext) : ciphertext.slice(4);}},
        getUser: () => ({uid}), repository, isOnline: () => online, isEncryptedValue: value => value.startsWith('enc:')});
    return {source, profile, setting, abort, reads, offline() {online = false;}, change() {uid = 'other';}, lock() {locked = true;}};
}
test('editor reads only contact labels and prepares stable IDs without plaintext', async () => {
    const f = fixture(), loaded = await f.source.load();
    assert.equal(loaded.choices.at(-1).label, '111'); assert.deepEqual(loaded.selection.phones, ['phone']);
    assert.deepEqual(f.reads, ['enc:111']);
    const prepared = await f.source.prepare(loaded.selection);
    assert.equal(prepared.expectedRevision, 0); assert.doesNotMatch(JSON.stringify(prepared), /111|SECRET/);
});
test('offline loading is allowed but writing preparation waits for an online reopen', async () => {
    const f = fixture(); f.offline(); const loaded = await f.source.load();
    assert.equal(loaded.choices.at(-1).label, '111'); await assert.rejects(f.source.prepare(loaded.selection));
});
test('changed contact, revision or unversioned saved selection rejects stale editor', async () => {
    for (const mutate of [f => {f.profile.contactPhones[0].number = 'enc:222';}, f => {f.setting._qrRevision = 1;}, f => {f.setting.photo = true;}]) {
        const f = fixture(), loaded = await f.source.load(); mutate(f); await assert.rejects(f.source.prepare(loaded.selection));
    }
});
for (const boundary of ['abort', 'lock', 'change']) test(`label decryption cannot return after ${boundary}`, async () => {
    let release; const f = fixture({decrypt: () => new Promise(resolve => {release = resolve;})});
    const pending = f.source.load(); await new Promise(setImmediate); const rejected = assert.rejects(pending);
    if (boundary === 'abort') f.abort.abort(); else f[boundary](); release('111'); await rejected;
});
test('disposal prevents loading the source again', async () => {
    const f = fixture(); f.source.dispose(); await assert.rejects(f.source.load()); assert.equal(f.reads.length, 0);
});
