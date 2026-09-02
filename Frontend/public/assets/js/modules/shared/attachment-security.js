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
