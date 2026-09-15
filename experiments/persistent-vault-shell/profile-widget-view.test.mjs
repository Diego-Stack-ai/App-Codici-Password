import test from 'node:test';
import assert from 'node:assert/strict';
import {mountProfileWidgetView} from './profile-widget-view.mjs';
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.textContent = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    replaceChildren(...nodes) {this.children = []; this.append(...nodes);}
    setAttribute() {}
    all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(read) {
    const root = new Node('root'), abort = new AbortController(), calls = [];
    const widget = {id: 'widget', title: 'Titolo', collapsed: true, fields: [{id: 'plain', label: 'Nascosto', encrypted: false, preview: false, copyable: true}]};
    return {root, abort, calls, widget, mount: () => mountProfileWidgetView(root, {signal: abort.signal, assertUnlocked() {}}, {
        reader: {list: async () => [widget], read: async (...args) => {calls.push(args); return read ? read() : 'Valore privato';}}, copyText: async () => {}})};
}
test('collapsed Widgets and hidden previews never eagerly read values; collapse clears detached plaintext', async () => {
    const f = fixture(), cleanup = await f.mount();
    assert.deepEqual(f.calls, []); f.root.all('button')[0].dispatchEvent(new Event('click')); await tick();
    assert.deepEqual(f.calls, []);
    f.root.all('button').find(node => node.textContent === 'Mostra Nascosto').dispatchEvent(new Event('click')); await tick();
    assert.equal(f.calls[0][2].expectedEncrypted, false);
    const value = f.root.all('span').find(node => node.textContent === 'Valore privato'); assert.ok(value);
    f.root.all('button').find(node => node.textContent === 'Comprimi Titolo').dispatchEvent(new Event('click')); await tick();
    assert.equal(value.textContent, ''); cleanup(); assert.equal(f.root.children.length, 0);
});
test('collapse during a pending field read prevents a late value from being displayed', async () => {
    let release; const f = fixture(() => new Promise(resolve => {release = resolve;})), cleanup = await f.mount();
    f.root.all('button')[0].dispatchEvent(new Event('click')); await tick();
    f.root.all('button').find(node => node.textContent === 'Mostra Nascosto').dispatchEvent(new Event('click')); await tick();
    const values = f.root.all('span');
    f.root.all('button').find(node => node.textContent === 'Comprimi Titolo').dispatchEvent(new Event('click'));
    release('late'); await tick(); assert.ok(values.every(node => node.textContent === '')); cleanup();
});
