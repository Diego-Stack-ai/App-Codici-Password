import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const homeDeadlineInbox = await read('Frontend/public/assets/js/modules/home/home-deadline-inbox.js');
const homeDeadlineDashboard = await read('Frontend/public/assets/js/modules/home/home-deadline-dashboard.js');

const [company, privateAccount, companyAccount, deadline, privateDetail, privateAttachments, privateSharing] = await Promise.all([
    read('Frontend/public/assets/js/modules/azienda/ma_save.js'),
    read('Frontend/public/assets/js/modules/privato/form_account_privato.js'),
    read('Frontend/public/assets/js/modules/azienda/form-azienda-save.js'),
    read('Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js'),
    read('Frontend/public/assets/js/modules/privato/dettaglio_account_privato.js'),
    read('Frontend/public/assets/js/modules/privato/dettaglio-privato-attachments.js'),
    read('Frontend/public/assets/js/modules/privato/dettaglio-privato-sharing.js')
]);

assert.match(company, /window\.location\.replace\(`dati_azienda\.html\?id=\$\{state\.currentAziendaId\}`\)/,
    'Il salvataggio azienda lascia il modulo Modifica nella cronologia');
assert.match(privateAccount, /isEditing[\s\S]+dettaglio_account_privato\.html[\s\S]+window\.location\.replace\(destination\)/,
    'Il salvataggio account privato non sostituisce il modulo di modifica');
assert.match(companyAccount, /isEditing[\s\S]+dettaglio_account_azienda\.html[\s\S]+window\.location\.replace\(destination\)/,
    'Il salvataggio account aziendale non sostituisce il modulo di modifica');
assert.match(deadline, /window\.location\.replace\(`dettaglio_scadenza\.html\?id=\$\{finalDocId\}`\)/,
    'Il salvataggio scadenza lascia il modulo Modifica nella cronologia');
assert.equal((privateAttachments.match(/handleFileUpload\(/g) || []).length, 2,
    'Il dettaglio privato collega più volte lo stesso caricamento allegato');
if (/\bauth\.currentUser\b/.test(privateSharing)) {
    assert.match(privateSharing, /import \{[^}]*\bauth\b[^}]*\} from ['"]\.\.\/\.\.\/firebase-config\.js/,
        'La condivisione privata usa auth senza importarlo');
}
assert.match(privateSharing, /const guestUid = wasAccepted[\s\S]+delete sharedWith\[normalizedEmail\]/,
    'La revoca privata perde l’UID ospite prima di creare la notifica');
assert.match(homeDeadlineInbox, /unread\.slice\(0, 10\)/,
    'La Home non limita il lavoro dell’inbox Scadenze');
assert.match(homeDeadlineInbox, /dettaglio_scadenza\.html\?id=\$\{encodeURIComponent\(notification\.deadlineId\)\}&notification=\$\{encodeURIComponent\(notification\.id\)\}/,
    'L’inbox Home non apre la Scadenza e la consegna specifiche');
assert.match(homeDeadlineDashboard, /thirtyDaysLater\.setDate\(today\.getDate\(\) \+ 30\)/,
    'La dashboard Home non applica la finestra di 30 giorni');
assert.match(homeDeadlineDashboard, /items\.slice\(0, 3\)/,
    'La dashboard Home non limita le anteprime per sezione');

console.log('Navigazione post-salvataggio coerente: i moduli completati non restano nella cronologia.');
