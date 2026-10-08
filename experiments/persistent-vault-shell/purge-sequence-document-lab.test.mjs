import test from 'node:test';
import assert from 'node:assert/strict';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {claimBoundPurgeSequence, boundPurgeSequenceToken} from './purge-bound-sequence-model.mjs';
import {deleteLabPurgeSequenceDocument} from './purge-sequence-document-lab.mjs';

test('document executor rejects object targets before reading receipts or starting a transaction', async () => {
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  try {
    const scope = {id: 'synthetic', bucket: 'demo-purge'};
    const targets = [{kind: 'object', path: 'labPurgeObjects/synthetic/one', bucket: scope.bucket, generation: '1'}];
    const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, 'op');
    const state = claimBoundPurgeSequence(prepared, prepared, scope, targets);
    const expected = boundPurgeSequenceToken(state, scope, targets);
    let transactions = 0;
    const store = {projectId: 'demo-purge-fence', doc: path => ({path}), runTransaction: async () => { transactions++; throw Error('UNEXPECTED_TRANSACTION'); }};
    await assert.rejects(deleteLabPurgeSequenceDocument(store, scope, expected, targets, 0), /PURGE_SEQUENCE_CONFLICT/);
    assert.equal(transactions, 0);
  } finally {
    if (previous === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous;
  }
});

test('sequence executor captures caller token and scope before asynchronous reads', async () => {
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  try {
    for (const mutation of ['token', 'scope']) {
    const scope = {id: 'synthetic', bucket: 'demo-purge'};
    const target = {kind: 'document', path: 'labPurgeTargets/synthetic/items/one',
      updateTime: {seconds: 1, nanoseconds: 0}};
    const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, 'op');
    const state = claimBoundPurgeSequence(prepared, prepared, scope, [target]);
    const expected = {...boundPurgeSequenceToken(state, scope, [target])};
    const writes = [];
    const store = {projectId: 'demo-purge-fence', doc: path => ({path}),
      runTransaction: callback => callback({
        get: async () => {
          if (mutation === 'token') expected.stateRevision = 999;
          else scope.id = 'changed';
          return {exists: false};
        },
        getAll: async () => [{exists: true, data: () => state},
          {exists: true, updateTime: target.updateTime}],
        delete: ref => writes.push(['delete', ref.path]),
        set: (ref, value) => writes.push(['state', ref.path, value]),
        create: ref => writes.push(['receipt', ref.path])
      })};
    const result = await deleteLabPurgeSequenceDocument(store, scope, expected, [target], 0);
    assert.equal(result.outcome, 'applied');
    assert.equal(writes[0][1], target.path);
    assert.equal(writes[1][1], 'labPurgeStates/synthetic');
    assert.deepEqual(writes[1][2].sequence.outcomes, ['applied']);
    assert.equal(writes.length, 3);
    }
  } finally {
    if (previous === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous;
  }
});
