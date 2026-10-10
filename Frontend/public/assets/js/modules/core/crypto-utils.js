let _lastCryptoError = null;
export const getLastCryptoError = () => _lastCryptoError;

const ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12;
const KEK_ITERATIONS = 600000;
const FIELD_V2_ITERATIONS = 600000;
const FIELD_V2_PREFIX = 'CPFE2.';
export const VERIFIER_ITERATIONS = 600000;

const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');

const bufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

const base64ToBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

const canonicalBase64ToBuffer = (value) => {
    if (typeof value !== 'string' || !value ||
        !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
        throw new Error('BASE64_INVALID');
    }
    const bytes = base64ToBuffer(value);
    if (bufferToBase64(bytes) !== value) throw new Error('BASE64_INVALID');
    return bytes;
};

export function generateVaultKey() {
    return bufferToBase64(crypto.getRandomValues(new Uint8Array(32)));
}

export function createVaultKeyring(primaryKey, legacyKey = null) {
    return `CPVK2:${bufferToBase64(new TextEncoder().encode(JSON.stringify({ primaryKey, legacyKey })))}`;
}

function encryptionKeyCandidates(keyMaterial) {
    const value = String(keyMaterial || '');
    if (!value.startsWith('CPVK2:')) return [value];
    try {
        const keyring = JSON.parse(new TextDecoder().decode(base64ToBuffer(value.slice(6))));
        return [keyring.primaryKey, keyring.legacyKey].filter(Boolean);
    } catch (error) {
        throw new Error('VAULT_KEYRING_INVALID');
    }
}
async function importPasswordMaterial(password) {
    const encoded = new TextEncoder().encode(String(password).normalize('NFC').trim());
    try { return await crypto.subtle.importKey('raw', encoded, 'PBKDF2', false, ['deriveKey']); }
    finally { encoded.fill(0); }
}
async function deriveKek(masterPassword, salt) {
    const material = await importPasswordMaterial(masterPassword);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations: KEK_ITERATIONS, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
}

async function deriveVerifierKey(masterPassword, salt, iterations = VERIFIER_ITERATIONS) {
    if (!Number.isInteger(iterations) || iterations < VERIFIER_ITERATIONS) {
        throw new Error('VAULT_VERIFIER_KDF_INVALID');
    }
    const material = await importPasswordMaterial(masterPassword);
    return crypto.subtle.deriveKey(
        { name: 'PBKDF2', salt, iterations, hash: 'SHA-256' },
        material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
    );
}

export async function createVaultVerifier(marker, masterPassword, createdAt = Date.now()) {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
    const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
    const key = await deriveVerifierKey(masterPassword, salt);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv }, key, new TextEncoder().encode(marker)
    );
    return {
        version: 2,
        type: 'vault-verifier',
        kdf: 'PBKDF2-SHA256',
        iterations: VERIFIER_ITERATIONS,
        cipher: 'AES-GCM-256',
        salt: bufferToBase64(salt),
        iv: bufferToBase64(iv),
        ciphertext: bufferToBase64(ciphertext),
        createdAt,
        updatedAt: Date.now()
    };
}

export async function verifyVaultVerifier(verifier, marker, masterPassword) {
    if (verifier?.version !== 2 || verifier?.type !== 'vault-verifier' ||
        verifier?.kdf !== 'PBKDF2-SHA256' || verifier?.cipher !== 'AES-GCM-256') {
        return false;
    }
    try {
        const salt = base64ToBuffer(verifier.salt);
        const iv = base64ToBuffer(verifier.iv);
        const ciphertext = base64ToBuffer(verifier.ciphertext);
        const key = await deriveVerifierKey(masterPassword, salt, verifier.iterations);
        const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(plaintext) === marker;
    } catch (error) {
        return false;
    }
}

export async function wrapVaultKey(vaultKey, masterPassword, keyOrigin = 'random') {
    const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
    const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));
    const kek = await deriveKek(masterPassword, salt);
    const encodedKey = new TextEncoder().encode(vaultKey);
    let ciphertext;
    try {
        ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, encodedKey);
    } finally { encodedKey.fill(0); }
    return {
        version: 2,
        type: 'vault-key-envelope',
        kdf: 'PBKDF2-SHA256',
        iterations: KEK_ITERATIONS,
        cipher: 'AES-GCM-256',
        salt: bufferToBase64(salt),
        iv: bufferToBase64(iv),
        wrappedKey: bufferToBase64(ciphertext),
        keyOrigin,
        updatedAt: Date.now()
    };
}

export async function unwrapVaultKey(envelope, masterPassword) {
    if (envelope?.version !== 2 || envelope?.type !== 'vault-key-envelope' ||
        envelope.kdf !== 'PBKDF2-SHA256' || envelope.cipher !== 'AES-GCM-256' ||
        envelope.iterations !== KEK_ITERATIONS) {
        throw new Error('VAULT_ENVELOPE_INVALID');
    }
    const salt = base64ToBuffer(envelope.salt);
    const iv = base64ToBuffer(envelope.iv);
    const ciphertext = base64ToBuffer(envelope.wrappedKey);
    const kek = await deriveKek(masterPassword, salt);
    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kek, ciphertext);
    try { return new TextDecoder().decode(plaintext); }
    finally { new Uint8Array(plaintext).fill(0); }
}

async function deriveKey(password, salt, iterations = ITERATIONS) {
    if (!password) throw new Error("Password mancante per derivazione");
    if (iterations !== ITERATIONS && iterations !== FIELD_V2_ITERATIONS) {
        throw new Error("Unsupported field KDF");
    }

    const passwordKey = await importPasswordMaterial(password);

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );

    return key;
}

export async function encrypt(text, password) {
    if (!text) return text;

    if (!password || !String(password).normalize('NFC').trim()) {
        throw new Error("Encryption key missing or invalid");
    }

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(String(text));
        const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
        const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

        const key = await deriveKey(encryptionKeyCandidates(password)[0], salt, FIELD_V2_ITERATIONS);

        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            data
        );

        const envelope = {
            version: 2,
            kdf: 'PBKDF2-SHA256',
            iterations: FIELD_V2_ITERATIONS,
            cipher: 'AES-GCM-256',
            salt: bufferToBase64(salt),
            iv: bufferToBase64(iv),
            ciphertext: bufferToBase64(ciphertext)
        };
        return FIELD_V2_PREFIX + bufferToBase64(new TextEncoder().encode(JSON.stringify(envelope)));
    } catch (e) {
        console.error(`[CRYPTO-AUDIT] Encryption failed: ${e.name || 'Error'}`);
        throw new Error("Encryption failed");
    }
}

export async function decrypt(base64Data, password) {
    if (!base64Data || !password) return base64Data;

    try {
        const serialized = String(base64Data);
        if (serialized.startsWith(FIELD_V2_PREFIX)) {
            let envelope;
            try {
                const envelopeBytes = canonicalBase64ToBuffer(serialized.slice(FIELD_V2_PREFIX.length));
                envelope = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(envelopeBytes));
            } catch (error) {
                throw new Error('FIELD_ENVELOPE_INVALID');
            }
            if (envelope?.version !== 2 || envelope.kdf !== 'PBKDF2-SHA256' ||
                envelope.iterations !== FIELD_V2_ITERATIONS || envelope.cipher !== 'AES-GCM-256') {
                throw new Error('FIELD_ENVELOPE_INVALID');
            }
            const salt = canonicalBase64ToBuffer(envelope.salt);
            const iv = canonicalBase64ToBuffer(envelope.iv);
            const ciphertext = canonicalBase64ToBuffer(envelope.ciphertext);
            if (salt.length !== SALT_SIZE || iv.length !== IV_SIZE || ciphertext.length < 17) {
                throw new Error('FIELD_ENVELOPE_INVALID');
            }
            let lastError = null;
            for (const candidate of encryptionKeyCandidates(password)) {
                try {
                    const key = await deriveKey(candidate, salt, FIELD_V2_ITERATIONS);
                    const decoded = await crypto.subtle.decrypt(
                        { name: 'AES-GCM', iv, tagLength: 128 }, key, ciphertext
                    );
                    return new TextDecoder().decode(decoded);
                } catch (error) {
                    lastError = error;
                }
            }
            throw lastError || new Error('Decryption failed');
        }

        let normalized = serialized.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');

        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        if (!base64Regex.test(normalized)) {
            console.warn("[CRYPTO-AUDIT] Not a valid encrypted value");
            return base64Data;
        }

        const combined = base64ToBuffer(normalized);

        if (combined.length < SALT_SIZE + IV_SIZE) {
            throw new Error(`Dati troppo corti: ${combined.length} bytes`);
        }

        const salt = combined.slice(0, SALT_SIZE);
        const iv = combined.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
        const ciphertext = combined.slice(SALT_SIZE + IV_SIZE);

        const saltClean = new Uint8Array(salt.length);
        saltClean.set(salt);

        const ivClean = new Uint8Array(iv.length);
        ivClean.set(iv);

        const ctClean = new Uint8Array(ciphertext.length);
        ctClean.set(ciphertext);

        let lastError = null;
        for (const candidate of encryptionKeyCandidates(password)) {
            try {
                const key = await deriveKey(candidate, saltClean);
                const decoded = await crypto.subtle.decrypt(
                    { name: "AES-GCM", iv: ivClean, tagLength: 128 }, key, ctClean
                );
                return new TextDecoder().decode(decoded);
            } catch (error) {
                lastError = error;
            }
        }
        throw lastError || new Error('Decryption failed');
    } catch (e) {
        const errorDetail = e?.name || 'DecryptionError';
        console.error("[CRYPTO-AUDIT] Decryption failed");

        _lastCryptoError = errorDetail;

        return "--ERRORE--";
    }
}

// ─────────────────────────────────────────────────────────────
// UTILITY CONDIVISE (V1.0) — eliminano duplicazione in 6 moduli
// ─────────────────────────────────────────────────────────────

/**
 * Determina se un valore sembra cifrato (base64 valido, lunghezza minima).
 */
export function isEncryptedValue(val) {
    if (!val || typeof val !== 'string') return false;
    // CPFE2 e un namespace riservato: anche una busta malformata deve entrare
    // nel decoder e fallire chiusa, mai essere trattata come testo in chiaro.
    if (val.startsWith(FIELD_V2_PREFIX)) return true;
    if (val.length < 30) return false;
    return /^[A-Za-z0-9+/]+={0,2}$/.test(val);
}

/**
 * Tenta la decrittazione di un valore. Se non sembra cifrato o fallisce,
 * restituisce il valore originale senza errori.
 */
export async function decryptIfPossible(val, vaultKeyMaterial, fallback = '') {
    if (val === undefined || val === null) return fallback;
    if (!vaultKeyMaterial) return val;                // ← guard: senza chiave non tentiamo
    if (!isEncryptedValue(val)) return val;
    try {
        return await decrypt(val, vaultKeyMaterial);
    } catch (e) {
        return val;
    }
}

// Per i flussi che salvano o trasferiscono dati: un errore non diventa un valore salvabile.
export async function decryptRequiredValue(value, vaultKeyMaterial) {
    if (!vaultKeyMaterial) throw new Error('Sblocca il Vault per leggere i dati.');
    const decoded = await decryptIfPossible(value, vaultKeyMaterial);
    if (decoded === '--ERRORE--' || (isEncryptedValue(value) && decoded === value)) {
        throw new Error('Dato non leggibile: salvataggio interrotto per conservarlo.');
    }
    return decoded;
}
