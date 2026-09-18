import test from 'node:test';
import assert from 'node:assert/strict';
import {createQrSelectionSaveController} from './qr-selection-save-controller.mjs';
import {preparePrivateQrSelection} from './qr-selection-contract.mjs';
function fixture({submit, prepare, onState} = {}) {
    let uid = 'owner', locked = false; const abort = new AbortController(), sent = [], states = [];
    const config = preparePrivateQrSelection({nome: true}, {});
    const controller = createQrSelectionSaveController({context: {user: {uid}, signal: abort.signal,
        assertUnlocked() {if (locked) throw Error('LOCKED');}}, getUser: () => ({uid}),
        prepare: prepare || (async () => ({selection: config, expectedRevision: 3})),
        submit: async request => {sent.push(request); return submit ? submit(request) : {status: 'confirmed', revision: 4};},
        createOperationId: () => 'same-id', onState: value => {states.push(value.status); onState?.(value);}});
    return {controller, config, sent, states, abort, lock() {locked = true;}, change() {uid = 'other';}};
}
test('unknown result can only retry the exact immutable operation', async () => {
    let first = true; const f = fixture({submit: async () => {if (first) {first = false; throw Error('NETWORK');} return {status: 'confirmed', revision: 4};}});
    assert.equal((await f.controller.save(f.config)).status, 'unknown');
    await assert.rejects(f.controller.save(f.config), /SAVE_NOT_IDLE/);
    assert.equal((await f.controller.retry()).status, 'saved');
    assert.equal(f.sent[0], f.sent[1]); assert.ok(Object.isFrozen(f.sent[0]));
    await assert.rejects(f.controller.retry(), /RETRY_UNAVAILABLE/);
});
for (const boundary of ['lock', 'change', 'abort']) test(`late preparation does not submit after ${boundary}`, async () => {
    let release; const f = fixture({prepare: () => new Promise(resolve => {release = resolve;})});
    const pending = f.controller.save(f.config);
    if (boundary === 'abort') f.abort.abort(); else f[boundary]();
    release({selection: f.config, expectedRevision: 3});
    assert.equal((await pending).status, 'detached'); assert.equal(f.sent.length, 0);
});
test('late backend confirmation is detached after disposal, not displayed as saved', async () => {
    let release; const f = fixture({submit: () => new Promise(resolve => {release = resolve;})});
    const pending = f.controller.save(f.config); await new Promise(setImmediate);
    f.controller.dispose(); release({status: 'confirmed', revision: 4});
    assert.equal((await pending).status, 'detached'); assert.ok(!f.states.includes('saved'));
});
test('unexpected server revision stays unknown and prevents a second operation', async () => {
    const f = fixture({submit: async () => ({status: 'confirmed', revision: 99})});
    assert.equal((await f.controller.save(f.config)).status, 'unknown');
    await assert.rejects(f.controller.save(f.config));
});
