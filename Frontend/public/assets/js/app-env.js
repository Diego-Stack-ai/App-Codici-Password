/**
 * Configurazione runtime stabile dell'app.
 * Il nome del file non contiene una versione: il cache busting e la coerenza
 * della release sono gestiti da APP_VERSION e dallo script di rilascio.
 */
export const APP_ENV = document.documentElement.dataset.env || 'production';
export const APP_VERSION = 'v1.2.259';
