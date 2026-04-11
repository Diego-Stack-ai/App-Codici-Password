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
        if (!key) return;
        // [SAFARI COMPAT] Normalizzazione prima del salvataggio
        const cleanKey = String(key).normalize('NFC').trim();
        const encoded = btoa(unescape(encodeURIComponent(cleanKey)));

        sessionStorage.setItem(SS_KEY, encoded);
        if (durationMs && durationMs !== Infinity) {
            sessionStorage.setItem(SS_EXPIRY, (Date.now() + durationMs).toString());
        } else {
            sessionStorage.removeItem(SS_EXPIRY);
        }
        updateGlobalState();
    } catch (e) {
        console.warn('[SECURITY-AUDIT] sessionStorage save failed:', e);
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
        const decoded = decodeURIComponent(escape(atob(stored)));

        return decoded;
    } catch (e) {
        console.error("[SECURITY-AUDIT] Session load error:", e);
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

    // 2. Ripristino da sessionStorage (silenzioso ma segnalato se nuovo)
    const sessionKey = _loadKeyFromSession();
    if (sessionKey && !forceReload) {
        _masterKey = sessionKey;
        _isSoftLocked = false;
        _vaultAutoUnlock = true;
        updateGlobalState();
        return _masterKey;
    }

    // 3. Tentativo biometrico (solo se non forzato)
    if (!forceReload) {
        const recovered = await tryBiometricUnlock();
        if (recovered) {
            _masterKey = recovered;
            _saveKeyToSession(_masterKey, 24 * 60 * 60 * 1000);
            updateGlobalState();
            showToast("Vault sbloccato automaticamente (Biometria)", "success");
            return _masterKey;
        }
    }

    // 4. Richiesta manuale (Sempre se forceReload è true o altri falliscono)
    const pass = await showInputModal(
        "SBLOCCO VAULT",
        '',
        "Inserisci la password principale..."
    );

    if (pass) {
        // [HEALING V7.5] Trim automatico della password per evitare errori comuni su Mobile (spazi extra)
        const cleanPass = pass.trim();
        _masterKey = cleanPass;
        _isSoftLocked = false;
        _saveKeyToSession(_masterKey, null);
        _vaultAutoUnlock = true;
        updateGlobalState();
        showToast("Vault sbloccata correttamente!", "success");
        return _masterKey;
    }

    throw new Error("Chiave di crittografia non fornita.");
}

/**
 * [V7.6] RESET TOTALE VAULT
 * Pulisce ogni traccia della chiave (Sessione + Locale) per permettere un ripristino manuale campo per campo.
 */
export function resetVault() {
    _masterKey = null;
    _vaultAutoUnlock = false;
    _isSoftLocked = false;
    _clearSessionStorage();
    localStorage.removeItem(STORAGE_KEY);
    updateGlobalState();
    showToast("Cache Vault pulita. Ricarica la pagina per sbloccare manualmente.", "info");
    setTimeout(() => window.location.reload(), 1500);
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

        // [SAFARI COMPAT] Decodifica e Normalizzazione
        const secret = decodeURIComponent(escape(atob(encryptedSecret))).normalize('NFC').trim();

        showToast("Accesso Biometrico Confermato", "success");
        return secret;
    } catch (e) {
        console.error("[SECURITY-AUDIT] Biometric recovery failed:", e);
        return null;
    }
}

async function enableBiometricUnlock(pass) {
    if (!pass) return;
    const cleanPass = String(pass).normalize('NFC').trim();
    const encoded = btoa(unescape(encodeURIComponent(cleanPass)));
    localStorage.setItem(STORAGE_KEY, encoded);

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
window.resetVault = resetVault;
window.encrypt = encrypt;
window.decrypt = decrypt;

export { encrypt, decrypt };
