import test from 'node:test';
import assert from 'node:assert/strict';
import {mountBankingView} from './banking-view.mjs';
import {mountBankingEditor} from './banking-edit-view.mjs';
import {mountBankingLifecycle} from './banking-lifecycle-view.mjs';
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
test('lifecycle deletion waits for confirmation, retries same plan, and detaches on lock',async()=>{
    const root=new Node('root'),abort=new AbortController(),plan={},sent=[];let prepared=0;
    mountBankingLifecycle(root,{signal:abort.signal,assertUnlocked(){}},{action:'delete-card',bankId:'b',cardIndex:1,
      source:{dispose(){},async prepare(action,target){prepared++;assert.equal(action,'delete-card');assert.equal(target.cardIndex,1);return plan;},
        async send(value){sent.push(value);throw Error('lost');}}});
    assert.equal(prepared,0);assert.equal(sent.length,0);
    const button=root.all('button').find(node=>node.textContent==='Conferma eliminazione');
    button.dispatchEvent(new Event('click'));await tick();button.dispatchEvent(new Event('click'));await tick();
    assert.equal(prepared,1);assert.deepEqual(sent,[plan,plan]);
    abort.abort();button.dispatchEvent(new Event('click'));await tick();assert.equal(sent.length,2);assert.equal(root.children.length,0);
});

test('lifecycle creation masks secrets and wipes fields after preparation',async()=>{
    const root=new Node('root'),abort=new AbortController();
    mountBankingLifecycle(root,{signal:abort.signal,assertUnlocked(){}},{action:'create-card',bankId:'b',cardIndex:0,
      source:{dispose(){},async prepare(){return {};},async send(){throw Error('lost');}}});
    const inputs=root.all('input');assert.equal(inputs.filter(input=>input.type==='password').length,3);
    inputs.forEach(input=>{input.value='synthetic';});
    root.all('button').find(node=>node.textContent==='Conferma creazione').dispatchEvent(new Event('click'));await tick();
    assert.ok(inputs.every(input=>input.value===''&&input.disabled));abort.abort();
});
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
test('bank/card edit actions retain target and are removed on lock', async () => {
    const f = fixture(), calls = [];
    await mountBankingView(f.root, f.context, {listBanks: async () => f.banks,
        onEditBank: (bankId, cardIndex) => calls.push([bankId, cardIndex])});
    const group = f.root.all('article').find(node => node.dataset.bankId === 'second');
    const buttons = ['Modifica conto', 'Modifica carta 1'].map(label => group.all('button').find(button => button.textContent === label));
    buttons[0].dispatchEvent(new Event('click')); buttons[1].dispatchEvent(new Event('click')); await tick();
    assert.deepEqual(calls, [['second', null], ['second', 0]]);
    f.abort.abort(); buttons[0].dispatchEvent(new Event('click')); assert.equal(calls.length, 2);
});
test('bank editor sends changed fields only, masks secrets, wipes and retries same plan', async () => {
    const f = fixture(), plan = {}, calls = []; let saved = 0;
    await mountBankingEditor(f.root, f.context, {source: {load: async () => ({iban: 'ORIGINAL', passwordDispositiva: 'OLD'}),
        prepare: async changes => {assert.deepEqual(changes, {passwordDispositiva: 'NEW'}); return plan;},
        send: async request => {calls.push(request); if (calls.length === 1) throw Error('lost'); return {status: 'confirmed'};}, dispose() {}}, onSaved: () => {saved++;}});
    const inputs = f.root.all('input'), save = f.root.all('button').find(button => button.textContent === 'Salva dati bancari');
    assert.equal(inputs[1].type, 'password'); inputs[1].value = 'NEW';
    save.dispatchEvent(new Event('click')); await tick();
    assert.ok(inputs.every(input => input.value === '' && input.disabled));
    save.dispatchEvent(new Event('click')); await tick();
    assert.equal(calls[0], plan); assert.equal(calls[1], plan); assert.equal(saved, 1); assert.equal(f.root.children.length, 0);
});
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
test('bank widget actions retain selected bank identity and disappear on lock', async () => {
    const f = fixture(), calls = [];
    await mountBankingView(f.root, f.context, {listBanks: async () => f.banks, widgetReader: f.widgetReader,
        onCreateWidget: async bank => calls.push(['create', bank]),
        onEditWidget: async (widget, bank) => calls.push(['edit', widget, bank])});
    const groups = f.root.all('article').filter(node => node.className === 'bank-account');
    for (const group of groups) {
        group.children[1].all('button').find(node => node.textContent === 'Nuovo widget').dispatchEvent(new Event('click'));
        await tick();
        group.children[1].all('button').find(node => node.textContent === 'Modifica widget').dispatchEvent(new Event('click'));
        await tick();
    }
    assert.deepEqual(calls, [['create', 'first'], ['edit', 'first', 'first'], ['create', 'second'], ['edit', 'second', 'second']]);
    const retained = groups[0].children[1].all('button'); f.abort.abort();
    for (const button of retained) button.dispatchEvent(new Event('click'));
    await tick(); assert.equal(calls.length, 4); assert.equal(f.root.children.length, 0);
});
