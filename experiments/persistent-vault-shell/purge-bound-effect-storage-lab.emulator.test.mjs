import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {createPurgeBoundEffectStateLab} from './purge-bound-effect-state-lab.mjs';
import {applyBoundObjectDeleteLab, retryBoundObjectDeleteLab} from './purge-bound-effect-storage-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

test('storage unknown and retry transitions persist before each synthetic I/O', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `bound-storage-${randomUUID()}`);
  const store = getFirestore(app), lab = createPurgeBoundEffectStateLab(store), id = `synthetic-${randomUUID()}`;
  const plan = {planHash: 'a'.repeat(64), storageHash: 'b'.repeat(64), destructiveAllowed: false,
    effects: [{kind: 'object-delete', storagePath: 'synthetic/attachment.bin', generation: '9007199254740993'}]};
  try {
    const prepared = {...preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op'), previewHash: plan.planHash};
    await lab.claim(id, prepared, prepared, plan);
    const seen = [];
    const ambiguous = {file: () => ({async delete() {
      const snapshot = await store.doc(`labPurgeBoundEffects/${id}`).get();
      seen.push(snapshot.data().effectSequence.outcomes[0]);
      throw Object.assign(new Error('synthetic ambiguous'), {code: 503});
    }})};
    assert.equal((await applyBoundObjectDeleteLab(lab, ambiguous, id, await lab.token(id, plan), plan, 0)).outcome, 'unknown');
    const success = {file: () => ({async delete() {
      const snapshot = await store.doc(`labPurgeBoundEffects/${id}`).get();
      seen.push(snapshot.data().effectSequence.outcomes[0]);
    }})};
    assert.equal((await retryBoundObjectDeleteLab(lab, success, id, await lab.token(id, plan), plan, 0)).outcome, 'applied');
    assert.deepEqual(seen, ['pending', 'pending']);
    const final = (await store.doc(`labPurgeBoundEffects/${id}`).get()).data();
    assert.equal(final.effectSequence.outcomes[0], 'applied');
    assert.equal(final.stateRevision, 4);
  } finally {
    await store.recursiveDelete(store.collection('labPurgeBoundEffects'));
    await deleteApp(app);
  }
});
