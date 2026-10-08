"use strict";
const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {parseCloudEventTime} = require('../invite-acceptance-event-time');
const source = readFileSync(require.resolve('../index'), 'utf8');
const start = source.indexOf('// Separate from audit trigger');
const end = source.indexOf('function contactMatchesDeadline(');
assert.ok(start > 0 && end > start);
function fixture(fail = false) {
    const calls = [], registrations = {};
    const context = vm.createContext({exports: {}, parseCloudEventTime,
        admin: {firestore: () => 'synthetic-db'}, FieldValue: {serverTimestamp: () => 'synthetic-time'},
        runInviteRevocationNotification: async payload => {if (fail) throw new Error('transient'); calls.push(payload);},
        runAcceptanceMarkerCleanup: async payload => {if (fail) throw new Error('transient'); calls.push(payload);},
        onDocumentDeleted: (options, handler) => {registrations.trigger = options; return handler;},
        onSchedule: (options, handler) => {registrations.schedule = options; return handler;}});
    vm.runInContext(source.slice(start, end), context);
    return {calls, registrations, ...context.exports};
}
const event = {time: '2026-09-25T18:00:00.123456Z', params: {inviteId: 'synthetic'}, data: {data: () => ({synthetic: true})}};
test('real trigger registration enables retry and delegates parsed event', async () => {
    const f = fixture();
    assert.equal(f.registrations.trigger.document, 'invites/{inviteId}');
    assert.equal(f.registrations.trigger.retry, true);
    await f.onInviteDeletedNotification(event);
    assert.equal(f.calls[0].eventTimeMillis, Date.parse('2026-09-25T18:00:00.123Z'));
    assert.equal(f.calls[0].inviteId, 'synthetic');
    assert.equal(f.calls[0].before.synthetic, true);
    assert.equal(f.calls[0].serverTimestamp(), 'synthetic-time');
});
test('missing data and invalid event time never reach service', async () => {
    const f = fixture();
    for (const patch of [{data: null}, {time: undefined}, {time: 'BAD'}]) {
        await f.onInviteDeletedNotification({...event, ...patch});
    }
    assert.equal(f.calls.length, 0);
});
test('real cleanup registration and delegation remain bounded', async () => {
    const f = fixture();
    assert.equal(f.registrations.schedule.timeoutSeconds, 540);
    assert.equal(f.registrations.schedule.retryCount, 3);
    assert.equal(f.registrations.schedule.schedule, '30 3 * * *');
    await f.cleanupInviteRevocationMarkers();
    assert.equal(f.calls[0].limit, 100);
    assert.equal(f.calls[0].statePath, 'sharingNotificationRetention/scan');
});
test('transient errors propagate to platform retry', async () => {
    const f = fixture(true);
    await assert.rejects(f.onInviteDeletedNotification(event), /transient/);
    await assert.rejects(f.cleanupInviteRevocationMarkers(), /transient/);
});
