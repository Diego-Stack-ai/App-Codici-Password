import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/privato/dettaglio_account_privato.js', import.meta.url), 'utf8');
const tick = () => new Promise(resolve => setImmediate(resolve));
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; }

function fixture({missing = false, pending = null, directPending = null, search = '?id=legacy-alias'} = {}) {
    const calls = [], footer = {children: []};
    let failNextRead = false;
    const attachmentClasses = new Set();
    const attachmentButton = {onclick: null, classList: {add: name => attachmentClasses.add(name), remove: name => attachmentClasses.delete(name)}};
    const window = {location: {search, pathname: '/dettaglio_account_privato.html', href: ''}, history: {replaceState() {}}};
    const physical = () => ({id: 'physical-document', nomeAccount: 'Synthetic account'});
    const createElement = (tag, props = {}, children = []) => ({tag, ...props, children});
    const context = vm.createContext({window, URLSearchParams,
        navigator: {onLine: true}, console, db: {}, LOG() {}, logError: (...args) => calls.push(['error', ...args]),
        document: {getElementById: id => id === 'footer-center-actions' ? footer : id === 'btn-add-attachment' ? attachmentButton : null,
            querySelector: () => null, querySelectorAll: () => []},
        createElement, clearElement: node => { node.children = []; }, setChildren: (node, child) => { node.children = [child]; },
        createSafeAccountIcon() {}, showToast: (...args) => calls.push(['toast', ...args]), t: value => value,
        doc: (_, ...path) => path.join('/'), increment: value => value,
        updateDoc: async (path, value) => calls.push(['update', path, value]),
        getPrivateAccount: async (uid, id) => {
            calls.push(['get', uid, id]);
            if (failNextRead) { failNextRead = false; throw new Error('READ_FAILED'); }
            if (directPending && id === 'legacy-alias') return directPending.promise;
            return !missing && id === 'physical-document' ? physical() : null;
        },
        getPrivateAccountConfirmed: async (uid, id) => { calls.push(['confirmed', uid, id]); return null; },
        findPrivateAccountByLegacyId: async (uid, id) => { calls.push(['legacy', uid, id]); return pending ? pending.promise : missing ? null : physical(); },
        initPrivateAttachmentModule: data => calls.push(['attachments-init', data]),
        loadPrivateAttachments: async () => calls.push(['attachments-load']),
        openSourceSelector: () => calls.push(['attachment-open']),
        initPrivateSharingModule: data => calls.push(['sharing-init', data]),
        renderPrivateSharingMap: data => calls.push(['sharing-render', data]),
        initDetailAccountMode: async data => { calls.push(['mode', data]); return new Map(); },
        renderAccountBanking: (_, data) => calls.push(['banking', data]),
        loadCredentials: async () => ({initAccountSharedCredentials: data => calls.push(['credentials', data])}),
        loadWidgets: async () => ({initAccountEmbeddedWidgets: data => calls.push(['widgets', data])})
    });
    const transformed = source.replace(/^import[\s\S]*?;\r?$/gm, '').replace(/^export /gm, '')
        .replace("import('../shared/account-shared-credentials.js?v=1.2.110')", 'loadCredentials()')
        .replace("import('../shared/account-embedded-widgets.js?v=1.2.110')", 'loadWidgets()');
    vm.runInContext(transformed, context);
    const findEdit = () => footer.children.flatMap(node => node.children || []).find(node => node.id === 'btn-edit-footer');
    return {calls, footer, window, findEdit, attachmentButton, attachmentClasses,
        failNextRead: () => { failNextRead = true; },
        init: (uid = 'owner-fixture') => context.initDettaglioAccountPrivato({uid})};
}

test('legacy resolution binds views, edit, attachments, sharing, mode and widgets to the physical ID', async () => {
    const f = fixture(); await f.init(); await tick();
    assert.equal(f.calls.filter(([type]) => type === 'error').length, 0);
    assert.equal(f.calls.find(([type]) => type === 'get')[2], 'legacy-alias');
    assert.equal(f.calls.find(([type]) => type === 'legacy')[2], 'legacy-alias');
    assert.equal(f.calls.find(([type]) => type === 'update')[1], 'users/owner-fixture/accounts/physical-document');
    for (const type of ['attachments-init', 'sharing-init', 'mode', 'credentials', 'widgets']) {
        assert.equal(f.calls.find(([name]) => name === type)[1].accountId, 'physical-document', type);
    }
    const position = type => f.calls.findIndex(([name]) => name === type);
    assert.ok(position('attachments-init') < position('attachments-load'));
    assert.ok(position('sharing-init') < position('sharing-render'));
    assert.ok(position('attachments-init') < position('mode'));
    f.findEdit().onclick();
    assert.equal(f.window.location.href, 'form_account_privato.html?id=physical-document');
    f.window.location.href = '';
    f.calls.find(([type]) => type === 'banking')[1].onAddBanking();
    assert.equal(f.window.location.href, 'form_account_privato.html?id=physical-document');
});

test('no record action is initialized or exposed while the alias lookup is pending', async () => {
    const pending = deferred(), f = fixture({pending});
    const ready = f.init(); await tick();
    assert.equal(f.findEdit(), undefined);
    assert.equal(f.window.location.href, '');
    assert.equal(f.calls.some(([type]) => ['update', 'attachments-init', 'sharing-init', 'mode', 'banking', 'widgets', 'credentials'].includes(type)), false);
    pending.resolve({id: 'physical-document', nomeAccount: 'Synthetic account'});
    await ready; await tick();
    f.findEdit().onclick();
    assert.equal(f.window.location.href, 'form_account_privato.html?id=physical-document');
});

test('a missing account leaves record actions unavailable', async () => {
    const f = fixture({missing: true}); await f.init(); await tick();
    assert.equal(f.findEdit(), undefined);
    assert.equal(f.calls.some(([type]) => ['update', 'attachments-init', 'attachments-load', 'sharing-init', 'sharing-render', 'mode', 'banking', 'widgets', 'credentials'].includes(type)), false);
    assert.equal(f.calls.find(([type]) => type === 'toast')[1], 'account_not_found');
});

test('reload after legacy resolution reads the physical document directly', async () => {
    const f = fixture(); await f.init(); await tick();
    const reload = f.calls.find(([type]) => type === 'sharing-init')[1].onReload;
    await reload(); await tick();
    assert.equal(f.calls.filter(([type]) => type === 'legacy').length, 1);
    assert.equal(f.calls.filter(([type]) => type === 'get').at(-1)[2], 'physical-document');
    assert.ok(f.calls.filter(([type]) => type === 'update').every(([, path]) => path.endsWith('/physical-document')));
});

test('shared read-only lookup keeps the owner and physical ID without enabling mutations', async () => {
    const f = fixture({search: '?id=legacy-alias&ownerId=other-owner'}); await f.init(); await tick();
    assert.equal(f.calls.find(([type]) => type === 'legacy')[1], 'other-owner');
    const sharing = f.calls.find(([type]) => type === 'sharing-init')[1];
    assert.equal(sharing.ownerId, 'other-owner'); assert.equal(sharing.accountId, 'physical-document');
    assert.equal(sharing.readOnly, true);
    assert.equal(f.findEdit(), undefined);
    assert.equal(f.calls.some(([type]) => type === 'update'), false);
    f.calls.find(([type]) => type === 'banking')[1].onAddBanking();
    assert.equal(f.window.location.href, '');
});

test('an already canonical URL does not invoke the legacy lookup', async () => {
    const f = fixture({search: '?id=physical-document'}); await f.init(); await tick();
    assert.equal(f.calls.some(([type]) => type === 'legacy'), false);
    assert.equal(f.calls.find(([type]) => type === 'attachments-init')[1].accountId, 'physical-document');
});

test('server-confirmed refresh still resolves an alias before enabling actions', async () => {
    const f = fixture({search: '?id=legacy-alias&afterWrite=1'}); await f.init(); await tick();
    assert.equal(f.calls.find(([type]) => type === 'confirmed')[2], 'legacy-alias');
    assert.equal(f.calls.find(([type]) => type === 'mode')[1].accountId, 'physical-document');
    f.findEdit().onclick();
    assert.equal(f.window.location.href, 'form_account_privato.html?id=physical-document');
});

test('a stale direct lookup cannot start an alias query under the next owner', async () => {
    const directPending = deferred(), f = fixture({directPending});
    const old = f.init(); await tick();
    f.window.location.search = '?id=physical-document';
    await f.init('next-owner'); await tick();
    const count = f.calls.length;
    directPending.resolve(null); await old; await tick();
    assert.equal(f.calls.length, count);
    assert.equal(f.calls.some(([type]) => type === 'legacy'), false);
    assert.equal(f.calls.find(([type]) => type === 'attachments-init')[1].ownerId, 'next-owner');
});

test('a late alias result cannot replace the next owner context or initialize its modules', async () => {
    const pending = deferred(), f = fixture({pending});
    const old = f.init(); await tick();
    assert.equal(f.calls.find(([type]) => type === 'legacy')[1], 'owner-fixture');
    f.window.location.search = '?id=physical-document';
    await f.init('next-owner'); await tick();
    const count = f.calls.length;
    pending.resolve({id: 'old-physical-document', nomeAccount: 'Old fixture'});
    await old; await tick();
    assert.equal(f.calls.length, count);
    assert.ok(f.calls.filter(([type]) => type === 'update').every(([, path]) => path === 'users/next-owner/accounts/physical-document'));
    f.findEdit().onclick();
    assert.equal(f.window.location.href, 'form_account_privato.html?id=physical-document');
});

test('a retained attachment action is disabled while a guest lookup is pending and after resolution', async () => {
    const directPending = deferred(), f = fixture({directPending, search: '?id=physical-document'});
    await f.init(); await tick();
    const previous = f.attachmentButton.onclick;
    previous({preventDefault() {}});
    assert.equal(f.calls.filter(([type]) => type === 'attachment-open').length, 1);
    f.window.location.search = '?id=legacy-alias&ownerId=other-owner';
    const ready = f.init(); await tick();
    assert.equal(f.attachmentButton.onclick, null);
    assert.equal(f.attachmentClasses.has('hidden'), true);
    previous({preventDefault() {}});
    assert.equal(f.calls.filter(([type]) => type === 'attachment-open').length, 1);
    directPending.resolve(null); await ready; await tick();
    previous({preventDefault() {}});
    assert.equal(f.attachmentButton.onclick, null);
    assert.equal(f.attachmentClasses.has('hidden'), true);
    assert.equal(f.calls.filter(([type]) => type === 'attachment-open').length, 1);
});

test('a retained attachment action stays disabled when the next lookup finds no account', async () => {
    const pending = deferred(), f = fixture({pending, search: '?id=physical-document'});
    await f.init(); await tick();
    const previous = f.attachmentButton.onclick;
    f.window.location.search = '?id=legacy-alias';
    const ready = f.init(); await tick();
    previous({preventDefault() {}});
    pending.resolve(null); await ready; await tick();
    previous({preventDefault() {}});
    assert.equal(f.attachmentButton.onclick, null);
    assert.equal(f.attachmentClasses.has('hidden'), true);
    assert.equal(f.calls.some(([type]) => type === 'attachment-open'), false);
});

test('failed reload hides unavailable attachment action and a successful retry installs a fresh action', async () => {
    const f = fixture(); await f.init(); await tick();
    const previous = f.attachmentButton.onclick;
    const reload = f.calls.find(([type]) => type === 'sharing-init')[1].onReload;
    assert.equal(f.attachmentClasses.has('hidden'), false);
    f.failNextRead();
    const failed = reload();
    assert.equal(f.attachmentButton.onclick, null);
    assert.equal(f.attachmentClasses.has('hidden'), true);
    await failed; await tick();
    assert.equal(f.calls.find(([type]) => type === 'error')[1], 'LoadAccount');
    previous({preventDefault() {}});
    assert.equal(f.calls.some(([type]) => type === 'attachment-open'), false);
    assert.equal(f.attachmentButton.onclick, null);
    assert.equal(f.attachmentClasses.has('hidden'), true);

    await reload(); await tick();
    assert.equal(f.attachmentClasses.has('hidden'), false);
    assert.notEqual(f.attachmentButton.onclick, previous);
    previous({preventDefault() {}});
    assert.equal(f.calls.some(([type]) => type === 'attachment-open'), false);
    f.attachmentButton.onclick({preventDefault() {}});
    assert.equal(f.calls.filter(([type]) => type === 'attachment-open').length, 1);
});
