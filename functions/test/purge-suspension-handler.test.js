const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const policy = require('../archive-purge-service');
const source = readFileSync(require.resolve('../index'), 'utf8');
const guard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const handler = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));

test('live purge interlock blocks all authenticated attempts before any data access', async () => {
  let accesses = 0;
  const forbidden = () => { accesses++; throw new Error('UNEXPECTED_DATA_ACCESS'); };
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  const context = {exports: {}, ...policy, HttpsError, onCall: (_options, callback) => callback,
    getFirestore: forbidden, getStorage: forbidden, createArchivePurgeBinding: forbidden};
  runInNewContext(guard + handler, context);
  for (const data of [
    {expectedOwnerUid: 'synthetic'},
    {expectedOwnerUid: 'synthetic', context: 'private', accountId: 'a', operationId: 'retry', expectedRevision: 1, confirmation: 'DELETE_FOREVER'},
    {expectedOwnerUid: 'synthetic', context: 'company', companyId: 'c', accountId: 'a', operationId: 'retry', expectedRevision: 1, confirmation: 'DELETE_FOREVER', bypass: true, isArchivePurgeSuspended: false}
  ]) {
    await assert.rejects(context.exports.purgeArchivedAccount({auth: {uid: 'synthetic'}, data}),
      error => error.code === 'failed-precondition' && error.details.reason === 'ARCHIVE_PURGE_TEMPORARILY_SUSPENDED');
  }
  await assert.rejects(context.exports.purgeArchivedAccount({data: {}}), error => error.code === 'unauthenticated');
  await assert.rejects(context.exports.purgeArchivedAccount({auth: {uid: 'other'}, data: {expectedOwnerUid: 'synthetic'}}),
    error => error.details.reason === 'MUTATION_OWNER_MISMATCH');
  assert.equal(accesses, 0);
});
