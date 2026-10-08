import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

async function fixture(form) {
    const path = form ? 'ma_save.js' : 'lista_aziende.js';
    const source = await readFile(new URL(`../Frontend/public/assets/js/modules/azienda/${path}`, import.meta.url), 'utf8');
    const name = form ? 'deleteAzienda' : 'deleteAziendaList';
    const start = source.indexOf(`async function ${name}(`);
    const end = source.indexOf('\n}', start) + 2;
    assert.ok(start >= 0 && end > start);
    let confirm; const calls = [], messages = [], redirects = [];
    const sandbox = {state: {currentUid: 'owner', currentAziendaId: 'company'}, currentUser: {uid: 'owner'},
        allAziende: [{id: 'company'}], t: key => key, showConfirmModal: () => new Promise(resolve => {confirm = resolve;}),
        deleteCompany: async (...args) => {calls.push(args); throw Object.assign(Error('blocked'), {code: 'COMPANY_NOT_EMPTY'});},
        showToast: (...args) => messages.push(args), companyDeletionMessage: error => error.code,
        logError() {}, renderAziende() {throw Error('UNEXPECTED_RENDER');},
        setTimeout: callback => callback(), window: {location: {set href(value) {redirects.push(value);}}}};
    vm.createContext(sandbox); vm.runInContext(source.slice(start, end), sandbox);
    return {sandbox, calls, messages, redirects, confirm: value => confirm(value), run: () => sandbox[name]('company', 'Synthetic')};
}
for (const form of [true, false]) {
    test(`${form ? 'form' : 'list'}: identity change during confirmation prevents service invocation`, async () => {
        const f = await fixture(form), pending = f.run();
        if (form) f.sandbox.state.currentUid = 'other'; else f.sandbox.currentUser = {uid: 'other'};
        f.confirm(true); await pending;
        assert.equal(f.calls.length, 0); assert.equal(f.redirects.length, 0);
        assert.equal(f.messages[0][0], 'COMPANY_DELETE_SESSION_CHANGED');
    });
    test(`${form ? 'form' : 'list'}: refusal preserves UI records and never reports success`, async () => {
        const f = await fixture(form), pending = f.run(); f.confirm(true); await pending;
        assert.deepEqual(f.calls, [['owner', 'company']]);
        assert.equal(f.messages[0][0], 'COMPANY_NOT_EMPTY');
        assert.equal(f.messages.some(([, kind]) => kind === 'success'), false);
        assert.equal(f.sandbox.allAziende.length, 1); assert.equal(f.redirects.length, 0);
    });
    test(`${form ? 'form' : 'list'}: cancelled confirmation makes no service call`, async () => {
        const f = await fixture(form), pending = f.run(); f.confirm(false); await pending;
        assert.equal(f.calls.length, 0); assert.equal(f.messages.length, 0);
    });
}
test('form: changing company during confirmation cannot target the new company', async () => {
    const f = await fixture(true), pending = f.run(); f.sandbox.state.currentAziendaId = 'other';
    f.confirm(true); await pending; assert.equal(f.calls.length, 0);
});
