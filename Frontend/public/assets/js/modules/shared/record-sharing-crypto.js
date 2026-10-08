const encoder = new TextEncoder();
const decoder = new TextDecoder();

const bytesToBase64 = value => {
    let binary = '';
    for (const byte of new Uint8Array(value)) binary += String.fromCharCode(byte);
    return btoa(binary);
};

const base64ToBytes = value => {
    if (typeof value !== 'string' || !value || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
        throw new Error('SHARING_BASE64_INVALID');
    }
    try { return Uint8Array.from(atob(value), character => character.charCodeAt(0)); }
    catch { throw new Error('SHARING_BASE64_INVALID'); }
};

const randomBytes = length => crypto.getRandomValues(new Uint8Array(length));

function requiredId(value) {
    if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,180}$/.test(value)) {
        throw new Error('SHARING_CONTEXT_REQUIRED');
    }
    return value;
}

function context(recordId, recipientId) {
    return encoder.encode(`CodiciPassword:record-share:v1:${requiredId(recordId)}:${requiredId(recipientId)}`);
}

function attachmentContext(recordId, attachmentId) {
    return encoder.encode(`CodiciPassword:attachment:v1:${requiredId(recordId)}:${requiredId(attachmentId)}`);
}

async function importRecordKey(raw, usages) {
    const bytes = new Uint8Array(raw);
    if (bytes.byteLength !== 32) throw new Error('RECORD_KEY_INVALID');
    return crypto.subtle.importKey('raw', bytes, {name: 'AES-GCM'}, false, usages);
}

async function deriveEnvelopeKey(privateKey, publicKey, salt, info, usages) {
    const sharedSecret = await crypto.subtle.deriveBits({name: 'ECDH', public: publicKey}, privateKey, 256);
    const material = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
        {name: 'HKDF', hash: 'SHA-256', salt, info},
        material, {name: 'AES-GCM', length: 256}, false, usages
    );
}

export function generateRecordKey() {
    return randomBytes(32);
}

export async function sharedAttachmentContextId({ownerUid, accountId, attachmentId, companyId = ''}) {
    const values = [ownerUid, companyId || 'private', accountId, attachmentId].map(requiredId);
    const digest = await crypto.subtle.digest('SHA-256', encoder.encode(values.join(':')));
    return `att_${bytesToBase64(digest).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}`;
}

export async function encryptRecordPayload(payload, recordKey, recordId) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('RECORD_PAYLOAD_INVALID');
    const iv = randomBytes(12);
    const id = requiredId(recordId);
    const ciphertext = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: encoder.encode(`CodiciPassword:record:v1:${id}`)},
        await importRecordKey(recordKey, ['encrypt']), encoder.encode(JSON.stringify(payload))
    );
    return {version: 1, cipher: 'AES-GCM-256', iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext)};
}

export async function decryptRecordPayload(encrypted, recordKey, recordId) {
    if (encrypted?.version !== 1 || encrypted?.cipher !== 'AES-GCM-256') throw new Error('RECORD_FORMAT_INVALID');
    const id = requiredId(recordId);
    try {
        const clear = await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: base64ToBytes(encrypted.iv), additionalData: encoder.encode(`CodiciPassword:record:v1:${id}`)},
            await importRecordKey(recordKey, ['decrypt']), base64ToBytes(encrypted.ciphertext)
        );
        return JSON.parse(decoder.decode(clear));
    } catch (error) {
        if (error?.message === 'SHARING_BASE64_INVALID' || error?.message === 'RECORD_KEY_INVALID') throw error;
        throw new Error('SHARED_AUTHENTICITY_INVALID');
    }
}

export async function encryptAttachmentForRecord(bytes, recordKey, recordId, attachmentId) {
    const clear = new Uint8Array(bytes);
    if (!clear.byteLength || clear.byteLength > 25 * 1024 * 1024) throw new Error('ATTACHMENT_SIZE_INVALID');
    const aad = attachmentContext(recordId, attachmentId);
    const fileKeyBytes = randomBytes(32);
    const contentIv = randomBytes(12);
    const ciphertext = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv: contentIv, additionalData: aad},
        await importRecordKey(fileKeyBytes, ['encrypt']), clear
    );
    const wrapIv = randomBytes(12);
    const wrappedFileKey = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv: wrapIv, additionalData: aad},
        await importRecordKey(recordKey, ['encrypt']), fileKeyBytes
    );
    fileKeyBytes.fill(0);
    return {
        version: 1, cipher: 'AES-GCM-256',
        contentIv: bytesToBase64(contentIv), wrapIv: bytesToBase64(wrapIv),
        wrappedFileKey: bytesToBase64(wrappedFileKey), ciphertext: bytesToBase64(ciphertext)
    };
}

export async function decryptAttachmentForRecord(encrypted, recordKey, recordId, attachmentId) {
    if (encrypted?.version !== 1 || encrypted?.cipher !== 'AES-GCM-256') throw new Error('ATTACHMENT_FORMAT_INVALID');
    const aad = attachmentContext(recordId, attachmentId);
    let fileKeyBytes;
    try {
        fileKeyBytes = new Uint8Array(await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: base64ToBytes(encrypted.wrapIv), additionalData: aad},
            await importRecordKey(recordKey, ['decrypt']), base64ToBytes(encrypted.wrappedFileKey)
        ));
        return new Uint8Array(await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: base64ToBytes(encrypted.contentIv), additionalData: aad},
            await importRecordKey(fileKeyBytes, ['decrypt']), base64ToBytes(encrypted.ciphertext)
        ));
    } catch (error) {
        if (error?.message === 'SHARING_BASE64_INVALID' || error?.message === 'RECORD_KEY_INVALID') throw error;
        throw new Error('SHARED_AUTHENTICITY_INVALID');
    } finally {
        fileKeyBytes?.fill(0);
    }
}

export async function wrapRecordKeyForRecipient(recordKey, recipientPublicKey, recordId, recipientId) {
    const rawKey = new Uint8Array(recordKey);
    if (rawKey.byteLength !== 32) throw new Error('RECORD_KEY_INVALID');
    const ephemeral = await crypto.subtle.generateKey({name: 'ECDH', namedCurve: 'P-256'}, true, ['deriveBits']);
    const salt = randomBytes(32), iv = randomBytes(12), info = context(recordId, recipientId);
    const wrappedKey = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: info},
        await deriveEnvelopeKey(ephemeral.privateKey, recipientPublicKey, salt, info, ['encrypt']), rawKey
    );
    return {
        version: 1, agreement: 'ECDH-P256', keyWrap: 'HKDF-SHA256+A256GCM', recipientId,
        salt: bytesToBase64(salt), iv: bytesToBase64(iv), wrappedKey: bytesToBase64(wrappedKey),
        ephemeralPublicKey: await crypto.subtle.exportKey('jwk', ephemeral.publicKey)
    };
}

export async function unwrapRecordKeyForRecipient(envelope, recipientPrivateKey, recordId, recipientId) {
    if (envelope?.version !== 1 || envelope?.agreement !== 'ECDH-P256' ||
        envelope?.keyWrap !== 'HKDF-SHA256+A256GCM' || envelope?.recipientId !== recipientId) {
        throw new Error('ENVELOPE_RECIPIENT_INVALID');
    }
    try {
        const ephemeralPublicKey = await crypto.subtle.importKey(
            'jwk', envelope.ephemeralPublicKey, {name: 'ECDH', namedCurve: 'P-256'}, false, []
        );
        const info = context(recordId, recipientId);
        const raw = await crypto.subtle.decrypt(
            {name: 'AES-GCM', iv: base64ToBytes(envelope.iv), additionalData: info},
            await deriveEnvelopeKey(recipientPrivateKey, ephemeralPublicKey,
                base64ToBytes(envelope.salt), info, ['decrypt']),
            base64ToBytes(envelope.wrappedKey)
        );
        const key = new Uint8Array(raw);
        if (key.byteLength !== 32) throw new Error('RECORD_KEY_INVALID');
        return key;
    } catch (error) {
        if (['SHARING_BASE64_INVALID', 'RECORD_KEY_INVALID', 'SHARING_CONTEXT_REQUIRED'].includes(error?.message)) throw error;
        throw new Error('SHARED_AUTHENTICITY_INVALID');
    }
}

export function serializeSharedAttachment(encrypted) {
    if (encrypted?.version !== 1 || encrypted?.cipher !== 'AES-GCM-256') throw new Error('ATTACHMENT_FORMAT_INVALID');
    return new Blob([JSON.stringify(encrypted)], {type: 'application/vnd.codicipassword.shared-attachment+json'});
}

export async function parseSharedAttachment(value) {
    const text = typeof value === 'string' ? value : decoder.decode(value instanceof Blob
        ? new Uint8Array(await value.arrayBuffer()) : new Uint8Array(value));
    if (text.length > 36 * 1024 * 1024) throw new Error('ATTACHMENT_SIZE_INVALID');
    let parsed;
    try { parsed = JSON.parse(text); } catch { throw new Error('ATTACHMENT_FORMAT_INVALID'); }
    if (parsed?.version !== 1 || parsed?.cipher !== 'AES-GCM-256') throw new Error('ATTACHMENT_FORMAT_INVALID');
    return parsed;
}
