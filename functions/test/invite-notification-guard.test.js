"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const guard = require("../invite-notification-guard");

function fixture(seed = {}, hooks = {}) {
  const records = new Map(Object.entries(seed));
  for (const path of records.keys()) {
    const match = /^users\/owner\/accounts\/([^/]+)$/.exec(path);
    if (match) {const item = invite(match[1]); records.set(`invites/${item.inviteId}`, item);}
  }
  const auth = hooks.auth || {getUserByEmail: async () => ({uid: 'guest'})};
  let tail = Promise.resolve();
  const ref = path => ({path, async get() {
    return {exists: records.has(path), data: () => records.get(path)};
  }});
  const db = {
    doc: ref,
    collection: name => ({doc: id => ref(`${name}/${id}`)}),
    runTransaction(fn) {
      const run = tail.then(() => fn({
        get: async item => {if (hooks.get) await hooks.get({path: item.path, records}); return item.get();},
        set: (item, value) => records.set(item.path, structuredClone(value))
      }));
      tail = run.catch(() => {});
      return run;
    }
  };
  return {db, records, auth};
}

const email = "guest@example.invalid";
const key = "guest_example_invalid";
const auditRef = "11111111-1111-4111-8111-111111111111";
function account(overrides = {}) {
  return {nomeAccount: "Account autorevole", isArchived: false, sharingCycle: 0,
    sharedWith: {[key]: {email, status: "pending", notifyEmail: true, notifyPush: true}}, ...overrides};
}
function invite(accountId = "account1", overrides = {}) {
  return {inviteId: `${accountId}_${key}`, ownerId: "owner", senderId: "owner", accountId,
    recipientEmail: email, status: "pending", cycle: 0, accountName: "Nome falsificato",
    notifyEmail: false, notifyPush: false, auditRef, ...overrides};
}

test("notification authority comes from the live Account, never client invite flags", async () => {
  const f = fixture({"users/owner/accounts/account1": account()});
  const current = await guard.authoritativeInvite({db: f.db, auth: f.auth, invite: invite(), inviteId: `${invite().inviteId}`});
  assert.deepEqual(current, {ownerId: "owner", recipientUid: "guest", notificationInstance: auditRef, recipientEmail: email,
    notifyEmail: true, notifyPush: true, accountName: "Account autorevole"});
});

test("a new opaque instance notifies a reinvite, ordinary pending updates do not", () => {
  const first = invite();
  const reinvite = invite("account1", {auditRef: "22222222-2222-4222-8222-222222222222"});
  assert.equal(guard.isNotificationTransition(null, first), true);
  assert.equal(guard.isNotificationTransition(first, {...first, accountName: "Aggiornato"}), false);
  assert.equal(guard.isNotificationTransition({...first, status: "rejected"}, reinvite), true);
  assert.equal(guard.isNotificationTransition(first, reinvite), true);
  assert.equal(guard.isNotificationTransition(reinvite, {...reinvite, status: "accepted"}), false);
});

test("missing, archived, stale-cycle, mismatched recipient and forged invite IDs are ineligible", async () => {
  for (const [record, patch, id] of [
    [null, {}, `${invite().inviteId}`],
    [account({isArchived: true}), {}, `${invite().inviteId}`],
    [account({sharingCycle: 2}), {}, `${invite().inviteId}`],
    [account({sharedWith: {[key]: {email, status: "accepted", notifyEmail: true}}}), {}, `${invite().inviteId}`],
    [account(), {senderId: "other"}, `${invite().inviteId}`],
    [account(), {}, "account1_arbitrary"]
  ]) {
    const f = fixture(record ? {"users/owner/accounts/account1": record} : {});
    assert.equal(await guard.authoritativeInvite({db: f.db, auth: f.auth, invite: invite("account1", patch), inviteId: id}), null);
  }
});

test("delivery is idempotent per invite and channel and rechecks authority", async () => {
  const f = fixture({"users/owner/accounts/account1": account()});
  let sends = 0;
  const command = {db: f.db, auth: f.auth, invite: invite(), inviteId: invite().inviteId, channel: "email",
    now: () => Date.parse("2026-11-04T12:00:00Z"), send: async () => {sends++; return true;}};
  assert.equal((await guard.deliver(command)).status, "sent");
  assert.equal((await guard.deliver(command)).status, "duplicate");
  assert.equal(sends, 1);
});

test("same document id can notify exactly once for each reinvite instance", async () => {
  const f = fixture({"users/owner/accounts/account1": account()});
  let sends = 0;
  const send = async () => {sends++; return true;};
  const first = invite();
  const second = invite("account1", {auditRef: "22222222-2222-4222-8222-222222222222"});
  for (const item of [first, first, second, second]) {
    f.records.set(`invites/${item.inviteId}`, item);
    await guard.deliver({db: f.db, auth: f.auth, invite: item, inviteId: item.inviteId,
      channel: "email", now: () => 1000, send});
  }
  assert.equal(sends, 2);
});

test("recipient delivery is bounded per channel and hour without storing the address", async () => {
  const seed = {};
  for (let i = 0; i <= guard.RECIPIENT_LIMIT_PER_HOUR; i++) seed[`users/owner/accounts/a${i}`] = account();
  const f = fixture(seed);
  let sends = 0;
  for (let i = 0; i < guard.RECIPIENT_LIMIT_PER_HOUR; i++) {
    const item = invite(`a${i}`, {inviteId: `a${i}_${key}`});
    assert.equal((await guard.deliver({db: f.db, auth: f.auth, invite: item, inviteId: item.inviteId,
      channel: "push", now: () => 1000, send: async () => {sends++; return true;}})).status, "sent");
  }
  const blocked = invite(`a${guard.RECIPIENT_LIMIT_PER_HOUR}`,
    {inviteId: `a${guard.RECIPIENT_LIMIT_PER_HOUR}_${key}`});
  assert.equal((await guard.deliver({db: f.db, auth: f.auth, invite: blocked, inviteId: blocked.inviteId,
    channel: "push", now: () => 1000, send: async () => {sends++; return true;}})).status, "rate-limited");
  assert.equal(sends, guard.RECIPIENT_LIMIT_PER_HOUR);
  const technical = [...f.records].filter(([path]) => path.startsWith(guard.LEDGER_COLLECTION) ||
    path.startsWith(guard.RATE_COLLECTION));
  assert.equal(JSON.stringify(technical).includes(email), false);
});

function notificationInstance(index) {
  return `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
}

test("owner and global daily limits bound the shared provider quota", async () => {
  const ownerFixture = fixture();
  for (let i = 0; i < guard.OWNER_LIMIT_PER_DAY.email; i++) {
    assert.equal((await guard.claim({db: ownerFixture.db, inviteId: `owner-invite-${i}`,
      notificationInstance: notificationInstance(i), ownerId: "owner",
      recipientEmail: `guest${i}@example.invalid`, channel: "email", now: () => 1000})).status, "claimed");
  }
  assert.equal((await guard.claim({db: ownerFixture.db, inviteId: "owner-next-hour",
    notificationInstance: notificationInstance(999), ownerId: "owner",
    recipientEmail: "next@example.invalid", channel: "email", now: () => 3_601_000})).status, "rate-limited");

  const globalFixture = fixture();
  for (let i = 0; i < guard.GLOBAL_LIMIT_PER_DAY.email; i++) {
    assert.equal((await guard.claim({db: globalFixture.db, inviteId: `global-invite-${i}`,
      notificationInstance: notificationInstance(i), ownerId: `owner-${i}`,
      recipientEmail: `global${i}@example.invalid`, channel: "email", now: () => 1000})).status, "claimed");
  }
  assert.equal((await guard.claim({db: globalFixture.db, inviteId: "global-overflow",
    notificationInstance: notificationInstance(999), ownerId: "owner-overflow",
    recipientEmail: "overflow@example.invalid", channel: "email", now: () => 1000})).status, "rate-limited");
});

test("daily cleanup capacity covers the maximum rate-document production", () => {
  assert.ok(guard.CLEANUP_LIMIT_PER_COLLECTION >= guard.MAX_RATE_DOCUMENTS_PER_DAY);
  assert.ok(guard.CLEANUP_LIMIT_PER_COLLECTION >=
    guard.GLOBAL_LIMIT_PER_DAY.email + guard.GLOBAL_LIMIT_PER_DAY.push);
});

test('regression: active owner fence defers invitation external send and every rate/ledger write', async () => {
  const fence = require('../vault-recovery-fence');
  const ownerLock = fence.acquireVaultRecoveryFence(null,
    fence.createVaultRecoveryBinding({uid: 'owner', operationId: 'recover', planDigest: 'a'.repeat(64)})).record;
  const f = fixture({'users/owner/accounts/account1': account(), 'vaultRecoveryLocks/owner': ownerLock});
  let sends = 0;
  await assert.rejects(guard.deliver({db: f.db, auth: f.auth, invite: invite(), inviteId: invite().inviteId,
    channel: 'email', now: () => 1000, send: async () => {sends++; return true;}}), /RECOVERY_FENCE_ACTIVE/);
  assert.equal(sends, 0);
  assert.equal([...f.records.keys()].filter(path => path.startsWith(guard.LEDGER_COLLECTION) || path.startsWith(guard.RATE_COLLECTION)).length, 0);
});

const fence = require('../vault-recovery-fence');
function recoveryLock(uid, status = 'active') {
  const binding = fence.createVaultRecoveryBinding({uid, operationId: 'recover', planDigest: 'a'.repeat(64)});
  const active = fence.acquireVaultRecoveryFence(null, binding).record;
  return status === 'released' ? fence.releaseVaultRecoveryFence(active, binding).record : active;
}
const delivery = (f, send, extra = {}) => ({db: f.db, auth: f.auth, invite: invite(), inviteId: invite().inviteId,
  channel: 'email', now: () => 1000, send, ...extra});
const technicalRates = f => [...f.records].filter(([path]) => path.startsWith(guard.RATE_COLLECTION));

test('current Auth directory guest is fenced; forged invitation guest UID is ignored', async () => {
  for (const malformed of [false, true]) {
    const f = fixture({'users/owner/accounts/account1': account(), 'vaultRecoveryLocks/actual': malformed ?
      {...recoveryLock('actual', 'released'), digest: '0'.repeat(64)} : recoveryLock('actual')},
    {auth: {getUserByEmail: async () => ({uid: 'actual'})}});
    let sends = 0;
    await assert.rejects(guard.deliver(delivery(f, async () => {sends++;}, {invite: {...invite(), guestUid: 'forged'}})), /RECOVERY_FENCE_(ACTIVE|CORRUPT)/);
    assert.equal(sends, 0); assert.deepEqual(technicalRates(f), []);
    f.records.set('vaultRecoveryLocks/actual', recoveryLock('actual', 'released'));
    assert.equal((await guard.deliver(delivery(f, async () => {sends++;}))).status, 'sent');
    assert.equal(sends, 1);
  }
});

test('unknown email recipient still requires owner fence; released owner allows normal external invitation', async () => {
  const f = fixture({'users/owner/accounts/account1': account(), 'vaultRecoveryLocks/owner': recoveryLock('owner')},
    {auth: {getUserByEmail: async () => {throw Object.assign(Error('absent'), {code: 'auth/user-not-found'});}}});
  let sends = 0;
  await assert.rejects(guard.deliver(delivery(f, async () => {sends++;})), /RECOVERY_FENCE_ACTIVE/);
  f.records.set('vaultRecoveryLocks/owner', recoveryLock('owner', 'released'));
  assert.equal((await guard.deliver(delivery(f, async current => {assert.equal(current.recipientUid, null); sends++;}))).status, 'sent');
  assert.equal(sends, 1);
});

test('fence after rate claim defers known-unsent work; retry sends once and charges rates once', async () => {
  let injected = false;
  const f = fixture({'users/owner/accounts/account1': account()}, {get: ({path, records}) => {
    if (!injected && path.startsWith('invites/') && [...records.keys()].some(key => key.startsWith(guard.LEDGER_COLLECTION))) {
      injected = true; records.set('vaultRecoveryLocks/guest', recoveryLock('guest'));
    }
  }});
  let sends = 0;
  const command = delivery(f, async () => {sends++; return true;});
  await assert.rejects(guard.deliver(command), /RECOVERY_FENCE_ACTIVE/);
  assert.equal(sends, 0); assert.equal(technicalRates(f).length, 4);
  const rates = structuredClone(technicalRates(f));
  f.records.set('vaultRecoveryLocks/guest', recoveryLock('guest', 'released'));
  const results = await Promise.all([guard.deliver(command), guard.deliver(command)]);
  assert.deepEqual(results.map(result => result.status).sort(), ['duplicate', 'sent']);
  assert.equal(sends, 1); assert.deepEqual(technicalRates(f), rates);
});

test('already-submitted uncertain send never automatically resends after fence release', async () => {
  const f = fixture({'users/owner/accounts/account1': account()});
  let sends = 0;
  const command = delivery(f, async () => {sends++; f.records.set('vaultRecoveryLocks/owner', recoveryLock('owner')); return true;});
  await assert.rejects(guard.deliver(command), /RECOVERY_FENCE_ACTIVE/);
  assert.equal([...f.records].find(([path]) => path.startsWith(guard.LEDGER_COLLECTION))[1].state, 'sending');
  f.records.set('vaultRecoveryLocks/owner', recoveryLock('owner', 'released'));
  assert.equal((await guard.deliver(command)).status, 'duplicate'); assert.equal(sends, 1);
});

test('rechecked live invitation instance prevents sending stale trigger content', async () => {
  const f = fixture({'users/owner/accounts/account1': account()}, {get: ({path, records}) => {
    if (path.startsWith('invites/') && [...records.keys()].some(key => key.startsWith(guard.LEDGER_COLLECTION))) {
      records.set(path, {...records.get(path), auditRef: '22222222-2222-4222-8222-222222222222'});
    }
  }});
  let sends = 0;
  assert.equal((await guard.deliver(delivery(f, async () => {sends++;}))).status, 'cancelled');
  assert.equal(sends, 0);
});


test("v2 private/company identity agrees with browser and rejects other owner/company scope", async () => {
  const {readFile} = require("node:fs/promises");
  const source = await readFile(require.resolve("../../Frontend/public/assets/js/utils.js"), "utf8");
  const {inviteIdForGuest, inviteScopeForAccount} = await import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));
  for (const company of ["", "company-a", "company-b"]) {
    const id = inviteIdForGuest(await inviteScopeForAccount("owner", company, "same"), key, 0);
    const data = invite("same", {inviteId: id, ...(company ? {aziendaId: company} : {})});
    const resource = company ? `users/owner/aziende/${company}/accounts/same` : "users/owner/accounts/same";
    const f = fixture({[resource]: account(), [`invites/${id}`]: data});
    assert.ok(await guard.authoritativeInvite({db: f.db, auth: f.auth, invite: data, inviteId: id}));
    for (const [owner, otherCompany] of [["other", company], ["owner", company === "company-a" ? "company-b" : "company-a"]]) {
      const forgedId = inviteIdForGuest(await inviteScopeForAccount(owner, otherCompany, "same"), key, 0);
      const forged = {...data, inviteId: forgedId};
      f.records.set(`invites/${forgedId}`, forged);
      assert.equal(await guard.authoritativeInvite({db: f.db, auth: f.auth, invite: forged, inviteId: forgedId}), null);
    }
  }
});
