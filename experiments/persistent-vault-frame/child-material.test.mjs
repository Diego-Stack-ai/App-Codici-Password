import test from 'node:test';
import assert from 'node:assert/strict';
import {createChildMaterial} from './child-material.mjs';

test('child clear invalidates pending and already-resolving material without affecting a newer session', async () => {
  const child = createChildMaterial(); let resolve;
  const old = child.acquire(() => new Promise(done => {resolve = done;}));
  child.clear(); assert.equal(child.isOpen(), false);
  assert.equal(await child.acquire(async () => 'new-synthetic'), true);
  resolve('old-synthetic'); assert.equal(await old, false); assert.equal(child.isOpen(), true);
  child.clear();
  const resolving = child.acquire(async () => {queueMicrotask(() => child.clear()); return 'resolved-synthetic';});
  assert.equal(await resolving, false); assert.equal(child.isOpen(), false);
});
