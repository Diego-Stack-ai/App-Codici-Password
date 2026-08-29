/**
 * SECURITY MANAGER (V8.0 - Vault Auto-Unlock con WebAuthn PRF)
 * - La masterKey viene salvata in sessionStorage (base64, isolata per tab).
 * - Sblocco biometrico usa WebAuthn PRF.
 */

import { encrypt, decrypt } from './crypto-utils.js';
import { showInputModal, showToast, showConfirmModal } from '../../ui-core.js';
import { db, auth } from '../../firebase-config.js';
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { setupWebAuthnPrf, getPrfOutput, deriveHkdfKey, encryptVaultSecret, decryptVaultSecret, generateHkdfSalt, isWebAuthnSupported } from './webauthn-manager.js';

let _masterKey = null;
let _vaultAutoUnlock = false;
let _isSoftLocked = false;
const updateGlobalState = () => {};

const STORAGE_PREFIX = 'codex_vault_secret_';
const LEGACY_STORAGE_KEY = 'codex_vault_secret';

function getStorageKey(uid) {
    return uid ? `${STORAGE_PREFIX}${uid}` : null;
}

function _clearSessionStorage() {
    sessionStorage.removeItem('vault_s_key');
    sessionStorage.removeItem('vault_s_expiry');
    updateGlobalState();
}

// FIX 4: Cleanup centralizzato su logout / cambio UID
let _currentUid = null;
onAuthStateChanged(auth, (user) => {
    if (!user) {
        clearSession();
        _currentUid = null;
    } else {
        if (_currentUid && _currentUid !== user.uid) {
            clearSession();
        }
        _currentUid = user.uid;
    }
});

export function enableVaultAutoUnlock(durationMs = null) {
    if (!_masterKey) {
        showToast('Sblocca prima la Vault.', 'warning');
        return false;
    }
    _vaultAutoUnlock = true;
    updateGlobalState();
    return true;
}

export function disableVaultAutoUnlock() {
    _vaultAutoUnlock = false;
    _masterKey = null;
    _isSoftLocked = false;
    _clearSessionStorage();
    const uid = auth.currentUser?.uid;
    if (uid) {
        localStorage.removeItem(getStorageKey(uid));
    }
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    showToast('La Vault è stata protetta. Biometria disabilitata.', 'info');
}

export function softLock() {
    _isSoftLocked = true;
    _masterKey = null;
    updateGlobalState();
}

export function isSoftLocked() { return _isSoftLocked; }

export function isAutoUnlockActive() {
    if (_vaultAutoUnlock && _masterKey) {
        updateGlobalState();
        return true;
    }
    const uid = auth.currentUser?.uid;
    const scopedKey = getStorageKey(uid);
    if (scopedKey && localStorage.getItem(scopedKey)) return true;
    if (localStorage.getItem(LEGACY_STORAGE_KEY)) return true;
    return false;
}

export async function ensureMasterKey(options = {}) {
    const forceReload = typeof options === 'boolean' ? options : !!options.forceReload;

    if (_masterKey && !forceReload) return _masterKey;

    if (!forceReload) {
        const recovered = await tryBiometricUnlock();
        if (recovered) {
            _masterKey = recovered;
            updateGlobalState();
            return _masterKey;
        }
    }

    const uid = auth.currentUser?.uid;
    const scopedKey = getStorageKey(uid);
    let storedSecret = scopedKey ? localStorage.getItem(scopedKey) : null;
    let isLegacy = false;

    if (!storedSecret) {
        storedSecret = localStorage.getItem(LEGACY_STORAGE_KEY);
        isLegacy = !!storedSecret;
    }
    
    let isOldFormat = storedSecret && !storedSecret.startsWith('{');
    
    let msg = "Inserisci la password principale...";
    if (isOldFormat || isLegacy) {
        msg = "Migrazione sicurezza in corso: inserisci la Master Password per aggiornare l'accesso biometrico.";
    }

    const pass = await showInputModal("SBLOCCO VAULT", '', msg);

    if (pass) {
        const cleanPass = pass.trim();
        _masterKey = cleanPass;
        _isSoftLocked = false;
        _vaultAutoUnlock = true;
        updateGlobalState();

        if (isOldFormat || isLegacy) {
            // Verify and migrate
            let isValid = true;
            if (isOldFormat) {
                const oldDecoded = decodeURIComponent(escape(atob(storedSecret))).normalize('NFC').trim();
                isValid = (oldDecoded === cleanPass);
            }
            if (isValid) {
                const migrated = await enableBiometricUnlock(cleanPass);
                if (migrated) {
                    localStorage.removeItem(LEGACY_STORAGE_KEY);
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
    const uid = auth.currentUser?.uid;
    if (uid) localStorage.removeItem(getStorageKey(uid));
    localStorage.removeItem(LEGACY_STORAGE_KEY);
    updateGlobalState();
    showToast("Cache Vault pulita.", "info");
    setTimeout(() => window.location.reload(), 1500);
}

export async function setMasterKey(pass, saveForBiometrics = false) {
    _masterKey = pass;
    const uid = auth.currentUser?.uid;
    const biometricAlreadyEnabled = !!(uid && localStorage.getItem(getStorageKey(uid))) || !!localStorage.getItem(LEGACY_STORAGE_KEY);
    if (saveForBiometrics || biometricAlreadyEnabled) {
        await enableBiometricUnlock(pass);
    }
    updateGlobalState();
}

async function tryBiometricUnlock() {
    const uid = auth.currentUser?.uid;
    if (!uid) return null;
    
    let encryptedSecret = localStorage.getItem(getStorageKey(uid));
    if (!encryptedSecret) {
        encryptedSecret = localStorage.getItem(LEGACY_STORAGE_KEY);
    }
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
        
        // FIX 3: Evitare doppio prompt
        const prfOutput = setup.prfOutput || await getPrfOutput(setup.credentialId, setup.prfSalt);
        
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

        const scopedKey = getStorageKey(user.uid);
        localStorage.setItem(scopedKey, JSON.stringify(container));
        
        // Clean legacy if it existed
        localStorage.removeItem(LEGACY_STORAGE_KEY);

        // Aggiorna impostazione su Firebase
        await updateDoc(doc(db, "users", user.uid), { settings_biometric: true });

        showToast("Biometria PRF configurata localmente in modo sicuro", "success");
        return true;
    } catch (e) {
        console.error("Biometric setup failed", e);
        if (e.message === 'PRF_NOT_SUPPORTED') {
            showToast("Il dispositivo non supporta l'estensione PRF. Impossibile usare la biometria offline.", "error");
            // Se fallisce, eliminiamo anche la falsa biometria se c'era
            const uid = auth.currentUser?.uid;
            if (uid) localStorage.removeItem(getStorageKey(uid));
            localStorage.removeItem(LEGACY_STORAGE_KEY);
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
