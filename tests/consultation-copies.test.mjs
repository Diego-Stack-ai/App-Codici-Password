import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readdir, readFile} from 'node:fs/promises';

// M7-T24 — Copie di consultazione (report, Excel, altre copie) e purge.
//
// Il banco esegue i moduli reali che producono le copie di consultazione e
// distingue tre situazioni:
//   1. copia **solo in memoria** (nessun file, azzerata alla chiusura);
//   2. copia **file dell'utente** (esce dal controllo dell'app);
//   3. contenuto **ancora disponibile tramite cache** dopo il purge.
//
// Cosa è **reale**: `account-field-usage-model/service.js`,
// `showCredentialHealthResults` di `impostazioni.js`, `downloadVCard` di
// `profilo_privato.js` e i percorsi di export (`backup-export-service.js`).
// Cosa è **simulato**: DOM, Blob/URL, storage e repository (in Node non
// esistono). Nessun file o dato personale reale è stato letto o creato.
const root = new URL('../Frontend/public/', import.meta.url);
// I file possono essere LF o CRLF a seconda di come git li ha materializzati:
// il banco normalizza, altrimenti i tagli su `\n}\n` dipenderebbero dal checkout.
const read = async path => (await readFile(new URL(path, root), 'utf8')).replace(/\r\n/g, '\n');
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const sliceFunction = (source, name) => {
    const start = source.indexOf(`function ${name}(`);
    assert.ok(start > 0, `funzione ${name} non trovata`);
    const end = source.indexOf('\n}\n', start);
    assert.ok(end > start, `fine di ${name} non trovata`);
    return source.slice(start, end + 3);
};

const usageModel = strip(await read('assets/js/modules/settings/account-field-usage-model.js'));
const usageService = strip(await read('assets/js/modules/settings/account-field-usage-service.js'));
const settingsSource = await read('assets/js/modules/settings/impostazioni.js');
const profileSource = await read('assets/js/modules/privato/profilo_privato.js');
const backupService = await read('assets/js/modules/settings/backup-export-service.js');

// ── 1. Report uso dei campi: solo memoria, nessuna superficie di file ───────

function usageFixture({online = true, confirmed, cached, failConfirmed = false} = {}) {
    const calls = [];
    const context = vm.createContext({
        navigator: {onLine: online}, console: {warn() {}}, Date, setTimeout, clearTimeout,
        decrypt: async value => String(value).replace(/^enc:/, ''),
        isEncryptedValue: value => typeof value === 'string' && value.startsWith('enc:'),
        normalizeBankingAccounts: account => account.banking || [],
        ensureVaultKeyMaterial: async () => 'synthetic-key',
        listPrivateAccounts: async () => { calls.push('cached.private'); return cached.privateAccounts || []; },
        listPrivateAccountsConfirmed: async () => {
            calls.push('confirmed.private');
            if (failConfirmed) throw new Error('BACKEND_UNAVAILABLE');
            return confirmed.privateAccounts || [];
        },
        listCompanies: async () => { calls.push('cached.companies'); return cached.companies || []; },
        listCompaniesConfirmed: async () => {
            calls.push('confirmed.companies');
            if (failConfirmed) throw new Error('BACKEND_UNAVAILABLE');
            return confirmed.companies || [];
        },
        listCompanyAccounts: async (_uid, id) => cached.companyAccounts?.[id] || [],
        listCompanyAccountsConfirmed: async (_uid, id) => {
            calls.push(`confirmed.company.${id}`);
            if (failConfirmed) throw new Error('BACKEND_UNAVAILABLE');
            return confirmed.companyAccounts?.[id] || [];
        },
        listAccountWidgets: async () => cached.widgets || [],
        listAccountWidgetsConfirmed: async () => {
            calls.push('confirmed.widgets');
            if (failConfirmed) throw new Error('BACKEND_UNAVAILABLE');
            return confirmed.widgets || [];
        }
    });
    vm.runInContext(`${usageModel}\n${usageService}\nglobalThis.inspectAccountFieldUsage = inspectAccountFieldUsage;`, context);
    return {context, calls, inspect: () => context.inspectAccountFieldUsage('owner')};
}

const account = (id, extra = {}) => ({id, nomeAccount: `Sintetico ${id}`, _encrypted: false,
    username: `user-${id}`, password: `enc:secret-${id}`, ...extra});
const fieldRow = (report, needle) => report.fields.find(row => row.label.toLowerCase().includes(needle));

test('T-24: il report uso dei campi è solo in memoria e rigenerato dai dati correnti', async () => {
    // Nessuna superficie di file né di archivio locale nei due moduli del report.
    for (const [name, source] of [['model', usageModel], ['service', usageService]]) {
        for (const needle of ['Blob', 'createObjectURL', 'showSaveFilePicker', 'localStorage', 'sessionStorage',
            '.download', 'xlsx']) {
            assert.equal(source.includes(needle), false, `${name}: il report non deve usare ${needle}`);
        }
    }
    const f = usageFixture({
        confirmed: {privateAccounts: [account('a1'), account('archived', {isArchived: true})], companies: []},
        cached: {}
    });
    const report = await f.inspect();
    assert.equal(report.totals.accounts, 1, 'un solo Account attivo nel report');
    assert.equal(report.totals.archivedExcluded, 1, 'l’Account archiviato è contato e escluso');
    assert.equal(report.totals.privateAccounts, 1);
    assert.equal(fieldRow(report, 'password').used, 1, 'il campo password è contato una volta');
    assert.ok(f.calls.some(call => call === 'confirmed.private'), 'online si legge la sorgente confermata');
    assert.equal(JSON.stringify(report).includes('segret'), false, 'il report non contiene i valori dei campi');
});

test('T-24: con la cache locale il report può ancora includere un Account purgato', async () => {
    // Offline: la lettura passa dalla cache locale, che può ancora contenere il
    // documento di un Account già eliminato sul server.
    const purged = account('purgato');
    const offline = usageFixture({online: false,
        confirmed: {privateAccounts: [], companies: []},
        cached: {privateAccounts: [account('attivo'), purged], companies: []}});
    const report = await offline.inspect();
    assert.equal(report.totals.accounts, 2, 'offline la cache locale alimenta ancora il report');
    assert.equal(fieldRow(report, 'password').used, 2);
    assert.ok(offline.calls.includes('cached.private'));

    // Online ma sorgente confermata non disponibile: si ripiega sulla cache.
    const fallback = usageFixture({online: true, failConfirmed: true,
        confirmed: {privateAccounts: [account('attivo')], companies: []},
        cached: {privateAccounts: [account('attivo'), purged], companies: []}});
    const fallbackReport = await fallback.inspect();
    assert.equal(fallbackReport.totals.accounts, 2,
        'con la sorgente confermata non disponibile il report torna ai dati di cache');
    // Con la sorgente confermata disponibile, invece, il purgato non c'è più.
    const online = usageFixture({online: true,
        confirmed: {privateAccounts: [account('attivo')], companies: []},
        cached: {privateAccounts: [account('attivo'), purged], companies: []}});
    assert.equal((await online.inspect()).totals.accounts, 1,
        'online il report rigenerato non contiene l’Account purgato');
});

// ── 2. Report salute credenziali: solo memoria, senza segreti, azzerato ─────

test('T-24: il report salute credenziali resta in memoria, senza segreti e azzerato alla chiusura', async () => {
    const source = sliceFunction(settingsSource, 'showCredentialHealthResults');
    assert.equal(source.includes('Blob'), false, 'il report non costruisce file');
    const created = [], ownCleanups = [];
    const node = (tag, props = {}, children = []) => ({
        tag, props, children: children || [], classList: {add() {}, remove() {}}, style: {},
        appendChild(child) { this.children.push(child); },
        replaceChildren() { this.children = []; }, remove() { this.removed = true; },
        addEventListener() {}, removeEventListener() {}, focus() {}
    });
    const createElement = (tag, props = {}, children = []) => {
        const element = node(tag, props, children);
        created.push(element);
        return element;
    };
    const context = vm.createContext({createElement, document: {activeElement: null, body: node('body')},
        setTimeout: () => 1, clearTimeout() {}, console});
    vm.runInContext(`${source}\nglobalThis.showCredentialHealthResults = showCredentialHealthResults;`, context);
    const secret = 'SYNTHETIC-PASSWORD-NOT-RENDERED';
    const report = {scanned: 2, atRisk: 1, unavailable: 0, results: [
        {title: 'Account sintetico', area: 'privato', strength: 'weak', flags: ['weak'], password: secret}
    ]};
    const action = {check() {}, active: () => true, dispose() {}, own: cleanup => ownCleanups.push(cleanup)};
    context.showCredentialHealthResults(report, action);
    const texts = JSON.stringify(created.map(element => element.props?.textContent ?? ''));
    assert.equal(texts.includes(secret), false, 'il segreto sintetico non compare nella copia di consultazione');
    assert.ok(texts.includes('Account sintetico'), 'il report mostra l’identità dell’Account');
    // Alla chiusura i risultati in memoria vengono azzerati.
    for (const cleanup of ownCleanups) cleanup();
    assert.equal(report.results.length, 0, 'chiudendo il modale i risultati vengono azzerati');
});

// ── 3. Copie file: vCard e backup escono dal controllo dell'app ─────────────

test('T-24: la vCard è un file dell’utente, creato una volta e non ritirabile', async () => {
    const source = sliceFunction(profileSource, 'downloadVCard');
    const downloads = [], revoked = [];
    const context = vm.createContext({
        Blob: class {constructor(chunks, options) { this.chunks = chunks; this.type = options?.type; }},
        URL: {createObjectURL: blob => { downloads.push(blob); return 'blob:synthetic'; },
            revokeObjectURL: value => revoked.push(value)},
        document: {createElement: tag => ({tag, click() { this.clicked = true; }})},
        getProfileVCard: () => 'BEGIN:VCARD\nFN:Sintetico\nEND:VCARD',
        setTimeout: callback => { callback(); return 1; }
    });
    vm.runInContext(`${source}\nglobalThis.downloadVCard = downloadVCard;`, context);
    context.downloadVCard();
    assert.equal(downloads.length, 1, 'viene creato un oggetto da scaricare');
    assert.equal(downloads[0].type, 'text/vcard;charset=utf-8');
    assert.deepEqual(revoked, ['blob:synthetic'], 'viene revocato solo l’Object URL, non il file scaricato');
    assert.equal(source.includes('showSaveFilePicker'), false, 'nessun handle del file resta all’app');
});

test('T-24: l’export del backup richiede la rete, non filtra gli archiviati e finisce in un file dell’utente', async () => {
    assert.match(backupService, /if \(!navigator\.onLine\) throw new Error\('BACKUP_REQUIRES_ONLINE'\)/,
        'il backup legge sorgenti confermate: serve la rete');
    const accountRecords = backupService.slice(backupService.indexOf('async function accountRecords'),
        backupService.indexOf('async function collectRecords'));
    assert.equal(/isArchived/.test(accountRecords), false,
        'la raccolta dei record non applica alcun filtro sugli Account archiviati');
    assert.match(backupService, /window\.showSaveFilePicker\(/, 'il file viene scelto dall’utente');
    assert.match(backupService, /link\.download = fileName/, 'in alternativa viene scaricato');
    // Nessun percorso dell'app cancella o invalida un file già esportato.
    assert.equal(/showSaveFilePicker[\s\S]{0,200}remove/.test(backupService), false);
});

// ── 4. Indicatori di export nel checkout locale: non è una prova di produzione ──

test('T-24: indicatori storici XLSX/stampa assenti nei moduli locali e proiezione Excel non montata', async () => {
    const files = [];
    const walk = async directory => {
        for (const entry of await readdir(directory, {withFileTypes: true})) {
            const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
            if (entry.isDirectory()) { if (entry.name !== 'vendor') await walk(url); }
            else if (entry.name.endsWith('.js')) files.push({path: url.pathname.split('/public/')[1], text: await readFile(url, 'utf8')});
        }
    };
    await walk(root);
    for (const needle of ['xlsx', 'SheetJS', 'jspdf', 'window.print', 'html2pdf']) {
        const hits = files.filter(file => file.text.includes(needle)).map(file => file.path);
        assert.deepEqual(hits, [], `${needle}: indicatore assente nel checkout esaminato, non verifica remota`);
    }
    // Questo controllo non esclude altre librerie PDF, altri rami o release distribuite.
    const projection = await readFile(new URL('../experiments/persistent-vault-shell/excel-export-projection.mjs', import.meta.url), 'utf8');
    assert.match(projection, /Experimental adaptation/i, 'il file di laboratorio dichiara la propria natura');
    assert.match(projection, /EXCEL_MASK/, 'la proiezione maschera i valori sensibili');
    const mounted = files.filter(file => file.text.includes('excel-export-projection'));
    assert.deepEqual(mounted, [], 'nessun modulo locale esaminato importa la proiezione Excel');
});
