import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { initComponents } from './components.js';
import { loadUrgentDeadlinesCount } from './scadenze.js';
import { loadExpiredDeadlines } from './urgenze.js';
import { logError } from './utils.js';
import { setTheme, applyTheme } from './theme.js';

/**
 * HOME PAGE MODULE (Titanium Gold)
 * Gestisce l'integrazione dati e l'interfaccia della dashboard principale.
 */

// 1. Inizializzazione Componenti (Regola 1-5)
initComponents();

// 1b. Esposizione Temi
window.setTheme = setTheme;
applyTheme();

/**
 * LOGICA SALUTO TEMPORALE
 */
function updateGreeting() {
    const h = new Date().getHours();
    const el = document.getElementById('greeting-text');
    if (el) el.textContent = (h >= 5 && h < 13) ? "Buon giorno," : (h >= 13 && h < 17) ? "Buon pomeriggio," : "Buona sera,";
}

/**
 * GESTORE NAVIGAZIONE SEMANTICA
 */
function initNavigation() {
    document.querySelectorAll('[data-href]').forEach(el => {
        const nav = () => window.location.href = el.dataset.href;
        el.addEventListener('click', nav);
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                nav();
            }
        });
    });
}

/**
 * INIZIALIZZAZIONE DATI UTENTE E FIREBASE
 */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Inizializza UI base
    updateGreeting();
    initNavigation();

    const uAvatar = document.getElementById('user-avatar');
    const uName = document.getElementById('user-name');
    const logoutBtn = document.getElementById('logout-button');

    let nameToShow = user.displayName || user.email.split('@')[0];
    if (user.photoURL && uAvatar) uAvatar.style.backgroundImage = `url("${user.photoURL}")`;
    if (uName) uName.textContent = nameToShow;

    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const fullName = `${data.nome || ''} ${data.cognome || ''}`.trim();
            if (fullName) uName.textContent = fullName;
            const photo = data.photoURL || data.avatar;
            if (photo && uAvatar) uAvatar.style.backgroundImage = `url("${photo}")`;
        }
    } catch (error) {
        logError("Firestore Profile", error);
        const pWarning = document.getElementById('profile-warning');
        if (pWarning) pWarning.style.display = 'inline-block';
    }

    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await signOut(auth);
            window.location.href = 'index.html';
        };
    }

    // Carica Widget Dinamici
    try { loadUrgentDeadlinesCount(user); } catch (e) { logError("Dashboard Scadenze", e); }
    try { loadExpiredDeadlines(user); } catch (e) { logError("Dashboard Urgenze", e); }
});
