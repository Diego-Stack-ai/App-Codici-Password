import {DOCUMENT_ATTACHMENT_CIPHER, DOCUMENT_ATTACHMENT_ENVELOPE_TYPE, DOCUMENT_ATTACHMENT_KEY_WRAP,
    DOCUMENT_ATTACHMENT_SCHEMA_VERSION, documentAttachmentBytes, documentAttachmentEnvelope}
    from './profile-document-attachments-contract.mjs';

// Real binary sealing for the candidate document image boundary (DS-002B). The
// Vault Key never leaves this module in the clear: it is used only as HKDF input
// material for a wrapping key, while the content is encrypted with a fresh random
// file key that is stored only wrapped. Both the content and the key wrap are
// bound to the contextual AAD of DS-002A, so an envelope cannot be replayed
// against another owner, document, attachment or path.
const IV_BYTES = 12;
const SALT_BYTES = 32;
export const DOCUMENT_ATTACHMENT_FILE_KEY_BYTES = 32;
const encoder = new TextEncoder();
const randomBytes = length => globalThis.crypto.getRandomValues(new Uint8Array(length));
const encode = bytes => btoa(String.fromCharCode(...bytes));
const decode = value => Uint8Array.from(atob(value), character => character.charCodeAt(0));
const seamFailure = () => {throw Error('DOCUMENT_ATTACHMENT_SEAL_FAILED');};
const openFailure = () => {throw Error('DOCUMENT_ATTACHMENT_OPEN_FAILED');};
const assertVaultKey = value => {
    if (!documentAttachmentBytes(value) || value.byteLength !== DOCUMENT_ATTACHMENT_FILE_KEY_BYTES) seamFailure();
};
const assertAad = value => {
    if (typeof value !== 'string' || !value) seamFailure();
};
// HKDF-SHA256 over the Vault Key material, with the contextual AAD as `info`:
// the wrapping key exists only for this owner/document/attachment/path.
async function wrappingKey(vaultKey, {salt, aad}) {
    const material = await globalThis.crypto.subtle.importKey('raw', vaultKey, 'HKDF', false, ['deriveBits']);
    const bits = await globalThis.crypto.subtle.deriveBits({name: 'HKDF', hash: 'SHA-256', salt,
        info: encoder.encode(aad)}, material, 256);
    try {
        const key = await globalThis.crypto.subtle.importKey('raw', bits, {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
        return {key, bits};
    } catch (error) {
        new Uint8Array(bits).fill(0);
        throw error;
    }
}
// Encrypts the bytes with a random file key and returns the opaque payload plus
// the canonical envelope. Callers receive no key material: the file key is zeroed
// here on every path, including the failing one.
export async function sealDocumentImageBytes(vaultKey, {bytes, aad} = {}) {
    assertVaultKey(vaultKey);
    if (!documentAttachmentBytes(bytes) || !bytes.byteLength) seamFailure();
    assertAad(aad);
    const additionalData = encoder.encode(aad);
    const contentIv = randomBytes(IV_BYTES), wrapIv = randomBytes(IV_BYTES), wrapSalt = randomBytes(SALT_BYTES);
    const fileKey = randomBytes(DOCUMENT_ATTACHMENT_FILE_KEY_BYTES);
    let bits = null;
    try {
        const contentKey = await globalThis.crypto.subtle.importKey('raw', fileKey, {name: 'AES-GCM'}, false, ['encrypt']);
        const payload = new Uint8Array(await globalThis.crypto.subtle.encrypt({name: 'AES-GCM', iv: contentIv,
            additionalData}, contentKey, bytes));
        const wrap = await wrappingKey(vaultKey, {salt: wrapSalt, aad});
        bits = wrap.bits;
        const wrapped = new Uint8Array(await globalThis.crypto.subtle.encrypt({name: 'AES-GCM', iv: wrapIv,
            additionalData}, wrap.key, fileKey));
        const envelope = documentAttachmentEnvelope({type: DOCUMENT_ATTACHMENT_ENVELOPE_TYPE,
            version: DOCUMENT_ATTACHMENT_SCHEMA_VERSION, cipher: DOCUMENT_ATTACHMENT_CIPHER, keyWrap: DOCUMENT_ATTACHMENT_KEY_WRAP,
            contentIv: encode(contentIv), wrapSalt: encode(wrapSalt), wrapIv: encode(wrapIv), wrappedFileKey: encode(wrapped)});
        return Object.freeze({payload, envelope});
    } catch (error) {
        if (error?.message?.startsWith('DOCUMENT_ATTACHMENT_')) throw error;
        return seamFailure();
    } finally {
        fileKey.fill(0);
        if (bits) new Uint8Array(bits).fill(0);
    }
}
// Opens an envelope produced by the function above. A foreign key, a different
// AAD or any tampered byte makes WebCrypto reject: the failure is reported as a
// single non-descriptive code, so a caller cannot use it as an oracle.
export async function openDocumentImageBytes(vaultKey, {payload, envelope, aad} = {}) {
    assertVaultKey(vaultKey);
    assertAad(aad);
    if (!documentAttachmentBytes(payload) || !payload.byteLength) openFailure();
    let canonical;
    try {
        canonical = documentAttachmentEnvelope(envelope);
    } catch {
        return openFailure();
    }
    const additionalData = encoder.encode(aad);
    let wrap = null, fileKey = null;
    try {
        wrap = await wrappingKey(vaultKey, {salt: decode(canonical.wrapSalt), aad});
        fileKey = new Uint8Array(await globalThis.crypto.subtle.decrypt({name: 'AES-GCM', iv: decode(canonical.wrapIv),
            additionalData}, wrap.key, decode(canonical.wrappedFileKey)));
        const contentKey = await globalThis.crypto.subtle.importKey('raw', fileKey, {name: 'AES-GCM'}, false, ['decrypt']);
        const plaintext = new Uint8Array(await globalThis.crypto.subtle.decrypt({name: 'AES-GCM',
            iv: decode(canonical.contentIv), additionalData}, contentKey, payload));
        return plaintext;
    } catch {
        return openFailure();
    } finally {
        fileKey?.fill(0);
        if (wrap?.bits) new Uint8Array(wrap.bits).fill(0);
    }
}
