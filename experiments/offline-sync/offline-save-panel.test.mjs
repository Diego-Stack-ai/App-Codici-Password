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
async function fixture({send, onSaved = () => {}} = {}) {
    const realm = vm.createContext({document: {createElement: () => new Node()}});
    vm.runInContext(source.replace('export async function', 'async function'), realm);
    const root = new Node(), page = new AbortController(); let config;
    await realm.mountOfflineSavePanel(root, {signal: page.signal, onSaved,
        prepare: async () => operation,
        createClient: async value => {
            config = value;
            return {close() {}, enqueue: async () => send?.(config), flush: async () => send?.(config)};
        }});
    const [label, status, save, retry] = root.children[0].children;
    const input = label.children[0]; input.value = 'Synthetic note';
    return {root, page, config, input, status, save, retry};
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
