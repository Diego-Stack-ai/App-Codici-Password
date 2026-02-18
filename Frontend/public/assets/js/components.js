import { createElement, setChildren, clearElement, createSafeAccountIcon } from './dom-utils.js';
import { auth } from './firebase-config.js';
import { signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { t } from './translations.js';

/**
 * Inizializza i componenti condivisi (Header/Footer)
 * Rileva automaticamente se siamo su una pagina Auth o App.
 */
export async function initComponents() {
    try {
        const path = window.location.pathname;
        const pageTitle = document.title.split(' - ')[0] || 'App Codici Password';

        const isHome = path.endsWith('home_page.html');
        // Pagine che non devono avere header/footer standard (Login, Registrazione, etc)
        const isAuth = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'].some(p => path.endsWith(p)) || path.endsWith('/');

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
                // EXCEPTION 2.1: Home Page Left -> Avatar Utente (V3.9 Standard)
                const avatarLink = createElement('div', {
                    id: 'header-user-avatar',
                    className: 'header-avatar-box cursor-pointer',
                    onclick: () => window.location.href = 'profilo_privato.html'
                }, [
                    createElement('img', {
                        id: 'user-avatar-img',
                        src: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZiI+PHBhdGggZD0iTTEyIDEyYzIuMjEgMCA0LTEuNzkgNC00czLTEuNzktNC00LTRzLTQgMS43OS00IDQgMS43OSA0IDQgNHptMCAyYy0yLjY3IDAtOCAxLjM0LTggNHYyaDE2di0yYy04LTIuNjYtOC00LTh6Ii8+PC9zdmc+'
                    })
                ]);
                headerLeft.appendChild(avatarLink);
            } else if (!isAuth) {
                // Back Button (Solo se non siamo su Auth o Home)
                let backFn = () => window.history.back();
                const urlParams = new URLSearchParams(window.location.search);
                const accountId = urlParams.get('id');
                const aziendaId = urlParams.get('aziendaId');

                // Mapping Logico Navigazione STRETTO (Solo Ciclo Azienda / Scadenze)
                if (path.endsWith('lista_aziende.html') || path.endsWith('scadenze.html')) {
                    backFn = () => window.location.href = 'home_page.html';
                } else if (path.endsWith('dettaglio_scadenza.html')) {
                    backFn = () => window.location.href = 'scadenze.html';
                } else if (path.endsWith('aggiungi_scadenza.html')) {
                    const id = urlParams.get('id');
                    if (id) backFn = () => window.location.href = `dettaglio_scadenza.html?id=${id}`;
                    else backFn = () => window.location.href = 'scadenze.html';
                } else if (path.endsWith('impostazioni.html')) {
                    backFn = () => window.location.href = 'home_page.html';
                } else if (path.endsWith('regole_scadenze.html')) {
                    backFn = () => window.location.href = 'impostazioni.html';
                } else if (path.endsWith('privacy.html') || path.endsWith('termini.html')) {
                    backFn = () => window.location.href = 'impostazioni.html';
                } else if (path.endsWith('configurazione_automezzi.html') || path.endsWith('configurazione_documenti.html') || path.endsWith('configurazione_generali.html')) {
                    backFn = () => window.location.href = 'regole_scadenze.html';
                } else if (path.endsWith('archivio_account.html') || path.endsWith('notifiche_storia.html')) {
                    backFn = () => window.location.href = 'impostazioni.html';
                } else if (path.endsWith('account_azienda.html') || path.endsWith('dati_azienda.html')) {
                    backFn = () => window.location.href = 'lista_aziende.html';
                } else if (path.endsWith('dettaglio_account_azienda.html')) {
                    const aziendaId = urlParams.get('aziendaId') || urlParams.get('id_azienda'); // Robustezza
                    backFn = () => window.location.href = `account_azienda.html?id=${aziendaId}`;
                } else if (path.endsWith('form_account_azienda.html')) {
                    const accountId = urlParams.get('id');
                    const aziendaId = urlParams.get('aziendaId') || urlParams.get('id_azienda');
                    if (accountId) backFn = () => window.location.href = `dettaglio_account_azienda.html?id=${accountId}&aziendaId=${aziendaId}`;
                    else backFn = () => window.location.href = `account_azienda.html?id=${aziendaId}`;
                } else if (path.endsWith('modifica_azienda.html')) {
                    const id = urlParams.get('id');
                    backFn = () => window.location.href = `dati_azienda.html?id=${id}`;
                } else if (path.endsWith('aggiungi_nuova_azienda.html')) {
                    backFn = () => window.location.href = 'lista_aziende.html';
                } else if (path.endsWith('profilo_privato.html') || path.endsWith('account_privati.html')) {
                    backFn = () => window.location.href = 'home_page.html';
                } else if (path.endsWith('dettaglio_account_privato.html')) {
                    backFn = () => window.location.href = 'account_privati.html';
                } else if (path.endsWith('form_account_privato.html')) {
                    const id = urlParams.get('id');
                    if (id) backFn = () => window.location.href = `dettaglio_account_privato.html?id=${id}`;
                    else backFn = () => window.location.href = 'account_privati.html';
                }

                headerLeft.appendChild(
                    createElement('button', { className: 'btn-icon-header', dataset: { action: 'back' }, onclick: backFn }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
                    ])
                );

                // Title / Greeting
                if (isHome) {
                    const greetingCont = createElement('div', {
                        className: 'flex flex-col items-center cursor-pointer',
                        onclick: () => window.location.href = 'profilo_privato.html'
                    }, [
                        createElement('span', { id: 'home-greeting-text', className: 'text-[9px] opacity-30 uppercase font-black tracking-widest', textContent: timeGreeting }),
                        createElement('h1', { id: 'home-user-name', className: 'header-title', textContent: 'Utente' })
                    ]);
                    headerCenter.appendChild(greetingCont);
                } else {
                    let displayTitle = pageTitle;
                    if (path.includes('impostazioni.html')) displayTitle = t('settings_title');
                    else if (path.includes('archivio_account.html')) displayTitle = t('account_archive');
                    else if (path.includes('profilo_privato.html')) displayTitle = t('page_title_profile');
                    else if (path.includes('regole_scadenze.html')) displayTitle = t('expiry_rules_title_page');
                    else if (path.includes('configurazione_automezzi.html')) displayTitle = t('vehicles_config_title');
                    else if (path.includes('configurazione_documenti.html')) displayTitle = t('documents_config_title');
                    else if (path.includes('configurazione_generali.html')) displayTitle = t('general_config_title');
                    else if (path.includes('notifiche_storia.html')) displayTitle = t('notifications_history_title');

                    headerCenter.appendChild(createElement('h1', { className: 'header-title', textContent: displayTitle }));
                }

                // Home Button / Logout
                if (isHome) {
                    headerRight.appendChild(
                        createElement('button', {
                            id: 'header-logout-btn',
                            className: 'btn-icon-header',
                            onclick: async () => {
                                if (typeof window.showLogoutModal === 'function') {
                                    const confirmed = await window.showLogoutModal();
                                    if (confirmed) {
                                        await signOut(auth);
                                        window.location.href = 'index.html';
                                    }
                                } else {
                                    if (confirm(t('logout_confirm') || "Vuoi uscire?")) {
                                        await signOut(auth);
                                        window.location.href = 'index.html';
                                    }
                                }
                            }
                        }, [
                            createElement('span', { className: 'material-symbols-outlined', textContent: 'logout' })
                        ])
                    );
                } else if (!isAuth) {
                    headerRight.appendChild(
                        createElement('a', { href: 'home_page.html', className: 'btn-icon-header' }, [
                            createElement('span', { className: 'material-symbols-outlined', textContent: 'home' })
                        ])
                    );
                }

                const headerContent = createElement('div', { id: 'header-content', className: 'header-balanced-container' }, [
                    headerLeft, headerCenter, headerRight
                ]);

                const header = createElement('header', { className: 'base-header' }, [headerContent]);
                headerPh.appendChild(header);
            }

            // 2. SETUP FOOTER
            const footerPh = document.getElementById('footer-placeholder');
            if (footerPh) {
                clearElement(footerPh);
                const isOnSettings = path.includes('impostazioni.html');
                const footerLeft = createElement('div', { className: 'header-left' });

                if (!isOnSettings) {
                    footerLeft.appendChild(
                        createElement('button', {
                            id: isHome ? 'theme-toggle-home' : 'theme-toggle-standard',
                            className: 'btn-icon-header',
                            title: 'Cambia Tema',
                            onclick: () => document.documentElement.classList.toggle('dark')
                        }, [
                            createElement('span', { className: 'material-symbols-outlined', textContent: 'contrast' })
                        ])
                    );
                }

                const footerCenter = createElement('div', { id: 'footer-center-actions', className: 'header-center' });

                // GUIDA RAPIDA (Icona Centrale - Solo Profilo)
                if (path.includes('profilo_privato.html')) {
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
                }

                const footerRight = createElement('div', { id: 'footer-right-actions', className: 'header-right' });

                // Settings Link
                if (!isAuth) {
                    const isOnSettings = path.includes('impostazioni.html');
                    if (!isOnSettings) {
                        const settLink = createElement('div', { id: 'footer-settings-link' });
                        settLink.appendChild(
                            createElement('a', {
                                href: 'impostazioni.html',
                                className: 'btn-icon-header footer-settings-link',
                                title: 'Impostazioni'
                            }, [
                                createElement('span', { className: 'material-symbols-outlined footer-settings-icon', textContent: 'tune' })
                            ])
                        );
                        footerRight.appendChild(settLink);
                    }
                }

                // Inseriamo lo spacer prima del footer per spingere il contenuto su
                const spacer = createElement('div', { className: 'spacer-footer' });
                footerPh.parentNode.insertBefore(spacer, footerPh);

                const footerContent = createElement('div', { id: 'footer-content', className: 'header-balanced-container' }, [
                    footerLeft, footerCenter, footerRight
                ]);
                setChildren(footerPh, footerContent); // Moved this line here

                const footer = createElement('footer', { className: 'base-footer' }, [footerContent]);
                footerPh.appendChild(footer);
            }

            console.log("PROTOCOLLO BASE Components Initialized (DOM Safe) V4.5");

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
            className: 'flex-start-row mb-3',
            style: 'display: flex; align-items: flex-start; margin-bottom: 0.75rem;'
        }, [
            createElement('strong', { className: 'text-accent mr-2', style: 'margin-right: 0.5rem; color: var(--accent); white-space: nowrap;', textContent: `${i + 1}.` }),
            createElement('span', { className: 'text-secondary text-sm', style: 'color: var(--text-secondary); font-size: 0.9rem; line-height: 1.4;', textContent: step })
        ]));

        const btnClose = createElement('button', {
            className: 'btn-modal btn-primary',
            style: 'width: 100%; margin-top: 1rem;',
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
