/**
 * PROTOCOLLO BASE COMPONENTS SYSTEM (V4.5)
 * Utility per caricare Header e Footer in modo sicuro e dinamico.
 * Refactor: Rimozione innerHTML, uso dom-utils.js.
 * V4.5: Settings button ora opaco/disabilitato su impostazioni.html invece di nascosto.
 */

import { createElement, setChildren, clearElement } from './dom-utils.js';

/**
 * Inizializza i componenti condivisi (Header/Footer)
 * Rileva automaticamente se siamo su una pagina Auth o App.
 */
export async function initComponents() {
    try {
        const path = window.location.pathname;
        const pageTitle = document.title.split(' - ')[0] || 'App Codici Password';

        // Definiamo le pagine di Auth per nascondere controlli di navigazione
        const isAuth = ['index.html', 'registrati.html', 'reset_password.html', 'imposta_nuova_password.html'].some(p => path.endsWith(p)) || path.endsWith('/');

        // 1. SETUP HEADER
        const headerPh = document.getElementById('header-placeholder');
        if (headerPh) {
            clearElement(headerPh);
            const headerLeft = createElement('div', { id: 'header-left', className: 'header-left' });
            const headerCenter = createElement('div', { id: 'header-center', className: 'header-center' });
            const headerRight = createElement('div', { id: 'header-right', className: 'header-right' });

            // Back Button (Solo se non siamo su Auth o Home)
            if (!isAuth && !path.endsWith('home_page.html')) {
                let backFn = () => window.history.back();

                // Override back behavior for specific pages to ensure logical navigation
                const urlParams = new URLSearchParams(window.location.search);
                const aziendaId = urlParams.get('aziendaId') || urlParams.get('id'); // 'id' su account_azienda.html, 'aziendaId' su dettaglio

                if (path.endsWith('dettaglio_account_privato.html') || path.endsWith('form_account_privato.html')) {
                    backFn = () => window.location.href = 'account_privati.html';
                } else if (path.endsWith('lista_aziende.html')) {
                    backFn = () => window.location.href = 'home_page.html';
                } else if (path.endsWith('account_azienda.html') || path.endsWith('dati_azienda.html') || path.endsWith('modifica_azienda.html')) {
                    backFn = () => window.location.href = 'lista_aziende.html';
                } else if (path.endsWith('dettaglio_account_azienda.html') || path.endsWith('form_account_azienda.html') || path.endsWith('modifica_account_azienda.html')) {
                    // Torna alla lista account di quella specifica azienda
                    backFn = () => window.location.href = `account_azienda.html?id=${aziendaId}`;
                }

                headerLeft.appendChild(
                    createElement('button', { className: 'btn-icon-header', dataset: { action: 'back' }, onclick: backFn }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
                    ])
                );
            }

            // Title
            headerCenter.appendChild(createElement('h1', { className: 'header-title', textContent: pageTitle }));

            // Home Button (Solo se non siamo su Auth)
            if (!isAuth) {
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
                    className: 'btn-icon-header',
                    title: 'Cambia Tema',
                    dataset: { action: 'toggle-theme' },
                    onclick: () => document.documentElement.classList.toggle('dark')
                }, [
                    createElement('span', { className: 'material-symbols-outlined', textContent: 'contrast' })
                ])
            ]);

            const footerCenter = createElement('div', { id: 'footer-center-actions', className: 'header-center' });

            const footerRight = createElement('div', { id: 'footer-right-actions', className: 'header-right' });

            // Settings Link (Sempre visibile, opaco se sei su Impostazioni)
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

            const footerContent = createElement('div', { id: 'footer-content', className: 'header-balanced-container' }, [
                footerLeft, footerCenter, footerRight
            ]);

            const footer = createElement('footer', { className: 'base-footer' }, [footerContent]);
            footerPh.appendChild(footer);
        }

        console.log("PROTOCOLLO BASE Components Initialized (DOM Safe) V4.5");

    } catch (e) {
        console.error("Errore inizializzazione componenti:", e);
    }
}
