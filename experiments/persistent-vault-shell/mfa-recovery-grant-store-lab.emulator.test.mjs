import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {reserveMfaRecoveryGrant, finalizeMfaRecoveryGrant} from './mfa-recovery-grant-store-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

test('MFA recovery grant is CAS-persisted and consumed only after selective absence', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `mfa-grant-${randomUUID()}`);
  const store = getFirestore(app), path = `labMfaRecovery/${randomUUID()}`;
  const candidate = {uid: 'user-synthetic', enrollmentId: 'totp-old', codeHash: 'hash-a',
    createdAtMs: 1000, expiresAtMs: 301000};
  try {
    const outcomes = await Promise.allSettled([
      reserveMfaRecoveryGrant(store, path, candidate),
      reserveMfaRecoveryGrant(store, path, {...candidate, codeHash: 'hash-b'}),
    ]);
    assert.equal(outcomes.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(outcomes.filter(item => item.status === 'rejected').length, 1);
    await assert.rejects(finalizeMfaRecoveryGrant(store, path, 1, ['totp-old', 'totp-new'], 2000),
      /FACTOR_STILL_PRESENT/);
    assert.equal((await store.doc(path).get()).data().status, 'reserved');
    assert.deepEqual(await finalizeMfaRecoveryGrant(store, path, 1, ['totp-new'], 2000),
      {status: 'consumed', duplicate: false, revision: 2});
    assert.deepEqual(await finalizeMfaRecoveryGrant(store, path, 1, ['totp-new'], 3000),
      {status: 'consumed', duplicate: true, revision: 2});
    assert.equal((await store.doc(path).get()).data().enrollmentId, 'totp-old');
  } finally {
    await store.recursiveDelete(store.collection('labMfaRecovery'));
    await deleteApp(app);
  }
});
