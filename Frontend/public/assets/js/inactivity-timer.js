import { auth, db } from './firebase-config.js';
import { LOG } from './logger.js';
import { softLock } from './modules/core/security-manager.js';
import { getVaultSessionExpiry, touchVaultSession } from './modules/core/vault-session.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

/**
 * PROTOCOLLO BASE INACTIVITY TIMER (TITAN-LOCK v1.0)
 * Gestisce il blocco automatico dell'applicazione basato sul tempo di inattività.
 */

let inactivityTimeout;
let lockTimerMs = 3 * 60 * 1000;
let isInitialized = false;
let _lastPersistedActivity = 0;
let _lastActivityTimestamp = null; // in-memory: non manipolabile da localStorage

/**
 * Inizializza il timer di inattività.
 * Deve essere chiamato una sola volta, preferibilmente in main.js
 */
export function initInactivityTimer() {
    if (isInitialized) return;
    isInitialized = true;

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await syncTimeoutWithFirestore(user.uid);
            const expired = checkLastActivity();
            if (!expired) startMonitoring();
        } else {
            stopMonitoring();
        }
    });

    // Controllo quando l'utente torna sulla pagina
    window.addEventListener('focus', () => {
        checkLastActivity();
    });
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') checkLastActivity();
    });
    window.addEventListener('vault-session-unlocked', recordActivity);
}

/**
 * Recupera il timeout personalizzato salvato nel profilo utente.
 */
export async function syncTimeoutWithFirestore(uid) {
    try {
        const docRef = doc(db, "users", uid);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            let minutes = data.lock_timeout ?? 3;

            // [V8.0] 'Subito' (0) rimosso definitivamente. Fallback su 1 min per vecchi profili.
            if (minutes === 0) minutes = 1;

            lockTimerMs = minutes * 60 * 1000;
        }
    } catch (e) {
        console.error("[Titan-Lock] Errore sincronizzazione timeout:", e);
    }
}

/**
 * Controlla se l'ultima attività registrata è oltre il limite consentito.
 */
function checkLastActivity() {
    const sessionExpiry = getVaultSessionExpiry();
    if (sessionExpiry && Date.now() >= sessionExpiry) {
        lockVaultForInactivity();
        return true;
    }
    if (!_lastActivityTimestamp) return false;
    const elapsed = Date.now() - _lastActivityTimestamp;

    if (elapsed > lockTimerMs) {
        lockVaultForInactivity();
        return true;
    }
    return false;
}

/**
 * Registra un'attività utente e resetta il timer.
 */
function recordActivity() {
    if (Date.now() - _lastPersistedActivity >= 1000) {
        touchVaultSession(lockTimerMs);
        _lastPersistedActivity = Date.now();
    }
    _lastActivityTimestamp = Date.now(); // in-memory, non manipolabile da DevTools

    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(lockVaultForInactivity, lockTimerMs);
}

/**
 * Esegue il logout automatico e reindirizza alla login.
 */
function lockVaultForInactivity() {
    try {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'index.html' || currentPage === '') return;

        softLock();
        LOG("[Titan-Lock] Vault bloccata per inattività.");
        window.location.reload();
    } catch (e) {
        console.error("[Titan-Lock] Errore durante il blocco Vault:", e);
        window.location.href = 'index.html';
    }
}

/**
 * Attiva i listener per rilevare l'interazione dell'utente.
 */
function startMonitoring() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(name => {
        document.addEventListener(name, recordActivity, { passive: true });
    });
    recordActivity(); // Prima registrazione immediata
}

/**
 * Rimuove i listener e ferma il timer.
 */
function stopMonitoring() {
    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(name => {
        document.removeEventListener(name, recordActivity);
    });
}
