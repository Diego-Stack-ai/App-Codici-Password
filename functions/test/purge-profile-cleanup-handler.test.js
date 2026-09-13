const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readFileSync} = require('node:fs');
const policy = require('../archive-purge-service');
const source = readFileSync(require.resolve('../index.js'), 'utf8');
const ownerGuard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const handler = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));

function fixture({previous = null, companies = 1, malformed = false} = {}) {
  const command = {expectedOwnerUid: 'owner', accountId: 'account', operationId: 'operation', context: 'private', expectedRevision: 1, confirmation: 'DELETE_FOREVER'};
  const states = new Map();
  const root = 'users/owner', operationPath = `${root}/archiveOperations/operation`;
  const link = {linkedAccountId: 'account', linkedAccountCompanyId: '', note: 'preserve'};
  states.set(root, {contactPhones: [link]});
  if (!previous) states.set(`${root}/accounts/account`, {isArchived: true, revision: 1});
  if (previous) states.set(operationPath, {...previous, accountId: 'account', context: 'private', companyId: null});
  for (let index = 0; index < companies; index++) states.set(`${root}/aziende/c${index}`, {emails: {pec: link}});
  if (malformed) states.set(`${root}/aziende/c0`, {emails: []});
  let deletions = 0, transactions = 0;
  const ref = path => ({path, collection: key => ref(`${path}/${key}`), doc: key => ref(`${path}/${key}`),
    get: async () => ({docs: []})});
  const snapshot = path => ({exists: states.has(path), data: () => states.get(path), ref: ref(path)});
  const store = {collection: key => ref(key), doc: ref,
    recursiveDelete: async reference => { deletions++; states.delete(reference.path); },
    runTransaction: async callback => {
      transactions++; const writes = []; let wrote = false;
      const result = await callback({get: async reference => {
        assert.equal(wrote, false, 'all reads must precede writes');
        if (reference.path === `${root}/aziende`) return {docs: [...states.keys()].filter(path => path.startsWith(`${root}/aziende/`)).map(snapshot)};
        return snapshot(reference.path);
      }, update: (reference, patch) => { wrote = true; writes.push([reference.path, patch]); },
      set: (reference, patch) => { wrote = true; writes.push([reference.path, patch]); }});
      for (const [path, patch] of writes) states.set(path, {...states.get(path), ...patch});
      return result;
    }};
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const context = vm.createContext({...policy, exports: {}, onCall: (_config, run) => run, HttpsError,
    getFirestore: () => store, getStorage: () => ({bucket: () => ({})}), FieldValue: {serverTimestamp: () => 'time'}});
  vm.runInContext(ownerGuard + handler, context);
  return {states, counters: () => ({deletions, transactions}), run: () => context.exports.purgeArchivedAccount({auth: {uid: 'owner'}, data: command})};
}

test('real purge handler cleans current profile and companies before marking success; completed purge retry is a no-op', async () => {
  const f = fixture();
  assert.equal((await f.run()).status, 'purged');
  assert.equal(f.states.get('users/owner').contactPhones[0].linkedAccountId, '');
  assert.equal(f.states.get('users/owner/aziende/c0').emails.pec.note, 'preserve');
  assert.equal(f.states.get('users/owner/aziende/c0').emails.pec.linkedAccountCompanyId, '');
  const before = structuredClone([...f.states]);
  assert.equal((await f.run()).duplicate, true);
  assert.deepEqual([...f.states], before); assert.equal(f.counters().deletions, 1);
  assert.deepEqual(Object.keys(f.states.get('users/owner/auditEvents/operation')).sort(), ['accountId', 'action', 'actorUid', 'at', 'context']);
});

test('processing operation without Account resumes cleanup instead of leaving dangling sources', async () => {
  const f = fixture({previous: {status: 'processing'}});
  assert.equal((await f.run()).status, 'purged');
  assert.equal(f.states.get('users/owner').contactPhones[0].linkedAccountId, '');
});

test('malformed or oversized final plan never partially cleans or records purged success', async () => {
  for (const options of [{malformed: true}, {companies: 450}]) {
    const f = fixture(options);
    await assert.rejects(f.run());
    assert.equal(f.states.get('users/owner/archiveOperations/operation').status, 'processing');
    assert.equal(f.states.get('users/owner').contactPhones[0].linkedAccountId, 'account');
    assert.equal(f.states.has('users/owner/auditEvents/operation'), false);
  }
});
