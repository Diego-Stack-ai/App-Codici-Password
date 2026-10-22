import {
    ATTACHMENT_CHUNK_BYTES,
    MAX_ATTACHMENT_BYTES,
    resolveAccountAttachmentMime,
    validateAccountAttachmentFile,
    wrapAttachmentFileKey
} from './attachment-security.js';

const CHUNK_BINDING_PATTERN = /^[A-Za-z0-9._:-]{1,180}$/;

function bytesToBase64(value) {
    let binary = '';
    for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(value);
    return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function chunkAdditionalData(binding, index, count) {
    if (!CHUNK_BINDING_PATTERN.test(String(binding || '')) ||
        !Number.isSafeInteger(index) || index < 0 ||
        !Number.isSafeInteger(count) || count <= 0 || index >= count) {
        throw new Error('ATTACHMENT_CHUNK_METADATA_INVALID');
    }
    return new TextEncoder().encode(`CodiciPassword-Attachment-v1:chunk:${binding}:${index}:${count}`);
}

export async function encryptAttachmentFileInChunks(file, vaultKey, {
    binding,
    chunkSize = ATTACHMENT_CHUNK_BYTES,
    onChunk
} = {}) {
    validateAccountAttachmentFile(file);
    const resolvedMime = resolveAccountAttachmentMime(file);
    if (!resolvedMime.startsWith('video/')) {
        throw new Error('ATTACHMENT_CHUNKED_VIDEO_REQUIRED');
    }
    if (!vaultKey) throw new Error('VAULT_KEY_REQUIRED');
    if (!Number.isSafeInteger(chunkSize) || chunkSize <= 0 || chunkSize > MAX_ATTACHMENT_BYTES) {
        throw new Error('ATTACHMENT_CHUNK_SIZE_INVALID');
    }
    if (typeof onChunk !== 'function') throw new Error('ATTACHMENT_CHUNK_HANDLER_REQUIRED');
    const chunkCount = Math.ceil(file.size / chunkSize);
    const fileKeyBytes = crypto.getRandomValues(new Uint8Array(32));
    const chunks = [];
    try {
        const fileKey = await crypto.subtle.importKey('raw', fileKeyBytes, 'AES-GCM', false, ['encrypt']);
        for (let index = 0; index < chunkCount; index += 1) {
            const clear = new Uint8Array(await file.slice(index * chunkSize, Math.min(file.size, (index + 1) * chunkSize)).arrayBuffer());
            try {
                const contentIv = crypto.getRandomValues(new Uint8Array(12));
                const encrypted = await crypto.subtle.encrypt({
                    name: 'AES-GCM',
                    iv: contentIv,
                    additionalData: chunkAdditionalData(binding, index, chunkCount)
                }, fileKey, clear);
                const chunk = {
                    index,
                    contentIv: bytesToBase64(contentIv),
                    clearSize: clear.byteLength,
                    encryptedSize: encrypted.byteLength
                };
                const saved = await onChunk({
                    ...chunk,
                    blob: new Blob([encrypted], {type: 'application/octet-stream'}),
                    progress: (index + 1) / chunkCount
                });
                chunks.push({...chunk, ...(saved || {})});
            } finally {
                clear.fill(0);
            }
        }
        return {
            chunks,
            metadata: {
                version: 1,
                cipher: 'AES-GCM-256',
                ...(await wrapAttachmentFileKey(fileKeyBytes, vaultKey)),
                chunked: true,
                chunkVersion: 1,
                chunkBinding: binding,
                chunkSize,
                chunkCount,
                originalType: resolvedMime,
                originalSize: file.size
            }
        };
    } finally {
        fileKeyBytes.fill(0);
    }
}

export async function decryptAttachmentChunkBytesWithFileKey(ciphertext, encryption, chunk, fileKeyBytes) {
    const rawKey = new Uint8Array(fileKeyBytes);
    if (encryption?.version !== 1 || encryption?.cipher !== 'AES-GCM-256' ||
        encryption?.chunked !== true || encryption?.chunkVersion !== 1 || rawKey.byteLength !== 32 ||
        chunk?.contentIv == null || chunk?.index == null) {
        rawKey.fill(0);
        throw new Error('ATTACHMENT_CHUNK_METADATA_INVALID');
    }
    try {
        const fileKey = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['decrypt']);
        return await crypto.subtle.decrypt({
            name: 'AES-GCM',
            iv: base64ToBytes(chunk.contentIv),
            additionalData: chunkAdditionalData(
                encryption.chunkBinding,
                Number(chunk.index),
                Number(encryption.chunkCount)
            )
        }, fileKey, ciphertext);
    } finally {
        rawKey.fill(0);
    }
}

export function isChunkedAttachment(attachment) {
    return attachment?.encryption?.chunked === true &&
        attachment.encryption?.chunkVersion === 1 &&
        Array.isArray(attachment?.chunks) && attachment.chunks.length > 0;
}

export async function openChunkedDecryptedAttachment({attachment, fileKeyBytes, loadChunk}) {
    if (!isChunkedAttachment(attachment) || typeof loadChunk !== 'function') {
        throw new Error('ATTACHMENT_CHUNK_METADATA_INVALID');
    }
    if (!navigator.storage?.getDirectory) throw new Error('ATTACHMENT_LARGE_PREVIEW_UNSUPPORTED');
    const ordered = [...attachment.chunks].sort((left, right) => Number(left.index) - Number(right.index));
    if (ordered.length !== Number(attachment.encryption.chunkCount) ||
        ordered.some((chunk, index) => Number(chunk.index) !== index || !chunk.storagePath)) {
        throw new Error('ATTACHMENT_CHUNK_METADATA_INVALID');
    }
    const root = await navigator.storage.getDirectory();
    const directory = await root.getDirectoryHandle('codici-password-previews', {create: true});
    const temporaryName = `${Date.now()}-${crypto.randomUUID?.() || Math.random().toString(16).slice(2)}.bin`;
    const handle = await directory.getFileHandle(temporaryName, {create: true});
    const writable = await handle.createWritable();
    let closed = false;
    try {
        for (const chunk of ordered) {
            const ciphertext = await loadChunk(chunk);
            const clear = new Uint8Array(await decryptAttachmentChunkBytesWithFileKey(
                ciphertext, attachment.encryption, chunk, fileKeyBytes
            ));
            try {
                if (clear.byteLength !== Number(chunk.clearSize)) throw new Error('ATTACHMENT_CHUNK_SIZE_MISMATCH');
                await writable.write(clear);
            } finally {
                clear.fill(0);
            }
        }
        await writable.close();
        closed = true;
        const file = await handle.getFile();
        const type = attachment.encryption.originalType || attachment.type || 'application/octet-stream';
        const objectUrl = URL.createObjectURL(new Blob([file], {type}));
        const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
        if (opened) opened.opener = null;
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10 * 60_000);
    } finally {
        if (!closed) await writable.abort().catch(() => {});
        await directory.removeEntry(temporaryName).catch(() => {});
    }
}
