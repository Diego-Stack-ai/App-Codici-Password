import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root = new URL('../Frontend/public/', import.meta.url);
const [main, privateSharing, companySharing, detailCss] = await Promise.all([
    readFile(new URL('assets/js/main-v129.js', root), 'utf8'),
    readFile(new URL('assets/js/modules/privato/dettaglio-privato-sharing.js', root), 'utf8'),
    readFile(new URL('assets/js/modules/azienda/dettaglio-azienda-sharing.js', root), 'utf8'),
    readFile(new URL('assets/css/account_detail.css', root), 'utf8')
]);

test('popup invito: Accetta e Rifiuta usano i pulsanti standard dell app', () => {
    assert.match(main, /id: 'btn-invite-reject',[\s\S]*?className: 'btn-modal btn-secondary'/);
    assert.match(main, /id: 'btn-invite-accept',[\s\S]*?className: 'btn-modal btn-primary'/);
});

test('gestione accessi: layout compatto senza avatar ridondante', () => {
    for (const source of [privateSharing, companySharing]) {
        assert.match(source, /sharing-recipient-actions/);
        assert.doesNotMatch(source, /rubrica-item-avatar/);
    }
    assert.match(detailCss, /\.sharing-recipient-actions\s*\{[\s\S]*?gap:\s*10px/);
    assert.match(detailCss, /\.sharing-revoke-button\s*\{[\s\S]*?width:\s*42px/);
});
