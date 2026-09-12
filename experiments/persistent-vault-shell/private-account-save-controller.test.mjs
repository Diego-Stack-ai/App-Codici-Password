import test from 'node:test';
import assert from 'node:assert/strict';
import {getEventListeners} from 'node:events';
import {createPrivateAccountSaveController} from './private-account-save-controller.mjs';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return {promise, resolve}; };
const tick = () => new Promise(resolve => setImmediate(resolve));
const input = () => ({uid: 'owner', domain: 'private', recordId: 'record', operationId: 'operation', deviceId: 'device', expectedRevision: 1,
    changes: {password: 'SYNTHETIC-PLAINTEXT'}});
const envelope = value => Object.freeze({schemaVersion: 1, operationId: value.operationId, recordId: value.recordId,
    deviceId: value.deviceId, expectedRevision: value.expectedRevision, record: Object.freeze({password: 'SYNTHETIC-CIPHERTEXT'})});
const applied = () => ({status: 'applied', revision: 2, duplicate: false});
const receipt = () => ({...applied(), domain: 'private-account', ownerUid: 'owner', recordId: 'record', deviceId: 'device', operationId: 'operation'});
function fixture(overrides = {}) {
    const abort = new AbortController(), states = [], sent = [], lookedUp = [];
    let user = {uid: 'owner'}, preparations = 0;
    const context = {user, signal: abort.signal, unlocked: true};
    const controller = createPrivateAccountSaveController({context, getUser: () => user,
        prepare: async value => { preparations++; return envelope(value); },
        submit: async value => { sent.push(value); return applied(); },
        lookupResult: async id => { lookedUp.push(id); return receipt(); },
        onState: value => states.push(value), ...overrides});
    return {controller, abort, states, sent, lookedUp, get preparations() { return preparations; },
        changeUser: value => { user = value; }};
}

test('one prepared operation reaches applied and the terminal controller never starts another save', async () => {
    const f = fixture(), result = await f.controller.save(input());
    assert.deepEqual(result, applied()); assert.equal(Object.isFrozen(result), true);
    assert.equal(f.preparations, 1); assert.equal(f.sent.length, 1);
    assert.deepEqual(f.states.map(value => value.status), ['preparing', 'submitting', 'applied']);
    await assert.rejects(f.controller.save({...input(), operationId: 'new'}), /SAVE_ALREADY_STARTED/);
    await assert.rejects(f.controller.retry(), /SAVE_NOT_UNKNOWN/);
    assert.doesNotMatch(JSON.stringify(f.states), /SYNTHETIC|password/);
});

test('an uncertain submission blocks new saves and retry uses the exact original envelope without preparing again', async () => {
    const sent = []; let attempts = 0;
    const f = fixture({submit: async value => { sent.push(value); if (++attempts === 1) throw new Error('SYNTHETIC secret response lost'); return {...applied(), duplicate: true}; }});
    assert.deepEqual(await f.controller.save(input()), {status: 'unknown'});
    await assert.rejects(f.controller.save(input()), /SAVE_ALREADY_STARTED/);
    assert.deepEqual(await f.controller.retry(), {...applied(), duplicate: true});
    assert.equal(f.preparations, 1); assert.equal(sent.length, 2); assert.equal(sent[0], sent[1]);
    assert.equal(sent[1].operationId, 'operation');
    assert.doesNotMatch(JSON.stringify(f.states), /SYNTHETIC|response lost/);
});

test('reconciliation confirms a bound receipt without submitting or encrypting again', async () => {
    let sends = 0;
    const f = fixture({submit: async () => { sends++; throw new Error('lost'); }});
    await f.controller.save(input());
    assert.deepEqual(await f.controller.reconcile(), applied());
    assert.equal(f.preparations, 1); assert.equal(sends, 1); assert.deepEqual(f.lookedUp, ['operation']);
});

test('absent, malformed, mismatched or failed reconciliation remains unknown', async () => {
    for (const value of [null, undefined, {}, {...receipt(), ownerUid: 'other'}, {...receipt(), recordId: 'other'},
        {...receipt(), domain: 'other'}, {...receipt(), operationId: 'other'}, {...receipt(), operationId: undefined}, {...receipt(), revision: 1},
        {...receipt(), revision: 3}, {...receipt(), revision: -1}, {...receipt(), revision: 1.5},
        {...receipt(), status: 'saved'}, {...receipt(), duplicate: 'true'}, {status: 'applied', revision: 2},
        {...receipt(), deviceId: 'other-device'}, {...receipt(), deviceId: undefined}, {...receipt(), status: 'conflict', currentRevision: 3}]) {
        const f = fixture({submit: async () => { throw new Error('lost'); }, lookupResult: async () => value});
        await f.controller.save(input());
        assert.deepEqual(await f.controller.reconcile(), {status: 'unknown'});
    }
    const f = fixture({submit: async () => { throw new Error('lost'); }, lookupResult: async () => { throw new Error('SYNTHETIC'); }});
    await f.controller.save(input()); assert.deepEqual(await f.controller.reconcile(), {status: 'unknown'});
});

test('conflict is terminal and never changes revision or retries automatically', async () => {
    const f = fixture({submit: async () => ({status: 'conflict', currentRevision: 7, duplicate: false})});
    assert.deepEqual(await f.controller.save(input()), {status: 'conflict', currentRevision: 7});
    await assert.rejects(f.controller.retry(), /SAVE_NOT_UNKNOWN/);
    await assert.rejects(f.controller.save({...input(), expectedRevision: 7}), /SAVE_ALREADY_STARTED/);
    assert.equal(f.preparations, 1);
});

test('invalid submission results cannot claim success or conflict', async () => {
    for (const result of [null, {}, {...applied(), revision: 0}, {...applied(), revision: 3}, {...applied(), ownerUid: 'other'},
        {...applied(), revision: Infinity}, {...applied(), duplicate: 'yes'}, {...applied(), deviceId: 'other-device'}, {status: 'conflict', currentRevision: -1},
        {status: 'conflict', currentRevision: 1.2}]) {
        const f = fixture({submit: async () => result});
        assert.deepEqual(await f.controller.save(input()), {status: 'unknown'});
    }
});

test('double saves and concurrent retries or reconciliations are rejected', async () => {
    const prepared = deferred(), f = fixture({prepare: () => prepared.promise});
    const save = f.controller.save(input());
    await assert.rejects(f.controller.save(input()), /SAVE_BUSY/);
    prepared.resolve(envelope(input())); await save;
    const pending = deferred(), g = fixture({submit: async () => { throw new Error('lost'); }, lookupResult: () => pending.promise});
    await g.controller.save(input()); const reconcile = g.controller.reconcile();
    await assert.rejects(g.controller.retry(), /SAVE_BUSY/);
    await assert.rejects(g.controller.reconcile(), /SAVE_BUSY/);
    pending.resolve(null); await reconcile;
});

test('invalid input and preparation errors never submit and expose only fixed error codes', async () => {
    const f = fixture();
    for (const change of [{uid: 'other'}, {domain: 'company'}, {recordId: '../bad'}, {operationId: ''}, {deviceId: 'bad/path'},
        {expectedRevision: -1}, {expectedRevision: Number.MAX_SAFE_INTEGER}]) {
        await assert.rejects(f.controller.save({...input(), ...change}), {message: 'SAVE_INPUT_INVALID'});
    }
    assert.equal(f.sent.length, 0); assert.equal(f.preparations, 0);
    const g = fixture({prepare: async () => { throw new Error('SYNTHETIC-PLAINTEXT'); }});
    await assert.rejects(g.controller.save(input()), {message: 'SAVE_PREPARATION_FAILED'});
    assert.equal(g.sent.length, 0);
    for (const wrong of [{...envelope(input())}, envelope({...input(), operationId: 'other'}), envelope({...input(), expectedRevision: 8})]) {
        const h = fixture({prepare: async () => wrong});
        await assert.rejects(h.controller.save(input()), /SAVE_PREPARATION_FAILED/); assert.equal(h.sent.length, 0);
    }
});

for (const boundary of ['abort', 'dispose', 'uid-change']) {
    test(`${boundary} during preparation detaches without any submission or late state callback`, async () => {
        const pending = deferred(), f = fixture({prepare: () => pending.promise});
        const result = f.controller.save(input()); await tick();
        if (boundary === 'abort') f.abort.abort(); else if (boundary === 'dispose') f.controller.dispose(); else f.changeUser({uid: 'other'});
        const count = f.states.length;
        pending.resolve(envelope(input()));
        assert.deepEqual(await result, {status: 'detached'});
        assert.equal(f.sent.length, 0); assert.equal(f.states.length, count);
        await assert.rejects(f.controller.save(input()), /VIEW_DISPOSED/);
    });
    test(`${boundary} after submission cannot cancel the commit but suppresses late success`, async () => {
        const pending = deferred(); let committed = 0;
        const f = fixture({submit: async () => { const result = await pending.promise; committed++; return result; }});
        const result = f.controller.save(input()); await tick();
        if (boundary === 'abort') f.abort.abort(); else if (boundary === 'dispose') f.controller.dispose(); else f.changeUser(null);
        const count = f.states.length;
        pending.resolve(applied());
        assert.deepEqual(await result, {status: 'detached'}); assert.equal(committed, 1); assert.equal(f.states.length, count);
        await assert.rejects(f.controller.retry(), /VIEW_DISPOSED/);
    });
}

test('closing a view from the submitting callback is detected immediately before the network dependency', async () => {
    let controller, submitted = 0;
    const abort = new AbortController();
    controller = createPrivateAccountSaveController({context: {user: {uid: 'owner'}, unlocked: true, signal: abort.signal}, getUser: () => ({uid: 'owner'}),
        prepare: async value => envelope(value), submit: async () => { submitted++; return applied(); }, lookupResult: async () => null,
        onState: value => { if (value.status === 'submitting') controller.dispose(); }});
    assert.deepEqual(await controller.save(input()), {status: 'detached'}); assert.equal(submitted, 0);
    assert.equal(getEventListeners(abort.signal, 'abort').length, 0);
});

test('UI callback errors cannot turn an applied commit into an unknown result', async () => {
    const f = fixture({onState: () => { throw new Error('SYNTHETIC'); }});
    assert.deepEqual(await f.controller.save(input()), applied());
});

test('a shallow-frozen preparation cannot leave mutable nested data available to a retry', async () => {
    const sharedWith = {};
    const value = Object.freeze({...envelope(input()), record: Object.freeze({password: 'SYNTHETIC-CIPHERTEXT', sharedWith})});
    const f = fixture({prepare: async () => value});
    await assert.rejects(f.controller.save(input()), /SAVE_PREPARATION_FAILED/);
    assert.equal(f.sent.length, 0);
    sharedWith.other = 'changed';
    await assert.rejects(f.controller.retry(), /SAVE_NOT_UNKNOWN/);
});

test('a deeply frozen nested preparation remains exactly the same across retries', async () => {
    const value = Object.freeze({...envelope(input()), record: Object.freeze({password: 'SYNTHETIC-CIPHERTEXT', sharedWith: Object.freeze({}), banking: Object.freeze([])})});
    const sent = [];
    const f = fixture({prepare: async () => value, submit: async item => { sent.push(item); throw new Error('lost'); }});
    assert.deepEqual(await f.controller.save(input()), {status: 'unknown'});
    assert.throws(() => { value.record.sharedWith.other = 'changed'; }, TypeError);
    await f.controller.retry(); assert.equal(sent[0], sent[1]);
});

test('abort during reconciliation suppresses a late receipt and removes the abort listener', async () => {
    const pending = deferred(), f = fixture({submit: async () => { throw new Error('lost'); }, lookupResult: () => pending.promise});
    await f.controller.save(input()); const result = f.controller.reconcile();
    f.abort.abort(); const count = f.states.length;
    pending.resolve(receipt()); assert.deepEqual(await result, {status: 'detached'});
    assert.equal(f.states.length, count); assert.equal(getEventListeners(f.abort.signal, 'abort').length, 0);
});

test('preparation always receives the controller context rather than a caller-supplied encryption context', async () => {
    let preparedContext;
    const fakeContext = {user: {uid: 'owner'}, encrypt: async () => 'wrong-key-ciphertext'};
    const f = fixture({prepare: async value => { preparedContext = value.context; return envelope(value); }});
    assert.deepEqual(await f.controller.save({...input(), context: fakeContext}), applied());
    assert.notEqual(preparedContext, fakeContext);
    assert.equal(preparedContext.signal, f.abort.signal);
    assert.equal(preparedContext.user.uid, 'owner');
});
