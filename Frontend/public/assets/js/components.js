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
        const timeGreeting = (h >= 5 && h < 13) ? "Buongiorno" : (h >= 13 && h < 18) ? "Buon pomeriggio" : "Buonasera";

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

                // Mapping Logico Navigazione STRETTO (Solo Ciclo Azienda)
                if (path.endsWith('lista_aziende.html')) {
                    backFn = () => window.location.href = 'home_page.html';
                } else if (path.endsWith('account_azienda.html')) {
                    backFn = () => window.location.href = 'lista_aziende.html';
                } else if (path.endsWith('dettaglio_account_azienda.html')) {
                    backFn = () => window.location.href = `account_azienda.html?id=${aziendaId}`;
                } else if (path.endsWith('form_account_azienda.html')) {
                    if (accountId) backFn = () => window.location.href = `dettaglio_account_azienda.html?id=${accountId}&aziendaId=${aziendaId}`;
                    else backFn = () => window.location.href = `account_azienda.html?id=${aziendaId}`;
                }

                headerLeft.appendChild(
                    createElement('button', { className: 'btn-icon-header', dataset: { action: 'back' }, onclick: backFn }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
                    ])
                );
            }

            // Title / Greeting
            if (isHome) {
                const greetingCont = createElement('div', { className: 'flex flex-col items-center' }, [
                    createElement('span', { id: 'home-greeting-text', className: 'text-[9px] opacity-30 uppercase font-black tracking-widest', textContent: timeGreeting }),
                    createElement('h1', { id: 'home-user-name', className: 'header-title', textContent: 'Utente' })
                ]);
                headerCenter.appendChild(greetingCont);
            } else {
                headerCenter.appendChild(createElement('h1', { className: 'header-title', textContent: pageTitle }));
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
            const footerLeft = createElement('div', { className: 'header-left' }, [
                createElement('button', {
                    id: isHome ? 'theme-toggle-home' : 'theme-toggle-standard',
                    className: 'btn-icon-header',
                    title: 'Cambia Tema',
                    onclick: () => document.documentElement.classList.toggle('dark')
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'contrast' })
                ])
            ]);

            const footerCenter = createElement('div', { id: 'footer-center-actions', className: 'header-center' });
            const footerRight = createElement('div', { id: 'footer-right-actions', className: 'header-right' });

            // Settings Link
            if (!isAuth) {
                const isOnSettings = path.includes('impostazioni.html');
                const settLink = createElement('div', { id: 'footer-settings-link' });
                settLink.appendChild(
                    createElement('a', {
                        href: isOnSettings ? '#' : 'impostazioni.html',
                        className: `btn-icon-header footer-settings-link ${isOnSettings ? 'opacity-30 pointer-events-none' : ''}`,
                        title: isOnSettings ? 'Sei qui' : 'Impostazioni'
                    }, [
                        createElement('span', { className: 'material-symbols-outlined footer-settings-icon', textContent: 'tune' })
                    ])
                );
                footerRight.appendChild(settLink);
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
