const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const policy = require('../archive-purge-service');
const rollout = require('../maturity-rollout-policy');
const source = readFileSync(require.resolve('../index'), 'utf8');
const guard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const handler = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));

test('global purge policy is enabled without accepting request-side bypasses', async () => {
  let accesses = 0;
  const forbidden = () => { accesses++; throw new Error('UNEXPECTED_DATA_ACCESS'); };
  class HttpsError extends Error {
    constructor(code, message, details) { super(message); this.code = code; this.details = details; }
  }
  const context = {exports: {}, ...policy, ...rollout, HttpsError, onCall: (_options, callback) => callback,
    getFirestore: forbidden, getStorage: forbidden, createArchivePurgeBinding: forbidden};
  runInNewContext(guard + handler, context);
  assert.equal(policy.isArchivePurgeSuspended(), false);
  await assert.rejects(context.exports.purgeArchivedAccount({auth: {uid: 'synthetic'}, data: {expectedOwnerUid: 'synthetic'}}),
    error => error.code === 'invalid-argument');
  await assert.rejects(context.exports.purgeArchivedAccount({data: {}}), error => error.code === 'unauthenticated');
  await assert.rejects(context.exports.purgeArchivedAccount({auth: {uid: 'other'}, data: {expectedOwnerUid: 'synthetic'}}),
    error => error.details.reason === 'MUTATION_OWNER_MISMATCH');
  assert.equal(accesses, 0);
  await assert.rejects(context.exports.purgeArchivedAccount({
    auth: {uid: 'synthetic', token: {
      email: rollout.MATURITY_TEST_EMAIL,
      firebase: {sign_in_provider: 'password'}
    }},
    data: {expectedOwnerUid: 'synthetic', context: 'private', accountId: 'a', operationId: 'retry', expectedRevision: 1, confirmation: 'DELETE_FOREVER'}
  }), error => error.code === 'invalid-argument' && error.message === 'Comando di eliminazione non verificabile.');
  assert.equal(accesses, 1);
});
