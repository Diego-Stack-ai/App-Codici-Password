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
import {
    doc, getDoc, collection, query, where, getDocs, updateDoc, deleteDoc,
    onSnapshot, runTransaction, arrayUnion, arrayRemove
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
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
    let inviteUnsubscribe = null;
    let sentInviteUnsubscribe = null;

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

                // GLOBAL REALTIME INVITE LISTENER (HARDENING V2)
                if (inviteUnsubscribe) inviteUnsubscribe();
                const q = query(
                    collection(db, "invites"),
                    where("recipientEmail", "==", user.email),
                    where("status", "==", "pending")
                );
                inviteUnsubscribe = onSnapshot(q, (snap) => {
                    if (!snap.empty) {
                        const inviteDoc = snap.docs[0];
                        showInviteModal(inviteDoc.id, inviteDoc.data());
                    }
                });

                // GLOBAL REALTIME REJECTION LISTENER (HARDENING V2.3)
                if (sentInviteUnsubscribe) sentInviteUnsubscribe();
                const qSent = query(
                    collection(db, "invites"),
                    where("senderId", "==", user.uid),
                    where("status", "==", "rejected"),
                    where("senderNotified", "==", false)
                );
                sentInviteUnsubscribe = onSnapshot(qSent, (snap) => {
                    snap.docChanges().forEach(async (change) => {
                        if (change.type === "added" || change.type === "modified") {
                            const invData = change.doc.data();
                            showRejectionModal(change.doc.id, invData);
                            // Global Auto-Healing: Reset flags if last person rejects
                            await autoHealAccountFlags(invData);
                        }
                    });
                });

            } catch (error) {
                console.error("Global Check Error:", error);
            }
        } else {
            if (inviteUnsubscribe) inviteUnsubscribe();
            if (sentInviteUnsubscribe) sentInviteUnsubscribe();
            // Redirect to Login se pagina protetta
            if (!['index', 'registrati', 'reset', 'imposta', 'privacy', 'termini'].includes(currentPage)) {
                // window.location.href = 'index.html'; // Scommentare in prod
            }
        }
    });

    /**
     * INVITE SYSTEM (Global Receiver) - HARDENING V2
     */
    function showInviteModal(inviteId, data) {
        if (document.getElementById('invite-modal')) return;

        const modal = createElement('div', { id: 'invite-modal', className: 'modal-overlay active' }, [
            createElement('div', { className: 'modal-box pb-8' }, [
                createElement('div', { className: 'flex justify-center mb-4' }, [
                    createElement('span', { className: 'material-symbols-outlined text-4xl text-purple-400', textContent: 'mail' })
                ]),
                createElement('h3', { className: 'modal-title text-center', textContent: t('invite_received_title') || 'Nuovo Invito' }),
                createElement('p', { className: 'modal-text text-center text-white/60 mb-1', textContent: `${data.senderEmail} ${t('invite_received_msg') || 'ha condiviso un account con te:'}` }),
                createElement('div', { className: 'p-4 bg-white/5 border border-white/10 rounded-2xl mb-6' }, [
                    createElement('p', { className: 'text-center font-black text-white text-lg', textContent: data.accountName }),
                ]),
                createElement('div', { className: 'modal-actions grid grid-cols-2 gap-3' }, [
                    createElement('button', {
                        id: 'btn-invite-reject',
                        className: 'p-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold uppercase text-[10px] hover:bg-red-500/10 hover:text-red-400 transition-all',
                        textContent: t('invite_reject') || 'Rifiuta',
                        onclick: () => handleInviteResponse(inviteId, data, 'rejected')
                    }),
                    createElement('button', {
                        id: 'btn-invite-accept',
                        className: 'p-4 rounded-2xl bg-purple-500 text-white font-black uppercase text-[10px] shadow-lg shadow-purple-500/20 hover:scale-105 transition-all',
                        textContent: t('invite_accept') || 'Accetta',
                        onclick: () => handleInviteResponse(inviteId, data, 'accepted')
                    })
                ])
            ])
        ]);
        document.body.appendChild(modal);
    }

    /**
     * REJECTION SYSTEM (Global Notifier) - HARDENING V2.3
     */
    function showRejectionModal(inviteId, data) {
        if (document.getElementById(`reject-modal-${inviteId}`)) return;

        const modal = createElement('div', { id: `reject-modal-${inviteId}`, className: 'modal-overlay active' }, [
            createElement('div', { className: 'modal-box pb-8' }, [
                createElement('div', { className: 'flex justify-center mb-4' }, [
                    createElement('span', { className: 'material-symbols-outlined text-4xl text-red-400', textContent: 'person_remove' })
                ]),
                createElement('h3', { className: 'modal-title text-center', textContent: 'Invito Rifiutato' }),
                createElement('p', { className: 'modal-text text-center text-white/60 mb-6', textContent: `${data.recipientEmail} ha declinato la condivisione per: ${data.accountName}` }),
                createElement('div', { className: 'modal-actions grid grid-cols-2 gap-3' }, [
                    createElement('button', {
                        className: 'w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white/40 font-bold uppercase text-[10px] hover:bg-white/10 transition-all',
                        textContent: 'Archivia',
                        onclick: async () => {
                            await updateDoc(doc(db, "invites", inviteId), { senderNotified: true });
                            modal.remove();
                        }
                    }),
                    createElement('button', {
                        className: 'w-full p-4 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 font-bold uppercase text-[10px] hover:bg-red-500/20 transition-all',
                        textContent: 'Elimina Invito',
                        onclick: async () => {
                            await deleteDoc(doc(db, "invites", inviteId));
                            modal.remove();
                        }
                    })
                ])
            ])
        ]);
        document.body.appendChild(modal);
    }

    /**
     * GLOBAL AUTO-HEALING (Real-time Reset)
     */
    async function autoHealAccountFlags(invData) {
        try {
            const ownerId = invData.senderId;
            const accId = invData.accountId;

            let accountPath = `users/${ownerId}/accounts/${accId}`;
            if (invData.type === 'azienda' && invData.aziendaId) {
                accountPath = `users/${ownerId}/aziende/${invData.aziendaId}/accounts/${accId}`;
            }

            const accRef = doc(db, accountPath);
            const accSnap = await getDoc(accRef);

            if (!accSnap.exists()) return;
            const accData = accSnap.data();
            const isSharingActive = accData.shared || accData.isMemoShared;

            if (!isSharingActive) return;

            // Explicitly query all invites to make absolutely sure there are no other pending/accepted users
            const q = query(collection(db, "invites"), where("accountId", "==", accId), where("senderId", "==", ownerId));
            const invitesSnap = await getDocs(q);

            let activeCount = 0;
            invitesSnap.forEach(docSnap => {
                const inv = docSnap.data();
                if (inv.status === 'pending' || inv.status === 'accepted') {
                    activeCount++;
                }
            });

            // If there are no active (pending or accepted) invites left, we turn off sharing globally
            if (activeCount === 0) {
                console.log("[GlobalAutoHealing] No active invites remaining -> Resetting account flags");
                await updateDoc(accRef, {
                    shared: false,
                    isMemoShared: false,
                    sharedWithEmails: []
                });
                showToast(`Condivisione terminata per ${accData.nomeAccount}`, 'info');
            }
        } catch (e) {
            console.error("[GlobalAutoHealing] Error:", e);
        }
    }

    async function handleInviteResponse(inviteId, inviteData, status) {
        // 1. Double Click Protection
        const btnAccept = document.getElementById('btn-invite-accept');
        const btnReject = document.getElementById('btn-invite-reject');
        if (btnAccept) { btnAccept.disabled = true; btnAccept.style.opacity = "0.5"; }
        if (btnReject) { btnReject.disabled = true; btnReject.style.opacity = "0.5"; }

        try {
            const currentUserEmail = auth.currentUser?.email;
            if (!currentUserEmail) throw "User not authenticated";

            // --- ATOMIC TRANSACTION (HARDENING V2) ---
            await runTransaction(db, async (transaction) => {
                const inviteRef = doc(db, "invites", inviteId);
                const invSnap = await transaction.get(inviteRef);

                // a) Leggi invite e verifica esistenza
                if (!invSnap.exists()) throw "ERR_NOT_FOUND: Invito non trovato.";
                const storedInvite = invSnap.data();

                // b) Controllo status === pending
                if (storedInvite.status !== 'pending') throw "ERR_PROCESSED: Questo invito è già stato elaborato.";

                // c) Verifica corrispondenza utente (Security Guard)
                if (storedInvite.recipientEmail !== currentUserEmail) {
                    throw "ERR_IDENTITY: Non sei autorizzato ad accettare questo invito.";
                }

                // d) Aggiorna invite status -> accepted/rejected
                transaction.update(inviteRef, {
                    status: status,
                    respondedAt: new Date().toISOString()
                });

                // e) Sincronizza account (sharedWithEmails) - HARDENING V2
                const ownerId = storedInvite.senderId;
                const accId = storedInvite.accountId;

                let accountPath = `users/${ownerId}/accounts/${accId}`;
                if (storedInvite.type === 'azienda' && storedInvite.aziendaId) {
                    accountPath = `users/${ownerId}/aziende/${storedInvite.aziendaId}/accounts/${accId}`;
                }

                const accountRef = doc(db, accountPath);

                if (status === 'accepted') {
                    // Se accettato, aggiungi all'array (se non già presente)
                    transaction.update(accountRef, {
                        sharedWithEmails: arrayUnion(currentUserEmail)
                    });
                } else if (status === 'rejected') {
                    // Se rifiutato, rimuovi dall'array se presente (cleanup orfani proprietario)
                    transaction.update(accountRef, {
                        sharedWithEmails: arrayRemove(currentUserEmail)
                    });
                }
            });

            // Cleanup modal
            const modal = document.getElementById('invite-modal');
            if (modal) modal.remove();

            showToast(status === 'accepted' ? "Accesso configurato!" : "Invito rifiutato", status === 'accepted' ? 'success' : 'info');

            if (status === 'accepted') {
                setTimeout(() => window.location.reload(), 800);
            }
        } catch (e) {
            console.error("[Hardening-V2] Response Transaction Failed:", e);
            let msg = t('error_generic') || "Errore durante l'elaborazione.";

            if (typeof e === 'string') msg = e;
            else if (e.code === 'permission-denied') msg = "Accesso negato dal server (Permessi insufficienti).";

            alert(msg); // Messaggio chiaro come richiesto

            const modal = document.getElementById('invite-modal');
            if (modal) modal.remove();
        }
    }

    initComponents();
    applyGlobalTranslations();
    setTimeout(() => document.body.classList.add('revealed'), 100);
});

console.log("PROTOCOLLO BASE (v5.0-HARDENED) Initialized");
