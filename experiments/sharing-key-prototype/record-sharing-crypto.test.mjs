import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decryptRecordPayload,
  encryptRecordPayload,
  generateIdentityKeyPair,
  generateRecordKey,
  unwrapRecordKeyForRecipient,
  wrapRecordKeyForRecipient
} from './record-sharing-crypto.mjs';

test('soltanto il destinatario dell’envelope decifra il record', async () => {
  const recipient = await generateIdentityKeyPair();
  const stranger = await generateIdentityKeyPair();
  const recordKey = generateRecordKey();
  const payload = {username: 'utente-prova', password: 'segreto-prova'};
  const encrypted = await encryptRecordPayload(payload, recordKey, 'record-1');
  const envelope = await wrapRecordKeyForRecipient(recordKey, recipient.publicKey, 'record-1', 'recipient-1');

  const receivedKey = await unwrapRecordKeyForRecipient(envelope, recipient.privateKey, 'record-1', 'recipient-1');
  assert.deepEqual(await decryptRecordPayload(encrypted, receivedKey, 'record-1'), payload);
  await assert.rejects(unwrapRecordKeyForRecipient(envelope, stranger.privateKey, 'record-1', 'recipient-1'));
  assert.equal(JSON.stringify(envelope).includes('segreto-prova'), false);
});

test('la rotazione esclude il revocato dalle versioni future', async () => {
  const revoked = await generateIdentityKeyPair();
  const active = await generateIdentityKeyPair();
  const oldKey = generateRecordKey();
  const oldEnvelope = await wrapRecordKeyForRecipient(oldKey, revoked.publicKey, 'record-2', 'revoked-user');
  const retainedOldKey = await unwrapRecordKeyForRecipient(oldEnvelope, revoked.privateKey, 'record-2', 'revoked-user');

  const newKey = generateRecordKey();
  const newPayload = await encryptRecordPayload({revision: 2}, newKey, 'record-2');
  const activeEnvelope = await wrapRecordKeyForRecipient(newKey, active.publicKey, 'record-2', 'active-user');
  const activeKey = await unwrapRecordKeyForRecipient(activeEnvelope, active.privateKey, 'record-2', 'active-user');

  assert.deepEqual(await decryptRecordPayload(newPayload, activeKey, 'record-2'), {revision: 2});
  await assert.rejects(decryptRecordPayload(newPayload, retainedOldKey, 'record-2'));
});
