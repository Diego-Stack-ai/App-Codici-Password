import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createPrivateNotePanelProvider} from './private-note-panel-provider.mjs';
const cipher = value => Buffer.from(`synthetic-ciphertext-fixture:${value}`).toString('base64');
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
function fixture(overrides = {}) {
    const page = new AbortController(), view = new AbortController();
    let uid = 'fixture-user', panel, callbacks, closed = 0, removed = 0, sent = [], next = 0;
    const source = {id: 'fixture', ownerId: uid, schemaVersion: 1, revision: 3,
        type: 'account', visibility: 'private', _encrypted: true, nomeAccount: 'Existing title', url: 'https://example.invalid',
        username: cipher('user'), account: cipher('code'), password: cipher('password'), note: cipher('note'),
        isBanking: false, banking: [], sharedWith: {}, sharedWithUids: [], acceptedCount: 0,
        createdAt: {seconds: 123, nanoseconds: 456}};
    const context = {user: {uid}, signal: page.signal, unlocked: true,
        encrypt: async value => cipher(value), read: async record => Buffer.from(record.ciphertext, 'base64').toString().split(':').slice(1).join(':')};
    const queue = {close: () => closed++, flush: async () => {}, pendingForRecord: async () => ({acquired: true, value: null}),
        enqueue: async operation => { sent.push(operation); }, discard: async () => {}, replace: async () => {}};
    const provider = createPrivateNotePanelProvider({context, getUser: () => ({uid}),
        readSource: async () => ({source, hasProfileLink: false}), deviceId: 'device', newOperationId: () => `note-${++next}`,
        openQueue: async options => { callbacks = options; return queue; },
        mountPanel: async (root, options) => { panel = options; return () => removed++; }, ...overrides});
    return {source, context, page, view, queue, get panel() { return panel; }, get callbacks() { return callbacks; },
        get closed() { return closed; }, get removed() { return removed; }, sent, change: () => { uid = 'other'; },
        mount: (root = {}, options = {}) => provider(root, {selection: {domain: 'private', id: 'fixture'}, signal: view.signal, ...options})};
}

test('prepares only the note against the displayed revision and scopes all mutations to the selected account', async () => {
    const f = fixture(), close = await f.mount();
    assert.equal(f.panel.initialNote, 'note');
    f.source.revision = 8; f.source.password = cipher('new-online-password');
    const operation = await f.panel.prepare('new note');
    assert.equal(operation.expectedRevision, 3); assert.equal(operation.record.password, cipher('password'));
    assert.equal(operation.record.note, cipher('new note'));
    const client = await f.panel.createClient({onState() {}, onCommitted() {}});
    await client.enqueue(operation); assert.equal(f.sent.length, 1);
    assert.throws(() => client.enqueue(structuredClone(operation)), /UNPREPARED/);
    assert.throws(() => client.discard({...operation, recordId: 'other'}), /SCOPE/);
    assert.throws(() => client.pendingForRecord('other'), /SCOPE/);
    close(); assert.equal(f.closed, 1); assert.equal(f.removed, 1);
});

test('real panel submits the prepared note and refreshes only after the matching queue receipt', async () => {
    class Node {
        children = [];
        setAttribute() {}
        append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this); }
    }
    const realm = vm.createContext({structuredClone, document: {createElement: () => new Node()}});
    const code = await readFile(new URL('../offline-sync/offline-save-panel.mjs', import.meta.url), 'utf8');
    vm.runInContext(code.replace('export async function', 'async function'), realm);
    const f = fixture({mountPanel: realm.mountOfflineSavePanel}), root = new Node(); let refreshed = 0;
    const close = await f.mount(root, {onSaved: () => refreshed++});
    const [label, status, save] = root.children[0].children;
    label.children[0].value = 'Note from panel';
    f.queue.enqueue = async operation => {
        assert.equal(operation.record.note, cipher('Note from panel'));
        await f.callbacks.onCommitted({...operation, recordId: 'other'}); assert.equal(refreshed, 0);
        await f.callbacks.onCommitted(operation);
    };
    await save.onclick(); assert.equal(refreshed, 1); assert.equal(status.textContent, 'Nota salvata.');
    close(); assert.equal(root.children.length, 0); assert.equal(f.closed, 1);
});

test('unknown reverse-link evidence or another owner stops before mounting', async () => {
    for (const hasProfileLink of [undefined, true]) {
        const f = fixture({readSource: async () => ({source: {id: 'fixture', ownerId: 'fixture-user'}, hasProfileLink})});
        await assert.rejects(f.mount()); assert.equal(f.panel, undefined);
    }
    const f = fixture({readSource: async () => ({source: {id: 'fixture', ownerId: 'other'}, hasProfileLink: false})});
    await assert.rejects(f.mount(), /SCOPE/);
});

for (const boundary of ['page', 'view', 'identity']) test(`${boundary} suppresses queue callbacks and retained actions`, async () => {
    const f = fixture(); await f.mount(); let events = 0;
    const client = await f.panel.createClient({onState: () => events++, onCommitted: () => events++});
    if (boundary === 'identity') f.change(); else f[boundary].abort();
    f.callbacks.onState({state: 'saved'}); f.callbacks.onCommitted({recordId: 'fixture'});
    await assert.rejects(client.flush(), /INACTIVE/);
    assert.equal(events, 0); assert.equal(f.closed, 1); assert.equal(f.removed, 1);
});

test('late source and late queue never reach a closed view', async () => {
    const gate = deferred(), f = fixture({readSource: () => gate.promise});
    const opening = f.mount(); f.view.abort(); gate.resolve({source: f.source, hasProfileLink: false});
    await assert.rejects(opening, /INACTIVE/); assert.equal(f.panel, undefined);
    const queueGate = deferred(), g = fixture({openQueue: () => queueGate.promise}); await g.mount();
    const client = g.panel.createClient({onState() {}, onCommitted() {}}); g.page.abort(); queueGate.resolve(g.queue);
    await assert.rejects(client, /INACTIVE/); assert.equal(g.closed, 1);
});

test('a late queue read is rejected after identity changes without an Auth notification', async () => {
    const f = fixture(); await f.mount(); const gate = deferred(); f.queue.pendingForRecord = () => gate.promise;
    const client = await f.panel.createClient({onState() {}, onCommitted() {}});
    const reading = client.pendingForRecord('fixture'); f.change(); gate.resolve({private: 'metadata'});
    await assert.rejects(reading, /INACTIVE/); assert.equal(f.closed, 1);
});

test('only the exact prepared command supports note reproposal; recovered or altered commands allow comparison only', async () => {
    const f = fixture(); await f.mount(); const operation = await f.panel.prepare('local');
    f.source.revision = 4; f.source.note = cipher('online');
    const proposal = await f.panel.createConflictProposal(structuredClone(operation));
    assert.equal(proposal.comparison.localNote, 'local'); assert.equal(proposal.comparison.onlineNote, 'online');
    const replacement = await proposal.prepareReplacement({confirmed: true});
    assert.equal(replacement.expectedRevision, 4); assert.notEqual(replacement.operationId, operation.operationId);
    assert.equal(await f.panel.createConflictProposal(operation), null);
    assert.equal(await f.panel.createConflictProposal({...replacement, record: {...replacement.record, password: cipher('altered')}}), null);
    const g = fixture(); await g.mount(); assert.equal(await g.panel.createConflictProposal(operation), null);
    assert.equal((await g.panel.readConflict(operation)).localNote, 'local');
    proposal.close(); f.page.abort(); g.page.abort();
});

test('incompatible source is rejected before mounting an editor or preparing encryption', async () => {
    const f = fixture(); delete f.source.schemaVersion;
    await assert.rejects(f.mount(), /PREPARATION_INVALID/); assert.equal(f.panel, undefined);
});

test('offline mount skips server evidence and remains recovery-only even after the network returns', async () => {
    let online = false, reads = 0;
    const f = fixture({isOnline: () => online, readSource: async () => { reads++; throw new Error('OFFLINE'); }});
    const close = await f.mount(); assert.equal(reads, 0); assert.equal(f.panel.recoveryOnly, true); assert.equal(f.panel.initialNote, '');
    online = true; await assert.rejects(f.panel.prepare('new draft'), /RECOVERY_ONLY/); assert.equal(reads, 0); close();
});

test('a failed online server check is not silently treated as offline evidence', async () => {
    const f = fixture({isOnline: () => true, readSource: async () => { throw new Error('PERMISSION_DENIED'); }});
    await assert.rejects(f.mount(), /PERMISSION_DENIED/); assert.equal(f.panel, undefined);
});

test('explicit online recovery never reads incompatible source or prepares a new full-record mutation', async () => {
    let reads = 0;
    const f = fixture({isOnline: () => true, readSource: async () => {reads++; throw Error('PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED');}});
    const close = await f.mount({}, {recoveryOnly: true});
    assert.equal(reads, 0); assert.equal(f.panel.recoveryOnly, true); assert.equal(f.panel.initialNote, '');
    await assert.rejects(f.panel.prepare('new note'), /RECOVERY_ONLY/); assert.equal(reads, 0);
    close();
});

test('ambiguous recovery mode cannot activate the old provider', async () => {
    const f = fixture(); await assert.rejects(f.mount({}, {recoveryOnly: 'true'}), /SCOPE/); assert.equal(f.panel, undefined);
});
