import test from 'node:test';
import assert from 'node:assert/strict';
import {readConflictNotes} from './conflict-note-review.mjs';
function fixture() {
    const page = new AbortController(), reads = [];
    const record = {type: 'account', visibility: 'private', _encrypted: true, note: 'local-cipher'};
    const operation = {uid: 'owner', schemaVersion: 1, recordId: 'account', record};
    const latest = {...record, note: 'online-cipher', id: 'account', ownerId: 'owner', schemaVersion: 1, revision: 7};
    const context = {user: {uid: 'owner'}, unlocked: true, signal: page.signal,
        read: async value => { reads.push(value); return value.ciphertext === 'local-cipher' ? 'Local note' : 'Online note'; }};
    return {page, reads, latest, args: {operation, context, readLatest: async () => latest}};
}
test('comparison reads only the two notes and returns no ciphertext or record', async () => {
    const f = fixture();
    assert.deepEqual(await readConflictNotes(f.args), {localNote: 'Local note', onlineNote: 'Online note', onlineRevision: 7});
    assert.deepEqual(f.reads.map(value => value.ownerId), ['owner', 'owner']);
    assert.equal(f.args.operation.record.note, 'local-cipher');
});
test('mismatched owner, record and legacy source fail before decryption', async () => {
    for (const change of [{ownerId: 'other'}, {id: 'other'}, {revision: -1}, {_encrypted: false}, {visibility: 'company'}]) {
        const f = fixture(); Object.assign(f.latest, change);
        await assert.rejects(readConflictNotes(f.args), /SCOPE/); assert.equal(f.reads.length, 0);
    }
});
test('latest ciphertext is captured before asynchronous local decryption', async () => {
    const f = fixture(), original = f.args.context.read;
    f.args.context.read = async value => { f.latest.note = 'changed-after-read'; return original(value); };
    await readConflictNotes(f.args); assert.equal(f.reads[1].ciphertext, 'online-cipher');
});
test('abort during decryption suppresses result and the next read', async () => {
    const f = fixture(); f.args.context.read = async () => { f.page.abort(); return 'Late note'; };
    await assert.rejects(readConflictNotes(f.args), /INACTIVE/);
});
test('empty notes do not invoke decryption and oversized values are rejected', async () => {
    const f = fixture(); f.args.operation.record.note = f.latest.note = '';
    assert.equal((await readConflictNotes(f.args)).localNote, ''); assert.equal(f.reads.length, 0);
    f.args.operation.record.note = 'cipher'; f.args.context.read = async () => 'x'.repeat(100001);
    await assert.rejects(readConflictNotes(f.args), /VALUE/);
});
