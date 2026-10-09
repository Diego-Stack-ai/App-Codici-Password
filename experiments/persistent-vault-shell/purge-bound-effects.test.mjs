import test from 'node:test';
import assert from 'node:assert/strict';
import {planBoundPurgeEffects} from './purge-bound-effects.mjs';

const version = n => ({seconds: n, nanoseconds: n});
const plan = {valid: true, planHash: 'a'.repeat(64), target: {accountPath: 'users/u/accounts/a'},
  scope: {ownerUid: 'u', context: 'private', accountId: 'a', companyId: null},
  expectedDocuments: [
    {path: 'users/u/accounts/a', updateTime: version(1)},
    {path: 'users/u/accountWidgets/w', updateTime: version(2)},
    {path: 'users/u/sharedVaultData/s', updateTime: version(3)},
    {path: 'users/u', updateTime: version(4)},
    {path: 'users/u/accounts/a/attachments/x', updateTime: version(5)}],
  deletePaths: ['users/u/accountWidgets/w'],
  revisionTouches: [{path: 'users/u/sharedVaultData/s', expectedRevision: 7, nextRevision: 8}],
  profileReferencePaths: ['users/u'],
  attachmentMetadata: [{path: 'users/u/accounts/a/attachments/x', storagePath: 'users/u/accounts/a/attachments/x.bin'}]};
const storage = {planHash: plan.planHash, storageHash: 'b'.repeat(64),
  objects: [{storagePath: 'users/u/accounts/a/attachments/x.bin', generation: '9007199254740993'}]};

test('bound effects classify every version once and delete account last', () => {
  const result = planBoundPurgeEffects(plan, storage);
  assert.deepEqual(result.effects.map(item => item.kind), [
    'revision-touch', 'profile-cleanup', 'document-delete', 'object-delete', 'document-delete', 'document-delete']);
  assert.equal(result.effects.at(-1).path, plan.target.accountPath);
  assert.equal(result.effects[3].generation, '9007199254740993');
  assert.deepEqual(result.effects[1].command, {context: 'private', accountId: 'a', companyId: null});
  assert.equal(result.destructiveAllowed, false);
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.effects));
});

test('unclassified, duplicate or mismatched targets fail closed', () => {
  assert.throws(() => planBoundPurgeEffects({...plan, expectedDocuments: [...plan.expectedDocuments,
    {path: 'users/u/unknown/x', updateTime: version(6)}]}, storage), /BOUND_EFFECTS_INVALID/);
  assert.throws(() => planBoundPurgeEffects({...plan, deletePaths: [...plan.deletePaths, plan.deletePaths[0]]}, storage),
    /BOUND_EFFECTS_INVALID/);
  assert.throws(() => planBoundPurgeEffects(plan, {...storage, objects: []}), /BOUND_EFFECTS_INVALID/);
  assert.throws(() => planBoundPurgeEffects(plan, {...storage, objects: [{...storage.objects[0], generation: 9}]}),
    /BOUND_EFFECTS_INVALID/);
});
