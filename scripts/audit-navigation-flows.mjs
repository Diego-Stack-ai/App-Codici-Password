import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

const [company, privateAccount, companyAccount, deadline] = await Promise.all([
    read('Frontend/public/assets/js/modules/azienda/ma_save.js'),
    read('Frontend/public/assets/js/modules/privato/form_account_privato.js'),
    read('Frontend/public/assets/js/modules/azienda/form-azienda-save.js'),
    read('Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js')
]);

assert.match(company, /window\.location\.replace\(`dati_azienda\.html\?id=\$\{state\.currentAziendaId\}`\)/,
    'Il salvataggio azienda lascia il modulo Modifica nella cronologia');
assert.match(privateAccount, /isEditing[\s\S]+dettaglio_account_privato\.html[\s\S]+window\.location\.replace\(destination\)/,
    'Il salvataggio account privato non sostituisce il modulo di modifica');
assert.match(companyAccount, /isEditing[\s\S]+dettaglio_account_azienda\.html[\s\S]+window\.location\.replace\(destination\)/,
    'Il salvataggio account aziendale non sostituisce il modulo di modifica');
assert.match(deadline, /window\.location\.replace\(`dettaglio_scadenza\.html\?id=\$\{finalDocId\}`\)/,
    'Il salvataggio scadenza lascia il modulo Modifica nella cronologia');

console.log('Navigazione post-salvataggio coerente: i moduli completati non restano nella cronologia.');
