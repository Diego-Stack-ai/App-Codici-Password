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

// 1. Inizializzazione Componenti (Header/Footer Puri)
initComponents().then(() => {
    const headerStack = document.getElementById('header-content');
    if (headerStack) {
        // Forza il layout a riga singola senza a capo
        headerStack.style.display = 'flex';
        headerStack.style.flexDirection = 'row';
        headerStack.style.alignItems = 'flex-start';
        headerStack.style.justifyContent = 'space-between';
        headerStack.style.flexWrap = 'nowrap';
        headerStack.style.width = '100%';

        headerStack.innerHTML = `
            <a href="dati_anagrafici_privato.html" class="user-profile-group group">
                <div id="user-avatar" class="avatar-circle border-glow shrink-0" style="width: 42px; height: 42px;"></div>
                <div class="user-info-text">
                    <span id="greeting-text" class="greeting-text">...</span>
                    <span id="user-name" class="user-name">...</span>
                </div>
            </a>
            <button id="logout-button" class="btn-icon-header self-start" style="border: none; background: transparent; padding: 0; outline: none;">
                <span class="material-symbols-outlined !text-xl">logout</span>
            </button>
        `;
    }

    // Iniezione Contenuto Footer (3 Sezioni: Vuoto | Tema | Settings)
    const footerStack = document.getElementById('footer-content');
    if (footerStack) {
        // Forza il layout a 3 zone per tenere il tema al centro e l'ingranaggio a destra
        footerStack.style.display = 'flex';
        footerStack.style.alignItems = 'center';
        footerStack.style.justifyContent = 'space-between';
        footerStack.style.width = '100%';

        footerStack.innerHTML = `
            <div style="flex: 1;"></div> 
            
            <div class="flex items-center gap-4 opacity-40" style="flex: 2; justify-content: center;">
                <span class="text-[9px] font-bold uppercase tracking-[0.3em]">${t('version')}</span>
            </div>

            <div style="flex: 1; display: flex; justify-content: flex-end;">
                <a href="impostazioni.html" class="btn-icon-header opacity-30 hover:opacity-100 transition-opacity group/settings">
                    <span class="material-symbols-outlined !text-xl transform group-hover/settings:rotate-90 transition-transform duration-500" style="font-variation-settings: 'wght' 200;">tune</span>
                </a>
            </div>
        `;
    }

    // --- TRADUZIONE STATICA DEL DOM (Home Page) ---
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        if (el.hasAttribute('placeholder')) {
            el.setAttribute('placeholder', t(key));
        } else {
            el.textContent = t(key);
        }
    });

    // --- TRADUZIONE ARIA-LABEL ---
    document.querySelectorAll('[data-t-aria]').forEach(el => {
        const key = el.getAttribute('data-t-aria');
        el.setAttribute('aria-label', t(key));
    });

    // Una volta iniettato, inizializza il logout
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            const { auth } = await import('./firebase-config.js');
            const { signOut } = await import('https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js');
            await signOut(auth);
            window.location.href = 'index.html';
        };
    }
});

// 1b. Esposizione Temi
window.setTheme = setTheme;
applyTheme();

/**
 * LOGICA SALUTO TEMPORALE
 */
function updateGreeting() {
    const h = new Date().getHours();
    const el = document.getElementById('greeting-text');
    if (el) {
        const key = (h >= 5 && h < 13) ? "greeting_morning"
            : (h >= 13 && h < 17) ? "greeting_afternoon"
                : "greeting_evening";
        el.textContent = t(key);
    }
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

    // Funzione interna per il formato amichevole (Iniziale Maiuscola)
    const toFriendlyName = (name) => {
        if (!name) return "";
        return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    let nameToShow = toFriendlyName(user.displayName || user.email.split('@')[0]);
    if (user.photoURL && uAvatar) uAvatar.style.backgroundImage = `url("${user.photoURL}")`;
    if (uName) uName.textContent = nameToShow;

    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const fullName = toFriendlyName(`${data.nome || ''} ${data.cognome || ''}`.trim());
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
