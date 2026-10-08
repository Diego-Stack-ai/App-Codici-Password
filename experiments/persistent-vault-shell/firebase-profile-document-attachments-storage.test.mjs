import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {sealDocumentImageBytes} from './profile-document-attachment-seal.mjs';
import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {createProfileDocumentAttachmentHandler} from './profile-document-attachments-handler.mjs';
import {createFirebaseDocumentAttachmentStorage, createFirestoreDocumentAttachmentDb}
    from './firebase-document-attachment-transport.mjs';
import {planProfileDocumentAttachmentDelete, planProfileDocumentAttachmentUpload}
    from './prepare-profile-document-attachment.mjs';
import {documentAttachmentReceiptPath, documentAttachmentRecordPath, documentAttachmentSha256,
    documentImageStoragePath} from './profile-document-attachments-contract.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
// The Admin SDK reads STORAGE_EMULATOR_HOST; the Firebase CLI exports the same
// endpoint as FIREBASE_STORAGE_EMULATOR_HOST.
process.env.STORAGE_EMULATOR_HOST ??= `http://${process.env.FIREBASE_STORAGE_EMULATOR_HOST}`;
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {getStorage} = require('firebase-admin/storage');

const hash = value => createHash('sha256').update(value).digest('hex');
const uid = 'storage-owner', documentId = 'document-1';
const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
const vaultKey = Uint8Array.from({length: 32}, (unused, index) => index + 1);
const clearBytes = () => Uint8Array.from([9, 8, 7, 6, 5]);
async function uploadInput({operationId = 'upload-1', attachment = 'attachment-1', bytes = clearBytes()} = {}) {
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
    const capability = createProfileDocumentAttachmentCapability({context, getUser: () => ({uid}),
        seal: ({bytes: plain, aad}) => sealDocumentImageBytes(vaultKey, {bytes: plain, aad})});
    try {
        return await planProfileDocumentAttachmentUpload({context, getUser: () => ({uid}), capability,
            documents: [{id: documentId}], attachments: [], documentId, bytes, mimeType: 'image/jpeg', operationId, hash,
            createAttachmentId: () => attachment});
    } finally {capability.dispose();}
}
async function deleteInput(record, {operationId = 'delete-1'} = {}) {
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
    return planProfileDocumentAttachmentDelete({context, getUser: () => ({uid}), documents: [{id: documentId}],
        attachment: record, operationId, hash});
}
test('document attachments: real Firestore and Firebase Storage transports', async t => {
    const app = initializeApp({projectId: 'demo-vault-shell', storageBucket: 'demo-vault-shell.appspot.com'},
        'document-attachments-storage-test');
    const db = getFirestore(app), bucket = getStorage(app).bucket('demo-vault-shell.appspot.com');
    t.after(async () => {await db.terminate(); await deleteApp(app);});
    const storage = createFirebaseDocumentAttachmentStorage({bucket, sha256: documentAttachmentSha256});
    const handler = createProfileDocumentAttachmentHandler({db: createFirestoreDocumentAttachmentDb(db), storage, hash,
        timestamp: () => FieldValue.serverTimestamp()});
    const path = `users/${uid}`;
    await db.doc(path).set({ownerId: uid, documenti: [{id: documentId, type: 'Patente'}]});

    await t.test('a sealed upload commits with the native preconditions and is idempotent', async () => {
        const input = await uploadInput(), storagePath = input.command.storagePath;
        assert.deepEqual(await handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId: 'attachment-1'});
        const record = (await db.doc(documentAttachmentRecordPath({uid, attachmentId: 'attachment-1'})).get()).data();
        assert.equal(record.status, 'ready');
        assert.equal(record.digest, input.command.digest);
        assert.equal(record.size, clearBytes().byteLength, 'the record keeps the original size');
        const receipt = (await db.doc(documentAttachmentReceiptPath({uid, operationId: 'upload-1'})).get()).data();
        assert.equal(receipt.status, 'ready');
        assert.equal(receipt.objectDigest, input.command.digest);
        assert.equal(receipt.objectSize, input.payload.byteLength, 'the receipt records the stored ciphertext size');
        const [metadata] = await bucket.file(storagePath).getMetadata();
        assert.equal(metadata.metadata.encrypted, 'v1');
        assert.equal(metadata.contentType, 'application/octet-stream');
        const probe = await storage.probe(storagePath);
        assert.equal(probe.digest, input.command.digest);
        assert.equal(probe.size, input.payload.byteLength);
        assert.equal(probe.size, clearBytes().byteLength + 16, 'AES-GCM adds its tag');
        assert.ok(probe.generation, 'the transport reports the native version');
        const [stored] = await bucket.file(storagePath).download();
        assert.deepEqual([...stored], [...input.payload], 'the stored object is the sealed payload');
        const again = await handler.upload(input, trusted);
        assert.deepEqual(again, {status: 'confirmed', state: 'ready', attachmentId: 'attachment-1'});
        const [after] = await bucket.file(storagePath).getMetadata();
        assert.equal(after.generation, metadata.generation, 'a confirmed retry never rewrites the object');
    });
    await t.test('an existing object is never overwritten: creation is conditional', async () => {
        const input = await uploadInput({operationId: 'upload-conflict', attachment: 'attachment-conflict'});
        const storagePath = input.command.storagePath;
        await bucket.file(storagePath).save(Buffer.from([1, 2, 3]), {resumable: false,
            metadata: {metadata: {encrypted: 'v1'}}, preconditionOpts: {ifGenerationMatch: 0}});
        assert.equal(await storage.putIfAbsent(storagePath, Uint8Array.from([9, 9, 9]), {metadata: {encrypted: 'v1'}}),
            'exists', 'the transport reports the existing object instead of writing');
        assert.deepEqual([...(await bucket.file(storagePath).download())[0]], [1, 2, 3], 'the foreign object is untouched');
        assert.deepEqual(await handler.upload(input, trusted), {status: 'incomplete', code: 'OBJECT_CONFLICT',
            attachmentId: 'attachment-conflict'});
        const [stored] = await bucket.file(storagePath).download();
        assert.deepEqual([...stored], [1, 2, 3], 'the foreign object is untouched');
        const [metadata] = await bucket.file(storagePath).getMetadata();
        assert.equal(metadata.metadata.encrypted, 'v1');
    });
    await t.test('the adapter refuses a stale version, and the emulator is proved not to enforce preconditions', async () => {
        const probePath = `users/${uid}/precondition-probe/object.bin`, object = bucket.file(probePath);
        await object.save(Buffer.from([1, 2, 3]), {resumable: false, preconditionOpts: {ifGenerationMatch: 0}});
        const [created] = await object.getMetadata();
        // Finding of this increment: the Storage emulator accepts a conditional
        // create over an existing object and a conditional delete of a stale
        // version, so the native preconditions are passed to Storage but cannot be
        // the only guard. The adapter therefore compares the version itself.
        await object.save(Buffer.from([4, 5, 6]), {resumable: false, preconditionOpts: {ifGenerationMatch: 0}});
        assert.notEqual((await object.getMetadata())[0].generation, created.generation,
            'the emulator ignores ifGenerationMatch: 0');
        let stale = null;
        try {await object.delete({ifGenerationMatch: Number(created.generation) + 1});} catch (error) {stale = error;}
        assert.equal(stale, null, 'the emulator ignores a stale ifGenerationMatch on delete');
        await object.save(Buffer.from([7, 8, 9]), {resumable: false});
        const verified = String((await object.getMetadata())[0].generation);
        let failure = null;
        try {await storage.remove(probePath, {generation: String(Number(verified) + 1)});} catch (error) {failure = error;}
        assert.equal(failure?.code, 'OBJECT_CHANGED', 'the adapter refuses the stale version');
        assert.equal((await object.exists())[0], true, 'a stale version deletes nothing');
        await storage.remove(probePath, {generation: verified});
        assert.equal((await object.exists())[0], false, 'the verified version is deleted');
    });
    await t.test('a deletion removes the record, the receipt and the exact object version', async () => {
        const record = (await db.doc(documentAttachmentRecordPath({uid, attachmentId: 'attachment-1'})).get()).data();
        const input = await deleteInput({...record, id: 'attachment-1'});
        const storagePath = input.command.storagePath;
        assert.deepEqual(await handler.remove(input, trusted), {status: 'confirmed', state: 'removed', attachmentId: 'attachment-1'});
        assert.equal((await db.doc(documentAttachmentRecordPath({uid, attachmentId: 'attachment-1'})).get()).exists, false);
        assert.equal((await db.doc(documentAttachmentReceiptPath({uid, operationId: 'delete-1'})).get()).data().status, 'removed');
        assert.equal((await bucket.file(storagePath).exists())[0], false, 'the object is gone from Storage');
        assert.deepEqual(await handler.remove(input, trusted), {status: 'confirmed', state: 'removed', attachmentId: 'attachment-1'});
    });
    await t.test('recover leaves a foreign object untouched and closes nothing', async () => {
        const bytes = Uint8Array.from([1, 2, 3, 4]), digest = hash(Buffer.from(bytes));
        const attachment = 'storage-pending', storagePath = documentImageStoragePath({uid, documentId, attachmentId: attachment});
        await db.doc(documentAttachmentRecordPath({uid, attachmentId: attachment})).set({ownerId: uid, documentId, storagePath,
            mimeType: 'image/jpeg', size: 4, digest, envelope: {type: 'profile-document-attachment-envelope', version: 1,
                cipher: 'AES-GCM-256', keyWrap: 'HKDF-SHA256+A256GCM', contentIv: Buffer.alloc(12, 1).toString('base64'),
                wrapSalt: Buffer.alloc(32, 2).toString('base64'), wrapIv: Buffer.alloc(12, 3).toString('base64'),
                wrappedFileKey: Buffer.alloc(48, 4).toString('base64')}, status: 'reserved', schemaVersion: 1,
            createdAt: FieldValue.serverTimestamp()});
        await db.doc(documentAttachmentReceiptPath({uid, operationId: attachment})).set({kind: 'profile-document-attachment',
            ownerId: uid, operationId: attachment, documentId, attachmentId: attachment, storagePath,
            digest: hash('operation-storage-pending'), objectDigest: digest, objectSize: 4, status: 'reserved',
            createdAt: FieldValue.serverTimestamp()});
        await bucket.file(storagePath).save(Buffer.from([7, 7, 7]), {resumable: false, preconditionOpts: {ifGenerationMatch: 0}});
        const recovered = await handler.recover(trusted);
        assert.ok(recovered.incomplete >= 1);
        assert.equal((await db.doc(documentAttachmentRecordPath({uid, attachmentId: attachment})).get()).data().status, 'reserved');
        const [stored] = await bucket.file(storagePath).download();
        assert.deepEqual([...stored], [7, 7, 7], 'an object that is not ours is never deleted');
    });
    await t.test('a real sealed upload of the tenth slot reuses the atomic limit', async () => {
        const existing = await db.collection(`users/${uid}/profileDocumentAttachments`).get();
        for (const entry of existing.docs) await entry.ref.delete();
        const seeds = Array.from({length: 9}, (unused, index) => `attachment-seed-${index}`);
        for (const attachment of seeds) {
            await db.doc(documentAttachmentRecordPath({uid, attachmentId: attachment})).set({ownerId: uid, documentId,
                storagePath: documentImageStoragePath({uid, documentId, attachmentId: attachment}), mimeType: 'image/jpeg',
                size: 4, digest: hash(`payload-${attachment}`), envelope: {type: 'profile-document-attachment-envelope',
                    version: 1, cipher: 'AES-GCM-256', keyWrap: 'HKDF-SHA256+A256GCM',
                    contentIv: Buffer.alloc(12, 1).toString('base64'), wrapSalt: Buffer.alloc(32, 2).toString('base64'),
                    wrapIv: Buffer.alloc(12, 3).toString('base64'), wrappedFileKey: Buffer.alloc(48, 4).toString('base64')},
                status: 'ready', schemaVersion: 1, createdAt: FieldValue.serverTimestamp()});
        }
        const [first, second] = await Promise.all([
            uploadInput({operationId: 'storage-race-a', attachment: 'attachment-race-a'}),
            uploadInput({operationId: 'storage-race-b', attachment: 'attachment-race-b'})]);
        const results = await Promise.allSettled([handler.upload(first, trusted), handler.upload(second, trusted)]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'only one upload takes the last slot');
        await assert.rejects(handler.upload(await uploadInput({operationId: 'storage-after', attachment: 'attachment-after'}),
            trusted), /ATTACHMENT_LIMIT_REACHED/);
    });
});
