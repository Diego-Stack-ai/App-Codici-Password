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

function fixture({privateAccounts = [], companies = [], companyAccounts = {}, holdPrivate = null} = {}) {
    const observers = new Set();
    const listeners = new Map();
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
        listArchivedPrivateAccounts: async () => {
            if (holdPrivate) await holdPrivate;
            return privateAccounts;
        },
        listCompanies: async () => companies,
        listCompanyAccounts: async (_uid, companyId) => companyAccounts[companyId] || [],
        getCompany: async (_uid, companyId) => companies.find(company => company.id === companyId) || null
    });
    vm.runInContext(archiveModel, context);
    vm.runInContext(service, context);
    return {context, auth,
        changeUid: uid => { auth.currentUser = uid ? {uid} : null; for (const callback of [...observers]) callback(auth.currentUser); },
        lock: () => listeners.get('vault-session-locked')?.()};
}

const allFixture = () => fixture({
    privateAccounts: [account('p1', 'privato')],
    companies: [{id: 'company-1', ragioneSociale: 'Azienda Sintetica'}],
    companyAccounts: {'company-1': [account('c1', 'company-1'), account('c2', 'company-1', false)]}
});

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
    const f = fixture({privateAccounts: [account('p1', 'privato')], holdPrivate: gate.promise});
    const pending = f.context.loadArchivedAccounts('A', 'privato');
    f.changeUid('B');
    gate.resolve();
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/,
        'la lista letta per la sessione precedente non deve essere consegnata');
});

test('T-30: blocco del Vault durante la lettura, nessuna lista consegnata', async () => {
    const gate = deferred();
    const f = fixture({privateAccounts: [account('p1', 'privato')], holdPrivate: gate.promise});
    const pending = f.context.loadArchivedAccounts('A', 'privato');
    f.lock();
    gate.resolve();
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
});

test('T-30: dopo il cambio di sessione la nuova lista ha l\'identità del nuovo proprietario', async () => {
    const f = allFixture();
    f.changeUid('B');
    const listed = await f.context.loadArchivedAccounts('B', 'all');
    assert.deepEqual([...listed].map(entry => `${entry.context}:${entry.id}`).sort(),
        ['company-1:c1', 'privato:p1'],
        'le voci restano quelle del proprietario corrente, con lo stesso contesto');
    const privato = listed.find(entry => entry.id === 'p1');
    assert.equal(privato.context, 'privato', 'il contesto non eredita lo stato della sessione precedente');
});
