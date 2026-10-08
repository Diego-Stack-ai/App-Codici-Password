import test from 'node:test';
import assert from 'node:assert/strict';
import {planLabPurgeTargets as plan, bindLabPurgeTarget as bind} from './purge-target-plan.mjs';
import {preparePurgeFence} from './purge-fence-model.mjs';
import {claimBoundPurge, boundPurgeToken, transitionBoundPurge} from './purge-bound-stop-model.mjs';
const scope = {id: 'synthetic', bucket: 'demo-purge'};
const doc = {kind: 'document', path: 'labPurgeTargets/synthetic', updateTime: {seconds: 100, nanoseconds: 123456000}};
const obj = {kind: 'object', path: 'labPurgeObjects/synthetic/bytes', bucket: scope.bucket, generation: '90071992547409931234'};
test('target identity binds claim, path and exact version; mismatched result is rejected', () => {
  const prepared = preparePurgeFence({revision: 0, phase: 'idle', operationId: null}, 'purge');
  let state = claimBoundPurge(prepared, prepared);
  const token = boundPurgeToken(state), bound = bind(scope, token, doc);
  assert.equal(bind(scope, token, {...doc}).effectId, bound.effectId);
  for (const changed of [bind(scope, {...token, operationId: 'other'}, doc),
    bind(scope, {...token, claimRevision: 5}, doc),
    bind(scope, token, {...doc, path: `${doc.path}/children/one`}),
    bind(scope, token, {...doc, updateTime: {...doc.updateTime, nanoseconds: 123457000}})]) {
    assert.notEqual(changed.effectId, bound.effectId);
  }
  assert.notEqual(bind(scope, token, obj).effectId, bind(scope, token, {...obj, generation: '90071992547409931235'}).effectId);
  state = transitionBoundPurge(state, token, {type: 'begin', effectId: bound.effectId});
  const wrong = bind(scope, token, {...doc, updateTime: {...doc.updateTime, seconds: 101}});
  assert.throws(() => transitionBoundPurge(state, boundPurgeToken(state), {type: 'outcome', effectId: wrong.effectId, outcome: 'applied'}));
  assert.equal(state.stop.effect.outcome, 'pending');
});
// Internal decimal representation only; provider acceptance is not asserted.
test('preserves exact supported versions and detaches immutable output', () => {
  const object = {...obj, generation: '9007199254740993'};
  const result = plan(scope, [doc, object]);
  assert.equal(result[1].generation, '9007199254740993');
  assert.deepEqual(result[0].updateTime, doc.updateTime);
  assert.notEqual(result[0].updateTime, doc.updateTime);
  assert.ok(Object.isFrozen(result[0].updateTime));
  assert.ok(Object.isFrozen(result));
});
test('rejects out of scope, ambiguous and sparse targets', () => {
  for (const targets of [[{...doc, path: 'users/synthetic'}], [{...doc, path: 'labPurgeTargets/other'}],
    [{...doc, path: 'labPurgeTargets/synthetic/x/..'}], [doc, doc], Array(1),
    [{...obj, bucket: 'production'}]]) assert.throws(() => plan(scope, targets));
});
test('refuses rounded or unsupported versions without normalization', () => {
  for (const generation of [9007199254740992, '01', '0', '-1', '1e20']) {
    assert.throws(() => plan(scope, [{...obj, generation}]));
  }
  for (const updateTime of [null, {seconds: 100, nanoseconds: 456}, {seconds: 100.1, nanoseconds: 0},
    {seconds: 100, nanoseconds: 1000000000}]) assert.throws(() => plan(scope, [{...doc, updateTime}]));
});
