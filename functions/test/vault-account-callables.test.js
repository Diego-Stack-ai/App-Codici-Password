const test = require('node:test');
const assert = require('node:assert/strict');
const {createVaultAccountCallables} = require('../vault-account-runtime');
const {HttpsError} = require('firebase-functions/v2/https');
const {readFileSync} = require('node:fs');
const {resolve} = require('node:path');

const trusted = {auth: {uid: 'owner'}, app: {appId: 'test-context-only'}};
function boundary(db = {doc() {throw Error('SECRET_DATABASE_ERROR');}}) {
  return createVaultAccountCallables({db, hash: async () => 'a'.repeat(64), timestamp: () => 1, HttpsError});
}
const request = {account: {domain: 'private', id: 'a'}, note: '', expectedFingerprint: 'a'.repeat(64),
  expectedRevision: 0, operationId: 'operation', expectedOwnerUid: 'owner'};

test('all exported adapters require middleware identity and attestation, never client claims', async () => {
  for (const run of Object.values(boundary())) {
    await assert.rejects(run({data: {...request, ...trusted}}), error => error.code === 'unauthenticated');
    await assert.rejects(run({auth: trusted.auth, data: {...request, app: trusted.app}}),
      error => error.details.reason === 'APP_CHECK_REQUIRED');
  }
});

test('owner mismatch is sanitized before any database access', async () => {
  await assert.rejects(boundary().note({...trusted, data: {...request, expectedOwnerUid: 'other'}}),
    error => error.details.reason === 'OWNER_MISMATCH');
});

test('unexpected database errors expose neither paths nor payloads', async () => {
  await assert.rejects(boundary().note({...trusted, data: request}), error =>
    error.code === 'internal' && !JSON.stringify(error).includes('SECRET_DATABASE_ERROR'));
});

test('client extra fields cannot supply a replacement trusted context', async () => {
  await assert.rejects(boundary().note({...trusted, data: {...request, trusted}}),
    error => error.details.reason === 'ACCOUNT_NOTE_INVALID');
});

test('real exports enforce App Check and bundle excludes the synthetic emulator bridge', () => {
  const root = resolve(require.resolve('../index.js'), '..');
  const source = readFileSync(resolve(root, 'index.js'), 'utf8');
  for (const name of ['applyPrivateAddressesMutation', 'applyCompanyAddressesMutation', 'applyCompanyContactsMutation']) {
    assert.match(source, new RegExp(`exports\\.${name} = onCall\\(\\s*\\{[^}]*enforceAppCheck: true`));
  }
  assert.match(source, /exports\.applyProfileContactsMutation = onCall\(\s*\{[^}]*enforceAppCheck: true/);
  for (const name of ['applyAccountNoteMutation', 'applyAccountStandardMutation', 'applyProfileLinkMutation', 'applyProfileAccountCreate', 'applyProfileTextMutation', 'applyPrivateQrSelection', 'applyCompanyQrSelection', 'applyPrivateDocumentsMutation', 'applyPrivateUtilitiesMutation']) {
    assert.match(source, new RegExp(`exports\\.${name} = onCall\\(\\s*\\{[^}]*enforceAppCheck: true`));
  }
  const bundle = readFileSync(resolve(root, 'vault-account-runtime.js'), 'utf8');
  for (const forbidden of ['synthetic-app-check', 'createEmulatorQrBridge', '127.0.0.1:4188', 'readFile(']) {
    assert.equal(bundle.includes(forbidden), false);
  }
});
