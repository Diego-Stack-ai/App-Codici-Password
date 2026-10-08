import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createRestoreChunkLab} from './restore-chunk-lab.mjs';
import {prepareResumePlan} from './restore-resume-plan.mjs';
const input = {expectedOwnerUid: 'u1', mode: 'apply', operationId: 'chunk', backupId: 'backup',
  chunkIndex: 0, chunkCount: 1, confirmation: 'RESTORE_VALIDATED', records: [
    {scope: 'private-account', id: 'a', expectedVersion: {exists: false},
      data: {storagePath: 'users/u1/attachments/a', sharedWithUids: ['untrusted']}}]};
const stages = {restoreOperationId: 'restore', stageIds: ['a'.repeat(64)]};

test('legacy plan with invalid typed data in a later chunk cannot apply its first chunk',async()=>{
  const f=fixture(),commands=[0,1].map(index=>({...input,operationId:`typed-${index}`,chunkIndex:index,chunkCount:2,
    records:[{scope:'private-account',id:`typed-${index}`,expectedVersion:{exists:false},data:index?{at:{$type:'timestamp',seconds:1,nanoseconds:1}}:{synthetic:true}}]}));
  const stageCommands=commands.map(()=>({restoreOperationId:'restore',stageIds:[]}));
  const plan=prepareResumePlan('u1','legacy',commands,Date.now(),stageCommands);
  f.docs.set(`labRestoreResumePlans/u1/items/${createHash('sha256').update('legacy').digest('hex')}`,plan);
  const before=structuredClone([...f.docs]);
  await assert.rejects(f.lab.commitPlan('u1','legacy',commands,stageCommands),/TIMESTAMP_PRECISION_UNSUPPORTED/);
  assert.deepEqual([...f.docs],before);
});
test('transaction retry rechecks expiry and does not publish buffered writes', async () => {
  const plan = prepareResumePlan('u1', 'plan', [input], 1000, [stages]);
  let time = 1001, writes = 0;
  const store = {projectId: 'demo-retry', doc: path => ({path}), async runTransaction(fn) {
    const tx = {get: async ref => ({exists: ref.path.startsWith('labRestoreResumePlans'), data: () => plan}),
      set: () => {writes++;}, create: () => {writes++;}};
    await fn(tx); // Emulate an aborted first attempt; no writes are published.
    assert.equal(writes, 2);
    writes = 0; time = plan.expiresAtMs;
    return fn(tx);
  }};
  const stageLab = {resolveMappingInTransaction: async () => ({'users/u1/attachments/a': `users/u1/restoreObjects/${stages.stageIds[0]}`})};
  const lab = createRestoreChunkLab({store, stageLab, projectId: store.projectId, now: () => time});
  await assert.rejects(lab.commit('u1', input, stages,
    {planId: 'plan', inputs: [input], stageCommands: [stages]}), /EXPIRED_NEW_PREVIEW/);
  assert.equal(writes, 0);
});
function fixture({failReceipt = false} = {}) {
  const docs = new Map(); let reads = 0;
  const store = {projectId: 'demo-chunk', doc: path => ({path}), async runTransaction(fn) {
    const writes = [];
    const result = await fn({get: async ref => ({exists: docs.has(ref.path), data: () => docs.get(ref.path),
      updateTime: {seconds: 100, nanoseconds: 1}}),
      set: (ref, data) => writes.push([ref.path, data]), create: (ref, data) => {
        if (failReceipt) throw new Error('synthetic receipt failure');
        writes.push([ref.path, data]);
      }});
    for (const [path, data] of writes) docs.set(path, data);
    return result;
  }};
  const stageLab = {async resolveMappingInTransaction() { reads++;
    if (reads > 1) throw new Error('stages unavailable');
    return {'users/u1/attachments/a': `users/u1/restoreObjects/${stages.stageIds[0]}`}; }};
  return {docs, store, stageLab, lab: createRestoreChunkLab({store, stageLab, projectId: store.projectId}), get reads() {return reads;}};
}
test('lab commit rewrites and preserves authority; replay needs no surviving stage', async () => {
  const f = fixture();
  assert.deepEqual(await f.lab.commit('u1', input, stages), {status: 'applied', duplicate: false, recordCount: 1});
  assert.equal(f.docs.size, 2);
  assert.ok([...f.docs.keys()].every(path => path.startsWith('lab')));
  const record = [...f.docs].find(([path]) => path.startsWith('labCandidateRecords'))[1];
  assert.equal(record.storagePath, `users/u1/restoreObjects/${stages.stageIds[0]}`);
  assert.deepEqual(record.sharedWithUids, []);
  const before = structuredClone([...f.docs]);
  assert.equal((await f.lab.commit('u1', input, stages)).duplicate, true);
  assert.equal(f.reads, 1); assert.deepEqual([...f.docs], before);
  await assert.rejects(f.lab.commit('u1', {...input, backupId: 'changed'}, stages), /LAB_CHUNK_BINDING/);
  assert.deepEqual([...f.docs], before);
});

test('collision requires explicit overwrite and preserves current sharing authority', async () => {
  const path = `labCandidateRecords/u1/items/${createHash('sha256').update('users/u1/accounts/a').digest('hex')}`;
  for (const overwrite of [false, true]) {
    const f = fixture(), current = {name: 'old', sharedWithUids: ['synthetic-current'], visibility: 'shared'};
    f.docs.set(path, current);
    const command = {...input, overwriteExisting: overwrite,
      confirmation: overwrite ? 'RESTORE_SELECTED_OVERWRITE' : 'RESTORE_VALIDATED',
      records: [{...input.records[0], expectedVersion: {exists: true, updateTime: {seconds: 100, nanoseconds: 1}}}]};
    const result = await f.lab.commit('u1', command, stages);
    assert.equal(result.status, overwrite ? 'applied' : 'collision');
    assert.equal(f.docs.size, overwrite ? 2 : 1);
    if (overwrite) {
      assert.deepEqual(f.docs.get(path).sharedWithUids, current.sharedWithUids);
      assert.equal(f.docs.get(path).visibility, 'shared');
    } else assert.deepEqual(f.docs.get(path), current);
  }
});

test('stale version leaves existing record unchanged and creates no receipt', async () => {
  const f = fixture(), path = `labCandidateRecords/u1/items/${createHash('sha256').update('users/u1/accounts/a').digest('hex')}`;
  f.docs.set(path, {name: 'current'});
  const before = structuredClone([...f.docs]);
  assert.equal((await f.lab.commit('u1', input, stages)).status, 'stale-preview');
  assert.deepEqual([...f.docs], before);
});

test('receipt enqueue failure discards buffered record writes in fixture', async () => {
  const f = fixture({failReceipt: true});
  await assert.rejects(f.lab.commit('u1', input, stages), /synthetic receipt failure/);
  assert.equal(f.docs.size, 0);
});
test('wrong owner, confirmation and unmapped path leave no writes', async () => {
  const f = fixture();
  await assert.rejects(f.lab.commit('u2', input, stages));
  await assert.rejects(f.lab.commit('u1', {...input, confirmation: ''}, stages));
  await assert.rejects(f.lab.commit('u1', input, {...stages, stageIds: []}));
  assert.equal(f.docs.size, 0);
  assert.throws(() => createRestoreChunkLab({store: f.store, stageLab: f.stageLab, projectId: 'real-project'}));
});

test('typed data requires factories and preserves decoded synthetic values', async () => {
  const f = fixture(), data = {at: {$type: 'timestamp', seconds: 123, nanoseconds: 456000},
    bytes: {$type: 'bytes', value: [0, 127, 255]}, date: {$type: 'date', value: '2026-01-01T00:00:00.000Z'}};
  const command = {...input, records: [{...input.records[0], data}]}, noStages = {...stages, stageIds: []};
  await assert.rejects(f.lab.commit('u1', command, noStages), /BACKUP_TIMESTAMP_FACTORY_REQUIRED/);
  assert.equal(f.docs.size, 0);
  const lab = createRestoreChunkLab({store: f.store, stageLab: f.stageLab, projectId: f.store.projectId,
    types: {timestamp: (seconds, nanoseconds) => ({seconds, nanoseconds}), bytes: value => Buffer.from(value)}});
  assert.equal((await lab.commit('u1', command, noStages)).status, 'applied');
  const record = [...f.docs].find(([path]) => path.startsWith('labCandidateRecords'))[1];
  assert.deepEqual(record.at, {seconds: 123, nanoseconds: 456000});
  assert.deepEqual(record.bytes, Buffer.from([0, 127, 255]));
  assert.equal(record.date.toISOString(), data.date.value);
});

test('400 minimal records accepted; 401 rejected before any write', async () => {
  const records = Array.from({length: 400}, (_, i) => ({scope: 'private-account', id: `r${i}`,
    data: {name: 'synthetic'}, expectedVersion: {exists: false}}));
  const f = fixture(), noStages = {...stages, stageIds: []};
  await assert.rejects(f.lab.commit('u1', {...input, records: [...records, {...records[0], id: 'extra'}]}, noStages),
    /BACKUP_RECORD_COUNT_INVALID/);
  assert.equal(f.docs.size, 0);
  assert.equal((await f.lab.commit('u1', {...input, records}, noStages)).recordCount, 400);
  assert.equal(f.docs.size, 401);
});

test('record and aggregate byte limits reject oversize without writes', async () => {
  const noStages = {...stages, stageIds: []};
  const make = (id, size) => ({scope: 'private-account', id, expectedVersion: {exists: false},
    data: {text: 'x'.repeat(size)}});
  // JSON overhead for {text:""} is 11 UTF-8 bytes.
  const boundary = 800 * 1024 - 11;
  const f = fixture();
  await assert.rejects(f.lab.commit('u1', {...input, records: [make('a', boundary + 1)]}, noStages), /BACKUP_RECORD_TOO_LARGE/);
  assert.equal(f.docs.size, 0);
  await assert.rejects(f.lab.commit('u1', {...input, records: Array.from({length: 10}, (_, i) => make(`r${i}`, boundary))}, noStages),
    /BACKUP_CHUNK_TOO_LARGE/);
  assert.equal(f.docs.size, 0);
  assert.equal((await f.lab.commit('u1', {...input, records: [make('a', boundary)]}, noStages)).status, 'applied');
});
