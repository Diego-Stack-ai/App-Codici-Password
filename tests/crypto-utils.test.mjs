import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(
  new URL('../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url),
  'utf8',
);
const {
  createVaultVerifier,
  verifyVaultVerifier,
  VERIFIER_ITERATIONS,
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

const MARKER = 'APP_CODICI_PASSWORD_VAULT_VERIFIER_V1';

test('il verifier v2 usa il KDF rinforzato e verifica la Master Password corretta', async () => {
  const verifier = await createVaultVerifier(MARKER, 'MasterPassword!123456');

  assert.equal(verifier.version, 2);
  assert.equal(verifier.iterations, VERIFIER_ITERATIONS);
  assert.equal(verifier.kdf, 'PBKDF2-SHA256');
  assert.equal(verifier.cipher, 'AES-GCM-256');
  assert.equal(await verifyVaultVerifier(verifier, MARKER, 'MasterPassword!123456'), true);
});

test('il verifier v2 respinge password errata, manomissione e costo KDF ridotto', async () => {
  const verifier = await createVaultVerifier(MARKER, 'MasterPassword!123456');
  assert.equal(await verifyVaultVerifier(verifier, MARKER, 'PasswordErrata!123456'), false);

  const tampered = {...verifier, ciphertext: `${verifier.ciphertext.slice(0, -2)}AA`};
  assert.equal(await verifyVaultVerifier(tampered, MARKER, 'MasterPassword!123456'), false);
  assert.equal(await verifyVaultVerifier({...verifier, iterations: 100000}, MARKER, 'MasterPassword!123456'), false);
});
