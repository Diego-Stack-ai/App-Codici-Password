import test from 'node:test';
import assert from 'node:assert/strict';
import {mountAccountWidgetView} from './account-widget-view.mjs';
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.textContent = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute() {}
    all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
    const root = new Node('root'), abort = new AbortController(), calls = [], copied = [];
    const context = {signal: abort.signal, assertUnlocked() {}};
    const rows = [{id: 'widget', title: 'SIM', kind: 'embedded', fields: [
        {id: 'pin', label: 'PIN', encrypted: true, copyable: false}, {id: 'note', label: 'Nota', encrypted: false, copyable: true}]}];
    const reader = {list: async () => rows, read: async (widget, field) => {calls.push([widget, field]); return field === 'pin' ? '2076' : 'plain';}};
    return {root, abort, context, reader, rows, calls, copied, mount: () => mountAccountWidgetView(root, context, {reader, copyText: async value => copied.push(value)})};
}
test('values are lazy, secret copy is absent, reveal/mask and disposal clear retained nodes', async () => {
    const f = fixture(), dispose = await f.mount();
    assert.deepEqual(f.calls, [['widget', 'note']]);
    const values = f.root.all('span'), buttons = f.root.all('button');
    assert.equal(buttons.length, 2);
    buttons[0].dispatchEvent(new Event('click')); await tick(); assert.equal(values[0].textContent, '2076');
    buttons[0].dispatchEvent(new Event('click')); await tick(); assert.equal(values[0].textContent, '••••••••');
    buttons[1].dispatchEvent(new Event('click')); await tick(); assert.deepEqual(f.copied, ['plain']);
    const retained = [...values, ...buttons, ...f.root.all('h3'), ...f.root.all('strong')];
    dispose(); assert.ok(retained.every(node => node.textContent === '')); assert.equal(f.root.children.length, 0);
    buttons[0].dispatchEvent(new Event('click')); await tick(); assert.equal(values[0].textContent, '');
});
test('late reveal after abort cannot restore text or remove a newer view', async () => {
    const f = fixture(); await f.mount(); const value = f.root.all('span')[0]; let release;
    f.reader.read = () => new Promise(resolve => {release = resolve;});
    f.root.all('button')[0].dispatchEvent(new Event('click')); f.abort.abort();
    const newer = new Node('article'); f.root.append(newer); release('late'); await tick();
    assert.equal(value.textContent, ''); assert.deepEqual(f.root.children, [newer]);
});
test('failed snapshot invalidates other pending reads and sanitizes errors', async () => {
    const f = fixture(); f.rows[0].fields.push({id: 'puk', label: 'PUK', encrypted: true});
    await f.mount(); let release;
    f.reader.read = async (_, field) => {if (field === 'pin') return new Promise(resolve => {release = resolve;}); throw Error('SECRET-ERROR');};
    const buttons = f.root.all('button'); buttons[0].dispatchEvent(new Event('click')); buttons[2].dispatchEvent(new Event('click')); await tick();
    release('late'); await tick();
    assert.ok(f.root.all('span').every(node => node.textContent === ''));
    assert.ok(!f.root.all('p').some(node => node.textContent.includes('SECRET-ERROR')));
});
test('bank-owned widgets never appear among generic fields', async () => {
    const f = fixture(); f.rows[0].bankId = 'bank'; await f.mount();
    assert.equal(f.calls.length, 0); assert.equal(f.root.all('button').length, 0);
    assert.match(f.root.all('p')[0].textContent, /modulo bancario/);
});
test('late initial non-secret value is discarded after abort', async () => {
    const f = fixture(); let release;
    f.reader.read = () => new Promise(resolve => {release = resolve;});
    const pending = f.mount(); while (!release) await tick(); f.abort.abort(); release('late'); await pending;
    assert.equal(f.root.children.length, 0);
});
