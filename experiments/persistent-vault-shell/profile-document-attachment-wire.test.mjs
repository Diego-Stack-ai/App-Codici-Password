import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeAttachmentUpload, decodeAttachmentUpload} from './profile-document-attachment-wire.mjs';
import {DOCUMENT_IMAGE_MAX_STORED_BYTES} from './profile-document-attachments-contract.mjs';

test('binary wire roundtrip is exact, bounded and strips browser attestation', () => {
    const payload = Uint8Array.from({length: 16385}, (_, i) => i % 256);
    const input = {command: {ownerId: 'synthetic'}, digest: 'digest', payload, trusted: {auth: {uid: 'forged'}}};
    const wire = encodeAttachmentUpload(input);
    assert.deepEqual(Object.keys(wire), ['command', 'digest', 'payloadBase64']);
    assert.deepEqual(decodeAttachmentUpload(JSON.parse(JSON.stringify(wire))), {command: input.command, digest: input.digest, payload});
});
test('wire refuses malformed, noncanonical, empty and oversized payloads', () => {
    for (const payloadBase64 of ['', 'AA', 'AA==\n', 'AB==', '====', 'A===', '_A==', 123])
        assert.throws(() => decodeAttachmentUpload({payloadBase64}), /ATTACHMENT_WIRE_INVALID/);
    assert.throws(() => decodeAttachmentUpload({payloadBase64: 'AA==', trusted: {}}));
    for (const payload of [[], new Uint8Array(), new Uint8Array(DOCUMENT_IMAGE_MAX_STORED_BYTES + 1)])
        assert.throws(() => encodeAttachmentUpload({payload}), /ATTACHMENT_PAYLOAD_INVALID/);
});
test('wire accepts exactly the encrypted-byte cap and rejects cap plus one on decode', () => {
    const payload = new Uint8Array(DOCUMENT_IMAGE_MAX_STORED_BYTES).fill(7);
    const wire = encodeAttachmentUpload({command: {}, digest: 'test', payload});
    assert.equal(decodeAttachmentUpload(wire).payload.length, DOCUMENT_IMAGE_MAX_STORED_BYTES);
    const oversized = Buffer.alloc(DOCUMENT_IMAGE_MAX_STORED_BYTES + 1).toString('base64');
    assert.throws(() => decodeAttachmentUpload({...wire, payloadBase64: oversized}), /ATTACHMENT_WIRE_INVALID/);
});
