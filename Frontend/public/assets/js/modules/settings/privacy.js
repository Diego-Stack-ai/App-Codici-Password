/**
 * PRIVACY MODULE (V4.4)
 * Gestisce le traduzioni della pagina Privacy Policy.
 * Refactor: Rimozione innerHTML, uso di safeSetText.
 */

import { t } from '../../translations.js';
import { safeSetText } from '../../dom-utils.js';

function applyTranslations() {
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        const trans = t(key);

        if (trans && trans !== key) {
            safeSetText(el, trans);
        }
    });
}

document.addEventListener('DOMContentLoaded', applyTranslations);
