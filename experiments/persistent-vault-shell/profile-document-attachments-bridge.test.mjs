import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {initializeApp, deleteApp} from 'firebase/app';
import {initializeAuth, inMemoryPersistence, connectAuthEmulator, signInWithEmailAndPassword} from 'firebase/auth';
import {getFirestore, connectFirestoreEmulator, doc, getDocFromServer, terminate} from 'firebase/firestore';
import {planProfileDocumentAttachmentUpload, planProfileDocumentAttachmentDelete} from './prepare-profile-document-attachment.mjs';
import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {sealDocumentImageBytes, openDocumentImageBytes} from './profile-document-attachment-seal.mjs';
import {encodeAttachmentUpload} from './profile-document-attachment-wire.mjs';
import {documentAttachmentAad} from './profile-document-attachments-contract.mjs';

// Explicit live LOCAL HTTP boundary test, separate from the browser picker test.
// Requires run-vault-session-emulators --browser; never targets a deployed app.
test('local attachment HTTP bridge authenticates, seals, retries and removes', async t => {
    const app = initializeApp({projectId: 'demo-vault-shell', apiKey: 'demo-key'}, 'attachment-http-test');
    const auth = initializeAuth(app, {persistence: inMemoryPersistence});
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', {disableWarnings: true});
    const db = getFirestore(app); connectFirestoreEmulator(db, '127.0.0.1', 8085);
    t.after(async () => {await terminate(db); await deleteApp(app);});
    const {user} = await signInWithEmailAndPassword(auth, 'a@example.invalid', 'LOGIN-SOLO-EMULATORE!123');
    const uid = user.uid, token = await user.getIdToken();
    const headers = {'content-type': 'application/json', origin: 'http://127.0.0.1:4188',
        authorization: `Bearer ${token}`, 'x-firebase-appcheck': 'synthetic-app-check'};
    const call = async (name, data, override = {}) => {
        const response = await fetch(`http://127.0.0.1:4188/demo-vault-shell/europe-west1/${name}`, {
            method: 'POST', headers: {...headers, ...override}, body: JSON.stringify({data})});
        return {status: response.status, body: await response.json()};
    };
    const hash = value => createHash('sha256').update(value).digest('hex');
    const context = {user: {uid}, signal: new AbortController().signal, assertUnlocked() {}};
    const vaultKey = Uint8Array.from({length: 32}, (_, i) => i + 1);
    const capability = createProfileDocumentAttachmentCapability({context, getUser: () => ({uid}),
        seal: ({bytes, aad}) => sealDocumentImageBytes(vaultKey, {bytes, aad})});
    t.after(() => {capability.dispose(); vaultKey.fill(0);});
    const bytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const attachmentId = `attachment-${crypto.randomUUID()}`;
    const plan = await planProfileDocumentAttachmentUpload({context, getUser: () => ({uid}), capability,
        documents: [{id: 'document'}], attachments: [], documentId: 'document', bytes: bytes.slice(), mimeType: 'image/png',
        operationId: `op-${crypto.randomUUID()}`, hash, createAttachmentId: () => attachmentId});
    const wire = encodeAttachmentUpload(plan);
    await t.test('missing identity and fake browser attestation cannot authorize', async () => {
        assert.equal((await call('uploadProfileDocumentAttachment', wire, {authorization: ''})).status, 401);
        assert.equal((await call('uploadProfileDocumentAttachment', {...wire, trusted: {auth: {uid}}}, {'x-firebase-appcheck': ''})).status, 401);
        assert.equal((await call('uploadProfileDocumentAttachment', wire, {origin: 'https://example.invalid'})).status, 401);
        assert.equal((await getDocFromServer(doc(db, `users/${uid}/profileDocumentAttachments/${attachmentId}`))).exists(), false);
    });
    await t.test('malformed wire and foreign owner are rejected before metadata creation', async () => {
        assert.equal((await call('uploadProfileDocumentAttachment', {...wire, payloadBase64: 'AB=='})).status, 400);
        assert.equal((await call('uploadProfileDocumentAttachment', {...wire, trusted: {auth: {uid}}})).status, 400);
        assert.equal((await call('uploadProfileDocumentAttachment', {...wire, command: {...wire.command, ownerId: 'foreign'}})).status, 400);
        assert.equal((await getDocFromServer(doc(db, `users/${uid}/profileDocumentAttachments/${attachmentId}`))).exists(), false);
    });
    let record;
    await t.test('upload commits through real HTTP, Auth, Firestore and Storage; retry is idempotent', async () => {
        const first = await call('uploadProfileDocumentAttachment', wire);
        assert.equal(first.status, 200); assert.equal(first.body.result.status, 'confirmed');
        assert.deepEqual(await call('uploadProfileDocumentAttachment', wire), first);
        record = {...(await getDocFromServer(doc(db, plan.command.recordPath))).data(), id: attachmentId};
        assert.equal(record.status, 'ready'); assert.equal(record.digest, plan.command.digest);
        const response = await fetch(`http://127.0.0.1:9199/v0/b/demo-vault-shell.appspot.com/o/${encodeURIComponent(record.storagePath)}?alt=media`,
            {headers: {authorization: `Bearer ${token}`}});
        assert.equal(response.status, 200);
        const payload = new Uint8Array(await response.arrayBuffer());
        assert.notDeepEqual(payload, bytes);
        const opened = await openDocumentImageBytes(vaultKey, {payload, envelope: record.envelope,
            aad: documentAttachmentAad({uid, documentId: 'document', attachmentId, storagePath: record.storagePath})});
        assert.deepEqual(opened, bytes); opened.fill(0);
    });
    await t.test('remove uses the same authenticated bridge and removes only the selected object', async () => {
        const removal = await planProfileDocumentAttachmentDelete({context, getUser: () => ({uid}), documents: [{id: 'document'}],
            attachment: record, operationId: `delete-${crypto.randomUUID()}`, hash});
        const result = await call('removeProfileDocumentAttachment', {command: removal.command, digest: removal.digest});
        assert.equal(result.status, 200); assert.equal(result.body.result.status, 'confirmed');
        assert.equal((await getDocFromServer(doc(db, plan.command.recordPath))).exists(), false);
        assert.equal((await getDocFromServer(doc(db, `users/${uid}`))).data().documenti[0].id, 'document');
    });
});
