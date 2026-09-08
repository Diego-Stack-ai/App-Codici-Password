import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';
import {decryptRecordPayload, generateIdentityKeyPair, unwrapRecordKeyForRecipient} from './record-sharing-crypto.mjs';
import {restoreRollbackPackage, simulateFixtureMigration} from './migration-simulator.mjs';

const dataset = JSON.parse(await readFile(new URL('../../tests/fixtures/maturity-dataset.json', import.meta.url), 'utf8'));

test('migra una fixture senza modificare il record sorgente', async () => {
  const source = dataset.privateAccounts[0];
  const original = structuredClone(source);
  const ownerKeys = await generateIdentityKeyPair();
  const recipientKeys = await generateIdentityKeyPair();
  const result = await simulateFixtureMigration({
    fixture: dataset.fixture,
    account: source,
    owner: {uid: dataset.owner.uid, publicKey: ownerKeys.publicKey},
    recipients: [{uid: 'fixture-recipient-0001', publicKey: recipientKeys.publicKey}]
  });

  assert.deepEqual(source, original);
  assert.equal(result.record.schemaVersion, 2);
  assert.equal(result.record.password, undefined);
  assert.equal(result.record.payload.ciphertext.includes(source.password), false);
  assert.deepEqual(result.grants.map(grant => grant.role), ['owner', 'viewer']);

  const recipientGrant = result.grants[1];
  const recordKey = await unwrapRecordKeyForRecipient(
    recipientGrant.envelope,
    recipientKeys.privateKey,
    source.id,
    recipientGrant.recipientUid
  );
  assert.deepEqual(await decryptRecordPayload(result.record.payload, recordKey, source.id), original);
  assert.deepEqual(await restoreRollbackPackage(result.backup), original);
});

test('rifiuta dati non marcati come fixture e backup manomessi', async () => {
  const ownerKeys = await generateIdentityKeyPair();
  await assert.rejects(simulateFixtureMigration({
    fixture: false,
    account: dataset.privateAccounts[0],
    owner: {uid: dataset.owner.uid, publicKey: ownerKeys.publicKey}
  }), /PRODUCTION_DATA_FORBIDDEN/);

  const migrated = await simulateFixtureMigration({
    fixture: true,
    account: dataset.privateAccounts[0],
    owner: {uid: dataset.owner.uid, publicKey: ownerKeys.publicKey}
  });
  migrated.backup.snapshot.name = 'manomesso';
  await assert.rejects(restoreRollbackPackage(migrated.backup), /ROLLBACK_INTEGRITY_FAILED/);
});
