import assert from 'node:assert/strict';

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'demo-codici-password';
const AUTH_BASE = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099'}`;
const FUNCTIONS_BASE = `http://${process.env.FUNCTIONS_EMULATOR_HOST || '127.0.0.1:5001'}/${PROJECT_ID}/europe-west1`;
const EMULATOR_APP_CHECK = 'eyJhbGciOiJub25lIn0.eyJhcHBfaWQiOiJkZW1vLWNvZGljaS1wYXNzd29yZCJ9.';

async function callable(name, data, token = null) {
  const response = await fetch(`${FUNCTIONS_BASE}/${name}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-firebase-appcheck': EMULATOR_APP_CHECK,
      ...(token ? {authorization: `Bearer ${token}`} : {}),
    },
    body: JSON.stringify({data}),
  });
  const body = await response.json();
  return {response, body};
}

const email = `p4-${Date.now()}@example.test`;
const signup = await fetch(`${AUTH_BASE}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key`, {
  method: 'POST',
  headers: {'content-type': 'application/json'},
  body: JSON.stringify({email, password: 'Local-Test-Only!2026', returnSecureToken: true}),
});
const signupText = await signup.text();
assert.equal(signup.status, 200, `Creazione utente emulator fallita: ${signupText}`);
const {idToken} = JSON.parse(signupText);
assert.ok(idToken, 'Auth Emulator non ha restituito un ID token');

const unauthenticated = await callable('revokeAllSessions', {});
assert.equal(unauthenticated.body?.error?.status, 'UNAUTHENTICATED');

const revoke = await callable('revokeAllSessions', {}, idToken);
assert.equal(revoke.response.status, 200, `Revoca locale fallita: ${JSON.stringify(revoke.body)}`);
assert.equal(revoke.body?.result?.ok, true);

const recoveryInvalid = await callable('recoverMfaWithCode', {
  email: '', password: '', recoveryCode: '',
});
assert.equal(recoveryInvalid.body?.error?.status, 'INVALID_ARGUMENT');

const inviteInvalid = await callable('respondToInvitation', {
  inviteId: '', status: 'invalid',
}, idToken);
assert.equal(inviteInvalid.body?.error?.status, 'INVALID_ARGUMENT');

const pushInvalid = await callable('sendDeadlinePushTest', {
  deviceId: 'invalid',
}, idToken);
assert.equal(pushInvalid.body?.error?.status, 'INVALID_ARGUMENT');

const recoveryCodesWithoutTotp = await callable('createMfaRecoveryCodes', {}, idToken);
assert.equal(recoveryCodesWithoutTotp.body?.error?.status, 'FAILED_PRECONDITION');

console.log('Functions Emulator P4: 6 scenari superati, nessun servizio di produzione contattato.');
