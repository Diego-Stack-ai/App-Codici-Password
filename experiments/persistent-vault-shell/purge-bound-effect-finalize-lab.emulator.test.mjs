import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {createPurgeBoundEffectStateLab} from './purge-bound-effect-state-lab.mjs';
import {createPurgeEffectSequence} from './purge-effect-sequence.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

test('completion receipt requires every effect applied and is idempotent', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `bound-finalize-${randomUUID()}`);
  const store = getFirestore(app), lab = createPurgeBoundEffectStateLab(store), id = `synthetic-${randomUUID()}`;
  const plan = {planHash: 'a'.repeat(64), storageHash: 'b'.repeat(64), destructiveAllowed: false,
    effects: [{kind: 'document-delete', path: 'synthetic/account'}]};
  try {
    const prepared = {...preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op'), previewHash: plan.planHash};
    await lab.claim(id, prepared, prepared, plan);
    await assert.rejects(lab.finalize(id, await lab.token(id, plan), plan), /STATE_LAB_CONFLICT/);
    const effectId = createPurgeEffectSequence(plan).effectIds[0];
    await lab.transition(id, await lab.token(id, plan), plan, {type: 'begin', index: 0, effectId});
    await lab.transition(id, await lab.token(id, plan), plan, {type: 'outcome', index: 0, effectId, outcome: 'applied'});
    const token = await lab.token(id, plan), first = await lab.finalize(id, token, plan);
    assert.equal(first.duplicate, false);
    assert.equal(first.status, 'effects-applied');
    assert.equal(first.destructiveAllowed, false);
    assert.equal((await lab.finalize(id, token, plan)).duplicate, true);
  } finally {
    await store.recursiveDelete(store.collection('labPurgeBoundEffects'));
    await store.recursiveDelete(store.collection('labPurgeBoundEffectCompletions'));
    await deleteApp(app);
  }
});
