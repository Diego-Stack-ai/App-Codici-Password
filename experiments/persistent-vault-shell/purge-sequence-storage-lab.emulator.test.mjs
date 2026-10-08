import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {claimBoundPurgeSequence, boundPurgeSequenceToken} from './purge-bound-sequence-model.mjs';
import {deleteLabPurgeSequenceObject} from './purge-sequence-storage-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {Storage} = require('@google-cloud/storage');

test('local SDK Storage deletion uses exact generation and preserves replacement', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' || process.env.STORAGE_EMULATOR_HOST !== 'http://127.0.0.1:9199', timeout: 40000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `storage-${randomUUID()}`);
  const store = getFirestore(app), bucket = new Storage({projectId: 'demo-purge-fence', retryOptions: {autoRetry: false}}).bucket('demo-purge');
  try {
    for (const replaced of [false, true]) {
      const scope = {id: randomUUID(), bucket: bucket.name};
      const path = `labPurgeObjects/${scope.id}/one`, file = bucket.file(path);
      await file.save(Buffer.from('synthetic-original'), {resumable: false});
      const [metadata] = await file.getMetadata();
      const targets = [{kind: 'object', path, bucket: bucket.name, generation: metadata.generation}];
      const prepared = preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op');
      const state = claimBoundPurgeSequence(prepared, prepared, scope, targets);
      const expected = boundPurgeSequenceToken(state, scope, targets);
      const ref = store.doc(`labPurgeStates/${scope.id}`);
      await ref.create(state);
      if (replaced) {
        await file.save(Buffer.from('synthetic-replacement'), {resumable: false});
        assert.notEqual((await file.getMetadata())[0].generation, metadata.generation);
      }
      const result = await deleteLabPurgeSequenceObject(store, bucket, scope, expected, targets, 0);
      assert.equal(result.releaseAllowed, false);
      assert.equal(result.outcome, replaced ? 'unknown' : 'applied');
      assert.equal((await ref.get()).data().sequence.outcomes[0], result.outcome);
      if (replaced) assert.equal((await file.download())[0].toString(), 'synthetic-replacement');
      else assert.equal((await file.exists())[0], false);
      await assert.rejects(deleteLabPurgeSequenceObject(store, bucket, scope, expected, targets, 0));
    }
  } finally { await store.terminate(); await deleteApp(app); }
});
