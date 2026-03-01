/**
 * CRYPTO UTILS (V1.1 - Safari/WebKit Optimized)
 * Protocollo di crittografia client-side per dati sensibili.
 * Ottimizzato per compatibilità cross-platform (Chrome/Safari iOS).
 */

const ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12;

// Helper: Uint8Array -> Hex
const toHex = (buffer) => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('');

// Helper: Uint8Array -> Base64 (Safe per Safari)
const bufferToBase64 = (buffer) => {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
};

// Helper: Base64 -> Uint8Array (Safe per Safari)
const base64ToBuffer = (base64) => {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
};

/**
 * Deriva una chiave CryptoKey da una password testuale.
 * Include normalizzazione Unicode NFC per compatibilità Safari.
 */
async function deriveKey(password, salt) {
    if (!password) throw new Error("Password mancante per derivazione");

    // [SAFARI FIX] Normalizzazione NFC + Trim
    const cleanPass = String(password).normalize('NFC').trim();
    const encoder = new TextEncoder();
    const encodedPass = encoder.encode(cleanPass);

    console.log(`[CRYPTO-AUDIT] Deriving Key...`, {
        passLength: cleanPass.length,
        saltLength: salt.length,
        iterations: ITERATIONS
    });

    const passwordKey = await crypto.subtle.importKey(
        "raw",
        encodedPass,
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: ITERATIONS,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        true, // Rendiamo esportabile per il log diagnostico
        ["encrypt", "decrypt"]
    );

    // [DIAGNOSTIC LOG] Esporta la chiave (hash derivato) per confronto cross-platform
    const exported = await crypto.subtle.exportKey("raw", key);
    console.log(`[CRYPTO-AUDIT] Hash Derivato (HEX): ${toHex(exported)}`);

    return key;
}

/**
 * Cifra una stringa usando una password.
 */
export async function encrypt(text, password) {
    if (!text || !password) return text;

    try {
        const encoder = new TextEncoder();
        const data = encoder.encode(String(text));
        const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
        const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

        const key = await deriveKey(password, salt);

        const ciphertext = await crypto.subtle.encrypt(
            { name: "AES-GCM", iv: iv },
            key,
            data
        );

        const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
        combined.set(salt, 0);
        combined.set(iv, salt.length);
        combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

        return bufferToBase64(combined);
    } catch (e) {
        console.error("[CRYPTO-AUDIT] Encryption failed:", e);
        return text;
    }
}

/**
 * Decifra una stringa cifrata.
 */
export async function decrypt(base64Data, password) {
    if (!base64Data || !password) return base64Data;

    try {
        // Normalizzazione stringa Base64
        let normalized = String(base64Data).trim().replace(/-/g, '+').replace(/_/g, '/');

        // Check regex base64
        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        if (!base64Regex.test(normalized)) {
            console.warn("[CRYPTO-AUDIT] Not a valid Base64 string:", base64Data.substring(0, 10) + "...");
            return base64Data;
        }

        const combined = base64ToBuffer(normalized);

        if (combined.length < SALT_SIZE + IV_SIZE) {
            throw new Error(`Dati troppo corti: ${combined.length} bytes`);
        }

        const salt = combined.slice(0, SALT_SIZE);
        const iv = combined.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
        const ciphertext = combined.slice(SALT_SIZE + IV_SIZE);

        // [SAFARI-AUDIT V7.11] Log estremo per debug WebKit
        console.log("IV length:", iv.length);
        console.log("Cipher length:", ciphertext.length);
        console.log("Cipher byteOffset:", ciphertext.byteOffset);
        console.log("Cipher buffer length:", ciphertext.buffer.byteLength);

        const key = await deriveKey(password, salt);

        // [SAFARI iOS FIX] WebKit è estremamente rigido sugli offset degli ArrayBuffer.
        // Creiamo copie "pulite" (byteOffset = 0) per garantire la compatibilità.
        const ivClean = new Uint8Array(iv.length);
        ivClean.set(iv);

        const ctClean = new Uint8Array(ciphertext.length);
        ctClean.set(ciphertext);

        const decoded = await crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: ivClean,
                tagLength: 128 // Esplicito 128-bit tag
            },
            key,
            ctClean.buffer // Passiamo il buffer pulito (byteOffset 0)
        );

        return new TextDecoder().decode(decoded);
    } catch (e) {
        console.error("[CRYPTO-AUDIT] DECRYPTION FATAL ERROR:", {
            message: e.message,
            name: e.name,
            reason: e.name === 'OperationError' ? 'Wrong Key or Corrupted Tag/Buffer' : 'Structure Error',
            stack: e.stack
        });
        return "--ERRORE--";
    }
}
