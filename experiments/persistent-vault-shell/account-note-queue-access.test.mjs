import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountNoteQueueAccess} from './account-note-queue-access.mjs';
function fixture(company = false) {
    const abort = new AbortController(), state = {uid: 'owner', locked: false, result: {acquired: true, value: null}, opened: 0, closed: 0, reads: 0, hook: null};
    const account = company ? {domain: 'company', companyId: 'firm', id: 'same'} : {domain: 'private', id: 'same'};
    const context = {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {if (state.locked) throw Error('LOCKED');}};
    const queue = {pendingForRecord: async id => {assert.equal(id, 'same'); state.reads++; await state.hook?.(); return state.result;}, close() {state.closed++;},
        flush() {assert.fail('must not flush');}, enqueue() {assert.fail('must not enqueue');}, discard() {assert.fail('must not discard');}};
    const options = {context, account, getUser: () => ({uid: state.uid}), openQueue: async value => {
        assert.equal(value.domain, 'private-account'); assert.equal(value.signal, abort.signal); state.opened++; return queue;}};
    return {state, context, account, abort, queue, options, scope: {uid: 'owner', account, signal: abort.signal}, access: createAccountNoteQueueAccess(options)};
}
test('queue clearance is explicit, acquired under the existing capability, and releases each connection', async () => {
    const f = fixture(); assert.deepEqual(await f.access.inspect(), {status: 'clear'});
    assert.equal(await f.access.assertNoPendingMutation(f.scope), true);
    assert.equal(f.state.opened, 2); assert.equal(f.state.closed, 2); assert.equal(f.state.reads, 2);
});
test('pending identity is projected without queued payload; new editor remains blocked', async () => {
    const f = fixture(); f.state.result = {acquired: true, value: {recordId: 'same', operationId: 'op:1', record: {note: 'SECRET'}}};
    const result = await f.access.inspect(); assert.deepEqual(result, {status: 'pending', recordId: 'same', operationId: 'op:1'});
    assert.ok(Object.isFrozen(result)); assert.equal(await f.access.assertNoPendingMutation(f.scope), false); assert.equal(f.state.closed, 2);
});
test('busy lease, missing evidence, wrong record and ambiguous errors cannot look empty', async () => {
    for (const value of [{acquired: false}, undefined, {acquired: true}, {acquired: true, value: {recordId: 'other', operationId: 'op'}}]) {
        const f = fixture(); f.state.result = value; await assert.rejects(f.access.inspect()); assert.equal(f.state.closed, 1);
    }
    const f = fixture(); f.state.hook = () => {throw Error('FENCED_CLIENT_PENDING_AMBIGUOUS');};
    await assert.rejects(f.access.inspect(), /AMBIGUOUS/); assert.equal(f.state.closed, 1);
});
test('company identity cannot accidentally consume a private queue with the same id', async () => {
    const f = fixture(true); assert.equal(await f.access.assertNoPendingMutation(f.scope), true);
    assert.equal(f.state.opened, 0);
    await assert.rejects(f.access.assertNoPendingMutation({...f.scope, account: {domain: 'private', id: 'same'}}), /SCOPE/);
});
test('queue guard rejects a different UID, record or lifetime before opening storage', async () => {
    for (const scope of [{uid: 'other'}, {account: {domain: 'private', id: 'other'}}, {signal: new AbortController().signal}]) {
        const f = fixture(); await assert.rejects(f.access.assertNoPendingMutation({...f.scope, ...scope}), /SCOPE/); assert.equal(f.state.opened, 0);
    }
});
test('late queue results after abort, lock or UID change are ignored and closed', async () => {
    for (const revoke of [f => f.abort.abort(), f => {f.state.uid = 'other';}, f => {f.state.locked = true;}]) {
        const f = fixture(); f.state.hook = () => revoke(f);
        await assert.rejects(f.access.inspect()); assert.equal(f.state.closed, 1);
    }
    const f = fixture(); const access = createAccountNoteQueueAccess({...f.options, openQueue: async () => {f.abort.abort(); return f.queue;}});
    await assert.rejects(access.inspect(), /VIEW_DISPOSED/); assert.equal(f.state.closed, 1);
});
