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
    if (user.photoURL && uAvatar) uAvatar.style.backgroundImage = `url("${user.photoURL}")`;

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
            if (photo && uAvatar) uAvatar.style.backgroundImage = `url("${photo}")`;
        }
    } catch (e) {
        console.warn("Firestore Profile fetch warning", e);
    }
}


// 1. Inizializzazione Componenti (Header/Footer Puri)
initComponents().then(() => {
    isDomReady = true;

    // Header Injection Custom Logic (per Home Page diversa dalle altre pagine)
    // Sostituiamo il contenuto generico dell'header con quello specifico della Home
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
            <a href="profilo_privato.html" class="user-profile-group group" style="text-decoration:none;">
                <div id="user-avatar" class="avatar-circle border-glow shrink-0" style="width: 42px; height: 42px;"></div>
                <div class="user-info-text">
                    <span id="greeting-text" class="greeting-text">...</span>
                    <span id="user-name" class="user-name">Caricamento...</span>
                </div>
            </a>
            <button id="logout-button" class="btn-icon-header self-start" style="border: none; background: transparent; padding: 0; outline: none;">
                <span class="material-symbols-outlined !text-xl">logout</span>
            </button>
        `;
    }

    // Footer Injection
    const footerStack = document.getElementById('footer-content');
    if (footerStack) {
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
