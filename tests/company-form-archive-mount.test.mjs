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
const strip = text => text.replace(/^export \{[^}]*\} from ['"][^'"]*['"];\r?\n/gm, '')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const model = strip(await readFile(new URL('settings/archive-account-model.js', modules), 'utf8'));
const service = strip(await readFile(new URL('settings/archive-account-service.js', modules), 'utf8'));
// Unica riga sostituita: il caricamento differito del servizio (budget di pagina).
const formSave = strip(await readFile(new URL('azienda/form-azienda-save.js', modules), 'utf8'))
    .replace("await import('../settings/archive-account-service.js')",
        'await Promise.resolve({archiveAccount: globalThis.archiveAccount, archiveConfirmMessage: globalThis.archiveConfirmMessage})');
const page = strip(await readFile(new URL('azienda/form_account_azienda.js', modules), 'utf8'))
    .replaceAll("import('./form-azienda-save.js')", 'Promise.resolve({saveAccount: globalThis.saveAccount, deleteAccount: globalThis.deleteAccount})');
// M7-R7C-1: il servizio usa gli helper di ciclo/invito di `utils.js`, caricati nel
// contesto come modulo reale (stessa tecnica degli altri moduli del banco).
const utils = strip(await readFile(new URL('../utils.js', modules), 'utf8'));
const loadGuard = strip(await readFile(new URL('shared/credential-decrypt-guard.js', modules), 'utf8'));
const accountMode = strip(await readFile(new URL('shared/account-mode-model.js', modules), 'utf8'));

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
    const hidden = new Set(), pending = new Map(), writes = [], toasts = [], errors = [], transactions = [], confirmations = [];
    const windowState = Object.assign(new EventTarget(), {location: {href: '', pathname: '/form_account_azienda.html', search: '?id=acc-a&aziendaId=c1'}});
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
            if (pending.has(accountId)) return pending.get(accountId)();
            const data = store.get(`users/${uid}/aziende/${companyId}/accounts/${accountId}`);
            return data ? {...data} : null;
        },
        getUserProfile: async () => null, listContacts: async () => [], loadCompanyProfileContact: async () => null,
        normalizeEditableBankingAccounts: () => [], hasRealBankingData: () => false, renderBankAccounts: () => {},
        findProfileAccountItem: () => null, prepareProfileEmailAccountValues: () => ({}),
        accountModeFromRecord: () => 'standard', accountModeFromFlags: () => 'standard', validateAccountMode: () => ({}),
        initAccountEmbeddedWidgets: async () => null, initAccountSharedCredentials: async () => {}, initNewAccountSharedCredentials: () => {},
        showConfirmModal: async (title, message) => { confirmations.push({title, message}); return true; },
        showToast: (...args) => toasts.push(args), t: value => value, logError: (...args) => errors.push(args),
        createElement: (tag, props, children) => ({tag, ...props, children}), setChildren: () => {}, clearElement: () => {},
        document: {getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {}},
        window: windowState, history: {back() {}}, sessionStorage: {getItem: () => null},
        URLSearchParams, console: {warn() {}, error() {}}, setTimeout: () => 0
    });
    for (const source of [
        wrap(loadGuard, ['createAccountLoadContext', 'isAccountSaveAllowed', 'assertAccountSaveAllowed', 'DECRYPT_FAILURE_MESSAGE']),
        wrap(utils, ['sharingCycleOf', 'nextSharingCycle', 'inviteIdForGuest']),
        wrap(accountMode, ['accountModeFromFlags', 'accountModeFromRecord', 'filterRecipientContacts',
            'isOwnerRecipientEmail', 'normalizeRecipientEmail', 'preferenceForRecipient',
            'recipientPreferencesFromSharedWith', 'serializeRecipientPreferences', 'validateAccountMode']),
        wrap(model, ['createArchiveMetadata', 'archiveRecipients', 'archiveConfirmMessage']),
        wrap(service, ['archiveAccount']),
        wrap(formSave, ['deleteAccount', 'saveAccount']),
        wrap(page, ['initFormAccountAzienda'])
    ]) vm.runInContext(source, context);
    return {store, hidden, writes, toasts, errors, transactions, confirmations, windowState,
        mount: search => { windowState.location.search = search; return context.initFormAccountAzienda({uid: 'A'}); },
        archive: async () => { await context.window.deleteAccount(); },
        // Tiene sospeso il caricamento di un Account finché il test non lo libera:
        // serve a far sovrapporre due montaggi.
        hold: accountId => {
            let open;
            const gate = new Promise(resolve => { open = resolve; });
            pending.set(accountId, async () => {
                await gate;
                const data = store.get(`users/A/aziende/c1/accounts/${accountId}`);
                return data ? {...data} : null;
            });
            return () => { pending.delete(accountId); open(); };
        }};
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

// Terzo rilievo Codex (21/09/2026): i caricamenti possono SOVRAPPORSI, non solo
// susseguirsi. Con il montaggio A ancora in attesa e il montaggio B già avviato,
// il completamento tardivo di A non deve confermare né sostituire il marker del
// montaggio corrente.

test('caricamenti sovrapposti: il completamento tardivo di A non conferma il marker per B', async () => {
    const f = fixture();
    const releaseA = f.hold('acc-a');
    const mountA = f.mount('?id=acc-a&aziendaId=c1'); // sospeso su getCompanyAccount
    f.hidden.add('acc-b');
    await f.mount('?id=acc-b&aziendaId=c1'); // B parte e fallisce il caricamento
    releaseA();                              // A completa in ritardo
    await mountA;
    const writesBefore = f.writes.length, transactionsBefore = f.transactions.length;
    await f.archive();
    assert.equal(f.writes.length, writesBefore, 'zero scritture sul documento di B');
    assert.equal(f.transactions.length, transactionsBefore, 'nessuna transazione con il marker di A');
    assert.deepEqual(f.toasts.at(-1), ['archive_conflict_refresh', 'error']);
});

test('caricamenti sovrapposti: A in ritardo non sostituisce i marker del montaggio B', async () => {
    const f = fixture();
    const releaseA = f.hold('acc-a');
    const mountA = f.mount('?id=acc-a&aziendaId=c1');
    await f.mount('?id=acc-b&aziendaId=c1'); // B carica correttamente
    // A completa in ritardo con marker diversi da quelli di B.
    f.store.set('users/A/aziende/c1/accounts/acc-a',
        {isArchived: false, revision: 9, updatedAt: '2026-09-09T00:00:00.000Z', nomeAccount: 'Synthetic A'});
    releaseA();
    await mountA;
    const writesBefore = f.writes.length;
    await f.archive();
    const written = f.writes.slice(writesBefore);
    assert.deepEqual(written.map(write => write[0]), ['users/A/aziende/c1/accounts/acc-b']);
    assert.equal(written[0][1].revision, 5, 'la revisione usata deve essere quella di B');
    assert.deepEqual(f.toasts.at(-1), ['success_moved_to_archive', 'success']);
});

// M7-R7B4 — avviso destinatari nel percorso del form aziendale.

const shared = () => ({
    password: 'SYNTH-PASSWORD', note: 'SYNTH-NOTE',
    sharedWith: {
        first: {email: 'one@example.invalid', status: 'accepted'},
        second: {email: 'two@example.invalid', status: 'pending'},
        third: {email: 'rejected@example.invalid', status: 'rejected'}
    },
    sharedWithEmails: ['legacy@example.invalid', 'one@example.invalid'],
    recipientEmail: 'legacy@example.invalid'
});

test('popup aziendale: l\'avviso elenca i destinatari del documento caricato, senza segreti', async () => {
    const f = fixture();
    f.store.set('users/A/aziende/c1/accounts/acc-a',
        {isArchived: false, revision: 4, updatedAt: MARKER, nomeAccount: 'Synthetic A', ...shared()});
    await f.mount('?id=acc-a&aziendaId=c1');
    await f.archive();
    assert.equal(f.confirmations.length, 1);
    assert.equal(f.confirmations[0].title, 'confirm_archive_title');
    const message = f.confirmations[0].message;
    assert.match(message, /one@example\.invalid/);
    assert.match(message, /two@example\.invalid/);
    assert.match(message, /legacy@example\.invalid/);
    assert.equal(message.match(/one@example\.invalid/g).length, 1, 'le forme legacy non duplicano i destinatari');
    assert.match(message, /confirm_archive_suspend_msg/);
    assert.match(message, /confirm_archive_recipients_caveat/);
    assert.equal(message.includes('rejected@example.invalid'), false, 'chi ha rifiutato non ha accesso');
    assert.equal(message.includes('SYNTH-PASSWORD'), false);
    assert.equal(message.includes('SYNTH-NOTE'), false);
    assert.equal(f.writes.length, 1, 'la conferma produce una sola archiviazione');
});

test('popup aziendale: senza destinatari resta il testo base', async () => {
    const f = fixture();
    await f.mount('?id=acc-a&aziendaId=c1');
    await f.archive();
    assert.equal(f.confirmations[0].message, 'confirm_archive_msg');
    assert.equal(f.writes.length, 1);
});

test('popup aziendale: il conflitto dopo l\'apertura conserva l\'avviso e non scrive', async () => {
    const f = fixture();
    f.store.set('users/A/aziende/c1/accounts/acc-a',
        {isArchived: false, revision: 4, updatedAt: MARKER, nomeAccount: 'Synthetic A', ...shared()});
    await f.mount('?id=acc-a&aziendaId=c1');
    // Modifica concorrente dopo il caricamento del documento.
    f.store.set('users/A/aziende/c1/accounts/acc-a',
        {isArchived: false, revision: 5, updatedAt: '2026-05-05T00:00:00.000Z', nomeAccount: 'Synthetic A', ...shared()});
    await f.archive();
    assert.match(f.confirmations[0].message, /one@example\.invalid/, 'l\'avviso usa il documento mostrato all\'apertura');
    assert.equal(f.writes.length, 0, 'il conflitto non sovrascrive');
    assert.deepEqual(f.toasts.at(-1), ['archive_conflict_refresh', 'error']);
});
