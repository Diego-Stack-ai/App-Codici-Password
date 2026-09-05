import { getDocSmart as getDoc, getDocsSmart as getDocs } from "/assets/js/offline-firestore.js";
/**
 * HOME PAGE MODULE (V4.1)
 * Gestisce l'interfaccia della nuova Home Page statica.
 * Refactor: Rimozione innerHTML, uso dom-utils.js e migrazione sotto modules/home/.
 */

import { auth, db } from '../../firebase-config.js?v=1.2.39';
import { onAuthStateChanged, signOut } from "/assets/js/vendor/firebase-runtime.js";
import { doc, collection } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { getFooterReady } from '../../footer-state.js';
import { t } from '../../translations.js';
import { decrypt, ensureMasterKey, isAutoUnlockActive, resetVault } from '../core/security-manager.js';
import { getLastCryptoError } from '../core/crypto-utils.js';
import { showConfirmModal } from '../../ui-core-v129.js';

// [V8.0] FLAG DI SICUREZZA - In produzione è FALSE per nascondere i meccanismi di auto-cura
const SAFE_MODE = false;

/**
 * HOME PAGE MODULE (V5.0 ADAPTER) - RESET NOTIFICHE
 * Gestisce l'interfaccia della Home Page.
 * - Entry Point: initHomePage(user) (chiamato da main.js)
 */

// Stato Globale Modulo
let currentUser = null;
let presentationObjectUrl = null;

// 1. INIT FUNCTION (Single Orchestrator)
export async function initHomePage(user) {
    if (!user) {
        console.error("[HOME] Init chiamato senza utente!");
        return;
    }

    
    currentUser = user;

    const pendingDeadlineLink = sessionStorage.getItem('pending_deadline_link');
    if (pendingDeadlineLink && /^\/dettaglio_scadenza\.html\?/.test(pendingDeadlineLink)) {
        sessionStorage.removeItem('pending_deadline_link');
        window.location.replace(pendingDeadlineLink);
        return;
    }

    // Inizializza Listeners immediatamente (non dipende da dati remoti)
    initHomeListeners();
    initAppPresentation();

    // Sblocco visibilità subito
    document.documentElement.setAttribute("data-i18n", "ready");

    // [FIX V8.1] Caricamenti paralleli e indipendenti:
    // Se il fetch delle aziende fallisce per un calo di rete,
    // il nome utente e le scadenze si caricano comunque.
    const [aziResult] = await Promise.allSettled([
        getDocs(collection(db, "users", user.uid, "aziende")),
        renderHeaderUser(user),
        renderDashboardDeadlines(user),
        renderDeadlineNotificationInbox(user)
    ]);

    // FAB Group dipende solo dal risultato delle aziende
    const aziendes = aziResult.status === 'fulfilled'
        ? aziResult.value.docs.map(d => ({ id: d.id, ...d.data() }))
        : [];

    if (aziResult.status === 'rejected') {
        console.warn("[HOME] Fetch aziende fallito (rete?), FAB in modalità default.", aziResult.reason);
    }

    setupFABGroup(aziendes);

    // L'impostazione sincronizzata contiene soltanto il consenso ad attivare la funzione.
    // Indice e risultati rimangono esclusivamente nella memoria della pagina.
    const assistantOverride = new URLSearchParams(window.location.search).get('assistant') === '1';
    let assistantEnabled = assistantOverride;
    if (!assistantEnabled) {
        try {
            const settingsSnapshot = await getDoc(doc(db, 'users', user.uid));
            assistantEnabled = settingsSnapshot.data()?.settings_ai_assistant === true;
        } catch (error) {
            console.warn('[ASSISTANT] Preferenza non disponibile.', error);
        }
    }
    if (assistantEnabled) {
        try {
            document.getElementById('ai-assistant-status')?.classList.remove('hidden');
            const { initVaultAssistant } = await import('../assistant/assistant-controller.js?v=1.2.39');
            await initVaultAssistant(user);
        } catch (error) {
            console.warn('[ASSISTANT] Avvio non riuscito.', error);
        }
    }

    
}

function initAppPresentation() {
    const openButton = document.getElementById('app-presentation-open');
    const modal = document.getElementById('app-presentation-modal');
    const playButton = document.getElementById('app-presentation-play');
    const stage = document.getElementById('app-presentation-stage');
    if (!openButton || !modal || !playButton || !stage) return;

    const closeModal = () => {
        modal.hidden = true;
        document.body.style.removeProperty('overflow');
        stage.querySelector('video')?.pause();
        openButton.focus();
    };

    openButton.addEventListener('click', () => {
        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        playButton.focus();
    });
    modal.querySelectorAll('[data-presentation-close]').forEach((element) => {
        element.addEventListener('click', closeModal);
    });
    modal.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') closeModal();
    });

    playButton.addEventListener('click', async () => {
        const existingVideo = stage.querySelector('video');
        if (existingVideo) {
            await existingVideo.play();
            return;
        }

        playButton.disabled = true;
        playButton.querySelector('span:last-child').textContent = 'Caricamento…';
        try {
            const idToken = await auth.currentUser?.getIdToken();
            if (!idToken) throw new Error('Sessione non disponibile.');
            const controller = new AbortController();
            const timeout = window.setTimeout(() => controller.abort(), 20000);
            let response;
            try {
                response = await fetch('/protected-media/presentation', {
                    headers: { Authorization: `Bearer ${idToken}` },
                    cache: 'no-store',
                    signal: controller.signal
                });
            } finally {
                window.clearTimeout(timeout);
            }
            if (!response.ok) throw new Error(`Download non disponibile (${response.status}).`);
            const blob = await response.blob();
            presentationObjectUrl = URL.createObjectURL(blob);
            const video = document.createElement('video');
            video.src = presentationObjectUrl;
            video.controls = true;
            video.playsInline = true;
            video.preload = 'metadata';
            video.setAttribute('aria-label', 'Presentazione di Codici e Password');
            stage.replaceChildren(video);
            playButton.querySelector('span:last-child').textContent = 'Riproduci';
            await video.play();
        } catch (error) {
            console.warn('[PRESENTAZIONE] Video non disponibile.', error);
            const message = document.createElement('div');
            message.className = 'app-presentation-loading';
            message.setAttribute('role', 'alert');
            message.textContent = 'Il video non è ancora disponibile. Riprova tra poco.';
            stage.replaceChildren(message);
            playButton.querySelector('span:last-child').textContent = 'Riprova';
        } finally {
            playButton.disabled = false;
        }
    });

    window.addEventListener('pagehide', () => {
        if (presentationObjectUrl) URL.revokeObjectURL(presentationObjectUrl);
    }, { once: true });
}

async function renderDeadlineNotificationInbox(user) {
    const notificationSnap = await getDocs(collection(db, 'users', user.uid, 'deadlineNotifications'));
    const unread = notificationSnap.docs
        .filter((item) => item.data().status === 'unread')
        .sort((left, right) => {
            const leftTime = left.data().createdAt?.toMillis?.() || 0;
            const rightTime = right.data().createdAt?.toMillis?.() || 0;
            return rightTime - leftTime;
        });
    if (!unread.length || document.getElementById('deadline-inbox-modal')) return;

    const entries = (await Promise.all(unread.slice(0, 10).map(async (notification) => {
        const data = notification.data();
        const deadline = await getDoc(doc(db, 'users', user.uid, 'scadenze', data.deadlineId));
        if (!deadline.exists() || deadline.data().completed) return null;
        const item = deadline.data();
        const label = `${item.type || 'Scadenza'}${item.veicolo_modello ? ` · ${item.veicolo_modello}` : ''}`;
        const when = data.diffDays === 0 ? 'Scade oggi' : data.diffDays === 1 ? 'Scade domani' : `Scadenza tra ${data.diffDays} giorni`;
        return createElement('button', {
            className: 'deadline-inbox-item',
            onclick: () => {
                window.location.href = `dettaglio_scadenza.html?id=${encodeURIComponent(data.deadlineId)}&notification=${encodeURIComponent(notification.id)}`;
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'notification_important' }),
            createElement('span', { className: 'deadline-inbox-copy' }, [
                createElement('strong', { textContent: label }),
                createElement('small', { textContent: when })
            ]),
            createElement('span', { className: 'material-symbols-outlined', textContent: 'chevron_right' })
        ]);
    }))).filter(Boolean);
    if (!entries.length) return;

    const modal = createElement('div', { id: 'deadline-inbox-modal', className: 'modal-overlay deadline-inbox-modal' }, [
        createElement('div', { className: 'modal-box deadline-inbox-box' }, [
            createElement('div', { className: 'deadline-inbox-heading' }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'notifications_active' }),
                createElement('div', {}, [
                    createElement('h2', { className: 'modal-title', textContent: 'Promemoria scadenze' }),
                    createElement('p', { textContent: `${entries.length} avvis${entries.length === 1 ? 'o' : 'i'} da controllare` })
                ])
            ]),
            createElement('div', { className: 'deadline-inbox-list' }, entries),
            createElement('button', {
                className: 'btn-modal btn-secondary',
                textContent: 'Ricordamelo dopo',
                onclick: () => modal.classList.remove('active')
            })
        ])
    ]);
    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('active'));
}

/**
 * Gestisce i click e gli eventi della Home Page (No Inline JS)
 */
function initHomeListeners() {
    // 1. Avatar Fallback (Sostituisce onerror inline)
    const avatarImg = document.getElementById('user-avatar-img');
    if (avatarImg) {
        avatarImg.addEventListener('error', function () {
            this.src = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00czLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYy04LTIuNjYtOC00LTh6Ii8+PC9zdmc+';
        });
    }
}


/**
 * Gestisce il rendering dell'utente nell'Header
 * (Foto, Nome, Saluto)
 */
/**
 * Gestisce il rendering dell'utente nell'Header
 * (Foto, Nome, Saluto)
 */
async function renderHeaderUser(user) {
    if (!user) return;

    // Riferimenti DOM
    const uAvatar = document.getElementById('header-user-avatar');
    const uGreeting = document.getElementById('home-greeting-text');
    const uName = document.getElementById('home-user-name');

    // 1. Calcolo Saluto
    const h = new Date().getHours();
    let timeGreeting = t('greeting_evening');
    if (h >= 6 && h < 13) timeGreeting = t('greeting_morning');
    else if (h >= 13 && h < 18) timeGreeting = t('greeting_afternoon');

    if (uGreeting) uGreeting.textContent = timeGreeting;

    // 2. Helper formattazione nome (Sicuro)
    const toFriendlyName = (name) => {
        if (!name || typeof name !== 'string') return "";
        return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    };

    // 3. Fallback immediato Nome (Auth)
    // [FIX V8.1] Rimosso controllo !uName.textContent: sovrascrive sempre
    // la scritta '...' iniziale con il nome da Firebase Auth appena disponibile.
    let displayName = toFriendlyName(user.displayName || user.email.split('@')[0]);
    if (uName) uName.textContent = displayName;

    // 4. Foto Utente (Auth)
    if (user.photoURL && uAvatar) setAvatarImage(uAvatar, user.photoURL);

    // 5. Firestore Profile Sync
    try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // ?? PROTOCOLLO BLINDA (V7.0): Decifrazione Profilo Utente
            let nomeRaw = data.nome;
            let cognomeRaw = data.cognome;

            // Se sono oggetti (legacy), li ignoriamo o li convertiamo in stringa vuota per evitare crash
            if (nomeRaw && typeof nomeRaw !== 'string') nomeRaw = "";
            if (cognomeRaw && typeof cognomeRaw !== 'string') cognomeRaw = "";

            let nome = nomeRaw || '';
            let cognome = cognomeRaw || '';

            try {
                // Tentativo di sblocco silenzioso
                if (isAutoUnlockActive()) {
                    const mk = await ensureMasterKey();
                    // [FIX V7.15] Regex più tollerante per Safari (include URL-safe e padding flessibile)
                    const isEnc = (v) => v && typeof v === 'string' && v.trim().length > 20 && /^[A-Za-z0-9+/=_-]+$/.test(v.trim());

                    let nameDecrypted = false;
                    if (isEnc(nome)) {
                        const temp = await decrypt(nome, mk);
                        if (temp !== "--ERRORE--") {
                            nome = temp;
                            nameDecrypted = true;
                        }
                    }
                    if (isEnc(cognome)) {
                        const temp = await decrypt(cognome, mk);
                        if (temp !== "--ERRORE--") {
                            cognome = temp;
                            nameDecrypted = true;
                        }
                    }

                    // Se abbiamo decifrato con successo almeno un campo, la chiave è valida!
                    if (nameDecrypted && !sessionStorage.getItem('vault_verified')) {
                        import('../../ui-core-v129.js').then(ui => ui.showToast("Password Master Corretta!", "success"));
                        sessionStorage.setItem('vault_verified', 'true');
                    }
                }
            } catch (e) {
                console.warn("[HOME] Vault Locked: visualizzazione dati o fallback.");
            }

            // [FIX V7.11] Controllo errore corretto (--ERRORE-- invece di [ERROR])
            const hasError = (s) => s && s.includes('--ERRORE--');

            if (hasError(nome) || hasError(cognome)) {
                if (SAFE_MODE) {
                    console.error("[HOME] Decryption Error detected in profile.");
                    showSelfHealingBanner();
                }
            }

            const finalNome = (!hasError(nome)) ? nome : '';
            const finalCognome = (!hasError(cognome)) ? cognome : '';

            const fullName = toFriendlyName(`${finalNome} ${finalCognome}`.trim());

            // Se abbiamo un nome da Firestore lo usiamo, altrimenti teniamo il displayName
            if (fullName && fullName.length > 1) {
                if (uName) {
                    uName.textContent = fullName;
                    if (SAFE_MODE) {
                        uName.style.cursor = 'pointer';
                        uName.title = "Clicca per resettare il Vault se vedi errori";
                        uName.onclick = async () => {
                            if (await showConfirmModal('Reset Vault', 'Vuoi resettare la cache del Vault? Dovrai reinserire la Master Password.')) {
                                resetVault();
                            }
                        };
                    }
                }
            } else if (displayName) {
                if (uName) uName.textContent = displayName;
            }

            const firestorePhoto = data.photoURL || data.avatar;
            if (firestorePhoto && uAvatar) setAvatarImage(uAvatar, firestorePhoto);
        }
    } catch (e) {
        console.warn("Errore profilo Firestore:", e);
    }
}

// Helper per impostare l'immagine avatar
function setAvatarImage(element, url) {
    if (!url) return;

    // Se element è l'ID header-user-avatar o simile
    const img = element.querySelector('img') || document.getElementById('user-avatar-img');

    if (img) {
        img.src = url;
    }
}

/**
 * [V7.11] MOSTRA BANNER DI AUTO-CURA
 * Se viene rilevato un errore di decriptazione, mostra un pulsante di emergenza.
 */
function showSelfHealingBanner() {
    if (document.getElementById('self-healing-banner')) return;

    const banner = createElement('div', {
        id: 'self-healing-banner',
        className: 'card border-glow self-healing-banner'
    }, [
        createElement('p', {
            className: 'self-healing-title',
            textContent: "?? Rilevato errore nei dati. La tua chiave potrebbe essere obsoleta."
        }),
        createElement('p', {
            className: 'self-healing-detail',
            textContent: getLastCryptoError() || "Errore sconosciuto (probabile offset buffer Safari)"
        }),
        createElement('button', {
            className: 'btn-primary self-healing-action',
            textContent: 'RIPRISTINA VAULT (RE-INSERISCI PASSWORD)',
            onclick: () => {
                resetVault();
            }
        })
    ]);

    const pageContainer = document.querySelector('.page-container');
    if (pageContainer) {
        pageContainer.prepend(banner);
    }
}

/**
 * Carica e renderizza i badge e le mini-liste di Scadenze e Urgenze
 */
async function renderDashboardDeadlines(user) {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thirtyDaysLater = new Date(today);
        thirtyDaysLater.setDate(today.getDate() + 30);

        const scadenzeRef = collection(db, "users", user.uid, "scadenze");
        const snap = await getDocs(scadenzeRef);

        const expired = [];
        const upcoming = [];

        snap.forEach(d => {
            const data = d.data();
            if (data.completed) return;

            const dueDateValue = data.dueDate || data.date;
            if (!dueDateValue) return;

            const dueDate = (dueDateValue && dueDateValue.toDate) ? dueDateValue.toDate() : new Date(dueDateValue);
            dueDate.setHours(0, 0, 0, 0);

            if (dueDate < today) {
                expired.push({ ...data, id: d.id, dateObj: dueDate });
            } else if (dueDate >= today && dueDate <= thirtyDaysLater) {
                upcoming.push({ ...data, id: d.id, dateObj: dueDate });
            }
        });

        // Ordinamento
        expired.sort((a, b) => a.dateObj - b.dateObj);
        upcoming.sort((a, b) => a.dateObj - b.dateObj);

        // Update UI Badge Scadenze (Prossime)
        const upBadge = document.getElementById('upcoming-count-badge');
        const upCount = document.getElementById('upcoming-count');
        const upList = document.getElementById('upcoming-list-container');

        if (upCount) upCount.textContent = upcoming.length;
        if (upBadge) {
            if (upcoming.length > 0) {
                upBadge.classList.remove('badge-initial-hide');
            } else {
                upBadge.classList.add('badge-initial-hide');
            }
        }
        if (upList) {
            clearElement(upList);
            upcoming.slice(0, 3).forEach(item => {
                upList.appendChild(renderMiniItem(item, today));
            });
        }

        // Update UI Badge Urgenze (Scadute)
        const exBadge = document.getElementById('expired-count-badge');
        const exCount = document.getElementById('expired-count');
        const exList = document.getElementById('expired-list-container');

        if (exCount) exCount.textContent = expired.length;
        if (exBadge) {
            if (expired.length > 0) {
                exBadge.classList.remove('badge-initial-hide');
            } else {
                exBadge.classList.add('badge-initial-hide');
            }
        }
        if (exList) {
            clearElement(exList);
            expired.slice(0, 3).forEach(item => {
                exList.appendChild(renderMiniItem(item, today));
            });
        }

    } catch (e) {
        console.error("Errore caricamento dashboard:", e);
    }
}

function renderMiniItem(item, today) {
    const diffTime = item.dateObj - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let labelText = "";
    if (diffDays < 0) labelText = t('expired');
    else if (diffDays === 0) labelText = t('today');
    else if (diffDays === 1) labelText = t('tomorrow');
    else labelText = `${diffDays}g`;

    const titleText = item.type || item.title || 'Scadenza Generale';

    return createElement('div', { className: 'dashboard-list-item' }, [
        createElement('div', { className: 'item-icon-box' }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: item.icon || 'event' })
        ]),
        createElement('span', { className: 'item-title', textContent: titleText }),
        createElement('span', { className: 'item-badge', textContent: labelText })
    ]);
}

// --- FAB GROUP (Quick Add Actions) ---
function setupFABGroup(aziendes = []) {
    function initFABFromFooter(detail) {
        const { center: footerCenter } = detail;
        if (!footerCenter) return;
        clearElement(footerCenter);

        // Container Gruppo
        const fabGroup = createElement('div', { className: 'fab-group' });

        // 1. Privato (SX)
        const btnPrivato = createElement('button', {
            className: 'btn-fab-action btn-fab-privato',
            title: 'Nuovo Privato',
            dataset: { label: 'Privato' },
            onclick: () => window.location.href = 'form_account_privato.html'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'person_add' })
        ]);

        // 2. Scadenza (Centro - Principale)
        const btnScadenza = createElement('button', {
            className: 'btn-fab-action btn-fab-scadenza',
            title: 'Nuova Scadenza',
            dataset: { label: 'Scadenza' },
            onclick: () => window.location.href = 'aggiungi_scadenza.html'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'event' })
        ]);

        // 3. Azienda (Dynamic Redirect)
        const btnAzienda = createElement('button', {
            className: 'btn-fab-action btn-fab-azienda',
            title: 'Nuovo Account Azienda',
            dataset: { label: 'Azienda' },
            onclick: () => {
                if (aziendes.length === 1) {
                    window.location.href = `form_account_azienda.html?aziendaId=${aziendes[0].id}`;
                } else if (aziendes.length > 1) {
                    window.location.href = 'lista_aziende.html?select=1';
                } else {
                    window.location.href = 'modifica_azienda.html';
                }
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'domain_add' })
        ]);

        // Assemblaggio
        fabGroup.appendChild(btnPrivato);
        fabGroup.appendChild(btnScadenza);
        fabGroup.appendChild(btnAzienda);

        footerCenter.appendChild(fabGroup);

        // Animazione Entrata Sequenziale
        const buttons = [btnPrivato, btnScadenza, btnAzienda];
        buttons.forEach((btn, index) => {
            btn.animate([
                { transform: 'scale(0) translateY(20px)', opacity: 0 },
                { transform: 'scale(1) translateY(0)', opacity: 1 }
            ], {
                duration: 400,
                delay: 500 + (index * 100),
                easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
                fill: 'backwards'
            });
        });
    }

    // V6.1: Late-subscriber safe — se il footer è già pronto, inizializza subito
    const _footerState = getFooterReady();
    if (_footerState) {
        initFABFromFooter(_footerState);
    } else {
        document.addEventListener('footer:ready', (e) => initFABFromFooter(e.detail), { once: true });
    }
}
