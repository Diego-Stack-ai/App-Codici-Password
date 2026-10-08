import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';
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
    // Direct creation must fail even for the owner with a valid envelope marker.
    await assertFails(reference(owner).put(bytes(1024), sealed));
    await env.withSecurityRulesDisabled(async context => {
        await reference(context).put(bytes(1024), sealed);
    });
    await assertSucceeds(reference(owner).getDownloadURL());
    await assertFails(reference(other).getDownloadURL());
    await assertFails(reference(anonymous).getDownloadURL());
    await assertFails(reference(other).put(bytes(1024), sealed));
    // Neither a forged marker nor an image MIME bypasses the service.
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'application/octet-stream'}));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'application/octet-stream', customMetadata: {encrypted: 'v2'}}));
    await assertFails(reference(owner).put(bytes(1024), sealed));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'image/png'}));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'video/mp4'}));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'application/pdf'}));
    await assertFails(reference(owner).put(bytes(1024), {contentType: 'text/plain'}));
    await assertFails(reference(owner).delete());
    await assertFails(reference(other).delete());
    // Reserve the entire family, including malformed/legacy-looking paths.
    for (const suffix of ['profile-documents', 'profile-documents/orphan', 'profile-documents/doc/other/file']) {
        await assertFails(owner.storage().ref(`users/${uid}/${suffix}`).put(bytes(1024), sealed));
    }
    // Unrelated upload policies are unchanged, including a one-segment object.
    for (const suffix of ['legacy.pdf', 'accounts/account-1/attachment.pdf']) {
        const legacy = owner.storage().ref(`users/${uid}/${suffix}`);
        await assertSucceeds(legacy.put(bytes(1024), {contentType: 'application/pdf'}));
        await assertSucceeds(legacy.delete());
    }
    await assertFails(other.storage().ref(`users/${uid}/legacy.pdf`).put(bytes(1024), {contentType: 'application/pdf'}));
    // M8 remains server-only even after applying the attachment overlay.
    for (const suffix of ['restoreObjects', 'restoreObjects/object', 'restoreObjects/nested/object']) {
        const path = `users/${uid}/${suffix}`;
        const restored = owner.storage().ref(path);
        await assertFails(restored.put(bytes(1024), sealed));
        await env.withSecurityRulesDisabled(async context => {
            await context.storage().ref(path).put(bytes(1024), sealed);
        });
        await assertFails(restored.put(bytes(1024), sealed));
        await assertFails(restored.delete());
        await assertFails(other.storage().ref(path).getDownloadURL());
        await assertFails(anonymous.storage().ref(path).getDownloadURL());
        if (suffix === 'restoreObjects/object') await assertSucceeds(restored.getDownloadURL());
        else await assertFails(restored.getDownloadURL());
    }
    await assertFails(owner.storage().ref(`users/${uid}/invalid.bin`).put(bytes(10), {contentType: 'application/octet-stream'}));
    await assertFails(owner.storage().ref(`users/${uid}/empty.pdf`).put(bytes(0), {contentType: 'application/pdf'}));
    assert.throws(() => withDocumentAttachmentStorageRules(storage), /RULES_ALREADY_PATCHED/);
});
