import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
function fixture() {
    const writes = [], reads = [], errors = [], modules = [], classes = new Set();
    const footer = {children: [], classList: {
        add: value => classes.add(value),
        toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); }
    }};
    const find = (nodes, id) => {
        for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
            if (node?.props?.id === id) return node;
            const nested = node?.children && find(node.children, id);
            if (nested) return nested;
        }
    };
    let read = async () => ({nomeAccount: 'Synthetic company account'});
    const window = {location: {search: '?id=account&aziendaId=company', pathname: '/dettaglio_account_azienda.html', href: ''}, history: {replaceState() {}}};
    const context = vm.createContext({URLSearchParams, window, navigator: {onLine: true}, console,
        document: {getElementById: id => id === 'footer-center-actions' ? footer : find(footer.children, id),
            querySelector: () => null, querySelectorAll: () => []},
        db: {}, doc: (_db, ...path) => path.join('/'), increment: value => ({increment: value}),
        updateDoc: async (path, change) => writes.push({path, change}),
        getCompanyAccount: async (...args) => { reads.push(args); return read(); },
        getCompanyAccountConfirmed: async (...args) => { reads.push(args); return read(); },
        createElement: (tag, props, children) => ({tag, props, children}),
        setChildren: (node, children) => { node.children = children; },
        clearElement: node => { node.children = []; }, createSafeAccountIcon: () => ({}),
        showToast() {}, t: value => value, logError: (...args) => errors.push(args),
        initAttachmentModule: options => modules.push(['attachments', options]),
        initSharingModule: options => modules.push(['sharing', options]),
        initDetailAccountMode: async options => { modules.push(['mode', options]); return {}; },
        renderSharingMap() {}, loadAttachments: async () => {}, renderAccountBanking() {},
        loadModule: async () => ({initAccountSharedCredentials() {}, initAccountEmbeddedWidgets() {}}),
        setTimeout() {}, history: {back() {}}
    });
    vm.runInContext(source.replace(/^import[\s\S]*?;\s*$/gm, '').replace('export async function', 'async function').replace(/\bimport\(/g, 'loadModule('), context);
    return {writes, reads, errors, modules, footer, classes, window,
        button: () => find(footer.children, 'btn-edit-footer'),
        read: value => { read = value; }, init: uid => context.initDettaglioAccountAzienda({uid})};
}

test('guest never gets an edit footer, including while fetch is pending, and submits no view write', async () => {
    const f = fixture(), pending = deferred();
    f.window.location.search += '&ownerId=owner'; f.read(() => pending.promise);
    const opening = f.init('guest');
    assert.equal(f.button(), undefined); assert.ok(f.classes.has('hidden')); assert.equal(f.writes.length, 0);
    pending.resolve({nomeAccount: 'Shared synthetic account'}); await opening;
    assert.equal(f.writes.length, 0); assert.equal(f.button(), undefined); assert.equal(f.errors.length, 0);
    assert.deepEqual(f.reads[0], ['owner', 'company', 'account']);
    for (const [name, options] of f.modules) assert.equal(name === 'attachments' ? options.readOnly : options.isReadOnly ?? options.readOnly, true);
});

test('owner retains exactly one views increment and a working edit footer', async () => {
    const f = fixture(); await f.init('owner');
    assert.equal(f.errors.length, 0); assert.equal(f.classes.has('hidden'), false);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].path, 'users/owner/aziende/company/accounts/account');
    assert.equal(f.writes[0].change.views.increment, 1);
    f.button().props.onclick();
    assert.equal(f.window.location.href, 'form_account_azienda.html?id=account&aziendaId=company');
});

test('guest reinitialization removes owner footer and invalidates its retained edit callback', async () => {
    const f = fixture(); await f.init('owner'); const previous = f.button();
    f.window.location.search += '&ownerId=owner'; await f.init('guest');
    previous.props.onclick();
    assert.equal(f.window.location.href, ''); assert.equal(f.button(), undefined); assert.equal(f.writes.length, 1);
    f.window.location.search = '?id=account&aziendaId=company'; await f.init('owner');
    assert.ok(f.button()); assert.equal(f.classes.has('hidden'), false); assert.equal(f.writes.length, 2);
});

test('a late guest fetch cannot acquire write permission from a later owner initialization', async () => {
    const f = fixture(), pending = deferred();
    f.window.location.search += '&ownerId=owner'; f.read(() => pending.promise);
    const opening = f.init('guest');
    f.read(async () => ({nomeAccount: 'Owner account'})); await f.init('owner');
    assert.equal(f.writes.length, 1);
    pending.resolve({nomeAccount: 'Late guest record'}); await opening;
    assert.equal(f.writes.length, 1); assert.equal(f.errors.length, 0);
});

test('a late owner fetch cannot write after switching to another authenticated owner', async () => {
    const f = fixture(), pending = deferred(); f.read(() => pending.promise);
    const opening = f.init('first');
    f.read(async () => ({nomeAccount: 'Second account'})); await f.init('second');
    pending.resolve({nomeAccount: 'Late first record'}); await opening;
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0].path, 'users/second/aziende/company/accounts/account');
});
