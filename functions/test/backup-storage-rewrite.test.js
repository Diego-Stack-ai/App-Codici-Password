const test = require('node:test');
const assert = require('node:assert/strict');
const {rewriteStorageData} = require('../backup-storage-rewrite');
const old = 'users/owner/accounts/a/file', next = 'users/owner/restoreObjects/new';
const rewrite = (value, mapping = {[old]: next}) => rewriteStorageData('owner', value, mapping);

test('rewrite changes only exact storagePath fields and never aliases input', () => {
  const input = {name: old, nested: [{storagePath: old}], bytes: {$type: 'bytes', value: [0, 255]},
    date: {$type: 'date', value: '2030-01-01T00:00:00.000Z'},
    time: {$type: 'timestamp', seconds: 1, nanoseconds: 999999999}};
  const result = rewrite(input);
  assert.equal(result.name, old);
  assert.equal(result.nested[0].storagePath, next);
  assert.equal(input.nested[0].storagePath, old);
  assert.deepEqual(result.bytes, input.bytes);
  assert.notEqual(result.bytes.value, input.bytes.value);
  assert.notEqual(result.time, input.time);
});

test('rewrite rejects unmapped, unused, foreign and malformed paths', () => {
  assert.throws(() => rewrite({storagePath: old}, {}));
  assert.throws(() => rewrite({}));
  for (const bad of ['users/other/x', 'users/owner/../x', 'users/owner//x', 'users/owner/%2e/x', 'users/owner/x\n', 5, null]) {
    assert.throws(() => rewrite({storagePath: bad}));
    assert.throws(() => rewrite({storagePath: old}, {[old]: bad}));
  }
});

test('rewrite refuses accessors without invoking them, including arrays and type tags', () => {
  let calls = 0;
  const getter = {enumerable: true, get() { calls++; throw new Error('invoked'); }};
  for (const key of ['$type', 'storagePath', 'plain']) {
    const input = {}; Object.defineProperty(input, key, getter);
    assert.throws(() => rewrite(input, {}), /REWRITE_INVALID/);
  }
  const list = [1]; Object.defineProperty(list, '0', getter);
  assert.throws(() => rewrite(list, {}), /REWRITE_INVALID/);
  const mapping = {}; Object.defineProperty(mapping, old, getter);
  assert.throws(() => rewrite({}, mapping), /REWRITE_INVALID/);
  assert.equal(calls, 0);
});

test('rewrite rejects prototype keys, symbols, array extras, holes and special prototypes', () => {
  for (const input of [JSON.parse('{"__proto__":{}}'), {constructor: 1}, {prototype: 1},
    {[Symbol('hidden')]: true}, Object.assign([1], {extra: 2}), new Array(2), new Date(), new Uint8Array(2)]) {
    assert.throws(() => rewrite(input, {}), /REWRITE_INVALID/);
  }
});

test('rewrite validates serialized Firestore types without silent coercion', () => {
  for (const input of [{$type: 'unknown'}, {$type: 'date', value: 'invalid'},
    {$type: 'date', value: '2030-02-30T00:00:00.000Z'},
    {$type: 'timestamp', seconds: 1, nanoseconds: 1000000000},
    {$type: 'timestamp', seconds: 253402300800, nanoseconds: 0},
    {$type: 'bytes', value: [256]}, {$type: 'bytes', value: [1.5]},
    {$type: 'bytes', value: [1], storagePath: old}, {n: NaN}, {n: Infinity}, {n: undefined}]) {
    assert.throws(() => rewrite(input, {}), /REWRITE_INVALID/);
  }
});

test('rewrite bounds recursion, cycles and collection sizes', () => {
  const cycle = {}; cycle.self = cycle;
  assert.throws(() => rewrite(cycle, {}), /REWRITE_INVALID/);
  assert.throws(() => rewrite(new Array(10001).fill(0), {}), /REWRITE_INVALID/);
  assert.throws(() => rewrite({text: 'a'.repeat(1048577)}, {}), /REWRITE_INVALID/);
  assert.deepEqual(rewrite({empty: [], value: null}, {}), {empty: [], value: null});
});
