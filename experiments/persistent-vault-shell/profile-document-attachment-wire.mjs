import {DOCUMENT_IMAGE_MAX_STORED_BYTES, documentAttachmentObject} from './profile-document-attachments-contract.mjs';

// Explicit binary boundary: JSON never carries a typed array or client attestation.
export const ATTACHMENT_WIRE_MAX_BODY = Math.ceil(DOCUMENT_IMAGE_MAX_STORED_BYTES / 3) * 4 + 16384;
export function encodeAttachmentUpload({command, digest, payload}) {
    if (!(payload instanceof Uint8Array) || !payload.length || payload.length > DOCUMENT_IMAGE_MAX_STORED_BYTES)
        throw Error('ATTACHMENT_PAYLOAD_INVALID');
    let binary = '';
    for (let offset = 0; offset < payload.length; offset += 8192)
        binary += String.fromCharCode(...payload.subarray(offset, offset + 8192));
    return {command, digest, payloadBase64: btoa(binary)};
}
export function decodeAttachmentUpload(value) {
    if (!documentAttachmentObject(value) || Object.keys(value).some(key => !['command', 'digest', 'payloadBase64'].includes(key)))
        throw Error('ATTACHMENT_WIRE_INVALID');
    const text = value.payloadBase64;
    if (typeof text !== 'string' || !text.length || text.length > Math.ceil(DOCUMENT_IMAGE_MAX_STORED_BYTES / 3) * 4
        || text.length % 4 || !/^[A-Za-z0-9+/]+={0,2}$/.test(text)) throw Error('ATTACHMENT_WIRE_INVALID');
    const binary = atob(text);
    if (!binary.length || binary.length > DOCUMENT_IMAGE_MAX_STORED_BYTES || btoa(binary) !== text)
        throw Error('ATTACHMENT_WIRE_INVALID');
    return {command: value.command, digest: value.digest,
        payload: Uint8Array.from(binary, character => character.charCodeAt(0))};
}
