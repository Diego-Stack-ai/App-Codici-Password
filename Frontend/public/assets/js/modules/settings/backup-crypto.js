const encoder = new TextEncoder();
const decoder = new TextDecoder();
const FORMAT = 'codici-password-backup';
const SCHEMA_VERSION = 2;
const KDF_ITERATIONS = 600000;

function bytesToBase64(value) {
    let binary = '';
    const bytes = new Uint8Array(value);
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
        binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    return btoa(binary);
}

function base64ToBytes(value) {
    const binary = atob(String(value));
    return Uint8Array.from(binary, character => character.charCodeAt(0));
}

async function digest(value) {
    return bytesToBase64(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
}

function canonicalHeader(header) {
    return JSON.stringify({
        format: header.format,
        schemaVersion: header.schemaVersion,
        ownerUid: header.ownerUid,
        backupId: header.backupId,
        createdAt: header.createdAt,
        kdf: header.kdf,
        cipher: header.cipher
    });
}

function validateHeader(header, ownerUid) {
    if (header?.format !== FORMAT || header.schemaVersion !== SCHEMA_VERSION ||
        header.ownerUid !== ownerUid || header.kdf?.name !== 'PBKDF2-SHA256' ||
        header.kdf?.iterations !== KDF_ITERATIONS || header.cipher !== 'AES-GCM-256-CHAINED') {
        throw new Error('BACKUP_FORMAT_INVALID');
    }
}

export function generateRecoveryKey() {
    const random = crypto.getRandomValues(new Uint8Array(24));
    return Array.from(random, value => value.toString(16).padStart(2, '0')).join('').match(/.{1,8}/g).join('-');
}

export function createBackupHeader(ownerUid, createdAt = Date.now()) {
    if (!ownerUid) throw new Error('BACKUP_OWNER_REQUIRED');
    return {
        format: FORMAT,
        schemaVersion: SCHEMA_VERSION,
        ownerUid,
        backupId: crypto.randomUUID(),
        createdAt,
        kdf: {name: 'PBKDF2-SHA256', iterations: KDF_ITERATIONS, salt: bytesToBase64(crypto.getRandomValues(new Uint8Array(32)))},
        cipher: 'AES-GCM-256-CHAINED'
    };
}

export async function deriveBackupKey(header, recoveryKey, ownerUid) {
    validateHeader(header, ownerUid);
    if (!/^[a-f0-9]{8}(?:-[a-f0-9]{8}){5}$/.test(String(recoveryKey))) {
        throw new Error('RECOVERY_KEY_INVALID');
    }
    const material = await crypto.subtle.importKey('raw', encoder.encode(recoveryKey), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({
        name: 'PBKDF2', hash: 'SHA-256', salt: base64ToBytes(header.kdf.salt), iterations: KDF_ITERATIONS
    }, material, {name: 'AES-GCM', length: 256}, false, ['encrypt', 'decrypt']);
}

export async function encryptBackupEntry({header, key, sequence, previousDigest = '', entry}) {
    if (!Number.isInteger(sequence) || sequence < 0 || !entry?.kind) throw new Error('BACKUP_ENTRY_INVALID');
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const aad = `${canonicalHeader(header)}\n${sequence}\n${previousDigest}`;
    const ciphertext = await crypto.subtle.encrypt(
        {name: 'AES-GCM', iv, additionalData: encoder.encode(aad)}, key, encoder.encode(JSON.stringify(entry))
    );
    const envelope = {sequence, previousDigest, iv: bytesToBase64(iv), ciphertext: bytesToBase64(ciphertext)};
    return {envelope, digest: await digest(JSON.stringify(envelope))};
}

export async function decryptBackupEntry({header, key, expectedSequence, previousDigest = '', envelope}) {
    if (envelope?.sequence !== expectedSequence || envelope.previousDigest !== previousDigest) {
        throw new Error('BACKUP_CHAIN_INVALID');
    }
    const aad = `${canonicalHeader(header)}\n${expectedSequence}\n${previousDigest}`;
    const plaintext = await crypto.subtle.decrypt({
        name: 'AES-GCM', iv: base64ToBytes(envelope.iv), additionalData: encoder.encode(aad)
    }, key, base64ToBytes(envelope.ciphertext));
    return {entry: JSON.parse(decoder.decode(plaintext)), digest: await digest(JSON.stringify(envelope))};
}

export async function verifyBackupChain({header, key, envelopes}) {
    if (!Array.isArray(envelopes) || !envelopes.length) throw new Error('BACKUP_FOOTER_MISSING');
    const entries = [];
    let previousDigest = '';
    for (let sequence = 0; sequence < envelopes.length; sequence += 1) {
        const opened = await decryptBackupEntry({
            header, key, expectedSequence: sequence, previousDigest, envelope: envelopes[sequence]
        });
        previousDigest = opened.digest;
        entries.push(opened.entry);
    }
    const footer = entries.at(-1);
    if (footer?.kind !== 'footer' || footer.entryCount !== entries.length - 1) {
        throw new Error('BACKUP_FOOTER_INVALID');
    }
    if (entries.slice(0, -1).some(entry => entry?.kind === 'footer')) throw new Error('BACKUP_FOOTER_INVALID');
    return {entries: entries.slice(0, -1), footer, finalDigest: previousDigest};
}

export function serializeBackupLine(value) {
    return `${JSON.stringify(value)}\n`;
}

export function parseBackupLine(line) {
    if (typeof line !== 'string' || !line.trim()) throw new Error('BACKUP_LINE_INVALID');
    return JSON.parse(line);
}

export {FORMAT, SCHEMA_VERSION};
