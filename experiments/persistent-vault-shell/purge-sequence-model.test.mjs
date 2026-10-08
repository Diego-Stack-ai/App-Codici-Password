import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurgeSequence} from './purge-sequence-model.mjs';
const make = () => createPurgeSequence({id: 'synthetic', bucket: 'demo-purge'}, {operationId: 'op', claimRevision: 2},
  ['a', 'b', 'c'].map(id => ({kind: 'document', path: `labPurgeTargets/synthetic/children/${id}`, updateTime: {seconds: 1, nanoseconds: 0}})));
const step = (m, s, action) => m.transition(s, s.revision,
  action.type === 'stop' ? action : {planHash: m.planHash, ...action});
test('complete ordered sequence retains every outcome and rejects duplicate completion', () => {
  const m = make(); let s = m.initial;
  for (let index = 0; index < 3; index++) {
    s = step(m, s, {type: 'begin', index});
    assert.throws(() => step(m, s, {type: 'begin', index}));
    s = step(m, s, {type: 'outcome', index, outcome: 'applied'});
    assert.throws(() => step(m, s, {type: 'outcome', index, outcome: 'applied'}));
  }
  assert.deepEqual(s.outcomes, ['applied', 'applied', 'applied']);
  assert.deepEqual(m.summary(s), {appliedCount: 3, unresolved: false, stopped: false, allApplied: true});
  assert.throws(() => step(m, s, {type: 'begin', index: 3}));
});
test('conflict after first success preserves partial count and stops remaining work', () => {
  const m = make(); let s = step(m, m.initial, {type: 'begin', index: 0});
  s = step(m, s, {type: 'outcome', index: 0, outcome: 'applied'});
  s = step(m, s, {type: 'begin', index: 1});
  s = step(m, s, {type: 'outcome', index: 1, outcome: 'not-applied'});
  assert.deepEqual(s.outcomes, ['applied', 'not-applied', 'unstarted']);
  assert.deepEqual(m.summary(s), {appliedCount: 1, unresolved: false, stopped: true, allApplied: false});
  assert.throws(() => step(m, s, {type: 'begin', index: 2}));
});
test('stop after first success retains partial history and prevents next step', () => {
  const m = make(); let s = step(m, m.initial, {type: 'begin', index: 0});
  s = step(m, s, {type: 'outcome', index: 0, outcome: 'applied'});
  s = step(m, s, {type: 'stop'});
  assert.deepEqual(m.summary(s), {appliedCount: 1, unresolved: false, stopped: true, allApplied: false});
  assert.throws(() => step(m, s, {type: 'begin', index: 1}));
  assert.equal(m.initial.outcomes[0], 'unstarted');
});
test('unknown blocks advance and remains reconcilable after stop', () => {
  const m = make(); let s = step(m, m.initial, {type: 'begin', index: 0});
  s = step(m, s, {type: 'outcome', index: 0, outcome: 'unknown'});
  assert.throws(() => step(m, s, {type: 'begin', index: 1}));
  s = step(m, s, {type: 'stop'});
  assert.equal(m.summary(s).stopped, false);
  s = step(m, s, {type: 'outcome', index: 0, outcome: 'not-applied'});
  assert.equal(m.summary(s).stopped, true);
  assert.throws(() => step(m, s, {type: 'begin', index: 1}));
});
test('foreign state, different plan, stale revision and skipped step are rejected', () => {
  const m = make();
  assert.throws(() => step(m, make().initial, {type: 'stop'}));
  assert.throws(() => step(m, m.initial, {type: 'begin', index: 0, planHash: 'different'}));
  assert.throws(() => m.transition(m.initial, 1, {type: 'stop'}));
  assert.throws(() => step(m, m.initial, {type: 'begin', index: 1}));
});

test('snapshot imports round-trip every state; pending at revision 1 is valid', () => {
  const m = make();
  const plain = state => ({planHash: state.planHash, revision: state.revision,
    stopRequested: state.stopRequested, outcomes: [...state.outcomes]});
  let s = m.initial;
  const states = [s];
  for (let i = 0; i < 3; i++) {
    s = step(m, s, {type: 'begin', index: i}); states.push(s);
    s = step(m, s, {type: 'outcome', index: i, outcome: 'applied'}); states.push(s);
  }
  for (const original of states) {
    const imported = m.importSnapshot(plain(original));
    assert.equal(imported.revision, original.revision);
    assert.equal(imported.stopRequested, original.stopRequested);
    assert.deepEqual(imported.outcomes, original.outcomes);
    assert.deepEqual(m.summary(imported), m.summary(original));
  }
  const pending = states[1];
  assert.equal(pending.revision, 1);
  assert.equal(m.importSnapshot(plain(pending)).outcomes[0], 'pending');
});

test('snapshot rejects impossible prefix and too-small revision', () => {
  const m = make();
  const snapshot = (revision, outcomes, stopRequested = false) => ({planHash: m.planHash, revision, outcomes, stopRequested});
  assert.throws(() => m.importSnapshot(snapshot(0, ['pending', 'unstarted', 'unstarted'])));
  assert.throws(() => m.importSnapshot(snapshot(2, ['unstarted', 'applied', 'unstarted'])));
  assert.throws(() => m.importSnapshot(snapshot(2, ['not-applied', 'unstarted', 'unstarted'])));
  assert.doesNotThrow(() => m.importSnapshot(snapshot(4, ['applied', 'not-applied', 'unstarted'], true)));
});

test('outcome only accepts applied, not-applied, or unknown', () => {
  const m = make();
  const pending = step(m, m.initial, {type: 'begin', index: 0});
  const unknown = step(m, pending, {type: 'outcome', index: 0, outcome: 'unknown'});
  for (const s of [pending, unknown]) {
    for (const outcome of ['pending', 'unstarted', 'other', 7]) {
      assert.throws(() => step(m, s, {type: 'outcome', index: 0, outcome}), /PURGE_SEQUENCE_OUTCOME/);
    }
  }
});

test('malformed actions fail closed without reading accessors', () => {
  const m = make();
  assert.throws(() => m.transition(m.initial, 0, {}), /PURGE_SEQUENCE_ACTION/);
  let invoked = false;
  const accessor = {};
  Object.defineProperty(accessor, 'type', {enumerable: true, get() { invoked = true; return 'stop'; }});
  assert.throws(() => m.transition(m.initial, 0, accessor), /PURGE_SEQUENCE_ACTION/);
  assert.equal(invoked, false);
  assert.throws(() => m.transition(m.initial, 0, Object.create({type: 'stop'})), /PURGE_SEQUENCE_ACTION/);
  const symbolic = {type: 'stop'};
  symbolic[Symbol('extra')] = true;
  assert.throws(() => m.transition(m.initial, 0, symbolic), /PURGE_SEQUENCE_ACTION/);
});
