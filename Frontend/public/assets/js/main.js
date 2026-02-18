/**
 * PROTOCOLLO BASE MAIN ENTRY POINT (V4.4)
 * Coordina l'inizializzazione dei moduli UI dell'applicazione.
 * Refactor: Rimozione innerHTML, uso dom-utils.js, centralizzazione in components.js.
 */

// Conditional console override
(function () {
    try {
        const env = (typeof process !== 'undefined' && process.env && process.env.NODE_ENV) || window.NODE_ENV || document.documentElement.dataset.env || 'production';
        const originalConsoleLog = console.log && console.log.bind(console) || function () { };

        if (env === 'production') {
            window.LOG = function () { };
        } else {
            window.LOG = (...args) => originalConsoleLog(...args);
        }

        console.log = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.info = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.debug = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.trace = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.group = (...args) => { try { window.LOG(...args); } catch (e) { } };
        console.groupEnd = (...args) => { try { window.LOG(...args); } catch (e) { } };

        window.__APP_ENV = env;
    } catch (e) {
        window.LOG = function () { };
    }
})();

import { initLockedUX } from './ui-core.js';
import { setupPasswordToggles, setupCopyButtons, setupCallButtons } from './ui-components.js';
import { setupAccountCards, setupEditMode, setupAccountDetailView, setupCopyQrCode } from './ui-pages.js';
import { initCleanup } from './cleanup.js';
import { initComponents } from './components.js'; // Imports components system

/**
 * INITIALIZATION
 * Attiva tutte le funzionalità globali al caricamento del DOM.
 */
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showToast } from './ui-core.js';
import { createElement } from './dom-utils.js';
import { t, applyGlobalTranslations } from './translations.js';
import { showSecuritySetupModal } from './modules/core/security-setup.js';
import { initInactivityTimer } from './inactivity-timer.js';
import * as Pages from './pages-init.js';

// Inizializza il controllo inattività globalmente (SOSPESO TEMPORANEAMENTE PER SVILUPPO)
// initInactivityTimer();

function getCurrentPage() {
    const path = window.location.pathname;

    if (path.includes('registrati')) return 'registrati';
    if (path.includes('reset_password')) return 'reset';
    if (path.includes('imposta_nuova_password')) return 'imposta';
    if (path.includes('home_page')) return 'home';
    if (path.includes('area_privata')) return 'area';

    // Account Privati
    if (path.includes('account_privati')) return 'account_privati';
    if (path.includes('form_account_privato')) return 'form_account_privato';
    if (path.includes('dettaglio_account_privato')) return 'dettaglio_account_privato';

    // Settings & Profile
    if (path.includes('archivio_account')) return 'archivio';
    if (path.includes('profilo_privato')) return 'profilo';
    if (path.includes('impostazioni')) return 'impostazioni';

    // Scadenze
    if (path.includes('scadenze')) return 'scadenze';
    if (path.includes('aggiungi_scadenza')) return 'aggiungi_scadenza';
    if (path.includes('dettaglio_scadenza')) return 'dettaglio_scadenza';

    // Configs
    if (path.includes('regole_scadenze')) return 'regole';
    if (path.includes('configurazione_automezzi')) return 'automezzi';
    if (path.includes('configurazione_documenti')) return 'documenti';
    if (path.includes('configurazione_generali')) return 'regole_generali';
    if (path.includes('notifiche_storia')) return 'storico';

    // Azienda & Allegati
    if (path.includes('lista_aziende')) return 'lista_aziende';
    if (path.includes('aggiungi_nuova_azienda')) return 'aggiungi_nuova_azienda';
    if (path.includes('aggiungi_azienda')) return 'aggiungi_azienda';
    if (path.includes('modifica_azienda')) return 'modifica_azienda';
    if (path.includes('dati_azienda')) return 'dati_azienda';
    if (path.includes('account_azienda_list')) return 'account_azienda_list';
    if (path.includes('aggiungi_account_azienda')) return 'aggiungi_account_azienda';
    if (path.includes('modifica_account_azienda')) return 'modifica_account_azienda';
    if (path.includes('dettaglio_account_azienda')) return 'dettaglio_account_azienda';
    if (path.includes('form_account_azienda')) return 'form_account_azienda';
    if (path.endsWith('account_azienda.html')) return 'account_azienda';
    if (path.includes('gestione_allegati')) return 'gestione_allegati';

    if (path.includes('privacy')) return 'privacy';
    if (path.includes('termini')) return 'termini';

    return 'index';
}

document.addEventListener('DOMContentLoaded', () => {

    // 1. Policy UX (Lockdown menu/selezione)
    initLockedUX();
    initCleanup();

    // 2. Componenti Universali (Toggles, Copy, Call)
    const path = window.location.pathname.toLowerCase();

    // Router Logic - Step 1: Identifica Pagina
    const currentPage = getCurrentPage();
    console.log(`[Router] Current Page: ${currentPage}`);

    // Gestione Pagine Pubbliche (No Auth Required)
    if (currentPage === 'index') Pages.initIndex();
    else if (currentPage === 'registrati') Pages.initRegistrati();
    else if (currentPage === 'reset') Pages.initResetPassword();
    else if (currentPage === 'imposta') Pages.initImpostaNuovaPassword();
    else if (currentPage === 'privacy') Pages.initPrivacy();
    else if (currentPage === 'termini') Pages.initTermini();

    // Setup UI components base (salta su Auth pages se necessario, o gestito dentro initPagina)
    if (!['index', 'registrati', 'reset', 'imposta'].includes(currentPage)) {
        setupPasswordToggles();
        setupCopyButtons();
        setupCallButtons();
        // setupAccountCards(); // Delegato ai moduli pagina se serve
    }

    // 4. GLOBAL SECURITY & INVITE CHECK & PRIVATE ROUTING
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                // Security Check
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    if (!userData?.security_setup_done) {
                        // showSecuritySetupModal(user, userData);
                    }
                }

                // ROUTER - Step 2: Inizializza Pagina Privata
                switch (currentPage) {
                    case 'home': await Pages.initHomePage(user); break;
                    case 'area': await Pages.initAreaPrivata(user); break;

                    case 'account_privati': await Pages.initAccountPrivati(user); break;
                    case 'form_account_privato': await Pages.initFormAccountPrivato(user); break;
                    case 'dettaglio_account_privato': await Pages.initDettaglioAccountPrivato(user); break;

                    case 'archivio': await Pages.initArchivioAccount(user); break;
                    case 'profilo': await Pages.initProfiloPrivato(user); break;

                    case 'scadenze': await Pages.initScadenze(user); break;
                    case 'aggiungi_scadenza': await Pages.initAggiungiScadenza(user); break;
                    case 'dettaglio_scadenza': await Pages.initDettaglioScadenza(user); break;

                    case 'impostazioni': await Pages.initImpostazioni(user); break;
                    case 'regole': await Pages.initRegoleScadenze(user); break;
                    case 'automezzi': await Pages.initConfigurazioneAutomezzi(user); break;
                    case 'documenti': await Pages.initConfigurazioneDocumenti(user); break;
                    case 'regole_generali': await Pages.initConfigurazioneRegoleGenerali(user); break;
                    case 'storico': await Pages.initStoricoNotifiche(user); break;

                    case 'lista_aziende': await Pages.initListaAziende(user); break;
                    case 'aggiungi_nuova_azienda': await Pages.initAggiungiNuovaAzienda(user); break;
                    case 'aggiungi_azienda': await Pages.initAggiungiAzienda(user); break;
                    case 'modifica_azienda': await Pages.initModificaAzienda(user); break;
                    case 'dati_azienda': await Pages.initDatiAzienda(user); break;
                    case 'account_azienda': await Pages.initAccountAziendaList(user); break;
                    case 'account_azienda_list': await Pages.initAccountAziendaList(user); break;
                    case 'aggiungi_account_azienda': await Pages.initAggiungiAccountAzienda(user); break;
                    case 'modifica_account_azienda': await Pages.initModificaAccountAzienda(user); break;
                    case 'dettaglio_account_azienda': await Pages.initDettaglioAccountAzienda(user); break;
                    case 'form_account_azienda': await Pages.initFormAccountAzienda(user); break;
                    case 'gestione_allegati': await Pages.initGestioneAllegati(user); break;
                }

                // Global Services
                checkForPendingInvites(user.email);

            } catch (error) {
                console.error("Global Check Error:", error);
            }
        } else {
            // Redirect to Login se pagina protetta
            if (!['index', 'registrati', 'reset', 'imposta', 'privacy', 'termini'].includes(currentPage)) {
                // window.location.href = 'index.html'; // Scommentare in prod
            }
        }
    });

    // ... (Invite System e funzioni restano qui sotto) ...

    /**
     * INVITE SYSTEM (Global Receiver)
     */
    async function checkForPendingInvites(email) {
        if (!email) return;

        try {
            const q = query(collection(db, "invites"),
                where("recipientEmail", "==", email),
                where("status", "==", "pending")
            );
            const snap = await getDocs(q);

            if (!snap.empty) {
                // Processing one invite at a time
                const inviteDoc = snap.docs[0];
                const inviteData = inviteDoc.data();
                showInviteModal(inviteDoc.id, inviteData);
            }
        } catch (e) { console.error("CheckInvites", e); }
    }

    function showInviteModal(inviteId, data) {
        if (document.getElementById('invite-modal')) return;

        const modal = createElement('div', { id: 'invite-modal', className: 'modal-overlay active' }, [
            createElement('div', { className: 'modal-box' }, [
                createElement('span', { className: 'material-symbols-outlined modal-icon icon-accent-purple', textContent: 'mail' }),
                createElement('h3', { className: 'modal-title', textContent: t('invite_received_title') || 'Nuovo Invito' }),
                createElement('p', { className: 'modal-text', textContent: `${data.senderEmail} ${t('invite_received_msg') || 'ha condiviso un account con te:'}` }),
                createElement('p', { className: 'text-sm font-bold text-white mt-2 mb-4', textContent: data.accountName }),
                createElement('div', { className: 'modal-actions' }, [
                    createElement('button', {
                        className: 'btn-modal btn-secondary',
                        textContent: t('invite_reject') || 'Rifiuta',
                        onclick: () => handleInviteResponse(inviteId, 'rejected')
                    }),
                    createElement('button', {
                        className: 'btn-modal btn-primary',
                        textContent: t('invite_accept') || 'Accetta',
                        onclick: () => handleInviteResponse(inviteId, 'accepted')
                    })
                ])
            ])
        ]);
        document.body.appendChild(modal);
    }

    async function handleInviteResponse(inviteId, status) {
        const modal = document.getElementById('invite-modal');
        if (modal) modal.remove();

        try {
            await updateDoc(doc(db, "invites", inviteId), { status: status, respondedAt: new Date().toISOString() });
            showToast(status === 'accepted' ? "Invito accettato!" : "Invito rifiutato", status === 'accepted' ? 'success' : 'info');

            if (status === 'accepted') {
                setTimeout(() => window.location.reload(), 1000);
            }
        } catch (e) { console.error("InviteResponse", e); showToast(t('error_generic'), 'error'); }
    }

    // 5. LOAD SHARED COMPONENTS (Header/Footer)
    // Utilizziamo initComponents che gestisce Auth/App logic internamente
    // Skip on Home Page to avoid double loading if home.js does it (home.js actually relies on main usually, but initComponents handles checks)
    const pathName = window.location.pathname;
    const isHomePage = pathName.endsWith('home_page.html') || pathName.endsWith('/');

    // 5. LOAD SHARED COMPONENTS (Header/Footer)
    initComponents();

    // 6. TRADUZIONE & REVEAL (V3.9 Protocol)
    // Applica le traduzioni a tutti i data-t e imposta data-i18n="ready"
    applyGlobalTranslations();

    console.log("PROTOCOLLO BASE Initialized (v4.4)");

    // Force reveal content to avoid black screen (Backup Safety)
    setTimeout(() => document.body.classList.add('revealed'), 100);
});
