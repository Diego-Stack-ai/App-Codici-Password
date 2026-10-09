import test from 'node:test';
import assert from 'node:assert/strict';
import {createFieldKdfRolloutLab, isFieldKdfV2WriteEnabled} from './field-kdf-rollout-lab.mjs';
import {encryptFieldV2Lab} from './field-kdf-format-lab.mjs';

test('write rollout is hard-off and ignores ambient or caller flags', async () => {
  const before = process.env.FIELD_KDF_V2_WRITE;
  process.env.FIELD_KDF_V2_WRITE = 'true';
  try {
    const calls = [], adapter = createFieldKdfRolloutLab({legacyEncrypt: async (text, password) => {
      calls.push({text, password}); return 'synthetic-legacy'; }});
    assert.equal(isFieldKdfV2WriteEnabled(), false);
    assert.equal(await adapter.encrypt('secret', 'password', {fieldKdfV2: true}), 'synthetic-legacy');
    assert.deepEqual(calls, [{text: 'secret', password: 'password'}]);
  } finally {
    if (before === undefined) delete process.env.FIELD_KDF_V2_WRITE; else process.env.FIELD_KDF_V2_WRITE = before;
  }
});

test('hard-off writer still dual-reads explicit v2 without rewriting it', async () => {
  const v2 = await encryptFieldV2Lab('synthetic', 'password');
  const adapter = createFieldKdfRolloutLab({legacyEncrypt: async () => 'legacy'});
  assert.deepEqual(await adapter.decrypt(v2, 'password'), {plaintext: 'synthetic', format: 'v2', needsMigration: false});
});
