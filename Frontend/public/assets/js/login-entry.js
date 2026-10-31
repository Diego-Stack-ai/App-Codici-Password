/** Bootstrap minimale della pagina di accesso. */
import { initLogin } from './modules/auth/login.js?v=1.2.246';
import { mountDocumentationHelp, getDocumentationPageContext } from './guide.js';
import { loadLanguage, getCurrentLanguage, applyGlobalTranslations, observeTranslatedSubtrees } from './translations.js';
import { initOfflineStatus } from './offline-status.js';

document.addEventListener('DOMContentLoaded', async () => {
    mountDocumentationHelp(getDocumentationPageContext(window.location.pathname));
    initOfflineStatus();
    if ('serviceWorker' in navigator && navigator.onLine) {
        navigator.serviceWorker.register('./sw.js').catch((error) => {
            console.warn('[PWA] Preparazione offline non riuscita.', error);
        });
    }
    try {
        await loadLanguage(getCurrentLanguage());
        await initLogin();
        applyGlobalTranslations();
        observeTranslatedSubtrees();
    } catch (error) {
        console.error('[LOGIN] Bootstrap fallito:', error);
    } finally {
        document.documentElement.setAttribute('data-i18n', 'ready');
        document.body?.classList.add('revealed');
    }
});
