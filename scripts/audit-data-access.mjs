import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read = relative => readFile(new URL(`../${relative}`, import.meta.url), 'utf8');
const repository = await read('Frontend/public/assets/js/modules/data/vault-repository.js');
const coordinator = await read('Frontend/public/assets/js/modules/data/request-coordinator.js');

assert.match(coordinator, /const pendingReads = new Map\(\)/, 'Coordinatore richieste M2 mancante');
assert.match(coordinator, /\.finally\(/, 'Le richieste concluse non vengono liberate');
assert.match(repository, /listPrivateAccounts/, 'Repository Account privati mancante');
assert.match(repository, /listAcceptedInvites/, 'Repository inviti accettati mancante');
assert.match(repository, /listCompanies/, 'Repository Aziende mancante');
assert.match(repository, /listCompanyAccounts/, 'Repository Account aziendali mancante');
assert.match(repository, /listDeadlines/, 'Repository Scadenze mancante');
assert.match(repository, /coalesceRead\(key,[\s\S]*?\.then\(records\)/,
    'Il repository non separa la lettura condivisa dagli oggetti consegnati alle pagine');

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
    'Frontend/public/assets/js/modules/privato/profilo-widgets.js'
].map(read));

assert.ok(migratedPages.every(source => !source.includes('offline-firestore.js')),
    'Una pagina migrata è tornata a dipendere direttamente dalla strategia cache/rete');
assert.ok(migratedPages.every(source => source.includes("../data/vault-repository.js")),
    'Una pagina migrata non usa il repository di dominio');

console.log('Audit accesso dati M2: primo perimetro protetto.');
