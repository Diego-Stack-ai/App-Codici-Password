import test from 'node:test';
import assert from 'node:assert/strict';
import {mountBankingView} from './banking-view.mjs';
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
function fixture() {
    const root = new Node('root'), abort = new AbortController(), copied = [], reads = [];
    const context = {signal: abort.signal, assertUnlocked() {}};
    const banks = ['first', 'second'].map((bankId, index) => ({bankId, index, fields: [{id: 'iban', secret: false}], read: async () => 'IBAN-' + bankId,
        cards: [{index: 0, fields: [{id: 'pin', secret: true}], read: async () => {reads.push(bankId); return 'PIN-' + bankId;}}]}));
    const widgetReader = {list: async () => banks.map(bank => ({id: bank.bankId, bankId: bank.bankId, title: 'Widget ' + bank.bankId, kind: 'embedded',
        fields: [{id: 'value', label: 'Campo', encrypted: false, copyable: true}]})), read: async id => 'Widget value ' + id};
    return {root, abort, context, banks, widgetReader, copied, reads,
        mount: () => mountBankingView(root, context, {listBanks: async () => banks, widgetReader, copyText: async value => copied.push(value)})};
}
test('each bank contains fields, its own Widgets and cards in that order; secret copy is explicit', async () => {
    const f = fixture(), dispose = await f.mount();
    const groups = f.root.all('article').filter(node => node.className === 'bank-account');
    assert.equal(groups.length, 2);
    for (const [index, group] of groups.entries()) {
        assert.deepEqual(group.children.map(node => node.dataset.bankPart), ['fields', 'widgets', 'cards']);
        assert.deepEqual(group.children[1].all('span').map(node => node.textContent), ['Widget value ' + f.banks[index].bankId]);
    }
    assert.deepEqual(f.reads, []);
    groups[0].children[2].all('button').find(node => node.textContent === 'Copia PIN').dispatchEvent(new Event('click'));
    await tick(); assert.deepEqual(f.copied, ['PIN-first']);
    const retained = f.root.all('span'); dispose(); assert.ok(retained.every(node => node.textContent === ''));
    assert.equal(f.root.children.length, 0);
});
test('abort while mounting cards clears already mounted account and Widget data', async () => {
    const f = fixture(); let release;
    f.banks[0].cards[0].fields = [{id: 'cardNumber', secret: false}];
    f.banks[0].cards[0].read = () => new Promise(resolve => {release = resolve;});
    const pending = f.mount(); while (!release) await tick();
    const retained = f.root.all('span'); f.abort.abort(); release('late'); await pending;
    assert.equal(f.root.children.length, 0); assert.ok(retained.every(node => node.textContent === ''));
});
test('failed bank read uses a generic message and does not propagate record errors', async () => {
    const f = fixture();
    const dispose = await mountBankingView(f.root, f.context, {listBanks: async () => {throw Error('SECRET');}});
    assert.ok(f.root.all('p').some(node => node.textContent.includes('non disponibili')));
    assert.ok(!f.root.all('p').some(node => node.textContent.includes('SECRET'))); dispose();
});
