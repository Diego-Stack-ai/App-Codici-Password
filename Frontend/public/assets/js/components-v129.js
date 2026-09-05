import { createElement, setChildren, clearElement, createSafeAccountIcon } from './dom-utils.js';
import { LOG } from './logger.js';
import { auth } from './firebase-config.js?v=1.2.38';
import { signOut } from "/assets/js/vendor/firebase-runtime.js";
import { t } from './translations.js';
import { showLogoutModal } from './ui-core-v129.js';
import { setFooterReady } from './footer-state.js';
import { APP_VERSION } from './env-v126.js';

// Guard idempotenza — sostituisce window.__componentsInitialized
let _componentsInitialized = false;

const AUTH_PATHS = new Set([
    '/',
    '/index.html',
    '/login-v115.html',
    '/registrati.html',
    '/reset_password.html',
    '/imposta_nuova_password.html'
]);

/**
 * Torna alla pagina interna realmente precedente quando il browser la espone.
 * Dopo refresh, deep-link, login o provenienza esterna usa invece il parent
 * gerarchico indicato dalla pagina corrente.
 */
function navigateBack(fallbackHref, preferHistory = true) {
    try {
        const previous = document.referrer ? new URL(document.referrer) : null;
        const current = new URL(window.location.href);
        const previousPath = previous?.pathname.toLowerCase();
        const isSafeInternalPrevious = previous
            && previous.origin === current.origin
            && previous.href !== current.href
            && !AUTH_PATHS.has(previousPath);

        if (preferHistory && isSafeInternalPrevious && window.history.length > 1) {
            window.history.back();
            return;
        }
    } catch (error) {
        LOG('[NAV] Referrer non utilizzabile, applico il fallback gerarchico', error);
    }

    window.location.replace(fallbackHref);
}


/**
 * Inizializza i componenti condivisi (Header/Footer)
 * Rileva automaticamente se siamo su una pagina Auth o App.
 */
export async function initComponents() {
    // Guard idempotente: evita doppia inizializzazione e fetch multipli
    if (_componentsInitialized) return;
    _componentsInitialized = true;

    try {
        const path = window.location.pathname;
        const pageTitle = document.title.split(' - ')[0] || 'App Codici Password';

        // Versione unica disponibile su tutte le pagine e mostrata dove previsto.
        document.documentElement.dataset.appVersion = APP_VERSION;
        // L'attributo sull'elemento <html> serve solo come metadato. Non deve
        // ricevere textContent, altrimenti verrebbe cancellata l'intera pagina.
        document.querySelectorAll('[data-app-version]:not(html)').forEach(element => {
            element.textContent = APP_VERSION;
        });

        const isHome = document.body?.classList.contains('home-page') || path === '/home' || path.endsWith('home_page.html') || /^\/home-v\d+\.html$/.test(path);
        // Pagine che non devono avere header/footer standard (Login, Registrazione, etc)
        const isAuth = ['login-v115.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'].some(p => path.endsWith(p)) || path.endsWith('/');

        const h = new Date().getHours();
        const timeGreeting = (h >= 6 && h < 13) ? t('greeting_morning') : (h >= 13 && h < 18) ? t('greeting_afternoon') : t('greeting_evening');

        // 1. SETUP HEADER
        const headerPh = document.getElementById('header-placeholder');
        if (headerPh) {
            clearElement(headerPh);
            const headerLeft = createElement('div', { id: 'header-left', className: 'header-left' });
            const headerCenter = createElement('div', { id: 'header-center', className: 'header-center' });
            const headerRight = createElement('div', { id: 'header-right', className: 'header-right' });

            if (isHome) {
                // EXCEPTION 2.1: Home Page Left -> Avatar Utente (V7.0 Standard)
                const avatarLink = createElement('button', {
                    id: 'header-user-avatar',
                    type: 'button',
                    className: 'header-avatar-box header-profile-trigger',
                    title: t('page_title_profile') || 'Profilo',
                    onclick: () => window.location.href = 'profilo_privato.html'
                }, [
                    createElement('img', {
                        id: 'user-avatar-img',
                        src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00czLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYy04LTIuNjYtOC00LTh6Ii8+PC9zdmc+'
                    })
                ]);
                headerLeft.style.display = 'flex';
                headerLeft.style.alignItems = 'center';
                headerLeft.appendChild(avatarLink);
            } else if (!isAuth) {
                // Back Button (Solo se non siamo su Auth o Home)
                let fallbackHref = 'home_page.html';
                let preferHistory = true;
                const urlParams = new URLSearchParams(window.location.search);

                // Mapping Logico Navigazione
                // La pagina precedente reale ha priorità; questa mappa interviene
                // soltanto dopo refresh, deep-link o provenienza non attendibile.
                if (path.endsWith('lista_aziende.html') || path.endsWith('scadenze.html')) {
                    fallbackHref = 'home_page.html';
                } else if (path.endsWith('area_privata.html')) {
                    fallbackHref = 'home_page.html';
                } else if (path.endsWith('dettaglio_scadenza.html')) {
                    fallbackHref = 'scadenze.html';
                } else if (path.endsWith('aggiungi_scadenza.html')) {
                    const id = urlParams.get('id');
                    fallbackHref = id ? `dettaglio_scadenza.html?id=${id}` : 'scadenze.html';
                } else if (path.endsWith('impostazioni.html')) {
                    fallbackHref = 'home_page.html';
                } else if (path.endsWith('regole_scadenze.html')) {
                    fallbackHref = 'impostazioni.html';
                } else if (path.endsWith('privacy.html') || path.endsWith('termini.html')) {
                    fallbackHref = 'impostazioni.html';
                } else if (path.endsWith('configurazione_automezzi.html') || path.endsWith('configurazione_documenti.html') || path.endsWith('configurazione_generali.html')) {
                    fallbackHref = 'regole_scadenze.html';
                } else if (path.endsWith('archivio_account.html')) {
                    fallbackHref = 'impostazioni.html';
                } else if (path.endsWith('account_azienda.html') || path.endsWith('dati_azienda.html')) {
                    fallbackHref = 'lista_aziende.html';
                    // Sono entrambe viste principali dell'azienda: la freccia
                    // deve tornare sempre all'elenco, non seguire percorsi
                    // intermedi rimasti nella history del browser/PWA.
                    preferHistory = false;
                } else if (path.endsWith('dettaglio_account_azienda.html')) {
                    const aziendaId = urlParams.get('aziendaId') || urlParams.get('id_azienda');
                    fallbackHref = aziendaId ? `account_azienda.html?id=${aziendaId}` : 'lista_aziende.html';
                } else if (path.endsWith('form_account_azienda.html')) {
                    const accountId = urlParams.get('id');
                    const aziendaId = urlParams.get('aziendaId') || urlParams.get('id_azienda');
                    if (accountId && aziendaId) fallbackHref = `dettaglio_account_azienda.html?id=${accountId}&aziendaId=${aziendaId}`;
                    else fallbackHref = aziendaId ? `account_azienda.html?id=${aziendaId}` : 'lista_aziende.html';
                } else if (path.endsWith('modifica_azienda.html')) {
                    const id = urlParams.get('id');
                    fallbackHref = id ? `dati_azienda.html?id=${id}` : 'lista_aziende.html';
                    // Modifica con id e nuova azienda senza id hanno due parent
                    // distinti e deterministici: non dipendono dalla history.
                    preferHistory = false;
                } else if (path.endsWith('profilo_privato_v2.html')) {
                    fallbackHref = 'home_page.html';
                } else if (path.endsWith('profilo_privato.html')) {
                    fallbackHref = 'home_page.html';
                } else if (path.endsWith('account_privati.html')) {
                    fallbackHref = 'area_privata.html';
                } else if (path.endsWith('dettaglio_account_privato.html')) {
                    fallbackHref = 'account_privati.html';
                } else if (path.endsWith('form_account_privato.html')) {
                    const id = urlParams.get('id');
                    fallbackHref = id ? `dettaglio_account_privato.html?id=${id}` : 'account_privati.html';
                }

                const backFn = () => navigateBack(fallbackHref, preferHistory);

                headerLeft.appendChild(
                    createElement('button', { className: 'btn-icon-header', dataset: { action: 'back' }, onclick: backFn }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
                    ])
                );
            }

            // Title / Greeting (per tutte le pagine non-auth)
            if (!isAuth) {
                if (isHome) {
                    const user = auth.currentUser;
                    // [FIX V8.1] Fallback neutro: email-prefix se disponibile, altrimenti '...'
                    // Evita la parola 'Utente' che l'utente interpreta come un errore.
                    const initialName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '...';

                    const greetingCont = createElement('button', {
                        type: 'button',
                        className: 'header-greeting-trigger',
                        title: t('page_title_profile') || 'Profilo',
                        onclick: () => window.location.href = 'profilo_privato.html'
                    }, [
                        createElement('span', { id: 'home-greeting-text', className: 'header-greeting', textContent: timeGreeting }),
                        createElement('h1', { id: 'home-user-name', className: 'header-title', textContent: initialName })
                    ]);
                    headerCenter.appendChild(greetingCont);
                } else {
                    let displayTitle = pageTitle;
                    if (path.includes('impostazioni.html')) displayTitle = t('settings_title');
                    else if (path.includes('archivio_account.html')) displayTitle = t('account_archive');
                    else if (path.includes('profilo_privato_v2.html')) displayTitle = 'Profilo Utente V2';
                    else if (path.includes('profilo_privato.html')) displayTitle = t('page_title_profile');
                    else if (path.includes('regole_scadenze.html')) displayTitle = t('expiry_rules_title_page');
                    else if (path.includes('configurazione_automezzi.html')) displayTitle = t('vehicles_config_title');
                    else if (path.includes('configurazione_documenti.html')) displayTitle = t('documents_config_title');
                    else if (path.includes('configurazione_generali.html')) displayTitle = t('general_config_title');

                    headerCenter.appendChild(createElement('h1', { className: 'header-title', textContent: displayTitle }));
                }

                // Home Button / Logout
                if (isHome) {
                    const assistantStatus = document.getElementById('ai-assistant-status');
                    if (assistantStatus) {
                        assistantStatus.classList.add('header-ai-status');
                        headerRight.appendChild(assistantStatus);
                    }

                    headerRight.appendChild(
                        createElement('button', {
                            id: 'header-logout-btn',
                            className: 'btn-icon-header',
                            onclick: async () => {
                                const confirmed = await showLogoutModal();
                                if (confirmed) {
                                    await signOut(auth);
                                    window.location.href = 'login-v115.html';
                                }
                            }
                        }, [
                            createElement('span', { className: 'material-symbols-outlined', textContent: 'logout' })
                        ])
                    );
                } else {
                    headerRight.appendChild(
                        createElement('a', { href: 'home_page.html', className: 'btn-icon-header' }, [
                            createElement('span', { className: 'material-symbols-outlined', textContent: 'home' })
                        ])
                    );
                }
            }

            const headerContent = createElement('div', { id: 'header-content', className: 'header-balanced-container' }, [
                headerLeft, headerCenter, headerRight
            ]);
            // Il placeholder HTML è già <header class="base-header">: evitiamo
            // un secondo header fisso annidato, che duplica maschera e compositing.
            setChildren(headerPh, headerContent);
        }

        // 2. SETUP FOOTER
        const footerPh = document.getElementById('footer-placeholder');
        if (footerPh) {
            clearElement(footerPh);
            const isOnSettings = path.includes('impostazioni.html');
            const footerLeft = createElement('div', { className: 'header-left' });



            const footerCenter = createElement('div', { id: 'footer-center-actions', className: 'header-center' });

            // GUIDA RAPIDA (Icona Centrale - Solo Profilo)
            if (path.includes('profilo_privato')) {
                const guideBtn = createElement('button', {
                    className: 'btn-icon-header',
                    title: 'Guida Profilo',
                    onclick: () => {
                        openGuideModal(t('profile_guide_title') || 'Guida Profilo', [
                            t('profile_guide_step1') || 'Gestisci i tuoi dati (Anagrafica, Residenza, Documenti).',
                            t('profile_guide_step2') || 'Usa la spunta QR per decidere cosa condividere.',
                            t('profile_guide_step3') || 'Clicca sul QR Code per ingrandirlo.'
                        ]);
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'info' })
                ]);
                footerCenter.appendChild(guideBtn);

                if (path.endsWith('profilo_privato.html')) {
                    footerCenter.appendChild(createElement('a', {
                        className: 'btn-icon-header',
                        href: 'profilo_privato_v2.html',
                        title: 'Apri Profilo Utente V2',
                        ariaLabel: 'Apri Profilo Utente V2'
                    }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'dashboard_customize' })]));
                }
            }

            const footerRight = createElement('div', { id: 'footer-right-actions', className: 'header-right' });

            // Settings Link
            if (!isAuth) {
                if (!isOnSettings) {
                    const settLink = createElement('div', { id: 'footer-settings-link' });
                    settLink.appendChild(
                        createElement('a', {
                            href: 'impostazioni.html',
                            className: 'btn-footer-secondary footer-settings-link',
                            title: 'Impostazioni'
                        }, [
                            createElement('span', { className: 'material-symbols-outlined footer-settings-icon', textContent: 'tune' })
                        ])
                    );
                    footerRight.appendChild(settLink);
                }
            }

            // FIX V8.1: Il placeholder HTML è già <footer class="base-footer">.
            // Iniettare un secondo <footer> annidato causa doppia mascheratura CSS
            // (backdrop-filter + mask-image sovrapposti) → footer completamente invisibile.
            // Soluzione: popolare DIRETTAMENTE il placeholder esistente senza wrap aggiuntivo.
            const footerContent = createElement('div', { id: 'footer-content', className: 'header-balanced-container' }, [
                footerLeft, footerCenter, footerRight
            ]);
            setChildren(footerPh, footerContent);

            // ── CONTRATTO ARCHITETTURALE V7.0 ──
            // Evento dispatchato UNA SOLA VOLTA dopo che il footer è nel DOM.
            // window.__footerReady memorizza lo stato per i moduli che si registrano tardi
            // (race condition con onAuthStateChanged che è asincrono).
            const footerReadyDetail = {
                left: footerLeft,
                center: footerCenter,
                right: footerRight
            };
            setFooterReady(footerReadyDetail);
            document.dispatchEvent(new CustomEvent('footer:ready', {
                detail: footerReadyDetail
            }));
        }

        LOG("PROTOCOLLO V7.0 MASTER Components Initialized (DOM Safe)");

    } catch (e) {
        console.error("Errore inizializzazione componenti:", e);
    }
}

/**
 * Helper locale per aprire il modale guida (evita dipendenze cicliche)
 */
function openGuideModal(title, steps) {
    // Rimuovi modali esistenti
    const existing = document.getElementById('guide-modal-local');
    if (existing) existing.remove();

    const modal = createElement('div', { id: 'guide-modal-local', className: 'modal-overlay' });

    // Contenuto passaggi
    const stepsContent = steps.map((step, i) => createElement('div', {
        className: 'guide-step'
    }, [
        createElement('strong', { className: 'guide-step-number', textContent: `${i + 1}.` }),
        createElement('span', { className: 'guide-step-text', textContent: step })
    ]));

    const btnClose = createElement('button', {
        className: 'btn-modal btn-primary guide-close-button',
        textContent: t('close') || 'Chiudi',
        onclick: () => {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    });

    const content = createElement('div', { className: 'modal-box' }, [
        createElement('span', { className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'help_outline' }),
        createElement('h3', { className: 'modal-title', textContent: title }),
        createElement('div', { className: 'modal-body mt-4 mb-4 text-left w-full' }, stepsContent),
        createElement('div', { className: 'modal-actions' }, [btnClose])
    ]);

    modal.appendChild(content);
    document.body.appendChild(modal);

    // Animazione apertura
    requestAnimationFrame(() => modal.classList.add('active'));

    // Chiusura al click fuori
    modal.onclick = (e) => {
        if (e.target === modal) btnClose.click();
    };
}
