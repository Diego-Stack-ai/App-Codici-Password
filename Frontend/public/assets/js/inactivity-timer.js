import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { disableVaultAutoUnlock } from './modules/core/security-manager.js';

/**
 * PROTOCOLLO BASE INACTIVITY TIMER (TITAN-LOCK v1.0)
 * Gestisce il blocco automatico dell'applicazione basato sul tempo di inattività.
 */

let inactivityTimeout;
let softLockTimeout;
let logoutTimerMs = 3 * 60 * 1000; // Default Hard Logout 3 minuti
let softLockTimerMs = 1 * 60 * 1000; // Default Soft Lock 1 minuto
let isInitialized = false;

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
            startMonitoring();
            checkLastActivity();
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

            logoutTimerMs = minutes * 60 * 1000;
            console.log(`[Titan-Lock] Timeout impostato a: ${minutes} min (${logoutTimerMs}ms)`);
        }
    } catch (e) {
        console.error("[Titan-Lock] Errore sincronizzazione timeout:", e);
    }
}

/**
 * Controlla se l'ultima attività registrata è oltre il limite consentito.
 */
function checkLastActivity() {
    const lastActive = localStorage.getItem('titan_last_activity');
    if (lastActive) {
        const elapsed = Date.now() - parseInt(lastActive);

        // Livello 2: Hard Logout
        if (elapsed > logoutTimerMs) {
            console.warn(`[Titan-Lock] Hard Logout: ${Math.round(elapsed / 1000)}s passati.`);
            performAutoLogout();
            return;
        }

        // Livello 1: Soft Lock
        if (elapsed > softLockTimerMs) {
            console.warn(`[Titan-Lock] Soft Lock: ${Math.round(elapsed / 1000)}s passati.`);
            try {
                const { softLock } = import.meta.glob ? {} : window; // Fallback se non exportato correttamente
                if (typeof window.softLock === 'function') window.softLock();
            } catch (e) { }
        }
    }
}

/**
 * Registra un'attività utente e resetta il timer.
 */
function recordActivity() {
    localStorage.setItem('titan_last_activity', Date.now().toString());

    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    if (softLockTimeout) clearTimeout(softLockTimeout);

    // Imposta Timer Soft Lock
    softLockTimeout = setTimeout(() => {
        if (typeof window.softLock === 'function') window.softLock();
    }, softLockTimerMs);

    // Imposta Timer Hard Logout
    inactivityTimeout = setTimeout(performAutoLogout, logoutTimerMs);
}

/**
 * Esegue il logout automatico e reindirizza alla login.
 */
async function performAutoLogout() {
    try {
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'index.html' || currentPage === '') return;

        // [V3.0] LOCK VAULT FIRST (Clear Session Storage & Memory)
        // Questo protegge i dati immediatamente senza attendere il logout di Firebase.
        try {
            disableVaultAutoUnlock();
            console.log("[Titan-Lock] Vault bloccata per inattività.");
        } catch (e) { }

        // [V3.0] Decidi se fare logout completo o solo blocco Vault
        // Se il timeout è molto breve (es. < 1 min), facciamo solo blocco Vault + reload
        // Se è lungo, facciamo logout completo.
        if (logoutTimerMs <= 60000) {
            console.log("[Titan-Lock] Timeout breve: Ricarico per forzare blocco UI.");
            window.location.reload();
            return;
        }

        console.log("[Titan-Lock] Eseguo logout automatico...");
        if (auth.currentUser) {
            await signOut(auth);
        }
        window.location.href = 'index.html?reason=inactivity';
    } catch (e) {
        console.error("[Titan-Lock] Errore durante logout automatico:", e);
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
    if (softLockTimeout) clearTimeout(softLockTimeout);
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(name => {
        document.removeEventListener(name, recordActivity);
    });
}
