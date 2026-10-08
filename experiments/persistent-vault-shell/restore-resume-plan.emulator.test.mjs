import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {createResumePlanLab} from './restore-resume-plan-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const {validateRestoreChunk} = require('./backup-restore-service.js');
const {createBackupRestoreBinding} = require('./backup-restore-receipt.js');
test('persisted plan reopens in fresh service, concurrent saves agree and expiry never mutates targets', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const projectId = 'demo-m8-stage', app = initializeApp({projectId}, randomUUID()), store = getFirestore(app);
  const uid = `synthetic-${randomUUID()}`; let time = 1000;
  const args = {store, projectId, now: () => time};
  const input = [{expectedOwnerUid: uid, operationId: 'chunk', backupId: 'backup', chunkIndex: 0, chunkCount: 1,
    mode: 'apply', confirmation: 'RESTORE_VALIDATED', records: [{scope: 'private-account', id: 'a',
      expectedVersion: {exists: false}, data: {synthetic: 'NEVER-PERSIST-THIS-CONTENT'}}]}];
  const sentinel = store.doc(`labResumeSentinels/${uid}`);
  try {
    await sentinel.set({completed: true});
    const service = createResumePlanLab(args);
    const preview = await service.preview(uid, input.map(command => ({...command, mode: 'preview'})));
    assert.deepEqual(preview.chunks[0].entries, [{index: 0, status: 'missing', expectedVersion: {exists: false}}]);
    assert.equal((await store.collection(`labRestoreResumePlans/${uid}/items`).get()).size, 0);
    const created = await service.create(uid, input), planId = created.planId;
    assert.deepEqual(await service.recoverCreation(uid, input), {status: 'found', planId, expiresAtMs: created.expiresAtMs});
    const unknown = structuredClone(input); unknown[0].operationId = 'never-created';
    assert.deepEqual(await service.recoverCreation(uid, unknown), {status: 'unconfirmed'});
    const [first, second] = await Promise.all([service.save(uid, planId, input), service.save(uid, planId, input)]);
    assert.deepEqual(first, second);
    time++;
    assert.deepEqual(await createResumePlanLab(args).reopen(uid, planId, input), first);
    const reconstructed = await createResumePlanLab(args).reconstruct(uid, planId, 'backup', input[0].records);
    assert.equal(reconstructed.inputs[0].operationId, input[0].operationId);
    assert.deepEqual(await service.reopen(uid, planId, reconstructed.inputs), first);
    await assert.rejects(service.reconstruct('different-owner', planId, 'backup', input[0].records), /MISSING_NEW_PREVIEW/);
    for (const method of ['save', 'reopen', 'reconcile']) {
      const mutable = structuredClone(input);
      const pending = service[method](uid, planId, mutable);
      mutable[0].records[0].data.synthetic = 'CHANGED-AFTER-CALL';
      const result = await pending;
      if (method !== 'reconcile') assert.deepEqual(result, first);
      else assert.equal(result.chunks[0].status, 'unconfirmed');
    }
    const records = await store.collection(`labRestoreResumePlans/${uid}/items`).get();
    assert.equal(records.size, 1);
    assert.equal(JSON.stringify(records.docs[0].data()).includes('NEVER-PERSIST-THIS-CONTENT'), false);
    assert.deepEqual((await service.reconcile(uid, planId, input)).chunks,
      [{operationId: 'chunk', status: 'unconfirmed'}]);
    const receiptRef = store.doc(`mutationResults/${uid}/operations/chunk`);
    const receipt = {...createBackupRestoreBinding({uid, command: validateRestoreChunk(input[0], uid)}),
      status: 'applied', duplicate: false};
    await receiptRef.set(receipt);
    assert.deepEqual((await createResumePlanLab(args).reconcile(uid, planId, input)).chunks,
      [{operationId: 'chunk', status: 'applied'}]);
    await receiptRef.update({operationHash: '0'.repeat(64)});
    await assert.rejects(service.reconcile(uid, planId, input), /BINDING_MISMATCH/);
    await receiptRef.set(receipt);
    assert.equal((await service.removeExpired(uid, planId)).status, 'retained');
    time = first.expiresAtMs;
    await assert.rejects(service.recoverCreation(uid, input), /EXPIRED_NEW_PREVIEW/);
    await assert.rejects(service.reconstruct(uid, planId, 'backup', input[0].records), /EXPIRED_NEW_PREVIEW/);
    await assert.rejects(service.reopen(uid, planId, input), /EXPIRED_NEW_PREVIEW/);
    await assert.rejects(service.save(uid, planId, input), /EXPIRED_NEW_PREVIEW/);
    await assert.rejects(service.reconcile(uid, planId, input), /EXPIRED_NEW_PREVIEW/);
    assert.deepEqual((await receiptRef.get()).data(), receipt);
    assert.deepEqual((await sentinel.get()).data(), {completed: true});
    assert.equal((await records.docs[0].ref.get()).data().expiresAtMs, first.expiresAtMs);
    await records.docs[0].ref.update({expiresAtMs: first.expiresAtMs - 1});
    await assert.rejects(service.removeExpired(uid, planId), /EXPIRY_UNVERIFIED/);
    await records.docs[0].ref.update({expiresAtMs: first.expiresAtMs});
    assert.equal((await service.removeExpired(uid, planId)).status, 'removed');
    assert.equal((await service.removeExpired(uid, planId)).status, 'absent');
    await assert.rejects(service.save(uid, planId, input), /MISSING_NEW_PREVIEW/);
    assert.equal((await records.docs[0].ref.get()).exists, false);
    assert.deepEqual((await receiptRef.get()).data(), receipt);
    assert.deepEqual((await sentinel.get()).data(), {completed: true});
    const stale = structuredClone(input);
    stale[0].records[0].expectedVersion = {exists: true, updateTime: {seconds: 1, nanoseconds: 0}};
    await assert.rejects(service.create(uid, stale), /NEW_PREVIEW_REQUIRED/);
    // A new isolated owner lets two sweep workers race without touching the
    // browser fixture or the completed-record/receipt namespaces.
    const sweepUid = `synthetic-${randomUUID()}`;
    const sweepInput = structuredClone(input); sweepInput[0].expectedOwnerUid = sweepUid;
    const expired = await service.create(sweepUid, sweepInput);
    time += 1;
    const live = await service.create(sweepUid, sweepInput);
    time = expired.expiresAtMs;
    const swept = await Promise.all([service.sweepExpired(sweepUid, {limit: 1}), service.sweepExpired(sweepUid, {limit: 1})]);
    // The first page is lexicographic, not chronological. Finish each cursor;
    // delete is idempotent even when the other worker already removed the row.
    for (const initial of swept) {
      let cursor = initial.next;
      while (cursor) cursor = (await service.sweepExpired(sweepUid, {limit: 1, after: cursor})).next;
    }
    await assert.rejects(service.reopen(sweepUid, expired.planId, sweepInput), /MISSING_NEW_PREVIEW/);
    assert.equal((await service.reopen(sweepUid, live.planId, sweepInput)).expiresAtMs, live.expiresAtMs);
    const recoverUid = `synthetic-${randomUUID()}`, recoverInput = structuredClone(input);
    recoverInput[0].expectedOwnerUid = recoverUid;
    await service.create(recoverUid, recoverInput);
    const altered = structuredClone(recoverInput); altered[0].records[0].data.synthetic = 'ALTERED';
    await assert.rejects(service.recoverCreation(recoverUid, altered), /MISMATCH/);
    await service.create(recoverUid, recoverInput);
    await assert.rejects(service.recoverCreation(recoverUid, recoverInput), /AMBIGUOUS/);
    assert.deepEqual((await receiptRef.get()).data(), receipt);
    assert.deepEqual((await sentinel.get()).data(), {completed: true});
  } finally {await store.terminate(); await deleteApp(app);}
});
