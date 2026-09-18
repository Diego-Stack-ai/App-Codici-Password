import test from 'node:test';
import assert from 'node:assert/strict';
import {mountCompanySummaryView} from './company-summary-view.mjs';
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.textContent = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    replaceChildren(...nodes) {this.children = []; this.append(...nodes);}
    setAttribute() {}
    querySelectorAll(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const tick = () => new Promise(setImmediate);
function fixture(generate) {
    const root = new Node('root'), abort = new AbortController(), bytes = new Uint8Array([1, 2, 3]); let reads = 0, shares = 0;
    mountCompanySummaryView(root, {signal: abort.signal, assertUnlocked() {}}, {
        read: async () => {reads++; return {sections: [{title: 'Azienda', rows: [{label: 'Nome', value: 'Test privato'}]}]};},
        generate: generate || (async () => bytes), canShare: () => true, download() {}, share() {shares++;}
    });
    return {root, abort, bytes, get reads() {return reads;}, get shares() {return shares;}};
}
test('preparation is explicit, sharing preserves click and changing choices invalidates bytes', async () => {
    const f = fixture(), buttons = f.root.querySelectorAll('button'); assert.equal(f.reads, 0);
    buttons[0].dispatchEvent(new Event('click')); await tick(); assert.equal(buttons[1].disabled, false);
    buttons[2].dispatchEvent(new Event('click')); assert.equal(f.shares, 1);
    const retained = f.root.querySelectorAll('dd')[0]; f.root.querySelectorAll('input')[0].dispatchEvent(new Event('change'));
    assert.equal(retained.textContent, ''); assert.deepEqual([...f.bytes], [0, 0, 0]); assert.equal(buttons[1].disabled, true);
});
test('late generated PDF is wiped and never displayed after abort', async () => {
    let release; const f = fixture(() => new Promise(resolve => {release = resolve;}));
    f.root.querySelectorAll('button')[0].dispatchEvent(new Event('click')); await tick(); f.abort.abort(); release(f.bytes); await tick();
    assert.deepEqual([...f.bytes], [0, 0, 0]); assert.equal(f.root.children.length, 0);
});
