const test = require('node:test');
const assert = require('node:assert/strict');
const {createBackupRestoreV2Runtime, deterministicPlanId} = require('../backup-restore-v2-runtime');
const {createBackupRestoreBinding} = require('../backup-restore-receipt');
const {validateRestoreChunk} = require('../backup-restore-service');

function memoryDb() {
  const records = new Map();
  const snapshot = path => ({exists: records.has(path), data: () => structuredClone(records.get(path))});
  const reference = path => ({path, get: async () => snapshot(path)});
  return {records, doc: reference, runTransaction: async callback => callback({
    get: async ref => snapshot(ref.path), create: (ref, data) => {
      if (records.has(ref.path)) throw Error('ALREADY_EXISTS');
      records.set(ref.path, structuredClone(data));
    }, delete: ref => records.delete(ref.path)
  })};
}
const uid = 'synthetic-owner';
const command = {expectedOwnerUid: uid, operationId: 'restore-one', backupId: 'backup-one',
  chunkIndex: 0, chunkCount: 1, mode: 'apply', confirmation: 'RESTORE_VALIDATED',
  records: [{scope: 'private-account', id: 'one', data: {name: 'ciphertext'}, expectedVersion: {exists: false}}]};

test('M8 V2 runtime creates an idempotent deterministic plan without record bodies', async () => {
  const db = memoryDb();
  const runtime = createBackupRestoreV2Runtime({db, now: () => 1000});
  const first = await runtime.create(uid, [command]);
  const second = await runtime.create(uid, [command]);
  assert.equal(first.planId, deterministicPlanId(uid, [command]));
  assert.equal(first.duplicate, false);
  assert.equal(second.duplicate, true);
  assert.equal(JSON.stringify([...db.records.values()]).includes('ciphertext'), false);
});

test('M8 V2 runtime reconstructs, inspects absence and removes only expired plans', async () => {
  const db = memoryDb();
  let time = 1000;
  const runtime = createBackupRestoreV2Runtime({db, now: () => time});
  const created = await runtime.create(uid, [command]);
  const rebuilt = await runtime.reconstruct(uid, created.planId, 'backup-one',
    [{scope: 'private-account', id: 'one', data: {name: 'ciphertext'}}]);
  assert.equal(rebuilt.inputs[0].operationId, 'restore-one');
  assert.deepEqual(await runtime.inspect(uid, created.planId, rebuilt.inputs),
    {chunks: [{operationId: 'restore-one', status: 'unconfirmed'}]});
  assert.deepEqual(await runtime.removeExpired(uid, created.planId), {status: 'retained'});
  time = created.expiresAtMs;
  assert.deepEqual(await runtime.removeExpired(uid, created.planId), {status: 'removed'});
  assert.deepEqual(await runtime.removeExpired(uid, created.planId), {status: 'absent'});
});

test('M8 V2 runtime dispatcher admits only its closed action schemas', async () => {
  const db = memoryDb();
  const runtime = createBackupRestoreV2Runtime({db, now: () => 1000});
  const created = await runtime.execute(uid, {expectedOwnerUid: uid, action: 'create', inputs: [command]});
  assert.equal(typeof created.planId, 'string');
  await assert.rejects(runtime.execute(uid, {expectedOwnerUid: uid, action: 'create', inputs: [command], bypass: true}),
    error => error.code === 'BACKUP_RESTORE_V2_REQUEST_INVALID');
  await assert.rejects(runtime.execute(uid, {expectedOwnerUid: 'other', action: 'inspect'}),
    error => error.code === 'BACKUP_RESTORE_V2_REQUEST_INVALID');
  await assert.rejects(runtime.execute(uid, {expectedOwnerUid: uid, action: 'delete', planId: created.planId}),
    error => error.code === 'BACKUP_RESTORE_V2_REQUEST_INVALID');
});

test('M8 V2 runtime reports only attested receipts as confirmed', async () => {
  const db = memoryDb();
  const runtime = createBackupRestoreV2Runtime({db, now: () => 1000});
  const created = await runtime.create(uid, [command]);
  const validated = validateRestoreChunk(command, uid);
  db.records.set(`mutationResults/${uid}/operations/${command.operationId}`, {
    status: 'applied', duplicate: false, recordCount: validated.records.length,
    ...createBackupRestoreBinding({uid, command: validated})
  });
  assert.deepEqual(await runtime.inspect(uid, created.planId, [command]),
    {chunks: [{operationId: command.operationId, status: 'confirmed'}]});
  db.records.get(`mutationResults/${uid}/operations/${command.operationId}`).operationHash = '0'.repeat(64);
  await assert.rejects(runtime.inspect(uid, created.planId, [command]),
    error => error.code === 'BACKUP_RESTORE_V2_RECEIPT_INVALID');
});
