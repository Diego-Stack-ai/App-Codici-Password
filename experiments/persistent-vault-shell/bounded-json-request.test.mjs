import test from 'node:test';
import assert from 'node:assert/strict';
import {readBoundedJsonRequest} from './bounded-json-request.mjs';
test('UTF-8 split at every byte boundary survives without replacement characters', async () => {
  const value = {label: 'Città 🗝️ 日本', data: 'synthetic'}, bytes = Buffer.from(JSON.stringify(value));
  for (let split = 1; split < bytes.length; split++)
    assert.deepEqual(await readBoundedJsonRequest([bytes.subarray(0, split), bytes.subarray(split)], bytes.length), value);
  assert.deepEqual(await readBoundedJsonRequest(Array.from(bytes, byte => Buffer.from([byte])), bytes.length), value);
});
test('body limit counts bytes, rejects malformed UTF-8 and does not clear caller owned input', async () => {
  const bytes = Buffer.from('{"x":"é"}'), original = Buffer.from(bytes);
  await assert.rejects(readBoundedJsonRequest([bytes], bytes.length - 1), /BODY_LIMIT/);
  await assert.rejects(readBoundedJsonRequest([Buffer.from([0x22, 0xc3, 0x22])], 10));
  await assert.rejects(readBoundedJsonRequest([Buffer.from('{')], 10));
  await assert.rejects(readBoundedJsonRequest(['not bytes'], 10), /INVALID_BODY/);
  assert.deepEqual(bytes, original);
});
