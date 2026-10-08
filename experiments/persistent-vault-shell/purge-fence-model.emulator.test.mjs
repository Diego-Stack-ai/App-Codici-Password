import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparePurgeFence, invalidatePurgeForWrite, enterExclusivePurge} from './purge-fence-model.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
test('committed writer atomically invalidates prepared token before destructive claim', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `fence-${randomUUID()}`);
  const store = getFirestore(app), id = randomUUID();
  const fence = store.doc(`labPurgeFences/${id}`), record = store.doc(`labPurgeRecords/${id}`);
  try {
    await fence.create({revision: 0, phase: 'idle', operationId: null});
    await record.create({synthetic: 'original'});
    const prepared = await store.runTransaction(async tx => {
      const snapshot = await tx.get(fence), next = preparePurgeFence(snapshot.data(), 'purge');
      tx.set(fence, next); return next;
    });
    await store.runTransaction(async tx => {
      const snapshot = await tx.get(fence);
      tx.set(fence, invalidatePurgeForWrite(snapshot.data()));
      tx.set(record, {synthetic: 'restored'});
    });
    let destructiveClaims = 0;
    await assert.rejects(store.runTransaction(async tx => {
      const snapshot = await tx.get(fence);
      const next = enterExclusivePurge(snapshot.data(), prepared);
      destructiveClaims++;
      tx.set(fence, next);
    }), /FENCE_CONFLICT/);
    assert.equal(destructiveClaims, 0);
    assert.deepEqual((await record.get()).data(), {synthetic: 'restored'});
    assert.deepEqual((await fence.get()).data(), {revision: 2, phase: 'idle', operationId: null});
    const racingToken = await store.runTransaction(async tx => {
      const snapshot = await tx.get(fence), next = preparePurgeFence(snapshot.data(), 'race');
      tx.set(fence, next); return next;
    });
    const outcomes = await Promise.allSettled([
      store.runTransaction(async tx => {
        const snapshot = await tx.get(fence);
        tx.set(fence, invalidatePurgeForWrite(snapshot.data()));
        tx.set(record, {synthetic: 'racing-writer'});
      }),
      store.runTransaction(async tx => {
        const snapshot = await tx.get(fence);
        tx.set(fence, enterExclusivePurge(snapshot.data(), racingToken));
      })
    ]);
    assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
    const state = (await fence.get()).data(), data = (await record.get()).data();
    assert.equal(state.revision, 4);
    if (outcomes[0].status === 'fulfilled') {
      assert.equal(state.phase, 'idle');
      assert.deepEqual(data, {synthetic: 'racing-writer'});
      assert.match(outcomes[1].reason.message, /FENCE_CONFLICT/);
    } else {
      assert.equal(state.phase, 'exclusive');
      assert.deepEqual(data, {synthetic: 'restored'});
      assert.match(outcomes[0].reason.message, /FENCE_BUSY/);
    }
    console.log(`Concurrent fence winner: ${state.phase === 'idle' ? 'writer' : 'claim'}`);
  } finally {
    await store.terminate(); await deleteApp(app);
  }
});
