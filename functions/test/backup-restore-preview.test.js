const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {validateExpectedVersion, encodeBackupComparisonValue, buildRestorePreview} = require('../backup-restore-preview');

test('server comparison encoder matches exported nested values and legacy id semantics', async () => {
  const source = readFileSync(require.resolve('../../Frontend/public/assets/js/modules/settings/backup-export-model.js'), 'utf8');
  const {encodeFirestoreValue} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
  const data = {text: 'synthetic', at: {seconds: 10, nanoseconds: 3, toMillis() { return 10000; }},
    bytes: new Uint8Array([1, 2]), date: new Date('2030-01-01T00:00:00Z'), nested: [undefined, {b: true, omitted: undefined}]};
  assert.deepEqual(encodeBackupComparisonValue(data), encodeFirestoreValue(data));
  for (const value of [NaN, Infinity, -Infinity]) {
    assert.throws(() => encodeBackupComparisonValue({nested: [value]}), /BACKUP_VALUE_UNSUPPORTED/);
    assert.throws(() => encodeFirestoreValue({nested: [value]}), /BACKUP_VALUE_UNSUPPORTED/);
  }
  const result = buildRestorePreview([{data: encodeFirestoreValue(data)}], [{exists: true, updateTime: {seconds: 1, nanoseconds: 2}, data: () => ({id: 'legacy', ...data})}]);
  assert.equal(result.entries[0].status, 'unchanged');
  assert.deepEqual(Object.keys(result.entries[0]).sort(), ['expectedVersion', 'index', 'status']);
});

test('version parser rejects coercion unknown fields malformed timestamps and missing metadata', () => {
  for (const value of [null, {}, {exists: 1}, {exists: false, updateTime: {}},
    {exists: true}, {exists: true, updateTime: {seconds: '1', nanoseconds: 0}},
    {exists: true, updateTime: {seconds: 1, nanoseconds: -1}},
    {exists: true, updateTime: {seconds: 1, nanoseconds: 1000000000}},
    {exists: true, updateTime: {seconds: 1, nanoseconds: 0, extra: true}}]) {
    assert.throws(() => validateExpectedVersion(value), /BACKUP_VERSION_INVALID/);
  }
  assert.deepEqual(validateExpectedVersion({exists: false}), {exists: false});
});
