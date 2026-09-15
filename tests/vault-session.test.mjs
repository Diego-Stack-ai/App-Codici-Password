import {test, beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

class StorageMock {
  #items = new Map();
  getItem(key) { return this.#items.has(key) ? this.#items.get(key) : null; }
  setItem(key, value) { this.#items.set(key, String(value)); }
  removeItem(key) { this.#items.delete(key); }
  clear() { this.#items.clear(); }
}

globalThis.sessionStorage = new StorageMock();
globalThis.window = {dispatchEvent() {}};
globalThis.Event = class Event { constructor(type) { this.type = type; } };
globalThis.btoa = value => Buffer.from(value, 'binary').toString('base64');
globalThis.atob = value => Buffer.from(value, 'base64').toString('binary');

const source = await readFile(new URL('../Frontend/public/assets/js/modules/core/vault-session.js', import.meta.url), 'utf8');
const {saveVaultSession, restoreVaultSession, clearVaultSession} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

beforeEach(() => sessionStorage.clear());

// Characterization of known VS-P0-01, NOT a security acceptance criterion.
// Replace with a no-persistence assertion when the persistent shell is integrated.
test('VS-P0-01: lo storage legacy basta a recuperare materiale sintetico senza Master Password', async () => {
  const syntheticMaterial = 'audit-only-not-a-real-vault-key';
  await saveVaultSession(syntheticMaterial, 'synthetic-audit-user');
  const stored = JSON.parse(sessionStorage.getItem('vault_session_v1'));
  const wrapping = Buffer.from(sessionStorage.getItem('codex_vault_session_wrapping_key_v1'), 'base64');
  const key = await crypto.subtle.importKey('raw', wrapping, {name: 'AES-GCM'}, false, ['decrypt']);
  const plaintext = await crypto.subtle.decrypt({name: 'AES-GCM', iv: Buffer.from(stored.iv, 'base64')},
    key, Buffer.from(stored.ciphertext, 'base64'));
  assert.equal(new TextDecoder().decode(plaintext), syntheticMaterial);
  clearVaultSession();
  assert.equal(sessionStorage.getItem('vault_session_v1'), null);
  assert.equal(sessionStorage.getItem('codex_vault_session_wrapping_key_v1'), null);
});

test('la sessione ripristina il Vault Key material solo per lo stesso UID', async () => {
  await saveVaultSession('vault-key-material', 'uid-a');
  assert.equal(await restoreVaultSession('uid-a'), 'vault-key-material');
  assert.equal(await restoreVaultSession('uid-b'), null);
});

test('blocco e logout eliminano payload e chiave di wrapping', async () => {
  await saveVaultSession('vault-key-material', 'uid-a');
  assert.ok(sessionStorage.getItem('vault_session_v1'));
  assert.ok(sessionStorage.getItem('codex_vault_session_wrapping_key_v1'));
  clearVaultSession();
  assert.equal(sessionStorage.getItem('vault_session_v1'), null);
  assert.equal(sessionStorage.getItem('codex_vault_session_wrapping_key_v1'), null);
  assert.equal(await restoreVaultSession('uid-a'), null);
});
