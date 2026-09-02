const test = require('node:test');
const assert = require('node:assert/strict');
const {
  generateRecoveryCode,
  nextRecoveryAttemptState,
  normalizeRecoveryCode,
  recoveryAttemptId,
  recoveryCodeHash,
} = require('../recovery-security');

test('i recovery code hanno formato ed entropia coerenti', () => {
  const codes = new Set(Array.from({length: 100}, generateRecoveryCode));
  assert.equal(codes.size, 100);
  for (const code of codes) assert.match(code, /^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){3}$/);
});

test('normalizzazione e hash sono stabili senza conservare il codice', () => {
  assert.equal(normalizeRecoveryCode('abcd-efgh-2345-6789'), 'ABCDEFGH23456789');
  assert.equal(recoveryCodeHash('ABCD-EFGH-2345-6789'), recoveryCodeHash('abcdefgh23456789'));
  assert.notEqual(recoveryAttemptId('utente@example.com', '127.0.0.1'), recoveryAttemptId('utente@example.com', '127.0.0.2'));
});

test('il sesto tentativo nella finestra attiva il blocco server', () => {
  const now = 1_800_000_000_000;
  let state = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    state = nextRecoveryAttemptState(state, now + attempt);
    assert.equal(state.allowed, true);
  }
  state = nextRecoveryAttemptState(state, now + 6);
  assert.equal(state.allowed, false);
  assert.ok(state.blockedUntil > now);
  assert.equal(nextRecoveryAttemptState(state, now + 7).allowed, false);
});
