// Prova dei campi per il censimento: un solo candidato, senza fallback fra chiavi.
// Replica in sola lettura i due formati letti da crypto-utils.decrypt (v1 a 100.000
// iterazioni e CPFE2 a 600.000) senza modificarne il modulo: nessun log, nessuno stato
// globale e nessun testo in chiaro restituito. L'equivalenza con decrypt è verificata
// da tests/vault-format-census.test.mjs.
const V1_ITERATIONS = 100000;
const CPFE2_ITERATIONS = 600000;
const CPFE2_PREFIX = 'CPFE2.';
const SALT_SIZE = 16;
const IV_SIZE = 12;
const CANONICAL_BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

function base64ToBytes(value) {
    return Uint8Array.from(atob(value), char => char.charCodeAt(0));
}

function canonicalBytes(value) {
    if (typeof value !== 'string' || !value || !CANONICAL_BASE64.test(value)) throw new Error('BASE64_INVALID');
    const bytes = base64ToBytes(value);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    if (btoa(binary) !== value) throw new Error('BASE64_INVALID');
    return bytes;
}

function parseCpfe2(value) {
    let envelope;
    try {
        const bytes = canonicalBytes(value.slice(CPFE2_PREFIX.length));
        envelope = JSON.parse(new TextDecoder('utf-8', {fatal: true}).decode(bytes));
    } catch (error) {
        return null;
    }
    if (envelope?.version !== 2 || envelope.kdf !== 'PBKDF2-SHA256' ||
        envelope.iterations !== CPFE2_ITERATIONS || envelope.cipher !== 'AES-GCM-256') return null;
    try {
        const salt = canonicalBytes(envelope.salt);
        const iv = canonicalBytes(envelope.iv);
        const ciphertext = canonicalBytes(envelope.ciphertext);
        if (salt.length !== SALT_SIZE || iv.length !== IV_SIZE || ciphertext.length < 17) return null;
        return {salt, iv, ciphertext, iterations: CPFE2_ITERATIONS};
    } catch (error) {
        return null;
    }
}

function parseV1(value) {
    const normalized = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
    if (!CANONICAL_BASE64.test(normalized)) return null;
    const combined = base64ToBytes(normalized);
    if (combined.length < SALT_SIZE + IV_SIZE + 16) return null;
    return {
        salt: combined.slice(0, SALT_SIZE),
        iv: combined.slice(SALT_SIZE, SALT_SIZE + IV_SIZE),
        ciphertext: combined.slice(SALT_SIZE + IV_SIZE),
        iterations: V1_ITERATIONS
    };
}

export async function probeFieldKey(serializedValue, keyString) {
    const candidate = String(keyString || '');
    if (!candidate.normalize('NFC').trim() || candidate.startsWith('CPVK2:')) {
        throw new Error('PROBE_SINGLE_KEY_REQUIRED');
    }
    const value = String(serializedValue || '');
    const parts = value.startsWith(CPFE2_PREFIX) ? parseCpfe2(value) : parseV1(value);
    if (!parts) return 'malformed';
    const encoded = new TextEncoder().encode(candidate.normalize('NFC').trim());
    try {
        const material = await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']);
        const key = await crypto.subtle.deriveKey(
            {name: 'PBKDF2', salt: parts.salt, iterations: parts.iterations, hash: 'SHA-256'},
            material, {name: 'AES-GCM', length: 256}, false, ['decrypt']
        );
        const clear = await crypto.subtle.decrypt({name: 'AES-GCM', iv: parts.iv, tagLength: 128}, key, parts.ciphertext);
        new Uint8Array(clear).fill(0);
        return 'opened';
    } catch (error) {
        return 'closed';
    } finally {
        encoded.fill(0);
    }
}
