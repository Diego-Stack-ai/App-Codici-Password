import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {deleteDoc, doc, getDoc, setDoc, updateDoc} from 'firebase/firestore';

// COLLAUDO-07: real Rules, synthetic documents, explicit loopback only.
assert.match(process.env.FIRESTORE_EMULATOR_HOST || '', /^(127\.0\.0\.1|localhost):\d+$/);
let env;
const path = (collection, id = 'one') => `users/owner/${collection}/${id}`;
const ref = (collection, uid = 'owner', id = 'one') =>
  doc((uid ? env.authenticatedContext(uid) : env.unauthenticatedContext()).firestore(), path(collection, id));
const seed = (collection, data, id = 'one') => env.withSecurityRulesDisabled(async context => {
  await setDoc(doc(context.firestore(), path(collection, id)), data);
});
before(async () => {
  env = await initializeTestEnvironment({projectId: 'demo-notification-rules',
    firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')}});
});
beforeEach(async () => env.clearFirestore());
after(async () => env?.cleanup());

test('notification deliveries: owner reads, nobody can create/update/delete from client', async () => {
  await seed('notificationDeliveries', {status: 'sent'});
  await assertSucceeds(getDoc(ref('notificationDeliveries')));
  for (const uid of ['owner', 'other', null]) {
    if (uid !== 'owner') await assertFails(getDoc(ref('notificationDeliveries', uid)));
    await assertFails(setDoc(ref('notificationDeliveries', uid, 'new'), {status: 'sent'}));
    await assertFails(updateDoc(ref('notificationDeliveries', uid), {status: 'failed'}));
    await assertFails(deleteDoc(ref('notificationDeliveries', uid)));
  }
});

test('deadline notifications: only owner can mark unread viewed, source fields remain immutable', async () => {
  await seed('deadlineNotifications', {status: 'unread', deadlineId: 'source', diffDays: 7});
  await assertSucceeds(getDoc(ref('deadlineNotifications')));
  for (const uid of ['other', null]) {
    await assertFails(getDoc(ref('deadlineNotifications', uid)));
    await assertFails(updateDoc(ref('deadlineNotifications', uid), {status: 'viewed'}));
  }
  await assertFails(updateDoc(ref('deadlineNotifications'), {status: 'viewed', deadlineId: 'changed'}));
  await assertFails(updateDoc(ref('deadlineNotifications'), {status: 'viewed', diffDays: 0}));
  await assertFails(setDoc(ref('deadlineNotifications', 'owner', 'new'), {status: 'unread'}));
  await assertFails(deleteDoc(ref('deadlineNotifications')));
  await assertSucceeds(updateDoc(ref('deadlineNotifications'), {status: 'viewed', readAt: 'synthetic'}));
  await assertFails(updateDoc(ref('deadlineNotifications'), {status: 'unread'}));
  await assertFails(updateDoc(ref('deadlineNotifications'), {readAt: 'changed'}));
  assert.equal((await getDoc(ref('deadlineNotifications'))).data().deadlineId, 'source');
});

const deviceId = '11111111-1111-4111-8111-111111111111';
const device = {token: 'synthetic-token-never-sent-123456', platform: 'windows', browser: 'test',
  enabled: true, notificationScope: 'deadlines', notificationScopes: ['deadlines', 'sharing'],
  privacyMode: 'discreet', schemaVersion: 1};
test('push device: valid owner lifecycle, foreign and unauthenticated access denied', async () => {
  await assertSucceeds(setDoc(ref('pushDevices', 'owner', deviceId), device));
  await assertSucceeds(getDoc(ref('pushDevices', 'owner', deviceId)));
  for (const uid of ['other', null]) {
    await assertFails(getDoc(ref('pushDevices', uid, deviceId)));
    await assertFails(setDoc(ref('pushDevices', uid, deviceId), device));
    await assertFails(updateDoc(ref('pushDevices', uid, deviceId), {enabled: false}));
    await assertFails(deleteDoc(ref('pushDevices', uid, deviceId)));
  }
  await assertSucceeds(updateDoc(ref('pushDevices', 'owner', deviceId), {enabled: false}));
  await assertSucceeds(deleteDoc(ref('pushDevices', 'owner', deviceId)));
});

test('push device: invalid ID, fields, scopes and token rejected at creation and update', async () => {
  await assertFails(setDoc(ref('pushDevices'), device));
  const invalid = [{token: 'short'}, {token: 'x'.repeat(4096)}, {platform: 'unknown'},
    {enabled: 'true'}, {notificationScope: 'sharing'}, {notificationScopes: ['admin']},
    {privacyMode: 'unknown'}, {schemaVersion: 2}, {serverOnly: true}];
  for (const patch of invalid) {
    await assertFails(setDoc(ref('pushDevices', 'owner', deviceId), {...device, ...patch}));
  }
  await assertSucceeds(setDoc(ref('pushDevices', 'owner', deviceId), device));
  for (const patch of invalid) {
    await assertFails(updateDoc(ref('pushDevices', 'owner', deviceId), patch));
  }
});
