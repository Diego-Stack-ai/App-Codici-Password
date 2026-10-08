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
async function fixture({send, discard, replace, readConflict, createConflictProposal, pendingForRecord, recoveryRecordId, recoveryOnly,
    prepare = async () => operation, onSaved = () => {}, onDiscarded = () => {}} = {}) {
    const realm = vm.createContext({structuredClone, document: {createElement: () => new Node()}});
    vm.runInContext(source.replace('export async function', 'async function'), realm);
    const root = new Node(), page = new AbortController(); let config;
    await realm.mountOfflineSavePanel(root, {signal: page.signal, onSaved, onDiscarded, readConflict, createConflictProposal,
        prepare, recoveryRecordId, recoveryOnly,
        createClient: async value => {
            config = value;
            return {close() {}, discard, replace, pendingForRecord, enqueue: async () => send?.(config), flush: async () => send?.(config)};
        }});
    const [label, status, save, retry] = root.children[0].children;
    const input = label.children[0]; if (!input.readOnly) input.value = 'Synthetic note';
    const [, , , , keepOnline, confirm, cancel] = root.children[0].children;
    const compare = root.children[0].children[7], comparison = root.children[0].children[8];
    const propose = root.children[0].children[9], confirmProposal = root.children[0].children[10], cancelProposal = root.children[0].children[11];
    return {root, page, config, input, status, save, retry, keepOnline, confirm, cancel, compare, comparison, propose, confirmProposal, cancelProposal};
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

test('reopened editor resumes the existing identity only after explicit retry', async () => {
    let prepares = 0, sends = 0, refreshed = 0;
    const f = await fixture({recoveryRecordId: operation.recordId,
        pendingForRecord: async id => { assert.equal(id, operation.recordId); return {acquired: true, value: operation}; },
        prepare: () => { prepares++; throw new Error('SECOND_OPERATION'); },
        send: config => { sends++; config.onCommitted(operation); }, onSaved: () => refreshed++});
    assert.equal(sends, 0); assert.equal(prepares, 0); assert.equal(refreshed, 0);
    assert.equal(f.save.disabled, true); assert.equal(f.input.readOnly, true); assert.equal(f.input.value, '');
    assert.equal(f.retry.hidden, false);
    await f.retry.onclick();
    assert.equal(sends, 1); assert.equal(prepares, 0); assert.equal(refreshed, 1);
    assert.equal(f.status.textContent, 'Nota salvata.'); f.page.abort();
});

test('reopened reconciliation keeps explicit compare and discard choices', async () => {
    const marked = {...operation, _queueState: 'reconciliation-required', _reviewReason: 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'};
    const f = await fixture({recoveryRecordId: operation.recordId,
        pendingForRecord: async () => ({acquired: true, value: operation}),
        send: config => config.onState({state: 'reconciliation-required', operation: marked})});
    await f.retry.onclick();
    assert.equal(f.keepOnline.hidden, false); assert.equal(f.confirm.hidden, true);
    assert.equal(f.save.disabled, true); assert.match(f.status.textContent, /modifica completa/); f.page.abort();
});

test('unavailable or mismatched recovery never opens a second editor', async () => {
    for (const result of [{acquired: false}, {acquired: true}, {acquired: true, value: {...operation, recordId: 'other'}}]) {
        const f = await fixture({recoveryRecordId: operation.recordId, pendingForRecord: async () => result});
        assert.equal(f.save.disabled, true); assert.equal(f.input.readOnly, true);
        assert.equal(f.retry.hidden, true); assert.equal(f.save.onclick, undefined);
        assert.match(f.status.textContent, /coda locale è conservata/); f.page.abort();
    }
});

test('verified empty recovery permits a new note', async () => {
    let prepares = 0;
    const f = await fixture({recoveryRecordId: operation.recordId,
        pendingForRecord: async () => ({acquired: true, value: null}),
        prepare: async () => { prepares++; return operation; }});
    assert.equal(f.save.disabled, false); await f.save.onclick(); assert.equal(prepares, 1); f.page.abort();
});

test('page closed during pending inspection cannot reopen or retain the client', async () => {
    const realm = vm.createContext({structuredClone, document: {createElement: () => new Node()}});
    vm.runInContext(source.replace('export async function', 'async function'), realm);
    const root = new Node(), page = new AbortController(); let resolve, closed = 0;
    const opening = realm.mountOfflineSavePanel(root, {signal: page.signal, recoveryRecordId: operation.recordId,
        prepare: () => { throw new Error('NOT_ALLOWED'); }, createClient: async () => ({
            pendingForRecord: () => new Promise(done => { resolve = done; }), close: () => closed++})});
    while (!resolve) await new Promise(done => setImmediate(done));
    page.abort(); resolve({acquired: true, value: operation}); await opening;
    assert.equal(root.children.length, 0); assert.equal(closed, 1);
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

test('comparison displays literal text, does not discard and clears on abort', async () => {
    let discarded = 0;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        discard: async () => discarded++, readConflict: async () => ({localNote: '<script>literal</script>', onlineNote: 'Online'})});
    await f.save.onclick(); await f.compare.onclick();
    assert.equal(f.comparison.hidden, false); assert.equal(f.comparison.children[1].textContent, '<script>literal</script>');
    assert.equal(discarded, 0); f.page.abort(); assert.equal(f.comparison.children[1].textContent, '');
});
test('comparison arriving after abort cannot restore plaintext', async () => {
    let resolve;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        readConflict: () => new Promise(done => { resolve = done; })});
    await f.save.onclick(); const pending = f.compare.onclick(); f.page.abort();
    resolve({localNote: 'Late local', onlineNote: 'Late online'}); await pending;
    assert.equal(f.comparison.hidden, true); assert.equal(f.comparison.children[1].textContent, '');
});

test('confirmed note proposal atomically replaces the compared command with its stable identity', async () => {
    const replacement = {operationId: 'replacement-note', recordId: operation.recordId, expectedRevision: 7};
    let confirmations = 0, replacements = 0, closed = 0;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        createConflictProposal: async expected => {
            assert.deepEqual(expected, operation);
            return {comparison: {localNote: 'Local', onlineNote: 'Online', onlineRevision: 7}, close: () => closed++,
                prepareReplacement: async ({confirmed}) => { assert.equal(confirmed, true); confirmations++; return replacement; }};
        },
        replace: async (expected, next) => { assert.deepEqual(expected, operation); assert.deepEqual(next, replacement); replacements++; return {state: 'offline'}; }});
    await f.save.onclick(); await f.compare.onclick();
    assert.equal(f.propose.hidden, false); f.propose.onclick(); f.cancelProposal.onclick();
    assert.equal(replacements, 0); f.propose.onclick(); await f.confirmProposal.onclick();
    assert.equal(confirmations, 1); assert.equal(replacements, 1); assert.equal(closed, 1);
    assert.match(f.status.textContent, /Nota riproposta/); assert.equal(f.comparison.children[1].textContent, '');
    f.page.abort();
});

test('failed replacement preserves the conflict and requires a fresh comparison', async () => {
    let closed = 0;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        createConflictProposal: async () => ({comparison: {localNote: 'Local', onlineNote: 'Online', onlineRevision: 7},
            close: () => closed++, prepareReplacement: async () => ({operationId: 'replacement-note', recordId: operation.recordId})}),
        replace: async () => ({acquired: false, replacementApplied: false})});
    await f.save.onclick(); await f.compare.onclick(); f.propose.onclick(); await f.confirmProposal.onclick();
    assert.match(f.status.textContent, /non confermata/); assert.equal(f.keepOnline.hidden, false);
    assert.equal(f.propose.hidden, true); assert.equal(f.confirmProposal.hidden, true);
    f.page.abort(); assert.equal(closed, 1);
});

test('late proposal is closed without reading plaintext after page abort', async () => {
    let resolve, closed = 0;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        createConflictProposal: () => new Promise(done => { resolve = done; })});
    await f.save.onclick(); const pending = f.compare.onclick(); f.page.abort();
    resolve({close: () => closed++, get comparison() { assert.fail('late plaintext accessed'); }});
    await pending; assert.equal(closed, 1); assert.equal(f.root.children.length, 0);
});

test('discarding a reviewed conflict closes the proposal and hides all proposal actions', async () => {
    let closed = 0;
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        createConflictProposal: async () => ({comparison: {localNote: 'Local', onlineNote: 'Online'}, close: () => closed++}),
        discard: async () => ({acquired: true})});
    await f.save.onclick(); await f.compare.onclick(); f.propose.onclick();
    f.keepOnline.onclick(); await f.confirm.onclick();
    assert.equal(closed, 1); assert.equal(f.propose.hidden, true); assert.equal(f.confirmProposal.hidden, true);
    assert.equal(f.cancelProposal.hidden, true); f.page.abort(); assert.equal(closed, 1);
});

for (const mode of ['flush-lock-refused', 'uncertain-transaction']) {
    test(`replacement identity survives ${mode} and retry accepts only its receipt`, async () => {
        let retrying = false, refreshed = 0, replacements = 0;
        const replacement = {operationId: 'replacement-note', recordId: operation.recordId};
        const f = await fixture({onSaved: () => refreshed++,
            send: async config => {
                if (!retrying) config.onState({state: 'conflict', operation});
                else {
                    await config.onCommitted(operation); assert.equal(refreshed, 0);
                    await config.onCommitted(replacement);
                }
            },
            createConflictProposal: async () => ({comparison: {localNote: 'Local', onlineNote: 'Online'}, close() {},
                prepareReplacement: async () => replacement}),
            replace: async () => {
                replacements++;
                if (mode === 'uncertain-transaction') throw new Error('LEASE_LOST_AFTER_COMMIT');
                return {acquired: false, replacementApplied: true};
            }});
        await f.save.onclick(); await f.compare.onclick(); f.propose.onclick(); await f.confirmProposal.onclick();
        assert.equal(f.keepOnline.hidden, true); assert.equal(f.confirmProposal.hidden, true); assert.equal(f.retry.hidden, false);
        retrying = true; await f.retry.onclick(); assert.equal(refreshed, 1); assert.equal(replacements, 1);
        assert.equal(f.status.textContent, 'Nota salvata.'); f.page.abort();
    });
}

test('recovered command with no proven note-only proposal retains comparison without replacement controls', async () => {
    const f = await fixture({send: config => config.onState({state: 'conflict', operation}),
        createConflictProposal: async () => null,
        readConflict: async () => ({localNote: 'local', onlineNote: 'online'})});
    await f.save.onclick(); await f.compare.onclick();
    assert.equal(f.comparison.hidden, false); assert.equal(f.propose.hidden, true);
    assert.equal(f.confirmProposal.hidden, true); f.page.abort();
});

test('offline recovery with an empty queue cannot prepare or send a new mutation', async () => {
    let writes = 0;
    const f = await fixture({recoveryOnly: true, recoveryRecordId: operation.recordId,
        pendingForRecord: async () => ({acquired: true, value: null}), prepare: async () => { writes++; return operation; }, send: () => writes++});
    assert.equal(f.save.hidden, true); assert.equal(f.save.disabled, true); assert.equal(f.input.readOnly, true);
    assert.match(f.status.textContent, /Nessuna modifica in attesa/); assert.equal(f.retry.hidden, true);
    await f.save.onclick(); await f.retry.onclick(); assert.equal(writes, 0); f.page.abort();
});

test('offline recovery keeps existing identity and sends only on explicit retry', async () => {
    let sent = 0, prepared = 0;
    const f = await fixture({recoveryOnly: true, recoveryRecordId: operation.recordId,
        pendingForRecord: async () => ({acquired: true, value: operation}), prepare: async () => { prepared++; return operation; },
        send: config => { sent++; config.onCommitted(operation); }});
    assert.equal(sent, 0); assert.equal(f.save.hidden, true); assert.equal(f.input.readOnly, true);
    await f.retry.onclick(); assert.equal(sent, 1); assert.equal(prepared, 0);
    assert.equal(f.status.textContent, 'Nota salvata.'); f.page.abort();
});
