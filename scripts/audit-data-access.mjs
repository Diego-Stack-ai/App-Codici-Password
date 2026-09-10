import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {readdir} from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const repository = await read('Frontend/public/assets/js/modules/data/vault-repository.js');
const coordinator = await read('Frontend/public/assets/js/modules/data/request-coordinator.js');
const offlineFirestore = await read('Frontend/public/assets/js/offline-firestore.js');
const privateSave = await read('Frontend/public/assets/js/modules/privato/form-privato-save.js');
const privateDetail = await read('Frontend/public/assets/js/modules/privato/dettaglio_account_privato.js');
const companySave = await read('Frontend/public/assets/js/modules/azienda/form-azienda-save.js');
const companyDetail = await read('Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js');

assert.match(coordinator, /const pendingReads = new Map\(\)/, 'Coordinatore richieste M2 mancante');
assert.match(coordinator, /\.finally\(/, 'Le richieste concluse non vengono liberate');
assert.match(repository, /listPrivateAccounts/, 'Repository Account privati mancante');
assert.match(repository, /listAcceptedInvites/, 'Repository inviti accettati mancante');
assert.match(repository, /listCompanies/, 'Repository Aziende mancante');
assert.match(repository, /listCompanyAccounts/, 'Repository Account aziendali mancante');
assert.match(repository, /listDeadlines/, 'Repository Scadenze mancante');
assert.match(repository, /coalesceRead\(key,[\s\S]*?\.then\(records\)/,
    'Il repository non separa la lettura condivisa dagli oggetti consegnati alle pagine');
assert.match(offlineFirestore, /getDocFromServer/,
    'La lettura documento server-confirmed non usa una sorgente Firestore esplicita');
assert.match(offlineFirestore, /getDocsFromServer/,
    'La lettura collezione server-confirmed non usa una sorgente Firestore esplicita');
assert.match(privateSave, /afterWrite=1/,
    'Il salvataggio Account privato non richiede il read-after-write');
assert.match(companySave, /afterWrite=1/,
    'Il salvataggio Account aziendale non richiede il read-after-write');
assert.match(privateDetail, /getPrivateAccountConfirmed/,
    'Il dettaglio privato non dispone della lettura confermata dopo write');
assert.match(companyDetail, /getCompanyAccountConfirmed/,
    'Il dettaglio aziendale non dispone della lettura confermata dopo write');

const migratedPages = await Promise.all([
    'Frontend/public/assets/js/modules/privato/account_privati.js',
    'Frontend/public/assets/js/modules/privato/area_privata.js',
    'Frontend/public/assets/js/modules/azienda/lista_aziende.js',
    'Frontend/public/assets/js/modules/azienda/account_azienda.js',
    'Frontend/public/assets/js/modules/scadenze/scadenze.js',
    'Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js',
    'Frontend/public/assets/js/modules/azienda/dati_azienda.js',
    'Frontend/public/assets/js/modules/azienda/modifica_azienda.js',
    'Frontend/public/assets/js/modules/privato/profilo_privato.js',
    'Frontend/public/assets/js/modules/privato/profilo-links.js',
    'Frontend/public/assets/js/modules/privato/profilo-widgets.js',
    'Frontend/public/assets/js/modules/privato/form_account_privato.js',
    'Frontend/public/assets/js/modules/azienda/form_account_azienda.js',
    'Frontend/public/assets/js/modules/settings/impostazioni.js',
    'Frontend/public/assets/js/modules/scadenze/configurazione_generali.js',
    'Frontend/public/assets/js/modules/scadenze/configurazione_documenti.js',
    'Frontend/public/assets/js/modules/scadenze/configurazione_automezzi.js',
    'Frontend/public/assets/js/modules/scadenze/aggiungi_scadenza.js',
    'Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js',
    'Frontend/public/assets/js/modules/home/home.js',
    'Frontend/public/assets/js/modules/assistant/vault-data-loader.js',
    'Frontend/public/assets/js/modules/azienda/dettaglio-azienda-attachments.js'
].map(read));

assert.ok(migratedPages.every(source => !source.includes('offline-firestore.js')),
    'Una pagina migrata è tornata a dipendere direttamente dalla strategia cache/rete');
assert.ok(migratedPages.every(source => source.includes("../data/vault-repository.js")),
    'Una pagina migrata non usa il repository di dominio');

const modulesRoot = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
async function listJavaScript(directory) {
    const entries = await readdir(directory, {withFileTypes: true});
    const nested = await Promise.all(entries.map(entry => {
        const target = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
        return entry.isDirectory() ? listJavaScript(target) : (entry.name.endsWith('.js') ? [target] : []);
    }));
    return nested.flat();
}
const moduleFiles = await listJavaScript(modulesRoot);
for (const file of moduleFiles) {
    if (file.pathname.endsWith('/data/vault-repository.js')) continue;
    const source = await readFile(file, 'utf8');
    assert.ok(!source.includes('offline-firestore.js'),
        `Accesso cache/rete diretto fuori dal repository: ${file.pathname}`);
}

console.log('Audit accesso dati M2: repository unico protetto.');
