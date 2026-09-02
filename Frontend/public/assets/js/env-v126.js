/**
 * ENV SINGLETON (V1.0)
 * Sostituisce window.__APP_ENV con un export ES6.
 * Letto una sola volta al caricamento del modulo.
 */
export const APP_ENV = document.documentElement.dataset.env || 'production';
export const APP_VERSION = 'v1.2.12';
