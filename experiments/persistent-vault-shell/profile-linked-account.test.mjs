import test from 'node:test';
import assert from 'node:assert/strict';
import {profileAccountLink, createProfileLinkedAccountReader} from './profile-linked-account.mjs';
function fixture(company = false, online = true) {
    let uid = 'owner', locked = false;
    const controller = new AbortController(), calls = [];
    const item = {id: 'email', linkedAccountId: 'account', ...(company ? {linkedAccountCompanyId: 'company'} : {})};
    const profile = {contactEmails: [item]}, account = {password: 'encrypted-fixture', ownerId: uid};
    const repository = {};
    for (const name of ['getUserProfile', 'getPrivateAccount', 'getCompanyAccount']) for (const suffix of ['', 'Confirmed']) {
        repository[name + suffix] = async (...args) => { calls.push([name + suffix, ...args]); return name === 'getUserProfile' ? profile : account; };
    }
    const context = {user: {uid}, signal: controller.signal, assertUnlocked() { if (locked) throw new Error('VAULT_LOCKED'); }, read: async value => { assert.equal(value.ownerId, 'owner'); assert.equal(value.ciphertext, 'encrypted-fixture'); return 'synthetic-password'; }};
    const reader = createProfileLinkedAccountReader({context, getUser: () => ({uid}), repository, isOnline: () => online});
    return {reader, context, repository, calls, profile, account, item, controller, link: profileAccountLink(item, 'contactEmails', uid), change() { uid = 'other'; }, lock() { locked = true; }};
}
for (const company of [false, true]) for (const online of [false, true]) test(`${company ? 'company' : 'private'} linked password and destination use ${online ? 'confirmed' : 'offline'} owner-bound reads`, async () => {
    const f = fixture(company, online);
    assert.equal(await f.reader.readPassword(f.link), 'synthetic-password');
    assert.deepEqual(await f.reader.open(f.link), f.link.selection);
    assert.ok(f.calls.every(call => call[0].endsWith('Confirmed') === online && call[1] === 'owner'));
    if (company) assert.ok(f.calls.some(call => call[0].startsWith('getCompanyAccount') && call[2] === 'company' && call[3] === 'account'));
});
test('email and phone may point to the same Account without excluding either link', async () => {
    const f = fixture(); f.profile.contactPhones = [{id: 'phone', linkedAccountId: 'account'}];
    assert.equal(await f.reader.readPassword(f.link), 'synthetic-password');
    assert.equal(await f.reader.readPassword(profileAccountLink(f.profile.contactPhones[0], 'contactPhones', 'owner')), 'synthetic-password');
});
test('forged destination, removed link and ambiguous source IDs are rejected before Account reads', async () => {
    for (const mutation of [f => { f.link = {...f.link, selection: {...f.link.selection, id: 'forged'}}; }, f => { delete f.item.linkedAccountId; }, f => { f.profile.contactEmails.push({...f.item}); }]) {
        const f = fixture(); mutation(f); await assert.rejects(f.reader.readPassword(f.link), /PROFILE_LINK/);
        assert.ok(f.calls.every(call => call[0].startsWith('getUserProfile')));
    }
});
test('archived or wrong-owner Account and online failures do not fall back to cached or profile passwords', async () => {
    for (const invalid of [{isArchived: true}, {ownerId: 'other'}]) {
        const f = fixture(); Object.assign(f.account, invalid); f.item.password = 'legacy-secret';
        await assert.rejects(f.reader.readPassword(f.link), /ACCOUNT_UNAVAILABLE/);
    }
    const f = fixture(); f.repository.getPrivateAccountConfirmed = async () => { throw new Error('unavailable'); };
    await assert.rejects(f.reader.readPassword(f.link), /unavailable/);
    assert.ok(!f.calls.some(call => call[0] === 'getPrivateAccount'));
});
for (const boundary of ['change', 'lock', 'abort', 'relink']) test(`pending linked password cannot escape ${boundary}`, async () => {
    const f = fixture(); let release;
    f.context.read = () => new Promise(resolve => { release = resolve; });
    const pending = f.reader.readPassword(f.link);
    const denied = assert.rejects(pending, /AUTH_CHANGED|VAULT_LOCKED|VIEW_DISPOSED|PROFILE_LINK_CHANGED/);
    while (!release) await new Promise(resolve => setImmediate(resolve));
    if (boundary === 'abort') f.controller.abort(); else if (boundary === 'relink') f.item.linkedAccountId = 'new-account'; else f[boundary]();
    release('late-secret'); await denied;
});
test('malformed paths and unsupported profile sources cannot create a link capability', () => {
    for (const id of ['../other', 'other/user', '%2f', 7]) assert.throws(() => profileAccountLink({id: 'contact', linkedAccountId: id}, 'contactEmails', 'owner'));
    assert.throws(() => profileAccountLink({id: 'contact', linkedAccountId: 'account'}, 'settings', 'owner'));
});
