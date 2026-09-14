import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('./offline-save-panel.mjs', import.meta.url), 'utf8');
class Node {
    children = [];
    setAttribute() {}
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
}
const operation = {operationId: 'own-note', recordId: 'account-a'};
async function fixture({send, discard, onSaved = () => {}, onDiscarded = () => {}} = {}) {
    const realm = vm.createContext({structuredClone, document: {createElement: () => new Node()}});
    vm.runInContext(source.replace('export async function', 'async function'), realm);
    const root = new Node(), page = new AbortController(); let config;
    await realm.mountOfflineSavePanel(root, {signal: page.signal, onSaved, onDiscarded,
        prepare: async () => operation,
        createClient: async value => {
            config = value;
            return {close() {}, discard, enqueue: async () => send?.(config), flush: async () => send?.(config)};
        }});
    const [label, status, save, retry] = root.children[0].children;
    const input = label.children[0]; input.value = 'Synthetic note';
    const [, , , , keepOnline, confirm, cancel] = root.children[0].children;
    return {root, page, config, input, status, save, retry, keepOnline, confirm, cancel};
}

test('a different operation or record cannot confirm this editor', async () => {
    let refreshed = 0;
    const f = await fixture({onSaved: () => refreshed++, send: config => {
        config.onCommitted({operationId: 'other-note', recordId: operation.recordId});
        config.onCommitted({...operation, recordId: 'account-b'});
        config.onState({state: 'saved'});
    }});
    await f.save.onclick();
    assert.equal(refreshed, 0); assert.notEqual(f.status.textContent, 'Nota salvata.');
    f.page.abort();
});

test('own receipt refreshes once even if another queued operation conflicts later', async () => {
    let refreshed = 0;
    const f = await fixture({onSaved: () => refreshed++, send: async config => {
        await config.onCommitted(operation);
        await config.onCommitted(operation);
        config.onState({state: 'conflict'});
    }});
    await f.save.onclick();
    assert.equal(refreshed, 1); assert.equal(f.status.textContent, 'Nota salvata.');
    assert.equal(f.retry.hidden, true); assert.equal(f.save.disabled, true);
    f.page.abort();
});

test('offline acceptance does not refresh until own acknowledgement arrives', async () => {
    let refreshed = 0, online = false;
    const f = await fixture({onSaved: () => refreshed++, send: config => online ? config.onCommitted(operation) : config.onState({state: 'offline'})});
    await f.save.onclick(); assert.equal(refreshed, 0); assert.equal(f.retry.hidden, false);
    online = true; await f.retry.onclick();
    assert.equal(refreshed, 1); assert.equal(f.status.textContent, 'Nota salvata.');
    f.page.abort();
});

test('refresh failure preserves saved status without offering a second write', async () => {
    const f = await fixture({onSaved: async () => { throw new Error('READ_UNAVAILABLE'); }, send: config => config.onCommitted(operation)});
    await f.save.onclick();
    assert.match(f.status.textContent, /^Nota salvata\. Riapri/);
    assert.equal(f.retry.hidden, true); assert.equal(f.save.disabled, true);
    f.page.abort();
});

test('abort before receipt suppresses refresh and clears editor', async () => {
    let refreshed = 0;
    const f = await fixture({onSaved: () => refreshed++, send: async config => {
        f.page.abort(); await config.onCommitted(operation);
    }});
    await f.save.onclick();
    assert.equal(refreshed, 0); assert.equal(f.root.children.length, 0); assert.equal(f.input.value, '');
});

test('abort during refresh prevents late failure from changing detached status', async () => {
    let reject;
    const f = await fixture({onSaved: () => new Promise((_resolve, fail) => { reject = fail; }), send: config => { config.onCommitted(operation); }});
    const saving = f.save.onclick();
    while (!reject) await new Promise(resolve => setImmediate(resolve));
    f.page.abort(); reject(new Error('LATE_READ_FAILURE')); await saving;
    assert.equal(f.status.textContent, 'Nota salvata.'); assert.equal(f.root.children.length, 0);
});

test('own conflict requires explicit confirmation and cancellation preserves the queue', async () => {
    let discarded = 0, refreshed = 0;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        discard: async expected => { assert.deepEqual(expected, operation); discarded++; return {acquired: true}; },
        onDiscarded: () => refreshed++});
    await f.save.onclick(); assert.equal(f.keepOnline.hidden, false);
    await f.confirm.onclick(); assert.equal(discarded, 0);
    f.keepOnline.onclick(); f.cancel.onclick(); assert.equal(discarded, 0);
    f.keepOnline.onclick(); await f.confirm.onclick();
    assert.equal(discarded, 1); assert.equal(refreshed, 1);
    assert.match(f.status.textContent, /dati online sono invariati/); assert.equal(f.confirm.hidden, true);
    f.page.abort();
});

test('another account conflict cannot expose the discard action', async () => {
    let discarded = 0;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation: {...operation, recordId: 'other'}}),
        discard: async () => { discarded++; return {acquired: true}; }});
    await f.save.onclick(); f.keepOnline.onclick(); await f.confirm.onclick();
    assert.equal(f.keepOnline.hidden, true); assert.equal(discarded, 0);
    f.page.abort();
});

test('scope-review discard uses the marked snapshot and lock refusal never reports deletion', async () => {
    const held = {...operation, _queueState: 'reconciliation-required', _reviewReason: 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'};
    const f = await fixture({send: config => config.onState({state: 'reconciliation-required', operation: held}),
        discard: async expected => { assert.deepEqual(expected, held); return {acquired: false}; }});
    await f.save.onclick(); f.keepOnline.onclick(); await f.confirm.onclick();
    assert.match(f.status.textContent, /Eliminazione non confermata/);
    assert.equal(f.save.disabled, true); f.page.abort();
});

test('abort during discard suppresses late refresh and status', async () => {
    let resolve, refreshed = 0;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        discard: () => new Promise(done => { resolve = done; }), onDiscarded: () => refreshed++});
    await f.save.onclick(); f.keepOnline.onclick(); const pending = f.confirm.onclick();
    f.page.abort(); resolve({acquired: true}); await pending;
    assert.equal(refreshed, 0); assert.equal(f.root.children.length, 0);
});
