import test from 'node:test';
import assert from 'node:assert/strict';
import {isExpectedPreconditionFailure, validateGateConfig} from '../scripts/gcs-generation-gate.mjs';

test('il banco GCS accetta solo il progetto e i bucket dell app originale', () => {
  assert.deepEqual(validateGateConfig({projectId: 'appcodici-password',
    bucketName: 'appcodici-password.firebasestorage.app'}), {
    projectId: 'appcodici-password', bucketName: 'appcodici-password.firebasestorage.app'});
  assert.throws(() => validateGateConfig({projectId: 'appcodici-password-nuova',
    bucketName: 'appcodici-password.firebasestorage.app'}), /PROJECT_NOT_ALLOWED/);
  assert.throws(() => validateGateConfig({projectId: 'appcodici-password',
    bucketName: 'other-project.appspot.com'}), /BUCKET_NOT_ALLOWED/);
});

test('il banco riconosce gli esiti GCS sicuri per una generazione obsoleta', () => {
  assert.equal(isExpectedPreconditionFailure({code: 404}), true);
  assert.equal(isExpectedPreconditionFailure({code: 412}), true);
  assert.equal(isExpectedPreconditionFailure({errors: [{code: '412'}]}), true);
  assert.equal(isExpectedPreconditionFailure({code: 403}), false);
});
