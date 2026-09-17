import test from 'node:test';
import assert from 'node:assert/strict';
import {documentAttachmentSha256} from './profile-document-attachments-contract.mjs';
import {createFirebaseDocumentAttachmentStorage, createFirestoreDocumentAttachmentDb}
    from './firebase-document-attachment-transport.mjs';

// The transport is the only place where the candidate contract meets the native
// SDKs: these fakes reproduce the precondition semantics of Firebase Storage
// (ifGenerationMatch) so the mapping is proved without an emulator as well.
const precondition = () => Object.assign(Error('PRECONDITION_FAILED'), {code: 412});
const notFound = () => Object.assign(Error('NOT_FOUND'), {code: 404});
function fakeBucket() {
    const objects = new Map();
    let versions = 0;
    return {objects,
        file(path) {
            return {
                name: path,
                async exists() {return [objects.has(path)];},
                async getMetadata() {
                    const object = objects.get(path);
                    if (!object) throw notFound();
                    return [{size: String(object.bytes.byteLength), generation: String(object.generation),
                        metadata: object.metadata}];
                },
                async download() {
                    const object = objects.get(path);
                    if (!object) throw notFound();
                    return [Buffer.from(object.bytes)];
                },
                async save(bytes, options = {}) {
                    if (objects.has(path)) throw precondition();
                    if (options.preconditionOpts?.ifGenerationMatch !== 0) throw Error('PRECONDITION_MISSING');
                    objects.set(path, {bytes: Uint8Array.from(bytes), generation: ++versions,
                        metadata: options.metadata?.metadata});
                },
                async delete(options = {}) {
                    const object = objects.get(path);
                    if (!object) throw notFound();
                    if (options.ifGenerationMatch === undefined) throw Error('PRECONDITION_MISSING');
                    if (Number(options.ifGenerationMatch) !== object.generation) throw precondition();
                    objects.delete(path);
                }
            };
        },
        seed(path, bytes, overrides = {}) {
            const copy = Uint8Array.from(bytes);
            objects.set(path, {bytes: copy, generation: ++versions, ...overrides});
        }};
}
test('the Storage transport creates conditionally and never overwrites an existing object', async () => {
    const bucket = fakeBucket(), storage = createFirebaseDocumentAttachmentStorage({bucket, sha256: documentAttachmentSha256});
    assert.equal(await storage.putIfAbsent('a/b', Uint8Array.from([1, 2, 3]), {metadata: {encrypted: 'v1'}}), 'created');
    assert.equal(await storage.putIfAbsent('a/b', Uint8Array.from([9, 9, 9]), {metadata: {encrypted: 'v1'}}), 'exists');
    assert.deepEqual([...bucket.objects.get('a/b').bytes], [1, 2, 3], 'the existing object is untouched');
    assert.deepEqual(bucket.objects.get('a/b').metadata, {encrypted: 'v1'});
});
test('the Storage transport reports digest, stored size and native version', async () => {
    const bucket = fakeBucket(), storage = createFirebaseDocumentAttachmentStorage({bucket, sha256: documentAttachmentSha256});
    assert.deepEqual(await storage.probe('a/b'), {exists: false});
    await storage.putIfAbsent('a/b', Uint8Array.from([1, 2, 3, 4]));
    const probe = await storage.probe('a/b');
    assert.equal(probe.exists, true);
    assert.equal(probe.digest, await documentAttachmentSha256(Uint8Array.from([1, 2, 3, 4])));
    assert.equal(probe.size, 4);
    assert.equal(probe.generation, String(bucket.objects.get('a/b').generation));
    assert.equal(probe.generation, '1');
});
test('the Storage transport removes only the verified version', async () => {
    const bucket = fakeBucket(), storage = createFirebaseDocumentAttachmentStorage({bucket, sha256: documentAttachmentSha256});
    await storage.putIfAbsent('a/b', Uint8Array.from([1, 2, 3]));
    const verified = (await storage.probe('a/b')).generation;
    bucket.seed('a/b', Uint8Array.from([1, 2, 3]));
    let failure = null;
    try {await storage.remove('a/b', {generation: verified});} catch (error) {failure = error;}
    assert.equal(failure?.code, 'OBJECT_CHANGED', 'a replaced object is reported, not deleted');
    assert.equal(bucket.objects.has('a/b'), true);
    await storage.remove('a/b', {generation: (await storage.probe('a/b')).generation});
    assert.equal(bucket.objects.has('a/b'), false, 'the verified version is deleted');
    await storage.remove('a/b', {generation: '1'});
    assert.equal(bucket.objects.has('a/b'), false, 'a missing object is already in the intended state');
});
test('the Storage transport refuses an unsupported shape instead of degrading', () => {
    assert.throws(() => createFirebaseDocumentAttachmentStorage({bucket: null, sha256: documentAttachmentSha256}),
        /STORAGE_TRANSPORT_INVALID/);
    assert.throws(() => createFirebaseDocumentAttachmentStorage({bucket: fakeBucket(), sha256: null}),
        /STORAGE_TRANSPORT_INVALID/);
});
test('the Firestore transport exposes the candidate contract over the native SDK', async () => {
    const calls = {transaction: 0};
    const db = {
        doc: path => ({path}),
        collection: path => ({path, where(field, operator, value) {
            return {path, field, operator, value, limit(count) {return {...this, count};}};
        }}),
        runTransaction(run) {
            calls.transaction++;
            return run({get: async ref => ({exists: true, data: () => ({path: ref.path})}),
                create: () => {}, update: () => {}, delete: () => {}});
        }
    };
    const transport = createFirestoreDocumentAttachmentDb(db);
    assert.deepEqual(transport.doc('users/a').path, 'users/a');
    const query = transport.attachmentsFor({uid: 'a', documentId: 'document-1'});
    assert.equal(query.path, 'users/a/profileDocumentAttachments');
    assert.equal(query.field, 'documentId');
    assert.equal(query.count, 11, 'the transactional read is bounded by the per-document limit plus one');
    const read = await transport.runTransaction(async transaction => transaction.get(transport.doc('users/a')));
    assert.equal(calls.transaction, 1);
    assert.equal(read.data().path, 'users/a');
});
