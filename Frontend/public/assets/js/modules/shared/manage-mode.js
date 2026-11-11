/**
 * MODALITÀ MODIFICA PER SEZIONE (contratto UI a tre livelli, 10/11/2026)
 *
 * In consultazione una sezione mostra dati e azioni rapide; i comandi di
 * gestione (aggiungi, modifica, collega/scollega, QR, elimina) compaiono solo
 * dopo «Modifica». Lo stato vive nell'attributo `data-manage` della sezione:
 * è solo presentazione, non cambia permessi, dati o conferme esistenti.
 *
 * Un blocco della Vault, un logout o il cambio di linguetta riportano tutte le
 * sezioni in consultazione.
 */
import { createElement } from '../../dom-utils.js';
import { t } from '../../translations.js';

const installed = new WeakSet();
// Intestazioni di sezione riconosciute: profili (form-section), pagine di dettaglio e
// riga d'intestazione del Profilo azienda (accordion + azione, senza pulsanti annidati).
const HEADER = ':scope > :is(.form-section-header, .detail-section-header, .profile-overview-heading)';
const TITLE = '.form-section-title, .detail-section-title';

function label(active) {
    return active ? (t('ui_manage_done') || 'Fine') : (t('ui_manage_edit') || 'Modifica');
}

export function setSectionManage(section, active) {
    if (!section) return;
    section.dataset.manage = active ? 'on' : 'off';
    const toggle = section.querySelector(`${HEADER} .manage-toggle`);
    if (toggle) {
        toggle.setAttribute('aria-pressed', String(active));
        toggle.querySelector('.manage-toggle-label').textContent = label(active);
    }
}

export function resetManageMode(root = document) {
    root.querySelectorAll('[data-manage="on"]').forEach(section => setSectionManage(section, false));
}

function expandIfCollapsed(section) {
    const header = section.querySelector(':scope > .form-section-header.collapsible-header');
    if (header?.classList.contains('collapsed')) header.click();
}

/**
 * Aggiunge il comando «Modifica/Fine» all'intestazione di ogni sezione indicata.
 * @param {ParentNode} root
 * @param {string} selector - sezioni gestibili (es. '.form-section[data-manageable]')
 */
export function installManageMode(root = document, selector = '[data-manageable]') {
    root.querySelectorAll(selector).forEach(section => {
        if (installed.has(section)) return;
        const header = section.querySelector(HEADER);
        if (!header) return;
        installed.add(section);
        const title = header.querySelector(TITLE)?.textContent?.trim() || '';
        const toggle = createElement('button', {
            type: 'button',
            className: 'manage-toggle',
            'aria-pressed': 'false',
            'aria-label': title ? `${t('ui_manage_edit') || 'Modifica'}: ${title}` : (t('ui_manage_edit') || 'Modifica')
        }, [createElement('span', { className: 'manage-toggle-label', textContent: label(false) })]);
        toggle.addEventListener('click', event => {
            event.stopPropagation();
            const active = section.dataset.manage !== 'on';
            if (active) expandIfCollapsed(section);
            setSectionManage(section, active);
        });
        const expand = header.querySelector('.expand-icon');
        if (expand) header.insertBefore(toggle, expand); else header.append(toggle);
        section.dataset.manage = 'off';
    });
    if (installed.has(root)) return;
    installed.add(root);
    const reset = () => resetManageMode(root);
    globalThis.addEventListener?.('vault-session-locked', reset);
    globalThis.addEventListener?.('private-auth-blocked', reset);
    // translations.js emette l'evento sul document, senza bubbling.
    const doc = root.ownerDocument || root;
    doc.addEventListener?.('app-language-applied', () => {
        root.querySelectorAll('.manage-toggle').forEach(toggle => {
            const active = toggle.getAttribute('aria-pressed') === 'true';
            toggle.querySelector('.manage-toggle-label').textContent = label(active);
            const title = toggle.closest(HEADER.replace(':scope > ', ''))?.querySelector(TITLE)?.textContent?.trim();
            const edit = t('ui_manage_edit') || 'Modifica';
            toggle.setAttribute('aria-label', title ? `${edit}: ${title}` : edit);
        });
    });
    // Cambio effettivo di linguetta, da mouse, tastiera (frecce/Home/End) o codice:
    // una linguetta che passa da aria-selected=false a true chiude ogni Modifica.
    const Observer = globalThis.MutationObserver;
    if (Observer) {
        new Observer(records => {
            if (records.some(record => record.target.matches?.('[role="tab"]') &&
                record.oldValue === 'false' && record.target.getAttribute('aria-selected') === 'true')) reset();
        }).observe(root === doc ? doc.documentElement : root, {
            subtree: true, attributes: true, attributeFilter: ['aria-selected'], attributeOldValue: true
        });
    }
    root.addEventListener?.('click', event => {
        if (event.target.closest?.('[role="tab"]')) reset();
    });
}
