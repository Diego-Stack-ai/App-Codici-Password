import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Correzione M7-R6, secondo rilievo Codex (21/09/2026): il marker osservato è
// stato di modulo in `form_account_azienda.js`. Al rimontaggio sullo stesso
// modulo per un Account diverso, o se `loadData()` fallisce, `window.deleteAccount`
// poteva usare la revisione del documento precedente. Qui si monta la PAGINA
// reale (`initFormAccountAzienda`) con il salvataggio e il servizio reali, si
// rimonta su un altro Account e si prova che non si scrive nulla.

const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const model = strip(await readFile(new URL('settings/archive-account-model.js', modules), 'utf8'));
const service = strip(await readFile(new URL('settings/archive-account-service.js', modules), 'utf8'));
// Unica riga sostituita: il caricamento differito del servizio (budget di pagina).
const formSave = strip(await readFile(new URL('azienda/form-azienda-save.js', modules), 'utf8'))
    .replace("await import('../settings/archive-account-service.js')", 'await Promise.resolve({archiveAccount: globalThis.archiveAccount})');
const page = strip(await readFile(new URL('azienda/form_account_azienda.js', modules), 'utf8'));

// La pagina e il modulo di salvataggio dichiarano entrambi una `const get` di
// modulo: nello stesso contesto vm i `const` di primo livello collidono. Ogni
// modulo reale viene quindi eseguito nella propria funzione e pubblica solo i
// simboli che servono, come farebbe un vero modulo ESM.
const wrap = (source, names) => `(function(){\n${source}\nObject.assign(globalThis, {${names.join(', ')}});\n})();`;

const MARKER = '2026-01-01T00:00:00.000Z';
const documents = {
    'users/A/aziende/c1/accounts/acc-a': {isArchived: false, revision: 4, updatedAt: MARKER, nomeAccount: 'Synthetic A'},
    // Stessa revisione e stesso `updatedAt` del precedente: un marker rimasto
    // dal montaggio vecchio coinciderebbe e archivierebbe senza conflitto.
    'users/A/aziende/c1/accounts/acc-b': {isArchived: false, revision: 4, updatedAt: MARKER, nomeAccount: 'Synthetic B'}
};

function fixture() {
    const store = new Map(Object.entries(documents).map(([path, data]) => [path, {...data}]));
    const hidden = new Set(), writes = [], toasts = [], errors = [], transactions = [];
    const windowState = {location: {href: '', pathname: '/form_account_azienda.html', search: '?id=acc-a&aziendaId=c1'}};
    const context = vm.createContext({
        auth: {currentUser: {uid: 'A'}}, db: {}, functions: {},
        doc: (_db, ...path) => path.join('/'),
        deleteField: () => ({delete: true}),
        onAuthStateChanged: () => () => {},
        runTransaction: async (_db, callback) => {
            transactions.push(1);
            const staged = [];
            await callback({
                get: async reference => { const data = store.get(reference); return {exists: () => data !== undefined, data: () => ({...data})}; },
                update: (...args) => staged.push(args)
            });
            writes.push(...staged);
        },
        httpsCallable: () => async () => ({data: {status: 'purged'}}),
        decrypt: async value => value, decryptRequiredValue: async value => value, ensureVaultKeyMaterial: async () => 'key',
        listArchivedPrivateAccounts: async () => [], listCompanies: async () => [],
        listCompanyAccounts: async () => [], getCompany: async () => null,
        getCompanyAccount: async (uid, companyId, accountId) => {
            if (hidden.has(accountId)) throw new Error('READ_FAILED');
            const data = store.get(`users/${uid}/aziende/${companyId}/accounts/${accountId}`);
            return data ? {...data} : null;
        },
        getUserProfile: async () => null, listContacts: async () => [], loadCompanyProfileContact: async () => null,
        normalizeEditableBankingAccounts: () => [], hasRealBankingData: () => false, renderBankAccounts: () => {},
        findProfileAccountItem: () => null, prepareProfileEmailAccountValues: () => ({}),
        accountModeFromRecord: () => 'standard', accountModeFromFlags: () => 'standard', validateAccountMode: () => ({}),
        initAccountEmbeddedWidgets: async () => null, initAccountSharedCredentials: async () => {}, initNewAccountSharedCredentials: () => {},
        showConfirmModal: async () => true,
        showToast: (...args) => toasts.push(args), t: value => value, logError: (...args) => errors.push(args),
        createElement: (tag, props, children) => ({tag, ...props, children}), setChildren: () => {}, clearElement: () => {},
        document: {getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}},
        window: windowState, history: {back() {}}, sessionStorage: {getItem: () => null},
        URLSearchParams, console: {warn() {}, error() {}}, setTimeout: () => 0
    });
    for (const source of [
        wrap(model, ['createArchiveMetadata']),
        wrap(service, ['archiveAccount']),
        wrap(formSave, ['deleteAccount', 'saveAccount']),
        wrap(page, ['initFormAccountAzienda'])
    ]) vm.runInContext(source, context);
    return {store, hidden, writes, toasts, errors, transactions, windowState,
        mount: search => { windowState.location.search = search; return context.initFormAccountAzienda({uid: 'A'}); },
        archive: async () => { await context.window.deleteAccount(); }};
}

test('montaggio: il percorso felice archivia l\'Account mostrato', async () => {
    const f = fixture();
    await f.mount('?id=acc-a&aziendaId=c1');
    await f.archive();
    assert.equal(f.transactions.length, 1);
    assert.deepEqual(f.writes.map(write => write[0]), ['users/A/aziende/c1/accounts/acc-a']);
    assert.equal(f.writes[0][1].isArchived, true);
    assert.deepEqual(f.toasts, [['success_moved_to_archive', 'success']]);
});

test('rimontaggio: caricamento fallito non riusa il marker dell\'Account precedente', async () => {
    const f = fixture();
    await f.mount('?id=acc-a&aziendaId=c1');
    f.hidden.add('acc-b');
    await f.mount('?id=acc-b&aziendaId=c1');
    const writesBefore = f.writes.length, transactionsBefore = f.transactions.length;
    await f.archive();
    assert.equal(f.writes.length, writesBefore, 'zero scritture dopo un caricamento fallito');
    assert.equal(f.transactions.length, transactionsBefore, 'nessuna transazione sul documento non caricato');
    assert.deepEqual(f.toasts.at(-1), ['archive_conflict_refresh', 'error']);
});

test('rimontaggio: documento cambiato dopo il caricamento non viene sovrascritto', async () => {
    const f = fixture();
    await f.mount('?id=acc-a&aziendaId=c1');
    await f.mount('?id=acc-b&aziendaId=c1');
    // Modifica concorrente dopo che il secondo montaggio ha letto il documento.
    f.store.set('users/A/aziende/c1/accounts/acc-b',
        {isArchived: false, revision: 5, updatedAt: '2026-04-04T00:00:00.000Z', nomeAccount: 'Synthetic B'});
    const writesBefore = f.writes.length;
    await f.archive();
    assert.equal(f.writes.length, writesBefore);
    assert.deepEqual(f.toasts.at(-1), ['archive_conflict_refresh', 'error']);
});

test('rimontaggio: con marker coerenti archivia il nuovo Account', async () => {
    const f = fixture();
    await f.mount('?id=acc-a&aziendaId=c1');
    await f.mount('?id=acc-b&aziendaId=c1');
    const writesBefore = f.writes.length;
    await f.archive();
    assert.deepEqual(f.writes.slice(writesBefore).map(write => write[0]), ['users/A/aziende/c1/accounts/acc-b']);
    assert.deepEqual(f.toasts.at(-1), ['success_moved_to_archive', 'success']);
});
