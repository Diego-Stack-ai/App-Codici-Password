import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DOCUMENT_ATTACHMENT_REFUSALS, documentImageStoragePath} from './profile-document-attachments-contract.mjs';
import {createProfileDocumentAttachmentsReader} from './profile-document-attachments-reader.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const b64 = (bytes, fill) => Buffer.alloc(bytes, fill).toString('base64');
const envelope = () => ({type: 'profile-document-attachment-envelope', version: 1, cipher: 'AES-GCM-256',
    keyWrap: 'HKDF-SHA256+A256GCM', contentIv: b64(12, 7), wrapSalt: b64(32, 9), wrapIv: b64(12, 11), wrappedFileKey: b64(48, 13)});
const uid = 'owner';
const record = (documentId, attachmentId, status = 'ready') => ({ownerId: uid, documentId,
    storagePath: documentImageStoragePath({uid, documentId, attachmentId}), mimeType: 'image/png', size: 1234,
    digest: hash(attachmentId), envelope: envelope(), status, schemaVersion: 1, createdAt: 7});
function fixture({online = true, documents = [{id: 'document-1', type: 'Patente'}], records = [], listFails = false} = {}) {
    const abort = new AbortController(), state = {uid: uid, locked: false, calls: [], records, listFails,
        profile: {ownerId: uid, documenti: documents}};
    const context = {user: {uid}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');}};
    const read = async (requested, confirmed) => {state.calls.push(confirmed ? 'confirmed' : 'cache'); return structuredClone(state.profile);};
    return {state, abort, context, reader: createProfileDocumentAttachmentsReader({context, getUser: () => ({uid: state.uid}),
        isOnline: () => online, repository: {getUserProfile: requested => read(requested, false),
            getUserProfileConfirmed: requested => read(requested, true),
            listProfileDocumentAttachments: async () => {state.calls.push('list'); if (state.listFails) throw Error('LIST_FAILED'); return structuredClone(state.records);}}})};
}
test('the projection exposes only this document, online and ready', async () => {
    const f = fixture({records: [record('document-1', 'attachment-a'), {...record('document-1', 'attachment-b', 'reserved'), id: 'attachment-b'},
        {...record('document-2', 'attachment-c'), id: 'attachment-c'}]});
    const projection = await f.reader.read('document-1');
    assert.equal(projection.allowed, true); assert.equal(projection.refusal, null);
    assert.equal(projection.online, true); assert.equal(projection.bytesAvailable, false);
    assert.deepEqual(projection.attachments.map(item => item.attachmentId), ['attachment-a', 'attachment-b']);
    assert.equal(projection.attachments[0].available, true);
    assert.equal(projection.attachments[1].available, false, 'a reserved attachment is not available');
    assert.deepEqual(Object.keys(projection.attachments[0]).sort(),
        ['attachmentId', 'available', 'digest', 'mimeType', 'schemaVersion', 'size', 'status']);
    assert.deepEqual(projection.invalid, []);
    assert.deepEqual(f.state.calls, ['confirmed', 'list']);
    f.reader.dispose();
});
test('offline shows synchronized metadata only, never bytes', async () => {
    const f = fixture({online: false, records: [record('document-1', 'attachment-a')]});
    const projection = await f.reader.read('document-1');
    assert.equal(projection.online, false);
    assert.equal(projection.attachments.length, 1);
    assert.equal(projection.attachments[0].available, false, 'bytes are never available from the cache');
    assert.equal(projection.bytesAvailable, false);
    assert.deepEqual(f.state.calls, ['cache', 'list'], 'offline uses the cached read');
    f.reader.dispose();
});
test('a document without a unique persisted id is refused while its attachments stay consultable', async () => {
    for (const [documents, documentId, code, expected] of [
        [[{type: 'Patente'}], 'document-1', DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_MISSING, 1],
        [[{id: 'document-1'}, {id: 'document-1'}], 'document-1', DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_AMBIGUOUS, 1],
        [[{id: 'document-1/../x'}], 'document-1/../x', DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_INVALID, 0]]) {
        const f = fixture({documents, records: [record('document-1', 'attachment-a')]});
        const projection = await f.reader.read(documentId);
        assert.equal(projection.allowed, false, code);
        assert.equal(projection.refusal, code);
        assert.equal(projection.attachments.length, expected, 'existing metadata remains readable');
        f.reader.dispose();
    }
});
test('unverifiable records are reported and never exposed as usable', async () => {
    const f = fixture({records: [record('document-1', 'attachment-a'),
        {...record('document-1', 'attachment-b'), ownerId: 'other', id: 'attachment-b'},
        {...record('document-1', 'attachment-c'), storagePath: 'users/other/profile-documents/document-1/attachments/attachment-c', id: 'attachment-c'},
        {...record('document-1', 'attachment-d'), url: 'https://example.invalid/secret', id: 'attachment-d'},
        {...record('document-1', 'attachment-e'), envelope: {...envelope(), version: 2}, id: 'attachment-e'},
        {not: 'a record'}]});
    const projection = await f.reader.read('document-1');
    assert.deepEqual(projection.attachments.map(item => item.attachmentId), ['attachment-a']);
    assert.equal(projection.invalid.length, 5);
    assert.ok(projection.invalid.every(entry => entry.code === 'METADATA_INVALID'));
    assert.deepEqual(projection.invalid.map(entry => entry.attachmentId),
        ['attachment-b', 'attachment-c', 'attachment-d', 'attachment-e', null]);
    assert.doesNotMatch(JSON.stringify(projection), /example\.invalid|url/);
    f.reader.dispose();
});
for (const boundary of ['uid', 'locked', 'abort']) test(`the projection is revoked after ${boundary}`, async () => {
    const f = fixture({records: [record('document-1', 'attachment-a')]});
    if (boundary === 'abort') f.abort.abort(); else f.state[boundary] = boundary === 'uid' ? 'other' : true;
    await assert.rejects(f.reader.read('document-1'), /VIEW_DISPOSED|LOCKED/);
    assert.deepEqual(f.state.calls, [], 'nothing is read after revocation');
    f.reader.dispose();
});
test('a revocation while the listing is in flight stops the projection', async () => {
    const abort = new AbortController();
    let release;
    const reader = createProfileDocumentAttachmentsReader({context: {user: {uid}, signal: abort.signal, assertUnlocked() {}},
        getUser: () => ({uid}), isOnline: () => true,
        repository: {getUserProfile: async () => ({ownerId: uid, documenti: [{id: 'document-1'}]}),
            getUserProfileConfirmed: async () => ({ownerId: uid, documenti: [{id: 'document-1'}]}),
            listProfileDocumentAttachments: () => new Promise(resolve => {
                release = () => resolve([record('document-1', 'attachment-a')]);
            })}});
    const pending = reader.read('document-1');
    await new Promise(setImmediate);
    assert.equal(typeof release, 'function', 'the listing is in flight');
    abort.abort();
    release();
    await assert.rejects(pending, /VIEW_DISPOSED/);
    reader.dispose();
});
test('a listing failure is surfaced and never turned into an empty projection', async () => {
    const f = fixture({records: [record('document-1', 'attachment-a')], listFails: true});
    await assert.rejects(f.reader.read('document-1'), /LIST_FAILED/);
    f.reader.dispose();
});
