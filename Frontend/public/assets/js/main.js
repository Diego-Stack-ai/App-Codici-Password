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
import { sanitizeEmail } from './utils.js';
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
    // 🔐 BLOCCO SENTINELLA V5.1 - Previene il doppio bootstrap
    if (window.__V5_BOOTSTRAPPED__) {
        console.warn("⚠️ Rilevato tentativo di doppio bootstrap. Blocco sentinella attivo.");
        return;
    }
    window.__V5_BOOTSTRAPPED__ = true;

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
            console.log(`[AUTH-DEBUG] User logged in: ${user.email} (UID: ${user.uid})`);
            try {
                // Security Check
                const userDoc = await getDoc(doc(db, "users", user.uid));
                if (userDoc.exists()) {
                    const userData = userDoc.data();
                    console.log("[AUTH-DEBUG] User document found.");
                } else {
                    console.warn("[AUTH-DEBUG] User document NOT found in Firestore.");
                }
            } catch (err) {
                console.error("[AUTH-DEBUG] Permission record check failed:", err.message);
            }

            try {
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
                    where("recipientEmail", "==", user.email.toLowerCase().trim()),
                    where("status", "==", "pending")
                );
                inviteUnsubscribe = onSnapshot(q, (snap) => {
                    if (!snap.empty) {
                        const inviteDoc = snap.docs[0];
                        showInviteModal(inviteDoc.id, inviteDoc.data());
                    }
                }, (err) => {
                    console.error("[V3.1-DEBUG] Error in Incoming Invite listener:", err.message, err.code);
                    if (err.code === 'permission-denied') {
                        console.warn("[V3.1-SECURITY] Check if your emails in Auth and Firestore match exactly (case-sensitive).");
                    }
                });

                // GLOBAL NOTIFICATION LISTENER (V5.4 - Owner Confirmation)
                let notificationUnsubscribe = null;
                if (notificationUnsubscribe) notificationUnsubscribe();
                const qNotif = query(
                    collection(db, "users", user.uid, "notifications"),
                    where("read", "==", false),
                    where("type", "==", "share_response")
                );
                notificationUnsubscribe = onSnapshot(qNotif, (snap) => {
                    snap.docChanges().forEach((change) => {
                        if (change.type === "added") {
                            showNotificationModal(change.doc.id, change.doc.data());
                        }
                    });
                }, (err) => {
                    console.error("[V5.4-DEBUG] Error in Notification listener:", err.message);
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
     * NOTIFICATION SYSTEM (V5.4 - Results with OK Confirmation)
     */
    function showNotificationModal(notifId, data) {
        if (document.getElementById(`notif-modal-${notifId}`)) return;

        const isAccepted = data.title.toLowerCase().includes('accettato');
        const accentClass = isAccepted ? 'text-green-400' : 'text-red-400';
        const icon = isAccepted ? 'check_circle' : 'person_remove';

        const modal = createElement('div', { id: `notif-modal-${notifId}`, className: 'modal-overlay active' }, [
            createElement('div', { className: 'modal-box pb-8' }, [
                createElement('div', { className: 'flex justify-center mb-4' }, [
                    createElement('span', { className: `material-symbols-outlined text-4xl ${accentClass}`, textContent: icon })
                ]),
                createElement('h3', { className: 'modal-title text-center', textContent: data.title }),
                createElement('div', { className: 'p-4 bg-white/5 border border-white/10 rounded-2xl mb-4' }, [
                    createElement('p', { className: 'text-center font-black text-white text-lg', textContent: data.accountName || 'Account' }),
                ]),
                createElement('p', { className: 'modal-text text-center text-white/60 mb-6', textContent: data.message }),
                createElement('div', { className: 'modal-actions' }, [
                    createElement('button', {
                        className: 'w-full p-4 rounded-2xl bg-white/10 text-white font-black uppercase text-xs hover:bg-white/20 transition-all',
                        textContent: 'HO CAPITO (OK)',
                        onclick: async () => {
                            // Al click su OK, eseguiamo la bonifica e chiudiamo
                            await autoHealAccountFlags(data, notifId);
                            document.getElementById(`notif-modal-${notifId}`).remove();
                        }
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

    async function autoHealAccountFlags(notifData, notifId) {
        if (!notifData.accountId) {
            // Se non c'è ID account, segniamo solo come letta
            if (notifId) await updateDoc(doc(db, "users", auth.currentUser.uid, "notifications", notifId), { read: true });
            return;
        }

        const ownerId = auth.currentUser.uid;
        const accId = notifData.accountId;
        const azId = notifData.aziendaId;

        const accountPath = azId
            ? `users/${ownerId}/aziende/${azId}/accounts/${accId}`
            : `users/${ownerId}/accounts/${accId}`;

        const accountRef = doc(db, accountPath);

        try {
            await runTransaction(db, async (transaction) => {
                const accSnap = await transaction.get(accountRef);
                if (!accSnap.exists()) return;

                const data = accSnap.data();
                const sharedWith = data.sharedWith || {};

                const hasActive = Object.values(sharedWith).some(g => g.status === 'pending' || g.status === 'accepted');
                const newVisibility = hasActive ? "shared" : "private";

                let newType = data.type;
                const isMemoLike = (data.type === 'memo' || data.type === 'memorandum');

                if (newVisibility === 'private' && isMemoLike && data.isExplicitMemo !== true) {
                    console.log(`[V5.4-CONFIRM] Reverting shared-memo to account type after owner OK.`);
                    newType = 'account';
                }

                // Aggiorna Account
                transaction.update(accountRef, {
                    visibility: newVisibility,
                    type: newType,
                    updatedAt: new Date().toISOString()
                });

                // Segna notifica come letta
                if (notifId) {
                    const notifRef = doc(db, "users", ownerId, "notifications", notifId);
                    transaction.update(notifRef, { read: true });
                }
            });
            showToast("Presa d'atto confermata", "success");
        } catch (e) {
            console.error("[V5.4-CONFIRM] Healing/Read update failed:", e.message);
            // Fallback: segna almeno la notifica come letta se l'account non esiste più
            if (notifId) await updateDoc(doc(db, "users", ownerId, "notifications", notifId), { read: true });
        }
    }

    async function handleInviteResponse(inviteId, inviteData, status) {
        // 1. Double Click Protection
        const btnAccept = document.getElementById('btn-invite-accept');
        const btnReject = document.getElementById('btn-invite-reject');
        if (btnAccept) { btnAccept.disabled = true; btnAccept.style.opacity = "0.5"; }
        if (btnReject) { btnReject.disabled = true; btnReject.style.opacity = "0.5"; }

        try {
            const currentUid = auth.currentUser?.uid;
            const currentUserEmail = auth.currentUser?.email;
            const sKey = sanitizeEmail(currentUserEmail);

            if (!currentUserEmail) throw new Error("Utente non autenticato.");

            console.log(`[V3.1-DEBUG] --- handleInviteResponse ---`);
            console.log(`[V3.1-DEBUG] User: ${currentUserEmail} (UID: ${currentUid}), Action: ${status}`);

            // --- RETRY LOGIC (Harden V3.1) ---
            let invSnap = null;
            let inviteRef = doc(db, "invites", inviteId);

            console.log(`[V3.1-DEBUG] Fetching Invite Doc: ${inviteId}`);
            for (let i = 0; i < 5; i++) {
                invSnap = await getDoc(inviteRef);
                if (invSnap.exists()) {
                    console.log(`[V3.1-DEBUG] Invite found on attempt ${i + 1}/5`);
                    break;
                }
                const delay = 800 * (i + 1);
                console.warn(`[V3.1-DEBUG] [RETRY] Attempt ${i + 1}/5 fail. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }

            if (!invSnap || !invSnap.exists()) {
                throw new Error("L'invito non è ancora visibile sui server. Per favore attendi qualche secondo e riprova.");
            }

            const preflightData = invSnap.data();
            if (preflightData.status !== 'pending') throw new Error("Questo invito è già stato elaborato o revocato.");

            // Normalize for comparison
            if (preflightData.recipientEmail.toLowerCase().trim() !== currentUserEmail.toLowerCase().trim()) {
                throw new Error("Non sei autorizzato a rispondere a questo invito.");
            }

            // --- ATOMIC TRANSACTION V3.1 ---
            console.log("[V3.1-DEBUG] Executing runTransaction...");
            await runTransaction(db, async (transaction) => {
                console.log(`[V3.1-DEBUG] Transaction started for invite: ${inviteId}`);

                // 1. Get Inverse
                let storedInviteSnap;
                try {
                    storedInviteSnap = await transaction.get(inviteRef);
                    if (!storedInviteSnap.exists()) throw new Error("Invito non trovato nel database.");
                    console.log("[V3.1-DEBUG] Invite fetched successfully.");
                } catch (e) {
                    console.error("[V3.1-DEBUG] Invite GET failed:", e.message);
                    throw e;
                }

                const storedInvite = storedInviteSnap.data();
                if (storedInvite.status !== 'pending') throw "L'invito è stato aggiornato da un'altra sessione.";

                const ownerId = storedInvite.ownerId || storedInvite.senderId;
                const accId = storedInvite.accountId;

                let accountPath = storedInvite.aziendaId
                    ? `users/${ownerId}/aziende/${storedInvite.aziendaId}/accounts/${accId}`
                    : `users/${ownerId}/accounts/${accId}`;

                console.log(`[V3.1-DEBUG] Syncing account at path: ${accountPath}`);
                const accountRef = doc(db, accountPath);

                let accSnap;
                try {
                    accSnap = await transaction.get(accountRef);
                    if (!accSnap.exists()) throw new Error("Account non trovato o accesso negato.");
                    console.log("[V3.1-DEBUG] Account fetched successfully.");
                } catch (e) {
                    console.error("[V3.1-DEBUG] Account GET failed:", e.message);
                    throw e;
                }

                let data = accSnap.data();
                let sharedWith = data.sharedWith || {};
                console.log(`[V3.1-DEBUG] Current sharedWith State:`, sharedWith);
                console.log(`[V3.1-DEBUG] Processing Guest: ${sKey}, Status: ${status}`);

                if (sharedWith[sKey]) {
                    sharedWith[sKey].status = status;
                    if (status === 'accepted') {
                        sharedWith[sKey].uid = auth.currentUser.uid;
                    }
                } else {
                    console.warn(`[V3.1-DEBUG] Missing key ${sKey} in sharedWith map. Possible sanitization mismatch.`);
                }

                const newCount = Object.values(sharedWith).filter(g => g.status === 'accepted').length;
                const hasActive = Object.values(sharedWith).some(g => g.status === 'pending' || g.status === 'accepted');
                const newVisibility = hasActive ? "shared" : "private";

                // V5.2 AUTO-HEALING: Se torna privato e non era un Memo esplicito, torna ad essere Account
                let newType = data.type;
                if (newVisibility === 'private' && data.type === 'memo' && data.isExplicitMemo !== true) {
                    console.log("[V3.1-DEBUG] Auto-Healing: Reverting shared-memo to account type.");
                    newType = 'account';
                }

                const updatePayload = {
                    sharedWith: sharedWith,
                    acceptedCount: newCount,
                    visibility: newVisibility,
                    type: newType,
                    updatedAt: new Date().toISOString()
                };

                console.log("[V3.1-DEBUG] Final Account Update Payload:", updatePayload);
                console.log("[V3.1-DEBUG] Performing updates...");
                transaction.update(accountRef, updatePayload);
                transaction.update(inviteRef, {
                    status: status,
                    respondedAt: new Date().toISOString()
                });

                if (ownerId && ownerId !== auth.currentUser?.uid) {
                    const notifRef = doc(collection(db, "users", ownerId, "notifications"));
                    transaction.set(notifRef, {
                        title: status === 'accepted' ? "Invito Accettato" : "Invito Rifiutato",
                        message: `${currentUserEmail} ha ${status === 'accepted' ? 'accettato' : 'rifiutato'} l'invito.`,
                        accountName: data.nomeAccount || 'Senza Nome',
                        type: "share_response",
                        accountId: accId,
                        aziendaId: azId || null,
                        guestEmail: currentUserEmail,
                        timestamp: new Date().toISOString(),
                        read: false
                    });
                    console.log("[V3.1-DEBUG] Notification queued for owner.");
                }
                console.log("[V3.1-DEBUG] Updates queued in transaction.");
            });

            console.log("[V3.1-DEBUG] Transaction committed successfully.");

            // Cleanup modal
            const modal = document.getElementById('invite-modal');
            if (modal) modal.remove();

            showToast(status === 'accepted' ? "Accesso configurato!" : "Invito rifiutato", status === 'accepted' ? 'success' : 'info');

            if (status === 'accepted') {
                setTimeout(() => window.location.reload(), 800);
            }
        } catch (e) {
            console.error("[V3.1-EXCEPTION] Detailed Error Log:");
            console.error("-> Message:", e?.message || e);
            console.error("-> Code:", e?.code || "N/A");
            console.error("-> Full Stack:", e);

            let msg = t('error_generic') || "Errore durante l'elaborazione.";

            if (typeof e === 'string') msg = e;
            else if (e.code === 'permission-denied') msg = "Accesso negato. Errore permessi Firestore (Security Rules).";
            else if (e.code === 'failed-precondition') msg = "Conflitto: l'indice o la transazione è fallita sul server.";

            showToast(msg, 'error');

            const modal = document.getElementById('invite-modal');
            if (modal) modal.remove();
        }
    }

    initComponents();
    applyGlobalTranslations();
    setTimeout(() => document.body.classList.add('revealed'), 100);
});

console.log("PROTOCOLLO BASE (v5.0-HARDENED) Initialized");
