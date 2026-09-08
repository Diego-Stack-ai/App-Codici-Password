import assert from 'node:assert/strict';
import test from 'node:test';
import {appendHistory, createAuditEvent, mayPurge, moveToTrash, restoreFromTrash} from './history-model.mjs';

test('il cestino conserva una copia e applica 30 giorni di retention', () => {
  const record = {id: 'r1', revision: 4, title: 'Fixture'}; const at = 1800000000000;
  const entry = moveToTrash(record, {deletedAt: at, actorUid: 'owner'}); record.title = 'mutato';
  assert.equal(entry.snapshot.title, 'Fixture'); assert.equal(mayPurge(entry, at + 29 * 86400000), false); assert.equal(mayPurge(entry, at + 30 * 86400000), true);
});

test('ripristino incrementa revisione e blocca scadenza o collisione', () => {
  const entry = moveToTrash({id: 'r1', revision: 2}, {deletedAt: 1000, actorUid: 'owner'});
  assert.equal(restoreFromTrash(entry, {now: 2000}).revision, 3);
  assert.throws(() => restoreFromTrash(entry, {now: 2000, destinationExists: true}), /CONFLICT/);
  assert.throws(() => restoreFromTrash(entry, {now: entry.purgeAfter}), /EXPIRED/);
});

test('audit elimina segreti e limita cronologia', () => {
  const event = createAuditEvent({action: 'updated', actorUid: 'owner', recordId: 'r1', at: 105, metadata: {field: 'title', password: 'vietata', token: 'vietato', nested: {secret: true}}});
  assert.deepEqual(event.metadata, {field: 'title'}); assert.equal(JSON.stringify(event).includes('vietata'), false);
  const history = appendHistory(Array.from({length: 100}, (_, at) => ({at})), event, 100);
  assert.equal(history.length, 100); assert.equal(history.at(-1).at, 105);
});
