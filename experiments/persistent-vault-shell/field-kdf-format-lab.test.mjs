import test from 'node:test';
import assert from 'node:assert/strict';
import {decryptFieldCompatibleLab, encryptFieldV2Lab, planFieldMigrationLab} from './field-kdf-format-lab.mjs';

async function legacy(plaintext, password) {
  const salt = new Uint8Array(16).fill(11), iv = new Uint8Array(12).fill(12), bytes = new TextEncoder().encode(password);
  const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000}, material,
    {name: 'AES-GCM', length: 256}, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode(plaintext)));
  return Buffer.concat([salt, iv, ciphertext]).toString('base64');
}

test('versioned v2 fields round-trip and declare the strengthened KDF', async () => {
  const value = await encryptFieldV2Lab('synthetic secret', 'Synthetic-password');
  assert.match(value, /^CPFE2\./);
  assert.deepEqual(await decryptFieldCompatibleLab(value, 'Synthetic-password'),
    {plaintext: 'synthetic secret', format: 'v2', needsMigration: false});
});

test('legacy fields remain readable and migration is explicit CAS input', async () => {
  const value = await legacy('legacy synthetic', 'Synthetic-password');
  assert.deepEqual(await decryptFieldCompatibleLab(value, 'Synthetic-password'),
    {plaintext: 'legacy synthetic', format: 'legacy-v1', needsMigration: true});
  const plan = await planFieldMigrationLab(value, 'Synthetic-password');
  assert.equal(plan.status, 'replace-after-cas');
  assert.equal((await decryptFieldCompatibleLab(plan.replacement, 'Synthetic-password')).plaintext, 'legacy synthetic');
  assert.equal((await planFieldMigrationLab(plan.replacement, 'Synthetic-password')).status, 'current');
});

test('wrong passwords and downgraded v2 declarations fail closed', async () => {
  const value = await encryptFieldV2Lab('synthetic secret', 'Synthetic-password');
  await assert.rejects(decryptFieldCompatibleLab(value, 'Wrong-password'));
  const raw = JSON.parse(Buffer.from(value.slice(6), 'base64').toString('utf8'));
  raw.iterations = 100000;
  const downgraded = `CPFE2.${Buffer.from(JSON.stringify(raw)).toString('base64')}`;
  await assert.rejects(decryptFieldCompatibleLab(downgraded, 'Synthetic-password'), /FIELD_ENVELOPE_INVALID/);
});
