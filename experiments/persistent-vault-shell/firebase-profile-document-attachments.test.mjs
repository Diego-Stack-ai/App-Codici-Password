import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {DOCUMENT_IMAGE_MAX_PER_DOCUMENT, documentAttachmentReceiptPath, documentAttachmentRecordPath,
    documentImageStoragePath} from './profile-document-attachments-contract.mjs';
import {createProfileDocumentAttachmentHandler} from './profile-document-attachments-handler.mjs';
import {planProfileDocumentAttachmentDelete, planProfileDocumentAttachmentUpload}
    from './prepare-profile-document-attachment.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');

const hash = value => createHash('sha256').update(value).digest('hex');
const b64 = (bytes, fill) => Buffer.alloc(bytes, fill).toString('base64');
const envelope = () => ({type: 'profile-document-attachment-envelope', version: 1, cipher: 'AES-GCM-256',
    keyWrap: 'HKDF-SHA256+A256GCM', contentIv: b64(12, 7), wrapSalt: b64(32, 9), wrapIv: b64(12, 11), wrappedFileKey: b64(48, 13)});
const uid = 'attachments-owner', documentId = 'document-1';
const trusted = {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}};
// Real Firestore transactions: Firestore itself rejects a read performed after a
// write, so this suite proves the ordering the unit fake only simulates. Storage
// stays an in-memory double because the suite runs --only auth,firestore.
function adapters(db, objects) {
    return {db: {
        doc: path => db.doc(path),
        async get(ref) {const snapshot = await ref.get(); return {exists: snapshot.exists, data: () => snapshot.data()};},
        async list(path) {
            const snapshot = await db.collection(path).get();
            return snapshot.docs.map(entry => ({...entry.data(), id: entry.id}));
        },
        attachmentsFor({uid: owner, documentId: document}) {
            return db.collection(`users/${owner}/profileDocumentAttachments`)
                .where('documentId', '==', document).limit(DOCUMENT_IMAGE_MAX_PER_DOCUMENT + 1);
        },
        runTransaction(run) {
            return db.runTransaction(async transaction => run({
                async get(ref) {
                    const snapshot = await transaction.get(ref);
                    return {exists: snapshot.exists, data: () => snapshot.data()};
                },
                async listAttachments(query) {
                    const snapshot = await transaction.get(query);
                    return snapshot.docs.map(entry => ({...entry.data(), id: entry.id}));
                },
                create: (ref, value) => transaction.create(ref, value),
                update: (ref, patch) => transaction.update(ref, patch),
                delete: ref => transaction.delete(ref)
            }));
        }
    }, storage: {
        async probe(path) {
            const object = objects.get(path);
            return object ? {exists: true, digest: object.digest, size: object.bytes.byteLength} : {exists: false};
        },
        async putIfAbsent(path, bytes) {
            if (objects.has(path)) return 'exists';
            const copy = Uint8Array.from(bytes);
            objects.set(path, {bytes: copy, digest: hash(Buffer.from(copy))});
            return 'created';
        },
        async remove(path) {objects.delete(path);}
    }};
}
async function uploadInput({operationId = 'upload-1', attachment = 'attachment-1'} = {}) {
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
    const capability = createProfileDocumentAttachmentCapability({context, getUser: () => ({uid}),
        seal: async ({bytes}) => ({payload: new Uint8Array([...bytes].map(byte => byte ^ 0x11)), envelope: envelope()})});
    try {
        return await planProfileDocumentAttachmentUpload({context, getUser: () => ({uid}), capability,
            documents: [{id: documentId}], attachments: [], documentId, bytes: new Uint8Array([1, 2, 3, 4]),
            mimeType: 'image/jpeg', operationId, hash, createAttachmentId: () => attachment});
    } finally {capability.dispose();}
}
const boundRecord = attachment => ({ownerId: uid, documentId,
    storagePath: documentImageStoragePath({uid, documentId, attachmentId: attachment}), mimeType: 'image/jpeg', size: 4,
    digest: hash(`payload-${attachment}`), envelope: envelope(), status: 'ready', schemaVersion: 1, createdAt: 1});
test('document attachments: real transactions, atomic limit and coordinated deletion', async t => {
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'document-attachments-test'), db = getFirestore(app);
    t.after(async () => {await db.terminate(); await deleteApp(app);});
    const objects = new Map(), handler = createProfileDocumentAttachmentHandler({...adapters(db, objects), hash,
        timestamp: () => FieldValue.serverTimestamp()});
    const path = `users/${uid}`, recordPath = documentAttachmentRecordPath({uid, attachmentId: 'attachment-1'});
    await db.doc(path).set({ownerId: uid, documenti: [{id: documentId, type: 'Patente'}]});

    await t.test('an upload commits through real transactions and retries idempotently', async () => {
        const input = await uploadInput();
        assert.deepEqual(await handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId: 'attachment-1'});
        const record = (await db.doc(recordPath).get()).data();
        assert.equal(record.status, 'ready'); assert.equal(record.digest, input.command.digest);
        assert.equal((await db.doc(documentAttachmentReceiptPath({uid, operationId: 'upload-1'})).get()).data().status, 'ready');
        assert.equal(objects.size, 1);
        const writes = objects.size;
        assert.deepEqual(await handler.upload(input, trusted), {status: 'confirmed', state: 'ready', attachmentId: 'attachment-1'});
        assert.equal(objects.size, writes, 'a confirmed retry never rewrites the object');
    });
    await t.test('a document that is not uniquely persisted is refused by the authoritative profile', async () => {
        await db.doc(path).update({documenti: [{id: documentId}, {id: documentId}]});
        await assert.rejects(handler.upload(await uploadInput({operationId: 'duplicate-document', attachment: 'attachment-dup'}), trusted),
            /DOCUMENT_ID_AMBIGUOUS/);
        await db.doc(path).update({documenti: [{id: 'document-other', type: 'Patente'}]});
        await assert.rejects(handler.upload(await uploadInput({operationId: 'unknown-document', attachment: 'attachment-unknown'}), trusted),
            /DOCUMENT_NOT_PERSISTED/);
        await db.doc(path).update({documenti: [{id: documentId, type: 'Patente'}]});
        assert.equal((await db.doc(documentAttachmentRecordPath({uid, attachmentId: 'attachment-unknown'})).get()).exists, false);
    });
    await t.test('the tenth slot is decided atomically even against a concurrent upload', async () => {
        const existing = await db.collection(`users/${uid}/profileDocumentAttachments`).get();
        for (const entry of existing.docs) await entry.ref.delete();
        const seeds = Array.from({length: DOCUMENT_IMAGE_MAX_PER_DOCUMENT - 1}, (unused, index) => `attachment-seed-${index}`);
        for (const attachment of seeds) await db.doc(documentAttachmentRecordPath({uid, attachmentId: attachment})).set(boundRecord(attachment));
        const [first, second] = await Promise.all([
            uploadInput({operationId: 'race-a', attachment: 'attachment-race-a'}),
            uploadInput({operationId: 'race-b', attachment: 'attachment-race-b'})]);
        const results = await Promise.allSettled([handler.upload(first, trusted), handler.upload(second, trusted)]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1, 'only one upload takes the last slot');
        const stored = await db.collection(`users/${uid}/profileDocumentAttachments`).get();
        const bound = stored.docs.map(entry => entry.data()).filter(record => record.documentId === documentId);
        assert.equal(bound.length, DOCUMENT_IMAGE_MAX_PER_DOCUMENT);
        await assert.rejects(handler.upload(await uploadInput({operationId: 'after-limit', attachment: 'attachment-after'}), trusted),
            /ATTACHMENT_LIMIT_REACHED/);
    });
    await t.test('a deletion validates the authoritative record and is idempotent', async () => {
        const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
        const target = 'attachment-target';
        await db.doc(documentAttachmentRecordPath({uid, attachmentId: target})).set(boundRecord(target));
        const record = (await db.doc(documentAttachmentRecordPath({uid, attachmentId: target})).get()).data();
        const input = await planProfileDocumentAttachmentDelete({context, getUser: () => ({uid}),
            documents: [{id: documentId}], attachment: {...record, id: target}, operationId: 'delete-1', hash});
        assert.deepEqual(await handler.remove(input, trusted), {status: 'confirmed', state: 'removed', attachmentId: target});
        assert.equal((await db.doc(documentAttachmentRecordPath({uid, attachmentId: target})).get()).exists, false);
        assert.deepEqual(await handler.remove(input, trusted), {status: 'confirmed', state: 'removed', attachmentId: target});
        // The race winner is whichever upload took the slot: the tampered record
        // is the one that is really stored.
        const stored = await db.collection(`users/${uid}/profileDocumentAttachments`).where('documentId', '==', documentId).get();
        const winner = stored.docs.map(entry => ({...entry.data(), id: entry.id}))
            .find(entry => entry.id.startsWith('attachment-race-'));
        assert.ok(winner, 'the winning upload is stored');
        const stale = await planProfileDocumentAttachmentDelete({context, getUser: () => ({uid}),
            documents: [{id: documentId}], attachment: winner, operationId: 'delete-tampered', hash});
        await db.doc(documentAttachmentRecordPath({uid, attachmentId: winner.id})).update({digest: hash('tampered')});
        await assert.rejects(handler.remove(stale, trusted), /DOCUMENT_ATTACHMENT_CONFLICT/);
        assert.equal((await db.doc(documentAttachmentRecordPath({uid, attachmentId: winner.id})).get()).data().digest, hash('tampered'),
            'a refused deletion changes nothing');
    });
    await t.test('recover promotes only an object whose digest matches the receipt', async () => {
        const bytes = Uint8Array.from([1, 2, 3]), digest = hash(Buffer.from(bytes));
        const attachment = 'pending-1', storagePath = documentImageStoragePath({uid, documentId, attachmentId: attachment});
        await db.doc(documentAttachmentRecordPath({uid, attachmentId: attachment})).set({...boundRecord(attachment),
            status: 'reserved', digest});
        await db.doc(documentAttachmentReceiptPath({uid, operationId: 'pending-1'})).set({kind: 'profile-document-attachment',
            ownerId: uid, operationId: 'pending-1', documentId, attachmentId: attachment, storagePath,
            digest: hash('operation-pending-1'), objectDigest: digest, status: 'reserved', createdAt: 1});
        objects.set(storagePath, {bytes, digest});
        const promoted = await handler.recover(trusted);
        assert.ok(promoted.confirmed >= 1);
        assert.equal((await db.doc(documentAttachmentRecordPath({uid, attachmentId: attachment})).get()).data().status, 'ready');

        const foreign = 'pending-2', foreignPath = documentImageStoragePath({uid, documentId, attachmentId: foreign});
        const expected = hash('payload-other');
        await db.doc(documentAttachmentRecordPath({uid, attachmentId: foreign})).set({...boundRecord(foreign), status: 'reserved', digest: expected});
        await db.doc(documentAttachmentReceiptPath({uid, operationId: 'pending-2'})).set({kind: 'profile-document-attachment',
            ownerId: uid, operationId: 'pending-2', documentId, attachmentId: foreign, storagePath: foreignPath,
            digest: hash('operation-pending-2'), objectDigest: expected, status: 'reserved', createdAt: 1});
        objects.set(foreignPath, {bytes: Uint8Array.from([9]), digest: hash('payload-different')});
        const blocked = await handler.recover(trusted);
        assert.ok(blocked.incomplete >= 1);
        assert.equal((await db.doc(documentAttachmentRecordPath({uid, attachmentId: foreign})).get()).data().status, 'reserved');
        assert.equal(objects.has(foreignPath), true, 'an unproven object is never deleted or promoted');
    });
});
