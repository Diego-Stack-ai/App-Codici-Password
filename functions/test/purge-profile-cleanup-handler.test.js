const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const {readFileSync} = require('node:fs');
const policy = require('../archive-purge-service');
// Historical algorithm coverage only; live interlock is tested separately.
// This override exists only in the isolated VM fixture, never in the endpoint.
const legacyPolicy = {...policy, isArchivePurgeSuspended: () => false};
const receipts = require('../archive-purge-receipt');
const source = readFileSync(require.resolve('../index.js'), 'utf8');
const ownerGuard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const handler = source.slice(source.indexOf('exports.purgeArchivedAccount'), source.indexOf('exports.restoreBackupChunk'));

function fixture({previous = null, companies = 1, malformed = false, attachments = [], beforeDelete, afterDelete} = {}) {
  const command = {expectedOwnerUid: 'owner', accountId: 'account', operationId: 'operation', context: 'private', expectedRevision: 1, confirmation: 'DELETE_FOREVER'};
  const states = new Map();
  const root = 'users/owner', operationPath = 'mutationResults/owner/operations/operation';
  const link = {linkedAccountId: 'account', linkedAccountCompanyId: '', note: 'preserve'};
  states.set(root, {contactPhones: [link]});
  if (!previous) states.set(`${root}/accounts/account`, {isArchived: true, revision: 1});
  if (previous) states.set(operationPath, {...receipts.createArchivePurgeBinding({uid: 'owner', command: policy.validatePurgeCommand(command)}), ...previous});
  for (let index = 0; index < companies; index++) states.set(`${root}/aziende/c${index}`, {emails: {pec: link}});
  if (malformed) states.set(`${root}/aziende/c0`, {emails: []});
  let deletions = 0, transactions = 0;
  const ref = path => ({path, collection: key => ref(`${path}/${key}`), doc: key => ref(`${path}/${key}`),
    get: async () => ({docs: attachments.map(data => ({data: () => data}))})});
  const snapshot = path => ({exists: states.has(path), data: () => states.get(path), ref: ref(path)});
  const store = {collection: key => ref(key), doc: ref,
    recursiveDelete: async reference => {
      await beforeDelete?.(states, reference.path);
      deletions++; states.delete(reference.path);
      await afterDelete?.(states, reference.path);
    },
    runTransaction: async callback => {
      transactions++; const writes = []; let wrote = false;
      const result = await callback({get: async reference => {
        assert.equal(wrote, false, 'all reads must precede writes');
        if (reference.path === `${root}/aziende`) return {docs: [...states.keys()].filter(path => path.startsWith(`${root}/aziende/`)).map(snapshot)};
        if (['accountWidgets', 'sharedVaultLinks'].some(name => reference.path === `${root}/${name}`)) {
          return {docs: [...states.keys()].filter(path => path.startsWith(`${reference.path}/`)).map(snapshot)};
        }
        return snapshot(reference.path);
      }, update: (reference, patch) => { wrote = true; writes.push([reference.path, patch]); },
      set: (reference, patch) => { wrote = true; writes.push([reference.path, patch]); }});
      for (const [path, patch] of writes) states.set(path, {...states.get(path), ...patch});
      return result;
    }};
  class HttpsError extends Error { constructor(code, message) { super(message); this.code = code; } }
  const context = vm.createContext({...legacyPolicy, ...receipts, exports: {}, onCall: (_config, run) => run, HttpsError,
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

test('external references reject fresh and resumed purge without state changes or destructive work (synthetic dependencies)', async () => {
  for (const previous of [null, {status: 'processing'}]) {
    for (const collection of ['accountWidgets', 'sharedVaultLinks']) {
      for (const record of [{context: 'private', accountId: 'account'}, {accountId: 'unknown'}]) {
        const f = fixture({previous});
        f.states.set(`users/owner/${collection}/external`, record);
        const before = structuredClone([...f.states]);
        await assert.rejects(f.run(), error => error.code === 'failed-precondition');
        assert.deepEqual([...f.states], before);
        assert.equal(f.counters().deletions, 0);
      }
    }
  }
});

test('KNOWN LIMIT: a newer restored record between preparation and recursiveDelete is deleted without a second revision check', async () => {
  let restored = false;
  const f = fixture({beforeDelete(states, path) {
    assert.equal(states.get('mutationResults/owner/operations/operation').status, 'processing');
    assert.equal(states.get(path).revision, 1);
    // Synthetic interleaving, not execution of the restore handler or Rules.
    states.set(path, {isArchived: false, revision: 2, password: 'synthetic-new-ciphertext'});
    restored = true;
  }});
  assert.equal((await f.run()).status, 'purged');
  assert.equal(restored, true);
  assert.equal(f.states.has('users/owner/accounts/account'), false);
  assert.equal(f.states.get('mutationResults/owner/operations/operation').status, 'purged');
});

test('recreated Account prevents final unlink and a false purged receipt', async () => {
  const restored = {isArchived: false, revision: 2, password: 'synthetic-restored'};
  const f = fixture({afterDelete(states, path) { states.set(path, restored); }});
  await assert.rejects(f.run(), error => error.code === 'failed-precondition');
  assert.deepEqual(f.states.get('users/owner/accounts/account'), restored);
  assert.equal(f.states.get('users/owner').contactPhones[0].linkedAccountId, 'account');
  assert.equal(f.states.get('users/owner/aziende/c0').emails.pec.linkedAccountId, 'account');
  assert.equal(f.states.get('mutationResults/owner/operations/operation').status, 'processing');
  assert.equal(f.states.has('users/owner/auditEvents/operation'), false);
});

test('KNOWN LIMIT: references added after preflight survive a purge reported as complete', async () => {
  for (const collection of ['accountWidgets', 'sharedVaultLinks']) {
    const latePath = `users/owner/${collection}/late-reference`;
    const lateReference = {context: 'private', accountId: 'account', synthetic: true};
    const f = fixture({beforeDelete(states, path) {
      // Inject the interleaving after preflight; this does not execute the
      // widget/link writer, its authorization or Firestore concurrency engine.
      assert.equal(states.get('mutationResults/owner/operations/operation').status, 'processing');
      assert.equal(states.has(path), true);
      states.set(latePath, lateReference);
    }});
    assert.equal((await f.run()).status, 'purged');
    assert.equal(f.states.has('users/owner/accounts/account'), false);
    assert.deepEqual(f.states.get(latePath), lateReference);
    assert.equal(f.states.get('mutationResults/owner/operations/operation').status, 'purged');
  }
});

test('malformed or oversized reference plan rejects purge before destructive work', async () => {
  for (const options of [{malformed: true}, {companies: 450}]) {
    const f = fixture(options);
    await assert.rejects(f.run());
    assert.equal(f.states.has('mutationResults/owner/operations/operation'), false);
    assert.equal(f.states.has('users/owner/accounts/account'), true);
    assert.equal(f.counters().deletions, 0);
    assert.equal(f.states.get('users/owner').contactPhones[0].linkedAccountId, 'account');
    assert.equal(f.states.has('users/owner/auditEvents/operation'), false);
  }
});

test('missing or malformed attachment paths stop purge without deleting Account or reporting success', async () => {
  for (const attachment of [{}, {storagePath: ''}, {storagePath: null}, {storagePath: false}, {storagePath: 0}]) {
    const f = fixture({attachments: [attachment]});
    await assert.rejects(f.run(), error => error.code === 'failed-precondition');
    assert.equal(f.counters().deletions, 0);
    assert.equal(f.states.has('users/owner/accounts/account'), true);
    assert.equal(f.states.get('mutationResults/owner/operations/operation').status, 'processing');
    assert.equal(f.states.has('users/owner/auditEvents/operation'), false);
  }
});
