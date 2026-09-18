import test from 'node:test';
import assert from 'node:assert/strict';
import {mountDigitalCardView} from './digital-card-view.mjs';
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.textContent = ''; this.attrs = {};}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    replaceChildren(...nodes) {this.children = []; this.append(...nodes);}
    setAttribute(key, value) {this.attrs[key] = value;}
    removeAttribute(key) {delete this.attrs[key];}
    querySelectorAll(tags) {return this.children.flatMap(node => [...(tags.split(',').includes(node.tag) ? [node] : []), ...node.querySelectorAll(tags)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(generate) {
    const root = new Node('root'), abort = new AbortController(); let reads = 0, renders = 0, downloads = 0;
    const cleanup = mountDigitalCardView(root, {signal: abort.signal, assertUnlocked() {}}, {
        generate: async () => {reads++; return generate ? generate() : 'PRIVATE-CARD';}, loadQr: async () => {}, makePayload: card => card,
        renderQr: (target, payload) => {renders++; target.setAttribute('title', payload); const canvas = new Node('canvas'); canvas.width = canvas.height = 220; canvas.getContext = () => ({clearRect() {}}); target.append(canvas);},
        download: async () => {downloads++;}
    });
    return {root, abort, cleanup, get reads() {return reads;}, get renders() {return renders;}, get downloads() {return downloads;}};
}
test('QR generation is explicit and disposal clears retained pixels and payload title', async () => {
    const f = fixture(); assert.equal(f.reads, 0);
    f.root.querySelectorAll('button')[0].dispatchEvent(new Event('click')); await tick();
    const canvas = f.root.querySelectorAll('canvas')[0], preview = canvas.parent;
    assert.equal(f.renders, 1); assert.equal(preview.attrs.title, 'PRIVATE-CARD');
    f.abort.abort(); f.cleanup(); assert.equal(canvas.width, 0); assert.equal(preview.attrs.title, undefined);
});
for (const action of [0, 1]) test(`late card cannot reach action ${action} after lock`, async () => {
    let release; const f = fixture(() => new Promise(resolve => {release = resolve;}));
    f.root.querySelectorAll('button')[action].dispatchEvent(new Event('click')); await tick(); f.abort.abort(); release('late'); await tick();
    assert.equal(f.renders, 0); assert.equal(f.downloads, 0); assert.equal(f.root.children.length, 0);
});
test('an editor completed after disposal is immediately cleaned up', async () => {
    const root = new Node('root'), abort = new AbortController(); let release, cleaned = false;
    mountDigitalCardView(root, {signal: abort.signal, assertUnlocked() {}}, {
        generate: async () => '', loadQr: async () => {}, renderQr() {}, makePayload: value => value, download() {},
        mountEditor: () => new Promise(resolve => {release = resolve;})
    });
    root.querySelectorAll('button')[2].dispatchEvent(new Event('click')); await tick();
    abort.abort(); release(() => {cleaned = true;}); await tick();
    assert.equal(cleaned, true); assert.equal(root.children.length, 0);
});
