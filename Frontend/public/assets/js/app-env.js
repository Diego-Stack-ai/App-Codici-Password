/**
 * Configurazione runtime stabile dell'app.
 * Il nome del file non contiene una versione: il cache busting e la coerenza
 * della release sono gestiti da APP_VERSION e dallo script di rilascio.
 */
export const APP_ENV = document.documentElement.dataset.env || 'production';
// A2 is publishable but cannot activate; B1 must add a server-only admission adapter.
export const VAULT_FRAME_ENABLED = true;
export const APP_VERSION = 'v1.2.271';

// Explicit intent always selects a safe screen, including while unavailable.
// No storage, environment, hostname or query parameter may enable the feature.
export const COMPLETE_RECOVERY_ENABLED = false;
export const COMPLETE_RECOVERY_PATH = '/impostazioni.html?recovery=complete';
export const COMPLETE_RECOVERY_LOGIN_PATH = '/login.html?recovery=complete';
export const COMPLETE_RECOVERY_REAUTH_PATH = '/login.html?recovery=complete&reauth=complete-recovery';
export function hasCompleteRecoveryIntent(location) {
    if (!/(?:^|\/)(?:login|impostazioni)\.html$/.test(location?.pathname || '')) return false;
    const values = new URLSearchParams(location.search || '').getAll('recovery');
    return values.length === 1 && values[0] === 'complete';
}
export function isCompleteRecoveryRoute(location) {
    return /(?:^|\/)impostazioni\.html$/.test(location?.pathname || '') && hasCompleteRecoveryIntent(location);
}
export function completeRecoveryLoginPath(location, verifyEmail = false) {
    return hasCompleteRecoveryIntent(location) ? COMPLETE_RECOVERY_LOGIN_PATH + (verifyEmail ? '&verifyEmail=1' : '') :
        '/login.html' + (verifyEmail ? '?verifyEmail=1' : '');
}
