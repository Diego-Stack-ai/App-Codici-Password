import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestoreStageHandler} from './restore-stage-handler.mjs';
const trusted = {auth: {uid: 'u1'}, app: {appId: 'synthetic'}};
const stageId = 'a'.repeat(64);
test('stage metadata boundary rejects forged authority before any service call', async () => {
  const calls = [];
  const stageLab = Object.fromEntries(['claim', 'status', 'publish'].map(key => [key, async (...args) => {calls.push([key, ...args]); return {stageId};}]));
  const handle = createRestoreStageHandler({stageLab});
  const data = {expectedOwnerUid: 'u1', action: 'status', stageId};
  for (const auth of [null, {}, {auth: {uid: 'u1'}}, {auth: {uid: '../u1'}, app: trusted.app}])
    await assert.rejects(handle(data, auth), /STAGE_UNAUTHENTICATED/);
  await assert.rejects(handle({...data, expectedOwnerUid: 'u2'}, trusted), /OWNER_MISMATCH/);
  for (const extra of [{uid: 'u2'}, {generation: '1'}, {storagePath: 'arbitrary'}, {action: 'delete'}, {stageId: 'invalid'}])
    await assert.rejects(handle({...data, ...extra}, trusted), /REQUEST_INVALID/);
  await assert.rejects(handle({...data, action: 'publish', expectedRevision: 3}, trusted), /REQUEST_INVALID/);
  assert.equal(calls.length, 0);
  await handle(data, trusted);
  await handle({...data, action: 'publish', expectedRevision: 2}, trusted);
  assert.deepEqual(calls, [['status', 'u1', {stageId}], ['publish', 'u1', {stageId, expectedRevision: 2}]]);
});
test('claim passes a detached command and propagates service rejection without retry', async () => {
  let seen, calls = 0;
  const handle = createRestoreStageHandler({stageLab: {
    status() {}, publish() {}, async claim(uid, input) {seen = input; calls++; await Promise.resolve(); throw Error('LAB_EXPIRED');}
  }});
  const data = {expectedOwnerUid: 'u1', action: 'claim', operationId: 'op1', storagePath: 'users/u1/attachments/a', sha256: stageId, size: 1};
  const pending = handle(data, trusted);
  data.storagePath = 'users/u2/attachments/b';
  await assert.rejects(pending, /LAB_EXPIRED/);
  assert.equal(seen.storagePath, 'users/u1/attachments/a');
  assert.equal(Object.hasOwn(seen, 'action'), false);
  assert.equal(calls, 1);
});
