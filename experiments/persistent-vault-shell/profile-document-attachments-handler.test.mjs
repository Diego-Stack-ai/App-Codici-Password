import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {DOCUMENT_ATTACHMENT_REFUSALS, DOCUMENT_IMAGE_MAX_PER_DOCUMENT, documentAttachmentReceiptPath,
    documentAttachmentRecordPath, documentImageStoragePath} from './profile-document-attachments-contract.mjs';
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
const boundRecord = (attachment, status = 'ready', overrides = {}) => ({ownerId: uid, documentId,
    storagePath: documentImageStoragePath({uid, documentId, attachmentId: attachment}), mimeType: 'image/jpeg', size: 4,
    digest: hash(`payload-${attachment}`), envelope: envelope(), status, schemaVersion: 1, createdAt: 1, ...overrides});
const attachments = count => Array.from({length: count}, (unused, index) => `attachment-${index}`);
async function uploadInput({operationId = 'upload-1', attachment = attachmentId, bytes = new Uint8Array([1, 2, 3, 4])} = {}) {
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
    const capability = createProfileDocumentAttachmentCapability({context, getUser: () => ({uid}),
        seal: async ({bytes: plain}) => ({payload: new Uint8Array([...plain].map(byte => byte ^ 0x11)), envelope: envelope()})});
    try {
        return await planProfileDocumentAttachmentUpload({context, getUser: () => ({uid}), capability,
            documents: [{id: documentId}], attachments: [], documentId, bytes, mimeType: 'image/jpeg', operationId, hash,
            createAttachmentId: () => attachment});
    } finally {capability.dispose();}
}
async function deleteInput(metadata, {operationId = 'delete-1'} = {}) {
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
    return planProfileDocumentAttachmentDelete({context, getUser: () => ({uid}), documents: [{id: documentId}],
        attachment: metadata, operationId, hash});
}
function fixture({documents = [documentId], seeded = []} = {}) {
    const records = new Map(), objects = new Map();
    const calls = {write: 0, remove: 0, probe: 0};
    const failures = {write: false, remove: false, probe: false, throwOn: []};
    let transactions = 0, chain = Promise.resolve();
    records.set(`users/${uid}`, {ownerId: uid, documenti: documents.map(id => ({id, type: 'Patente'}))});
    for (const attachment of seeded) records.set(documentAttachmentRecordPath({uid, attachmentId: attachment}), boundRecord(attachment));
    const snapshot = ref => ({exists: records.has(ref), data: () => structuredClone(records.get(ref))});
    const rows = document => [...records.entries()]
        .filter(([key]) => key.startsWith(`users/${uid}/profileDocumentAttachments/`))
        .map(([key, value]) => ({...structuredClone(value), id: key.split('/').pop()}))
        .filter(record => record.documentId === document)
        .slice(0, DOCUMENT_IMAGE_MAX_PER_DOCUMENT + 1);
    const db = {
        doc: path => path,
        async get(ref) {return snapshot(ref);},
        async list(path) {return [...records.entries()].filter(([key]) => key.startsWith(`${path}/`))
            .map(([key, value]) => ({...structuredClone(value), id: key.split('/').pop()}));},
        attachmentsFor({uid: owner, documentId: document}) {
            if (owner !== uid) throw Error('QUERY_INVALID');
            return {kind: 'attachments', uid: owner, documentId: document};
        },
        // Mirrors Firestore: a transaction may not read after it has written, and
        // transactions are serialized so a concurrent race reads committed state.
        runTransaction(run) {
            const execute = () => {
                transactions++;
                if (failures.throwOn.includes(transactions)) {
                    failures.throwOn = failures.throwOn.filter(index => index !== transactions);
                    return Promise.reject(Error('TRANSACTION_FAILED'));
                }
                const staged = new Map(), removed = new Set();
                let wrote = false;
                const current = ref => removed.has(ref) ? {exists: false, data: () => undefined}
                    : staged.has(ref) ? {exists: true, data: () => structuredClone(staged.get(ref))} : snapshot(ref);
                const guardRead = () => {if (wrote) throw Error('READ_AFTER_WRITE');};
                return Promise.resolve(run({
                    async get(ref) {guardRead(); return current(ref);},
                    async listAttachments(query) {
                        guardRead();
                        if (query?.kind !== 'attachments' || query.uid !== uid) throw Error('QUERY_INVALID');
                        return rows(query.documentId);
                    },
                    create(ref, value) {
                        wrote = true;
                        if (current(ref).exists) throw Error('ALREADY_EXISTS');
                        staged.set(ref, structuredClone(value));
                    },
                    update(ref, patch) {
                        wrote = true;
                        if (!current(ref).exists) throw Error('NOT_FOUND');
                        staged.set(ref, {...current(ref).data(), ...structuredClone(patch)});
                    },
                    delete(ref) {
                        wrote = true;
                        if (!current(ref).exists) throw Error('NOT_FOUND');
                        staged.delete(ref); removed.add(ref);
                    }
                })).then(result => {
                    for (const ref of removed) records.delete(ref);
                    for (const [ref, value] of staged) records.set(ref, value);
                    return result;
                });
            };
            const next = chain.then(execute, execute);
            chain = next.then(() => {}, () => {});
            return next;
        }
    };
    const storage = {
        async probe(path) {
            calls.probe++;
            if (failures.probe) throw Error('PROBE_FAILED');
            const object = objects.get(path);
            return object ? {exists: true, digest: object.digest, size: object.bytes.byteLength} : {exists: false};
        },
        async putIfAbsent(path, bytes, options) {
            calls.write++;
            if (failures.write) throw Error('WRITE_FAILED');
            if (objects.has(path)) return 'exists';
            const copy = Uint8Array.from(bytes);
            objects.set(path, {bytes: copy, digest: hash(Buffer.from(copy)), metadata: options?.metadata});
            return 'created';
        },
        async remove(path) {
            calls.remove++;
            if (failures.remove) throw Error('REMOVE_FAILED');
            objects.delete(path);
        }
    };
    return {records, objects, calls, failures, transactions: () => transactions,
        failAt: offset => {failures.throwOn = [transactions + offset];},
        seedObject: (path, bytes) => {const copy = Uint8Array.from(bytes); objects.set(path, {bytes: copy, digest: hash(Buffer.from(copy))});},
        handler: createProfileDocumentAttachmentHandler({db, storage, hash, timestamp: () => 123})};
}
test('the transactional fake itself refuses read-after-write, so the ordering guarantee is real', async () => {
    const db = {doc: path => path, async get() {return {exists: false, data: () => undefined};}, async list() {return [];},
        attachmentsFor: () => ({}),
        runTransaction(run) {
            let wrote = false;
            return Promise.resolve(run({
                async get() {if (wrote) throw Error('READ_AFTER_WRITE'); return {exists: false, data: () => undefined};},
                async listAttachments() {if (wrote) throw Error('READ_AFTER_WRITE'); return [];},
                create() {wrote = true;}, update() {wrote = true;}, delete() {wrote = true;}
            }));
        }};
    await assert.rejects(db.runTransaction(async transaction => {
        transaction.create('users/owner', {});
        await transaction.get('users/owner');
    }), /READ_AFTER_WRITE/);
    // Every test below runs against the same guard, so a read-after-write in the
    // service cannot hide behind a permissive mock.
    assert.equal(typeof createProfileDocumentAttachmentHandler, 'function');
});
test('an upload reserves, stores and finalizes with an idempotent receipt', async () => {
    const f = fixture(), input = await uploadInput();
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId});
    const record = f.records.get(recordPath), receipt = f.records.get(receiptPath('upload-1'));
    assert.equal(record.status, 'ready'); assert.equal(record.ownerId, uid); assert.equal(record.documentId, documentId);
    assert.equal(record.digest, input.command.digest); assert.equal(record.size, 4); assert.equal(record.createdAt, 123);
    assert.deepEqual(Object.keys(record).sort(), ['createdAt', 'digest', 'documentId', 'envelope', 'mimeType', 'ownerId',
        'schemaVersion', 'size', 'status', 'storagePath']);
    assert.equal(receipt.status, 'ready'); assert.equal(receipt.digest, input.digest); assert.equal(receipt.operationId, 'upload-1');
    assert.equal(f.objects.size, 1);
    assert.deepEqual(f.objects.get(storagePath).metadata, {encrypted: 'v1'});
    assert.equal(f.objects.get(storagePath).digest, input.command.digest);
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId});
    assert.equal(f.calls.write, 1, 'a confirmed retry never rewrites the object');
    assert.equal(f.objects.size, 1);
});
test('the upload refuses forged, foreign, untrusted and tampered input without writing anything', async () => {
    const f = fixture(), input = await uploadInput();
    const tampered = {...input, payload: Uint8Array.from([9, 9, 9, 9])};
    for (const [payload, trustedContext, pattern] of [
        [{...input, digest: hash('other')}, trusted, /DOCUMENT_ATTACHMENT_INVALID/],
        [tampered, trusted, /ATTACHMENT_PAYLOAD_MISMATCH/],
        [{...input, payload: new Uint8Array(0)}, trusted, /DOCUMENT_ATTACHMENT_INVALID|ATTACHMENT_PAYLOAD_MISMATCH/],
        [{...input, command: {...input.command, storagePath: 'users/other/profile-documents/document-1/attachments/attachment-1'}}, trusted, /DOCUMENT_ATTACHMENT_INVALID/],
        [{...input, command: {...input.command, ownerId: 'other'}}, trusted, /DOCUMENT_ATTACHMENT_INVALID/],
        [input, {}, /UNAUTHENTICATED/], [input, {auth: {uid}}, /APP_CHECK_REQUIRED/],
        [input, {auth: {uid: '../owner'}, app: {appId: 'x'}}, /UNAUTHENTICATED/]]) {
        await assert.rejects(f.handler.upload(payload, trustedContext), pattern);
    }
    assert.equal(f.records.size, 1, 'only the seeded profile remains');
    assert.equal(f.objects.size, 0); assert.equal(f.calls.write, 0);
});
test('an upload is refused when the document is not uniquely persisted or is duplicated', async () => {
    for (const [documents, code] of [[[], DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_NOT_PERSISTED],
        [[documentId, documentId], DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_AMBIGUOUS],
        [['document-other'], DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_NOT_PERSISTED]]) {
        const f = fixture({documents}), input = await uploadInput();
        await assert.rejects(f.handler.upload(input, trusted), new RegExp(code));
        assert.equal(f.objects.size, 0); assert.equal(f.calls.write, 0);
        assert.equal(f.records.has(recordPath), false);
        assert.equal(f.records.has(receiptPath('upload-1')), false, 'no receipt survives a refused reservation');
    }
});
test('the eleventh image is refused and two concurrent uploads cannot exceed the limit', async () => {
    const full = fixture({seeded: attachments(DOCUMENT_IMAGE_MAX_PER_DOCUMENT)});
    const extra = await uploadInput({attachment: 'attachment-extra'});
    await assert.rejects(full.handler.upload(extra, trusted), /ATTACHMENT_LIMIT_REACHED/);
    assert.equal(full.records.has(documentAttachmentRecordPath({uid, attachmentId: 'attachment-extra'})), false);
    assert.equal(full.objects.size, 0);

    const f = fixture({seeded: attachments(DOCUMENT_IMAGE_MAX_PER_DOCUMENT - 1)});
    const [first, second] = await Promise.all([uploadInput({operationId: 'race-a', attachment: 'attachment-race-a'}),
        uploadInput({operationId: 'race-b', attachment: 'attachment-race-b'})]);
    const results = await Promise.allSettled([f.handler.upload(first, trusted), f.handler.upload(second, trusted)]);
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'exactly one upload takes the last slot');
    const bound = [...f.records.entries()].filter(([key, record]) =>
        key.startsWith(`users/${uid}/profileDocumentAttachments/`) && record.documentId === documentId).length;
    assert.equal(bound, DOCUMENT_IMAGE_MAX_PER_DOCUMENT);
    const third = await uploadInput({operationId: 'after-race', attachment: 'attachment-after'});
    await assert.rejects(f.handler.upload(third, trusted), /ATTACHMENT_LIMIT_REACHED/);
});
test('the same operation cannot be reused for a different attachment', async () => {
    const f = fixture();
    await f.handler.upload(await uploadInput(), trusted);
    const before = f.records.size;
    await assert.rejects(f.handler.upload(await uploadInput({attachment: 'attachment-2'}), trusted), /OPERATION_CONFLICT/);
    assert.equal(f.records.size, before, 'the conflicting request added no record');
    assert.equal(f.objects.size, 1);
});
test('an object that already exists with different bytes is never overwritten', async () => {
    const f = fixture(), input = await uploadInput();
    f.seedObject(storagePath, new Uint8Array([7, 7, 7]));
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'incomplete', code: 'OBJECT_CONFLICT', attachmentId});
    assert.equal(f.calls.write, 0, 'nothing is written over the foreign object');
    assert.equal(f.objects.get(storagePath).digest, hash(Uint8Array.from([7, 7, 7])));
    assert.equal(f.records.get(recordPath).status, 'reserved');
    assert.equal(f.records.get(receiptPath('upload-1')).status, 'reserved');
});
test('a failed object write leaves no trace and the same operation can be retried', async () => {
    const f = fixture(), input = await uploadInput();
    f.failures.write = true;
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'compensated', code: 'OBJECT_WRITE_FAILED', attachmentId});
    assert.equal(f.records.has(recordPath), false); assert.equal(f.records.has(receiptPath('upload-1')), false);
    assert.equal(f.objects.size, 0);
    f.failures.write = false;
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId});
    assert.equal(f.objects.size, 1);
});
test('a deferred finalize is reported as incomplete and completed by recover', async () => {
    const f = fixture(), input = await uploadInput();
    f.failAt(2);
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'incomplete', code: 'FINALIZE_FAILED', attachmentId});
    assert.equal(f.records.get(recordPath).status, 'reserved');
    assert.equal(f.records.get(receiptPath('upload-1')).status, 'reserved');
    assert.equal(f.objects.size, 1);
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 1, compensated: 0, incomplete: 0});
    assert.equal(f.records.get(recordPath).status, 'ready');
    assert.equal(f.records.get(receiptPath('upload-1')).status, 'ready');
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 0, compensated: 0, incomplete: 0});
});
test('an object without its metadata is compensated only because its digest proves ownership', async () => {
    const f = fixture(), input = await uploadInput();
    f.failAt(2);
    await f.handler.upload(input, trusted);
    f.records.delete(recordPath);
    assert.deepEqual(await f.handler.upload(input, trusted), {status: 'compensated', code: 'METADATA_MISSING', attachmentId});
    assert.equal(f.objects.size, 0); assert.equal(f.records.has(receiptPath('upload-1')), false);
});
test('recover compensates a reservation whose object never arrived', async () => {
    const f = fixture(), input = await uploadInput();
    f.failAt(2);
    await f.handler.upload(input, trusted);
    f.objects.clear();
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 0, compensated: 1, incomplete: 0});
    assert.equal(f.records.has(recordPath), false); assert.equal(f.records.has(receiptPath('upload-1')), false);
});
test('recover never promotes or deletes an object that is not proven ours', async () => {
    const f = fixture(), input = await uploadInput();
    f.failAt(2);
    await f.handler.upload(input, trusted);
    f.seedObject(storagePath, new Uint8Array([5, 5, 5]));
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 0, compensated: 0, incomplete: 1});
    assert.equal(f.records.get(recordPath).status, 'reserved', 'no promotion without a matching digest');
    assert.equal(f.objects.size, 1, 'the unproven object is left untouched');
    assert.equal(f.calls.remove, 0);
});
test('recover ignores malformed receipts and never touches storage for them', async () => {
    const f = fixture();
    f.records.set(receiptPath('broken'), {kind: 'profile-document-attachment', ownerId: uid, status: 'reserved',
        documentId, attachmentId: '../escape', storagePath: 'users/owner/elsewhere', digest: hash('x'), operationId: 'broken'});
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 0, compensated: 0, incomplete: 1});
    assert.equal(f.calls.remove, 0); assert.equal(f.calls.probe, 0);
    assert.equal(f.records.has(receiptPath('broken')), true);
});
test('a deletion validates the whole record, not only its digest', async () => {
    const path = fixture();
    await path.handler.upload(await uploadInput(), trusted);
    const input = await deleteInput({...path.records.get(recordPath), id: attachmentId});
    path.records.get(recordPath).storagePath = documentImageStoragePath({uid, documentId, attachmentId: 'attachment-other'});
    await assert.rejects(path.handler.remove(input, trusted), /DOCUMENT_ATTACHMENT_INVALID|DOCUMENT_ATTACHMENT_CONFLICT/);
    assert.equal(path.objects.size, 1, 'the object survives a refused deletion');

    const document = fixture();
    await document.handler.upload(await uploadInput(), trusted);
    const other = await deleteInput({...document.records.get(recordPath), id: attachmentId});
    document.records.get(recordPath).documentId = 'document-2';
    await assert.rejects(document.handler.remove(other, trusted), /DOCUMENT_ATTACHMENT_INVALID|DOCUMENT_ATTACHMENT_CONFLICT/);

    const foreign = fixture();
    await foreign.handler.upload(await uploadInput(), trusted);
    const forged = await deleteInput({...foreign.records.get(recordPath), id: attachmentId});
    foreign.records.get(recordPath).ownerId = 'other';
    await assert.rejects(foreign.handler.remove(forged, trusted), /DOCUMENT_ATTACHMENT_INVALID|DOCUMENT_ATTACHMENT_CONFLICT/);
    assert.equal(foreign.objects.size, 1);
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
test('a deletion refuses a missing record, a changed digest and a forged command', async () => {
    const missing = fixture();
    await missing.handler.upload(await uploadInput(), trusted);
    const missingInput = await deleteInput({...missing.records.get(recordPath), id: attachmentId}, {operationId: 'delete-missing'});
    missing.records.delete(recordPath);
    await assert.rejects(missing.handler.remove(missingInput, trusted), /DOCUMENT_ATTACHMENT_MISSING/);
    assert.equal(missing.objects.size, 1);

    const changed = fixture();
    await changed.handler.upload(await uploadInput(), trusted);
    const changedInput = await deleteInput({...changed.records.get(recordPath), id: attachmentId}, {operationId: 'delete-changed'});
    changed.records.get(recordPath).digest = hash('tampered');
    await assert.rejects(changed.handler.remove(changedInput, trusted), /DOCUMENT_ATTACHMENT_CONFLICT/);
    assert.equal(changed.records.has(receiptPath('delete-changed')), false);

    const forged = fixture();
    await forged.handler.upload(await uploadInput(), trusted);
    const input = await deleteInput({...forged.records.get(recordPath), id: attachmentId}, {operationId: 'delete-forged'});
    for (const bad of [{...input, digest: hash('other')},
        {...input, command: {...input.command, expectedDigest: hash('other')}},
        {...input, command: {...input.command, documentId: 'document-2', recordPath: documentAttachmentRecordPath({uid, attachmentId})}}]) {
        await assert.rejects(forged.handler.remove(bad, trusted), /DOCUMENT_ATTACHMENT_INVALID|DOCUMENT_ATTACHMENT_CONFLICT/);
    }
    assert.equal(forged.objects.size, 1);
});
test('a deletion whose object carries different bytes stays pending', async () => {
    const f = fixture();
    await f.handler.upload(await uploadInput(), trusted);
    const input = await deleteInput({...f.records.get(recordPath), id: attachmentId});
    f.seedObject(storagePath, new Uint8Array([4, 4, 4]));
    assert.deepEqual(await f.handler.remove(input, trusted), {status: 'incomplete', code: 'OBJECT_CONFLICT', attachmentId});
    assert.equal(f.objects.size, 1, 'an object that is not the recorded one is never deleted');
    assert.equal(f.records.get(recordPath).status, 'deleting');
});
test('a deferred object removal is completed by recover', async () => {
    const f = fixture();
    await f.handler.upload(await uploadInput(), trusted);
    const input = await deleteInput({...f.records.get(recordPath), id: attachmentId});
    f.failures.remove = true;
    assert.deepEqual(await f.handler.remove(input, trusted), {status: 'incomplete', code: 'OBJECT_REMOVE_FAILED', attachmentId});
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
    assert.equal(f.objects.size, 0);
    assert.deepEqual(await f.handler.recover(trusted), {status: 'recovered', confirmed: 1, compensated: 0, incomplete: 0});
    assert.equal(f.records.has(recordPath), false);
});
