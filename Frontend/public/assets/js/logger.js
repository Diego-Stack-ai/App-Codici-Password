/**
 * LOGGER MODULE (V1.0)
 * Rimpiazza window.LOG, window.LOG_ERROR, window.LOG_WARN con export ES6.
 * Silenzioso in produzione, attivo in sviluppo.
 *
 * Uso: import { LOG, LOG_ERROR, LOG_WARN } from '../logger.js';
 */

const _env = document.documentElement.dataset.env || 'production';
const _isProd = _env === 'production';

const _noop = () => {};

// Bind preventivo per preservare la stack trace originale nel DevTools
export const LOG       = _isProd ? _noop : console.log.bind(console);
export const LOG_ERROR = _isProd ? _noop : console.error.bind(console);
export const LOG_WARN  = _isProd ? _noop : console.warn.bind(console);
