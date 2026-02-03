import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { initComponents } from './components.js';
import { loadUrgentDeadlinesCount } from './scadenze.js';
import { loadExpiredDeadlines } from './urgenze.js';
import { logError } from './utils.js';
import { t } from './translations.js';
import { setTheme, applyTheme } from './theme.js';

/**
 * HOME PAGE MODULE (Titanium Gold)
 * Gestisce l'integrazione dati e l'interfaccia della dashboard principale.
 */

/**
 * HOME PAGE MODULE (Titanium V3.1)
 * Gestisce l'integrazione dati e l'interfaccia della dashboard principale.
 */

let cachedUser = null;
let isDomReady = false;

// 1. Inizializzazione AppState (Core Pattern V3.1)
document.addEventListener('DOMContentLoaded', () => {
    window.AppState = window.AppState || {
        user: null,
        theme: localStorage.getItem('app_theme') || 'dark',
        language: localStorage.getItem('app_language') || 'it'
    };

    isDomReady = true;

    // Inizializzazione Componenti (Eventuale logica shared, no injection)
    initComponents().then(() => {
        // setupUILayout(); // RIMOSSO: HTML Statico gestisce la struttura
        if (cachedUser) renderHeaderUser(cachedUser);
    });

    // Logout Helper
    document.addEventListener('click', async (e) => {
        if (e.target.closest('#logout-button')) {
            const confirmed = await window.showConfirmModal(
                t('logout'),
                t('logout_confirm'),
                t('logout'),
                t('cancel')
            );
            if (confirmed) {
                await signOut(auth).catch(err => console.error("SignOut Error:", err));
                window.location.href = 'index.html';
            }
        }
    });

    initNavigation();
});

/**
 * Setup UI Elements (Header/Footer Injected Content)
 */
function setupUILayout() {
    const hLeft = document.getElementById('header-left');
    const hCenter = document.getElementById('header-center');
    const hRight = document.getElementById('header-right');

    if (hLeft) {
        hLeft.innerHTML = `
            <a href="profilo_privato.html" class="btn-icon-header" style="width: auto; padding: 0 4px; border:none; background:transparent;">
                <div id="user-avatar" class="avatar-circle border-glow" style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center; overflow: hidden; border-radius: 50%;">
                    <span class="material-symbols-outlined !text-lg opacity-20">person</span>
                </div>
            </a>
        `;
    }

    if (hCenter) {
        hCenter.innerHTML = `
            <div class="user-info-text" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                <span id="greeting-text" class="greeting-text" style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;">...</span>
                <a href="profilo_privato.html" style="text-decoration: none; color: inherit; display: block;">
                    <span id="user-name" class="header-title" style="font-size: 1rem;">Caricamento...</span>
                </a>
            </div>
        `;
    }

    if (hRight) {
        hRight.innerHTML = `
            <button id="logout-button" class="btn-icon-header">
                <span class="material-symbols-outlined !text-xl">logout</span>
            </button>
        `;
    }

    const footerStack = document.getElementById('footer-content');
    if (footerStack) {
        footerStack.innerHTML = `
            <div class="header-balanced-container" style="justify-content: center; position: relative; width: 100%;">
                <div class="flex items-center gap-6">
                    <button onclick="TitaniumTheme.setMode('light')" class="theme-switch-btn" title="Tema Chiaro">
                        <span class="material-symbols-outlined">light_mode</span>
                    </button>
                    <button onclick="TitaniumTheme.setMode('dark')" class="theme-switch-btn" title="Tema Scuro">
                        <span class="material-symbols-outlined">dark_mode</span>
                    </button>
                </div>
                <div style="position: absolute; right: 0;">
                    <a href="impostazioni.html" class="btn-icon-header opacity-60 hover:opacity-100 transition-opacity group/settings">
                        <span class="material-symbols-outlined !text-xl transform group-hover/settings:rotate-90 transition-transform duration-500" style="font-variation-settings: 'wght' 200;">tune</span>
                    </a>
                </div>
            </div>
        `;
    }

    // Traduzioni Statiche
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (el.hasAttribute('placeholder')) el.setAttribute('placeholder', t(key));
        else el.textContent = t(key);
    });
}

// Funzione Helper per Rendering Utente con Retry
async function renderHeaderUser(user) {
    if (!user) return;

    // Update AppState
    if (window.AppState) window.AppState.user = user;

    const uAvatar = document.getElementById('header-user-avatar');
    const uGreeting = document.getElementById('home-greeting-text'); // Piccolo (Buongiorno)
    const uName = document.getElementById('home-user-name');         // Grande (Nome)

    // Helper: Friendly Name
    const toFriendlyName = (name) => {
        if (!name) return "";
        return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // 1. Dati Iniziali
    let displayName = toFriendlyName(user.displayName || user.email.split('@')[0]);

    // 2. Calcolo Saluto
    const h = new Date().getHours();
    let timeGreeting = "Benvenuto";
    if (h >= 5 && h < 13) timeGreeting = "Buongiorno";
    else if (h >= 13 && h < 18) timeGreeting = "Buon pomeriggio";
    else timeGreeting = "Buonasera";

    // Applica Subito (Auth Data)
    if (uGreeting) uGreeting.textContent = timeGreeting;
    if (uName) uName.textContent = displayName;

    if (user.photoURL && uAvatar) {
        uAvatar.style.backgroundImage = `url("${user.photoURL}")`;
        uAvatar.style.backgroundSize = 'cover';
        uAvatar.innerHTML = ''; // Rimuove icona fallback
    }

    // 3. Firestore Info (Dati Completi Async)
    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const fullName = toFriendlyName(`${data.nome || ''} ${data.cognome || ''}`.trim());

            if (fullName) {
                displayName = fullName;
                if (uName) uName.textContent = displayName;
            }
            // Aggiorna anche il saluto (ridondante ma sicuro)
            if (uGreeting) uGreeting.textContent = timeGreeting;

            const photo = data.photoURL || data.avatar;
            if (photo && uAvatar) {
                uAvatar.style.backgroundImage = `url("${photo}")`;
                uAvatar.style.backgroundSize = 'cover';
                uAvatar.innerHTML = '';
            }
        }
    } catch (e) {
        console.warn("Firestore Profile fetch warning", e);
    }
}

/**
 * GESTORE NAVIGAZIONE SEMANTICA
 */
function initNavigation() {
    document.querySelectorAll('[data-href]').forEach(el => {
        const nav = () => window.location.href = el.dataset.href;
        el.addEventListener('click', nav);
        el.style.cursor = 'pointer';
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                nav();
            }
        });
    });
}

/**
 * FIREBASE AUTH OBSERVER
 */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    cachedUser = user;
    if (isDomReady) renderHeaderUser(user);

    // Carica Widget Dinamici ASYNC
    loadUrgentDeadlinesCount(user).catch(e => console.warn("Deadlines count error", e));
    loadExpiredDeadlines(user).catch(e => console.warn("Urgencies list error", e));
});
