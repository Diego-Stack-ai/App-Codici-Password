// Dialogo dei risultati del censimento: caricato solo al clic, fuori dal bundle iniziale delle Impostazioni.
import {createElement} from '../../dom-utils.js';
import {t, tf} from '../../translations.js';

export function showVaultFormatCensusResults(report, summary, action) {
    action.check();
    const modal = createElement('div', {
        className: 'modal-overlay', role: 'dialog', 'aria-modal': 'true',
        'aria-labelledby': 'vault-census-title'
    });
    const downloadButton = createElement('button', {
        type: 'button', className: 'btn-modal btn-secondary', textContent: t('settings_census_download')
    });
    const closeButton = createElement('button', {type: 'button', className: 'btn-modal btn-primary', textContent: t('close')});
    const previouslyFocused = document.activeElement;
    const close = () => {
        const restoreFocus = action.active();
        action.dispose();
        if (restoreFocus && previouslyFocused?.isConnected) previouslyFocused.focus?.();
    };
    let downloadUrl = null;
    const timer = setTimeout(() => {
        if (!action.active()) return;
        modal.classList.add('active'); closeButton.focus();
    }, 10);
    action.own(() => {
        clearTimeout(timer);
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        modal.replaceChildren(); modal.remove();
    });
    downloadButton.addEventListener('click', () => {
        if (!action.active()) return;
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        // Il rapporto contiene soltanto conteggi: viene salvato solo su richiesta, in locale.
        downloadUrl = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'}));
        const link = createElement('a', {href: downloadUrl, download: `censimento-vault-${new Date().toISOString().slice(0, 10)}.json`});
        link.click();
    });
    closeButton.addEventListener('click', close);
    const headers = ['settings_census_table_area', 'settings_census_table_records', 'settings_census_table_old',
        'settings_census_table_legacy', 'settings_census_table_unopened', 'settings_census_table_ambiguous',
        'settings_census_table_errors'];
    const table = createElement('table', {className: 'account-field-usage-table'}, [
        createElement('thead', {}, [createElement('tr', {}, headers.map(key => createElement('th', {scope: 'col', textContent: t(key)})))]),
        createElement('tbody', {}, summary.rows.map(row => createElement('tr', {}, [
            createElement('th', {scope: 'row', textContent: row.id}),
            createElement('td', {textContent: String(row.records)}),
            createElement('td', {textContent: String(row.old)}),
            createElement('td', {textContent: String(row.legacy)}),
            createElement('td', {textContent: String(row.unopened)}),
            createElement('td', {textContent: String(row.ambiguous)}),
            createElement('td', {textContent: String(row.errors)})
        ])))
    ]);
    const region = createElement('div', {className: 'account-field-usage-scroll', tabIndex: 0, role: 'region',
        'aria-label': t('settings_census_title')}, [table]);
    const onKeydown = event => {
        if (!action.active()) return;
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(); }
        else if (event.key === 'Tab') {
            event.preventDefault();
            const controls = [region, downloadButton, closeButton], index = controls.indexOf(document.activeElement);
            controls[event.shiftKey ? (index <= 0 ? controls.length - 1 : index - 1) : (index + 1) % controls.length].focus();
        }
    };
    modal.addEventListener('keydown', onKeydown);
    action.own(() => modal.removeEventListener('keydown', onKeydown));
    const totals = summary.totals;
    modal.appendChild(createElement('div', {className: 'modal-box account-field-usage-modal'}, [
        createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue notranslate', textContent: 'fact_check'}),
        createElement('h3', {id: 'vault-census-title', className: 'modal-title', textContent: t('settings_census_title')}),
        createElement('p', {className: 'modal-text', textContent: tf('settings_census_summary', {
            records: totals.records, fields: totals.fields, old: totals.old, legacy: totals.legacy,
            attachments: totals.attachmentsNeedFull, unopened: totals.unopened, ambiguous: totals.ambiguous,
            errors: totals.errors, uncovered: totals.uncovered
        })}),
        summary.identity.unopened
            ? createElement('p', {className: 'modal-text', textContent: t('settings_census_identity_unopened')})
            : null,
        summary.identity.needsFullKeyring
            ? createElement('p', {className: 'modal-text', textContent: t('settings_census_identity_full')})
            : null,
        region,
        createElement('p', {className: 'account-field-usage-privacy', textContent: t('settings_census_privacy')}),
        createElement('div', {className: 'modal-actions'}, [downloadButton, closeButton])
    ]));
    document.body.appendChild(modal);
}
