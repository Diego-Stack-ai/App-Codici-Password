import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openDocumentImageBytes, sealDocumentImageBytes} from './profile-document-attachment-seal.mjs';
import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {createMemoryVault} from './memory-vault.mjs';
import {createProtectedSession} from './protected-session.mjs';
import {documentAttachmentAad, documentImageStoragePath, documentAttachmentEnvelope}
    from './profile-document-attachments-contract.mjs';

const uid = 'owner', documentId = 'document-1', attachmentId = 'attachment-1';
const storagePath = documentImageStoragePath({uid, documentId, attachmentId});
const aad = documentAttachmentAad({uid, documentId, attachmentId, storagePath});
const otherAad = documentAttachmentAad({uid: 'other', documentId, attachmentId: attachmentId,
    storagePath: documentImageStoragePath({uid: 'other', documentId, attachmentId})});
const vaultKey = Uint8Array.from({length: 32}, (unused, index) => index + 1);
const plaintext = () => Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]);
function sessionFixture(options = {}) {
    let user = {uid}, observer, vault;
    const contexts = [], states = [];
    const session = createProtectedSession({
        getUser: () => user,
        subscribeUser: fn => {observer = fn; return () => {};},
        createVault: callbacks => vault = createMemoryVault({unlockKey: async () => Uint8Array.from(vaultKey),
            sealBytes: sealDocumentImageBytes, openBytes: openDocumentImageBytes, ...options, ...callbacks}),
        routes: {private: context => {contexts.push(context); return () => {};}},
        onState: value => states.push(value)
    });
    return {session, contexts, states, get vault() {return vault;},
        change: uid2 => {user = uid2 ? {uid: uid2} : null; observer?.(user);}};
}
test('the seal round-trips through the contextual AAD and never exposes the file key', async () => {
    const sealed = await sealDocumentImageBytes(vaultKey, {bytes: plaintext(), aad});
    assert.equal(sealed.payload.byteLength, plaintext().byteLength + 16, 'AES-GCM appends its tag to the payload');
    assert.deepEqual(Object.keys(sealed.envelope).sort(), ['cipher', 'contentIv', 'keyWrap', 'type', 'version',
        'wrapIv', 'wrapSalt', 'wrappedFileKey']);
    assert.equal(sealed.envelope.type, 'profile-document-attachment-envelope');
    assert.equal(sealed.envelope.cipher, 'AES-GCM-256');
    assert.equal(sealed.envelope.keyWrap, 'HKDF-SHA256+A256GCM');
    assert.equal(sealed.envelope.wrapSalt.length, 44);
    assert.equal(sealed.envelope.contentIv.length, 16);
    assert.ok(sealed.envelope.wrappedFileKey.length >= 44 && sealed.envelope.wrappedFileKey.length <= 1024);
    assert.equal(Buffer.from(sealed.payload).includes(Buffer.from(plaintext())), false, 'the plaintext is not in the payload');
    assert.notEqual(sealed.envelope.wrappedFileKey, Buffer.from(plaintext()).toString('base64'));
    const opened = await openDocumentImageBytes(vaultKey, {payload: sealed.payload, envelope: sealed.envelope, aad});
    assert.deepEqual([...opened], [...plaintext()]);
    // Two seals of the same bytes differ: a fresh file key and fresh IVs every time.
    const again = await sealDocumentImageBytes(vaultKey, {bytes: plaintext(), aad});
    assert.notEqual(again.envelope.wrappedFileKey, sealed.envelope.wrappedFileKey);
    assert.notEqual([...again.payload].join(), [...sealed.payload].join());
});
test('the seal is bound to the AAD, the Vault Key and every stored byte', async () => {
    const sealed = await sealDocumentImageBytes(vaultKey, {bytes: plaintext(), aad});
    await assert.rejects(openDocumentImageBytes(vaultKey, {payload: sealed.payload, envelope: sealed.envelope,
        aad: otherAad}), /DOCUMENT_ATTACHMENT_OPEN_FAILED/);
    const foreignKey = Uint8Array.from({length: 32}, (unused, index) => 200 - index);
    await assert.rejects(openDocumentImageBytes(foreignKey, {payload: sealed.payload, envelope: sealed.envelope, aad}),
        /DOCUMENT_ATTACHMENT_OPEN_FAILED/);
    const tamperedPayload = Uint8Array.from(sealed.payload);
    tamperedPayload[0] ^= 0xff;
    await assert.rejects(openDocumentImageBytes(vaultKey, {payload: tamperedPayload, envelope: sealed.envelope, aad}),
        /DOCUMENT_ATTACHMENT_OPEN_FAILED/);
    const tamperedWrap = Uint8Array.from(atob(sealed.envelope.wrappedFileKey));
    tamperedWrap[0] ^= 0xff;
    await assert.rejects(openDocumentImageBytes(vaultKey, {payload: sealed.payload, aad,
        envelope: {...sealed.envelope, wrappedFileKey: btoa(String.fromCharCode(...tamperedWrap))}}),
        /DOCUMENT_ATTACHMENT_OPEN_FAILED/);
});
test('the seal refuses a foreign envelope, a foreign key shape and an empty plaintext', async () => {
    for (const envelope of [{...JSON.parse(JSON.stringify(await sealDocumentImageBytes(vaultKey, {bytes: plaintext(), aad})
        .then(sealed => sealed.envelope))), cipher: 'AES-CBC'}, null, {}, {type: 'other'}]) {
        await assert.rejects(openDocumentImageBytes(vaultKey, {payload: plaintext(), envelope, aad}),
            /DOCUMENT_ATTACHMENT_OPEN_FAILED/);
    }
    await assert.rejects(sealDocumentImageBytes(new Uint8Array(16), {bytes: plaintext(), aad}),
        /DOCUMENT_ATTACHMENT_SEAL_FAILED/);
    await assert.rejects(sealDocumentImageBytes(vaultKey, {bytes: new Uint8Array(0), aad}),
        /DOCUMENT_ATTACHMENT_SEAL_FAILED/);
    await assert.rejects(sealDocumentImageBytes(vaultKey, {bytes: plaintext(), aad: ''}),
        /DOCUMENT_ATTACHMENT_SEAL_FAILED/);
    await assert.rejects(openDocumentImageBytes(vaultKey, {payload: new Uint8Array(0), envelope: {}, aad}),
        /DOCUMENT_ATTACHMENT_OPEN_FAILED/);
    // The envelope the contract accepts is the one the seal produced, unchanged.
    const canonical = documentAttachmentEnvelope((await sealDocumentImageBytes(vaultKey, {bytes: plaintext(), aad})).envelope);
    assert.equal(canonical.version, 1);
});
test('the Vault session seals and opens the images of its owner, and the capability clears the plaintext', async () => {
    const f = sessionFixture();
    await f.session.unlock();
    await f.session.navigate('private');
    const context = f.contexts.at(-1);
    const sealed = await context.sealImage({bytes: plaintext(), aad});
    assert.equal(sealed.payload.byteLength, plaintext().byteLength + 16);
    assert.deepEqual([...(await context.openImage({payload: sealed.payload, envelope: sealed.envelope, aad}))], [...plaintext()]);

    const bytes = plaintext();
    const capability = createProfileDocumentAttachmentCapability({context, getUser: () => ({uid}),
        seal: ({bytes: clear, aad: bound}) => context.sealImage({bytes: clear, aad: bound})});
    const planned = await capability.sealImage({bytes, documentId, attachmentId});
    assert.equal(bytes.every(byte => byte === 0), true, 'the capability clears the plaintext it received');
    assert.equal(planned.aad, aad);
    assert.equal(planned.storagePath, storagePath);
    assert.equal(planned.size, plaintext().byteLength, 'the plan keeps the original size');
    assert.equal(planned.payload.byteLength, plaintext().byteLength + 16, 'the stored size is the sealed one');
    assert.equal(createHash('sha256').update(planned.payload).digest('hex'), planned.digest);
    const opened = await context.openImage({payload: planned.payload, envelope: planned.envelope, aad: planned.aad});
    assert.deepEqual([...opened], [...plaintext()], 'the envelope opens back to the same bytes');
    capability.dispose();
    f.session.dispose();
});
test('locking the Vault or changing identity revokes the binary capability', async () => {
    const f = sessionFixture();
    await f.session.unlock();
    await f.session.navigate('private');
    const context = f.contexts.at(-1);
    f.session.lock('manual');
    await assert.rejects(context.sealImage({bytes: plaintext(), aad}), /VAULT_LOCKED|VIEW_DISPOSED/);
    assert.throws(() => context.assertUnlocked(), /VAULT_LOCKED|VIEW_DISPOSED/);

    const g = sessionFixture();
    await g.session.unlock();
    await g.session.navigate('private');
    const other = g.contexts.at(-1);
    g.change('someone-else');
    await assert.rejects(other.sealImage({bytes: plaintext(), aad}), /AUTH_CHANGED|VIEW_DISPOSED/);
    g.session.dispose();
});
test('a Vault without a binary cipher refuses to seal instead of degrading to plaintext', async () => {
    const f = sessionFixture({sealBytes: undefined, openBytes: undefined});
    await f.session.unlock();
    await f.session.navigate('private');
    const context = f.contexts.at(-1);
    await assert.rejects(context.sealImage({bytes: plaintext(), aad}), /SEAL_UNAVAILABLE/);
    await assert.rejects(context.openImage({payload: plaintext(), envelope: {}, aad}), /SEAL_UNAVAILABLE/);
    f.session.dispose();
});
