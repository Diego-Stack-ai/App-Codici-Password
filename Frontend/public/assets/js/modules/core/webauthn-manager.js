/**
 * WEBAUTHN MANAGER (PRF EXTENSION)
 * Gestisce la registrazione e lo sblocco biometrico usando WebAuthn con estensione PRF.
 */

// Costanti
const PRF_SALT_SIZE = 32;
const HKDF_SALT_SIZE = 32;
const AES_IV_SIZE = 12;

/** Verifica se il browser supporta WebAuthn. */
export async function isWebAuthnSupported() {
    return window.PublicKeyCredential !== undefined && typeof window.PublicKeyCredential === 'function';
}

// Convert ArrayBuffer to Base64 (transport only)
function bufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Convert Base64 to ArrayBuffer
function base64ToBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

/**
 * Registra una nuova credenziale con estensione PRF.
 * Restituisce: { credentialId, prfSalt }
 */
export async function setupWebAuthnPrf(userId, userEmail) {
    if (!await isWebAuthnSupported()) throw new Error("WebAuthn non supportato.");

    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const prfSalt = crypto.getRandomValues(new Uint8Array(PRF_SALT_SIZE));

    // Il dominio deve combaciare con l'origin
    const hostname = window.location.hostname;
    // Se siamo su localhost non mettiamo l'id, altrimenti firebaseapp.com
    const rp = { name: "AppCodiciPassword" };
    if (hostname !== "localhost" && hostname !== "127.0.0.1") {
        rp.id = hostname;
    }

    const publicKey = {
        challenge: challenge,
        rp: rp,
        user: {
            id: new TextEncoder().encode(userId || "user_id_default"),
            name: userEmail || "user@example.com",
            displayName: userEmail || "Utente"
        },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }, { alg: -257, type: "public-key" }],
        authenticatorSelection: {
            authenticatorAttachment: "platform",
            userVerification: "required"
        },
        timeout: 60000,
        extensions: {
            prf: {
                eval: {
                    first: prfSalt
                }
            }
        }
    };

    try {
        const credential = await navigator.credentials.create({ publicKey });
        const extResults = credential.getClientExtensionResults();
        
        if (!extResults.prf || !extResults.prf.enabled) {
            throw new Error("PRF_NOT_SUPPORTED");
        }

        return {
            credentialId: bufferToBase64(credential.rawId),
            prfSalt: bufferToBase64(prfSalt)
        };
    } catch (e) {
        console.error("WebAuthn Registration Error", e);
        throw e;
    }
}

/**
 * Ottiene l'output PRF sbloccando la credenziale.
 */
export async function getPrfOutput(credentialIdBase64, prfSaltBase64) {
    const challenge = crypto.getRandomValues(new Uint8Array(32));
    const rawId = base64ToBuffer(credentialIdBase64);
    const prfSalt = base64ToBuffer(prfSaltBase64);

    const hostname = window.location.hostname;
    const rpId = (hostname !== "localhost" && hostname !== "127.0.0.1") ? hostname : undefined;

    const publicKey = {
        challenge: challenge,
        rpId: rpId,
        allowCredentials: [{
            id: rawId,
            type: "public-key",
            transports: ["internal"]
        }],
        userVerification: "required",
        timeout: 60000,
        extensions: {
            prf: {
                eval: {
                    first: prfSalt
                }
            }
        }
    };

    try {
        const assertion = await navigator.credentials.get({ publicKey });
        const extResults = assertion.getClientExtensionResults();

        if (!extResults.prf || !extResults.prf.results || !extResults.prf.results.first) {
            throw new Error("Impossibile generare l'output PRF (Autenticatore non compatibile o annullato).");
        }

        return extResults.prf.results.first; // ArrayBuffer
    } catch (e) {
        console.error("WebAuthn Auth Error", e);
        throw e;
    }
}

/** Deriva chiave AES da output PRF usando HKDF */
export async function deriveHkdfKey(prfOutput, hkdfSaltBase64) {
    const hkdfSalt = base64ToBuffer(hkdfSaltBase64);
    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        prfOutput,
        "HKDF",
        false,
        ["deriveKey"]
    );

    return crypto.subtle.deriveKey(
        {
            name: "HKDF",
            salt: hkdfSalt,
            info: new TextEncoder().encode("AppCodiciPassword-PRF"),
            hash: "SHA-256"
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 },
        false,
        ["encrypt", "decrypt"]
    );
}

/**
 * Cifra la Master Key usando la chiave AES derivata.
 */
export async function encryptVaultSecret(masterKey, aesKey) {
    const iv = crypto.getRandomValues(new Uint8Array(AES_IV_SIZE));
    const encodedData = new TextEncoder().encode(masterKey);

    const ciphertext = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv, additionalData: new TextEncoder().encode("codex-v1") },
        aesKey,
        encodedData
    );

    return {
        ciphertext: bufferToBase64(ciphertext),
        iv: bufferToBase64(iv)
    };
}

/**
 * Decifra la Master Key usando la chiave AES derivata.
 */
export async function decryptVaultSecret(ciphertextBase64, ivBase64, aesKey) {
    const ciphertext = base64ToBuffer(ciphertextBase64);
    const iv = base64ToBuffer(ivBase64);

    try {
        const decrypted = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv, additionalData: new TextEncoder().encode("codex-v1") },
            aesKey,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        throw new Error("Decifratura fallita: Chiave o Dati corrotti.");
    }
}

export function generateHkdfSalt() {
    return bufferToBase64(crypto.getRandomValues(new Uint8Array(HKDF_SALT_SIZE)));
}
