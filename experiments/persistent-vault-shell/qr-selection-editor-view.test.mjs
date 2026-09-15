import test from 'node:test';
import assert from 'node:assert/strict';
import {mountQrSelectionEditor} from './qr-selection-editor-view.mjs';
import {PRIVATE_QR_SCALARS, preparePrivateQrSelection} from './qr-selection-contract.mjs';
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.textContent = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute() {}
    all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const tick = () => new Promise(setImmediate);
const snapshot = () => ({selection: preparePrivateQrSelection({nome: true, phones: ['phone']}, {contactPhones: [{id: 'phone'}]}),
    choices: [...PRIVATE_QR_SCALARS.map(key => ({key, label: key})), {key: 'phones', id: 'phone', label: 'Numero privato'}]});
test('checkbox selection sends identifiers only, unknown outcome offers retry and disposal clears labels', async () => {
    const root = new Node('root'), abort = new AbortController(); let sent, retries = 0, cleared = false;
    const cleanup = await mountQrSelectionEditor(root, {signal: abort.signal, assertUnlocked() {}}, {load: async () => snapshot(),
        createController({onState}) {return {save: async value => {sent = value; onState({status: 'unknown'});},
            retry: async () => {retries++; onState({status: 'saved'});}, dispose() {cleared = true;}};}});
    root.all('input')[0].checked = false;
    const buttons = root.all('button'); buttons[0].dispatchEvent(new Event('click')); await tick();
    assert.equal(sent.nome, false); assert.deepEqual(sent.phones, ['phone']); assert.doesNotMatch(JSON.stringify(sent), /Numero privato/);
    assert.equal(buttons[1].hidden, false); buttons[1].dispatchEvent(new Event('click')); await tick();
    assert.equal(retries, 1); assert.equal(root.all('p')[0].textContent, 'Selezione salvata.');
    const labels = root.all('span'), inputs = root.all('input'); abort.abort(); cleanup();
    assert.ok(cleared); assert.equal(root.children.length, 0); assert.ok(labels.every(node => node.textContent === ''));
    assert.ok(inputs.every(node => node.checked === false));
});
test('late load after abort never mounts private labels or creates a controller', async () => {
    const root = new Node('root'), abort = new AbortController(); let release, created = false;
    const pending = mountQrSelectionEditor(root, {signal: abort.signal, assertUnlocked() {}}, {
        load: () => new Promise(resolve => {release = resolve;}), createController() {created = true;}});
    const rejected = assert.rejects(pending); abort.abort(); release(snapshot()); await rejected;
    assert.equal(root.children.length, 0); assert.equal(created, false);
});
test('missing selected contact in choices cannot silently remove it from the saved selection', async () => {
    const value = snapshot(); value.choices.pop(); const root = new Node('root');
    await assert.rejects(mountQrSelectionEditor(root, {signal: new AbortController().signal, assertUnlocked() {}}, {
        load: async () => value, createController() {throw Error('must not create');}}), /INCOMPLETE_CHOICES/);
    assert.equal(root.children.length, 0);
});
