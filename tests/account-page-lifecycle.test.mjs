import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const user = {uid: 'fixture-user', email: 'fixture@example.invalid'};
const records = () => [{id: 'b', nomeAccount: 'Beta'}, {id: 'a', nomeAccount: 'Alfa'}];
async function fixture(company, overrides = {}) {
    const elements = Object.fromEntries(['account-search', 'sort-btn', 'sort-label', 'accounts-container'].map(id => {
        const node = new EventTarget(); node.value = ''; return [id, node];
    }));
    const views = [], writes = [], toasts = [], navigations = [];
    const window = {location: {search: company ? '?id=company-fixture' : '', pathname: '/fixture.html'}, history: {replaceState() {}}};
    const context = vm.createContext({
        window, document: {getElementById: id => elements[id]}, URLSearchParams, AbortController, DOMException,
        navigator: {onLine: true}, console, db: {}, LOG() {}, logError() {}, t: value => value,
        clearElement: node => { node.children = []; }, setChildren: (node, children) => { node.children = children; },
        createElement: (tag, props, children) => ({tag, props, children}),
        createAccountListView: options => {
            const view = {options, renders: [], destroyed: 0, render(rows) { this.renders.push(rows); }, destroy() { this.destroyed++; }};
            views.push(view); return view;
        },
        accountModeFromRecord: row => row.mode || 'account-private', createArchiveMetadata: () => ({isArchived: true}),
        listPrivateAccounts: async () => records(), listPrivateAccountsConfirmed: async () => records(),
        listAcceptedInvites: async () => [], getRecordByPath: async () => null,
        listCompanyAccounts: async () => records(), ensureVaultKeyMaterial: async () => null,
        decrypt: async () => 'decrypted-fixture', getUserProfile: async () => ({contactEmails: []}),
        showConfirmModal: async () => true, showToast: (...args) => toasts.push(args),
        doc: (...parts) => parts.slice(1).join('/'),
        updateDoc: async (...args) => { writes.push(args); }, deleteDoc: async (...args) => { writes.push(args); },
        writeBatch: () => ({delete: (...args) => writes.push(args), update: (...args) => writes.push(args), commit: async () => {}}),
        ...overrides
    });
    const name = company ? 'azienda/account_azienda' : 'privato/account_privati';
    const source = await readFile(new URL(`../Frontend/public/assets/js/modules/${name}.js`, import.meta.url), 'utf8');
    vm.runInContext(source.replace(/^import[\s\S]*?;\r?$/gm, '').replace(/^export /gm, ''), context);
    const mountName = company ? 'mountAccountAziendaList' : 'mountAccountPrivati';
    const initName = company ? 'initAccountAziendaList' : 'initAccountPrivati';
    return {elements, views, writes, toasts, navigations,
        mount: options => context[mountName](user, {navigate: url => navigations.push(url), ...options}),
        init: () => context[initName](user),
    };
}

for (const company of [false, true]) {
    const label = company ? 'company' : 'private';
    test(`${label}: search, sort and remount keep exactly one listener and reset ordering`, async () => {
        const f = await fixture(company);
        await f.init();
        const last = () => f.views.at(-1).renders.at(-1).map(row => row.id).join(',');
        assert.equal(last(), 'a,b');
        f.elements['sort-btn'].dispatchEvent(new Event('click'));
        assert.equal(last(), 'b,a');
        const dispose = await f.init();
        assert.equal(last(), 'a,b');
        assert.equal(f.elements['sort-label'].textContent, 'A-Z');
        assert.equal(getEventListeners(f.elements['sort-btn'], 'click').length, 1);
        f.elements['account-search'].value = 'Beta';
        f.elements['account-search'].dispatchEvent(new Event('input'));
        assert.equal(last(), 'b');
        dispose(); dispose();
        assert.equal(getEventListeners(f.elements['account-search'], 'input').length, 0);
        assert.equal(getEventListeners(f.elements['sort-btn'], 'click').length, 0);
        assert.equal(f.views.at(-1).destroyed, 1);
    });
    test(`${label}: a slow old load cannot render over a new mount`, async () => {
        const pending = deferred(); let loads = 0;
        const load = () => ++loads === 1 ? pending.promise : Promise.resolve(records());
        const f = await fixture(company, {listCompanyAccounts: load, listPrivateAccounts: load});
        const old = f.mount(); old.destroy();
        const current = f.mount(); await current.ready;
        pending.resolve(records()); await old.ready;
        assert.equal(f.views[0].renders.length, 0);
        assert.equal(f.views[1].renders.length, 1);
        assert.equal(f.toasts.length, 0);
        current.destroy();
    });
    test(`${label}: abort during decrypt suppresses plaintext render and subsequent field decrypt`, async () => {
        const pending = deferred(); let decrypts = 0;
        const load = async () => [{id: 'x', _encrypted: true, username: 'cipher-1', account: 'cipher-2'}];
        const f = await fixture(company, {listPrivateAccounts: load, listCompanyAccounts: load,
            ensureVaultKeyMaterial: async () => 'fixture-key', decrypt: () => { decrypts++; return pending.promise; }});
        const controller = new AbortController();
        const mounted = f.mount({signal: controller.signal}); await tick();
        assert.equal(decrypts, 1);
        controller.abort(); pending.resolve('fixture-clear'); await mounted.ready;
        assert.equal(decrypts, 1);
        assert.equal(f.views[0].renders.length, 0);
    });
    test(`${label}: leaving during delete confirmation never submits a write`, async () => {
        const pending = deferred();
        const f = await fixture(company, {showConfirmModal: () => pending.promise});
        const mounted = f.mount(); await mounted.ready;
        const action = f.views[0].options.onDelete({dataset: {id: 'a', owner: 'true'}});
        mounted.destroy(); pending.resolve(true); await action;
        assert.equal(f.writes.length, 0);
        assert.equal(f.toasts.length, 0);
    });
    test(`${label}: an already submitted pin completes without updating the next view`, async () => {
        const pending = deferred(); let submitted = 0;
        const f = await fixture(company, {updateDoc: () => { submitted++; return pending.promise; }});
        const mounted = f.mount(); await mounted.ready;
        const row = f.views[0].renders[0][0];
        const action = f.views[0].options.onPin(row);
        mounted.destroy(); pending.resolve(); await action;
        assert.equal(submitted, 1);
        assert.equal(row.isPinned, undefined);
        assert.equal(f.views[0].renders.length, 1);
    });
    test(`${label}: active pin uses the correct owner path and retains working navigation`, async () => {
        const f = await fixture(company); const mounted = f.mount(); await mounted.ready;
        const row = f.views[0].renders[0][0];
        await f.views[0].options.onPin(row);
        assert.equal(f.writes[0][0], company ? 'users/fixture-user/aziende/company-fixture/accounts/a' : 'users/fixture-user/accounts/a');
        assert.equal(row.isPinned, true);
        f.views[0].options.onNavigate(row);
        assert.equal(f.navigations[0], company ? 'dettaglio_account_azienda.html?id=a&aziendaId=company-fixture' : 'dettaglio_account_privato.html?id=a');
        mounted.destroy(); f.views[0].options.onNavigate(row);
        assert.equal(f.navigations.length, 1);
    });
    test(`${label}: an already aborted mount does not load data or attach UI listeners`, async () => {
        let loads = 0;
        const f = await fixture(company, {listPrivateAccounts: () => { loads++; }, listCompanyAccounts: () => { loads++; }});
        const controller = new AbortController(); controller.abort();
        const mounted = f.mount({signal: controller.signal}); await mounted.ready;
        assert.equal(loads, 0);
        assert.equal(getEventListeners(f.elements['sort-btn'], 'click').length, 0);
    });
}

test('private: leaving during profile lookup prevents linked-profile delete batch creation', async () => {
    const pending = deferred();
    const f = await fixture(false, {getUserProfile: () => pending.promise});
    const mounted = f.mount(); await mounted.ready;
    const action = f.views[0].options.onDelete({dataset: {id: 'a', owner: 'true'}});
    await tick(); mounted.destroy(); pending.resolve({contactEmails: []}); await action;
    assert.equal(f.writes.length, 0);
});

test('private: own-account rejection is handled even while accepted invites are pending', async () => {
    const invites = deferred();
    const f = await fixture(false, {listPrivateAccounts: async () => { throw new Error('fixture'); }, listAcceptedInvites: () => invites.promise});
    const mounted = f.mount(); await mounted.ready;
    assert.equal(f.toasts.length, 1);
    assert.equal(f.views[0].renders.length, 0);
    invites.resolve([]); mounted.destroy();
});

for (const company of [false, true]) {
    test(`${company ? 'company' : 'private'}: active archive and delete retain their write destinations`, async () => {
        const f = await fixture(company); const mounted = f.mount(); await mounted.ready;
        const actions = f.views[0].options;
        await actions.onArchive({dataset: {id: 'a', owner: 'true'}});
        assert.equal(f.writes[0][0], company ? 'users/fixture-user/aziende/company-fixture/accounts/a' : 'users/fixture-user/accounts/a');
        assert.equal(f.writes[0][1].isArchived, true);
        await actions.onDelete({dataset: {id: 'b', owner: 'true'}});
        assert.equal(f.writes[1][0], company ? 'users/fixture-user/aziende/company-fixture/accounts/b' : 'users/fixture-user/accounts/b');
        assert.equal(f.views[0].renders.at(-1).length, 0);
        mounted.destroy();
    });
}

test('private: confirmed deletion still dissociates only matching profile email links', async () => {
    const f = await fixture(false, {getUserProfile: async () => ({contactEmails: [
        {email: 'fixture@example.invalid', linkedAccountId: 'a'}, {email: 'other@example.invalid', linkedAccountId: 'b'}
    ]})});
    const mounted = f.mount(); await mounted.ready;
    await f.views[0].options.onDelete({dataset: {id: 'a', owner: 'true'}});
    assert.equal(f.writes[1][0], 'users/fixture-user');
    assert.equal(f.writes[1][1].contactEmails[0].linkedAccountId, null);
    assert.equal(f.writes[1][1].contactEmails[1].linkedAccountId, 'b');
    mounted.destroy();
});
