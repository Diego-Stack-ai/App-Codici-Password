// Shared semantic decoration metadata. Color livery never changes page structure.
export const pageSymbols = Object.freeze({
    'home_page.html': 'home',
    'area_privata.html': 'lock',
    'account_privati.html': 'key',
    'form_account_privato.html': 'key',
    'dettaglio_account_privato.html': 'key',
    'account_azienda.html': 'business_center',
    'form_account_azienda.html': 'business_center',
    'dettaglio_account_azienda.html': 'business_center',
    'profilo_privato.html': 'person',
    'impostazioni.html': 'settings',
    'archivio_account.html': 'archive',
    'scadenze.html': 'event',
    'aggiungi_scadenza.html': 'event',
    'dettaglio_scadenza.html': 'event',
    'regole_scadenze.html': 'rule',
    'gestione_destinatari.html': 'contact_mail',
    'configurazione_automezzi.html': 'directions_car',
    'configurazione_documenti.html': 'description',
    'configurazione_generali.html': 'settings_applications',
    'lista_aziende.html': 'apartment',
    'modifica_azienda.html': 'apartment',
    'dati_azienda.html': 'apartment'
});

export function installPageDecorations(doc, pathname) {
    if (!doc.body?.hasAttribute('data-ui-revision')) return;
    const symbol = pageSymbols[String(pathname).split('/').pop()];
    const container = doc.querySelector('.base-container');
    if (!symbol || !container) return;
    doc.body.style.setProperty('--page-symbol', `'${symbol}'`);
    let watermark = container.querySelector('.archive-watermark');
    if (!watermark) {
        watermark = doc.createElement('div');
        watermark.className = 'archive-watermark';
        const glyph = doc.createElement('span');
        glyph.className = 'material-symbols-outlined notranslate';
        glyph.setAttribute('translate', 'no');
        watermark.append(glyph);
        container.prepend(watermark);
    }
    watermark.setAttribute('aria-hidden', 'true');
    const glyph = watermark.querySelector('.material-symbols-outlined');
    if (glyph) glyph.textContent = symbol;
}
