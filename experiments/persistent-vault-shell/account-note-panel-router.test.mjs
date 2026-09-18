import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountNotePanelRouter} from './account-note-panel-router.mjs';
const tick = () => new Promise(resolve => setImmediate(resolve));
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    setAttribute(key, value) {this.attributes[key] = value;}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
function fixture(company = false) {
    const abort = new AbortController(), root = new Node('root'), calls = [];
    const state = {uid: 'owner', online: true, pending: null, present: true, legacyError: 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED', editor: null, disposed: 0};
    const selection = company ? {domain: 'company', companyId: 'firm', id: 'account'} : {domain: 'private', id: 'account'};
    const context = {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {}};
    const options = {context, getUser: () => ({uid: state.uid}), isOnline: () => state.online,
        openQueue: async () => ({pendingForRecord: async () => ({acquired: true, value: state.pending}), close() {calls.push('queue-close');}}),
        legacyProvider: async (root, value) => {calls.push(value); if (state.legacyError && !value.recoveryOnly) throw Error(state.legacyError); return () => calls.push('legacy-close');},
        mountEditor: async (root, context, options) => {state.editor = options; return () => state.disposed++;}};
    const boundary = {signal: abort.signal, selection, hasNote: () => state.present, onSaved: async () => {state.present = false; calls.push('refresh');}, onDiscarded() {}};
    return {root, state, calls, abort, options, boundary, mount: () => createAccountNotePanelRouter(options)(root, boundary)};
}
test('pending private command selects recovery-only even online and never the new editor', async () => {
    const f = fixture(); f.state.pending = {recordId: 'account', operationId: 'op'}; const close = await f.mount();
    assert.equal(f.calls[1].recoveryOnly, true); assert.equal(f.state.editor, null); assert.equal(f.root.children.length, 0); close();
});
test('isolated supported account retains the old editor and queue behavior', async () => {
    const f = fixture(); f.state.legacyError = null; const close = await f.mount();
    assert.equal(f.calls[1], f.boundary); assert.equal(f.state.editor, null); close();
});
test('new note action follows presence, refresh and cancellation without exposing a full writer', async () => {
    const f = fixture(), close = await f.mount(), button = f.root.all('button')[0];
    assert.equal(button.textContent, '✎'); assert.equal(button.attributes['aria-label'], 'Modifica nota');
    button.dispatchEvent(new Event('click')); await tick(); assert.equal(button.hidden, true);
    assert.equal(await f.state.editor.assertNoPendingMutation({uid: 'owner', account: f.boundary.selection, signal: f.abort.signal}), true);
    await f.state.editor.onSaved(); assert.equal(button.textContent, 'Aggiungi nota'); assert.equal(button.hidden, false);
    button.dispatchEvent(new Event('click')); await tick(); f.state.editor.onCancel(); assert.equal(button.hidden, false);
    close(); assert.equal(button.textContent, ''); assert.equal(f.root.children.length, 0);
});
test('permission and network failures do not fall through into a different editor', async () => {
    const f = fixture(); f.state.legacyError = 'PERMISSION_DENIED'; await assert.rejects(f.mount(), /PERMISSION_DENIED/);
    assert.equal(f.state.editor, null); assert.equal(f.root.children.length, 0);
});
test('late note editor initialization is cleaned after route revocation', async () => {
    const f = fixture(); let release; f.options.mountEditor = () => new Promise(resolve => {release = resolve;});
    await f.mount(); f.root.all('button')[0].dispatchEvent(new Event('click')); await tick();
    f.abort.abort(); release(() => f.state.disposed++); await tick();
    assert.equal(f.state.disposed, 1); assert.equal(f.root.children.length, 0);
});
test('company note actions do not activate the private queue or legacy editor', async () => {
    const f = fixture(true), close = await f.mount(); assert.deepEqual(f.calls, []);
    f.root.all('button')[0].dispatchEvent(new Event('click')); await tick(); assert.equal(f.state.editor.account.companyId, 'firm'); close();
});
