import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {claimBoundPurgeSequence, boundPurgeSequenceToken, transitionBoundPurgeSequence} from './purge-bound-sequence-model.mjs';
import {deleteLabPurgeSequenceDocument} from './purge-sequence-document-lab.mjs';
import {deleteLabPurgeSequenceObject} from './purge-sequence-storage-lab.mjs';
import {inspectStoppedLabPurge, resumeLabReferenceAfterStop} from './purge-reconciliation-lab.mjs';
import {requestLabReferenceDuringPurge, createLabReferenceBeforePurge, prepareLabPurgeWithoutReferences} from './purge-reference-writer-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

const allowed = () => process.env.FIRESTORE_EMULATOR_HOST === '127.0.0.1:8080';
test('Firestore serializes concurrent Storage effect admission with a simulated external adapter', {skip: !allowed(), timeout: 30000}, async () => {
  const previous = process.env.STORAGE_EMULATOR_HOST;
  process.env.STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199';
  const app = initializeApp({projectId: 'demo-purge-fence'}, `admission-${randomUUID()}`), store = getFirestore(app);
  let release;
  try {
    const scope = {id: randomUUID(), bucket: 'demo-purge'};
    const targets = [{kind: 'object', path: `labPurgeObjects/${scope.id}/one`, bucket: scope.bucket, generation: '123'}];
    const prepared = preparePurgeFence({phase: 'idle', revision: 0, operationId: null}, 'op');
    const state = claimBoundPurgeSequence(prepared, prepared, scope, targets);
    const expected = boundPurgeSequenceToken(state, scope, targets), ref = store.doc(`labPurgeStates/${scope.id}`);
    await ref.create(state);
    let entered, calls = 0;
    const ready = new Promise(resolve => {entered = resolve;});
    const wait = new Promise(resolve => {release = resolve;});
    const bucket = {name: scope.bucket, storage: {apiEndpoint: 'http://127.0.0.1:9199', baseUrl: 'http://127.0.0.1:9199', retryOptions: {autoRetry: false}},
      file: () => ({delete: async () => {calls++; entered(); await wait;}})};
    const invoke = () => deleteLabPurgeSequenceObject(store, bucket, scope, expected, targets, 0);
    const first = invoke();
    try {
      await Promise.race([ready, first.then(() => {throw Error('Effect completed before admission signal');})]);
      assert.equal((await ref.get()).data().sequence.outcomes[0], 'pending');
      await assert.rejects(invoke());
      assert.equal(calls, 1);
      await store.runTransaction(async tx => {
        const current = (await tx.get(ref)).data();
        tx.set(ref, transitionBoundPurgeSequence(current,
          boundPurgeSequenceToken(current, scope, targets), scope, targets, {type: 'stop'}));
      });
    } finally {release(); await first;}
    assert.equal((await ref.get()).data().sequence.outcomes[0], 'applied');
    assert.equal((await ref.get()).data().sequence.stopRequested, true);
    assert.equal(calls, 1);
  } finally {
    release?.(); await store.terminate(); await deleteApp(app);
    if (previous === undefined) delete process.env.STORAGE_EMULATOR_HOST; else process.env.STORAGE_EMULATOR_HOST = previous;
  }
});
test('absent target without receipt cannot resolve an uncertain stopped effect or authorize reference resume', {
  skip: !allowed(), timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `uncertain-${randomUUID()}`);
  const store = getFirestore(app);
  try {
    for (const outcome of ['pending', 'unknown']) {
      const id = randomUUID(), scope = {id, bucket: 'demo-purge'};
      const refs = ['uncertain', 'untouched'].map(name => store.doc(`labPurgeTargets/${id}/items/${name}`));
      const targets = [];
      for (const ref of refs) {
        await ref.create({synthetic: true});
        const snap = await ref.get();
        targets.push({kind: 'document', path: ref.path,
          updateTime: {seconds: snap.updateTime.seconds, nanoseconds: snap.updateTime.nanoseconds}});
      }
      const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, id);
      let state = claimBoundPurgeSequence(prepared, prepared, scope, targets);
      const apply = action => { state = transitionBoundPurgeSequence(state,
        boundPurgeSequenceToken(state, scope, targets), scope, targets, action); };
      apply({type: 'begin', index: 0});
      if (outcome === 'unknown') apply({type: 'outcome', index: 0, outcome});
      apply({type: 'stop'});
      const stateRef = store.doc(`labPurgeStates/${id}`);
      await stateRef.create(state);
      await refs[0].delete(); // Simulated absence without an atomic receipt: not proof of this operation.
      const before = await stateRef.get();
      const report = await inspectStoppedLabPurge(store, scope, targets);
      assert.equal(report.unresolved, true);
      assert.equal(report.writeAllowed, false);
      assert.deepEqual(report.items[0], {index: 0, outcome, presence: 'absent', confirmedApplied: false});
      await assert.rejects(resumeLabReferenceAfterStop(store, scope, targets, 1, 'blocked', report.stateRevision),
        /PURGE_RESUME_CONFLICT/);
      assert.equal((await store.doc(`labPurgeReferences/${id}/items/blocked`).get()).exists, false);
      assert.equal((await stateRef.get()).updateTime.isEqual(before.updateTime), true);
      assert.equal((await refs[1].get()).exists, true);
    }
  } finally {
    await store.terminate();
    await deleteApp(app);
  }
});
test('new preparation checks persisted references and cannot survive a concurrent writer', {
  skip: !allowed(), timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `prepare-reference-${randomUUID()}`);
  const store = getFirestore(app);
  try {
    for (const order of ['writer-first', 'prepare-first', 'concurrent', 'changed-target']) {
      const id = randomUUID(), scope = {id, bucket: 'demo-purge'};
      const target = store.doc(`labPurgeTargets/${id}/items/account`);
      await target.create({synthetic: true});
      const snap = await target.get();
      const targets = [{kind: 'document', path: target.path,
        updateTime: {seconds: snap.updateTime.seconds, nanoseconds: snap.updateTime.nanoseconds}}];
      const stateRef = store.doc(`labPurgeStates/${id}`);
      const idle = {fence: {revision: 0, phase: 'idle', operationId: null}};
      await stateRef.create(idle);
      const prepare = () => prepareLabPurgeWithoutReferences(store, scope, targets, id);
      const write = () => createLabReferenceBeforePurge(store, scope, targets, 0, 'reference');
      let prepared;
      if (order === 'changed-target') {
        await target.set({synthetic: 'changed'});
        await assert.rejects(prepare(), /PURGE_TARGET_CONFLICT/);
        assert.deepEqual((await stateRef.get()).data(), idle);
        continue;
      }
      if (order === 'writer-first') {
        await write();
        await assert.rejects(prepare(), /PURGE_REFERENCES_PRESENT/);
      } else if (order === 'prepare-first') {
        prepared = await prepare();
        await write();
      } else {
        const results = await Promise.allSettled([prepare(), write()]);
        assert.equal(results[1].status, 'fulfilled');
        if (results[0].status === 'fulfilled') prepared = results[0].value;
        else assert.match(results[0].reason.message, /PURGE_REFERENCES_PRESENT/);
      }
      const current = (await stateRef.get()).data();
      assert.equal(current.fence.phase, 'idle');
      if (prepared) assert.throws(() => claimBoundPurgeSequence(current.fence, prepared, scope, targets), /FENCE_CONFLICT/);
      await assert.rejects(prepare(), /PURGE_REFERENCES_PRESENT/);
      assert.deepEqual((await stateRef.get()).data(), current);
      assert.equal((await target.get()).exists, true);
      assert.equal((await store.doc(`labPurgeReferences/${id}/items/reference`).get()).exists, true);
    }
  } finally {
    await store.terminate();
    await deleteApp(app);
  }
});
test('pre-claim reference atomically invalidates preparation; claim winner blocks write', {
  skip: !allowed(), timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `pre-reference-${randomUUID()}`);
  const store = getFirestore(app);
  try {
    for (const order of ['writer-first', 'claim-first', 'concurrent', 'changed-target']) {
      const id = randomUUID(), scope = {id, bucket: 'demo-purge'};
      const ref = store.doc(`labPurgeTargets/${id}/items/account`);
      await ref.create({synthetic: true});
      const snap = await ref.get();
      const targets = [{kind: 'document', path: ref.path,
        updateTime: {seconds: snap.updateTime.seconds, nanoseconds: snap.updateTime.nanoseconds}}];
      const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, id);
      const stateRef = store.doc(`labPurgeStates/${id}`);
      await stateRef.create({fence: prepared});
      const write = () => createLabReferenceBeforePurge(store, scope, targets, 0, 'reference');
      const claim = () => store.runTransaction(async tx => {
        const current = (await tx.get(stateRef)).data();
        tx.set(stateRef, claimBoundPurgeSequence(current.fence, prepared, scope, targets));
      });
      let saved = false;
      if (order === 'writer-first') {
        assert.equal((await write()).saved, true);
        saved = true;
        await assert.rejects(claim(), /FENCE_CONFLICT/);
        const before = (await stateRef.get()).data();
        await assert.rejects(write(), /REFERENCE_EXISTS/);
        assert.deepEqual((await stateRef.get()).data(), before);
      } else if (order === 'claim-first') {
        await claim();
        await assert.rejects(write(), /FENCE_BUSY/);
      } else if (order === 'changed-target') {
        await ref.set({synthetic: 'new-version'});
        await assert.rejects(write(), /PURGE_TARGET_CONFLICT/);
        assert.deepEqual((await stateRef.get()).data(), {fence: prepared});
      } else {
        const results = await Promise.allSettled([write(), claim()]);
        assert.equal(results.filter(value => value.status === 'fulfilled').length, 1);
        saved = results[0].status === 'fulfilled';
        assert.match(results[saved ? 1 : 0].reason.message, /FENCE_CONFLICT|FENCE_BUSY/);
      }
      assert.equal((await store.doc(`labPurgeReferences/${id}/items/reference`).get()).exists, saved);
      assert.equal((await ref.get()).exists, true);
      if (saved) assert.equal((await stateRef.get()).data().fence.phase, 'idle');
    }
  } finally {
    await store.terminate();
    await deleteApp(app);
  }
});
test('reference request and deletion serialize on the same state without an orphan', {
  skip: !allowed(), timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `reference-${randomUUID()}`);
  const store = getFirestore(app);
  try {
    for (const order of ['writer-first', 'delete-first', 'concurrent']) {
      const id = randomUUID(), scope = {id, bucket: 'demo-purge'};
      const target = store.doc(`labPurgeTargets/${id}/items/account`);
      await target.create({synthetic: true});
      const snap = await target.get();
      const targets = [{kind: 'document', path: target.path,
        updateTime: {seconds: snap.updateTime.seconds, nanoseconds: snap.updateTime.nanoseconds}}];
      const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, id);
      const initial = claimBoundPurgeSequence(prepared, prepared, scope, targets);
      const stateRef = store.doc(`labPurgeStates/${id}`);
      await stateRef.create(initial);
      const remove = () => deleteLabPurgeSequenceDocument(store, scope,
        boundPurgeSequenceToken(initial, scope, targets), targets, 0);
      const write = () => requestLabReferenceDuringPurge(store, scope, targets, 0);
      let result;
      if (order === 'writer-first') {
        result = await write();
        await assert.rejects(remove(), /PURGE_SEQUENCE_STATE_CONFLICT/);
        assert.equal((await target.get()).exists, true);
      } else if (order === 'delete-first') {
        await remove();
        result = await write();
        assert.equal(result.status, 'target-missing');
      } else {
        const [writer, deletion] = await Promise.allSettled([write(), remove()]);
        assert.equal(writer.status, 'fulfilled');
        result = writer.value;
        if (deletion.status === 'rejected') assert.match(deletion.reason.message, /PURGE_SEQUENCE_STATE_CONFLICT/);
        assert.equal((await target.get()).exists, deletion.status === 'rejected');
      }
      assert.equal(result.saved, false);
      const state = (await stateRef.get()).data();
      assert.equal(state.sequence.stopRequested, true);
      assert.deepEqual(state.sequence.outcomes, (await target.get()).exists ? ['unstarted'] : ['applied']);
      // Retry is stable: no release, duplicate stop transition, or silent save.
      assert.deepEqual(await write(), result);
      assert.deepEqual((await stateRef.get()).data(), state);
    }
  } finally {
    await store.terminate();
    await deleteApp(app);
  }
});
test('two applied steps share one CAS document and keep their history across slot reuse', {
  skip: !allowed(), timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `sequence-${randomUUID()}`);
  const store = getFirestore(app);
  try {
    const id = randomUUID(), scope = {id, bucket: 'demo-purge'};
    const refs = ['first', 'second'].map(name => store.doc(`labPurgeTargets/${id}/items/${name}`));
    for (let i = 0; i < refs.length; i++) await refs[i].create({synthetic: i});
    const targets = [];
    for (const ref of refs) {
      const snap = await ref.get();
      targets.push({kind: 'document', path: ref.path,
        updateTime: {seconds: snap.updateTime.seconds, nanoseconds: snap.updateTime.nanoseconds}});
    }
    const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, id);
    const initial = claimBoundPurgeSequence(prepared, prepared, scope, targets);
    const stateRef = store.doc(`labPurgeStates/${id}`);
    await stateRef.create(initial);
    const firstToken = boundPurgeSequenceToken(initial, scope, targets);
    const lostResponse = {
      projectId: store.projectId,
      doc: path => store.doc(path),
      runTransaction: async callback => {
        await store.runTransaction(callback);
        throw new Error('SIMULATED_RESPONSE_LOST_AFTER_COMMIT');
      }
    };
    await assert.rejects(deleteLabPurgeSequenceDocument(lostResponse, scope, firstToken, targets, 0),
      /SIMULATED_RESPONSE_LOST_AFTER_COMMIT/);
    let state = (await stateRef.get()).data();
    assert.deepEqual(state.sequence.outcomes, ['applied', 'unstarted']);
    assert.equal(state.stop.effect, null);
    assert.equal(state.stateRevision, 2);
    assert.equal((await refs[0].get()).exists, false);
    await assert.rejects(deleteLabPurgeSequenceDocument(store, scope, firstToken, targets, 1),
      /PURGE_SEQUENCE_STATE_CONFLICT/);
    assert.deepEqual((await refs[1].get()).data(), {synthetic: 1});
    assert.deepEqual((await stateRef.get()).data().sequence.outcomes, ['applied', 'unstarted']);

    await refs[0].create({synthetic: 'recreated'});
    assert.deepEqual(await deleteLabPurgeSequenceDocument(store, scope, firstToken, targets, 0),
      {outcome: 'applied', duplicate: true});
    assert.deepEqual((await refs[0].get()).data(), {synthetic: 'recreated'});

    const secondToken = boundPurgeSequenceToken(state, scope, targets);
    const secondResult = await deleteLabPurgeSequenceDocument(store, scope, secondToken, targets, 1);
    assert.equal(secondResult.duplicate, false);
    assert.deepEqual((await refs[0].get()).data(), {synthetic: 'recreated'});
    assert.equal((await refs[1].get()).exists, false);
    state = (await stateRef.get()).data();
    assert.deepEqual(state.sequence.outcomes, ['applied', 'applied']);
    assert.equal(state.stop.effect, null);
    assert.equal(state.stateRevision, 4);
    assert.equal(state.sequence.revision, 4);
    for (let i = 0; i < refs.length; i++) {
      const token = i === 0 ? firstToken : secondToken;
      const {effectId} = (await import('./purge-target-plan.mjs')).bindLabPurgeTarget(scope, token, targets[i]);
      const receipt = await store.doc(`labPurgeResults/${effectId}`).get();
      assert.equal(receipt.data().sequenceIndex, i);
      assert.equal(receipt.data().outcome, 'applied');
    }
  } finally {
    await store.terminate();
    await deleteApp(app);
  }
});

test('stop after a successful step preserves partial history and blocks the next target', {
  skip: !allowed(), timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `sequence-stop-${randomUUID()}`);
  const store = getFirestore(app);
  try {
    const id = randomUUID(), scope = {id, bucket: 'demo-purge'};
    const refs = ['first', 'second'].map(name => store.doc(`labPurgeTargets/${id}/items/${name}`));
    for (let i = 0; i < refs.length; i++) await refs[i].create({synthetic: i});
    const targets = [];
    for (const ref of refs) {
      const snap = await ref.get();
      targets.push({kind: 'document', path: ref.path,
        updateTime: {seconds: snap.updateTime.seconds, nanoseconds: snap.updateTime.nanoseconds}});
    }
    const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, id);
    const initial = claimBoundPurgeSequence(prepared, prepared, scope, targets);
    const stateRef = store.doc(`labPurgeStates/${id}`);
    await stateRef.create(initial);
    await deleteLabPurgeSequenceDocument(store, scope,
      boundPurgeSequenceToken(initial, scope, targets), targets, 0);
    await store.runTransaction(async tx => {
      const current = (await tx.get(stateRef)).data();
      const next = transitionBoundPurgeSequence(current,
        boundPurgeSequenceToken(current, scope, targets), scope, targets, {type: 'stop'});
      tx.set(stateRef, next);
    });
    const stopped = (await stateRef.get()).data();
    assert.deepEqual(stopped.sequence.outcomes, ['applied', 'unstarted']);
    assert.equal(stopped.sequence.stopRequested, true);
    const report = await inspectStoppedLabPurge(store, scope, targets);
    assert.equal(report.writeAllowed, false);
    assert.equal(report.unresolved, false);
    assert.deepEqual(report.items.map(item => [item.outcome, item.presence, item.confirmedApplied]),
      [['applied', 'absent', true], ['unstarted', 'original-version', false]]);
    await refs[0].create({synthetic: 'recreated-after-stop'});
    const recreated = await inspectStoppedLabPurge(store, scope, targets);
    assert.equal(recreated.items[0].presence, 'different-version');
    assert.equal(recreated.items[0].confirmedApplied, true);
    assert.equal(recreated.writeAllowed, false);
    assert.deepEqual((await stateRef.get()).data(), stopped);
    await assert.rejects(resumeLabReferenceAfterStop(store, scope, targets, 1, 'stale', report.stateRevision - 1), /PURGE_RESUME_CONFLICT/);
    await assert.rejects(resumeLabReferenceAfterStop(store, scope, targets, 0, 'deleted', report.stateRevision), /PURGE_RESUME_CONFLICT/);
    const sentinel = store.doc(`labPurgeSentinels/${id}`);
    await sentinel.create({synthetic: true});
    const failingStore = {projectId: store.projectId, doc: path => store.doc(path),
      runTransaction: callback => store.runTransaction(async tx => {
        const result = await callback(tx);
        tx.create(sentinel, {synthetic: true}); // Real server commit failure.
        return result;
      })};
    await assert.rejects(resumeLabReferenceAfterStop(failingStore, scope, targets, 1, 'failed', report.stateRevision), error => error.code === 6);
    assert.equal((await store.doc(`labPurgeReferences/${id}/items/failed`).get()).exists, false);
    assert.deepEqual((await stateRef.get()).data(), stopped);
    assert.deepEqual((await refs[1].get()).data(), {synthetic: 1});
    const retries = await Promise.allSettled([0, 1].map(() =>
      resumeLabReferenceAfterStop(store, scope, targets, 1, 'resumed', report.stateRevision)));
    assert.equal(retries.filter(result => result.status === 'fulfilled').length, 1);
    assert.deepEqual(retries.find(result => result.status === 'fulfilled').value, {saved: true, purgeStillStopped: true});
    assert.match(retries.find(result => result.status === 'rejected').reason.message, /REFERENCE_EXISTS/);
    assert.deepEqual((await store.doc(`labPurgeReferences/${id}/items/resumed`).get()).data(),
      {synthetic: true, targetPath: refs[1].path});
    await assert.rejects(resumeLabReferenceAfterStop(store, scope, targets, 1, 'resumed', report.stateRevision), /REFERENCE_EXISTS/);
    assert.deepEqual((await stateRef.get()).data(), stopped);
    const token = boundPurgeSequenceToken(stopped, scope, targets);
    await assert.rejects(deleteLabPurgeSequenceDocument(store, scope, token, targets, 1),
      /PURGE_SEQUENCE_STOP|PURGE_STOP_STATE|PURGE_SEQUENCE_STATE_CONFLICT/);
    assert.deepEqual((await refs[1].get()).data(), {synthetic: 1});
    const race = await Promise.allSettled([
      resumeLabReferenceAfterStop(store, scope, targets, 1, 'race', report.stateRevision),
      refs[1].set({synthetic: 'changed-after-report'})
    ]);
    assert.equal(race[1].status, 'fulfilled');
    if (race[0].status === 'rejected') assert.match(race[0].reason.message, /PURGE_RESUME_CONFLICT/);
    assert.equal((await store.doc(`labPurgeReferences/${id}/items/race`).get()).exists, race[0].status === 'fulfilled');
    // A writer serialized AFTER a valid reference commit may still change the target;
    // this test does not claim protection from arbitrary non-cooperating writers.
    assert.deepEqual((await stateRef.get()).data(), stopped);
    await assert.rejects(resumeLabReferenceAfterStop(store, scope, targets, 1, 'changed', report.stateRevision), /PURGE_RESUME_CONFLICT/);
    assert.equal((await store.doc(`labPurgeReferences/${id}/items/changed`).get()).exists, false);
  } finally {
    await store.terminate();
    await deleteApp(app);
  }
});
