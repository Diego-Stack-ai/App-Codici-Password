const test = require('node:test');
const assert = require('node:assert/strict');
const {preserveRestoreAuthority} = require('../backup-restore-authority');
const {buildRestorePreview} = require('../backup-restore-preview');

const stale = {password: 'synthetic-cipher', visibility: 'shared', sharingCycle: 7,
  acceptedCount: 1, sharedWithUids: ['old-guest'], sharedWith: {old: {email: 'old@example.invalid', status: 'accepted', uid: 'old-guest'}}};

test('deadline restore keeps current recipients and notification settings, not backup authority', () => {
  const backup = {title:'Synthetic', recipients:[{email:'old@example.invalid',canManage:true}],
    emails:['old@example.invalid'],email1:'old@example.invalid',email2:'second@example.invalid',notif_frequency:2};
  const live = {recipients:[{email:'current@example.invalid',canManage:false}],email1:'',notif_frequency:14};
  const restored = preserveRestoreAuthority('users/owner/scadenze/d',backup,live);
  assert.deepEqual(restored,{title:'Synthetic',...live});
  const privateCopy = preserveRestoreAuthority('users/owner/scadenze/d',backup);
  assert.deepEqual(privateCopy,{title:'Synthetic',recipients:[],emails:[],email1:'',email2:''});
  assert.deepEqual(preserveRestoreAuthority('users/owner/scadenze/d',backup,{}),{title:'Synthetic'});
  assert.equal(backup.recipients[0].canManage,true);
});

test('profile restore preserves live biometric preference and cannot recreate it from backup', () => {
  const backup = {name: 'Synthetic', settings_biometric: true};
  assert.deepEqual(preserveRestoreAuthority('users/owner', backup), {name: 'Synthetic'});
  for (const value of [true, false]) {
    const current = {name: 'Before', settings_biometric: value};
    assert.deepEqual(preserveRestoreAuthority('users/owner', backup, current),
      {name: 'Synthetic', settings_biometric: value});
    const preview = buildRestorePreview([{path: 'users/owner', data: backup}],
      [{exists: true, data: () => ({...backup, settings_biometric: value}), updateTime: {seconds: 1, nanoseconds: 0}}]);
    assert.equal(preview.entries[0].status, 'unchanged');
  }
  assert.equal(backup.settings_biometric, true);
});
for (const path of ['users/owner/accounts/a', 'users/owner/aziende/c/accounts/a']) {
  test(`missing account restore removes old access: ${path}`, () => {
    const original = structuredClone(stale);
    const result = preserveRestoreAuthority(path, stale);
    assert.equal(result.password, stale.password);
    assert.equal(result.visibility, 'private');
    assert.deepEqual(result.sharedWith, {});
    assert.deepEqual(result.sharedWithUids, []);
    assert.equal(result.acceptedCount, 0);
    assert.deepEqual(stale, original);
  });
  test(`existing account keeps live authority instead of backup grants: ${path}`, () => {
    const live = {visibility: 'shared', sharingCycle: 12, sharedWith: {new: {status: 'accepted', uid: 'new-guest'}},
      sharedWithUids: ['new-guest'], acceptedCount: 1};
    const result = preserveRestoreAuthority(path, stale, live);
    assert.deepEqual(result, {...stale, ...live});
    const noGrant = preserveRestoreAuthority(path, stale, {password: 'newer-cipher'});
    assert.deepEqual(noGrant, {password: 'synthetic-cipher'});
  });
  test(`preview compares content under current authority without granting old access: ${path}`, () => {
    const current = preserveRestoreAuthority(path, stale);
    const preview = buildRestorePreview([{path, data: stale}], [{exists: true, data: () => current,
      updateTime: {seconds: 1, nanoseconds: 0}}]);
    assert.equal(preview.entries[0].status, 'unchanged');
  });
}
test('authority projection is restricted to exact Account documents', () => {
  for (const path of ['users/owner/accounts/a/attachments/f', 'users/owner/aziende/c', 'users/owner/settings/s']) {
    assert.equal(preserveRestoreAuthority(path, stale), stale);
  }
});

test('restoring an archived legacy account cannot revive its dormant recipients', () => {
  const archived = {...stale, isArchived: true};
  const restored = preserveRestoreAuthority('users/owner/accounts/a', {...stale, isArchived: false}, archived);
  assert.equal(restored.isArchived, false);
  assert.equal(restored.visibility, 'private');
  assert.deepEqual(restored.sharedWith, {});
  assert.deepEqual(restored.sharedWithUids, []);
  const withoutBackupGrants = preserveRestoreAuthority('users/owner/accounts/a', {password: 'cipher'}, archived);
  assert.deepEqual(withoutBackupGrants.sharedWithUids, []);
});
