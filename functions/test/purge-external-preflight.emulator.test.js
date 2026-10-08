const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {randomUUID} = require('node:crypto');
const {runInNewContext} = require('node:vm');
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {HttpsError} = require('firebase-functions/v2/https');
const policy = require('../archive-purge-service');
const receipts = require('../archive-purge-receipt');

test('purge external preflight rejects with real emulator transaction and zero destructive calls', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085'
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-preflight'}, `purge-${randomUUID()}`);
  const db = getFirestore(app);
  const source = readFileSync(require.resolve('../index'), 'utf8');
  const guard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
  const handler = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));
  let storageCalls = 0, destructiveCalls = 0;
  // Real Firestore reads/transactions, deliberately unreachable destructive transports.
  const store = {collection: (...args) => db.collection(...args), doc: (...args) => db.doc(...args),
    runTransaction: callback => db.runTransaction(async transaction => await callback(transaction)),
    recursiveDelete: () => { destructiveCalls++; throw new Error('DESTRUCTIVE_CALL_FORBIDDEN'); }};
  const scope = {exports: {}, ...policy, ...receipts, HttpsError, FieldValue,
    // Historical preflight coverage, not the currently suspended endpoint.
    isArchivePurgeSuspended: () => false,
    onCall: (_options, callback) => callback, getFirestore: () => store,
    getStorage: () => { storageCalls++; throw new Error('STORAGE_CALL_FORBIDDEN'); }};
  runInNewContext(guard + handler, scope);
  try {
    for (const context of ['private', 'company']) {
      for (const collection of ['accountWidgets', 'sharedVaultLinks']) {
        for (const resume of [false, true]) {
          const uid = `synthetic-${randomUUID()}`;
          const command = {expectedOwnerUid: uid, accountId: 'a', operationId: 'op', context,
            ...(context === 'company' ? {companyId: 'c'} : {}), expectedRevision: 1, confirmation: 'DELETE_FOREVER'};
          const root = db.doc(`users/${uid}`);
          const account = db.doc(policy.accountPath(uid, command));
          const result = db.doc(`mutationResults/${uid}/operations/op`);
          const external = root.collection(collection).doc('external');
          await root.set({note: 'synthetic-preserved'});
          if (!resume) await account.set({isArchived: true, revision: 1, note: 'synthetic-preserved'});
          await external.set({context, accountId: 'a', ...(context === 'company' ? {companyId: 'c'} : {})});
          if (resume) await result.set({...receipts.createArchivePurgeBinding({uid, command: policy.validatePurgeCommand(command)}), status: 'processing'});
          const refs = [root, account, result, external, root.collection('auditEvents').doc('op')];
          const before = await Promise.all(refs.map(async ref => (await ref.get()).data()));
          await assert.rejects(scope.exports.purgeArchivedAccount({auth: {uid}, data: command}), error =>
            error.code === 'failed-precondition' && error.details?.reason === 'ARCHIVE_PURGE_EXTERNAL_REFERENCES_UNVERIFIED');
          assert.deepEqual(await Promise.all(refs.map(async ref => (await ref.get()).data())), before);
        }
      }
    }
    assert.equal(storageCalls, 0);
    assert.equal(destructiveCalls, 0);
    // Positive control: prove the Storage tripwire is actually reached when
    // the preflight allows unrelated references. Never execute a deletion.
    for (const resume of [false, true]) {
      const uid = `synthetic-${randomUUID()}`;
      const command = {expectedOwnerUid: uid, accountId: 'a', operationId: 'op', context: 'private',
        expectedRevision: 1, confirmation: 'DELETE_FOREVER'};
      const root = db.doc(`users/${uid}`);
      const account = db.doc(policy.accountPath(uid, command));
      const result = db.doc(`mutationResults/${uid}/operations/op`);
      const external = root.collection('accountWidgets').doc('other');
      await root.set({note: 'synthetic'});
      if (!resume) await account.set({isArchived: true, revision: 1});
      await external.set({context: 'company', accountId: 'a', companyId: 'other'});
      if (resume) await result.set({...receipts.createArchivePurgeBinding({uid, command: policy.validatePurgeCommand(command)}), status: 'processing'});
      const before = await Promise.all([root, account, external].map(async ref => (await ref.get()).data()));
      const previousReceipt = (await result.get()).data();
      await assert.rejects(scope.exports.purgeArchivedAccount({auth: {uid}, data: command}), /STORAGE_CALL_FORBIDDEN/);
      assert.deepEqual(await Promise.all([root, account, external].map(async ref => (await ref.get()).data())), before);
      const receipt = (await result.get()).data();
      assert.equal(receipt.status, 'processing');
      if (resume) assert.deepEqual(receipt, previousReceipt);
      assert.equal((await root.collection('auditEvents').doc('op').get()).exists, false);
    }
    assert.equal(storageCalls, 2);
    assert.equal(destructiveCalls, 0);
  } finally {
    await db.terminate();
    await deleteApp(app);
  }
});
