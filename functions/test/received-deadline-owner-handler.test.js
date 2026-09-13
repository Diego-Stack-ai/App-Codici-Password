const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {HttpsError} = require('firebase-functions/v2/https');
const source = readFileSync(require.resolve('../index'), 'utf8');
const guardStart = source.indexOf('function requireMutationOwner(');
const guardEnd = source.indexOf('exports.applyOfflineMutation', guardStart);
const start = source.indexOf('exports.manageReceivedDeadline =');
const end = source.indexOf('exports.respondToInvitation =', start);
assert.ok(guardStart >= 0 && guardEnd > guardStart && start >= 0 && end > start);
const shareId = 'a'.repeat(40);
const command = {expectedOwnerUid: 'A', receivedDeadlineId: shareId, action: 'complete'};

function fixture({permission = 'manage', recipientEmail = 'a@example.invalid', authorized = true} = {}) {
  let accesses = 0;
  const reads = [], writes = [], notifications = [];
  const reference = path => ({path, collection: id => reference(`${path}/${id}`), doc: id => reference(`${path}/${id}`)});
  const store = {collection: reference, runTransaction: callback => callback({
    get: async ref => {
      reads.push(ref.path);
      const data = ref.path === `users/A/receivedDeadlines/${shareId}`
        ? {permission, recipientEmail, ownerUid: 'owner', sourceDeadlineId: 'deadline'}
        : ref.path === 'users/owner/scadenze/deadline' ? {type: 'Synthetic', recipients: authorized ? [{email: 'a@example.invalid', canManage: true}] : []} : null;
      return {exists: !!data, data: () => data};
    },
    update: (ref, data) => writes.push({path: ref.path, data})
  })};
  const firestore = () => { accesses += 1; return store; };
  firestore.FieldValue = {serverTimestamp: () => 'synthetic-time'};
  const context = vm.createContext({exports: {}, HttpsError, onCall: (_options, handler) => handler,
    admin: {firestore}, normalizeEmail: value => String(value || '').toLowerCase().trim(),
    deadlineRecipients: record => record.recipients,
    validFutureIsoDate: value => /^2099-\d{2}-\d{2}$/.test(value),
    notifyDeadlineOwner: async (...args) => notifications.push(args)
  });
  vm.runInContext(source.slice(guardStart, guardEnd) + '\n' + source.slice(start, end), context);
  return {reads, writes, notifications, accesses: () => accesses,
    run: (data = command, uid = 'A') => context.exports.manageReceivedDeadline({data,
      auth: uid ? {uid, token: {email: 'a@example.invalid', name: 'Synthetic'}} : null})};
}

test('received deadline owner binding rejects missing/malformed owner and A command with B token before DB', async () => {
  for (const expectedOwnerUid of [undefined, null, '', false, 7, {uid: 'A'}, 'B']) {
    const f = fixture();
    await assert.rejects(f.run({...command, expectedOwnerUid}), error =>
      error.code === 'failed-precondition' && error.details?.reason === 'MUTATION_OWNER_MISMATCH');
    assert.equal(f.accesses(), 0); assert.equal(f.reads.length, 0); assert.equal(f.writes.length, 0); assert.equal(f.notifications.length, 0);
  }
  const f = fixture();
  await assert.rejects(f.run(command, 'B'), error => error.details?.reason === 'MUTATION_OWNER_MISMATCH');
  assert.equal(f.accesses(), 0); assert.equal(f.notifications.length, 0);
});

test('received deadline still requires authentication before processing any command', async () => {
  const f = fixture();
  await assert.rejects(f.run(command, null), error => error.code === 'unauthenticated');
  assert.equal(f.accesses(), 0); assert.equal(f.writes.length, 0);
});

test('bound completion and renewal preserve recipient/source updates and owner notification', async () => {
  for (const action of ['complete', 'renew']) {
    const f = fixture(), nextDueDate = action === 'renew' ? '2099-12-01' : '';
    const result = await f.run({...command, action, nextDueDate});
    assert.equal(result.ok, true); assert.equal(result.action, action);
    assert.deepEqual(f.writes.map(item => item.path), ['users/owner/scadenze/deadline', `users/A/receivedDeadlines/${shareId}`]);
    for (const {data} of f.writes) {
      assert.equal(data.completed, action === 'complete');
      if (action === 'renew') assert.equal(data.dueDate, nextDueDate);
    }
    assert.equal(f.notifications.length, 1); assert.equal(f.notifications[0][1], 'owner');
  }
});

test('owner binding never bypasses received permission, recipient email or source revocation', async () => {
  for (const options of [{permission: 'read'}, {recipientEmail: 'other@example.invalid'}, {authorized: false}]) {
    const f = fixture(options);
    await assert.rejects(f.run(), error => error.code === 'permission-denied');
    assert.equal(f.writes.length, 0); assert.equal(f.notifications.length, 0);
  }
});
