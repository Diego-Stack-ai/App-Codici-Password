import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {createBankingEditHandler} from './banking-edit-handler.mjs';
import {bankingEditBasis} from './banking-edit-contract.mjs';
import {createAccountWriteFenceLab} from './account-write-fence-lab.mjs';
import {enterExclusivePurge} from './purge-fence-model.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const hash = value => createHash('sha256').update(value).digest('hex');
test('bank edits invalidate prepared purge, preserve history and race atomically with claim', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 60000
}, async () => {
  const app = initializeApp({projectId: 'demo-vault-shell'}, randomUUID()), db = getFirestore(app);
  try {
    const run = createBankingEditHandler({db, hash, timestamp: () => 1000, beforeAccountWrite: createAccountWriteFenceLab(db)});
    for (const domain of ['private', 'company']) for (const scenario of ['prepared', 'history', 'race']) {
      const uid = `synthetic-${randomUUID()}`, account = {domain, id: 'a', ...(domain === 'company' ? {companyId: 'c'} : {})};
      const parent = domain === 'company' ? `users/${uid}/aziende/c` : `users/${uid}`;
      if (domain === 'company') await db.doc(parent).create({ownerId: uid});
      const ref = db.doc(`${parent}/accounts/a`), original = {ownerId: uid, revision: 1,
        banking: [{bankId: 'bank', iban: 'BEFORE', cards: [{pin: ''}]}], keep: 'SYNTHETIC'};
      await ref.create(original); const before = await ref.get();
      const fenceRef = db.doc(`labPurgeStates/${hash(ref.path)}`), prepared = {phase: 'prepared', revision: 2, operationId: 'purge'};
      await fenceRef.create({fence: prepared, ...(scenario === 'history' ? {sequence: {keep: true}} : {})});
      const basis = bankingEditBasis(original, uid, account);
      const request = {expectedOwnerUid: uid, operationId: 'edit', account, bankId: 'bank', cardIndex: null,
        patch: {iban: 'AFTER'}, expectedRevision: 1, expectedFingerprint: hash(basis.fingerprintInput)};
      const mutate = () => run(request, {auth: {uid}, app: {appId: 'test'}});
      let applied = false;
      if (scenario === 'race') {
        const results = await Promise.allSettled([mutate(), db.runTransaction(async tx => {
          const state = (await tx.get(fenceRef)).data();
          tx.set(fenceRef, {fence: enterExclusivePurge(state.fence, prepared)});
        })]);
        assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
        applied = results[0].status === 'fulfilled';
        assert.match(results[applied ? 1 : 0].reason.message, /FENCE_BUSY|FENCE_CONFLICT/);
      } else if (scenario === 'history') await assert.rejects(mutate(), /PURGE_WRITE_BLOCKED/);
      else {await mutate(); applied = true; const fence = await fenceRef.get(); await mutate(); assert.ok((await fenceRef.get()).updateTime.isEqual(fence.updateTime));}
      const saved = await ref.get();
      assert.equal(saved.data().banking[0].iban, applied ? 'AFTER' : 'BEFORE');
      assert.equal(saved.data().keep, 'SYNTHETIC');
      if (!applied) assert.ok(saved.updateTime.isEqual(before.updateTime));
      assert.equal((await db.doc(`mutationResults/${uid}/operations/banking-edit-edit`).get()).exists, applied);
      if (scenario === 'history') assert.deepEqual((await fenceRef.get()).data().sequence, {keep: true});
    }
  } finally {await db.terminate(); await deleteApp(app);}
});
