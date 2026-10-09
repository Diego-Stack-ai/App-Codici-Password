import {planFieldMigrationLab} from './field-kdf-format-lab.mjs';

const fail = () => { throw new Error('FIELD_KDF_MIGRATION_CONFLICT'); };

export async function migrateSyntheticFieldLab(store, path, field, expected, password, beforeCommit = null) {
  if (!store || store.projectId !== 'demo-purge-fence' || process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085' ||
      typeof path !== 'string' || !path.startsWith('labFieldKdf/') || typeof field !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(field) || !expected || typeof expected.ciphertext !== 'string' ||
      !Number.isSafeInteger(expected.updateTime?.seconds) || !Number.isInteger(expected.updateTime?.nanoseconds))
    throw new Error('FIELD_KDF_LAB_ONLY');
  const plan = await planFieldMigrationLab(expected.ciphertext, password);
  if (plan.status === 'current') return Object.freeze({status: 'current', duplicate: true});
  if (beforeCommit) await beforeCommit();
  const ref = store.doc(path);
  return store.runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists || snapshot.updateTime.seconds !== expected.updateTime.seconds ||
        snapshot.updateTime.nanoseconds !== expected.updateTime.nanoseconds || snapshot.data()[field] !== expected.ciphertext) fail();
    tx.update(ref, {[field]: plan.replacement}, {lastUpdateTime: snapshot.updateTime});
    return Object.freeze({status: 'migrated', duplicate: false, replacement: plan.replacement});
  });
}
