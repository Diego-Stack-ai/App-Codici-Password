import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {createPurgeBoundEffectStateLab} from './purge-bound-effect-state-lab.mjs';
import {applyBoundDocumentDeleteLab} from './purge-bound-effect-document-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

test('document delete commits target, composed state and receipt atomically', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `bound-document-${randomUUID()}`);
  const store = getFirestore(app), lab = createPurgeBoundEffectStateLab(store), id = `synthetic-${randomUUID()}`;
  const target = store.doc(`labPurgeTargets/${id}/items/target`);
  try {
    await target.create({synthetic: true});
    const updateTime = (await target.get()).updateTime;
    const plan = {planHash: 'a'.repeat(64), storageHash: 'b'.repeat(64), destructiveAllowed: false,
      effects: [{kind: 'document-delete', path: target.path,
        updateTime: {seconds: updateTime.seconds, nanoseconds: updateTime.nanoseconds}}]};
    const prepared = {...preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op'), previewHash: plan.planHash};
    await lab.claim(id, prepared, prepared, plan);
    const token = await lab.token(id, plan);
    const result = await applyBoundDocumentDeleteLab(store, id, token, plan, 0);
    assert.equal(result.outcome, 'applied'); assert.equal(result.duplicate, false);
    assert.equal((await target.get()).exists, false);
    const saved = (await store.doc(`labPurgeBoundEffects/${id}`).get()).data();
    assert.equal(saved.effectSequence.outcomes[0], 'applied'); assert.equal(saved.stop.effect, null);
    assert.equal((await applyBoundDocumentDeleteLab(store, id, await lab.token(id, plan), plan, 0)).duplicate, true);
  } finally {
    await store.recursiveDelete(store.collection('labPurgeTargets'));
    await store.recursiveDelete(store.collection('labPurgeBoundEffects'));
    await store.recursiveDelete(store.collection('labPurgeBoundEffectResults'));
    await deleteApp(app);
  }
});
