import test from 'node:test';
import assert from 'node:assert/strict';
import {bindPurgeStorageInventoryLab, inventoryPurgeStorageGenerations} from './purge-storage-inventory-lab.mjs';

const plan = attachments => ({valid: true, planHash: 'a'.repeat(64), attachmentMetadata: attachments});
const bucket = rows => ({file: path => ({async getMetadata() {
  if (!rows.has(path)) throw Object.assign(new Error('missing'), {code: 404});
  return [{generation: rows.get(path)}];
}})});

test('storage inventory binds sorted paths to exact generation without deletion authority', async () => {
  const rows = new Map([['users/u/accounts/a/attachments/z', '9007199254740993'],
    ['users/u/accounts/a/attachments/a', '7']]);
  const result = await inventoryPurgeStorageGenerations(plan([
    {storagePath: 'users/u/accounts/a/attachments/z'}, {storagePath: 'users/u/accounts/a/attachments/a'}]), bucket(rows));
  assert.deepEqual(result.objects, [
    {storagePath: 'users/u/accounts/a/attachments/a', generation: '7'},
    {storagePath: 'users/u/accounts/a/attachments/z', generation: '9007199254740993'}]);
  assert.match(result.storageHash, /^[a-f0-9]{64}$/);
  assert.equal(result.destructiveAllowed, false);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.objects));
});

test('missing, duplicate or unverifiable generations fail closed', async () => {
  await assert.rejects(inventoryPurgeStorageGenerations(plan([{storagePath: 'missing'}]), bucket(new Map())), /OBJECT_MISSING/);
  await assert.rejects(inventoryPurgeStorageGenerations(plan([{storagePath: 'x'}, {storagePath: 'x'}]),
    bucket(new Map([['x', '1']]))), /INVENTORY_INVALID/);
  for (const generation of [1, '0', '1.5', undefined]) {
    await assert.rejects(inventoryPurgeStorageGenerations(plan([{storagePath: 'x'}]),
      bucket(new Map([['x', generation]]))), /GENERATION_UNVERIFIED/);
  }
});

test('storage inventory hash binds the Firestore preview hash and generation', async () => {
  const attachmentMetadata = [{storagePath: 'users/u/accounts/a/attachments/a'}];
  const one = await inventoryPurgeStorageGenerations(plan(attachmentMetadata), bucket(new Map([[attachmentMetadata[0].storagePath, '1']])));
  const two = await inventoryPurgeStorageGenerations({...plan(attachmentMetadata), planHash: 'b'.repeat(64)},
    bucket(new Map([[attachmentMetadata[0].storagePath, '1']])));
  const three = await inventoryPurgeStorageGenerations(plan(attachmentMetadata), bucket(new Map([[attachmentMetadata[0].storagePath, '2']])));
  assert.notEqual(one.storageHash, two.storageHash);
  assert.notEqual(one.storageHash, three.storageHash);
});

test('binding transaction revalidates every Firestore version before recording storage hash', async () => {
  const documents = new Map([['users/u/accounts/a', {seconds: 2, nanoseconds: 3}],
    ['users/u/accounts/a/attachments/x', {seconds: 4, nanoseconds: 5}]]), bindings = new Map();
  const db = {projectId: 'demo-vault-shell', doc: path => ({path}), async runTransaction(run) {
    const writes = [];
    const result = await run({get: async ref => ref.path.startsWith('labPurgeStorageBindings/')
      ? {exists: bindings.has(ref.path), data: () => bindings.get(ref.path)}
      : {exists: documents.has(ref.path), updateTime: documents.get(ref.path)},
    create: (ref, value) => writes.push([ref.path, value])});
    for (const [path, value] of writes) { assert.equal(bindings.has(path), false); bindings.set(path, value); }
    return result;
  }};
  const candidatePlan = {...plan([{storagePath: 'users/u/accounts/a/attachments/x'}]), expectedDocuments: [
    {path: 'users/u/accounts/a', updateTime: {seconds: 2, nanoseconds: 3}},
    {path: 'users/u/accounts/a/attachments/x', updateTime: {seconds: 4, nanoseconds: 5}}]};
  const inventory = await inventoryPurgeStorageGenerations(candidatePlan,
    bucket(new Map([['users/u/accounts/a/attachments/x', '9']])));
  const first = await bindPurgeStorageInventoryLab(db, candidatePlan, inventory);
  assert.equal(first.duplicate, false); assert.equal(first.destructiveAllowed, false);
  assert.equal((await bindPurgeStorageInventoryLab(db, candidatePlan, inventory)).duplicate, true);
  documents.set('users/u/accounts/a', {seconds: 2, nanoseconds: 4});
  await assert.rejects(bindPurgeStorageInventoryLab(db, candidatePlan, inventory), /PREVIEW_STALE/);
});
