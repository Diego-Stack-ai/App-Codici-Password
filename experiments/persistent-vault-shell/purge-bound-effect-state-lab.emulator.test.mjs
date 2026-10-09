import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {createPurgeEffectSequence} from './purge-effect-sequence.mjs';
import {createPurgeBoundEffectStateLab} from './purge-bound-effect-state-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

test('Firestore persists composed state and admits only one concurrent transition', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `bound-effects-${randomUUID()}`);
  const store = getFirestore(app), lab = createPurgeBoundEffectStateLab(store), id = `synthetic-${randomUUID()}`;
  const plan = {planHash: 'a'.repeat(64), storageHash: 'b'.repeat(64), destructiveAllowed: false,
    effects: [{kind: 'profile-cleanup', path: 'users/u'}, {kind: 'document-delete', path: 'users/u/accounts/a'}]};
  const prepared = {...preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op'), previewHash: plan.planHash};
  try {
    await lab.claim(id, prepared, prepared, plan);
    const token = await lab.token(id, plan), effectId = createPurgeEffectSequence(plan).effectIds[0];
    const outcomes = await Promise.allSettled([
      lab.transition(id, token, plan, {type: 'begin', index: 0, effectId}),
      lab.transition(id, token, plan, {type: 'begin', index: 0, effectId})]);
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(item => item.status === 'rejected').length, 1);
    const saved = (await store.doc(`labPurgeBoundEffects/${id}`).get()).data();
    assert.equal(saved.stateRevision, 1); assert.equal(saved.effectSequence.revision, 1);
    assert.equal(saved.effectSequence.outcomes[0], 'pending');
  } finally {
    await store.recursiveDelete(store.collection('labPurgeBoundEffects'));
    await deleteApp(app);
  }
});
