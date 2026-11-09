// Shared by the application and its self-contained, downloaded offline viewer.
export function decideAttachmentContent(input, fallbackName = 'allegato') {
    const item = input && typeof input === 'object' ? input : null;
    const rawType = item
        ? (Object.prototype.hasOwnProperty.call(item.encryption || {}, 'originalType')
            ? item.encryption.originalType : item.type ?? item.mimeType ?? '')
        : input;
    const type = typeof rawType === 'string'
        ? rawType.split(';', 1)[0].replace(/\s+/g, '').toLowerCase() : '';
    // [preview kind, safe extension, accepted by the upload contract]. Kept inside
    // the pure function so the standalone archive viewer uses the identical registry.
    const formats = {
        'application/pdf': ['pdf', 'pdf', true],
        'image/png': ['image', 'png', true], 'image/jpeg': ['image', 'jpg', true],
        'image/webp': ['image', 'webp', true], 'image/gif': ['image', 'gif', true],
        'video/mp4': ['video', 'mp4', true], 'video/webm': ['video', 'webm', true],
        'audio/mpeg': ['audio', 'mp3', false], 'audio/mp4': ['audio', 'm4a', false],
        'audio/ogg': ['audio', 'ogg', false], 'audio/wav': ['audio', 'wav', false],
        'audio/webm': ['audio', 'webm', false], 'text/plain': ['text', 'txt', true],
        'application/msword': [null, 'doc', true],
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [null, 'docx', true],
        'application/vnd.ms-excel': [null, 'xls', true],
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': [null, 'xlsx', true],
        'image/heic': [null, 'heic', true], 'image/heif': [null, 'heif', true],
        'video/quicktime': [null, 'mov', true]
    };
    const format = Object.prototype.hasOwnProperty.call(formats, type) ? formats[type] : null;
    const rawName = item
        ? item.originalName ?? item.fileName ?? item.nomeFile ?? item.name ?? fallbackName : fallbackName;
    const leaf = String(rawName || '').normalize('NFKC').split(/[\\/]/).pop() || '';
    // Only one extension, derived from the decision. Never preserve a disguised suffix.
    const stem = leaf.replace(/\.[^.]*$/, '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f]/g, '')
        .replace(/[<>:"|?*.]/g, '_').replace(/\s+/g, ' ').replace(/^[\s_]+|[\s_]+$/g, '')
        .slice(0, 100).replace(/[\s_]+$/g, '') || 'allegato';
    const extension = format?.[1] || 'bin';
    const base = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem) ? `_${stem}` : stem;
    return {
        action: format?.[0] ? 'preview' : 'download', kind: format?.[0] || null,
        mimeType: format?.[0] ? (type === 'text/plain' ? 'text/plain;charset=utf-8' : type) : 'application/octet-stream',
        fileName: `${base}.${extension}`,
        uploadMimeType: format?.[2] ? type : null
    };
}

// Preserve strict upload MIME membership: display normalization must not admit
// new upload aliases, parameters, spaces or additional preview-only audio types.
export function isAttachmentUploadMimeAllowed(mime) {
    const type = String(mime || '').toLowerCase();
    return decideAttachmentContent(type).uploadMimeType === type;
}

export function openAttachmentContent(bytes, attachment, {revokeAfter = 60_000} = {}) {
    const decision = decideAttachmentContent(attachment);
    const objectUrl = URL.createObjectURL(new Blob([bytes], {type: decision.mimeType}));
    try {
        if (decision.action === 'download') {
            const link = document.createElement('a');
            link.href = objectUrl;
            link.download = decision.fileName;
            link.rel = 'noopener noreferrer';
            link.hidden = true;
            document.body.append(link);
            try { link.click(); } finally { link.remove(); }
        } else {
            const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
            if (opened) opened.opener = null;
        }
    } finally {
        setTimeout(() => URL.revokeObjectURL(objectUrl), revokeAfter);
    }
    return decision.action;
}
