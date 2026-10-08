import test from 'node:test';
import assert from 'node:assert/strict';
import {attachmentReadRoute, readAttachmentRoute} from './attachment-read-route.mjs';
const id = 'a'.repeat(64), path = `users/u1/restoreObjects/${id}`;

test('published namespace resolves stage identity, legacy retains exact path', () => {
  assert.deepEqual(attachmentReadRoute('u1', path), {kind: 'published', stageId: id});
  assert.deepEqual(attachmentReadRoute('u1', 'users/u1/attachments/a'),
    {kind: 'legacy', storagePath: 'users/u1/attachments/a'});
});
test('invalid owner/path and malformed reserved namespace never dispatch', async () => {
  let calls = 0;
  const transports = {readPublished: () => calls++, readLegacy: () => calls++};
  for (const bad of ['users/u2/attachments/a', 'users/u1/restoreObjects',
    'users/u1/restoreObjects/not-stage', `${path}/extra`, 'users/u1//a',
    'users/u1/../a', 'users/u1/%72estoreObjects/a', 'users/u1/attachments\\a']) {
    await assert.rejects(readAttachmentRoute('u1', bad, transports), /ROUTE_INVALID/);
  }
  assert.equal(calls, 0);
});
test('published failure cannot fall back to legacy/latest', async () => {
  let legacy = 0;
  const error = new Error('stage unavailable');
  await assert.rejects(readAttachmentRoute('u1', path, {
    readPublished: async stageId => {assert.equal(stageId, id); throw error;},
    readLegacy: async () => {legacy++;}
  }), candidate => candidate === error);
  assert.equal(legacy, 0);
});
test('legacy and published transports remain distinct', async () => {
  const calls = [];
  const transports = {readPublished: async value => {calls.push(['published', value]); return 1;},
    readLegacy: async value => {calls.push(['legacy', value]); return 2;}};
  assert.equal(await readAttachmentRoute('u1', path, transports), 1);
  assert.equal(await readAttachmentRoute('u1', 'users/u1/attachments/a', transports), 2);
  assert.deepEqual(calls, [['published', id], ['legacy', 'users/u1/attachments/a']]);
});
