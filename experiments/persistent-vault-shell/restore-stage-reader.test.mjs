import test from 'node:test';
import assert from 'node:assert/strict';
import {createRestoreStageReader} from './restore-stage-reader.mjs';
const id = 'a'.repeat(64);
const output = () => ({bytes: new Uint8Array([1, 2]), size: 2, generation: '90071992547409931234', sha256: 'b'.repeat(64)});

test('only stage identity reaches server transport and exact generation survives', async () => {
  const value = output(), calls = [];
  const reader = createRestoreStageReader({isActive: () => true, readPublished: async command => {calls.push(command); return value;}});
  const result = await reader.read(id);
  assert.deepEqual(calls, [{stageId: id}]); assert.equal(result.generation, value.generation);
  assert.deepEqual(result.bytes, new Uint8Array([1, 2])); result.bytes.fill(0);
});
test('revocation during transport clears returned bytes and rejects delivery', async () => {
  let active = true, resolve;
  const reader = createRestoreStageReader({isActive: () => active, readPublished: () => new Promise(r => {resolve = r;})});
  const pending = reader.read(id), value = output(); active = false; resolve(value);
  await assert.rejects(pending, /INACTIVE/); assert.deepEqual(value.bytes, new Uint8Array(2));
});
test('dispose during callback cannot deliver bytes or reopen the reader', async () => {
  let reader; const value = output();
  reader = createRestoreStageReader({isActive: () => true, readPublished: async () => {reader.dispose(); return value;}});
  await assert.rejects(reader.read(id), /INACTIVE/); assert.deepEqual(value.bytes, new Uint8Array(2));
  await assert.rejects(reader.read(id), /INACTIVE/);
});
test('invalid IDs never reach transport; malformed result is cleared without fallback', async () => {
  let calls = 0; const value = {...output(), generation: 42};
  const reader = createRestoreStageReader({isActive: () => true, readPublished: async () => {calls++; return value;}});
  await assert.rejects(reader.read({storagePath: 'users/u/restoreObjects/x'}), /READER_ID/); assert.equal(calls, 0);
  await assert.rejects(reader.read(id), /READER_RESULT/); assert.equal(calls, 1);
  assert.deepEqual(value.bytes, new Uint8Array(2));
});
