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

// ── M10-LOG-1: nei log solo un'etichetta stabile e sanificata ─────────────────
const labelPattern = /^[A-Za-z][A-Za-z0-9_./-]{0,63}$/;

async function captureWarnings(action) {
  const captured = [];
  const original = console.warn;
  console.warn = (...args) => captured.push(args);
  try { return {result: await action(), captured}; } finally { console.warn = original; }
}

test('persistenza fallita: il log riceve solo l’etichetta, mai oggetto, messaggio o dati', async () => {
  const secret = 'SYNTHETIC-SECRET-NOT-TO-BE-LOGGED';
  const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
  sessionStorage.setItem = () => {
    const error = new Error(`messaggio con ${secret}`);
    error.name = 'SyntheticError';
    error.code = 'synthetic-secret-code';
    error.details = {secret};
    throw error;
  };
  let outcome;
  try { outcome = await captureWarnings(() => saveVaultSession('vault-key-material', 'uid-a')); }
  finally { sessionStorage.setItem = originalSetItem; }
  assert.equal(outcome.result, false);
  assert.equal(outcome.captured.length, 1);
  const [message, label] = outcome.captured[0];
  assert.equal(message, '[Vault Session] Persistenza non disponibile:');
  assert.match(label, labelPattern);
  assert.equal(label, 'synthetic-secret-code');
  const text = JSON.stringify(outcome.captured) + String(outcome.captured[0][0]) + String(outcome.captured[0][1]);
  for (const leak of [secret, 'messaggio', 'details', 'SyntheticError', 'at ']) {
    assert.equal(text.includes(leak), false, `il log non deve contenere ${leak}`);
  }
});

test('valore non-Error: il log riceve l’etichetta generica', async () => {
  const originalSetItem = sessionStorage.setItem.bind(sessionStorage);
  sessionStorage.setItem = () => { throw 'SYNTHETIC-THROWN-STRING-NOT-TO-BE-LOGGED'; };
  let outcome;
  try { outcome = await captureWarnings(() => saveVaultSession('vault-key-material', 'uid-a')); }
  finally { sessionStorage.setItem = originalSetItem; }
  assert.equal(outcome.result, false);
  assert.equal(outcome.captured[0][1], 'Error');
  assert.equal(JSON.stringify(outcome.captured).includes('SYNTHETIC-THROWN-STRING'), false);
});

test('ripristino fallito: il log non contiene il payload corrotto', async () => {
  await saveVaultSession('vault-key-material', 'uid-a');
  const stored = JSON.parse(sessionStorage.getItem('vault_session_v1'));
  sessionStorage.setItem('vault_session_v1', JSON.stringify({...stored, ciphertext: 'AAAA'}));
  const outcome = await captureWarnings(() => restoreVaultSession('uid-a'));
  assert.equal(outcome.result, null);
  assert.equal(outcome.captured.length, 1);
  const [message, label] = outcome.captured[0];
  assert.equal(message, '[Vault Session] Ripristino non riuscito:');
  assert.match(label, labelPattern);
  const text = JSON.stringify(outcome.captured);
  for (const leak of ['AAAA', stored.ciphertext, stored.iv]) assert.equal(text.includes(leak), false);
});

test('nessuna chiamata console nei due moduli di sicurezza riceve dati dell’errore', async () => {
  for (const name of ['security-manager.js', 'vault-session.js']) {
    const source = await readFile(new URL(`../Frontend/public/assets/js/modules/core/${name}`, import.meta.url), 'utf8');
    const calls = [...source.matchAll(/console\.(?:log|info|warn|error|debug)\(([\s\S]*?)\);/g)];
    assert.ok(calls.length >= 2, `${name}: nessuna chiamata console trovata`);
    for (const call of calls) {
      const arguments_ = call[1].split(',').map(part => part.trim()).filter(Boolean);
      for (const argument of arguments_) {
        assert.match(argument, /^(?:'[^']*'|"[^"]*"|`[^`]*`|logErrorLabel\([A-Za-z_$][\w$]*\))$/,
          `${name}: argomento non sanificato → ${argument}`);
      }
    }
  }
});
