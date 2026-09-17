import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {documentAttachmentReceiptPath, documentAttachmentRecordPath, documentImageStoragePath}
    from './profile-document-attachments-contract.mjs';
import {createProfileDocumentAttachmentHandler} from './profile-document-attachments-handler.mjs';
import {planProfileDocumentAttachmentDelete, planProfileDocumentAttachmentUpload}
    from './prepare-profile-document-attachment.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const b64 = (bytes, fill) => Buffer.alloc(bytes, fill).toString('base64');
const envelope = () => ({type: 'profile-document-attachment-envelope', version: 1, cipher: 'AES-GCM-256',
    keyWrap: 'HKDF-SHA256+A256GCM', contentIv: b64(12, 7), wrapSalt: b64(32, 9), wrapIv: b64(12, 11), wrappedFileKey: b64(48, 13)});
const uid = 'owner', documentId = 'document-1', attachmentId = 'attachment-1';
const storagePath = documentImageStoragePath({uid, documentId, attachmentId});
const recordPath = documentAttachmentRecordPath({uid, attachmentId});
const receiptPath = operationId => documentAttachmentReceiptPath({uid, operationId});
const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
async function uploadInput({operationId = 'upload-1', attachment = attachmentId} = {}) {
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
    const capability = createProfileDocumentAttachmentCapability({context, getUser: () => ({uid}),
        seal: async ({bytes}) => ({payload: new Uint8Array([...bytes].map(byte => byte ^ 0x11)), envelope: envelope()})});
    try {
        return await planProfileDocumentAttachmentUpload({context, getUser: () => ({uid}), capability,
            documents: [{id: documentId}], attachments: [], documentId, bytes: new Uint8Array([1, 2, 3, 4]),
            mimeType: 'image/jpeg', operationId, hash, createAttachmentId: () => attachment});
    } finally {capability.dispose();}
}
async function deleteInput(metadata, {operationId = 'delete-1'} = {}) {
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
    return planProfileDocumentAttachmentDelete({context, getUser: () => ({uid}), documents: [{id: documentId}],
        attachment: metadata, operationId, hash});
}
function fixture() {
    const records = new Map(), objects = new Map(), calls = {put: 0, remove: 0};
    const failures = {put: false, remove: false, throwOn: []};
    let transactions = 0;
    const snapshot = ref => ({exists: records.has(ref), data: () => structuredClone(records.get(ref))});
    const db = {
        doc: path => path,
        async get(ref) {return snapshot(ref);},
        async list(path) {return [...records.entries()].filter(([key]) => key.startsWith(`${path}/`)).map(([, value]) => structuredClone(value));},
        runTransaction(run) {
            transactions++;
            if (failures.throwOn.includes(transactions)) {
                failures.throwOn = failures.throwOn.filter(index => index !== transactions);
                return Promise.reject(Error('TRANSACTION_FAILED'));
            }
            const staged = new Map(), removed = new Set();
            const current = ref => {
                if (removed.has(ref)) return {exists: false, data: () => undefined};
                if (staged.has(ref)) return {exists: true, data: () => structuredClone(staged.get(ref))};
                return snapshot(ref);
            };
            return Promise.resolve(run({
                async get(ref) {return current(ref);},
                create(ref, value) {if (current(ref).exists) throw Error('ALREADY_EXISTS'); staged.set(ref, structuredClone(value));},
                update(ref, patch) {
                    if (!current(ref).exists) throw Error('NOT_FOUND');
                    staged.set(ref, {...current(ref).data(), ...structuredClone(patch)});
                },
                delete(ref) {if (!current(ref).exists) throw Error('NOT_FOUND'); staged.delete(ref); removed.add(ref);}
            })).then(result => {
                for (const ref of removed) records.delete(ref);
                for (const [ref, value] of staged) records.set(ref, value);
                return result;
            });
        }
    };
    const storage = {
        async put(path, payload, options) {
            calls.put++;
            if (failures.put) throw Error('PUT_FAILED');
            objects.set(path, {bytes: Uint8Array.from(payload), metadata: options?.metadata});
        },
        async remove(path) {
            calls.remove++;
            if (failures.remove) throw Error('REMOVE_FAILED');
            objects.delete(path);
        },
        async exists(path) {return objects.has(path);}
    };
    return {records, objects, calls, failures, transactions: () => transactions, failAt: offset => {failures.throwOn = [transactions + offset];},
        handler: createProfileDocumentAttachmentHandler({db, storage, hash, timestamp: () => 123})};
}
test('an upload reserves, stores and finalizes with an idempotent receipt', async () => {
    const f = fixture(), input = await uploadInput();
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId});
    const record = f.records.get(recordPath), receipt = f.records.get(receiptPath('upload-1'));
    assert.equal(record.status, 'ready'); assert.equal(record.ownerId, uid); assert.equal(record.documentId, documentId);
    assert.equal(record.storagePath, storagePath); assert.equal(record.digest, input.digest.length === 64 ? record.digest : null);
    assert.equal(record.digest, input.command.digest); assert.equal(record.size, 4); assert.equal(record.mimeType, 'image/jpeg');
    assert.equal(record.schemaVersion, 1); assert.equal(record.createdAt, 123);
    assert.deepEqual(Object.keys(record).sort(), ['createdAt', 'digest', 'documentId', 'envelope', 'mimeType', 'ownerId',
        'schemaVersion', 'size', 'status', 'storagePath']);
    assert.equal(receipt.kind, 'profile-document-attachment'); assert.equal(receipt.status, 'ready');
    assert.equal(receipt.digest, input.digest); assert.equal(receipt.attachmentId, attachmentId);
    assert.equal(f.objects.size, 1);
    assert.deepEqual(f.objects.get(storagePath).metadata, {encrypted: 'v1'});
    assert.equal(f.objects.get(storagePath).bytes.byteLength > 0, true);
    assert.equal(f.objects.get(storagePath).bytes.includes(1), false, 'the stored object is not the plaintext');
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId});
    assert.equal(f.calls.put, 1, 'a confirmed retry never rewrites the object');
    assert.equal(f.objects.size, 1);
});
test('the upload refuses forged, foreign and untrusted input without writing anything', async () => {
    const f = fixture(), input = await uploadInput();
    for (const [payload, trustedContext] of [
        [{...input, digest: hash('other')}, trusted],
        [{...input, command: {...input.command, storagePath: 'users/other/profile-documents/document-1/attachments/attachment-1'}}, trusted],
        [{...input, command: {...input.command, ownerId: 'other'}}, trusted],
        [{...input, payload: new Uint8Array(0)}, trusted],
        [input, {}], [input, {auth: {uid}}], [input, {auth: {uid: '../owner'}, app: {appId: 'x'}}]]) {
        await assert.rejects(f.handler.upload(payload, trustedContext));
    }
    assert.equal(f.records.size, 0); assert.equal(f.objects.size, 0); assert.equal(f.calls.put, 0);
});
test('the same operation cannot be reused for a different attachment', async () => {
    const f = fixture();
    await f.handler.upload(await uploadInput(), trusted);
    await assert.rejects(f.handler.upload(await uploadInput({attachment: 'attachment-2'}), trusted), /OPERATION_CONFLICT/);
    assert.equal(f.records.size, 2, 'the conflicting request added no record');
});
test('a failed object write leaves no trace and the same operation can be retried', async () => {
    const f = fixture(), input = await uploadInput();
    f.failures.put = true;
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'compensated', code: 'OBJECT_WRITE_FAILED', attachmentId});
    assert.equal(f.records.size, 0); assert.equal(f.objects.size, 0);
    f.failures.put = false;
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId});
    assert.equal(f.objects.size, 1);
});
test('a deferred finalize is reported as incomplete and completed by recover or retry', async () => {
    const f = fixture(), input = await uploadInput();
    f.failAt(2);
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'incomplete', code: 'FINALIZE_FAILED', attachmentId});
    assert.equal(f.records.get(recordPath).status, 'reserved');
    assert.equal(f.records.get(receiptPath('upload-1')).status, 'reserved');
    assert.equal(f.objects.size, 1, 'the object exists but nothing claims it is ready');
    f.failures.throwOn = [];
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 1, compensated: 0, incomplete: 0});
    assert.equal(f.records.get(recordPath).status, 'ready');
    assert.equal(f.records.get(receiptPath('upload-1')).status, 'ready');
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 0, compensated: 0, incomplete: 0});
});
test('an object without its metadata is an orphan and is compensated', async () => {
    const f = fixture(), input = await uploadInput();
    f.failAt(2);
    await f.handler.upload(input, trusted);
    f.failures.throwOn = [];
    f.records.delete(recordPath);
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'compensated', code: 'METADATA_MISSING', attachmentId});
    assert.equal(f.objects.size, 0); assert.equal(f.records.size, 0);
});
test('recover compensates a reserved receipt whose object never arrived', async () => {
    const f = fixture(), input = await uploadInput();
    f.failAt(2);
    await f.handler.upload(input, trusted);
    f.failures.throwOn = [];
    f.objects.clear();
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 0, compensated: 1, incomplete: 0});
    assert.equal(f.records.size, 0); assert.equal(f.objects.size, 0);
});
test('recover ignores malformed receipts and never touches storage for them', async () => {
    const f = fixture();
    f.records.set(receiptPath('broken'), {kind: 'profile-document-attachment', ownerId: uid, status: 'reserved',
        documentId, attachmentId: '../escape', storagePath: 'users/owner/elsewhere', digest: hash('x'), operationId: 'broken'});
    const before = f.calls.remove;
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 0, compensated: 0, incomplete: 1});
    assert.equal(f.calls.remove, before);
    assert.equal(f.records.size, 1);
});
test('a deletion removes metadata and object with an idempotent receipt', async () => {
    const f = fixture();
    await f.handler.upload(await uploadInput(), trusted);
    const input = await deleteInput({...f.records.get(recordPath), id: attachmentId});
    assert.deepEqual(await f.handler.remove(input, trusted), {status: 'confirmed', state: 'removed', attachmentId});
    assert.equal(f.records.has(recordPath), false); assert.equal(f.objects.size, 0);
    assert.equal(f.records.get(receiptPath('delete-1')).status, 'removed');
    const removes = f.calls.remove;
    assert.deepEqual(await f.handler.remove(input, trusted), {status: 'confirmed', state: 'removed', attachmentId});
    assert.equal(f.calls.remove, removes, 'a confirmed retry never touches storage again');
});
test('a deletion refuses a missing or changed record and a forged command', async () => {
    const missing = fixture();
    await missing.handler.upload(await uploadInput(), trusted);
    const missingInput = await deleteInput({...missing.records.get(recordPath), id: attachmentId}, {operationId: 'delete-missing'});
    missing.records.delete(recordPath);
    await assert.rejects(missing.handler.remove(missingInput, trusted), /DOCUMENT_ATTACHMENT_MISSING/);
    assert.equal(missing.objects.size, 1, 'the object is untouched when the deletion is refused');

    const changed = fixture();
    await changed.handler.upload(await uploadInput(), trusted);
    const changedInput = await deleteInput({...changed.records.get(recordPath), id: attachmentId}, {operationId: 'delete-changed'});
    changed.records.get(recordPath).digest = hash('tampered');
    await assert.rejects(changed.handler.remove(changedInput, trusted), /DOCUMENT_ATTACHMENT_CONFLICT/);
    assert.equal(changed.objects.size, 1, 'the object survives a refused deletion');
    assert.equal(changed.records.has(receiptPath('delete-changed')), false, 'a refused deletion leaves no receipt');

    const forged = fixture();
    await forged.handler.upload(await uploadInput(), trusted);
    const input = await deleteInput({...forged.records.get(recordPath), id: attachmentId}, {operationId: 'delete-forged'});
    for (const bad of [{...input, digest: hash('other')},
        {...input, command: {...input.command, expectedDigest: hash('other')}},
        {...input, command: {...input.command, storagePath: 'users/other/profile-documents/document-1/attachments/attachment-1'}}]) {
        await assert.rejects(forged.handler.remove(bad, trusted), /DOCUMENT_ATTACHMENT_INVALID/);
    }
    assert.equal(forged.records.has(recordPath), true);
    assert.equal(forged.objects.size, 1);
});
test('a deferred object removal is completed by recover', async () => {
    const f = fixture();
    await f.handler.upload(await uploadInput(), trusted);
    const input = await deleteInput({...f.records.get(recordPath), id: attachmentId});
    f.failures.remove = true;
    assert.deepEqual(await f.handler.remove(input, trusted), {status: 'incomplete', code: 'OBJECT_REMOVE_FAILED', attachmentId});
    assert.equal(f.records.get(recordPath).status, 'deleting');
    assert.equal(f.records.get(receiptPath('delete-1')).status, 'deleting');
    f.failures.remove = false;
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 1, compensated: 0, incomplete: 0});
    assert.equal(f.records.has(recordPath), false); assert.equal(f.objects.size, 0);
    assert.equal(f.records.get(receiptPath('delete-1')).status, 'removed');
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 0, compensated: 0, incomplete: 0});
});
test('a deferred deletion finalize is reported as incomplete and completed by recover', async () => {
    const f = fixture();
    await f.handler.upload(await uploadInput(), trusted);
    const input = await deleteInput({...f.records.get(recordPath), id: attachmentId});
    f.failAt(2);
    assert.deepEqual(await f.handler.remove(input, trusted), {status: 'incomplete', code: 'FINALIZE_FAILED', attachmentId});
    assert.equal(f.objects.size, 0, 'the object was already removed');
    f.failures.throwOn = [];
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 1, compensated: 0, incomplete: 0});
    assert.equal(f.records.has(recordPath), false);
});
