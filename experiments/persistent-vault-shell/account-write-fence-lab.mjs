import {createHash} from 'node:crypto';
import {invalidatePurgeForWrite} from './purge-fence-model.mjs';

// Server-selected laboratory hook, never accepted from callable input.
export function createAccountWriteFenceLab(db) {
  if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' || db.projectId !== 'demo-vault-shell') {
    throw Error('PURGE_LAB_ONLY');
  }
  return async (transaction, accountRef) => {
    const path = accountRef.path;
    if (typeof path !== 'string' || !/^users\/[A-Za-z0-9_-]+\/(?:aziende\/[A-Za-z0-9_-]+\/)?accounts\/[A-Za-z0-9_-]+$/.test(path)) {
      throw Error('PURGE_ACCOUNT_PATH_INVALID');
    }
    const id = createHash('sha256').update(path).digest('hex');
    const ref = db.doc(`labPurgeStates/${id}`);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) return () => {};
    const state = snapshot.data();
    // Do not discard an exclusive sequence or its history, including after stop.
    if (Object.keys(state).length !== 1 || !state.fence) throw Error('PURGE_WRITE_BLOCKED');
    const fence = invalidatePurgeForWrite(state.fence);
    return () => transaction.set(ref, {fence});
  };
}
