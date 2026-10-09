import {claimBoundEffectState, boundEffectStateToken, transitionBoundEffectState} from './purge-bound-effect-state.mjs';
import {createPurgeEffectSequence} from './purge-effect-sequence.mjs';

const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const fail = () => { throw new Error('PURGE_BOUND_EFFECT_STATE_LAB_CONFLICT'); };

export function createPurgeBoundEffectStateLab(store) {
  if (!store || store.projectId !== 'demo-purge-fence' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085')
    throw new Error('PURGE_LAB_ONLY');
  const ref = id => { if (typeof id !== 'string' || !ID.test(id)) fail(); return store.doc(`labPurgeBoundEffects/${id}`); };
  return Object.freeze({
    async claim(id, prepared, expected, plan) {
      const target = ref(id);
      return store.runTransaction(async tx => {
        if ((await tx.get(target)).exists) fail();
        const state = claimBoundEffectState(prepared, expected, plan);
        tx.create(target, state); return state;
      });
    },
    async transition(id, expected, plan, action) {
      const target = ref(id);
      return store.runTransaction(async tx => {
        const snapshot = await tx.get(target);
        if (!snapshot.exists) fail();
        const next = transitionBoundEffectState(snapshot.data(), expected, plan, action);
        tx.set(target, next); return next;
      });
    },
    async token(id, plan) {
      const snapshot = await ref(id).get();
      if (!snapshot.exists) fail();
      return boundEffectStateToken(snapshot.data(), plan);
    },
    async finalize(id, expected, plan) {
      const target = ref(id), completion = store.doc(`labPurgeBoundEffectCompletions/${id}`);
      return store.runTransaction(async tx => {
        const [snapshot, prior] = await Promise.all([tx.get(target), tx.get(completion)]);
        if (!snapshot.exists) fail();
        const token = boundEffectStateToken(snapshot.data(), plan);
        if (!expected || Object.keys(token).some(key => expected[key] !== token[key])) fail();
        const summary = createPurgeEffectSequence(plan).summary(snapshot.data().effectSequence);
        if (!summary.allApplied || summary.unresolved || snapshot.data().stop.stopRequested) fail();
        const value = {operationId: token.operationId, claimRevision: token.claimRevision,
          sequenceHash: token.sequenceHash, sequenceRevision: token.sequenceRevision, status: 'effects-applied',
          destructiveAllowed: false};
        if (prior.exists) {
          if (JSON.stringify(prior.data()) !== JSON.stringify(value)) fail();
          return {...value, duplicate: true};
        }
        tx.create(completion, value);
        return {...value, duplicate: false};
      });
    }
  });
}
