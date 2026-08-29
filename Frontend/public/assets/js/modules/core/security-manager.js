/**
 * SECURITY MANAGER (V8.0 - Vault Auto-Unlock con WebAuthn PRF)
 * - La masterKey viene salvata in sessionStorage (base64, isolata per tab).
 * - Sblocco biometrico usa WebAuthn PRF.
 */

import { encrypt, decrypt } from './crypto-utils.js';
import { showInputModal, showToast, showConfirmModal } from '../../ui-core.js';
import { db, auth } from '../../firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { setupWebAuthnPrf, getPrfOutput, deriveHkdfKey, encryptVaultSecret, decryptVaultSecret, generateHkdfSalt, isWebAuthnSupported, isPrfSupported } from './webauthn-manager.js';

let _masterKey = null;
let _vaultAutoUnlock = false;
let _isSoftLocked = false;
const updateGlobalState = () => {};

const SS_KEY = 'vault_s_key';
const SS_EXPIRY = 'vault_s_expiry';
const STORAGE_KEY = 'codex_vault_secret';

function _saveKeyToSession(key, durationMs) {
    try {
        if (!key) return;
        const cleanKey = String(key).normalize('NFC').trim();
        const encoded = btoa(unescape(encodeURIComponent(cleanKey)));

        sessionStorage.setItem(SS_KEY, encoded);
        if (durationMs && durationMs !== Infinity) {
            sessionStorage.setItem(SS_EXPIRY, (Date.now() + durationMs).toString());
        } else {
            sessionStorage.removeItem(SS_EXPIRY);
        }
        updateGlobalState();
    } catch (e) {}
}

function _loadKeyFromSession() {
    try {
        const expiry = sessionStorage.getItem(SS_EXPIRY);
        if (expiry && Date.now() > parseInt(expiry)) {
            _clearSessionStorage();
            return null;
        }
        const stored = sessionStorage.getItem(SS_KEY);
        if (!stored) return null;
        return decodeURIComponent(escape(atob(stored)));
    } catch (e) {
        _clearSessionStorage();
        return null;
    }
}

function _clearSessionStorage() {
    sessionStorage.removeItem(SS_KEY);
    sessionStorage.removeItem(SS_EXPIRY);
    updateGlobalState();
}

export function enableVaultAutoUnlock(durationMs = null) {
    if (!_masterKey) {
        showToast('Sblocca prima la Vault.', 'warning');
        return false;
    }
    _vaultAutoUnlock = true;
    _saveKeyToSession(_masterKey, durationMs);
    updateGlobalState();
    return true;
}

export function disableVaultAutoUnlock() {
    _vaultAutoUnlock = false;
    _masterKey = null;
    _isSoftLocked = false;
    _clearSessionStorage();
    localStorage.removeItem(STORAGE_KEY);
    showToast('La Vault è stata protetta. Biometria disabilitata.', 'info');
}

export function softLock() {
    _isSoftLocked = true;
    _masterKey = null;
    updateGlobalState();
}

export function isSoftLocked() { return _isSoftLocked; }

export function isAutoUnlockActive() {
    const fromSession = _loadKeyFromSession();
    if (fromSession || (_vaultAutoUnlock && _masterKey)) {
        if (fromSession && !_masterKey) _masterKey = fromSession;
        updateGlobalState();
        return true;
    }
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return true;
    return false;
}

export async function ensureMasterKey(options = {}) {
    const forceReload = typeof options === 'boolean' ? options : !!options.forceReload;

    if (_masterKey && !forceReload) return _masterKey;

    const sessionKey = _loadKeyFromSession();
    if (sessionKey && !forceReload) {
        _masterKey = sessionKey;
        _isSoftLocked = false;
        _vaultAutoUnlock = true;
        updateGlobalState();
        return _masterKey;
    }

    if (!forceReload) {
        const recovered = await tryBiometricUnlock();
        if (recovered) {
            _masterKey = recovered;
            _saveKeyToSession(_masterKey, 24 * 60 * 60 * 1000);
            updateGlobalState();
            return _masterKey;
        }
    }

    const storedSecret = localStorage.getItem(STORAGE_KEY);
    let isOldFormat = storedSecret && !storedSecret.startsWith('{');
    
    let msg = "Inserisci la password principale...";
    if (isOldFormat) {
        msg = "Migrazione sicurezza in corso: inserisci la Master Password per aggiornare l'accesso biometrico.";
    }

    const pass = await showInputModal("SBLOCCO VAULT", '', msg);

    if (pass) {
        const cleanPass = pass.trim();
        _masterKey = cleanPass;
        _isSoftLocked = false;
        _saveKeyToSession(_masterKey, null);
        _vaultAutoUnlock = true;
        updateGlobalState();

        if (isOldFormat) {
            // Verify and migrate
            const oldDecoded = decodeURIComponent(escape(atob(storedSecret))).normalize('NFC').trim();
            if (oldDecoded === cleanPass) {
                const migrated = await enableBiometricUnlock(cleanPass);
                if (migrated) {
                    showToast("Migrazione WebAuthn completata con successo!", "success");
                }
            }
        }

        showToast("Vault sbloccata correttamente!", "success");
        return _masterKey;
    }

    throw new Error("Chiave di crittografia non fornita.");
}

export function resetVault() {
    _masterKey = null;
    _vaultAutoUnlock = false;
    _isSoftLocked = false;
    _clearSessionStorage();
    localStorage.removeItem(STORAGE_KEY);
    updateGlobalState();
    showToast("Cache Vault pulita.", "info");
    setTimeout(() => window.location.reload(), 1500);
}

export async function setMasterKey(pass, saveForBiometrics = false) {
    _masterKey = pass;
    const biometricAlreadyEnabled = !!localStorage.getItem(STORAGE_KEY);
    if (saveForBiometrics || biometricAlreadyEnabled) {
        await enableBiometricUnlock(pass);
    }
    updateGlobalState();
}

async function tryBiometricUnlock() {
    const encryptedSecret = localStorage.getItem(STORAGE_KEY);
    if (!encryptedSecret) return null;

    if (!encryptedSecret.startsWith('{')) {
        // Old format detected. Do not auto-unlock. Let fallback to manual input to trigger migration.
        return null;
    }

    try {
        const data = JSON.parse(encryptedSecret);
        if (data.version !== 1 || !data.credentialId || !data.encryptedMasterKey) return null;

        const prfOutput = await getPrfOutput(data.credentialId, data.prfSalt);
        const aesKey = await deriveHkdfKey(prfOutput, data.hkdfSalt);
        const secret = await decryptVaultSecret(data.encryptedMasterKey, data.iv, aesKey);
        
        showToast("Accesso Biometrico Confermato", "success");
        return secret;
    } catch (e) {
        console.error("[SECURITY-AUDIT] Biometric recovery failed:", e);
        // Do not delete local storage on auth cancellation or failure. Fallback to manual.
        return null;
    }
}

export async function enableBiometricUnlock(pass) {
    if (!pass) return false;
    
    if (!await isWebAuthnSupported()) {
        showToast("WebAuthn non è supportato su questo dispositivo.", "error");
        return false;
    }

    const cleanPass = String(pass).normalize('NFC').trim();
    
    try {
        const user = auth.currentUser;
        if (!user) throw new Error("Utente non loggato");

        const setup = await setupWebAuthnPrf(user.uid, user.email);
        const prfOutput = await getPrfOutput(setup.credentialId, setup.prfSalt);
        
        const hkdfSalt = generateHkdfSalt();
        const aesKey = await deriveHkdfKey(prfOutput, hkdfSalt);
        
        const encrypted = await encryptVaultSecret(cleanPass, aesKey);

        const container = {
            version: 1,
            credentialId: setup.credentialId,
            encryptedMasterKey: encrypted.ciphertext,
            iv: encrypted.iv,
            hkdfSalt: hkdfSalt,
            prfSalt: setup.prfSalt,
            algorithm: "AES-GCM-256",
            createdAt: Date.now()
        };

        localStorage.setItem(STORAGE_KEY, JSON.stringify(container));

        // Aggiorna impostazione su Firebase
        await updateDoc(doc(db, "users", user.uid), { settings_biometric: true });

        showToast("Biometria PRF configurata localmente in modo sicuro", "success");
        return true;
    } catch (e) {
        console.error("Biometric setup failed", e);
        if (e.message === 'PRF_NOT_SUPPORTED') {
            showToast("Il dispositivo non supporta l'estensione PRF. Impossibile usare la biometria offline.", "error");
            // Se fallisce, eliminiamo anche la falsa biometria se c'era
            localStorage.removeItem(STORAGE_KEY);
        } else {
            showToast("Errore durante la configurazione della biometria.", "error");
        }
        return false;
    }
}

export function clearSession() {
    _masterKey = null;
    _vaultAutoUnlock = false;
    _isSoftLocked = false;
    _clearSessionStorage();
    updateGlobalState();
}

updateGlobalState();
export { encrypt, decrypt };
