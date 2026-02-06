import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

/**
 * PROTOCOLLO BASE INACTIVITY TIMER (TITAN-LOCK v1.0)
 * Gestisce il blocco automatico dell'applicazione basato sul tempo di inattività.
 */

let inactivityTimeout;
let logoutTimerMs = 3 * 60 * 1000; // Default 3 minuti
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

    // Controllo quando l'utente torna sulla pagina (es. dopo aver cambiato tab)
    window.addEventListener('focus', checkLastActivity);
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
            const minutes = data.lock_timeout ?? 3;

            if (minutes === 0) {
                logoutTimerMs = 15 * 1000; // "Subito" = 15 secondi (evita lock loop istantaneo)
            } else {
                logoutTimerMs = minutes * 60 * 1000;
            }
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
        if (elapsed > logoutTimerMs) {
            console.warn(`[Titan-Lock] Sessione scaduta: ${Math.round(elapsed / 1000)}s passati.`);
            performAutoLogout();
        }
    }
}

/**
 * Registra un'attività utente e resetta il timer.
 */
function recordActivity() {
    localStorage.setItem('titan_last_activity', Date.now().toString());

    if (inactivityTimeout) clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(performAutoLogout, logoutTimerMs);
}

/**
 * Esegue il logout automatico e reindirizza alla login.
 */
async function performAutoLogout() {
    try {
        // Evitiamo loop se siamo già nella pagina di login
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage === 'index.html' || currentPage === '') return;

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
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach(name => {
        document.removeEventListener(name, recordActivity);
    });
}
