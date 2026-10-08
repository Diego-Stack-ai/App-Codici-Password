import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const guardSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/credential-decrypt-guard.js', import.meta.url), 'utf8');
const {DECRYPT_FAILURE_MESSAGE, assertAccountSaveAllowed, createAccountLoadContext, isAccountSaveAllowed} = await import(`data:text/javascript;base64,${Buffer.from(guardSource).toString('base64')}`);
const strip = source => source.replace(/^import[\s\S]*?;\r?\n/gm, '').replaceAll('export async function', 'async function');
const PRIVATE_ARGS = {bankAccounts: [], invitedEmails: [], currentUid: 'owner', currentDocId: 'record', isEditing: true, baseRevision: 1, isActive: () => true};
const COMPANY_ARGS = {bankAccounts: [], invitedEmails: [], isExplicitMemo: false, currentUid: 'owner', currentDocId: 'record', currentAziendaId: 'azienda', isEditing: true, baseUpdatedAt: ''};
const ZERO = {encrypt: 0, key: 0, tx: 0, replaced: 0, enqueued: 0, handoffs: 0};
const readyContext = () => { const context = createAccountLoadContext({mode: 'edit'}); context.markLoaded(context.beginLoad()); return context; };
const at = (text, needle) => { const index = text.indexOf(needle); assert.ok(index >= 0, `manca nel sorgente: ${needle}`); return index; };
async function privateFixture({eligible = true} = {}) {
    const source = strip(await readFile(new URL('../Frontend/public/assets/js/modules/privato/form-privato-save.js', import.meta.url), 'utf8'))
        .replace("await import('../data/private-account-offline-pilot.js')", 'pilotFixture');
    const counts = {encrypt: 0, key: 0, tx: 0, replaced: 0, enqueued: 0, handoffs: 0};
    const messages = [], navigations = [];
    const button = {disabled: false, dataset: {}, setAttribute() {}};
    const nodes = {'btn-save-footer': button, 'account-name': {value: 'Fixture'}, 'account-username': {value: 'u'},
        'account-code': {value: 'a'}, 'account-password': {value: 'p'}, 'account-note': {value: 'n'}};
    const sandbox = {
        document: {getElementById: id => nodes[id], querySelector: () => null},
        auth: {currentUser: {uid: 'owner'}}, db: {}, LOG: () => {}, logError: () => {},
        showToast: message => messages.push(message), hasInvalidCardExpiry: () => false,
        ensureVaultKeyMaterial: async () => { counts.key += 1; return 'key'; },
        encrypt: async value => { counts.encrypt += 1; return value ? 'cipher' : ''; },
        accountModeFromFlags: () => 'account-private', validateAccountMode: () => ({}),
        recordFieldsFromAccountMode: () => ({type: 'account', visibility: 'private'}),
        classifyPrivateAccountOfflineWrite: () => ({eligible}),
        navigator: {onLine: true}, doc: () => ({id: 'record'}), collection: () => ({id: 'record'}),
        runTransaction: async () => { counts.tx += 1; throw Object.assign(new Error('STOP_AFTER_WRITE'), {code: 'STOP'}); },
        setTimeout: fn => fn(), t: key => key, console: {error() {}}, window: {location: {replace: url => navigations.push(url)}},
        pilotFixture: {
            replacePrivateAccountPilotOperation: async () => { counts.replaced += 1; return {status: 'offline'}; },
            enqueuePrivateAccountPilot: async () => { counts.enqueued += 1; return {status: 'offline'}; },
            storePrivateAccountHandoff: () => { counts.handoffs += 1; }
        },
        isAccountSaveAllowed, assertAccountSaveAllowed, DECRYPT_FAILURE_MESSAGE
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return {counts, messages, navigations, button, sandbox};
}
async function companyFixture() {
    const source = strip(await readFile(new URL('../Frontend/public/assets/js/modules/azienda/form-azienda-save.js', import.meta.url), 'utf8'));
    const counts = {encrypt: 0, key: 0, tx: 0};
    const messages = [];
    const button = {disabled: false, dataset: {}, setAttribute() {}};
    const nodes = {'save-btn-footer': button, 'account-name': {value: 'Fixture'}, 'account-username': {value: 'u'},
        'account-code': {value: 'a'}, 'account-password': {value: 'p'}, 'account-note': {value: 'n'}};
    const sandbox = {
        document: {getElementById: id => nodes[id], querySelector: () => null},
        auth: {currentUser: {uid: 'owner'}}, db: {}, LOG: () => {}, logError: () => {},
        showToast: message => messages.push(message), showConfirmModal: async () => true,
        hasInvalidCardExpiry: () => false,
        ensureVaultKeyMaterial: async () => { counts.key += 1; return 'key'; },
        encrypt: async value => { counts.encrypt += 1; return value ? 'cipher' : ''; },
        accountModeFromFlags: () => 'account-private', validateAccountMode: () => ({}),
        recordFieldsFromAccountMode: () => ({type: 'account', visibility: 'private'}), sharingCycleOf: () => 0,
        runTransaction: async () => { counts.tx += 1; throw Object.assign(new Error('STOP_AFTER_WRITE'), {code: 'STOP'}); },
        doc: () => ({id: 'record'}), collection: () => ({id: 'record'}), t: key => key, console: {error() {}},
        isAccountSaveAllowed, assertAccountSaveAllowed, DECRYPT_FAILURE_MESSAGE
    };
    vm.createContext(sandbox);
    vm.runInContext(source, sandbox);
    return {counts, messages, button, sandbox};
}
test('privato: pendente, fallito, invalidato e assente = zero scritture anche su click ripetuto', async () => {
    const pending = createAccountLoadContext({mode: 'edit'}); pending.beginLoad();
    const failed = createAccountLoadContext({mode: 'edit'}); failed.markFailed(failed.beginLoad(), 'ACCOUNT_DECRYPT_FAILED');
    const invalidated = readyContext(); invalidated.invalidate();
    for (const loadContext of [pending, failed, invalidated]) {
        const f = await privateFixture();
        for (let click = 0; click < 3; click += 1) await f.sandbox.savePrivateAccount({...PRIVATE_ARGS, loadContext});
        assert.deepEqual(f.counts, ZERO);
        assert.equal(f.messages.every(message => message === DECRYPT_FAILURE_MESSAGE), true);
        assert.deepEqual(f.navigations, []);
    }
    const missing = await privateFixture();
    await missing.sandbox.savePrivateAccount({...PRIVATE_ARGS});
    assert.deepEqual(missing.counts, ZERO);
});
test('privato: caricamento riuscito scrive, creazione scrive, sessione scaduta no', async () => {
    const ready = await privateFixture();
    await ready.sandbox.savePrivateAccount({...PRIVATE_ARGS, loadContext: readyContext()});
    assert.equal(ready.counts.enqueued, 1); assert.equal(ready.counts.replaced, 0); assert.equal(ready.counts.key, 1);
    const creation = await privateFixture();
    await creation.sandbox.savePrivateAccount({...PRIVATE_ARGS, currentDocId: null, isEditing: false, loadContext: createAccountLoadContext({mode: 'create'})});
    assert.ok(creation.counts.enqueued + creation.counts.replaced >= 1);
    const locked = await privateFixture();
    await locked.sandbox.savePrivateAccount({...PRIVATE_ARGS, loadContext: readyContext(), isActive: () => false});
    assert.deepEqual(locked.counts, ZERO);
    const transactional = await privateFixture({eligible: false});
    try { await transactional.sandbox.savePrivateAccount({...PRIVATE_ARGS, loadContext: readyContext()}); } catch {}
    assert.equal(transactional.counts.tx, 1);
});
test('azienda: pendente, fallito, invalidato e assente zero scritture; pronto raggiunge la transazione', async () => {
    const pending = createAccountLoadContext({mode: 'edit'}); pending.beginLoad();
    const failed = createAccountLoadContext({mode: 'edit'}); failed.markFailed(failed.beginLoad(), 'ACCOUNT_DECRYPT_FAILED');
    const invalidated = readyContext(); invalidated.invalidate();
    for (const loadContext of [pending, failed, invalidated]) {
        const f = await companyFixture();
        for (let click = 0; click < 2; click += 1) await f.sandbox.saveAccount({...COMPANY_ARGS, loadContext});
        assert.deepEqual(f.counts, {encrypt: 0, key: 0, tx: 0});
        assert.equal(f.messages.every(message => message === DECRYPT_FAILURE_MESSAGE), true);
    }
    const missing = await companyFixture();
    await missing.sandbox.saveAccount({...COMPANY_ARGS});
    assert.deepEqual(missing.counts, {encrypt: 0, key: 0, tx: 0});
    const ready = await companyFixture();
    try { await ready.sandbox.saveAccount({...COMPANY_ARGS, loadContext: readyContext()}); } catch {}
    assert.equal(ready.counts.tx, 1); assert.equal(ready.counts.key, 1);
});
test('struttura: guardia prima dei widget e assert prima delle scritture', async () => {
    const privatoForm = await readFile(new URL('../Frontend/public/assets/js/modules/privato/form_account_privato.js', import.meta.url), 'utf8');
    const aziendaForm = await readFile(new URL('../Frontend/public/assets/js/modules/azienda/form_account_azienda.js', import.meta.url), 'utf8');
    const privatoSave = await readFile(new URL('../Frontend/public/assets/js/modules/privato/form-privato-save.js', import.meta.url), 'utf8');
    const aziendaSave = await readFile(new URL('../Frontend/public/assets/js/modules/azienda/form-azienda-save.js', import.meta.url), 'utf8');
    for (const [form, saveCall] of [[privatoForm, 'await savePrivateAccount({'], [aziendaForm, 'await saveAccount({']]) {
        assert.ok(at(form, 'isAccountSaveAllowed(saveContext)') < at(form, 'accountWidgetController?.savePendingChanges()'));
        assert.ok(at(form, 'accountWidgetController?.savePendingChanges()') < at(form, saveCall));
        assert.ok(at(form, 'const context = loadContext;') > 0);
        assert.ok(at(form, 'if (live()) context.markLoaded(loadToken)') > at(form, 'needsDecryption'));
        assert.ok(at(form, "context?.markFailed(loadToken, 'ACCOUNT_LOAD_FAILED')") > 0);
    }
    assert.ok(at(privatoSave, 'assertAccountSaveAllowed(loadContext)') < at(privatoSave, 'await submit({'));
    assert.ok(at(privatoSave, 'assertAccountSaveAllowed(loadContext)') < at(privatoSave, 'await runTransaction(db'));
    assert.ok(at(aziendaSave, 'assertAccountSaveAllowed(loadContext)') < at(aziendaSave, 'await runTransaction(db'));
});
