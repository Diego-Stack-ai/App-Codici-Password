import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
// Characterization only: no recovery endpoint, real credentials or remote project.
assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099', 'Auth emulator is required');
const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-vault-shell';
const authBase = `http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}`;
const require = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');
const app = initializeApp({projectId: project}, 'mfa-session-probe');
const auth = getAuth(app), uid = `synthetic-mfa-${randomUUID()}`;
try {
  await auth.createUser({uid, email: `${uid}@example.invalid`, password: `Synthetic-${randomUUID()}`});
  let token = await auth.createCustomToken(uid);
  // The real race: account removed after the last existence check, before exchange.
  await auth.deleteUser(uid);
  const response = await fetch(`${authBase}/identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=demo-key`, {
    method: 'POST', headers: {'content-type': 'application/json'}, redirect: 'error',
    body: JSON.stringify({token, returnSecureToken: true})
  });
  token = null;
  const result = await response.json();
  assert.equal(response.ok, true, 'characterization changed: reassess provider behavior');
  assert.equal(result.isNewUser, true);
  const recreated = await auth.getUser(uid);
  assert.equal(recreated.uid, uid);
  assert.equal(recreated.email, undefined);
  result.idToken = null; result.refreshToken = null;
  console.log('MFA characterization: custom-token exchange recreated the deleted synthetic account. Safety gate FAILED; do not activate this design.');
} finally {
  // Only the exact synthetic identity created above; no global account cleanup.
  await auth.deleteUser(uid).catch(error => {if (error.code !== 'auth/user-not-found') throw error;});
  await deleteApp(app);
}
