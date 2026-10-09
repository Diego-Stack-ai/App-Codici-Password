import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createRestoreStageLab} from './restore-stage-lab.mjs';
import {createRestoreStageReader} from './restore-stage-reader.mjs';
import {readAttachmentRoute} from './attachment-read-route.mjs';
import {createRestoreStageDownload} from './restore-stage-download.mjs';
import {createRestoreStageClient} from './restore-stage-client.mjs';
import {createRequire} from 'node:module';
const {rewriteStorageData} = createRequire(import.meta.url)('../../functions/backup-storage-rewrite.js');

const bytes = Buffer.from('synthetic-encrypted-attachment');
const input = {expectedOwnerUid: 'u1', operationId: 'op1', storagePath: 'users/u1/attachments/a',
  size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')};
const doc = path => ({path, collection: name => col(`${path}/${name}`)});
const col = path => ({doc: id => doc(`${path}/${id}`), where: (field, operator, value) => ({
  limit: limit => ({queryPath: path, field, operator, value, limit})
})});
const stamp = value => ({toMillis: () => value});
function fixture() {
  const docs = new Map(), objects = new Map();
  let writes = 0, saves = 0, downloads = 0, deletes = 0, clock = 1000, failPrefix, afterSave, beforeMetadata;
  const store = {collection: col, async runTransaction(fn) {
    const pending = [], reads = new Map();
    const result = await fn({get: async ref => {
      if (ref.queryPath) {
        assert.equal(ref.operator, '==');
        const selected = [...docs.entries()].filter(([path, value]) => path.startsWith(`${ref.queryPath}/`) && value[ref.field] === ref.value).slice(0, ref.limit);
        return {size: selected.length, docs: selected.map(([, value]) => ({data: () => value}))};
      }
      if (failPrefix && ref.path.startsWith(failPrefix)) { failPrefix = null; throw new Error('INJECTED'); }
      const value = docs.get(ref.path); reads.set(ref.path, value);
      return {exists: value !== undefined, data: () => value};
    }, create: (r, v) => pending.push(['create', r.path, v]), update: (r, v) => pending.push(['update', r.path, v])});
    for (const [path, before] of reads) assert.equal(docs.get(path), before, 'read conflict');
    for (const [op, path] of pending) assert.equal(docs.has(path), op === 'update', 'write precondition');
    for (const [op, path, value] of pending) { docs.set(path, op === 'update' ? {...docs.get(path), ...value} : value); writes++; }
    return result;
  }};
  function seed(path, value) {
    const entry = objects.get(path) || {current: null, versions: new Map()};
    entry.current = String(entry.versions.size + 1); entry.versions.set(entry.current, Buffer.from(value)); objects.set(path, entry);
  }
  const bucket = {file(path, opts = {}) { return {
    async getMetadata() {
      await beforeMetadata?.();
      const entry = objects.get(path); if (!entry) throw Object.assign(new Error('missing'), {code: 404});
      return [{generation: entry.current, size: entry.versions.get(entry.current).length}];
    }, async save(value, options) {
      assert.equal(options.preconditionOpts.ifGenerationMatch, 0);
      if (objects.has(path)) throw Object.assign(new Error('exists'), {code: 412});
      saves++; seed(path, value); afterSave?.();
    }, async download() {
      downloads++; assert.equal(typeof opts.generation, 'string');
      const value = objects.get(path)?.versions.get(opts.generation);
      if (!value) throw new Error('missing generation'); return [Buffer.from(value)];
    }, async delete(options) {
      assert.equal(typeof opts.generation, 'string');
      assert.equal(options.preconditionOpts.ifGenerationMatch, opts.generation);
      const entry = objects.get(path);
      if (!entry?.versions.has(opts.generation)) throw Object.assign(new Error('missing generation'), {code: 404});
      entry.versions.delete(opts.generation); deletes++;
      if (!entry.versions.size) objects.delete(path);
    }
  }; }};
  const build = () => createRestoreStageLab({store, bucket, projectId: 'demo-m8', now: () => clock, timestamp: stamp,
    verifyIdToken: async token => { if (token !== 'synthetic') throw new Error('secret-error'); return {uid: 'u1'}; },
    verifyAppCheck: async token => { if (token !== 'synthetic') throw new Error('secret-error'); }});
  return {lab: build(), build, store, docs, objects, seed, get writes() {return writes;}, get saves() {return saves;},
    get downloads() {return downloads;}, get deletes() {return deletes;}, advance: ms => {clock += ms;}, inject: prefix => {failPrefix = prefix;},
    onSave: callback => {afterSave = callback;}, onMetadata: callback => {beforeMetadata = callback;}};
}
async function serve(t, lab) {
  const server = http.createServer(lab.upload);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (id, {body = bytes, headers = {}, path = '/upload', method = 'POST', chunked = false} = {}) => new Promise((resolve, reject) => {
    const request = http.request({host: '127.0.0.1', port: server.address().port, path, method, agent: false,
      headers: {authorization: 'Bearer synthetic', 'x-firebase-appcheck': 'synthetic', 'x-stage-id': id,
        'content-type': 'application/octet-stream', ...(chunked ? {'transfer-encoding': 'chunked'} : {}), ...headers}}, res => {
      let text = ''; res.on('data', chunk => {text += chunk;}); res.on('end', () => resolve({status: res.statusCode, text}));
    });
    request.on('error', reject); request.end(body);
  });
}
async function verified(t, f) {
  const plan = await f.lab.claim('u1', input), post = await serve(t, f.lab);
  assert.equal((await post(plan.stageId)).status, 200);
  return {id: plan.stageId, post};
}
const paths = id => [`labRestoreOperations/u1/items/${id}`, `backupObjects/u1/items/${id}`, `labRestorePublished/u1/items/${id}`];

test('cleanup preparation is expired unpublished verified-only, idempotent and never deletes bytes', async t => {
  for (const mode of ['eligible', 'live', 'published', 'legacy', 'unknown', 'generation']) {
    const f = fixture(), {id, post} = await verified(t, f), command = {stageId: id};
    const p = paths(id)[0], entryPath = [...f.docs.keys()].find(key => key.startsWith('labRestoreUploadActivity/'));
    if (mode === 'published') await f.lab.publish('u1', {...command, expectedRevision: 2});
    if (mode === 'legacy') { const old = {...f.docs.get(p)}; delete old.uploadTrackingVersion; f.docs.set(p, old); }
    if (mode === 'unknown') f.docs.set(entryPath, {...f.docs.get(entryPath), status: 'unknown', generation: null});
    if (mode === 'generation') f.docs.set(entryPath, {...f.docs.get(entryPath), generation: '999'});
    if (mode !== 'live') f.advance(7 * 24 * 60 * 60 * 1000);
    const before = f.writes;
    if (mode !== 'eligible') {
      await assert.rejects(f.lab.prepareUploadCleanup('u1', command), /LAB_CLEANUP_BLOCKED|LAB_ACTIVITY_HISTORY/);
      assert.equal(f.writes, before);
    } else {
      const result = await f.lab.prepareUploadCleanup('u1', command);
      assert.equal(result.generation, '1'); assert.equal(result.cleanupAllowed, false);
      const written = f.writes;
      assert.deepEqual(await f.lab.prepareUploadCleanup('u1', command), {...result, duplicate: true});
      assert.equal(f.writes, written);
      f.advance(-7 * 24 * 60 * 60 * 1000); // Marker, not clock alone, prevents reopening.
      await assert.rejects(f.lab.claim('u1', input), /LAB_CLEANUP_BLOCKED/);
      await assert.rejects(f.lab.publish('u1', {...command, expectedRevision: 2}), /LAB_CLEANUP_BLOCKED/);
      assert.equal((await post(id)).status, 409);
      assert.equal(f.writes, written);
    }
    assert.equal(f.objects.size, 1); assert.equal(f.saves, 1);
  }
});

test('prepared cleanup deletes only the pinned generation and closes metadata', async t => {
  const f = fixture(), {id} = await verified(t, f);
  f.advance(7 * 24 * 60 * 60 * 1000);
  const prepared = await f.lab.prepareUploadCleanup('u1', {stageId: id});
  const result = await f.lab.executeUploadCleanup('u1', {stageId: id, cleanupId: prepared.cleanupId});
  assert.deepEqual(result, {deleted: true, missing: false, generation: '1', cleanupId: prepared.cleanupId, completed: true});
  assert.equal(f.deletes, 1); assert.equal(f.objects.size, 0);
  const [planPath, descriptorPath] = paths(id);
  assert.equal(f.docs.get(planPath).cleanup.status, 'completed');
  assert.equal(f.docs.get(descriptorPath).status, 'cleaned');
  await assert.rejects(f.lab.claim('u1', input), /LAB_CLEANUP_BLOCKED/);
  await assert.rejects(f.lab.executeUploadCleanup('u1', {stageId: id, cleanupId: prepared.cleanupId}), /LAB_CLEANUP_BLOCKED/);
});

test('cleanup execution rejects wrong authorization without deleting bytes', async t => {
  const f = fixture(), {id} = await verified(t, f);
  f.advance(7 * 24 * 60 * 60 * 1000);
  await f.lab.prepareUploadCleanup('u1', {stageId: id});
  await assert.rejects(f.lab.executeUploadCleanup('u1', {stageId: id, cleanupId: '00000000-0000-0000-0000-000000000000'}), /LAB_CLEANUP_BLOCKED/);
  assert.equal(f.deletes, 0); assert.equal(f.objects.size, 1);
});

test('upload maps unsupported generation to a fixed conflict without exposing adapter details', async t => {
  const f = fixture(), {id, post} = await verified(t, f), before = f.writes;
  f.onMetadata(() => {throw Object.assign(Error('SYNTHETIC_PRIVATE'), {code: 'BACKUP_STAGE_GENERATION_UNSUPPORTED'});});
  const result = await post(id);
  assert.equal(result.status, 409);
  assert.deepEqual(JSON.parse(result.text), {error: 'BACKUP_STAGE_GENERATION_UNSUPPORTED'});
  assert.equal(f.writes, before); assert.equal(f.saves, 1);
});

test('cleanup preparation rejects inconsistent descriptor lifetime without writing', async t => {
  for (const mode of ['missing', 'future', 'created']) {
    const f = fixture(), {id} = await verified(t, f), descriptorPath = paths(id)[1];
    const descriptor = {...f.docs.get(descriptorPath)};
    if (mode === 'missing') delete descriptor.expiresAt;
    if (mode === 'future') descriptor.expiresAt = stamp(1000 + 2 * 7 * 24 * 60 * 60 * 1000);
    if (mode === 'created') descriptor.createdAt = stamp(1001);
    f.docs.set(descriptorPath, descriptor);
    f.advance(7 * 24 * 60 * 60 * 1000);
    const before = f.writes;
    await assert.rejects(f.lab.prepareUploadCleanup('u1', {stageId: id}), /LAB_CLEANUP_BLOCKED/);
    assert.equal(f.writes, before);
    assert.equal(f.objects.size, 1);
  }
});

test('upload already verifying existing bytes rejects a concurrently prepared cleanup marker', async t => {
  const f = fixture(), {id, post} = await verified(t, f);
  let preparedWrites;
  f.onMetadata(async () => {
    f.onMetadata(null);
    f.advance(7 * 24 * 60 * 60 * 1000);
    await f.lab.prepareUploadCleanup('u1', {stageId: id});
    preparedWrites = f.writes;
    f.advance(-7 * 24 * 60 * 60 * 1000);
  });
  const result = await post(id);
  assert.equal(result.status, 409);
  assert.deepEqual(JSON.parse(result.text), {error: 'LAB_CLEANUP_BLOCKED'});
  assert.equal(f.writes, preparedWrites);
  assert.equal(f.saves, 1);
  assert.equal(f.objects.size, 1);
});

test('tracking provenance is created with new operations and never backfilled by legacy retries', async t => {
  for (const legacy of [false, true]) {
    const f = fixture(), plan = await f.lab.claim('u1', input), path = paths(plan.stageId)[0];
    assert.equal(f.docs.get(path).uploadTrackingVersion, 1);
    assert.equal(f.docs.get(path).uploadActivityRevision, 0);
    if (legacy) {
      const old = {...f.docs.get(path)};
      delete old.uploadTrackingVersion; delete old.uploadActivityRevision;
      f.docs.set(path, old);
    }
    await f.lab.claim('u1', input);
    const post = await serve(t, f.lab);
    assert.equal((await post(plan.stageId)).status, 200);
    assert.equal(f.docs.get(path).uploadActivityRevision, 1);
    assert.equal(Object.hasOwn(f.docs.get(path), 'uploadTrackingVersion'), !legacy);
    const report = await f.lab.inspectUploadActivity('u1', {stageId: plan.stageId});
    assert.equal(report.trackedFromCreation, !legacy);
    assert.equal(report.cleanupAllowed, false);
  }
});

test('activity inspection rejects incomplete history, malformed receipts and bounded overflow without writes', async t => {
  const f = fixture(), {id} = await verified(t, f);
  const path = paths(id)[0], entryPath = [...f.docs.keys()].find(key => key.startsWith('labRestoreUploadActivity/'));
  const saved = f.docs.get(entryPath), plan = f.docs.get(path), before = f.writes;
  for (const patch of [{ownerUid: 'other'}, {generation: null}, {endedAt: stamp(0)}, {status: 'expired'}]) {
    f.docs.set(entryPath, {...saved, ...patch});
    await assert.rejects(f.lab.inspectUploadActivity('u1', {stageId: id}), /LAB_ACTIVITY_HISTORY/);
  }
  f.docs.delete(entryPath);
  await assert.rejects(f.lab.inspectUploadActivity('u1', {stageId: id}), /LAB_ACTIVITY_HISTORY/);
  f.docs.set(entryPath, saved);
  f.docs.set(path, {...plan, uploadActivityRevision: 101});
  await assert.rejects(f.lab.inspectUploadActivity('u1', {stageId: id}), /LAB_ACTIVITY_LIMIT/);
  f.docs.set(path, plan);
  f.advance(7 * 24 * 60 * 60 * 1000);
  const report = await f.lab.inspectUploadActivity('u1', {stageId: id});
  assert.equal(report.expired, true); assert.equal(report.cleanupAllowed, false);
  assert.equal(f.writes, before);
});

test('malformed activity sequence cannot be normalized into a new upload history', async t => {
  for (const value of [null, -1, 1.5, '1', Number.MAX_SAFE_INTEGER]) {
    const f = fixture(), plan = await f.lab.claim('u1', input), post = await serve(t, f.lab);
    const path = paths(plan.stageId)[0];
    f.docs.set(path, {...f.docs.get(path), uploadActivityRevision: value});
    const before = f.writes;
    assert.equal((await post(plan.stageId)).status, 400);
    assert.equal(f.saves, 0);
    assert.equal(f.writes, before);
    assert.equal(f.docs.get(path).uploadActivityRevision, value);
  }
});

test('upload activity is persisted before save; uncertain or interrupted results are not cleared by retry', async t => {
  for (const mode of ['success', 'uncertain', 'journal-failure']) {
    const f = fixture(), plan = await f.lab.claim('u1', input), post = await serve(t, f.lab);
    const activity = () => [...f.docs.entries()].filter(([path]) => path.startsWith('labRestoreUploadActivity/'));
    f.onSave(() => {
      assert.equal(activity().length, 1);
      assert.equal(activity()[0][1].status, 'active');
      assert.equal(f.docs.get(paths(plan.stageId)[0]).uploadActivityRevision, 1);
      if (mode === 'uncertain') throw Error('SIMULATED_TRANSPORT_LOSS');
      if (mode === 'journal-failure') f.inject('labRestoreUploadActivity/');
    });
    assert.equal((await post(plan.stageId)).status, mode === 'success' ? 200 : 400);
    assert.equal(activity()[0][1].status, mode === 'success' ? 'verified' : mode === 'uncertain' ? 'unknown' : 'active');
    const before = activity()[0][1];
    assert.equal((await post(plan.stageId)).status, 200);
    assert.equal(f.saves, 1);
    assert.equal(activity().length, 1);
    assert.deepEqual(activity()[0][1], before, 'retry is not evidence settling an older attempt');
    f.advance(7 * 24 * 60 * 60 * 1000);
    const report = await f.lab.inspectUploadActivity('u1', {stageId: plan.stageId});
    assert.deepEqual(report.counts, {active: mode === 'journal-failure' ? 1 : 0,
      unknown: mode === 'uncertain' ? 1 : 0, verified: mode === 'success' ? 1 : 0});
    assert.equal(report.expired, true);
    assert.equal(report.cleanupAllowed, false);
  }
});

test('expiry during storage metadata lookup prevents initiating a late upload', async t => {
  const f = fixture(), plan = await f.lab.claim('u1', input), post = await serve(t, f.lab);
  f.onMetadata(() => f.advance(7 * 24 * 60 * 60 * 1000));
  assert.equal((await post(plan.stageId)).status, 409);
  assert.equal(f.saves, 0);
  assert.equal(f.objects.size, 0);
  assert.equal(f.docs.get(paths(plan.stageId)[0]).revision, 1);
});

test('upload just before expiry remains valid, but an in-flight upload crossing expiry stays unpublished', async t => {
  for (const inFlight of [false, true]) {
    const f = fixture(), plan = await f.lab.claim('u1', input), post = await serve(t, f.lab);
    if (inFlight) f.onSave(() => f.advance(7 * 24 * 60 * 60 * 1000));
    else {
      f.onMetadata(() => { f.onMetadata(null); f.advance(7 * 24 * 60 * 60 * 1000 - 1); });
    }
    assert.equal((await post(plan.stageId)).status, inFlight ? 409 : 200);
    assert.equal(f.saves, 1);
    assert.equal(f.objects.size, 1);
    if (inFlight) {
      assert.equal(f.docs.get(paths(plan.stageId)[0]).revision, 1);
      assert.equal(f.docs.get(paths(plan.stageId)[1]).status, 'pending');
      assert.equal(f.docs.has(paths(plan.stageId)[2]), false);
      await assert.rejects(f.lab.publish('u1', {stageId: plan.stageId, expectedRevision: 2}));
      await assert.rejects(f.lab.claim('u1', input), {code: 'LAB_EXPIRED'});
      assert.equal((await post(plan.stageId)).status, 409);
      assert.equal(f.saves, 1, 'expired retry must not upload again');
    } else {
      assert.equal((await f.lab.publish('u1', {stageId: plan.stageId, expectedRevision: 2})).revision, 3);
    }
  }
});

test('claim rechecks expiry after a delayed operation transaction before preparing staging', async () => {
  const f = fixture();
  const run = f.store.runTransaction.bind(f.store);
  let delayed = false;
  f.store.runTransaction = async fn => {
    const result = await run(fn);
    if (!delayed) { delayed = true; f.advance(7 * 24 * 60 * 60 * 1000); }
    return result;
  };
  await assert.rejects(f.lab.claim('u1', input), {code: 'LAB_EXPIRED'});
  assert.equal(f.docs.size, 1, 'operation retained, no staging descriptor created');
  assert.equal(f.saves, 0);
});

test('reclaim after interrupted preparation keeps descriptor expiry bound to original operation', async () => {
  const f = fixture();
  f.inject('backupObjects/');
  await assert.rejects(f.lab.claim('u1', input), /INJECTED/);
  f.advance(10000);
  const plan = await f.lab.claim('u1', input);
  const descriptor = f.docs.get(paths(plan.stageId)[1]);
  assert.equal(descriptor.expiresAt.toMillis(), plan.expiresAtMillis);
  assert.equal(descriptor.createdAt.toMillis(), 1000);
});

test('mapping read joins caller transaction and descriptor conflict prevents candidate write', async t => {
  const f = fixture(), {id} = await verified(t, f);
  await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  const target = doc('labCandidateRecords/u1/items/example'), before = f.writes;
  await assert.rejects(f.store.runTransaction(async tx => {
    const mapping = await f.lab.resolveMappingInTransaction(tx, 'u1', {operationId: input.operationId, stageIds: [id]});
    tx.create(target, {storagePath: mapping[input.storagePath]});
    const [, descriptor] = paths(id);
    f.docs.set(descriptor, {...f.docs.get(descriptor), status: 'pending'});
  }), /read conflict/);
  assert.equal(f.docs.has(target.path), false); assert.equal(f.writes, before);
});

test('two published stages for one source cannot be silently collapsed into one mapping', async t => {
  const f = fixture(), {id, post} = await verified(t, f);
  await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  const changed = Buffer.from('different synthetic encrypted bytes');
  const second = await f.lab.claim('u1', {...input, size: changed.length,
    sha256: createHash('sha256').update(changed).digest('hex')});
  assert.notEqual(second.stageId, id);
  assert.equal((await post(second.stageId, {body: changed})).status, 200);
  await f.lab.publish('u1', {stageId: second.stageId, expectedRevision: 2});
  const before = f.writes;
  for (const stageIds of [[id, second.stageId], [second.stageId, id]]) {
    await assert.rejects(f.lab.resolveMapping('u1', {operationId: input.operationId, stageIds}), /LAB_MAPPING_CONFLICT/);
  }
  assert.equal(f.writes, before);
});

test('attested mapping rewrites into stage reader and rejects wrong operation or unpublished descriptors', async t => {
  const f = fixture(), {id} = await verified(t, f), command = {operationId: input.operationId, stageIds: [id]};
  await assert.rejects(f.lab.resolveMapping('u1', command));
  await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  const before = f.writes, mapping = await f.lab.resolveMapping('u1', command);
  const data = rewriteStorageData('u1', {nested: [{storagePath: input.storagePath}]}, mapping);
  const output = await readAttachmentRoute('u1', data.nested[0].storagePath, {
    readPublished: stageId => f.lab.read('u1', {stageId}), readLegacy: () => assert.fail('legacy fallback')});
  assert.deepEqual(output.bytes, bytes); output.bytes.fill(0);
  await assert.rejects(f.lab.resolveMapping('u1', {...command, operationId: 'other'}), /LAB_OPERATION/);
  await assert.rejects(f.lab.resolveMapping('u2', command));
  await assert.rejects(f.lab.resolveMapping('u1', {...command, stageIds: [id, id]}), /LAB_INPUT/);
  const [, descriptor] = paths(id); f.docs.delete(descriptor);
  await assert.rejects(f.lab.resolveMapping('u1', command)); assert.equal(f.writes, before);
});

test('HTTP download uses stage service, rejects foreign owner and never chooses latest generation', async t => {
  const f = fixture(), {id} = await verified(t, f);
  const published = await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  f.seed(published.destinationPath, Buffer.from('synthetic later version'));
  const server = http.createServer(createRestoreStageDownload({read: f.lab.read,
    verifyIdToken: async token => ({uid: token === 'owner' ? 'u1' : 'u2'}), verifyAppCheck: async () => {}}));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const client = createRestoreStageClient({endpoint: `${origin}/download`, origin, fetchImpl: fetch,
    getCredentials: async () => ({idToken: 'owner', appCheckToken: 'synthetic'}), isActive: () => true});
  const clientResult = await client({stageId: id});
  assert.deepEqual([...clientResult.bytes], [...bytes]); assert.equal(clientResult.generation, '1'); clientResult.bytes.fill(0);
  const download = token => new Promise((resolve, reject) => {
    const req = http.request({host: '127.0.0.1', port: server.address().port, method: 'POST', path: '/download', agent: false,
      headers: {authorization: `Bearer ${token}`, 'x-firebase-appcheck': 'synthetic', 'x-stage-id': id, 'content-length': '0'}}, res => {
      const chunks = []; res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({status: res.statusCode, bytes: Buffer.concat(chunks), generation: res.headers['x-storage-generation']}));
    }); req.on('error', reject); req.end();
  });
  const good = await download('owner'); assert.equal(good.status, 200); assert.deepEqual(good.bytes, bytes); assert.equal(good.generation, '1');
  good.bytes.fill(0);
  const downloads = f.downloads, writes = f.writes;
  assert.equal((await download('foreign')).status, 400); assert.equal(f.downloads, downloads);
  f.objects.get(published.destinationPath).versions.delete('1');
  assert.equal((await download('owner')).status, 400); assert.equal(f.writes, writes);
});

test('reader uses published service and rejects an old session after a new login', {timeout: 5000}, async t => {
  const f = fixture(), {id} = await verified(t, f);
  const published = await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  f.seed(published.destinationPath, Buffer.from('later synthetic generation'));
  let epoch = Symbol('session'), release, returned, signalReady;
  const ready = new Promise(resolve => {signalReady = resolve;});
  const captured = epoch;
  const reader = createRestoreStageReader({isActive: () => epoch === captured,
    readPublished: command => f.lab.read('u1', command)});
  const value = await reader.read(id);
  assert.deepEqual(value.bytes, bytes); assert.equal(value.generation, '1'); value.bytes.fill(0);
  const delayed = createRestoreStageReader({isActive: () => epoch === captured,
    readPublished: async command => {
      returned = await f.lab.read('u1', command);
      await new Promise(resolve => {release = resolve; signalReady();});
      return returned;
    }});
  const pending = delayed.read(id);
  await Promise.race([ready, pending]);
  epoch = Symbol('new session'); release();
  await assert.rejects(pending, /INACTIVE/);
  assert.deepEqual(returned.bytes, Buffer.alloc(bytes.length));
  const downloads = f.downloads;
  await assert.rejects(reader.read(id), /INACTIVE/);
  assert.equal(f.downloads, downloads);
});

test('route, reader and service reject unavailable published generation without legacy fallback', async t => {
  const f = fixture(), {id} = await verified(t, f);
  const published = await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  let legacyCalls = 0;
  const reader = createRestoreStageReader({isActive: () => true,
    readPublished: command => f.lab.read('u1', command)});
  const transports = {readPublished: stageId => reader.read(stageId),
    readLegacy: async () => {legacyCalls++; throw new Error('unexpected legacy');}};
  const value = await readAttachmentRoute('u1', published.destinationPath, transports);
  assert.deepEqual(value.bytes, bytes); value.bytes.fill(0);
  f.seed(published.destinationPath, Buffer.from('synthetic latest must not be used'));
  f.objects.get(published.destinationPath).versions.delete('1');
  const before = f.writes;
  await assert.rejects(readAttachmentRoute('u1', published.destinationPath, transports));
  assert.equal(legacyCalls, 0); assert.equal(f.writes, before);
});

test('real helper lifecycle, verified retry, atomic publication, pinned read and expired published replay', async t => {
  const f = fixture(), {id, post} = await verified(t, f);
  assert.equal(f.saves, 1); assert.equal((await post(id)).status, 200); assert.equal(f.saves, 1);
  const result = await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  f.seed(result.destinationPath, Buffer.from('new generation'));
  const output = await f.build().read('u1', {stageId: id});
  assert.deepEqual(output.bytes, bytes); assert.equal(output.generation, '1'); output.bytes.fill(0);
  const before = f.writes; f.advance(8 * 86400000);
  assert.equal((await f.lab.publish('u1', {stageId: id, expectedRevision: 2})).duplicate, true);
  assert.equal(f.writes, before); assert.equal((await post(id)).status, 409);
});
test('owner mismatch, missing owner and unsafe paths rejected before writes', async () => {
  const f = fixture();
  for (const change of [{expectedOwnerUid: 'u2'}, {expectedOwnerUid: undefined}, {storagePath: 'users/u1/../a'}]) {
    await assert.rejects(f.lab.claim('u1', {...input, ...change}));
  }
  assert.equal(f.writes, 0);
});

test('reclaim of published plan never recreates a missing descriptor', async t => {
  const f = fixture(), {id} = await verified(t, f);
  await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  const [, descriptor] = paths(id); f.docs.delete(descriptor);
  const before = f.writes;
  await assert.rejects(f.lab.claim('u1', input));
  assert.equal(f.writes, before); assert.equal(f.docs.has(descriptor), false);
});
test('crash between plan and descriptor resumes after factory reconstruction', async () => {
  const f = fixture(); f.inject('backupObjects/');
  await assert.rejects(f.lab.claim('u1', input), /INJECTED/);
  assert.equal(f.docs.size, 1);
  const plan = await f.build().claim('u1', input);
  assert.equal(plan.revision, 1); assert.equal(f.docs.size, 2);
});
test('pending expiry and invalid descriptor expiry reject publication without writes', async t => {
  for (const expiry of [undefined, stamp(NaN), stamp(1000)]) {
    const f = fixture(), {id} = await verified(t, f), [, d] = paths(id);
    f.docs.set(d, {...f.docs.get(d), expiresAt: expiry}); const before = f.writes;
    await assert.rejects(f.lab.publish('u1', {stageId: id, expectedRevision: 2}), /EXPIRED/); assert.equal(f.writes, before);
  }
});
test('corrupt plan digest and published record fail before Storage or writes', async t => {
  const f = fixture(), {id} = await verified(t, f), [p, , r] = paths(id);
  const plan = f.docs.get(p); f.docs.set(p, {...plan, bytesSha256: 'a'.repeat(64)});
  await assert.rejects(f.lab.publish('u1', {stageId: id, expectedRevision: 2}), /LAB_PLAN/);
  f.docs.set(p, plan); await f.lab.publish('u1', {stageId: id, expectedRevision: 2});
  f.docs.set(r, {...f.docs.get(r), readerContract: 'latest'});
  const before = f.writes, downloads = f.downloads;
  await assert.rejects(f.lab.read('u1', {stageId: id}), /LAB_RECORD/);
  await assert.rejects(f.lab.publish('u1', {stageId: id, expectedRevision: 2}), /LAB_RECORD/);
  assert.equal(f.writes, before); assert.equal(f.downloads, downloads);
});
test('HTTP rejects auth, method, query, type, unknown stage and streaming oversize', async t => {
  const f = fixture(), plan = await f.lab.claim('u1', input), post = await serve(t, f.lab);
  for (const [options, status] of [[{headers: {authorization: 'Bearer bad'}}, 401],
    [{headers: {'x-firebase-appcheck': 'bad'}}, 401], [{method: 'GET', body: Buffer.alloc(0)}, 405],
    [{path: '/upload?x=1'}, 400], [{headers: {'content-type': 'application/json'}}, 415],
    [{body: Buffer.alloc(f.lab.MAX_BYTES + 1), chunked: true}, 413]]) {
    const result = await post(plan.stageId, options); assert.equal(result.status, status); assert.ok(!result.text.includes('secret-error'));
  }
  assert.equal((await post('a'.repeat(64))).status, 404); assert.equal(f.saves, 0);
  assert.equal((await f.lab.status('u1', {stageId: plan.stageId})).revision, 1);
});
test('wrong bytes and premature or wrong-revision publication never publish', async t => {
  const f = fixture(), plan = await f.lab.claim('u1', input), post = await serve(t, f.lab);
  assert.equal((await post(plan.stageId, {body: Buffer.from('wrong')})).status, 400);
  for (const expectedRevision of [1, 2, 3]) await assert.rejects(f.lab.publish('u1', {stageId: plan.stageId, expectedRevision}));
  assert.equal(f.saves, 0); assert.equal(f.docs.size, 2);
});
test('candidate is not referenced by production index or local Functions runner', () => {
  for (const path of ['../../functions/index.js', '../../scripts/run-functions-emulator-local.mjs']) {
    const text = readFileSync(new URL(path, import.meta.url), 'utf8');
    assert.equal(text.includes('restore-stage-lab'), false);
    assert.equal(text.includes('labRestorePublished'), false);
  }
});

test('changed Storage generation rejects verified retry without rewriting the plan', async t => {
  const f = fixture(), {id, post} = await verified(t, f);
  f.seed(`users/u1/restoreObjects/${id}`, bytes);
  const before = f.writes;
  assert.equal((await post(id)).status, 409);
  assert.equal(f.writes, before);
  assert.equal((await f.lab.status('u1', {stageId: id})).generation, '1');
  assert.equal(f.saves, 1);
});

test('failure after Storage save resumes verified state without a second save', async t => {
  const f = fixture(), plan = await f.lab.claim('u1', input), post = await serve(t, f.lab);
  // Fail the plan transaction after uploadStage has successfully persisted bytes.
  f.onSave(() => f.inject('labRestoreOperations/'));
  assert.equal((await post(plan.stageId)).status, 400);
  assert.equal(f.saves, 1);
  assert.equal((await f.lab.status('u1', {stageId: plan.stageId})).revision, 1);
  assert.equal((await post(plan.stageId)).status, 200);
  const before = f.writes;
  assert.equal((await post(plan.stageId)).status, 200);
  assert.equal(f.saves, 1); assert.equal(f.writes, before);
});

test('aborted raw stream clears retained chunks and leaves stage unverified', {timeout: 2000}, async () => {
  const f = fixture(), plan = await f.lab.claim('u1', input);
  const req = new EventEmitter();
  Object.assign(req, {socket: {remoteAddress: '127.0.0.1'}, method: 'POST', url: '/upload',
    headers: {host: '127.0.0.1:1234', authorization: 'Bearer synthetic',
      'x-firebase-appcheck': 'synthetic', 'x-stage-id': plan.stageId, 'content-type': 'application/octet-stream'},
    resume() {}});
  let status;
  const res = {writeHead(value) {status = value; this.headersSent = true;}, end() {}};
  const running = f.lab.upload(req, res);
  // Observe collector registration rather than racing a fixed timeout.
  for (let attempts = 0; !req.listenerCount('data') && attempts < 100; attempts++) {
    await new Promise(resolve => setImmediate(resolve));
  }
  assert.ok(req.listenerCount('data'), 'collector registered');
  const chunk = Buffer.from('partial-synthetic'); req.emit('data', chunk);
  req.aborted = true; req.destroyed = true; req.emit('aborted');
  await running;
  assert.ok(chunk.every(value => value === 0)); assert.equal(status, 400);
  assert.equal(req.listenerCount('data'), 0); assert.equal(f.saves, 0);
  assert.equal((await f.lab.status('u1', {stageId: plan.stageId})).revision, 1);
});

test('expiry during upload body prevents recreating an interrupted descriptor or saving bytes', async () => {
  const f = fixture();
  f.inject('backupObjects/');
  await assert.rejects(f.lab.claim('u1', input), /INJECTED/);
  const id = [...f.docs.values()][0].stageId, req = new EventEmitter();
  Object.assign(req, {socket: {remoteAddress: '127.0.0.1'}, method: 'POST', url: '/upload',
    headers: {host: 'localhost:1234', authorization: 'Bearer synthetic', 'x-firebase-appcheck': 'synthetic',
      'x-stage-id': id, 'content-type': 'application/octet-stream'}, resume() {}});
  let status;
  const res = {writeHead(value) {status = value; this.headersSent = true;}, end() {}};
  const running = f.lab.upload(req, res);
  for (let i = 0; !req.listenerCount('data') && i < 100; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(req.listenerCount('data'));
  f.advance(7 * 24 * 60 * 60 * 1000);
  req.emit('data', Buffer.from(bytes)); req.readableEnded = true; req.emit('end');
  await running;
  assert.equal(status, 409);
  assert.equal(f.saves, 0);
  assert.equal(f.docs.size, 1);
});

test('oversize clears collected and drained chunks with only one drain listener', async () => {
  const f = fixture(), plan = await f.lab.claim('u1', input), req = new EventEmitter();
  Object.assign(req, {socket: {remoteAddress: '127.0.0.1'}, method: 'POST', url: '/upload',
    headers: {host: 'localhost:1234', authorization: 'Bearer synthetic', 'x-firebase-appcheck': 'synthetic',
      'x-stage-id': plan.stageId, 'content-type': 'application/octet-stream'}, resume() {}});
  let status;
  const res = {writeHead(value) {status = value; this.headersSent = true;}, end() {}};
  const running = f.lab.upload(req, res);
  for (let i = 0; !req.listenerCount('data') && i < 100; i++) await new Promise(resolve => setImmediate(resolve));
  assert.ok(req.listenerCount('data'));
  const first = Buffer.alloc(f.lab.MAX_BYTES, 1), over = Buffer.from('over');
  req.emit('data', first); req.emit('data', over); await running;
  assert.equal(status, 413);
  assert.ok(first.every(value => value === 0)); assert.ok(over.every(value => value === 0));
  assert.equal(req.listenerCount('data'), 1);
  const tail = Buffer.from('tail'); req.emit('data', tail); assert.ok(tail.every(value => value === 0));
  req.readableEnded = true; req.emit('end');
  for (const event of ['data', 'end', 'aborted', 'error']) assert.equal(req.listenerCount(event), 0);
  assert.equal(f.saves, 0);
});
