import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';

globalThis.crypto ??= webcrypto;
globalThis.btoa ??= value => Buffer.from(value, 'binary').toString('base64');
globalThis.atob ??= value => Buffer.from(value, 'base64').toString('binary');
globalThis.Blob ??= (await import('node:buffer')).Blob;

const source = await readFile(new URL(
    '../Frontend/public/assets/js/modules/shared/record-sharing-crypto.js', import.meta.url), 'utf8');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('production record key envelope is recipient-bound and decrypts payload', async () => {
    const recipient = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
    const stranger = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
    const key = api.generateRecordKey();
    const envelope = await api.wrapRecordKeyForRecipient(key, recipient.publicKey, 'record-1', 'recipient-1');
    const opened = await api.unwrapRecordKeyForRecipient(envelope, recipient.privateKey, 'record-1', 'recipient-1');
    const payload = await api.encryptRecordPayload({note: 'fixture'}, key, 'record-1');
    assert.deepEqual(await api.decryptRecordPayload(payload, opened, 'record-1'), {note: 'fixture'});
    await assert.rejects(api.unwrapRecordKeyForRecipient(envelope, stranger.privateKey, 'record-1', 'recipient-1'),
        /SHARED_AUTHENTICITY_INVALID/);
});

test('all attachment bytes are encrypted, serializable and bound to record and attachment', async () => {
    const key = api.generateRecordKey();
    const clear = new TextEncoder().encode('fixture attachment');
    const encrypted = await api.encryptAttachmentForRecord(clear, key, 'record-2', 'attachment-1');
    const parsed = await api.parseSharedAttachment(await api.serializeSharedAttachment(encrypted).arrayBuffer());
    assert.deepEqual(await api.decryptAttachmentForRecord(parsed, key, 'record-2', 'attachment-1'), clear);
    await assert.rejects(api.decryptAttachmentForRecord(parsed, key, 'record-2', 'attachment-2'),
        /SHARED_AUTHENTICITY_INVALID/);
    assert.equal(JSON.stringify(parsed).includes('fixture attachment'), false);
});

test('malformed formats, contexts and oversized inputs fail closed', async () => {
    const key = api.generateRecordKey();
    await assert.rejects(api.encryptAttachmentForRecord(new Uint8Array(), key, 'record', 'attachment'),
        /ATTACHMENT_SIZE_INVALID/);
    await assert.rejects(api.decryptRecordPayload({version: 1, cipher: 'AES-GCM-256', iv: '!', ciphertext: 'AA=='},
        key, 'record'), /SHARING_BASE64_INVALID/);
    assert.throws(() => api.serializeSharedAttachment({version: 0}), /ATTACHMENT_FORMAT_INVALID/);
});

test('attachment context is deterministic and separates private and company records', async () => {
    const input = {ownerUid: 'owner-1', accountId: 'account-1', attachmentId: 'attachment-1'};
    const privateId = await api.sharedAttachmentContextId(input);
    assert.equal(privateId, await api.sharedAttachmentContextId(input));
    assert.notEqual(privateId, await api.sharedAttachmentContextId({...input, companyId: 'company-1'}));
    assert.match(privateId, /^att_[A-Za-z0-9_-]+$/);
});
