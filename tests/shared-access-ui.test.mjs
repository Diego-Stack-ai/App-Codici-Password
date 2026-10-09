import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../Frontend/public/', import.meta.url);
const [main, privateSharing, companySharing, privateHtml, companyHtml] = await Promise.all([
    readFile(new URL('assets/js/main-v129.js', root), 'utf8'),
    readFile(new URL('assets/js/modules/privato/dettaglio-privato-sharing.js', root), 'utf8'),
    readFile(new URL('assets/js/modules/azienda/dettaglio-azienda-sharing.js', root), 'utf8'),
    readFile(new URL('dettaglio_account_privato.html', root), 'utf8'),
    readFile(new URL('dettaglio_account_azienda.html', root), 'utf8')
]);

test('popup invito: Accetta e Rifiuta usano i pulsanti standard dell app', () => {
    assert.match(main, /id: 'btn-invite-reject',[\s\S]*?className: 'btn-modal btn-secondary'/);
    assert.match(main, /id: 'btn-invite-accept',[\s\S]*?className: 'btn-modal btn-primary'/);
});

test('dettaglio condivisione: solo nomi e nessun controllo mutante', () => {
    for (const source of [privateSharing, companySharing]) {
        assert.match(source, /rubrica-item-name/);
        assert.doesNotMatch(source, /sharing-recipient-actions|sharing-revoke-button|showConfirmModal|runTransaction/);
    }
    for (const html of [privateHtml, companyHtml]) {
        assert.match(html, />Condivisione</);
        assert.doesNotMatch(html, /account-mode-section|btn-save-account-mode/);
    }
});
