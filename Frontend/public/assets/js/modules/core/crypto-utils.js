/**
 * CRYPTO UTILS (V1.0)
 * Protocollo di crittografia client-side per dati sensibili.
 * Utilizza Web Crypto API (SubtleCrypto) con AES-GCM e PBKDF2.
 */

const ITERATIONS = 100000;
const SALT_SIZE = 16;
const IV_SIZE = 12;

/**
 * Deriva una chiave CryptoKey da una password testuale.
 * @param {string} password 
 * @param {Uint8Array} salt 
 */
async function deriveKey(password, salt) {
    const encoder = new TextEncoder();
    const passwordKey = await crypto.subtle.importKey(
        "raw",
        encoder.encode(password),
        "PBKDF2",
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: ITERATIONS,
            hash: "SHA-256"
        },
        passwordKey,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Cifra una stringa usando una password.
 * @param {string} text 
 * @param {string} password 
 * @returns {Promise<string>} Stringa base64 contenente [salt + iv + ciphertext]
 */
export async function encrypt(text, password) {
    if (!text || !password) return text;

    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const salt = crypto.getRandomValues(new Uint8Array(SALT_SIZE));
    const iv = crypto.getRandomValues(new Uint8Array(IV_SIZE));

    const key = await deriveKey(password, salt);

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv },
        key,
        data
    );

    // Uniamo salt, iv e ciphertext in un unico buffer
    const combined = new Uint8Array(salt.length + iv.length + ciphertext.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(ciphertext), salt.length + iv.length);

    // Convertiamo in base64 per lo storage su Firestore
    return btoa(String.fromCharCode.apply(null, combined));
}

/**
 * Decifra una stringa cifrata.
 * @param {string} base64Data 
 * @param {string} password 
 * @returns {Promise<string>} Stringa decifrata
 */
export async function decrypt(base64Data, password) {
    // 1. Validazione Input
    if (!base64Data || !password) return base64Data;

    // Se l'input non è una stringa (es. oggetto legacy), lo ignoriamo restituendo vuoto o loggando
    if (typeof base64Data !== 'string') {
        console.warn("[CRYPTO] Tentativo di decifrare un valore non stringa:", base64Data);
        // Se è un oggetto con formato legacy {iv, ciphertext}, potremmo volerlo gestire, 
        // ma il protocollo V7.0 prevede stringhe Base64.
        return typeof base64Data === 'object' ? JSON.stringify(base64Data) : String(base64Data);
    }

    try {
        // 2. Normalizzazione Base64URL (sostituzione - e _ con + e /)
        let normalized = base64Data.replace(/-/g, '+').replace(/_/g, '/');

        // 3. Validazione Base64 tramite Regex (caratteri ammessi e padding)
        const base64Regex = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;
        if (!base64Regex.test(normalized)) {
            // [FAIL-SAFE V7.4] Se non è base64 valido, restituiamo il dato originale (legacy o plaintext) 
            // evitando errori bloccanti, ma segnalando il caso con un warning diagnostico.
            console.warn("[CRYPTO] Dato non cifrato o Base64 non valido rilevato:", base64Data);
            return base64Data;
        }

        // 4. Decodifica Base64 -> Buffer
        const binaryString = atob(normalized);
        const combined = new Uint8Array(binaryString.split("").map(c => c.charCodeAt(0)));

        if (combined.length < SALT_SIZE + IV_SIZE) {
            throw new Error("Dati insufficienti per salt e iv.");
        }

        const salt = combined.slice(0, SALT_SIZE);
        const iv = combined.slice(SALT_SIZE, SALT_SIZE + IV_SIZE);
        const ciphertext = combined.slice(SALT_SIZE + IV_SIZE);

        const key = await deriveKey(password, salt);

        const decoded = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv },
            key,
            ciphertext
        );

        return new TextDecoder().decode(decoded);
    } catch (e) {
        console.error("Decryption failed:", e, "Input:", base64Data);
        // Invece di lanciare errore e bloccare la UI, restituiamo un placeholder o il dato originale
        return "--- [ERROR] ---";
    }
}
