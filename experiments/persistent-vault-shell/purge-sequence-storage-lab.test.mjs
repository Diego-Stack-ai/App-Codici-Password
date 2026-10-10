import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {claimBoundPurgeSequence, boundPurgeSequenceToken, transitionBoundPurgeSequence} from './purge-bound-sequence-model.mjs';
import {deleteLabPurgeSequenceObject} from './purge-sequence-storage-lab.mjs';

test('Storage admission failure or changed transport cannot start an external effect', async () => {
  const oldF = process.env.FIRESTORE_EMULATOR_HOST, oldS = process.env.STORAGE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199';
  try {
    for (const mode of ['commit-failure', 'lost-ack', 'endpoint-change', 'retry-change']) {
      const scope = {id: 'synthetic', bucket: 'demo-purge'};
      const targets = [{kind: 'object', path: 'labPurgeObjects/synthetic/one', bucket: scope.bucket, generation: '123'}];
      const prepared = preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op');
      let state = claimBoundPurgeSequence(prepared, prepared, scope, targets), calls = 0, transactions = 0;
      const expected = boundPurgeSequenceToken(state, scope, targets);
      const bucket = {name: scope.bucket, storage: {apiEndpoint: 'http://127.0.0.1:9199', baseUrl: 'http://127.0.0.1:9199', retryOptions: {autoRetry: false}},
        file: () => {calls++; throw Error('Unexpected external access');}};
      const store = {projectId: 'demo-purge-fence', doc: path => ({path}), runTransaction: async fn => {
        transactions++;
        let next;
        const result = await fn({get: async () => ({exists: true, data: () => state}), set: (_, value) => {next = value;}});
        if (transactions === 1 && mode === 'commit-failure') throw Error('COMMIT_FAILED');
        state = next;
        if (transactions === 1) {
          if (mode === 'lost-ack') throw Error('ACK_LOST');
          if (mode === 'endpoint-change') bucket.storage.apiEndpoint = 'https://example.invalid';
          if (mode === 'retry-change') bucket.storage.retryOptions.autoRetry = true;
        }
        return result;
      }};
      const invoke = () => deleteLabPurgeSequenceObject(store, bucket, scope, expected, targets, 0);
      if (mode === 'commit-failure') await assert.rejects(invoke(), /COMMIT_FAILED/);
      else if (mode === 'lost-ack') await assert.rejects(invoke(), /ACK_LOST/);
      else assert.deepEqual(await invoke(), {outcome: 'unknown', releaseAllowed: false});
      assert.equal(calls, 0);
      assert.equal(state.sequence.outcomes[0], mode === 'commit-failure' ? 'unstarted' : mode === 'lost-ack' ? 'pending' : 'unknown');
      if (mode !== 'commit-failure') {
        bucket.storage.apiEndpoint = 'http://127.0.0.1:9199';
        bucket.storage.retryOptions.autoRetry = false;
        await assert.rejects(invoke());
        assert.equal(calls, 0);
      }
    }
  } finally {
    if (oldF === undefined) delete process.env.FIRESTORE_EMULATOR_HOST; else process.env.FIRESTORE_EMULATOR_HOST = oldF;
    if (oldS === undefined) delete process.env.STORAGE_EMULATOR_HOST; else process.env.STORAGE_EMULATOR_HOST = oldS;
  }
});

test('installed Storage SDK constructs a generation-pinned conditional delete without network', async () => {
  const require = createRequire(new URL('../../functions/package.json', import.meta.url));
  const {Storage} = require('@google-cloud/storage');
  const storage = new Storage({projectId: 'demo-purge-fence', retryOptions: {autoRetry: false}});
  const generation = '90071992547409931234';
  let calls = 0;
  storage.request = (options, callback) => {
    calls++;
    assert.equal(options.method, 'DELETE');
    assert.equal(options.qs.generation, generation);
    assert.equal(options.qs.ifGenerationMatch, generation);
    assert.ok(options.uri.includes('labPurgeObjects%2Fsynthetic%2Fone'));
    callback(null, null, {statusCode: 204});
  };
  await storage.bucket('demo-purge').file('labPurgeObjects/synthetic/one', {generation}).delete({generation, ifGenerationMatch: generation});
  assert.equal(calls, 1);
});

test('Storage lab pins generation, retains stop and never retries uncertain effects', async () => {
  const oldF = process.env.FIRESTORE_EMULATOR_HOST, oldS = process.env.STORAGE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
  process.env.STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199';
  try {
    for (const mode of ['success', 'stop', '404', 'transport', 'settlement-failure']) {
      const scope = {id: 'synthetic', bucket: 'demo-purge'};
      const targets = [{kind: 'object', path: 'labPurgeObjects/synthetic/one', bucket: scope.bucket, generation: '90071992547409931234'}];
      const prepared = preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op');
      let state = claimBoundPurgeSequence(prepared, prepared, scope, targets), calls = 0, transactions = 0;
      const expected = boundPurgeSequenceToken(state, scope, targets);
      const store = {projectId: 'demo-purge-fence', doc: path => ({path}), runTransaction: async fn => {
        transactions++;
        if (mode === 'settlement-failure' && transactions === 2) throw Error('INJECTED');
        let next;
        const result = await fn({get: async () => ({exists: true, data: () => state}), set: (_, value) => {next = value;}});
        if (next) state = next;
        return result;
      }};
      const bucket = {name: scope.bucket, storage: {apiEndpoint: 'http://127.0.0.1:9199', baseUrl: 'http://127.0.0.1:9199', retryOptions: {autoRetry: false}}, file: (path, options) => {
        assert.equal(path, targets[0].path);
        if (options) assert.equal(options.generation, targets[0].generation);
        return {getMetadata: async () => [{generation: targets[0].generation}], delete: async options => {
          calls++;
          assert.equal(state.sequence.outcomes[0], 'pending');
          assert.equal(options.ifGenerationMatch, targets[0].generation);
          assert.equal(options.generation, targets[0].generation);
          if (mode === 'stop') state = transitionBoundPurgeSequence(state, boundPurgeSequenceToken(state, scope, targets), scope, targets, {type: 'stop'});
          if (mode === '404' || mode === 'transport') throw Object.assign(Error('synthetic'), {code: mode === '404' ? 404 : 503});
        }};
      }};
      const invoke = () => deleteLabPurgeSequenceObject(store, bucket, scope, expected, targets, 0);
      for (const field of ['apiEndpoint', 'baseUrl']) {
        bucket.storage[field] = 'https://example.invalid';
        await assert.rejects(invoke(), /PURGE_LAB_ONLY/);
        assert.equal(transactions, 0); assert.equal(calls, 0);
        bucket.storage[field] = 'http://127.0.0.1:9199';
      }
      bucket.storage.retryOptions.autoRetry = true;
      await assert.rejects(invoke(), /PURGE_RETRY_CONFIG/);
      assert.equal(transactions, 0); assert.equal(calls, 0);
      bucket.storage.retryOptions.autoRetry = false;
      if (mode === 'settlement-failure') await assert.rejects(invoke(), /INJECTED/);
      else assert.deepEqual(await invoke(), {outcome: ['404', 'transport'].includes(mode) ? 'unknown' : 'applied', releaseAllowed: false});
      assert.equal(state.sequence.outcomes[0], mode === 'settlement-failure' ? 'pending' : ['404', 'transport'].includes(mode) ? 'unknown' : 'applied');
      if (mode === 'stop') assert.equal(state.sequence.stopRequested, true);
      await assert.rejects(invoke());
      assert.equal(calls, 1);
    }
  } finally {
    if (oldF === undefined) delete process.env.FIRESTORE_EMULATOR_HOST; else process.env.FIRESTORE_EMULATOR_HOST = oldF;
    if (oldS === undefined) delete process.env.STORAGE_EMULATOR_HOST; else process.env.STORAGE_EMULATOR_HOST = oldS;
  }
});
