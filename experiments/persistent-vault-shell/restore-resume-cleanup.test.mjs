import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createResumePlanLab} from './restore-resume-plan-lab.mjs';
import {RESUME_PLAN_DURATION_MS as duration} from './restore-resume-plan.mjs';

test('cleanup does not delete a plan changed after discovery and propagates infrastructure failures', async () => {
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  const id = createHash('sha256').update('plan').digest('hex'), path = `labRestoreResumePlans/synthetic/items/${id}`;
  const original = {ownerUid: 'synthetic', planId: 'plan', schemaVersion: 1, createdAtMs: 0, expiresAtMs: duration};
  let current = {...original, ownerUid: 'other'}, failure = false, deletes = 0;
  const store = {projectId: 'demo-cleanup', doc: path => ({path}),
    collection() {
      const query = {orderBy: () => query, limit: () => query,
        get: async () => ({docs: [{id, ref: {path}, data: () => original}]})}; return query;
    },
    async runTransaction(fn) {
      if (failure) throw Error('SYNTHETIC_NETWORK_FAILURE');
      return fn({get: async () => ({exists: Boolean(current), data: () => current}), delete() {deletes++;}});
    }
  };
  try {
    const plans = createResumePlanLab({store, projectId: 'demo-cleanup', now: () => duration});
    assert.equal((await plans.sweepExpired('synthetic')).rejected, 1);
    current = null;
    assert.equal((await plans.sweepExpired('synthetic')).absent, 1);
    failure = true;
    await assert.rejects(plans.sweepExpired('synthetic'), /NETWORK_FAILURE/);
    assert.equal(deletes, 0);
  } finally {
    if (previous === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous;
  }
});

test('bounded cleanup rechecks exact owner/path/expiry, paginates and never touches targets', async () => {
  const previous = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  const rows = new Map(), deleted = [], uid = 'synthetic';
  const path = id => `labRestoreResumePlans/${uid}/items/${createHash('sha256').update(id).digest('hex')}`;
  const put = (id, patch = {}) => rows.set(path(id), {ownerUid: uid, planId: id, schemaVersion: 1,
    createdAtMs: 0, expiresAtMs: duration, ...patch});
  put('expired'); put('live', {createdAtMs: 1, expiresAtMs: duration + 1});
  put('corrupt', {expiresAtMs: 0}); put('foreign', {ownerUid: 'other'});
  put('swapped', {planId: 'expired'});
  rows.set('labCandidateRecords/synthetic/items/sentinel', {keep: true});
  const snapshot = p => ({exists: rows.has(p), id: p.split('/').at(-1), ref: {path: p}, data: () => structuredClone(rows.get(p))});
  const store = {projectId: 'demo-cleanup', doc: path => ({path}),
    collection(prefix) {
      assert.equal(prefix, `labRestoreResumePlans/${uid}/items`);
      let maximum, cursor = '';
      const query = {orderBy(field) {assert.equal(field, '__name__'); return query;},
        limit(n) {maximum = n; return query;}, startAfter(id) {cursor = id; return query;},
        async get() {return {docs: [...rows.keys()].filter(p => p.startsWith(prefix + '/') && p.split('/').at(-1) > cursor)
          .sort().slice(0, maximum).map(snapshot)};}};
      return query;
    },
    async runTransaction(fn) {return fn({get: async ref => snapshot(ref.path), delete(ref) {deleted.push(ref.path); rows.delete(ref.path);}});}
  };
  try {
    const plans = createResumePlanLab({store, projectId: 'demo-cleanup', now: () => duration});
    let after = null, total = {scanned: 0, removed: 0, retained: 0, rejected: 0};
    do {
      const result = await plans.sweepExpired(uid, {limit: 2, after});
      for (const key of Object.keys(total)) total[key] += result[key];
      after = result.next;
    } while (after);
    assert.deepEqual(total, {scanned: 5, removed: 1, retained: 1, rejected: 3});
    assert.deepEqual(deleted, [path('expired')]);
    assert.deepEqual(rows.get('labCandidateRecords/synthetic/items/sentinel'), {keep: true});
    for (const options of [{limit: 0}, {limit: 101}, {after: '../other'}]) await assert.rejects(plans.sweepExpired(uid, options), /INVALID/);
    await assert.rejects(plans.sweepExpired('../other'), /INVALID/);
  } finally {
    if (previous === undefined) delete process.env.FIRESTORE_EMULATOR_HOST;
    else process.env.FIRESTORE_EMULATOR_HOST = previous;
  }
});
