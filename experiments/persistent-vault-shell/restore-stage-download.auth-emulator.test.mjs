import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import http from 'node:http';
import {createRestoreStageDownload} from './restore-stage-download.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getAuth} = require('firebase-admin/auth');

test('download verifies Auth emulator token with Admin SDK; App Check remains synthetic', {
  skip: process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099', timeout: 15000
}, async t => {
  const app = initializeApp({projectId: 'demo-vault-shell'}, `download-${randomUUID()}`);
  let syntheticUid, server;
  t.after(async () => {
    try {
      if (server) {server.closeAllConnections(); await new Promise(resolve => server.close(resolve));}
      if (syntheticUid) await getAuth(app).deleteUser(syntheticUid);
    } finally {await deleteApp(app);}
  });
  const response = await fetch('http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-key', {
    method: 'POST', headers: {'content-type': 'application/json'}, body: JSON.stringify({returnSecureToken: true})});
  assert.equal(response.status, 200);
  const account = await response.json();
  assert.equal(typeof account.localId, 'string');
  // Anonymous synthetic emulator account only; no production credentials.
  syntheticUid = account.localId;
  let reads = 0;
  const handler = createRestoreStageDownload({verifyIdToken: token => getAuth(app).verifyIdToken(token),
    verifyAppCheck: async value => {if (value !== 'synthetic') throw Error('DENIED');},
    read: async (uid, command) => {
      assert.equal(uid, account.localId); assert.equal(command.stageId, 'a'.repeat(64)); reads++;
      return {bytes: Buffer.from([1]), size: 1, generation: '1', sha256: 'b'.repeat(64)};
    }});
  server = http.createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const send = (token, appCheck = 'synthetic') => fetch(`http://127.0.0.1:${server.address().port}/download`, {
    method: 'POST', headers: {authorization: `Bearer ${token}`, 'x-firebase-appcheck': appCheck, 'x-stage-id': 'a'.repeat(64)}});
  const good = await send(account.idToken); assert.equal(good.status, 200); assert.deepEqual([...new Uint8Array(await good.arrayBuffer())], [1]);
  for (const [token, appCheck] of [['invalid-token', 'synthetic'], [account.idToken, 'wrong']]) {
    const denied = await send(token, appCheck); assert.equal(denied.status, 401); await denied.arrayBuffer();
  }
  assert.equal(reads, 1);
});
