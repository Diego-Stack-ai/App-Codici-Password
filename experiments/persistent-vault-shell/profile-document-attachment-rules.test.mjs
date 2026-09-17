import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';
import {DOCUMENT_IMAGE_MAX_BYTES, DOCUMENT_IMAGE_MAX_STORED_BYTES} from './profile-document-attachments-contract.mjs';
import {withDocumentAttachmentCandidateRules} from './profile-document-attachment-candidate-rules.mjs';
import {withDocumentAttachmentStorageRules} from './profile-document-attachment-storage-rules.mjs';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
const uid = 'rules-owner', stranger = 'rules-stranger';
const recordPath = `users/${uid}/profileDocumentAttachments/attachment-1`;
const receiptPath = `mutationResults/${uid}/operations/profile-document-attachment-upload-1`;
const objectPath = `users/${uid}/profile-documents/document-1/attachments/attachment-1`;
const bytes = length => new Uint8Array(length);
test('candidate rules confine records, receipts and objects to the authenticated owner', async t => {
    const firestore = withDocumentAttachmentCandidateRules(await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'));
    const storage = withDocumentAttachmentStorageRules(await readFile(new URL('../../storage.rules', import.meta.url), 'utf8'));
    assert.throws(() => withDocumentAttachmentCandidateRules('%s'), /RULES_BASE_CHANGED/);
    assert.throws(() => withDocumentAttachmentStorageRules('%s'), /RULES_BASE_CHANGED/);
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell',
        firestore: {host: '127.0.0.1', port: 8085, rules: firestore},
        storage: {host: '127.0.0.1', port: 9199, rules: storage}});
    t.after(async () => env.cleanup());
    const owner = env.authenticatedContext(uid), other = env.authenticatedContext(stranger), anonymous = env.unauthenticatedContext();
    await env.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), recordPath), {ownerId: uid, documentId: 'document-1', status: 'ready'});
        await setDoc(doc(context.firestore(), receiptPath), {kind: 'profile-document-attachment', ownerId: uid, status: 'ready'});
    });
    // The attested service is the only writer: every direct client write is denied.
    for (const path of [recordPath, receiptPath]) {
        await assertSucceeds(getDoc(doc(owner.firestore(), path)));
        await assertFails(getDoc(doc(other.firestore(), path)));
        await assertFails(getDoc(doc(anonymous.firestore(), path)));
        await assertFails(setDoc(doc(owner.firestore(), path), {ownerId: uid, documentId: 'document-1', status: 'ready'}));
        await assertFails(setDoc(doc(other.firestore(), path), {ownerId: stranger, documentId: 'document-1', status: 'ready'}));
    }
    // The transform must not break the base authorization model.
    await assertSucceeds(setDoc(doc(owner.firestore(), `users/${uid}`), {ownerId: uid}));
    await assertFails(setDoc(doc(other.firestore(), `users/${uid}`), {ownerId: uid}));
    await assertSucceeds(getDoc(doc(owner.firestore(), `users/${uid}/profileDocumentAttachments/attachment-1`)));
});
test('candidate Storage rules seal the attachment objects to their owner', async t => {
    const firestore = withDocumentAttachmentCandidateRules(await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8'));
    const storage = withDocumentAttachmentStorageRules(await readFile(new URL('../../storage.rules', import.meta.url), 'utf8'));
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell',
        firestore: {host: '127.0.0.1', port: 8085, rules: firestore},
        storage: {host: '127.0.0.1', port: 9199, rules: storage}});
    t.after(async () => env.cleanup());
    const owner = env.authenticatedContext(uid), other = env.authenticatedContext(stranger), anonymous = env.unauthenticatedContext();
    const reference = context => context.storage().ref(objectPath);
    const sealed = {contentType: 'application/octet-stream', customMetadata: {encrypted: 'v1'}};
    await assertSucceeds(reference(owner).put(bytes(1024), sealed));
    await assertSucceeds(reference(owner).getDownloadURL());
    await assertFails(reference(other).getDownloadURL());
    await assertFails(reference(anonymous).getDownloadURL());
    await assertFails(reference(other).put(bytes(1024), sealed));
    // An unattested object is refused: the marker is what declares local encryption.
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'application/octet-stream'}));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'application/octet-stream', customMetadata: {encrypted: 'v2'}}));
    // The tightened envelope: the original limit and the non-image families are gone.
    await assertSucceeds(reference(owner).put(bytes(DOCUMENT_IMAGE_MAX_STORED_BYTES), sealed));
    await assertFails(reference(owner).put(bytes(DOCUMENT_IMAGE_MAX_STORED_BYTES + 1), sealed));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'video/mp4'}));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'application/pdf'}));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'text/plain'}));
    await assertSucceeds(reference(owner).delete());
    assert.equal(DOCUMENT_IMAGE_MAX_BYTES, 10 * 1024 * 1024);
});
