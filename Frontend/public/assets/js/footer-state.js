/**
 * FOOTER STATE SINGLETON (V1.0)
 * Sostituisce window.__footerReady con un pattern ES6 importabile.
 * I moduli pagina che si registrano dopo il dispatch dell'evento
 * 'footer:ready' usano getFooterReady() come fallback sincrono.
 */

let _footerDetail = null;

/** Chiamata da components.js al momento del dispatch footer:ready */
export function setFooterReady(detail) {
    _footerDetail = detail;
}

/** Usata dai moduli pagina come fallback se l'evento è stato mancato */
export function getFooterReady() {
    return _footerDetail;
}
