import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {planLabPurgeTargets} from './purge-target-plan.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, Timestamp} = require('firebase-admin/firestore');
test('exact-version delete refuses changed and recreated synthetic documents', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `targets-${randomUUID()}`);
  const store = getFirestore(app), id = randomUUID();
  const ref = store.doc(`labPurgeTargets/${id}`);
  const precondition = snapshot => {
    const [target] = planLabPurgeTargets({id, bucket: 'demo-purge'}, [{kind: 'document', path: ref.path,
      updateTime: {seconds: snapshot.updateTime.seconds, nanoseconds: snapshot.updateTime.nanoseconds}}]);
    return {lastUpdateTime: new Timestamp(target.updateTime.seconds, target.updateTime.nanoseconds)};
  };
  try {
    await ref.create({synthetic: 'original'});
    const original = precondition(await ref.get());
    await ref.update({synthetic: 'changed'});
    await assert.rejects(ref.delete(original), error => error.code === 9);
    assert.deepEqual((await ref.get()).data(), {synthetic: 'changed'});
    const current = precondition(await ref.get());
    await ref.delete(current);
    assert.equal((await ref.get()).exists, false);
    await ref.create({synthetic: 'recreated'});
    await assert.rejects(ref.delete(current), error => error.code === 9);
    assert.deepEqual((await ref.get()).data(), {synthetic: 'recreated'});
    const receipt = store.doc(`labPurgeResults/${id}`);
    const sentinel = store.doc(`labPurgeSentinels/${id}`);
    await sentinel.create({synthetic: true});
    // Server rejects one write: neither the delete nor its receipt may commit.
    await assert.rejects(store.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      tx.delete(ref, precondition(snapshot));
      tx.create(receipt, {synthetic: true, outcome: 'applied'});
      tx.create(sentinel, {synthetic: true});
    }), error => error.code === 6);
    assert.deepEqual((await ref.get()).data(), {synthetic: 'recreated'});
    assert.equal((await receipt.get()).exists, false);
    await store.runTransaction(async tx => {
      const snapshot = await tx.get(ref);
      tx.delete(ref, precondition(snapshot));
      tx.create(receipt, {synthetic: true, outcome: 'applied'});
    });
    assert.equal((await ref.get()).exists, false);
    assert.equal((await receipt.get()).data().outcome, 'applied');
    await ref.create({synthetic: 'after-atomic-test'});
    // Leave recreated evidence; no broad cleanup or recursive delete.
  } finally {
    await store.terminate(); await deleteApp(app);
  }
});
