import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {claimBoundPurge, boundPurgeToken, transitionBoundPurge} from './purge-bound-stop-model.mjs';
import {deleteLabPurgeDocument} from './purge-document-lab.mjs';
import {bindLabPurgeTarget} from './purge-target-plan.mjs';
import {purgeStopSummary} from './purge-stop-model.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
test('lab executor checks stop/version and replays without deleting recreated data', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `executor-${randomUUID()}`), store = getFirestore(app);
  try {
    for (const scenario of ['stop', 'changed', 'server-error', 'race', 'success']) {
      const id = randomUUID(), scope = {id, bucket: 'demo-purge'};
      const ref = store.doc(`labPurgeTargets/${id}`), stateRef = store.doc(`labPurgeStates/${id}`);
      const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, id);
      const state = claimBoundPurge(prepared, prepared), token = boundPurgeToken(state);
      await ref.create({synthetic: 'original'});
      const snapshot = await ref.get();
      const target = {kind: 'document', path: ref.path, updateTime: {seconds: snapshot.updateTime.seconds, nanoseconds: snapshot.updateTime.nanoseconds}};
      await stateRef.create(scenario === 'stop' ? transitionBoundPurge(state, token, {type: 'stop'}) : state);
      if (scenario === 'changed') await ref.update({synthetic: 'changed'});
      if (scenario === 'race') {
        const [deletion, stopping] = await Promise.allSettled([
          deleteLabPurgeDocument(store, scope, token, target),
          store.runTransaction(async tx => {
            const current = (await tx.get(stateRef)).data();
            tx.set(stateRef, transitionBoundPurge(current, boundPurgeToken(current), {type: 'stop'}));
          })
        ]);
        assert.equal(stopping.status, 'fulfilled');
        const final = (await stateRef.get()).data();
        const {effectId} = bindLabPurgeTarget(scope, token, target);
        const receipt = await store.doc(`labPurgeResults/${effectId}`).get();
        assert.equal(final.stop.stopRequested, true);
        assert.equal(final.fence.phase, 'exclusive');
        if (deletion.status === 'fulfilled') {
          assert.equal((await ref.get()).exists, false);
          assert.equal(final.stop.effect.outcome, 'applied');
          assert.equal(receipt.data().effectId, effectId);
          await ref.create({synthetic: 'after-race'});
        } else {
          assert.match(deletion.reason.message, /PURGE_BOUND_CONFLICT/);
          assert.deepEqual((await ref.get()).data(), {synthetic: 'original'});
          assert.equal(final.stop.effect, null);
          assert.equal(receipt.exists, false);
        }
        console.log(`Stop/delete race: ${deletion.status === 'fulfilled' ? 'delete committed before stop' : 'stop prevented delete'}`);
      } else if (scenario === 'server-error') {
        const sentinel = store.doc(`labPurgeSentinels/${id}`);
        await sentinel.create({synthetic: true});
        const failingStore = {
          projectId: store.projectId, doc: path => store.doc(path),
          runTransaction: callback => store.runTransaction(async tx => {
            const result = await callback(tx);
            tx.create(sentinel, {synthetic: true});
            return result;
          })
        };
        await assert.rejects(deleteLabPurgeDocument(failingStore, scope, token, target), error => error.code === 6);
        assert.deepEqual((await ref.get()).data(), {synthetic: 'original'});
        assert.deepEqual((await stateRef.get()).data(), state);
        const {effectId} = bindLabPurgeTarget(scope, token, target);
        assert.equal((await store.doc(`labPurgeResults/${effectId}`).get()).exists, false);
      } else if (scenario !== 'success') {
        await assert.rejects(deleteLabPurgeDocument(store, scope, token, target), /PURGE_BOUND_CONFLICT|PURGE_TARGET_CONFLICT/);
        assert.equal((await ref.get()).exists, true);
        assert.equal((await stateRef.get()).data().stop.effect, null);
      } else {
        const lostResponseStore = {
          projectId: store.projectId, doc: path => store.doc(path),
          runTransaction: async callback => {
            await store.runTransaction(callback);
            throw new Error('SIMULATED_RESPONSE_LOST_AFTER_COMMIT');
          }
        };
        const mutableToken = {...token};
        const pending = deleteLabPurgeDocument(lostResponseStore, scope, mutableToken, target);
        mutableToken.operationId = 'changed-during-await';
        await assert.rejects(pending, /SIMULATED_RESPONSE_LOST_AFTER_COMMIT/);
        assert.equal((await ref.get()).exists, false);
        await store.runTransaction(async tx => {
          const current = (await tx.get(stateRef)).data();
          tx.set(stateRef, transitionBoundPurge(current, boundPurgeToken(current), {type: 'stop'}));
        });
        assert.deepEqual(purgeStopSummary((await stateRef.get()).data().stop),
          {stopRequested: true, unresolved: false, stopped: true, partial: true});
        await ref.create({synthetic: 'recreated'});
        assert.deepEqual(await deleteLabPurgeDocument(store, scope, token, target), {outcome: 'applied', duplicate: true});
        assert.deepEqual((await ref.get()).data(), {synthetic: 'recreated'});
        assert.equal((await stateRef.get()).data().fence.phase, 'exclusive');
      }
    }
  } finally { await store.terminate(); await deleteApp(app); }
});
