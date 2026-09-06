import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');
const homeDeadlineInbox = await read('Frontend/public/assets/js/modules/home/home-deadline-inbox.js');
const homeDeadlineDashboard = await read('Frontend/public/assets/js/modules/home/home-deadline-dashboard.js');
const deadlineConfigController = await read('Frontend/public/assets/js/modules/scadenze/deadline-config-controller.js');
const deadlineSaveService = await read('Frontend/public/assets/js/modules/scadenze/deadline-save-service.js');
const privateAccountList = await read('Frontend/public/assets/js/modules/privato/account_privati.js');
const companyAccountList = await read('Frontend/public/assets/js/modules/azienda/account_azienda.js');
const accountListView = await read('Frontend/public/assets/js/modules/shared/account-list-view.js');
const companyDetail = await read('Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js');
const accountBankingView = await read('Frontend/public/assets/js/modules/shared/account-banking-view.js');

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
assert.match(deadline, /createDeadlineConfigController\(\{[\s\S]+recipientController/,
    'Il form Scadenza non delega la configurazione dinamica al controller dedicato');
assert.doesNotMatch(deadline, /getUserSetting\(|DEFAULT_CONFIGS|function populateTypeSelect/,
    'Il form Scadenza contiene ancora caricamento o rendering delle configurazioni');
assert.match(deadlineConfigController, /Promise\.all\(\[[\s\S]+getUserSetting\(user\.uid, MODE_DOCUMENTS\.automezzi\)/,
    'Il controller configurazioni non carica in parallelo i dati necessari');
assert.match(deadlineConfigController, /normalizeDeadlineConfig\(/,
    'Il controller configurazioni non applica il modello normalizzato condiviso');
assert.match(deadline, /await saveDeadline\(\{/,
    'Il form Scadenza non delega la persistenza al servizio dedicato');
assert.doesNotMatch(deadline, /uploadBytes\(|writeBatch\(|addDoc\(/,
    'Il form Scadenza contiene ancora dettagli Storage o Firestore della persistenza');
assert.match(deadlineSaveService, /contentType: 'application\/octet-stream'[\s\S]+encrypted: 'v1'/,
    'Il servizio Scadenze non conserva il contratto degli allegati cifrati');
assert.match(deadlineSaveService, /batch\.set\(deadlineRef, deadlineData\)[\s\S]+expiryReference/,
    'Il servizio Scadenze non mantiene atomico il collegamento ai documenti Profilo');
for (const [name, source] of [['privata', privateAccountList], ['aziendale', companyAccountList]]) {
    assert.match(source, /createAccountListView\(\{/,
        `La lista Account ${name} non usa la vista condivisa`);
    assert.doesNotMatch(source, /function createDataRow|new SwipeList/,
        `La lista Account ${name} duplica ancora righe sensibili o SwipeList`);
}
assert.match(accountListView, /createCardSecretResolver\(copyValue, encrypted && isPassword\)/,
    'La vista Account condivisa non mantiene la risoluzione lazy delle password');
assert.match(accountListView, /account\.password \? createDataRow\([^\n]+true, account\._encrypted\)/,
    'La vista Account condivisa non mantiene la password cifrata fino a reveal/copia');
for (const [name, source] of [['privato', privateDetail], ['aziendale', companyDetail]]) {
    assert.match(source, /renderAccountBanking\(acc, \{/,
        `Il dettaglio Account ${name} non usa la vista bancaria condivisa`);
    assert.doesNotMatch(source, /function renderBanking|normalizeBankingAccounts/,
        `Il dettaglio Account ${name} duplica ancora il renderer bancario`);
}
assert.match(accountBankingView, /hasRealBankingData\(account\)/,
    'La vista bancaria non applica il modello comune ai dati legacy e canonici');
assert.match(accountBankingView, /card\.pin \? createReadonlyField\('PIN',[^\n]+true\)/,
    'La vista bancaria non protegge visivamente il PIN');

console.log('Navigazione post-salvataggio coerente: i moduli completati non restano nella cronologia.');
