import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestoreResumeHandler} from './restore-resume-handler.mjs';
test('resume handler admits server identity only and never exposes unbound commit or arbitrary deletion', async () => {
  const calls = [];
  const plans = {create: async (...args) => {calls.push(args); return {planId: 'server-id', expiresAtMs: 123, privateMetadata: 'hidden'};},
    reconcile: async (...args) => {calls.push(args); return {chunks: []};}};
  const writer = {commitPlan: async (...args) => {calls.push(args); return {status: 'completed'};}};
  const run = createRestoreResumeHandler({plans, writer});
  const trusted = {auth: {uid: 'synthetic'}, app: {appId: 'synthetic'}};
  const data = {expectedOwnerUid: 'synthetic', action: 'create', inputs: [], stageCommands: []};
  for (const context of [undefined, {}, {auth: trusted.auth}, {auth: {uid: 'other'}, app: trusted.app}])
    await assert.rejects(run(data, context), /UNAUTHENTICATED|OWNER_MISMATCH/);
  for (const changed of [{...data, planId: 'client-chosen'}, {...data, uid: 'forged'}, {...data, action: 'delete', planId: 'plan'}])
    await assert.rejects(run(changed, trusted), /REQUEST_INVALID/);
  assert.equal(calls.length, 0);
  assert.deepEqual(await run(data, trusted), {planId: 'server-id', expiresAtMs: 123});
  assert.deepEqual(await run({...data, action: 'inspect', planId: 'plan'}, trusted), {chunks: []});
  assert.deepEqual(await run({...data, action: 'resume', planId: 'plan'}, trusted), {status: 'completed'});
  assert.equal(calls.length, 3);
  assert.ok(calls.every(args => args[0] === 'synthetic'));
});

test('expiry cleanup is owner scoped and uses server bounded page size, never supplied retention', async () => {
  const calls = [];
  const run = createRestoreResumeHandler({plans: {sweepExpired: async (...args) => {calls.push(args); return {removed: 1};}}, writer: {}});
  const trusted = {auth: {uid: 'synthetic'}, app: {appId: 'test'}};
  const data = {expectedOwnerUid: 'synthetic', action: 'cleanupExpired'};
  await assert.rejects(run(data, {}), /UNAUTHENTICATED/);
  for (const extra of [{expectedOwnerUid: 'other'}, {retention: 0}, {limit: 10000}, {planId: 'arbitrary'}, {after: '../foreign'}])
    await assert.rejects(run({...data, ...extra}, trusted), /OWNER_MISMATCH|REQUEST_INVALID/);
  assert.deepEqual(await run(data, trusted), {removed: 1});
  assert.deepEqual(calls, [['synthetic', {limit: 50, after: null}]]);
});

test('reconstruction is owner-authenticated, read-only and does not accept replacement commands', async () => {
  let called = 0;
  const run = createRestoreResumeHandler({plans: {reconstruct: async (...args) => {called++; return args;}}, writer: {}});
  const trusted = {auth: {uid: 'synthetic'}, app: {appId: 'synthetic'}};
  const data = {expectedOwnerUid: 'synthetic', action: 'reconstruct', planId: 'plan', backupId: 'backup', records: []};
  assert.deepEqual(await run(data, trusted), ['synthetic', 'plan', 'backup', []]);
  await assert.rejects(run(data, {}), /UNAUTHENTICATED/);
  await assert.rejects(run({...data, expectedOwnerUid: 'other'}, trusted), /OWNER_MISMATCH/);
  await assert.rejects(run({...data, inputs: []}, trusted), /REQUEST_INVALID/);
  assert.equal(called, 1);
});
test('preview and creation recovery accept only their own payload shapes', async () => {
  const calls = [];
  const run = createRestoreResumeHandler({plans: {preview: async (...args) => calls.push(args), recoverCreation: async (...args) => calls.push(args)}, writer: {}});
  const trusted = {auth: {uid: 'synthetic'}, app: {appId: 'test'}};
  const preview = {expectedOwnerUid: 'synthetic', action: 'preview', inputs: []};
  await run(preview, trusted);
  await assert.rejects(run({...preview, planId: 'forged'}, trusted), /REQUEST_INVALID/);
  const recovery = {...preview, action: 'recoverCreation', stageCommands: []};
  await run(recovery, trusted);
  await assert.rejects(run({...recovery, planId: 'forged'}, trusted), /REQUEST_INVALID/);
  await assert.rejects(run({...recovery, expectedOwnerUid: 'other'}, trusted), /OWNER_MISMATCH/);
  assert.equal(calls.length, 2);
});
