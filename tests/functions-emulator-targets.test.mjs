import test from 'node:test';
import assert from 'node:assert/strict';
import {functionsEmulatorTargets} from '../scripts/functions-emulator-targets.mjs';
const env = {GCLOUD_PROJECT: 'demo-codici-password', FIREBASE_AUTH_EMULATOR_HOST: '127.0.0.1:9099',
  FUNCTIONS_EMULATOR_HOST: '127.0.0.1:5001', FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080'};
test('HTTP smoke targets require explicit demo project and all loopback hosts', () => {
  assert.deepEqual(functionsEmulatorTargets(env), {project: 'demo-codici-password',
    authBase: 'http://127.0.0.1:9099', functionsBase: 'http://127.0.0.1:5001/demo-codici-password/europe-west1'});
  for (const key of Object.keys(env)) assert.throws(() => functionsEmulatorTargets({...env, [key]: undefined}));
  assert.throws(() => functionsEmulatorTargets({...env, GCLOUD_PROJECT: 'appcodici-password'}));
});
test('HTTP smoke rejects remote hosts, userinfo, paths and invalid ports', () => {
  for (const key of ['FIREBASE_AUTH_EMULATOR_HOST', 'FUNCTIONS_EMULATOR_HOST', 'FIRESTORE_EMULATOR_HOST']) {
    for (const value of ['example.invalid:8080', 'localhost.example.invalid:8080', '127.0.0.1:0',
      '127.0.0.1:65536', '127.0.0.1:8080/path', 'localhost@evil.invalid:8080']) {
      assert.throws(() => functionsEmulatorTargets({...env, [key]: value}));
    }
  }
  assert.equal(functionsEmulatorTargets({...env, FUNCTIONS_EMULATOR_HOST: '[::1]:5001'})
    .functionsBase, 'http://[::1]:5001/demo-codici-password/europe-west1');
});
