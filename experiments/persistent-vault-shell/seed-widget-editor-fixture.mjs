// Add one distinct fixture through the actual local callable. No global seed,
// privileged write, Rules change, or existing-widget normalization.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
const authResponse = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=demo-key', {
  method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({
    email: 'a@example.invalid', password: 'LOGIN-SOLO-EMULATORE!123', returnSecureToken: true})
});
assert.equal(authResponse.status, 200);
const identity = await authResponse.json(), encode = value => Buffer.from(JSON.stringify(value)).toString('base64');
const appCheck = `${encode({alg: 'none', typ: 'JWT'})}.${encode({sub: 'synthetic-vault-laboratory', aud: ['projects/demo-vault-shell'],
  exp: Math.floor(Date.now() / 1000) + 3600, iat: Math.floor(Date.now() / 1000)})}.`;
const widgetId = `editor-check-${randomUUID()}`;
const response = await fetch('http://127.0.0.1:5001/demo-vault-shell/europe-west1/manageAccountWidget', {
  method: 'POST', headers: {'content-type': 'application/json', authorization: `Bearer ${identity.idToken}`, 'x-firebase-appcheck': appCheck},
  body: JSON.stringify({data: {expectedOwnerUid: identity.localId, action: 'create', operationId: randomUUID(),
    context: 'private', accountId: 'zeta', widgetId, data: {title: 'Collaudo editor 05-10',
      fields: [{id: 'plain', label: 'Dato sintetico', type: 'text', encrypted: false, value: 'PRIMA-PROVA-UI'}]}}})
});
const result = await response.json();
assert.equal(response.status, 200, JSON.stringify(result));
assert.equal(result.result.status, 'applied');
console.log(JSON.stringify({widgetId, revision: result.result.revision, status: result.result.status}));
