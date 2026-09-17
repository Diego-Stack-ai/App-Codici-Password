import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {DOCUMENT_IMAGE_MAX_BYTES, DOCUMENT_IMAGE_MAX_PER_DOCUMENT, DOCUMENT_ATTACHMENT_REFUSALS, DOCUMENT_ATTACHMENT_STORAGE_METADATA,
    documentAttachmentAad, documentAttachmentEnvelope, documentAttachmentIdFromPath, documentAttachmentIdentity,
    documentAttachmentMetadata, documentAttachmentSize, documentImageStoragePath}
    from './profile-document-attachments-contract.mjs';
import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {createDocumentAttachmentId, documentAttachmentCommandDigestInput, planProfileDocumentAttachmentDelete,
    planProfileDocumentAttachmentUpload, validateDocumentAttachmentDeleteCommand, validateDocumentAttachmentUploadCommand}
    from './prepare-profile-document-attachment.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const b64 = (bytes, fill) => Buffer.alloc(bytes, fill).toString('base64');
const envelope = (overrides = {}) => ({type: 'profile-document-attachment-envelope', version: 1, cipher: 'AES-GCM-256',
    keyWrap: 'HKDF-SHA256+A256GCM', contentIv: b64(12, 7), wrapSalt: b64(32, 9), wrapIv: b64(12, 11),
    wrappedFileKey: b64(48, 13), ...overrides});
const uid = 'owner';
const documentId = 'document-1';
const attachmentId = 'attachment-1';
const storagePath = documentImageStoragePath({uid, documentId, attachmentId});
const metadata = (overrides = {}) => ({ownerId: uid, documentId, storagePath, mimeType: 'image/jpeg', size: 2048,
    digest: hash('payload'), envelope: envelope(), status: 'ready', schemaVersion: 1, ...overrides});
const documents = () => [{id: 'document-1', type: 'Patente'}, {id: 'document-2', type: 'Passaporto'}];
function capabilityFixture({seal} = {}) {
    const abort = new AbortController(), state = {uid: 'owner', locked: false, sealed: []};
    const context = {user: {uid}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');}};
    const sealer = seal ?? (async ({bytes, aad}) => {
        state.sealed.push({size: bytes.byteLength, aad});
        return {payload: new Uint8Array([...bytes].map(byte => byte ^ 0x5a)), envelope: envelope()};
    });
    return {state, abort, context,
        capability: createProfileDocumentAttachmentCapability({context, getUser: () => ({uid: state.uid}), seal: sealer})};
}
function planFixture(options = {}) {
    const f = capabilityFixture();
    f.state.online = true;
    f.state.attachments = options.attachments ?? [];
    f.state.documents = options.documents ?? documents();
    return {...f,
        upload: (overrides = {}) => planProfileDocumentAttachmentUpload({context: f.context, getUser: () => ({uid: f.state.uid}),
            capability: f.capability, documents: f.state.documents, attachments: f.state.attachments, documentId,
            bytes: new Uint8Array([1, 2, 3, 4]), mimeType: 'image/jpeg', operationId: 'operation', hash,
            createAttachmentId: () => attachmentId, isOnline: () => f.state.online, ...overrides})};
}
test('limits, MIME allowlist and identifiers are the ones the increment fixed', () => {
    assert.equal(DOCUMENT_IMAGE_MAX_BYTES, 10 * 1024 * 1024);
    assert.equal(DOCUMENT_IMAGE_MAX_PER_DOCUMENT, 10);
    assert.equal(documentAttachmentSize(1), true);
    assert.equal(documentAttachmentSize(DOCUMENT_IMAGE_MAX_BYTES), true);
    assert.equal(documentAttachmentSize(DOCUMENT_IMAGE_MAX_BYTES + 1), false);
    assert.equal(documentAttachmentSize(0), false);
    assert.deepEqual(Object.keys(DOCUMENT_ATTACHMENT_STORAGE_METADATA), ['encrypted']);
});
test('the Storage path and the AAD are derived, and every component is bound', () => {
    assert.equal(storagePath, 'users/owner/profile-documents/document-1/attachments/attachment-1');
    const aad = documentAttachmentAad({uid, documentId, attachmentId, storagePath});
    assert.equal(aad, `CodiciPassword:profile-document-attachment:v1:${uid}:${documentId}:${attachmentId}:${storagePath}`);
    const variants = [
        documentAttachmentAad({uid: 'other', documentId, attachmentId, storagePath: documentImageStoragePath({uid: 'other', documentId, attachmentId})}),
        documentAttachmentAad({uid, documentId: 'document-2', attachmentId, storagePath: documentImageStoragePath({uid, documentId: 'document-2', attachmentId})}),
        documentAttachmentAad({uid, documentId, attachmentId: 'attachment-2', storagePath: documentImageStoragePath({uid, documentId, attachmentId: 'attachment-2'})})
    ];
    assert.equal(new Set([aad, ...variants]).size, 4, 'owner, document and attachment all change the AAD');
    assert.ok(aad.endsWith(`:${storagePath}`), 'the Storage path is part of the bound AAD');
    assert.throws(() => documentAttachmentAad({uid, documentId, attachmentId, storagePath: 'users/other/profile-documents/document-1/attachments/attachment-1'}),
        /DOCUMENT_ATTACHMENT_INVALID/);
});
test('path injection and foreign paths are refused instead of repaired', () => {
    for (const bad of ['document-1/../document-2', '../document-1', 'document-1/attachment-1', 'document:1', '', 'document 1']) {
        assert.throws(() => documentImageStoragePath({uid, documentId: bad, attachmentId}), /DOCUMENT_ATTACHMENT_INVALID/);
    }
    for (const path of ['users/other/profile-documents/document-1/attachments/attachment-1',
        'users/owner/profile-documents/document-2/attachments/attachment-1',
        'users/owner/profile-documents/document-1/attachments/../attachment-1',
        'users/owner/profile-documents/document-1/attachments/attachment-1/extra']) {
        assert.throws(() => documentAttachmentIdFromPath({uid, documentId, storagePath: path}), /DOCUMENT_ATTACHMENT_INVALID/);
    }
    assert.equal(documentAttachmentIdFromPath({uid, documentId, storagePath}), attachmentId);
});
test('metadata accepts only the allowlist, the derived path and the transport id', () => {
    const validated = documentAttachmentMetadata(metadata(), {uid});
    assert.equal(validated.attachmentId, attachmentId); assert.equal(validated.storagePath, storagePath);
    assert.equal(documentAttachmentMetadata({...metadata(), id: attachmentId}, {uid}).attachmentId, attachmentId);
    for (const bad of [
        {...metadata(), originalName: 'patente.jpg'},
        {...metadata(), url: 'https://example.invalid/secret'},
        {...metadata(), bytes: [1, 2, 3]},
        {...metadata(), id: 'attachment-other'},
        {...metadata(), ownerId: 'other'},
        {...metadata(), storagePath: 'users/other/profile-documents/document-1/attachments/attachment-1'},
        {...metadata(), mimeType: 'image/gif'},
        {...metadata(), size: DOCUMENT_IMAGE_MAX_BYTES + 1},
        {...metadata(), digest: 'short'},
        {...metadata(), status: 'committed'},
        {...metadata(), schemaVersion: 2},
        {...metadata(), envelope: {...envelope(), version: 2}},
        {...metadata(), envelope: {...envelope(), fileKey: b64(32, 1)}},
        {...metadata(), envelope: {...envelope(), contentIv: b64(16, 7)}},
        {...metadata(), envelope: {...envelope(), wrappedFileKey: b64(16, 3)}}
    ]) assert.throws(() => documentAttachmentMetadata(bad, {uid}), /DOCUMENT_ATTACHMENT_INVALID/);
});
test('a document without a unique persisted id can never receive images', () => {
    assert.deepEqual(documentAttachmentIdentity(documents(), documentId), {allowed: true, document: {id: documentId}});
    assert.equal(documentAttachmentIdentity([{type: 'Patente'}], documentId).code, DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_MISSING);
    assert.equal(documentAttachmentIdentity([{id: documentId}, {id: documentId}], documentId).code, DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_AMBIGUOUS);
    assert.equal(documentAttachmentIdentity(documents(), '').code, DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_INVALID);
    assert.equal(documentAttachmentIdentity([{id: 'document-1/../x'}], 'document-1/../x').code, DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_INVALID);
});
test('the capability seals with the contextual AAD, clears the plaintext and never exposes a key', async () => {
    const f = capabilityFixture();
    const bytes = new Uint8Array([9, 8, 7, 6]);
    const sealed = await f.capability.sealImage({bytes, documentId, attachmentId});
    assert.equal(sealed.storagePath, storagePath);
    assert.equal(sealed.aad, documentAttachmentAad({uid, documentId, attachmentId, storagePath}));
    assert.equal(sealed.size, 4);
    assert.deepEqual([...bytes], [0, 0, 0, 0], 'the plaintext buffer does not survive the boundary');
    assert.equal(sealed.digest, createHash('sha256').update(sealed.payload).digest('hex'), 'the digest covers the stored bytes');
    assert.ok(sealed.payload instanceof Uint8Array);
    assert.deepEqual(Object.keys(sealed).sort(), ['aad', 'digest', 'envelope', 'payload', 'size', 'storagePath']);
    for (const field of Object.keys(sealed.envelope)) {
        assert.ok(!['fileKey', 'key', 'rawKey', 'plaintext', 'originalName', 'url'].includes(field), field);
    }
    assert.equal(sealed.envelope.wrappedFileKey.length, 64, 'the file key travels wrapped only');
    f.capability.dispose();
});
test('the capability clears the plaintext even when sealing fails and refuses foreign input', async () => {
    const failing = capabilityFixture({seal: async () => {throw Error('SEAL_FAILED');}});
    const bytes = new Uint8Array([1, 2, 3]);
    await assert.rejects(failing.capability.sealImage({bytes, documentId, attachmentId}), /SEAL_FAILED/);
    assert.deepEqual([...bytes], [0, 0, 0], 'a failing seal still clears the plaintext');
    const f = capabilityFixture();
    await assert.rejects(f.capability.sealImage({bytes: new Uint8Array(0), documentId, attachmentId}), /DOCUMENT_IMAGE_NOT_ALLOWED/);
    await assert.rejects(f.capability.sealImage({bytes: 'not-bytes', documentId, attachmentId}), /DOCUMENT_IMAGE_NOT_ALLOWED/);
    await assert.rejects(f.capability.sealImage({bytes: new ArrayBuffer(4), documentId, attachmentId}), /DOCUMENT_IMAGE_NOT_ALLOWED/);
    await assert.rejects(f.capability.sealImage({bytes: new Uint8Array([1]), documentId: '../x', attachmentId}), /DOCUMENT_ATTACHMENT_INVALID/);
    f.capability.dispose();
});
for (const boundary of ['uid', 'locked', 'abort']) test(`the capability is revoked after ${boundary}`, async () => {
    const f = capabilityFixture();
    if (boundary === 'abort') f.abort.abort(); else f.state[boundary] = boundary === 'uid' ? 'other' : true;
    await assert.rejects(f.capability.sealImage({bytes: new Uint8Array([1]), documentId, attachmentId}), /VIEW_DISPOSED|LOCKED/);
    assert.equal(f.state.sealed.length, 0, 'nothing is sealed after revocation');
    f.capability.dispose();
});
test('the upload plan is immutable, carries no byte and mints the attachment identity', async () => {
    const f = planFixture(), planned = await f.upload();
    assert.equal(planned.status, 'prepared');
    const {command, digest, payload} = planned;
    assert.ok(Object.isFrozen(command));
    assert.equal(command.attachmentId, attachmentId);
    assert.equal(command.recordPath, `users/owner/profileDocumentAttachments/${attachmentId}`);
    assert.equal(command.storagePath, storagePath);
    assert.equal(command.status, 'reserved');
    assert.equal(command.digest, createHash('sha256').update(payload).digest('hex'));
    assert.equal(digest, hash(documentAttachmentCommandDigestInput(command)));
    assert.ok(payload.byteLength > 0, 'the ciphertext payload travels outside the command');
    const serialized = JSON.stringify(command);
    assert.doesNotMatch(serialized, /patente|\.jpg|payload|plaintext|"url"|originalName/i);
    assert.doesNotMatch(serialized, /[0-9]+,[0-9]+,[0-9]+,[0-9]+/, 'no byte array is embedded in the command');
    assert.deepEqual(validateDocumentAttachmentUploadCommand(command), command);
    f.capability.dispose();
});
test('the upload plan refuses offline, unstable documents, wrong type or size and the eleventh image', async () => {
    const cases = [
        [{isOnline: () => false}, DOCUMENT_ATTACHMENT_REFUSALS.OFFLINE_NOT_ALLOWED],
        [{documents: [{type: 'Patente'}]}, DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_MISSING],
        [{documents: [{id: documentId}, {id: documentId}]}, DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_AMBIGUOUS],
        [{mimeType: 'image/gif'}, DOCUMENT_ATTACHMENT_REFUSALS.MIME_NOT_ALLOWED],
        [{mimeType: 'application/pdf'}, DOCUMENT_ATTACHMENT_REFUSALS.MIME_NOT_ALLOWED],
        [{mimeType: 'image/jpg'}, DOCUMENT_ATTACHMENT_REFUSALS.MIME_NOT_ALLOWED],
        [{bytes: new Uint8Array(0)}, DOCUMENT_ATTACHMENT_REFUSALS.SIZE_NOT_ALLOWED],
        [{bytes: 'not-bytes'}, DOCUMENT_ATTACHMENT_REFUSALS.SIZE_NOT_ALLOWED],
        [{attachments: Array.from({length: DOCUMENT_IMAGE_MAX_PER_DOCUMENT}, (unused, index) =>
            ({...metadata(), id: `attachment-${index}`, storagePath: documentImageStoragePath({uid, documentId, attachmentId: `attachment-${index}`})}))},
            DOCUMENT_ATTACHMENT_REFUSALS.ATTACHMENT_LIMIT_REACHED],
        [{attachments: [{...metadata(), id: attachmentId}]}, DOCUMENT_ATTACHMENT_REFUSALS.ATTACHMENT_EXISTS]
    ];
    for (const [overrides, code] of cases) {
        const f = planFixture();
        const planned = await f.upload(overrides);
        assert.equal(planned.status, 'refused', code);
        assert.equal(planned.code, code);
        assert.equal(f.state.sealed.length, 0, `${code}: nothing is sealed`);
        f.capability.dispose();
    }
    const f = planFixture();
    await assert.rejects(planProfileDocumentAttachmentUpload({context: f.context, getUser: () => ({uid}),
        capability: f.capability, documents: documents(), attachments: [], documentId, bytes: new Uint8Array([1]),
        mimeType: 'image/png', operationId: 'operation', hash, createAttachmentId: () => 'document-1'}), /ATTACHMENT_ID_INVALID/);
    f.capability.dispose();
    assert.equal(createDocumentAttachmentId('attachment-fixed'), 'attachment-fixed');
    assert.match(createDocumentAttachmentId(), /^attachment-[0-9a-f-]{36}$/);
    assert.throws(() => createDocumentAttachmentId('fixed'), /ATTACHMENT_ID_INVALID/);
});
test('the delete plan validates the record before any command exists', async () => {
    const f = planFixture(), planned = await planProfileDocumentAttachmentDelete({context: f.context, getUser: () => ({uid}),
        documents: documents(), attachment: {...metadata(), id: attachmentId}, operationId: 'delete-operation', hash});
    assert.equal(planned.status, 'prepared');
    const {command, digest} = planned;
    assert.ok(Object.isFrozen(command));
    assert.deepEqual(Object.keys(command).sort(), ['attachmentId', 'documentId', 'expectedDigest', 'kind', 'operationId',
        'ownerId', 'recordPath', 'schemaVersion', 'status', 'storagePath']);
    assert.equal(command.expectedDigest, hash('payload'));
    assert.equal(digest, hash(documentAttachmentCommandDigestInput(command)));
    assert.deepEqual(validateDocumentAttachmentDeleteCommand(command), command);
    assert.equal(planned.payload, null);
    for (const attachment of [{...metadata(), ownerId: 'other'}, {...metadata(), storagePath: 'users/other/x'},
        {...metadata(), url: 'https://example.invalid'}, {...metadata(), digest: 'short'}]) {
        await assert.rejects(planProfileDocumentAttachmentDelete({context: f.context, getUser: () => ({uid}),
            documents: documents(), attachment, operationId: 'delete-operation', hash}), /DOCUMENT_ATTACHMENT_INVALID/);
    }
    const unstable = await planProfileDocumentAttachmentDelete({context: f.context, getUser: () => ({uid}),
        documents: [{id: documentId}, {id: documentId}], attachment: metadata(), operationId: 'delete-operation', hash});
    assert.equal(unstable.status, 'refused');
    assert.equal(unstable.code, DOCUMENT_ATTACHMENT_REFUSALS.DOCUMENT_ID_AMBIGUOUS);
    f.capability.dispose();
});
test('commands are re-validated where they are consumed', async () => {
    const f = planFixture(), {command} = await f.upload();
    for (const bad of [{...command, storagePath: 'users/other/profile-documents/document-1/attachments/attachment-1'},
        {...command, recordPath: 'users/owner/profileDocumentAttachments/other'},
        {...command, ownerId: 'other'},
        {...command, storageMetadata: {encrypted: 'v2'}},
        {...command, status: 'ready'},
        {...command, kind: 'profile-document-attachment-delete'},
        {...command, extra: true}]) {
        assert.throws(() => validateDocumentAttachmentUploadCommand(bad), /DOCUMENT_ATTACHMENT_INVALID/);
    }
    f.capability.dispose();
    assert.equal(documentAttachmentEnvelope(envelope()).version, 1);
});
