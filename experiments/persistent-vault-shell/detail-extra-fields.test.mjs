import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('./detail-extra-fields.mjs', import.meta.url), 'utf8');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
class Node extends EventTarget {
    children = []; attributes = {}; handlers = {};
    constructor(tag = 'main') { super(); this.tag = tag; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); this.parent = null; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, callback, options) { this.handlers[type] = callback; super.addEventListener(type, callback, options); }
}
function fixture() {
    const root = new Node(), controller = new AbortController(), copies = [], errors = [];
    const realm = vm.createContext({AbortController, DOMException, document: {createElement: tag => new Node(tag)}});
    vm.runInContext(source.replace('export async function', 'async function'), realm);
    return {root, controller, copies, errors,
        mount: (account, options = {}) => realm.mountDetailExtraFields(root, {account, signal: controller.signal,
            copyText: async value => copies.push(value), onError: error => errors.push(error), ...options})};
}

test('notes preserve line breaks as text, URL stays text, and both copy through injected clipboard', async () => {
    const f = fixture(), values = {note: '<script>fixture</script>\nSecond line', url: 'https://example.invalid/?fixture=1'}, reads = [];
    const cleanup = await f.mount({has: field => field in values, read: async field => { reads.push(field); return values[field]; }});
    assert.deepEqual(reads, ['note', 'url']);
    const [note, url] = f.root.children[0].children;
    assert.equal(note.children[0].textContent, 'Note');
    assert.equal(note.children[1].tag, 'pre'); assert.equal(note.children[1].textContent, values.note);
    assert.equal(url.children[0].textContent, 'Sito web');
    assert.equal(url.children[1].tag, 'p'); assert.equal(url.children[1].textContent, values.url);
    assert.equal(url.children[1].attributes.href, undefined);
    await note.children[2].handlers.click(); await url.children[2].handlers.click();
    assert.deepEqual(f.copies, [values.note, values.url]);
    cleanup(); cleanup();
    assert.equal(f.root.children.length, 0); assert.equal(note.children[1].textContent, '');
    assert.equal(getEventListeners(note.children[2], 'click').length, 0);
    await note.children[2].handlers.click(); assert.equal(f.copies.length, 2);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
});

test('absent fields trigger no read and already aborted mount does nothing', async () => {
    const f = fixture(); let reads = 0;
    const account = {has: () => false, read: () => { reads++; }};
    const cleanup = await f.mount(account);
    assert.equal(reads, 0); assert.equal(f.root.children[0].children.length, 0); cleanup();
    f.controller.abort(); await f.mount({has: () => { throw new Error('SHOULD_NOT_RUN'); }});
    assert.equal(f.root.children.length, 0);
});

test('abort during read prevents later field access and does not remove the next view', async () => {
    const f = fixture(), pending = deferred(), reads = [];
    const mounting = f.mount({has: () => true, read: field => { reads.push(field); return pending.promise; }});
    f.controller.abort(); const next = new Node(); f.root.append(next);
    pending.resolve('Stale plaintext');
    await assert.rejects(mounting, {name: 'AbortError'});
    assert.deepEqual(reads, ['note']); assert.deepEqual(f.root.children, [next]);
});

test('field failure removes partial output and sanitizes provider error messages', async () => {
    const f = fixture();
    await assert.rejects(f.mount({has: () => true, read: async field => {
        if (field === 'url') throw new Error('secret-provider-value');
        return 'Partial note';
    }}), error => error.message === 'DETAIL_FIELDS_UNAVAILABLE');
    assert.equal(f.root.children.length, 0);
    assert.equal(getEventListeners(f.controller.signal, 'abort').length, 0);
});

test('clipboard rejection reports only a fixed code without secret error contents', async () => {
    const f = fixture();
    const cleanup = await f.mount({has: field => field === 'note', read: async () => 'Fixture note'},
        {copyText: async () => { throw new Error('clipboard-contained-secret'); }});
    await f.root.children[0].children[0].children[2].handlers.click();
    assert.deepEqual(f.errors.map(error => error.message), ['DETAIL_FIELD_COPY_FAILED']); cleanup();
});

test('clipboard already submitted may finish after cleanup without stale error callback', async () => {
    const f = fixture(), pending = deferred();
    const cleanup = await f.mount({has: field => field === 'url', read: async () => 'https://example.invalid'},
        {copyText: () => pending.promise});
    const button = f.root.children[0].children[0].children[2];
    const copying = button.handlers.click(); cleanup(); pending.resolve(); await copying;
    assert.deepEqual(f.errors, []);
    await button.handlers.click(); assert.deepEqual(f.errors, []);
});

test('abort during has prevents the corresponding read', async () => {
    const f = fixture(); let reads = 0;
    await assert.rejects(f.mount({has: () => { f.controller.abort(); return true; }, read: () => { reads++; }}), {name: 'AbortError'});
    assert.equal(reads, 0); assert.equal(f.root.children.length, 0);
});
