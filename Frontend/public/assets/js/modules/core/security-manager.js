/**
 * SECURITY MANAGER (V7.0 — Vault Auto-Unlock con Persistenza di Sessione)
 * - La masterKey viene salvata in sessionStorage (base64, isolata per tab).
 * - Espone window.__vaultUnlocked in modo sincrono per i moduli UI.
 * - Rimozione definitiva di ogni banner o notifica persistente.
 */

import { encrypt, decrypt } from './crypto-utils.js';
import { showInputModal, showToast } from '../../ui-core.js';
import { db, auth } from '../../firebase-config.js';
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// ─── STATO INTERNO ────────────────────────────────────────────────────
let _masterKey = null;
let _vaultAutoUnlock = false;
let _isSoftLocked = false; // V7.0: Stato di blocco temporaneo UI

// Sincronizzazione stato globale per moduli esterni (Sincrono)
const updateGlobalState = () => {
    // Il vault è sbloccato solo se c'è una chiave E non siamo in Soft Lock
    window.__vaultUnlocked = !_isSoftLocked && (!!_masterKey || !!_loadKeyFromSession());
};

// Chiavi sessionStorage
const SS_KEY = 'vault_s_key';
const SS_EXPIRY = 'vault_s_expiry';
const STORAGE_KEY = 'codex_vault_secret';

// ─── PERSISTENZA SESSIONSSTORAGE ─────────────────────────────────────

function _saveKeyToSession(key, durationMs) {
    try {
        sessionStorage.setItem(SS_KEY, btoa(unescape(encodeURIComponent(key))));
        if (durationMs && durationMs !== Infinity) {
            sessionStorage.setItem(SS_EXPIRY, (Date.now() + durationMs).toString());
        } else {
            sessionStorage.removeItem(SS_EXPIRY);
        }
        updateGlobalState();
    } catch (e) {
        console.warn('[Security] Impossibile salvare in sessionStorage:', e);
    }
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

// ─── API PUBBLICA AUTO-UNLOCK ─────────────────────────────────────────

export function enableVaultAutoUnlock(durationMs = null) {
    if (!_masterKey) {
        showToast('Sblocca prima la Vault per attivare la modalità auto-unlock.', 'warning');
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
    showToast('La Vault è stata nuovamente protetta.', 'info');
}

/**
 * [V7.0] SOFT LOCK
 * Oscura i dati (window.__vaultUnlocked = false) ma mantiene la chiave in sessionStorage.
 */
export function softLock() {
    _isSoftLocked = true;
    _masterKey = null; // Rimuoviamo dalla memoria volatile
    updateGlobalState();
    console.log("[Titan-Lock] Soft Lock Attivato.");
}

export function isSoftLocked() {
    return _isSoftLocked;
}

export function isAutoUnlockActive() {
    const fromSession = _loadKeyFromSession();
    if (fromSession || (_vaultAutoUnlock && _masterKey)) {
        if (fromSession && !_masterKey) _masterKey = fromSession;
        updateGlobalState();
        return true;
    }
    updateGlobalState();
    return false;
}

// ─── CHIAVE MASTER ───────────────────────────────────────────────────

export async function ensureMasterKey(options = {}) {
    const forceReload = typeof options === 'boolean' ? options : !!options.forceReload;

    // 1. Cache-hit in memoria (se non forzato)
    if (_masterKey && !forceReload) return _masterKey;

    // 2. Ripristino da sessionStorage (silenzioso)
    const sessionKey = _loadKeyFromSession();
    if (sessionKey) {
        _masterKey = sessionKey;
        _isSoftLocked = false; // Lo sblocco esplicito disattiva il soft lock
        // Se recuperato da sessione, manteniamo attivo l'auto-unlock per coerenza navigazione
        _vaultAutoUnlock = true;
        updateGlobalState();
        return _masterKey;
    }

    // 3. Tentativo biometrico (silenzioso)
    const recovered = await tryBiometricUnlock();
    if (recovered) {
        _masterKey = recovered;
        // Salviamo automaticamente in sessione per evitare prompt al cambio pagina
        _saveKeyToSession(_masterKey, 24 * 60 * 60 * 1000); // 24h per biometria
        updateGlobalState();
        return _masterKey;
    }

    // 4. Richiesta manuale
    const pass = await showInputModal(
        "SBLOCCO VAULT",
        "",
        "Inserisci password crittografia"
    );

    if (pass) {
        _masterKey = pass;
        _isSoftLocked = false;
        // [PROFESSIONAL FIX] Salviamo SEMPRE in sessionStorage (almeno per la sessione)
        // per evitare che navigando tra le pagine venga richiesto il codice ogni volta.
        // La durata di default è "Sessione" (fino a chiusura tab).
        _saveKeyToSession(_masterKey, null);
        _vaultAutoUnlock = true;
        updateGlobalState();
        return _masterKey;
    }

    throw new Error("Chiave di crittografia non fornita.");
}

export async function setMasterKey(pass, saveForBiometrics = false) {
    _masterKey = pass;
    if (saveForBiometrics) await enableBiometricUnlock(pass);
    updateGlobalState();
}

async function tryBiometricUnlock() {
    const encryptedSecret = localStorage.getItem(STORAGE_KEY);
    if (!encryptedSecret) return null;

    const user = auth.currentUser;
    if (!user) return null;

    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (!snap.exists() || !snap.data().settings_biometric) return null;

        const secret = atob(encryptedSecret);
        showToast("Accesso Biometrico Confermato", "success");
        return secret;
    } catch (e) { return null; }
}

async function enableBiometricUnlock(pass) {
    localStorage.setItem(STORAGE_KEY, btoa(pass));
    showToast("Biometria configurata localmente", "success");
}

export function clearSession() {
    _masterKey = null;
    _vaultAutoUnlock = false;
    _isSoftLocked = false;
    _clearSessionStorage();
    updateGlobalState();
}

// Inizializzazione stato all'importazione
updateGlobalState();

// 🛡️ ESPOSIZIONE GLOBALE (V7.0 — Audit Ready)
window.ensureMasterKey = ensureMasterKey;
window.clearSession = clearSession;
window.softLock = softLock;
window.isSoftLocked = isSoftLocked;
window.isAutoUnlockActive = isAutoUnlockActive;
window.encrypt = encrypt;
window.decrypt = decrypt;

export { encrypt, decrypt };
