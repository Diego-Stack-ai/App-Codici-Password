const test = require('node:test');
const assert = require('node:assert/strict');
const {validatePurgeCommand} = require('../archive-purge-service');
const {createArchivePurgeBinding, verifyArchivePurgeReceipt} = require('../archive-purge-receipt');
const command = () => validatePurgeCommand({operationId: 'purge-op', accountId: 'account', context: 'private',
  expectedRevision: 3, confirmation: 'DELETE_FOREVER'});
const bind = value => createArchivePurgeBinding({uid: 'owner', command: value});

test('binding is deterministic and processing/purged results are minimal immutable projections', () => {
  const value = command(), before = structuredClone(value), binding = bind(value);
  assert.deepEqual(bind(Object.fromEntries(Object.entries(value).reverse())), binding);
  assert.deepEqual(value, before); assert.equal(Object.isFrozen(binding), true);
  for (const status of ['processing', 'purged']) {
    const result = verifyArchivePurgeReceipt({...binding, status, arbitrary: 'must-not-return', duplicate: 'untrusted'}, binding);
    assert.deepEqual(result, {status, duplicate: status === 'purged'});
    assert.equal(Object.isFrozen(result), true);
  }
});

test('command identity, owner, revision and future preconditions cannot replay another purge', () => {
  const value = command(), binding = bind(value), receipt = {...binding, status: 'processing'};
  const variants = [{...value, operationId: 'other'}, {...value, accountId: 'other'}, {...value, expectedRevision: 4},
    {...value, context: 'company', companyId: 'company'}, {...value, futureVersion: {seconds: 1, nanoseconds: 2}}].map(bind);
  variants.push(createArchivePurgeBinding({uid: 'other', command: value}));
  const company = {...value, context: 'company', companyId: 'one'};
  assert.notEqual(bind(company).operationHash, bind({...company, companyId: 'two'}).operationHash);
  for (const changed of variants) {
    assert.notEqual(changed.operationHash, binding.operationHash);
    assert.throws(() => verifyArchivePurgeReceipt(receipt, changed), {code: 'ARCHIVE_OPERATION_BINDING_MISMATCH'});
  }
});

test('unconfirmed commands and malformed caller bindings fail closed even for resume or completed retry', () => {
  const value = command(), binding = bind(value);
  for (const confirmation of [false, undefined, 'DELETE_FOREVER', 1]) {
    assert.throws(() => bind({...value, confirmation}), {code: 'ARCHIVE_OPERATION_BINDING_INVALID'});
    for (const status of ['processing', 'purged']) {
      assert.throws(() => verifyArchivePurgeReceipt({...binding, status}, {...binding, confirmation}),
        {code: 'ARCHIVE_OPERATION_BINDING_INVALID'});
    }
  }
  for (const changed of [{...value, expectedRevision: '3'}, {...value, expectedRevision: Number.MAX_SAFE_INTEGER + 1},
    {...value, context: 'private', companyId: 'unexpected'}, {...value, context: 'company', companyId: null}]) {
    assert.throws(() => bind(changed), {code: 'ARCHIVE_OPERATION_BINDING_INVALID'});
  }
});

test('legacy shapes, unknown states and cross-domain receipts are never trusted', () => {
  const binding = bind(command()), good = {...binding, status: 'purged'};
  for (const receipt of [null, {}, {status: 'processing'}, {status: 'purged'}, {...good, bindingVersion: 0},
    {...good, operationHash: 'bad'}, {...good, status: 'ready'}, {...good, status: 'applied'}]) {
    assert.throws(() => verifyArchivePurgeReceipt(receipt, binding), {code: 'ARCHIVE_OPERATION_RESULT_UNATTESTED'});
  }
  for (const patch of [{domain: 'backup-restore'}, {ownerUid: 'other'}, {confirmation: false}, {expectedRevision: 4}]) {
    assert.throws(() => verifyArchivePurgeReceipt({...good, ...patch}, binding), {code: 'ARCHIVE_OPERATION_BINDING_MISMATCH'});
  }
});

test('canonical hashing includes nested array order and rejects non-JSON or ambiguous future fields', () => {
  const value = command();
  assert.equal(bind({...value, future: {a: 1, b: 2}}).operationHash, bind({...value, future: {b: 2, a: 1}}).operationHash);
  assert.notEqual(bind({...value, future: [1, 2]}).operationHash, bind({...value, future: [2, 1]}).operationHash);
  const sparse = new Array(1), decorated = [1], cyclic = {};
  decorated.extra = 2; cyclic.self = cyclic;
  const getter = Object.defineProperty({}, 'secret', {enumerable: true, get() { throw new Error('Getter must not execute'); }});
  for (const extra of [undefined, NaN, Infinity, new Date(), sparse, decorated, cyclic, getter, {value: undefined}]) {
    assert.throws(() => bind({...value, extra}), {code: 'ARCHIVE_OPERATION_BINDING_INVALID'});
  }
});
