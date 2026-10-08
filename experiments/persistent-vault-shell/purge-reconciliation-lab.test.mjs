import test from 'node:test';
import assert from 'node:assert/strict';
import {inspectStoppedLabPurge, resumeLabReferenceAfterStop} from './purge-reconciliation-lab.mjs';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {bindLabPurgeTarget} from './purge-target-plan.mjs';
import {claimBoundPurgeSequence, boundPurgeSequenceToken, transitionBoundPurgeSequence} from './purge-bound-sequence-model.mjs';

test('reconciliation rejects forged receipts, inconsistent state and an applied original still present', async () => {
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  try {
    const scope = {id: 'synthetic', bucket: 'demo-purge'};
    const targets = [{kind: 'document', path: 'labPurgeTargets/synthetic', updateTime: {seconds: 1, nanoseconds: 0}}];
    const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, 'op');
    const initial = claimBoundPurgeSequence(prepared, prepared, scope, targets);
    const act = (state, action) => transitionBoundPurgeSequence(state, boundPurgeSequenceToken(state, scope, targets), scope, targets, action);
    const applied = act(act(initial, {type: 'begin', index: 0}), {type: 'outcome', index: 0, outcome: 'applied'});
    const stopped = act(applied, {type: 'stop'});
    const token = boundPurgeSequenceToken(stopped, scope, targets);
    const receipt = {effectId: bindLabPurgeTarget(scope, token, targets[0]).effectId,
      planHash: token.planHash, sequenceIndex: 0, outcome: 'applied'};
    const inspect = (state, data, document = {exists: false}) => inspectStoppedLabPurge({
      projectId: 'demo-purge-fence', doc: path => path,
      runTransaction: callback => callback({get: async () => ({exists: true, data: () => state}),
        getAll: async path => path.startsWith('labPurgeResults/') ? [{exists: true, data: () => data}] : [document]})
    }, scope, targets);
    for (const patch of [{effectId: 'foreign'}, {planHash: 'foreign'}, {sequenceIndex: 1}, {outcome: 'unknown'}]) {
      await assert.rejects(inspect(stopped, {...receipt, ...patch}), /PURGE_RECEIPT_CONFLICT/);
    }
    await assert.rejects(inspect(act(initial, {type: 'stop'}), receipt), /PURGE_RECEIPT_CONFLICT/);
    await assert.rejects(inspect(applied, receipt), /PURGE_NOT_STOPPED/);
    await assert.rejects(inspect({...stopped, stateRevision: 99}, receipt), /PURGE_SEQUENCE_STATE_CONFLICT/);
    await assert.rejects(inspect(stopped, receipt, {exists: true, updateTime: targets[0].updateTime}), /PURGE_EVIDENCE_CONFLICT/);
    const report = await inspect(stopped, receipt);
    assert.equal(report.writeAllowed, false);
    assert.throws(() => { report.writeAllowed = true; }, TypeError);
    assert.throws(() => { report.items[0].outcome = 'unstarted'; }, TypeError);
  } finally {
    if (previous === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous;
  }
});

test('read-only reconciliation keeps absent pending/unknown unresolved and rejects unsupported applied', async () => {
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  try {
    const scope = {id: 'synthetic', bucket: 'demo-purge'};
    const targets = [{kind: 'document', path: 'labPurgeTargets/synthetic', updateTime: {seconds: 1, nanoseconds: 0}}];
    const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, 'op');
    const initial = claimBoundPurgeSequence(prepared, prepared, scope, targets);
    const act = (state, action) => transitionBoundPurgeSequence(state, boundPurgeSequenceToken(state, scope, targets), scope, targets, action);
    for (const outcome of ['pending', 'unknown', 'applied']) {
      let state = act(initial, {type: 'begin', index: 0});
      if (outcome !== 'pending') state = act(state, {type: 'outcome', index: 0, outcome});
      state = act(state, {type: 'stop'});
      const before = JSON.stringify(state);
      const store = {projectId: 'demo-purge-fence', doc: path => path,
        runTransaction: callback => callback({get: async () => ({exists: true, data: () => state}),
          getAll: async () => [{exists: false}]})};
      if (outcome === 'applied') await assert.rejects(inspectStoppedLabPurge(store, scope, targets), /PURGE_RECEIPT_CONFLICT/);
      else {
        const report = await inspectStoppedLabPurge(store, scope, targets);
        assert.equal(report.unresolved, true);
        assert.equal(report.writeAllowed, false);
        assert.equal(report.items[0].outcome, outcome);
        assert.equal(report.items[0].confirmedApplied, false);
        await assert.rejects(resumeLabReferenceAfterStop(store, scope, targets, 0, 'retry', report.stateRevision), /PURGE_RESUME_CONFLICT/);
      }
      assert.equal(JSON.stringify(state), before);
    }
  } finally {
    if (previous === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous;
  }
});
