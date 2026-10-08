import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// M7-T30 — Lista dell'Archivio: il gate chiede che compaiano **solo** i record
// archiviati e che l'**identità di contesto** (privato/azienda) resti corretta
// anche dopo cambi di sessione.
//
// Il banco prova due cose separate, perché nel codice i due filtri vivono in
// posti diversi:
//   1. la query del repository per l'Archivio privato porta il filtro
//      `isArchived == true` (la lista privata si fida della query);
//   2. il servizio scarta i record non archiviati della sorgente aziendale
//      (filtro client-side) e attribuisce a ogni voce il contesto corretto;
//      una lettura interrotta da un cambio di sessione non consegna la lista.
const settings = new URL('../Frontend/public/assets/js/modules/settings/', import.meta.url);
const data = new URL('../Frontend/public/assets/js/modules/data/', import.meta.url);
const strip = text => text.replace(/^export \{[^}]*\} from ['"][^'"]*['"];\r?\n/gm, '')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

const service = strip(await readFile(new URL('archive-account-service.js', settings), 'utf8'));
const archiveModel = strip(await readFile(new URL('archive-account-model.js', settings), 'utf8'));
const repository = strip(await readFile(new URL('vault-repository.js', data), 'utf8'));

const account = (id, context, isArchived = true) => ({id, context, isArchived, revision: 1, nomeAccount: 'Sintetico'});
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };

// ── 1. Il filtro dell'Archivio privato vive nella query ─────────────────────

test('T-30: la query dell\'Archivio privato filtra i soli archiviati', async () => {
    const captured = [];
    const context = vm.createContext({
        db: {__db: true},
        collection: (_db, ...path) => ({__collection: path.join('/')}),
        where: (field, operator, value) => ({__where: [field, operator, value]}),
        query: (...parts) => ({__query: parts}),
        doc: (_db, ...path) => ({__doc: path.join('/')}),
        limit: value => ({__limit: value}),
        orderBy: (...args) => ({__orderBy: args}),
        coalesceRead: (_key, run) => run(),
        getDocsSmart: async reference => { captured.push(reference); return {docs: []}; },
        getDocSmart: async () => ({exists: () => false}),
        getDocsServerConfirmed: async () => ({docs: []}),
        getDocServerConfirmed: async () => ({exists: () => false}),
        console: {warn() {}}
    });
    // `strip` toglie `export`: le costanti restano legami lessicali, quindi il
    // banco le espone esplicitamente invece di cercarle sul contesto.
    vm.runInContext(`${repository}\nglobalThis.__repository = {listArchivedPrivateAccounts};`, context);
    assert.deepEqual([...await context.__repository.listArchivedPrivateAccounts('A')], []);
    assert.equal(captured.length, 1, 'una sola lettura per l\'Archivio privato');
    const reference = captured[0];
    assert.equal(reference.__query[0].__collection, 'users/A/accounts', 'percorso del proprietario');
    const filter = reference.__query.find(part => part.__where);
    assert.deepEqual(filter.__where, ['isArchived', '==', true],
        'senza questo filtro la lista mostrerebbe anche gli Account attivi');
});

// ── 2. Filtro aziendale, identità di contesto e cambi di sessione ───────────

// Le sorgenti sono **sensibili al proprietario**: ogni lettura riceve l'uid e
// restituisce solo i documenti di quell'uid, e l'uid ricevuto viene registrato
// in `reads`. È il punto che rende la prova del cambio di sessione significativa:
// con sorgenti che restituiscono gli stessi documenti a chiunque, un servizio
// che continuasse a leggere i dati del vecchio proprietario passerebbe il banco.
function fixture({privateAccounts = {}, companies = {}, companyAccounts = {}, holdPrivate = null} = {}) {
    const observers = new Set();
    const listeners = new Map();
    const reads = [];
    const auth = {currentUser: {uid: 'A'}};
    const context = vm.createContext({
        auth, db: {}, functions: {}, deleteField: () => ({delete: true}),
        doc: (_db, ...path) => path.join('/'),
        httpsCallable: () => async () => ({data: {}}),
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        addEventListener: (type, callback) => listeners.set(type, callback),
        removeEventListener: type => listeners.delete(type),
        runTransaction: async () => { throw new Error('non usata dalla lista'); },
        decrypt: async value => value, ensureVaultKeyMaterial: async () => 'key',
        console: {warn() {}},
        listArchivedPrivateAccounts: async uid => {
            reads.push(['listArchivedPrivateAccounts', uid]);
            if (holdPrivate) await holdPrivate;
            // La sorgente privata consegna già i soli archiviati: il filtro lì è
            // nella query del repository (provato al caso 1 su `vault-repository.js`).
            // Le sorgenti aziendali invece consegnano tutto, perché lì il filtro è
            // client-side dentro il servizio: la differenza è voluta.
            return (privateAccounts[uid] || []).filter(entry => entry.isArchived === true);
        },
        listCompanies: async uid => {
            reads.push(['listCompanies', uid]);
            return companies[uid] || [];
        },
        listCompanyAccounts: async (uid, companyId) => {
            reads.push(['listCompanyAccounts', uid, companyId]);
            return companyAccounts[`${uid}/${companyId}`] || [];
        },
        getCompany: async (uid, companyId) =>
            (companies[uid] || []).find(company => company.id === companyId) || null
    });
    vm.runInContext(archiveModel, context);
    vm.runInContext(service, context);
    return {context, auth, reads,
        changeUid: uid => { auth.currentUser = uid ? {uid} : null; for (const callback of [...observers]) callback(auth.currentUser); },
        lock: () => listeners.get('vault-session-locked')?.()};
}

const allFixture = () => fixture({
    privateAccounts: {A: [account('p1', 'privato')]},
    companies: {A: [{id: 'company-1', ragioneSociale: 'Azienda Sintetica'}]},
    companyAccounts: {'A/company-1': [account('c1', 'company-1'), account('c2', 'company-1', false)]}
});

for (const source of ['listArchivedPrivateAccounts', 'listCompanies', 'listCompanyAccounts']) {
    test(`Archivio: errore ${source} non diventa elenco completo parziale`, async () => {
        const f = allFixture();
        f.context[source] = async () => { throw new Error('SYNTHETIC_READ_FAILURE'); };
        await assert.rejects(f.context.loadArchivedAccounts('A', 'all'), /ARCHIVE_SOURCE_UNAVAILABLE/);
    });
}

test('T-30: nella lista compaiono solo gli archiviati, con il contesto corretto', async () => {
    const f = allFixture();
    const listed = await f.context.loadArchivedAccounts('A', 'all');
    assert.deepEqual([...listed].map(entry => `${entry.context}:${entry.id}`).sort(),
        ['company-1:c1', 'privato:p1'],
        'la voce aziendale non archiviata è esclusa dal filtro client-side');
    const privato = listed.find(entry => entry.id === 'p1');
    assert.equal(privato.context, 'privato');
    assert.equal('businessName' in privato, false, 'il profilo privato non ha ragione sociale');
    const aziendale = listed.find(entry => entry.id === 'c1');
    assert.equal(aziendale.context, 'company-1', 'il contesto è l\'id azienda, non "privato"');
    assert.equal(aziendale.businessName, 'Azienda Sintetica');
});

test('T-30: le letture per contesto non mescolano privato e aziende', async () => {
    const f = allFixture();
    const onlyPrivate = await f.context.loadArchivedAccounts('A', 'privato');
    assert.deepEqual([...onlyPrivate].map(entry => `${entry.context}:${entry.id}`), ['privato:p1']);
    const onlyCompany = await f.context.loadArchivedAccounts('A', 'company-1');
    assert.deepEqual([...onlyCompany].map(entry => `${entry.context}:${entry.id}`), ['company-1:c1']);
    const otherCompany = await f.context.loadArchivedAccounts('A', 'company-2');
    assert.deepEqual([...otherCompany], [], 'un contesto senza archiviati non mostra voci di altri contesti');
    assert.deepEqual([...await f.context.listArchiveContexts('A')].map(company => company.id), ['company-1']);
});

test('T-30: cambio di utente durante la lettura, nessuna lista dalla sessione precedente', async () => {
    const gate = deferred();
    const f = fixture({privateAccounts: {A: [account('p1', 'privato')]}, holdPrivate: gate.promise});
    const pending = f.context.loadArchivedAccounts('A', 'privato');
    f.changeUid('B');
    gate.resolve();
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/,
        'la lista letta per la sessione precedente non deve essere consegnata');
});

test('T-30: blocco del Vault durante la lettura, nessuna lista consegnata', async () => {
    const gate = deferred();
    const f = fixture({privateAccounts: {A: [account('p1', 'privato')]}, holdPrivate: gate.promise});
    const pending = f.context.loadArchivedAccounts('A', 'privato');
    f.lock();
    gate.resolve();
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
});

test('T-30: dopo il cambio di sessione la nuova lista ha l\'identità del nuovo proprietario', async () => {
    const f = fixture({
        privateAccounts: {
            A: [account('p1', 'privato')],
            B: [account('pb', 'privato'), account('pb-attivo', 'privato', false)]
        },
        companies: {
            A: [{id: 'company-1', ragioneSociale: 'Azienda Sintetica'}],
            B: [{id: 'company-b', ragioneSociale: 'Azienda Nuova'}]
        },
        companyAccounts: {
            'A/company-1': [account('c1', 'company-1')],
            'B/company-b': [account('cb', 'company-b'), account('cb-attivo', 'company-b', false)]
        }
    });
    // Controllo della fixture stessa: la sessione A vede i documenti di A. Se le
    // sorgenti fossero insensibili all'uid, questo confronto non discriminerebbe
    // nulla e il banco successivo non proverebbe il cambio di proprietario.
    assert.deepEqual([...await f.context.loadArchivedAccounts('A', 'all')].map(entry => `${entry.context}:${entry.id}`).sort(),
        ['company-1:c1', 'privato:p1'], 'la fixture risponde per proprietario');
    f.changeUid('B');
    const firstReadOfB = f.reads.length;
    const listed = await f.context.loadArchivedAccounts('B', 'all');
    assert.deepEqual([...listed].map(entry => `${entry.context}:${entry.id}`).sort(),
        ['company-b:cb', 'privato:pb'],
        'la nuova lista contiene solo i documenti del nuovo proprietario');
    assert.equal(listed.some(entry => ['p1', 'c1'].includes(entry.id)), false,
        'nessuna voce della sessione precedente sopravvive al cambio di utente');
    // Le letture della nuova sessione devono essere state fatte *per* B: un
    // servizio che riusasse l\'uid di A verrebbe smascherato qui.
    assert.deepEqual([...new Set(f.reads.slice(firstReadOfB).map(read => read[1]))], ['B'],
        'ogni lettura della nuova sessione è stata richiesta per il nuovo proprietario');
    assert.deepEqual(f.reads.slice(firstReadOfB).filter(read => read[0] === 'listCompanyAccounts').map(read => read.slice(1)),
        [['B', 'company-b']], 'la sottocollezione letta è quella del proprietario corrente');
    const privato = listed.find(entry => entry.id === 'pb');
    assert.equal(privato.context, 'privato', 'il contesto non eredita lo stato della sessione precedente');
    assert.equal('businessName' in privato, false, 'il profilo privato del nuovo proprietario resta senza ragione sociale');
    const aziendale = listed.find(entry => entry.id === 'cb');
    assert.equal(aziendale.context, 'company-b');
    assert.equal(aziendale.businessName, 'Azienda Nuova');
    // Anche le letture per contesto della nuova sessione restano quelle di B.
    assert.deepEqual([...await f.context.loadArchivedAccounts('B', 'company-b')].map(entry => `${entry.context}:${entry.id}`),
        ['company-b:cb'], 'la lettura per azienda non pesca dati della sessione precedente');
    assert.deepEqual([...await f.context.listArchiveContexts('B')].map(company => company.id), ['company-b']);
});
