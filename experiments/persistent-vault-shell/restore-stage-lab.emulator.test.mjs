import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import http from 'node:http';
import {createRestoreStageLab} from './restore-stage-lab.mjs';
import {createRestoreChunkLab} from './restore-chunk-lab.mjs';
import {createResumePlanLab} from './restore-resume-plan-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, Timestamp} = require('firebase-admin/firestore');

test('expired upload cleanup preparation serializes and never calls Storage', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const projectId = 'demo-m8-stage', app = initializeApp({projectId}, `cleanup-${randomUUID()}`);
  const store = getFirestore(app), uid = `synthetic-${randomUUID()}`;
  const stage = require('./backup-attachment-stage.js');
  const input = {expectedOwnerUid: uid, operationId: 'cleanup', storagePath: `users/${uid}/attachments/a`,
    size: 1, sha256: createHash('sha256').update('x').digest('hex')};
  const identity = stage.stageIdentity(uid, input), id = identity.id, stamp = Timestamp.fromMillis;
  const operation = store.doc(`labRestoreOperations/${uid}/items/${id}`);
  const activity = store.doc(`labRestoreUploadActivity/${uid}/items/attempt`);
  const lab = createRestoreStageLab({store, bucket: {file() {assert.fail('Storage must not be touched');}}, projectId,
    now: () => 1 + stage.STAGE_TTL_MS, timestamp: stamp, verifyIdToken: async () => ({uid}), verifyAppCheck: async () => {}});
  try {
    await operation.create({ownerUid: uid, stageId: id, domain: 'backup-restore-lab', bindingVersion: 1,
      input, identity, revision: 2, generation: '1', bytesSha256: identity.sha256, publishedPath: null,
      uploadTrackingVersion: 1, uploadActivityRevision: 1, createdAt: stamp(1), updatedAt: stamp(2), expiresAtMillis: 1 + stage.STAGE_TTL_MS});
    await stage.stageRef(store, uid, id).create({...identity, status: 'pending', createdAt: stamp(1), expiresAt: stamp(1 + stage.STAGE_TTL_MS)});
    await activity.create({ownerUid: uid, stageId: id, status: 'active', generation: null, startedAt: stamp(1)});
    await assert.rejects(lab.prepareUploadCleanup(uid, {stageId: id}), /LAB_CLEANUP_BLOCKED/);
    assert.equal(Object.hasOwn((await operation.get()).data(), 'cleanup'), false);
    await activity.update({status: 'verified', generation: '1', endedAt: stamp(2)});
    const results = await Promise.all([0, 1].map(() => lab.prepareUploadCleanup(uid, {stageId: id})));
    assert.deepEqual(results.map(result => result.duplicate).sort(), [false, true]);
    assert.equal(results[0].cleanupId, results[1].cleanupId);
    assert.ok(results.every(result => result.cleanupAllowed === false));
    const before = await operation.get();
    await lab.prepareUploadCleanup(uid, {stageId: id});
    assert.ok((await operation.get()).updateTime.isEqual(before.updateTime));
  } finally {await store.terminate(); await deleteApp(app);}
});

test('actual Firestore concurrent publication and reconstructed replay preserve all three records', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const projectId = 'demo-m8-stage', app = initializeApp({projectId}, `m8-${randomUUID()}`);
  const store = getFirestore(app), uid = `synthetic-${randomUUID()}`;
  const bytes = Buffer.from('synthetic-ciphertext'), objects = new Map();
  // Storage remains synthetic: this test proves Firestore transactions, not GCS CAS.
  const bucket = {file(path, options = {}) { return {
    async getMetadata() {
      if (!objects.has(path)) throw Object.assign(new Error('missing'), {code: 404});
      return [{size: bytes.length, generation: '90071992547409931234'}];
    }, async save(value, config) {
      assert.equal(config.preconditionOpts.ifGenerationMatch, 0);
      const activity = await lab.inspectUploadActivity(uid, {stageId: path.split('/').at(-1)});
      assert.deepEqual(activity.counts, {active: 1, unknown: 0, verified: 0});
      assert.equal(activity.cleanupAllowed, false);
      if (objects.has(path)) throw Object.assign(new Error('exists'), {code: 412});
      objects.set(path, Buffer.from(value));
    }, async download() {
      assert.equal(options.generation, '90071992547409931234');
      return [Buffer.from(objects.get(path))];
    }
  }; }};
  const build = () => createRestoreStageLab({store, bucket, projectId, now: Date.now,
    timestamp: value => Timestamp.fromMillis(value),
    verifyIdToken: async token => {assert.equal(token, 'synthetic'); return {uid};},
    verifyAppCheck: async token => {assert.equal(token, 'synthetic');}});
  const lab = build(), server = http.createServer(lab.upload);
  try {
    const plan = await lab.claim(uid, {expectedOwnerUid: uid, operationId: 'restore',
      storagePath: `users/${uid}/attachments/a`, size: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')});
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const status = await new Promise((resolve, reject) => {
      const request = http.request({host: '127.0.0.1', port: server.address().port, path: '/upload', method: 'POST',
        headers: {authorization: 'Bearer synthetic', 'x-firebase-appcheck': 'synthetic',
          'x-stage-id': plan.stageId, 'content-type': 'application/octet-stream'}}, response => {
        response.resume(); response.on('end', () => resolve(response.statusCode));
      }); request.on('error', reject); request.end(bytes);
    });
    assert.equal(status, 200);
    assert.deepEqual(await lab.inspectUploadActivity(uid, {stageId: plan.stageId}), {
      trackedFromCreation: true, attempts: 1, counts: {active: 0, unknown: 0, verified: 1},
      expired: false, cleanupAllowed: false
    });
    const command = {stageId: plan.stageId, expectedRevision: 2};
    const results = await Promise.all([lab.publish(uid, command), build().publish(uid, command)]);
    assert.deepEqual(results.map(r => r.duplicate).sort(), [false, true]);
    const refs = ['labRestoreOperations', 'backupObjects', 'labRestorePublished'].map(root =>
      store.doc(`${root}/${uid}/items/${plan.stageId}`));
    const snapshot = async () => Promise.all(refs.map(async ref => {
      const snap = await ref.get(); return {data: snap.data(), updateTime: snap.updateTime.toMillis()};
    }));
    const before = await snapshot();
    // Treat the first successful response as lost: reconstruct then retry.
    assert.equal((await build().publish(uid, command)).duplicate, true);
    await assert.rejects(lab.publish(uid, {...command, expectedRevision: 1}), /LAB_CAS/);
    assert.deepEqual(await snapshot(), before);
    const out = await build().read(uid, {stageId: plan.stageId});
    assert.deepEqual(out.bytes, bytes); out.bytes.fill(0);
    const target = store.doc(`labCandidateRecords/${uid}/items/mapped`);
    const mappingCommand = {operationId: 'restore', stageIds: [plan.stageId]};
    await store.runTransaction(async tx => {
      const mapping = await lab.resolveMappingInTransaction(tx, uid, mappingCommand);
      tx.create(target, {storagePath: mapping[`users/${uid}/attachments/a`]});
    });
    assert.equal((await target.get()).data().storagePath, before[2].data.destinationPath);
    let mappingAttempts = 0;
    const increment = () => store.runTransaction(async tx => {
      mappingAttempts++;
      const current = await tx.get(target);
      const mapping = await lab.resolveMappingInTransaction(tx, uid, mappingCommand);
      tx.update(target, {count: (current.data().count || 0) + 1,
        storagePath: mapping[`users/${uid}/attachments/a`]});
    });
    await Promise.all([increment(), increment()]);
    assert.equal((await target.get()).data().count, 2);
    assert.equal((await target.get()).data().storagePath, before[2].data.destinationPath);
    assert.deepEqual(await snapshot(), before);
    console.log(`Concurrent mapping transaction callback attempts: ${mappingAttempts}`);
    let resumeTime = 1000;
    const chunkLab = createRestoreChunkLab({store, stageLab: lab, projectId, now: () => resumeTime});
    const chunk = {expectedOwnerUid: uid, mode: 'apply', operationId: 'chunk-1', backupId: 'backup',
      chunkIndex: 0, chunkCount: 1, confirmation: 'RESTORE_VALIDATED', records: [
        {scope: 'private-account', id: 'restored', expectedVersion: {exists: false},
          data: {storagePath: `users/${uid}/attachments/a`, sharedWithUids: ['synthetic-untrusted']}}]};
    const stageCommand = {restoreOperationId: 'restore', stageIds: [plan.stageId]};
    const resume = createResumePlanLab({store, projectId, now: () => 1000});
    const resumePlan = await resume.create(uid, [chunk], [stageCommand]);
    const resumeContext = {planId: resumePlan.planId, inputs: [chunk], stageCommands: [stageCommand]};
    assert.equal((await resume.reconcile(uid, resumePlan.planId, [chunk], [stageCommand])).chunks[0].status, 'unconfirmed');
    resumeTime = resumePlan.expiresAtMs;
    await assert.rejects(chunkLab.commit(uid, chunk, stageCommand, resumeContext), /EXPIRED_NEW_PREVIEW/);
    resumeTime = 1001;
    await assert.rejects(chunkLab.commit(uid, {...chunk, operationId: 'substituted'}, stageCommand, resumeContext), /MISMATCH/);
    const commits = await Promise.all([chunkLab.commit(uid, chunk, stageCommand, resumeContext), chunkLab.commit(uid, chunk, stageCommand, resumeContext)]);
    assert.deepEqual(commits.map(result => result.duplicate).sort(), [false, true]);
    const reopened = createResumePlanLab({store, projectId, now: () => 1001});
    assert.deepEqual(await reopened.reopen(uid, resumePlan.planId, [chunk], [stageCommand]), resumePlan);
    assert.equal((await reopened.reconcile(uid, resumePlan.planId, [chunk], [stageCommand])).chunks[0].status, 'applied');
    resumeTime = resumePlan.expiresAtMs;
    await assert.rejects(chunkLab.commit(uid, chunk, stageCommand, resumeContext), /EXPIRED_NEW_PREVIEW/);
    resumeTime = 1001;
    await assert.rejects(reopened.reconcile(uid, resumePlan.planId, [chunk], [{...stageCommand, stageIds: []}]), /MISMATCH/);
    const digest = value => createHash('sha256').update(value).digest('hex');
    const chunkTarget = store.doc(`labCandidateRecords/${uid}/items/${digest(`users/${uid}/accounts/restored`)}`);
    const chunkReceipt = store.doc(`labRestoreChunkReceipts/${uid}/items/${digest('chunk-1')}`);
    const committed = await chunkTarget.get(), received = await chunkReceipt.get();
    assert.equal(committed.data().storagePath, before[2].data.destinationPath);
    assert.deepEqual(committed.data().sharedWithUids, []);
    assert.match(received.data().rewriteHash, /^[a-f0-9]{64}$/);
    assert.equal((await chunkLab.commit(uid, {...chunk, operationId: 'stale'}, stageCommand)).status, 'stale-preview');
    assert.equal((await store.doc(`labRestoreChunkReceipts/${uid}/items/${digest('stale')}`).get()).exists, false);
    await chunkTarget.update({sharedWithUids: ['synthetic-current'], visibility: 'shared'});
    const current = await chunkTarget.get();
    const overwrite = {...chunk, operationId: 'overwrite', records: [{...chunk.records[0],
      expectedVersion: {exists: true, updateTime: {seconds: current.updateTime.seconds,
        nanoseconds: current.updateTime.nanoseconds}}}]};
    assert.equal((await chunkLab.commit(uid, overwrite, stageCommand)).status, 'collision');
    const overwriteReceipt = store.doc(`labRestoreChunkReceipts/${uid}/items/${digest('overwrite')}`);
    assert.equal((await overwriteReceipt.get()).exists, false);
    assert.ok((await chunkTarget.get()).updateTime.isEqual(current.updateTime));
    overwrite.overwriteExisting = true; overwrite.confirmation = 'RESTORE_SELECTED_OVERWRITE';
    assert.equal((await chunkLab.commit(uid, overwrite, stageCommand)).status, 'applied');
    const overwritten = await chunkTarget.get();
    assert.deepEqual(overwritten.data().sharedWithUids, ['synthetic-current']);
    assert.equal(overwritten.data().visibility, 'shared');
    assert.equal((await overwriteReceipt.get()).data().status, 'applied');
    const sentinel = store.doc(`labCandidateRecords/${uid}/items/rollback-sentinel`);
    await sentinel.create({synthetic: true});
    // Inject an impossible create precondition into the actual SDK commit.
    // The emulator, not a local mock, must reject the whole write set.
    const failingStore = {projectId, doc: path => store.doc(path),
      runTransaction: fn => store.runTransaction(async tx => {
        const result = await fn(tx);
        tx.create(sentinel, {synthetic: false});
        return result;
      })};
    const failingLab = createRestoreChunkLab({store: failingStore, stageLab: lab, projectId});
    const failedChunk = {...chunk, operationId: 'atomic-failure',
      records: [{...chunk.records[0], id: 'atomic-failure'}]};
    await assert.rejects(failingLab.commit(uid, failedChunk, stageCommand), error => error.code === 6);
    assert.equal((await store.doc(`labCandidateRecords/${uid}/items/${digest(`users/${uid}/accounts/atomic-failure`)}`).get()).exists, false);
    assert.equal((await store.doc(`labRestoreChunkReceipts/${uid}/items/${digest('atomic-failure')}`).get()).exists, false);
    assert.deepEqual((await sentinel.get()).data(), {synthetic: true});
    const typedLab = createRestoreChunkLab({store, stageLab: lab, projectId,
      types: {timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds),
        bytes: value => Buffer.from(value)}});
    const typedChunk = {...chunk, operationId: 'typed', records: [{...chunk.records[0], id: 'typed',
      data: {at: {$type: 'timestamp', seconds: 123, nanoseconds: 456000},
        bytes: {$type: 'bytes', value: [0, 127, 255]},
        date: {$type: 'date', value: '2026-01-01T00:00:00.000Z'}}}]};
    assert.equal((await typedLab.commit(uid, typedChunk, {...stageCommand, stageIds: []})).status, 'applied');
    const typed = (await store.doc(`labCandidateRecords/${uid}/items/${digest(`users/${uid}/accounts/typed`)}`).get()).data();
    assert.equal(typed.at.seconds, 123); assert.equal(typed.at.nanoseconds, 456000);
    const unsupportedChunk = {...typedChunk, operationId: 'unsupported-precision',
      records: [{...typedChunk.records[0], id: 'unsupported-precision',
        data: {at: {$type: 'timestamp', seconds: 123, nanoseconds: 456}}}]};
    await assert.rejects(typedLab.commit(uid, unsupportedChunk, {...stageCommand, stageIds: []}), /BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED/);
    assert.equal((await store.doc(`labCandidateRecords/${uid}/items/${digest(`users/${uid}/accounts/unsupported-precision`)}`).get()).exists, false);
    assert.equal((await store.doc(`labRestoreChunkReceipts/${uid}/items/${digest('unsupported-precision')}`).get()).exists, false);
    assert.deepEqual(typed.bytes, Buffer.from([0, 127, 255]));
    // Firestore stores a JS Date as Timestamp, not as a distinct Date type.
    assert.equal(typed.date.toDate().toISOString(), '2026-01-01T00:00:00.000Z');
    await refs[2].update({destinationPath: `users/${uid}/restoreObjects/wrong`});
    const corrupted = await snapshot();
    const rejectedTarget = store.doc(`labCandidateRecords/${uid}/items/rejected`);
    await assert.rejects(store.runTransaction(async tx => {
      const mapping = await lab.resolveMappingInTransaction(tx, uid, mappingCommand);
      tx.create(rejectedTarget, {storagePath: mapping[`users/${uid}/attachments/a`]});
    }), /LAB_RECORD/);
    assert.equal((await rejectedTarget.get()).exists, false);
    await assert.rejects(lab.publish(uid, command), /LAB_RECORD/);
    await assert.rejects(lab.read(uid, command), /LAB_RECORD/);
    assert.deepEqual(await snapshot(), corrupted);
    assert.equal((await chunkLab.commit(uid, chunk, stageCommand)).duplicate, true);
    await assert.rejects(chunkLab.commit(uid, {...chunk, backupId: 'different'}, stageCommand), /LAB_CHUNK_BINDING/);
    assert.ok((await chunkTarget.get()).updateTime.isEqual(overwritten.updateTime));
    assert.ok((await chunkReceipt.get()).updateTime.isEqual(received.updateTime));
  } finally {
    if (server.listening) await new Promise(resolve => server.close(resolve));
    await store.terminate(); await deleteApp(app);
  }
});
