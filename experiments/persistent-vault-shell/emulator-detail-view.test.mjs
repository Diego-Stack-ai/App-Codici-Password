import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./emulator-detail-view.mjs', import.meta.url), 'utf8');
const extraSource = await readFile(new URL('./detail-extra-fields.mjs', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const selection = Object.freeze({domain: 'private', id: 'fixture'});
class Node extends EventTarget {
    children = []; attributes = {}; handlers = {};
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(type, callback, options) { this.handlers[type] = callback; super.addEventListener(type, callback, options); }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    remove() {
        if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);
        this.parent = null;
    }
}
function fixture({realExtra = false} = {}) {
    const root = new Node(), views = [], copies = [], controller = new AbortController();
    const realm = vm.createContext({AbortController, DOMException,
        mountDetailExtraFields: async () => () => {},
        navigator: {clipboard: {writeText: async value => copies.push(value)}},
        document: {createElement: () => new Node()},
        createAccountListView: options => {
            const view = {options, renders: [], destroyed: 0, render(rows) { this.renders.push(rows); }, destroy() { this.destroyed++; }};
            views.push(view); return view;
        }
    });
    if (realExtra) vm.runInContext(extraSource.replace('export async function', 'async function'), realm);
    vm.runInContext(source.replace(/^import .*;$/gm, '').replace('export async function', 'async function'), realm);
    return {root, views, copies, controller, mount: (openAccount, options = {}) => realm.mountEmulatorDetail(root,
        {signal: controller.signal, unlocked: true, ...options.context},
        {selection, openAccount, onBack() {}, ...options})};
}

test('detail reads visible fields through capability and defers password until requested', async () => {
    const f = fixture(), reads = []; let backs = 0;
    const values = {nomeAccount: 'Fixture title', username: 'Fixture user', account: 'Fixture code', password: 'Fixture secret'};
    const cleanup = await f.mount(async selected => {
        assert.equal(selected, selection);
        return Object.freeze({has: field => field in values, read: async field => { reads.push(field); return values[field]; }});
    }, {onBack: () => backs++});
    assert.deepEqual(reads, ['nomeAccount', 'username', 'account']);
    const view = f.views[0], record = view.renders[0][0];
    assert.equal(view.options.readOnly, true);
    assert.equal(record.nomeAccount, values.nomeAccount);
    assert.equal(record.password, 'protected-field-present');
    assert.equal(await view.options.resolveSecret(), values.password);
    const back = f.root.children[0].children[1];
    back.dispatchEvent(new Event('click')); assert.equal(backs, 1);
    cleanup(); cleanup(); back.dispatchEvent(new Event('click'));
    assert.equal(backs, 1); assert.equal(view.destroyed, 1); assert.equal(f.root.children.length, 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
    await assert.rejects(view.options.resolveSecret(), {name: 'AbortError'});
    assert.deepEqual(reads, ['nomeAccount', 'username', 'account', 'password']);
});

test('aborted open removes only its own wrapper and cannot render over the next view', async () => {
    const f = fixture(), pending = deferred();
    const mounting = f.mount(() => pending.promise);
    f.controller.abort();
    const next = new Node(); f.root.append(next);
    pending.resolve({has: () => { throw new Error('STALE_ACCESS'); }});
    await assert.rejects(mounting, {name: 'AbortError'});
    assert.deepEqual(f.root.children, [next]);
    assert.equal(f.views.length, 0);
});

test('abort during eager field read prevents later reads and rendering', async () => {
    const f = fixture(), pending = deferred(), reads = [];
    const mounting = f.mount(async () => ({has: () => true, read: field => { reads.push(field); return pending.promise; }}));
    await tick(); f.controller.abort(); pending.resolve('Stale plaintext');
    await assert.rejects(mounting, {name: 'AbortError'});
    assert.deepEqual(reads, ['nomeAccount']);
    assert.equal(f.views.length, 0); assert.equal(f.root.children.length, 0);
});

test('field failure cleans the wrapper and propagates without fallback', async () => {
    const f = fixture();
    await assert.rejects(f.mount(async () => ({has: () => true, read: async () => { throw new Error('CIPHERTEXT_REQUIRED'); }})), /CIPHERTEXT_REQUIRED/);
    assert.equal(f.views.length, 0); assert.equal(f.root.children.length, 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
});

test('missing fields are not read and missing password creates no password row', async () => {
    const f = fixture(), reads = [];
    const cleanup = await f.mount(async () => ({has: field => field === 'nomeAccount', read: async field => { reads.push(field); return 'Only title'; }}));
    assert.deepEqual(reads, ['nomeAccount']);
    assert.equal(f.views[0].renders[0][0].password, undefined);
    cleanup();
});

test('password result completing after manual cleanup is rejected', async () => {
    const f = fixture(), pending = deferred();
    const cleanup = await f.mount(async () => ({has: field => field === 'password', read: () => pending.promise}));
    const reading = f.views[0].options.resolveSecret();
    cleanup(); pending.resolve('Stale secret');
    await assert.rejects(reading, {name: 'AbortError'});
});

test('locked or already aborted detail never opens an account', async () => {
    const f = fixture(); let opens = 0;
    await assert.rejects(f.mount(() => { opens++; }, {context: {unlocked: false}}), /VAULT_LOCKED/);
    f.controller.abort(); await f.mount(() => { opens++; });
    assert.equal(opens, 0); assert.equal(f.root.children.length, 0);
});

test('real extra fields copy while active; abort during URL read removes old output and preserves the next view', async () => {
    const f = fixture({realExtra: true}), pending = deferred(), reads = [];
    const mounting = f.mount(async () => ({has: field => ['nomeAccount', 'note', 'url'].includes(field), read: field => {
        reads.push(field);
        return field === 'url' ? pending.promise : Promise.resolve(field === 'note' ? 'Synthetic note' : 'Synthetic title');
    }}));
    await tick();
    assert.deepEqual(reads, ['nomeAccount', 'note', 'url']);
    assert.equal(f.views[0].renders.length, 1);
    const wrapper = f.root.children[0], extras = wrapper.children[3], note = extras.children[0];
    const copy = note.children[2];
    await copy.handlers.click(); assert.deepEqual(f.copies, ['Synthetic note']);
    f.controller.abort();
    const next = new Node(); f.root.append(next);
    assert.equal(f.views[0].destroyed, 1);
    assert.equal(note.children[1].textContent, '');
    assert.equal(getEventListeners(copy, 'click').length, 0);
    await copy.handlers.click(); assert.equal(f.copies.length, 1);
    pending.resolve('https://example.invalid/late');
    await assert.rejects(mounting, {name: 'AbortError'});
    assert.deepEqual(f.root.children, [next]);
    assert.equal(f.views[0].destroyed, 1);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
});

test('real extra URL failure removes the rendered card and partial note without exposing provider error text', async () => {
    const f = fixture({realExtra: true}), pending = deferred();
    const mounting = f.mount(async () => ({has: field => ['nomeAccount', 'note', 'url'].includes(field), read: async field => {
        if (field === 'url') { await pending.promise; throw new Error('provider-error-with-private-value'); }
        return field === 'note' ? 'Partial synthetic note' : 'Synthetic title';
    }}));
    await tick();
    assert.equal(f.views[0].renders.length, 1);
    const extras = f.root.children[0].children[3], note = extras.children[0], copy = note.children[2];
    assert.equal(note.children[1].textContent, 'Partial synthetic note');
    pending.resolve();
    await assert.rejects(mounting, error => error.message === 'DETAIL_FIELDS_UNAVAILABLE');
    assert.equal(f.root.children.length, 0); assert.equal(f.views[0].destroyed, 1);
    assert.equal(note.children[1].textContent, '');
    assert.equal(getEventListeners(copy, 'click').length, 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
    await copy.handlers.click(); assert.deepEqual(f.copies, []);
});
