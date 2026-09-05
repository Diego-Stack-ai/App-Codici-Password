/** Bootstrap minimale della pagina di accesso. */
import { initLogin } from './modules/auth/login.js?v=1.2.32';
import { loadLanguage, getCurrentLanguage, applyGlobalTranslations } from './translations.js';

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await loadLanguage(getCurrentLanguage());
        await initLogin();
        applyGlobalTranslations();
    } catch (error) {
        console.error('[LOGIN] Bootstrap fallito:', error);
    } finally {
        document.documentElement.setAttribute('data-i18n', 'ready');
        document.body?.classList.add('revealed');
    }
});
