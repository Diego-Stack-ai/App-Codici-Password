import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/core/sharing-identity.js', import.meta.url), 'utf8');
const api = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('la chiave privata resta cifrata e si riapre soltanto con UID e Vault Key corretti', async () => {
  const identity = await api.createSharingIdentity({uid: 'user-1', vaultKeyMaterial: 'fixture-vault-key'});
  assert.equal(JSON.stringify(identity).includes('"d"'), false);
  const opened = await api.openSharingIdentity({...identity, uid: 'user-1', vaultKeyMaterial: 'fixture-vault-key'});
  assert.equal(opened.keyId, identity.publicIdentity.keyId);
  await assert.rejects(api.openSharingIdentity({...identity, uid: 'user-2', vaultKeyMaterial: 'fixture-vault-key'}), /MISMATCH/);
  await assert.rejects(api.openSharingIdentity({...identity, uid: 'user-1', vaultKeyMaterial: 'wrong-key'}), /AUTHENTICITY/);
});

test('manomissione e sostituzione silenziosa della chiave pubblica sono bloccate', async () => {
  const first = await api.createSharingIdentity({uid: 'user-1', vaultKeyMaterial: 'fixture-vault-key'});
  const second = await api.createSharingIdentity({uid: 'user-1', vaultKeyMaterial: 'fixture-vault-key'});
  assert.throws(() => api.assertIdentityUpdate(first.publicIdentity, second.publicIdentity), /RECOVERY/);
  const tampered = structuredClone(first); tampered.publicIdentity.publicJwk.x = second.publicIdentity.publicJwk.x;
  await assert.rejects(api.openSharingIdentity({...tampered, uid: 'user-1', vaultKeyMaterial: 'fixture-vault-key'}), /MISMATCH/);
});
