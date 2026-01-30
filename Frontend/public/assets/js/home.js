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

let cachedUser = null;
let isDomReady = false;

// Funzione Helper per Rendering Utente con Retry
async function renderHeaderUser(user) {
    if (!user) return;

    const uAvatar = document.getElementById('user-avatar');
    const uName = document.getElementById('user-name');
    const greeting = document.getElementById('greeting-text');

    // Se il DOM header non è ancora stato iniettato, aspettiamo.
    if (!uAvatar || !uName) return;

    // Format Name
    const toFriendlyName = (name) => {
        if (!name) return "";
        return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // 1. Basic Auth Info (Immediato)
    let displayName = toFriendlyName(user.displayName || user.email.split('@')[0]);
    if (uName) uName.textContent = displayName;
    if (user.photoURL && uAvatar) {
        uAvatar.style.backgroundImage = `url("${user.photoURL}")`;
        const icon = uAvatar.querySelector('span');
        if (icon) icon.style.display = 'none';
    }

    // 2. Saluto Temporale
    if (greeting) {
        const h = new Date().getHours();
        const key = (h >= 5 && h < 13) ? "greeting_morning"
            : (h >= 13 && h < 17) ? "greeting_afternoon"
                : "greeting_evening";
        greeting.textContent = t(key);
    }

    // 3. Firestore Info (Completo)
    try {
        const docSnap = await getDoc(doc(db, "users", user.uid));
        if (docSnap.exists()) {
            const data = docSnap.data();
            const fullName = toFriendlyName(`${data.nome || ''} ${data.cognome || ''}`.trim());
            if (fullName) uName.textContent = fullName; // Sovrascrivi con nome completo DB
            const photo = data.photoURL || data.avatar;
            if (photo && uAvatar) {
                uAvatar.style.backgroundImage = `url("${photo}")`;
                const icon = uAvatar.querySelector('span');
                if (icon) icon.style.display = 'none';
            }
        }
    } catch (e) {
        console.warn("Firestore Profile fetch warning", e);
    }
}


// 1. Inizializzazione Componenti (Header/Footer Puri)
initComponents().then(() => {
    isDomReady = true;

    // Header Injection - Balanced Layout (3-Zone Protocol)
    const headerStack = document.getElementById('header-content');
    if (headerStack) {
        headerStack.innerHTML = `
            <div class="header-balanced-container">
                <!-- ZONA SINISTRA: Profilo Utente -->
                <div class="header-left">
                    <a href="profilo_privato.html" class="btn-icon-header" style="width: auto; padding: 0 4px; border:none; background:transparent;">
                        <div id="user-avatar" class="avatar-circle border-glow" style="width: 38px; height: 38px; display: flex; align-items: center; justify-content: center;">
                            <span class="material-symbols-outlined !text-lg opacity-20">person</span>
                        </div>
                    </a>
                </div>

                <!-- ZONA CENTRO: Saluto e Nome -->
                <div class="header-center">
                    <div class="user-info-text" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
                        <span id="greeting-text" class="greeting-text" style="font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.6;">...</span>
                        <span id="user-name" class="header-title" style="font-size: 1rem;">Caricamento...</span>
                    </div>
                </div>

                <!-- ZONA DESTRA: Logout -->
                <div class="header-right">
                    <button id="logout-button" class="btn-icon-header">
                        <span class="material-symbols-outlined !text-xl">logout</span>
                    </button>
                </div>
            </div>
        `;
    }

    // Footer Injection - Balanced Layout
    const footerStack = document.getElementById('footer-content');
    if (footerStack) {
        footerStack.innerHTML = `
            <div class="header-balanced-container" style="justify-content: center;">
                <div class="flex items-center gap-4 opacity-40">
                    <span class="text-[9px] font-bold uppercase tracking-[0.3em]">${t('version')}</span>
                </div>
                <div style="position: absolute; right: 1.5rem;">
                    <a href="impostazioni.html" class="btn-icon-header opacity-30 hover:opacity-100 transition-opacity group/settings">
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

    // Logout Helper
    const logoutBtn = document.getElementById('logout-button');
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await signOut(auth);
            window.location.href = 'index.html';
        };
    }

    // Se avevamo già l'utente (Auth più veloce di DOM), renderizziamo ora
    if (cachedUser) renderHeaderUser(cachedUser);
});

// 1b. Esposizione Temi
window.setTheme = setTheme;
applyTheme();

/**
 * GESTORE NAVIGAZIONE SEMANTICA (Solo per i DIV cliccabili, non per gli Anchor)
 */
function initNavigation() {
    document.querySelectorAll('[data-href]').forEach(el => {
        // Rimuovi event listener precedenti se necessario, o usa {once:true} se fosse one-shot.
        // Qui assumiamo init una volta sola.
        const nav = () => window.location.href = el.dataset.href;
        el.addEventListener('click', nav);
        el.style.cursor = 'pointer'; // Ensure pointer cursor
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

    // Cache User Globalmente
    cachedUser = user;

    // Widgets immediati
    initNavigation();

    // Renderizza Header (Se il DOM è pronto, lo fa subito. Se no, aspetta initComponents)
    await renderHeaderUser(user);

    // Carica Widget Dinamici ASYNC (non bloccanti)
    loadUrgentDeadlinesCount(user).catch(e => console.warn("Deadlines count error", e));
    loadExpiredDeadlines(user).catch(e => console.warn("Urgencies list error", e));
});
