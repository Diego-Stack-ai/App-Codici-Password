// Distinct synthetic fixture only. Existing records and Rules are untouched.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
const auth = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key', {
  method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({
    email: 'a@example.invalid', password: 'LOGIN-SOLO-EMULATORE!123', returnSecureToken: true})
});
assert.equal(auth.status, 200);
const identity = await auth.json(), encode = value => Buffer.from(JSON.stringify(value)).toString('base64');
const appCheck = `${encode({alg: 'none', typ: 'JWT'})}.${encode({sub: 'synthetic-vault-laboratory', aud: ['projects/demo-vault-shell'],
  exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000)})}.`;
const resumeId = process.argv[2];
if (resumeId) assert.match(resumeId, /^shared-editor-[0-9a-f-]{36}$/);
const sharedDataId = resumeId || `shared-editor-${randomUUID()}`;
async function call(command) {
  const response = await fetch('http://127.0.0.1:5001/demo-vault-shell/europe-west1/manageSharedVaultData', {
    method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${identity.idToken}`, 'x-firebase-appcheck': appCheck},
    body: JSON.stringify({data: {expectedOwnerUid: identity.localId, operationId: randomUUID(), sharedDataId, ...command}})
  });
  const result = await response.json(); assert.equal(response.status, 200, JSON.stringify(result));
  assert.equal(result.result.status, 'applied'); return result.result;
}
if (!resumeId) await call({action: 'create', data: {title: 'Collaudo comune 05-10', fields: [
  {id: 'plain', label: 'Dato comune sintetico', type: 'text', encrypted: false, value: 'COMUNE-PRIMA'}]}});
let revision = resumeId ? 2 : 1;
for (const accountId of resumeId ? ['alfa'] : ['zeta', 'alfa']) {
  const result = await call({action: 'link', expectedRevision: revision,
  linkId: `${sharedDataId}-${accountId}`, widgetId: `${sharedDataId}-${accountId}`, link: {context: 'private', accountId}});
  revision = result.revision;
}
console.log(JSON.stringify({sharedDataId, accounts: ['zeta', 'alfa']}));
