export const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024;
export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set([
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'video/mp4', 'video/quicktime', 'video/webm',
    'application/pdf', 'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain'
]);
const ATTACHMENT_AAD = new TextEncoder().encode('CodiciPassword-Attachment-v1');

function bytesToBase64(value) {
    let binary = '';
    for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

async function deriveAttachmentWrappingKey(vaultKey, salt) {
    const material = await crypto.subtle.importKey(
        'raw', new TextEncoder().encode(String(vaultKey)), 'HKDF', false, ['deriveKey']
    );
    return crypto.subtle.deriveKey(
        {name: 'HKDF', hash: 'SHA-256', salt, info: ATTACHMENT_AAD},
        material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']
    );
}

export async function encryptAttachmentFile(file, vaultKey) {
    validateAttachmentFile(file);
    if (!vaultKey) throw new Error('VAULT_KEY_REQUIRED');
    const fileKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const fileKey = await crypto.subtle.importKey('raw', fileKeyBytes, 'AES-GCM', false, ['encrypt']);
    const contentIv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv: contentIv, additionalData: ATTACHMENT_AAD},
        fileKey,
        await file.arrayBuffer()
    );

    const wrapSalt = crypto.getRandomValues(new Uint8Array(32));
    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const wrappingKey = await deriveAttachmentWrappingKey(vaultKey, wrapSalt);
    const wrappedFileKey = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv: wrapIv, additionalData: ATTACHMENT_AAD}, wrappingKey, fileKeyBytes
    );

    return {
        blob: new Blob([ciphertext], {type: 'application/octet-stream'}),
        metadata: {
            version: 1,
            cipher: 'AES-GCM-256',
            keyWrap: 'HKDF-SHA256+A256GCM',
            contentIv: bytesToBase64(contentIv),
            wrapSalt: bytesToBase64(wrapSalt),
            wrapIv: bytesToBase64(wrapIv),
            wrappedFileKey: bytesToBase64(wrappedFileKey),
            originalType: file.type,
            originalSize: file.size
        }
    };
}

export async function decryptAttachmentBytes(ciphertext, encryption, vaultKey) {
    if (encryption?.version !== 1 || encryption?.cipher !== 'AES-GCM-256' || !vaultKey) {
        throw new Error('ATTACHMENT_ENCRYPTION_INVALID');
    }
    const wrappingKey = await deriveAttachmentWrappingKey(vaultKey, base64ToBytes(encryption.wrapSalt));
    const fileKeyBytes = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: base64ToBytes(encryption.wrapIv), additionalData: ATTACHMENT_AAD},
        wrappingKey,
        base64ToBytes(encryption.wrappedFileKey)
    );
    const fileKey = await crypto.subtle.importKey('raw', fileKeyBytes, 'AES-GCM', false, ['decrypt']);
    return crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: base64ToBytes(encryption.contentIv), additionalData: ATTACHMENT_AAD},
        fileKey,
        ciphertext
    );
}

export function openDecryptedAttachment(bytes, attachment) {
    const type = attachment.encryption?.originalType || attachment.type || 'application/octet-stream';
    const objectUrl = URL.createObjectURL(new Blob([bytes], {type}));
    const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function validateAttachmentFile(file, { imageOnly = false, maxBytes = MAX_ATTACHMENT_BYTES } = {}) {
    if (!(file instanceof File) || file.size <= 0) throw new Error('Seleziona un file valido.');
    if (file.size > maxBytes) throw new Error(`Il file supera il limite di ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
    const mime = String(file.type || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mime) || (imageOnly && !mime.startsWith('image/'))) {
        throw new Error('Formato file non consentito.');
    }
    return file;
}

export function createStorageObjectName(file) {
    const extensionMatch = String(file.name || '').toLowerCase().match(/\.([a-z0-9]{1,10})$/);
    const extension = extensionMatch ? `.${extensionMatch[1]}` : '';
    const randomId = typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : Array.from(crypto.getRandomValues(new Uint8Array(16)), byte => byte.toString(16).padStart(2, '0')).join('');
    return `${Date.now()}_${randomId}${extension}`;
}

export function normalizeExternalUrl(rawUrl) {
    if (!rawUrl) return null;
    try {
        const candidate = /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
        const parsed = new URL(candidate);
        if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('URL_PROTOCOL_NOT_ALLOWED');
        return parsed.href;
    } catch (error) {
        return null;
    }
}

export function openExternalUrl(rawUrl) {
    const safeUrl = normalizeExternalUrl(rawUrl);
    if (!safeUrl) return false;
    try {
        const opened = window.open(safeUrl, '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
        return true;
    } catch (error) {
        return false;
    }
}
