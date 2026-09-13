import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const base = new URL('../Frontend/public/assets/js/modules/settings/', import.meta.url);
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const service = strip(await readFile(new URL('archive-account-service.js', base), 'utf8'));
const ui = strip(await readFile(new URL('archivio_account.js', base), 'utf8'));
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
const tick = () => new Promise(setImmediate);
const account = (id = 'same', context = 'privato') => ({id, context, revision: 1, nomeAccount: 'Synthetic', isArchived: true});

class Element extends EventTarget {
    constructor(tag, props = {}, children = []) {
        super(); this.tag = tag; this.children = []; this.dataset = {}; this.value = ''; this.textContent = ''; this.isConnected = true;
        Object.assign(this, props);
        const classes = new Set((props.className || '').split(' '));
        this.classList = {add: (...values) => values.forEach(value => classes.add(value)), remove: value => classes.delete(value),
            contains: value => classes.has(value), toggle: value => classes.has(value) ? classes.delete(value) : classes.add(value)};
        children.filter(Boolean).forEach(child => this.appendChild(child));
    }
    appendChild(child) { child.parentNode = this; child.isConnected = true; this.children.push(child); return child; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.isConnected = false; }
    focus() {}
    setAttribute(name, value) { this[name] = value; }
    removeAttribute(name) { delete this[name]; }
    querySelectorAll(selector) {
        const matches = element => selector.startsWith('.') ? element.classList.contains(selector.slice(1)) : element.tag === selector;
        return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture(withUi = false) {
    const events = new EventTarget(), observers = new Set(), calls = [], writes = [], swipes = [], toasts = [], timers = new Map();
    const auth = {currentUser: {uid: 'A'}};
    const nodes = Object.fromEntries(['accounts-container', 'archive-filter-btn', 'archive-context-menu', 'active-context-label', 'btn-empty-trash']
        .map(id => [id, new Element('div', {id})]));
    const search = new Element('input'), body = new Element('body'), document = new EventTarget();
    Object.assign(document, {body, activeElement: search, getElementById: id => nodes[id], querySelector: () => search});
    const context = vm.createContext({
        auth, db: {}, functions: {}, AbortController, crypto: {randomUUID: () => 'operation'}, console: {warn() {}},
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        doc: (_db, ...path) => path.join('/'), deleteField: () => ({delete: true}),
        updateDoc: async (...args) => writes.push(args),
        respond: async () => ({data: {status: 'purged'}}),
        httpsCallable: () => async command => { calls.push(command); return context.respond(command); },
        listArchivedPrivateAccounts: async () => [account()], listCompanies: async () => [],
        listCompanyAccounts: async () => [], getCompany: async () => ({ragioneSociale: 'Synthetic'}),
        ensureVaultKeyMaterial: async () => 'key', decrypt: async () => 'Synthetic username',
        document, navigator: {clipboard: {writeText: async () => {}}},
        createElement: (tag, props, children) => new Element(tag, props, children),
        clearElement: node => { node.children = []; node.textContent = ''; },
        setChildren: (node, children) => { node.children = []; children.forEach(child => node.appendChild(child)); },
        createUiState: props => new Element('div', props), t: () => '', showToast: (...args) => toasts.push(args),
        SwipeList: class { constructor(selector, options) { this.options = options; swipes.push(this); } destroy() { this.destroyed = true; } },
        setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(service, context);
    if (withUi) vm.runInContext(ui, context);
    return {context, calls, writes, nodes, search, body, swipes, toasts, observers, timers,
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
        pagehide: () => events.dispatchEvent(new Event('pagehide')),
        changeUid: uid => { auth.currentUser = uid ? {uid} : null; for (const callback of [...observers]) callback(auth.currentUser); },
        init: () => context.initArchivioAccount({uid: auth.currentUser.uid}),
        confirm(value = 'SI') { const overlay = body.children.at(-1); overlay.querySelector('input').value = value; overlay.querySelectorAll('button')[1].onclick(); }
    };
}

test('purge binds captured owner and target while SDK token lookup can cross a microtask', async () => {
    const f = fixture(), target = account('original');
    const pending = f.context.deleteArchivedAccount('A', target);
    target.id = 'changed'; f.changeUid('B');
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].expectedOwnerUid, 'A');
    assert.equal(f.calls[0].accountId, 'original');
    await assert.rejects(f.context.deleteArchivedAccount('A', target), /ARCHIVE_SESSION_INVALIDATED/);
    assert.equal(f.calls.length, 1);
});

test('empty archive stops after an already submitted request when Vault locks or identity changes', async () => {
    for (const event of ['lock', 'changeUid']) {
        const f = fixture(), gate = deferred(); f.context.respond = () => gate.promise;
        const pending = f.context.emptyArchivedAccounts('A', [account('one'), account('two')]);
        f[event]('B'); gate.resolve({data: {status: 'purged'}});
        await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
        assert.equal(f.calls.length, 1); assert.equal(f.observers.size, 0);
    }
});

test('late key and decryption cannot return archive plaintext after invalidation', async () => {
    for (const stage of ['key', 'decrypt']) {
        const f = fixture(), gate = deferred();
        f.context.listArchivedPrivateAccounts = async () => [{...account(), _encrypted: true, username: 'cipher'}];
        if (stage === 'key') f.context.ensureVaultKeyMaterial = () => gate.promise;
        else f.context.decrypt = () => gate.promise;
        const pending = f.context.loadArchivedAccounts('A', 'privato'); await tick(); f.lock(); gate.resolve('old plaintext');
        await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
        assert.equal(f.observers.size, 0);
    }
});

test('late company list cannot fan out reads after an owner change and restore cannot start stale', async () => {
    const f = fixture(), gate = deferred(); let companyReads = 0;
    f.context.listCompanies = () => gate.promise;
    f.context.listCompanyAccounts = async () => { companyReads++; return []; };
    const pending = f.context.loadArchivedAccounts('A'); await tick(); f.changeUid('B'); gate.resolve([{id: 'company'}]);
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
    await assert.rejects(f.context.restoreArchivedAccount('A', account()), /ARCHIVE_SESSION_INVALIDATED/);
    assert.equal(companyReads, 0); assert.equal(f.writes.length, 0);
});

test('late archive read from previous mount cannot replace the next owner list', async () => {
    const f = fixture(true), gate = deferred(); f.context.listArchivedPrivateAccounts = () => gate.promise;
    const first = f.init(); await tick(); f.changeUid('B');
    f.context.listArchivedPrivateAccounts = async () => [account('B')]; const next = await f.init();
    gate.resolve([account('A')]); await first;
    const rows = f.nodes['accounts-container'].children;
    assert.equal(rows.length, 1); assert.equal(rows[0].dataset.key, '["privato","B"]');
    next.destroy(); assert.equal(f.observers.size, 0);
});

test('owned delete confirmation is cancelled on same UID remount, lock and pagehide', async () => {
    for (const event of ['remount', 'lock', 'pagehide']) {
        const f = fixture(true); await f.init();
        const oldSwipe = f.swipes.at(-1), row = f.nodes['accounts-container'].children[0];
        const pending = oldSwipe.options.onSwipeLeft(row);
        const oldOverlay = f.body.children.at(-1), oldConfirm = oldOverlay.querySelectorAll('button')[1].onclick;
        oldOverlay.querySelector('input').value = 'SI';
        if (event === 'remount') await f.init(); else f[event]();
        oldConfirm(); await pending;
        assert.equal(f.calls.length, 0); assert.equal(f.body.children.length, 0);
        assert.equal(oldOverlay.querySelector('input').value, '');
        assert.equal(oldSwipe.destroyed, true);
    }
});

test('same ID in private and two company archives selects and removes only the complete identity', async () => {
    const f = fixture(true);
    f.context.listCompanies = async () => [{id: 'one'}, {id: 'two'}];
    f.context.listCompanyAccounts = async () => [account()];
    await f.init();
    assert.equal(f.nodes['accounts-container'].children.length, 3);
    const row = f.nodes['accounts-container'].children.find(item => item.dataset.key === '["two","same"]');
    const pending = f.swipes.at(-1).options.onSwipeLeft(row); f.confirm(); await pending;
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].companyId, 'two');
    assert.deepEqual(f.nodes['accounts-container'].children.map(item => item.dataset.key), ['["privato","same"]', '["one","same"]']);
});

test('stale context read cannot replace latest filter result', async () => {
    const f = fixture(true); await f.init();
    const gate = deferred(); f.context.listArchivedPrivateAccounts = () => gate.promise;
    const menu = f.nodes['archive-context-menu'];
    const click = value => menu.onclick({target: {closest: () => new Element('div', {dataset: {value}})}});
    const first = click('privato'); await tick();
    f.context.listCompanyAccounts = async () => [account('new')]; await click('company');
    gate.resolve([account('old')]); await first;
    assert.equal(f.nodes['accounts-container'].children[0].dataset.key, '["company","new"]');
});

test('empty confirmation retains its original list and cannot report success after partial interruption', async () => {
    const f = fixture(true); f.context.listArchivedPrivateAccounts = async () => [account('one'), account('two')];
    await f.init(); const pending = f.nodes['btn-empty-trash'].onclick();
    const gate = deferred(); f.context.respond = () => gate.promise;
    f.confirm('SVUOTA'); await tick(); f.lock(); gate.resolve({data: {status: 'purged'}}); await pending;
    assert.equal(f.calls.length, 1); assert.equal(f.toasts.length, 0);
    assert.equal(f.nodes['accounts-container'].children.length, 0);
});

test('restore timer and retained swipe actions cannot modify a new mount', async () => {
    const f = fixture(true); await f.init(); const swipe = f.swipes.at(-1), row = f.nodes['accounts-container'].children[0];
    await swipe.options.onSwipeRight(row); assert.equal(f.timers.size, 1);
    f.context.listArchivedPrivateAccounts = async () => [account('new')]; await f.init();
    assert.equal(f.timers.size, 0); await swipe.options.onSwipeRight(row);
    assert.equal(f.writes.length, 1); assert.equal(f.nodes['accounts-container'].children[0].dataset.key, '["privato","new"]');
});

test('repeated delete gestures keep a single owned confirmation and a single submitted purge', async () => {
    const f = fixture(true); await f.init(); const swipe = f.swipes.at(-1), row = f.nodes['accounts-container'].children[0];
    const first = swipe.options.onSwipeLeft(row), second = swipe.options.onSwipeLeft(row);
    assert.equal(f.body.children.length, 1);
    const input = f.body.children[0].querySelector('input');
    assert.equal(input.autocapitalize, 'off'); assert.equal(input.spellcheck, 'false'); assert.ok(input['aria-label']);
    f.confirm(); await Promise.all([first, second]);
    assert.equal(f.calls.length, 1); assert.equal(f.body.children.length, 0);
});
