import {createHash} from 'node:crypto';
import {planLabPurgeTargets, bindLabPurgeTarget} from './purge-target-plan.mjs';
const OUTCOMES = new Set(['unstarted', 'pending', 'applied', 'not-applied', 'unknown']);
const OUTCOME_ACTIONS = new Set(['applied', 'not-applied', 'unknown']);
const OUTCOME_COST = {unstarted: 0, pending: 1, applied: 2, 'not-applied': 2, unknown: 2};
const fail = code => Object.assign(new Error(code), {code});
function assertPlainShape(value, keys, code) {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw fail(code);
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) throw fail(code);
  if (Object.getOwnPropertySymbols(value).length) throw fail(code);
  const names = Object.getOwnPropertyNames(value);
  if (names.length !== keys.length) throw fail(code);
  for (const key of keys) {
    if (!names.includes(key)) throw fail(code);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable || !('value' in descriptor)) throw fail(code);
  }
}
const readData = (value, key) => Object.getOwnPropertyDescriptor(value, key)?.value;
// Pure in-memory experiment; deliberately no hydration, persistence or release.
export function createPurgeSequence(scope, claim, targets) {
  const plan = planLabPurgeTargets(scope, targets);
  const ids = plan.map(target => bindLabPurgeTarget(scope, claim, target).effectId);
  const planHash = createHash('sha256').update(JSON.stringify({domain: 'lab-purge-sequence-v1', ids})).digest('hex');
  const issued = new WeakSet();
  const issue = (revision, stopRequested, outcomes) => {
    const state = Object.freeze({planHash, revision, stopRequested, outcomes: Object.freeze(outcomes)});
    issued.add(state); return state;
  };
  const check = state => { if (state === null || typeof state !== 'object' || !issued.has(state)) throw fail('PURGE_SEQUENCE_FOREIGN'); };
  function assertPossibleSequence(outcomes, stopRequested, revision) {
    let index = 0;
    while (index < outcomes.length && outcomes[index] === 'applied') index++;
    if (index < outcomes.length && outcomes[index] !== 'unstarted') index++;
    while (index < outcomes.length) {
      if (outcomes[index] !== 'unstarted') throw fail('PURGE_SEQUENCE_IMPOSSIBLE');
      index++;
    }
    const hasNotApplied = outcomes.includes('not-applied');
    if (hasNotApplied && !stopRequested) throw fail('PURGE_SEQUENCE_IMPOSSIBLE');
    let minimumRevision = 0;
    for (const outcome of outcomes) minimumRevision += OUTCOME_COST[outcome];
    if (stopRequested && !hasNotApplied) minimumRevision++;
    if (revision < minimumRevision) throw fail('PURGE_SEQUENCE_IMPOSSIBLE');
  }
  function importSnapshot(snapshot) {
    assertPlainShape(snapshot, ['planHash', 'revision', 'stopRequested', 'outcomes'], 'PURGE_SEQUENCE_SNAPSHOT');
    const importedHash = readData(snapshot, 'planHash');
    const revision = readData(snapshot, 'revision');
    const stopRequested = readData(snapshot, 'stopRequested');
    const rawOutcomes = readData(snapshot, 'outcomes');
    if (importedHash !== planHash) throw fail('PURGE_SEQUENCE_HASH');
    if (!Number.isSafeInteger(revision) || revision < 0) throw fail('PURGE_SEQUENCE_REVISION');
    if (typeof stopRequested !== 'boolean') throw fail('PURGE_SEQUENCE_SNAPSHOT');
    if (!Array.isArray(rawOutcomes) || rawOutcomes.length !== ids.length || Object.getOwnPropertySymbols(rawOutcomes).length) throw fail('PURGE_SEQUENCE_SNAPSHOT');
    const names = Object.getOwnPropertyNames(rawOutcomes);
    if (names.length !== ids.length + 1 || !names.includes('length')) throw fail('PURGE_SEQUENCE_SNAPSHOT');
    const outcomes = [];
    for (let i = 0; i < ids.length; i++) {
      const descriptor = Object.getOwnPropertyDescriptor(rawOutcomes, String(i));
      if (!descriptor || descriptor.get || descriptor.set || !descriptor.enumerable || !('value' in descriptor) || !OUTCOMES.has(descriptor.value)) throw fail('PURGE_SEQUENCE_SNAPSHOT');
      outcomes.push(descriptor.value);
    }
    assertPossibleSequence(outcomes, stopRequested, revision);
    const state = issue(revision, stopRequested, outcomes);
    return state;
  }
  return Object.freeze({planHash, initial: issue(0, false, ids.map(() => 'unstarted')),
    importSnapshot,
    transition(state, expectedRevision, action) {
      check(state);
      if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw fail('PURGE_SEQUENCE_REVISION');
      if (state.revision !== expectedRevision) throw fail('PURGE_SEQUENCE_CONFLICT');
      if (state.revision === Number.MAX_SAFE_INTEGER) throw fail('PURGE_SEQUENCE_OVERFLOW');
      if (action === null || typeof action !== 'object' || Array.isArray(action)) throw fail('PURGE_SEQUENCE_ACTION');
      const proto = Object.getPrototypeOf(action);
      if (proto !== Object.prototype && proto !== null || Object.getOwnPropertySymbols(action).length) throw fail('PURGE_SEQUENCE_ACTION');
      const typeDescriptor = Object.getOwnPropertyDescriptor(action, 'type');
      if (!typeDescriptor || typeDescriptor.get || typeDescriptor.set || !typeDescriptor.enumerable || !('value' in typeDescriptor)) throw fail('PURGE_SEQUENCE_ACTION');
      const type = typeDescriptor.value;
      const outcomes = [...state.outcomes];
      let stop = state.stopRequested;
      if (type === 'stop') {
        assertPlainShape(action, ['type'], 'PURGE_SEQUENCE_ACTION');
        stop = true;
      }
      else {
        if (type !== 'begin' && type !== 'outcome') throw fail('PURGE_SEQUENCE_ACTION');
        assertPlainShape(action, type === 'begin' ? ['type', 'index', 'planHash'] : ['type', 'index', 'planHash', 'outcome'], 'PURGE_SEQUENCE_ACTION');
        const index = readData(action, 'index');
        if (!Number.isSafeInteger(index) || index < 0 || index >= ids.length) throw fail('PURGE_SEQUENCE_INDEX');
        if (readData(action, 'planHash') !== planHash) throw fail('PURGE_SEQUENCE_HASH');
        if (type === 'begin') {
          if (stop) throw fail('PURGE_SEQUENCE_STOP');
          if (outcomes[index] !== 'unstarted' || outcomes.slice(0, index).some(v => v !== 'applied')) throw fail('PURGE_SEQUENCE_ORDER');
          outcomes[index] = 'pending';
        } else {
          const outcome = readData(action, 'outcome');
          if (typeof outcome !== 'string' || !OUTCOME_ACTIONS.has(outcome)) throw fail('PURGE_SEQUENCE_OUTCOME');
          if (outcomes[index] !== 'pending' && outcomes[index] !== 'unknown') throw fail('PURGE_SEQUENCE_ORDER');
          outcomes[index] = outcome;
          if (outcome === 'not-applied') stop = true;
        }
      }
      return issue(state.revision + 1, stop, outcomes);
    },
    summary(state) {
      check(state);
      const appliedCount = state.outcomes.filter(v => v === 'applied').length;
      const unresolved = state.outcomes.some(v => ['pending', 'unknown'].includes(v));
      return Object.freeze({appliedCount, unresolved, stopped: state.stopRequested && !unresolved,
        allApplied: appliedCount === ids.length});
    }
  });
}
