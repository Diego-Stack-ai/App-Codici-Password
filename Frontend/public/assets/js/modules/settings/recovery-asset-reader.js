const MAX_BYTES = 32 * 1024 * 1024 + 16;
const PART_BYTES = 2 * 1024 * 1024;
const GENERATION = /^[1-9][0-9]{0,39}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_CODES = new Set(['UNAUTHENTICATED', 'OWNER_MISMATCH', 'APP_CHECK_REQUIRED', 'VERIFIED_EMAIL_REQUIRED',
    'RECENT_AUTH_REQUIRED', 'DISABLED', 'NOT_CONFIGURED', 'REQUEST_INVALID', 'PATH_INVALID', 'METADATA_INVALID',
    'SOURCE_MISSING', 'SOURCE_CHANGED', 'SOURCE_UNVERIFIED', 'RANGE_INVALID', 'BUSY', 'READ_FAILED',
    'SESSION_INVALIDATED', 'RESPONSE_INVALID', 'DIGEST_INVALID'].map(code => `RECOVERY_ASSET_${code}`));
const fail = code => { throw new Error(code); };
const exactKeys = (value, required, optional = []) => {
    if (!value || typeof value !== 'object' || Array.isArray(value) || required.some(key => !Object.hasOwn(value, key)) ||
        Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))) fail('RECOVERY_ASSET_RESPONSE_INVALID');
};
function pathForOwner(path, uid) {
    if (typeof path !== 'string' || path.length > 1024 || !path.startsWith(`users/${uid}/`) ||
        /[\\?#\u0000-\u001f\u007f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) fail('RECOVERY_ASSET_PATH_INVALID');
    return path;
}
function bytesToBase64(bytes) {
    let binary = '';
    for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    return btoa(binary);
}
function decodePart(content, length) {
    if (typeof content !== 'string' || content.length !== Math.ceil(length / 3) * 4) fail('RECOVERY_ASSET_RESPONSE_INVALID');
    let bytes;
    try {
        bytes = Uint8Array.from(atob(content), character => character.charCodeAt(0));
        if (bytes.length !== length || bytesToBase64(bytes) !== content) fail('RECOVERY_ASSET_RESPONSE_INVALID');
        return bytes;
    } catch {
        bytes?.fill(0); fail('RECOVERY_ASSET_RESPONSE_INVALID');
    }
}

// invoke accepts technical request data only and returns the unwrapped callable
// result. The caller owns Firebase SDK/context configuration; no URL/token API.
export function createRecoveryAssetReader({uid, invoke, getCurrentUid, signal, isActive = () => true} = {}) {
    if (typeof uid !== 'string' || !/^[A-Za-z0-9._:-]{1,160}$/.test(uid) || typeof invoke !== 'function' ||
        typeof getCurrentUid !== 'function' || typeof isActive !== 'function') fail('RECOVERY_ASSET_ADAPTER_INVALID');
    let invalidated = false;
    const owned = new Set();
    const release = () => {
        invalidated = true;
        for (const bytes of owned) bytes.fill(0);
        owned.clear();
        signal?.removeEventListener('abort', release);
        globalThis.removeEventListener?.('vault-session-locked', release);
        globalThis.removeEventListener?.('pagehide', release);
    };
    const check = () => {
        if (invalidated || signal?.aborted || getCurrentUid() !== uid || !isActive()) {
            release(); fail('RECOVERY_ASSET_SESSION_INVALIDATED');
        }
    };
    signal?.addEventListener('abort', release, {once: true});
    globalThis.addEventListener?.('vault-session-locked', release, {once: true});
    globalThis.addEventListener?.('pagehide', release, {once: true});
    const readAsset = async (storagePath, options = {}) => {
        let bytes, transferred = false;
        try {
            check(); pathForOwner(storagePath, uid);
            exactKeys(options, [], ['expectedGeneration']);
            const expectedGeneration = options.expectedGeneration ?? undefined;
            if (expectedGeneration !== undefined && (typeof expectedGeneration !== 'string' || !GENERATION.test(expectedGeneration))) fail('RECOVERY_ASSET_REQUEST_INVALID');
            const request = {action: 'inspect', expectedOwnerUid: uid, storagePath};
            if (expectedGeneration !== undefined && expectedGeneration !== null) request.expectedGeneration = expectedGeneration;
            const response = await invoke(request); check();
            exactKeys(response, ['storagePath', 'size', 'contentType', 'generation', 'binding', 'sha256'], ['encrypted']);
            const metadata = {...response};
            if (metadata.storagePath !== storagePath || !Number.isSafeInteger(metadata.size) || metadata.size < 1 || metadata.size > MAX_BYTES ||
                typeof metadata.generation !== 'string' || !GENERATION.test(metadata.generation) ||
                (expectedGeneration !== undefined && metadata.generation !== expectedGeneration) ||
                typeof metadata.contentType !== 'string' || metadata.contentType.length > 160 ||
                !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(metadata.contentType) ||
                typeof metadata.binding !== 'string' || !SHA256.test(metadata.binding) ||
                typeof metadata.sha256 !== 'string' || !SHA256.test(metadata.sha256) ||
                (Object.hasOwn(metadata, 'encrypted') && metadata.encrypted !== 'v1')) fail('RECOVERY_ASSET_RESPONSE_INVALID');
            bytes = new Uint8Array(metadata.size); owned.add(bytes);
            for (let offset = 0; offset < metadata.size;) {
                check();
                const length = Math.min(PART_BYTES, metadata.size - offset);
                const part = await invoke({action: 'readPart', expectedOwnerUid: uid, storagePath,
                    generation: metadata.generation, binding: metadata.binding, offset, length, totalSize: metadata.size}); check();
                exactKeys(part, ['storagePath', 'generation', 'binding', 'offset', 'length', 'totalSize', 'content']);
                if (part.storagePath !== storagePath || part.generation !== metadata.generation || part.binding !== metadata.binding ||
                    part.offset !== offset || part.length !== length || part.totalSize !== metadata.size) fail('RECOVERY_ASSET_RESPONSE_INVALID');
                let temporary;
                try { temporary = decodePart(part.content, length); check(); bytes.set(temporary, offset); }
                finally { temporary?.fill(0); }
                offset += length;
            }
            const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
            let actual;
            try { check(); actual = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join(''); }
            finally { digest.fill(0); }
            if (actual !== metadata.sha256) fail('RECOVERY_ASSET_DIGEST_INVALID');
            check();
            const result = {bytes, size: metadata.size, contentType: metadata.contentType, generation: metadata.generation};
            if (metadata.encrypted !== undefined) result.encrypted = metadata.encrypted;
            owned.delete(bytes); transferred = true;
            return result;
        } catch (error) {
            const code = [error?.message, error?.code, error?.details?.reason].find(value => SAFE_CODES.has(value));
            if (code) throw new Error(code);
            throw new Error('RECOVERY_ASSET_READ_FAILED');
        } finally { if (!transferred) bytes?.fill(0); if (bytes) owned.delete(bytes); }
    };
    readAsset.release = release;
    return readAsset;
}
