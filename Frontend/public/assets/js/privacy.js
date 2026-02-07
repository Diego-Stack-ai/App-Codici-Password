import { t } from './translations.js';

/**
 * [PRIVACY] MODULE V3.6
 * Gestisce le traduzioni della pagina Privacy Policy.
 */

function applyTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        const trans = t(key);
        if (trans && trans !== key) el.innerHTML = trans;
    });
}

document.addEventListener('DOMContentLoaded', applyTranslations);
