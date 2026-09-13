const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {HttpsError} = require('firebase-functions/v2/https');
const policy = require('../archive-purge-service');
const receipts = require('../archive-purge-receipt');
const source = readFileSync(require.resolve('../index'), 'utf8');
const ownerGuard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const handler = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));
const command = {expectedOwnerUid: 'owner', accountId: 'account', operationId: 'operation', context: 'private',
  expectedRevision: 1, confirmation: 'DELETE_FOREVER'};
const recordPath = 'users/owner/accounts/account';
const receiptPath = 'mutationResults/owner/operations/operation';
const legacyPath = 'users/owner/archiveOperations/operation';
const auditPath = 'users/owner/auditEvents/operation';
const bound = status => ({...receipts.createArchivePurgeBinding({uid: 'owner', command: policy.validatePurgeCommand(command)}), status});

function fixture({missing = false, beforeFinal, failAfterDelete = false} = {}) {
  const states = new Map(), writes = [], reads = [];
  const counts = {storage: 0, recursiveDelete: 0, transactions: 0};
  const link = {linkedAccountId: 'account', linkedAccountCompanyId: '', note: 'synthetic-note'};
  states.set('users/owner', {contactEmails: [link]});
  if (!missing) states.set(recordPath, {isArchived: true, revision: 1});
  let failNextDelete = failAfterDelete;
  const ref = path => ({path, collection: key => ref(`${path}/${key}`), doc: key => ref(`${path}/${key}`),
    get: async () => { reads.push(path); return {docs: []}; }});
  const store = {collection: ref, doc: ref,
    recursiveDelete: async reference => {
      counts.recursiveDelete++; states.delete(reference.path);
      if (failNextDelete) { failNextDelete = false; throw new Error('synthetic interruption after deletion'); }
      if (beforeFinal) beforeFinal(states);
    },
    runTransaction: async callback => {
      counts.transactions++; const staged = []; let writing = false;
      const result = await callback({
        get: async reference => {
          assert.equal(writing, false, 'transaction must read before writing');
          reads.push(reference.path);
          return {exists: states.has(reference.path), data: () => states.get(reference.path), docs: []};
        },
        set: (reference, value, options) => { writing = true; staged.push([reference.path, value, options?.merge]); },
        update: (reference, value) => { writing = true; staged.push([reference.path, value, true]); },
      });
      for (const [path, value, merge] of staged) states.set(path, merge ? {...states.get(path), ...value} : value);
      writes.push(...staged);
      return result;
    }};
  const context = vm.createContext({...policy, ...receipts, exports: {}, HttpsError, onCall: (_options, run) => run,
    getFirestore: () => store, getStorage: () => { counts.storage++; return {bucket: () => ({})}; },
    FieldValue: {serverTimestamp: () => 'synthetic-time'}});
  vm.runInContext(ownerGuard + handler, context);
  return {states, counts, writes, reads, run: (data = command) => context.exports.purgeArchivedAccount({auth: {uid: 'owner'}, data})};
}

test('forged legacy processing or purged receipt cannot authorize deletion or claim success', async () => {
  for (const status of ['processing', 'purged']) {
    const f = fixture({missing: true});
    f.states.set(legacyPath, {status, accountId: 'account', context: 'private', companyId: null});
    await assert.rejects(f.run(), error => error.code === 'failed-precondition' && error.details?.reason === 'LEGACY_ARCHIVE_RESULT_UNVERIFIED');
    assert.equal(f.counts.storage, 0); assert.equal(f.counts.recursiveDelete, 0); assert.equal(f.writes.length, 0);
    assert.equal(f.states.get('users/owner').contactEmails[0].linkedAccountId, 'account');
  }
});

test('trusted processing receipt resumes missing record cleanup and takes precedence over legacy', async () => {
  const f = fixture({missing: true});
  f.states.set(receiptPath, bound('processing'));
  f.states.set(legacyPath, {status: 'purged', accountId: 'unrelated'});
  assert.equal((await f.run()).status, 'purged');
  assert.equal(f.states.get('users/owner').contactEmails[0].linkedAccountId, '');
  assert.equal(receipts.verifyArchivePurgeReceipt(f.states.get(receiptPath), receipts.createArchivePurgeBinding({
    uid: 'owner', command: policy.validatePurgeCommand(command)
  })).status, 'purged');
  assert.equal(f.states.has(auditPath), true);
  assert.equal(f.states.get(legacyPath).accountId, 'unrelated');
});

test('trusted purged receipt returns minimal duplicate without Storage or deletion', async () => {
  const f = fixture();
  f.states.set(receiptPath, {...bound('purged'), arbitrary: 'synthetic-secret'});
  f.states.set(legacyPath, {status: 'processing'});
  const result = await f.run();
  assert.equal(JSON.stringify(result), JSON.stringify({status: 'purged', duplicate: true}));
  assert.equal(f.counts.storage, 0); assert.equal(f.counts.recursiveDelete, 0); assert.equal(f.writes.length, 0);
  assert.equal(f.states.has(recordPath), true);
});

test('changed command and malformed protected receipt fail before destructive work', async () => {
  for (const change of [{accountId: 'other'}, {context: 'company', companyId: 'company'}, {expectedRevision: 2}]) {
    const f = fixture(); f.states.set(receiptPath, bound('processing'));
    await assert.rejects(f.run({...command, ...change}), error => error.details?.reason === 'ARCHIVE_RESULT_UNVERIFIED');
    assert.equal(f.counts.storage, 0); assert.equal(f.counts.recursiveDelete, 0); assert.equal(f.writes.length, 0);
  }
  const f = fixture(); f.states.set(receiptPath, {status: 'processing'});
  await assert.rejects(f.run(), error => error.details?.reason === 'ARCHIVE_RESULT_UNVERIFIED');
  assert.equal(f.counts.storage, 0); assert.equal(f.counts.recursiveDelete, 0); assert.equal(f.writes.length, 0);
});

test('receipt changed or removed before final transaction prevents cleanup and success writes', async () => {
  for (const beforeFinal of [states => states.delete(receiptPath),
    states => states.set(receiptPath, {...bound('processing'), operationHash: '0'.repeat(64)})]) {
    const f = fixture({beforeFinal});
    await assert.rejects(f.run(), error => error.details?.reason === 'ARCHIVE_RESULT_UNVERIFIED');
    assert.equal(f.counts.recursiveDelete, 1);
    assert.equal(f.writes.length, 1, 'only initial processing receipt was written');
    assert.equal(f.states.get('users/owner').contactEmails[0].linkedAccountId, 'account');
    assert.equal(f.states.has(auditPath), false);
  }
});

test('failure after recursive deletion keeps bound processing receipt and same request resumes', async () => {
  const f = fixture({failAfterDelete: true});
  await assert.rejects(f.run(), /synthetic interruption/);
  assert.equal(f.states.has(recordPath), false);
  assert.equal(f.states.get(receiptPath).status, 'processing');
  assert.equal(f.states.has(auditPath), false);
  assert.equal((await f.run()).status, 'purged');
  assert.equal(f.states.get('users/owner').contactEmails[0].linkedAccountId, '');
  const writeCount = f.writes.length, deleteCount = f.counts.recursiveDelete;
  assert.equal((await f.run()).duplicate, true);
  assert.equal(f.writes.length, writeCount); assert.equal(f.counts.recursiveDelete, deleteCount);
});

test('final transaction observes another completed attempt without repeating cleanup or audit', async () => {
  const f = fixture({beforeFinal: states => states.set(receiptPath, bound('purged'))});
  const result = await f.run();
  assert.equal(JSON.stringify(result), JSON.stringify({status: 'purged', duplicate: true}));
  assert.equal(f.writes.length, 1, 'only initial processing receipt was written by this attempt');
  assert.equal(f.states.get('users/owner').contactEmails[0].linkedAccountId, 'account');
  assert.equal(f.states.has(auditPath), false);
});

test('missing deletion confirmation is rejected even for a previously completed receipt', async () => {
  const f = fixture(); f.states.set(receiptPath, bound('purged'));
  await assert.rejects(f.run({...command, confirmation: undefined}), error => error.code === 'failed-precondition');
  assert.equal(f.counts.transactions, 0); assert.equal(f.counts.storage, 0); assert.equal(f.writes.length, 0);
});
