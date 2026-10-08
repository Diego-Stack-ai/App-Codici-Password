const test = require('node:test');
const assert = require('node:assert/strict');
const {parseCloudEventTime} = require('../invite-acceptance-event-time');
test('UTC event parser supports fractional precision and rejects invalid calendar', () => {
    for (const fraction of ['', '.1', '.123', '.123456', '.123456789']) {
        assert.equal(parseCloudEventTime(`2026-09-25T18:00:00${fraction}Z`).ok, true);
    }
    for (const value of [undefined, '', '2026-02-31T00:00:00Z', '2026-09-25',
        '2026-09-25T25:00:00Z', '2026-09-25T18:00:00.1234567890Z']) {
        assert.equal(parseCloudEventTime(value).ok, false);
    }
});
