import test from 'node:test';
import assert from 'node:assert/strict';
import {deleteLabPurgeDocument} from './purge-document-lab.mjs';
import {bindLabPurgeTarget} from './purge-target-plan.mjs';
test('environment guards and corrupt receipts fail before any target access', async () => {
  const original = process.env.FIRESTORE_EMULATOR_HOST;
  const scope = {id: 'synthetic', bucket: 'demo-purge'};
  const token = {operationId: 'op', claimRevision: 2, stopRevision: 0, stateRevision: 0};
  const target = {kind: 'document', path: 'labPurgeTargets/synthetic', updateTime: {seconds: 1, nanoseconds: 0}};
  const {effectId} = bindLabPurgeTarget(scope, token, target);
  let accesses = 0;
  const guarded = {projectId: 'demo-purge-fence', doc() { accesses++; throw new Error('UNEXPECTED_ACCESS'); }};
  try {
    process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8085';
    await assert.rejects(deleteLabPurgeDocument(guarded, scope, token, target), /PURGE_LAB_ONLY/);
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
    await assert.rejects(deleteLabPurgeDocument(guarded, scope, token, target), /PURGE_LAB_ONLY/);
    process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
    await assert.rejects(deleteLabPurgeDocument({...guarded, projectId: 'non-demo'}, scope, token, target), /PURGE_LAB_ONLY/);
    assert.equal(accesses, 0);
    for (const receipt of [{effectId: 'wrong', outcome: 'applied'}, {effectId, outcome: 'unknown'}, {}]) {
      let reads = 0;
      const store = {projectId: 'demo-purge-fence', doc: path => path,
        runTransaction: callback => callback({get: async path => {
          assert.equal(path, `labPurgeResults/${effectId}`); reads++;
          return {exists: true, data: () => receipt};
        }, getAll() { throw new Error('UNEXPECTED_TARGET_READ'); },
        delete() { throw new Error('UNEXPECTED_DELETE'); }})};
      await assert.rejects(deleteLabPurgeDocument(store, scope, token, target), /PURGE_RECEIPT_CONFLICT/);
      assert.equal(reads, 1);
    }
  } finally {
    if (original === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = original;
  }
});
