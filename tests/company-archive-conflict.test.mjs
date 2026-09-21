import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Correzione M7-R6 (revisione Codex del 21/09/2026). Questo banco prova il
// percorso REALE del form aziendale: `deleteAccount` di
// `azienda/form-azienda-save.js` con l'`archiveAccount` reale di
// `settings/archive-account-service.js`. Il caso decisivo è: form aperto sulla
// revisione N, Account aggiornato a N+1 (o `updatedAt` cambiato) prima del clic
// → **zero scritture** e messaggio di aggiornamento.

const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const model = strip(await readFile(new URL('settings/archive-account-model.js', modules), 'utf8'));
const service = strip(await readFile(new URL('settings/archive-account-service.js', modules), 'utf8'));
// `deleteAccount` carica il servizio con import differito (il modulo statico
// sforerebbe il budget di pagina). Qui la sola riga di caricamento viene
// sostituita dal namespace del servizio reale già caricato in questo contesto:
// cambia il modo in cui il modulo arriva, non l'implementazione sotto esame.
// `globalThis.archiveAccount` evita la zona morta della `const` dichiarata
// dalla destrutturazione.
const formSave = strip(await readFile(new URL('azienda/form-azienda-save.js', modules), 'utf8'))
    .replace("await import('../settings/archive-account-service.js')", 'await Promise.resolve({archiveAccount: globalThis.archiveAccount})');

function fixture({revision = 4, updatedAt = '2026-01-01T00:00:00.000Z', isArchived = false, confirm = true} = {}) {
    const writes = [], toasts = [], errors = [], transactions = [];
    const stored = {isArchived, revision, updatedAt};
    const context = vm.createContext({
        auth: {currentUser: {uid: 'A'}}, db: {}, functions: {},
        doc: (_db, ...path) => path.join('/'),
        deleteField: () => ({delete: true}),
        onAuthStateChanged: () => () => {},
        runTransaction: async (_db, callback) => {
            transactions.push(1);
            const staged = [];
            await callback({
                get: async () => ({exists: () => true, data: () => ({...stored})}),
                update: (...args) => staged.push(args)
            });
            writes.push(...staged);
        },
        httpsCallable: () => async () => ({data: {status: 'purged'}}),
        decrypt: async value => value, ensureVaultKeyMaterial: async () => 'key',
        listArchivedPrivateAccounts: async () => [], listCompanies: async () => [],
        listCompanyAccounts: async () => [], getCompany: async () => null,
        showConfirmModal: async () => confirm,
        showToast: (...args) => toasts.push(args),
        t: value => value, logError: (...args) => errors.push(args),
        document: {getElementById: () => null, querySelector: () => null},
        window: {location: {href: '', pathname: '/form_account_azienda.html', search: ''}},
        history: {back() {}}, sessionStorage: {getItem: () => null}, URLSearchParams,
        setTimeout: () => 0
    });
    for (const source of [model, service, formSave]) vm.runInContext(source, context);
    return {context, writes, toasts, errors, transactions,
        close: () => context.deleteAccount({
            currentUid: 'A', currentAziendaId: 'c1', currentDocId: 'x',
            observedRevision: 4, observedUpdatedAt: '2026-01-01T00:00:00.000Z'
        })};
}

test('form aziendale: stato invariato archivia una sola volta', async () => {
    const f = fixture();
    await f.close();
    assert.equal(f.transactions.length, 1);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0][0], 'users/A/aziende/c1/accounts/x');
    assert.equal(f.writes[0][1].isArchived, true);
    assert.equal(f.writes[0][1].revision, 5);
    assert.deepEqual(f.toasts, [['success_moved_to_archive', 'success']]);
    assert.deepEqual(f.errors, []);
});

test('form aziendale: Account portato a N+1 dopo l\'apertura non viene sovrascritto', async () => {
    const f = fixture({revision: 5});
    await f.close();
    assert.equal(f.transactions.length, 1, 'il conflitto si decide nella transazione');
    assert.equal(f.writes.length, 0, 'zero scritture su una vista obsoleta');
    assert.deepEqual(f.toasts, [['archive_conflict_refresh', 'error']]);
});

test('form aziendale: updatedAt cambiato con revisione invariata non viene sovrascritto', async () => {
    const f = fixture({updatedAt: '2026-03-03T00:00:00.000Z'});
    await f.close();
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.toasts, [['archive_conflict_refresh', 'error']]);
});

test('form aziendale: senza marker osservato fallisce chiuso senza aprire la transazione', async () => {
    const f = fixture();
    await f.context.deleteAccount({currentUid: 'A', currentAziendaId: 'c1', currentDocId: 'x',
        observedRevision: undefined, observedUpdatedAt: ''});
    assert.equal(f.transactions.length, 0);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.toasts, [['archive_conflict_refresh', 'error']]);
});

test('form aziendale: conferma annullata non legge e non scrive', async () => {
    const f = fixture({confirm: false});
    await f.close();
    assert.equal(f.transactions.length, 0);
    assert.equal(f.writes.length, 0);
    assert.deepEqual(f.toasts, []);
});
