import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {createResumePlanLab} from './restore-resume-plan-lab.mjs';
import {createRestoreChunkLab} from './restore-chunk-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex');

test('expiry cleanup racing resume cannot publish unfinished chunks or erase completed work', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const projectId = 'demo-m8-stage', app = initializeApp({projectId}, randomUUID());
  const store = getFirestore(app), uid = `synthetic-${randomUUID()}`;
  let time = 1000;
  const options = {store, projectId, now: () => time};
  const commands = [0, 1].map(index => ({expectedOwnerUid: uid, operationId: `chunk-${index}`,
    backupId: 'backup', chunkIndex: index, chunkCount: 2, mode: 'apply', confirmation: 'RESTORE_VALIDATED',
    records: [{scope: 'private-account', id: `account-${index}`, expectedVersion: {exists: false}, data: {synthetic: index}}]}));
  const stages = commands.map(() => ({restoreOperationId: 'restore', stageIds: []}));
  try {
    const plans = createResumePlanLab(options), writer = createRestoreChunkLab(options);
    const plan = await plans.create(uid, commands, stages);
    await writer.commit(uid, commands[0], stages[0], {planId: plan.planId, inputs: commands, stageCommands: stages});
    const first = store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/accounts/account-0`)}`);
    const before = await first.get();
    time = plan.expiresAtMs;
    const [cleanup, resume] = await Promise.allSettled([plans.sweepExpired(uid), writer.commitPlan(uid, plan.planId, commands, stages)]);
    assert.equal(cleanup.status, 'fulfilled'); assert.equal(cleanup.value.removed, 1);
    assert.equal(resume.status, 'rejected');
    assert.match(resume.reason.message, /EXPIRED_NEW_PREVIEW|MISSING_NEW_PREVIEW/);
    assert.ok((await first.get()).updateTime.isEqual(before.updateTime));
    assert.equal((await store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/accounts/account-1`)}`).get()).exists, false);
    assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size, 1);
    await assert.rejects(plans.save(uid, plan.planId, commands, stages), /MISSING_NEW_PREVIEW/);
  } finally {await store.terminate(); await deleteApp(app);}
});

test('multi-chunk resume after lost response preserves first write and applies only remaining chunk', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const projectId = 'demo-m8-stage', app = initializeApp({projectId}, randomUUID());
  const store = getFirestore(app), uid = `synthetic-${randomUUID()}`;
  let time = 1000;
  const options = {store, projectId, now: () => time};
  const commands = [0, 1].map(index => ({expectedOwnerUid: uid, operationId: `chunk-${index}`,
    backupId: 'backup', chunkIndex: index, chunkCount: 2, mode: 'apply', confirmation: 'RESTORE_VALIDATED',
    records: [{scope: 'private-account', id: `account-${index}`, expectedVersion: {exists: false}, data: {synthetic: index}}]}));
  const stages = commands.map(() => ({restoreOperationId: 'restore', stageIds: []}));
  try {
    const plans = createResumePlanLab(options), plan = await plans.create(uid, commands, stages);
    const writer = createRestoreChunkLab(options);
    const context = {planId: plan.planId, inputs: commands, stageCommands: stages};
    await writer.commit(uid, commands[0], stages[0], context); // Response intentionally ignored.
    const firstRef = store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/accounts/account-0`)}`);
    const first = await firstRef.get();
    assert.deepEqual((await plans.reconcile(uid, plan.planId, commands, stages)).chunks.map(c => c.status), ['applied', 'unconfirmed']);
    const result = await createRestoreChunkLab(options).commitPlan(uid, plan.planId, commands, stages);
    assert.equal(result.status, 'completed');
    assert.deepEqual(result.results.map(r => r.duplicate), [true, false]);
    assert.ok((await firstRef.get()).updateTime.isEqual(first.updateTime));
    assert.deepEqual((await plans.reconcile(uid, plan.planId, commands, stages)).chunks.map(c => c.status), ['applied', 'applied']);
    time = plan.expiresAtMs;
    await assert.rejects(writer.commitPlan(uid, plan.planId, commands, stages), /EXPIRED_NEW_PREVIEW/);
    assert.ok((await firstRef.get()).updateTime.isEqual(first.updateTime));
  } finally {await deleteApp(app);}
});

test('stale first chunk stops the plan without touching later chunks or receipts', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const projectId = 'demo-m8-stage', app = initializeApp({projectId}, randomUUID());
  const store = getFirestore(app), uid = `synthetic-${randomUUID()}`;
  const options = {store, projectId, now: () => 1000};
  const commands = [0, 1].map(index => ({expectedOwnerUid: uid, operationId: `chunk-${index}`,
    backupId: 'backup', chunkIndex: index, chunkCount: 2, mode: 'apply', confirmation: 'RESTORE_VALIDATED',
    records: [{scope: 'private-account', id: `account-${index}`, expectedVersion: {exists: false}, data: {synthetic: index}}]}));
  const stages = commands.map(() => ({restoreOperationId: 'restore', stageIds: []}));
  try {
    const plan = await createResumePlanLab(options).create(uid, commands, stages);
    const refs = commands.map((_, index) => store.doc(`labCandidateRecords/${uid}/items/${hash(`users/${uid}/accounts/account-${index}`)}`));
    await refs[0].set({synthetic: 'concurrent-change'});
    const before = await refs[0].get();
    const result = await createRestoreChunkLab(options).commitPlan(uid, plan.planId, commands, stages);
    assert.equal(result.status, 'stopped');
    assert.equal(result.index, 0);
    assert.equal(result.results[0].status, 'stale-preview');
    assert.ok((await refs[0].get()).updateTime.isEqual(before.updateTime));
    assert.equal((await refs[1].get()).exists, false);
    assert.equal((await store.collection(`labRestoreChunkReceipts/${uid}/items`).get()).size, 0);
  } finally {await deleteApp(app);}
});
