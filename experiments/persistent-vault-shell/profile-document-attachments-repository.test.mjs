import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileDocumentAttachmentsRepository} from './profile-document-attachments-repository.mjs';

function fixture() {
    const controller = new AbortController(), calls = [];
    const state = {uid: 'owner', online: true, locked: false};
    const transport = {
        async read(path, options) {calls.push({path, ...options}); return {ownerId: 'owner', documenti: [{id: 'doc', type: 'Patente', secret: 'cipher'}]};},
        async list(path, options) {calls.push({path, ...options}); return [];},
        async download(path, options) {calls.push({path, ...options}); return new Uint8Array([1]);}
    };
    const repository = createProfileDocumentAttachmentsRepository({context: {user: {uid: 'owner'}, signal: controller.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');}}, getUser: () => ({uid: state.uid}), transport, isOnline: () => state.online});
    return {repository, state, transport, controller, calls};
}
test('online server reads and offline metadata-only cache reads are explicit', async () => {
    const f = fixture();
    assert.deepEqual(await f.repository.readDocuments(), [{id: 'doc', type: 'Patente'}]);
    await f.repository.listAttachments('owner');
    assert.ok(f.calls.every(call => call.source === 'server'));
    f.state.online = false;
    await f.repository.readDocuments(); await f.repository.listAttachments('owner');
    assert.ok(f.calls.slice(2).every(call => call.source === 'cache'));
    await assert.rejects(f.repository.readProfile('owner', true), /OFFLINE_NOT_ALLOWED/);
});
test('server failure never silently falls back to cache', async () => {
    const f = fixture(); let reads = 0;
    f.transport.read = async () => {reads++; throw Error('SERVER_FAILED');};
    await assert.rejects(f.repository.readDocuments(), /SERVER_FAILED/); assert.equal(reads, 1);
});
test('foreign identity and noncanonical paths never reach transport', async () => {
    const f = fixture();
    await assert.rejects(f.repository.listAttachments('other'), /VIEW_DISPOSED/);
    await assert.rejects(f.repository.readAttachment('owner', '../a'));
    for (const path of ['https://example.invalid/file', 'users/other/profile-documents/doc/attachments/a', 'users/owner/profile-documents/doc/attachments/a/extra'])
        await assert.rejects(f.repository.download('owner', {storagePath: path}), /PATH_MISMATCH/);
    assert.equal(f.calls.length, 0);
});
test('late session changes reject metadata and erase downloaded bytes', async () => {
    const f = fixture();
    f.transport.read = async () => {f.state.uid = 'other'; return {ownerId: 'owner'};};
    await assert.rejects(f.repository.readProfile('owner'), /VIEW_DISPOSED/);
    f.state.uid = 'owner'; const bytes = new Uint8Array([3, 4]);
    f.transport.download = async () => {f.controller.abort(); return bytes;};
    await assert.rejects(f.repository.download('owner', {storagePath: 'users/owner/profile-documents/doc/attachments/a'}), /VIEW_DISPOSED/);
    assert.deepEqual([...bytes], [0, 0]);
});
test('offline and locked sessions cannot download; valid online bytes are returned', async () => {
    const f = fixture(), reference = {storagePath: 'users/owner/profile-documents/doc/attachments/a'};
    f.state.online = false; await assert.rejects(f.repository.download('owner', reference), /OFFLINE_NOT_ALLOWED/);
    f.state.online = true; f.state.locked = true; await assert.rejects(f.repository.download('owner', reference), /LOCKED/);
    assert.equal(f.calls.length, 0); f.state.locked = false;
    assert.deepEqual([...await f.repository.download('owner', reference)], [1]);
});
test('malformed documents are rejected rather than repaired into writable identities', async () => {
    const f = fixture();
    for (const documenti of [null, {}, [null], ['document']]) {
        f.transport.read = async () => ({ownerId: 'owner', documenti});
        await assert.rejects(f.repository.readDocuments(), /DOCUMENTS_INVALID/);
    }
});
test('late lock or owner change rejects list and individual record responses', async () => {
    const f = fixture();
    f.transport.list = async () => {f.state.locked = true; return [];};
    await assert.rejects(f.repository.listAttachments('owner'), /LOCKED/);
    f.state.locked = false;
    f.transport.read = async () => {f.state.uid = 'other'; return {id: 'a'};};
    await assert.rejects(f.repository.readAttachment('owner', 'a'), /VIEW_DISPOSED/);
});
