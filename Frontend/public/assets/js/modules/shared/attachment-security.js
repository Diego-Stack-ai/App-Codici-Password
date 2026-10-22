export const MAX_ATTACHMENT_BYTES = 32 * 1024 * 1024;
export const MAX_LARGE_VIDEO_BYTES = 512 * 1024 * 1024;
export const ATTACHMENT_CHUNK_BYTES = 8 * 1024 * 1024;
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
const VIDEO_MIME_BY_EXTENSION = new Map([
    ['mp4', 'video/mp4'],
    ['m4v', 'video/mp4'],
    ['mov', 'video/quicktime'],
    ['webm', 'video/webm']
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
    const materialBytes = new TextEncoder().encode(String(vaultKey));
    try {
        const material = await crypto.subtle.importKey('raw', materialBytes, 'HKDF', false, ['deriveKey']);
        return await crypto.subtle.deriveKey(
            {name: 'HKDF', hash: 'SHA-256', salt, info: ATTACHMENT_AAD},
            material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']
        );
    } finally {
        materialBytes.fill(0);
    }
}

export async function wrapAttachmentFileKey(fileKeyBytes, vaultKey) {
    const wrapSalt = crypto.getRandomValues(new Uint8Array(32));
    const wrapIv = crypto.getRandomValues(new Uint8Array(12));
    const wrappingKey = await deriveAttachmentWrappingKey(vaultKey, wrapSalt);
    const wrappedFileKey = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv: wrapIv, additionalData: ATTACHMENT_AAD}, wrappingKey, fileKeyBytes
    );
    return {
        keyWrap: 'HKDF-SHA256+A256GCM',
        wrapSalt: bytesToBase64(wrapSalt),
        wrapIv: bytesToBase64(wrapIv),
        wrappedFileKey: bytesToBase64(wrappedFileKey)
    };
}

export async function unwrapAttachmentFileKey(encryption, vaultKey) {
    if (encryption?.version !== 1 || encryption?.cipher !== 'AES-GCM-256' || !vaultKey) {
        throw new Error('ATTACHMENT_ENCRYPTION_INVALID');
    }
    const wrappingKey = await deriveAttachmentWrappingKey(vaultKey, base64ToBytes(encryption.wrapSalt));
    const raw = await crypto.subtle.decrypt(
        {name: 'AES-GCM', iv: base64ToBytes(encryption.wrapIv), additionalData: ATTACHMENT_AAD},
        wrappingKey,
        base64ToBytes(encryption.wrappedFileKey)
    );
    const fileKeyBytes = new Uint8Array(raw);
    if (fileKeyBytes.byteLength !== 32) {
        fileKeyBytes.fill(0);
        throw new Error('ATTACHMENT_FILE_KEY_INVALID');
    }
    return fileKeyBytes;
}

export async function decryptAttachmentBytesWithFileKey(ciphertext, encryption, fileKeyBytes) {
    const rawKey = new Uint8Array(fileKeyBytes);
    if (encryption?.version !== 1 || encryption?.cipher !== 'AES-GCM-256' || rawKey.byteLength !== 32) {
        rawKey.fill(0);
        throw new Error('ATTACHMENT_ENCRYPTION_INVALID');
    }
    try {
        const fileKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
        return await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: base64ToBytes(encryption.contentIv), additionalData: ATTACHMENT_AAD},
            fileKey,
            ciphertext
        );
    } finally {
        rawKey.fill(0);
    }
}

export async function encryptAttachmentFile(file, vaultKey, {mimeType = file?.type} = {}) {
    validateAttachmentFile(file, {mimeType});
    if (!vaultKey) throw new Error('VAULT_KEY_REQUIRED');
    const fileKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    let plaintext = null;
    try {
        const fileKey = await crypto.subtle.importKey('raw', fileKeyBytes, 'AES-GCM', false, ['encrypt']);
        const contentIv = crypto.getRandomValues(new Uint8Array(12));
        plaintext = new Uint8Array(await file.arrayBuffer());
        const ciphertext = await crypto.subtle.encrypt(
            {name: 'AES-GCM', iv: contentIv, additionalData: ATTACHMENT_AAD},
            fileKey,
            plaintext
        );

        const wrappedKey = await wrapAttachmentFileKey(fileKeyBytes, vaultKey);

        return {
            blob: new Blob([ciphertext], {type: 'application/octet-stream'}),
            metadata: {
                version: 1,
                cipher: 'AES-GCM-256',
                ...wrappedKey,
                contentIv: bytesToBase64(contentIv),
                originalType: mimeType,
                originalSize: file.size
            }
        };
    } finally {
        plaintext?.fill(0);
        fileKeyBytes.fill(0);
    }
}

export async function decryptAttachmentBytes(ciphertext, encryption, vaultKey) {
    const fileKeyBytes = await unwrapAttachmentFileKey(encryption, vaultKey);
    try {
        return await decryptAttachmentBytesWithFileKey(ciphertext, encryption, fileKeyBytes);
    } finally {
        fileKeyBytes.fill(0);
    }
}

export function openDecryptedAttachment(bytes, attachment) {
    const type = attachment.encryption?.originalType || attachment.type || 'application/octet-stream';
    const objectUrl = URL.createObjectURL(new Blob([bytes], {type}));
    const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (opened) opened.opener = null;
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function fileExtension(file) {
    return String(file?.name || '').toLowerCase().match(/\.([a-z0-9]{1,10})$/)?.[1] || '';
}

export function resolveAccountAttachmentMime(file) {
    const declared = String(file?.type || '').toLowerCase();
    if (ALLOWED_MIME_TYPES.has(declared)) return declared;
    if (declared && declared !== 'application/octet-stream' && declared !== 'video/x-m4v') return declared;
    return VIDEO_MIME_BY_EXTENSION.get(fileExtension(file)) || declared;
}

export function validateAttachmentFile(file, {
    imageOnly = false,
    maxBytes = MAX_ATTACHMENT_BYTES,
    mimeType = file?.type
} = {}) {
    if (!(file instanceof File) || file.size <= 0) throw new Error('Seleziona un file valido.');
    if (file.size > maxBytes) throw new Error(`Il file supera il limite di ${Math.floor(maxBytes / 1024 / 1024)} MB.`);
    const mime = String(mimeType || '').toLowerCase();
    if (!ALLOWED_MIME_TYPES.has(mime) || (imageOnly && !mime.startsWith('image/'))) {
        throw new Error('Formato file non consentito.');
    }
    return file;
}

export function validateAccountAttachmentFile(file) {
    if (!(file instanceof File) || file.size <= 0) throw new Error('Seleziona un file valido.');
    const mime = resolveAccountAttachmentMime(file);
    const maxBytes = mime.startsWith('video/') ? MAX_LARGE_VIDEO_BYTES : MAX_ATTACHMENT_BYTES;
    return validateAttachmentFile(file, {maxBytes, mimeType: mime});
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
