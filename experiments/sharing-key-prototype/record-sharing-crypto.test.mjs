import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decryptAttachmentForRecord,
  decryptRecordPayload,
  encryptAttachmentForRecord,
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

test('un allegato usa una chiave-file avvolta dalla chiave del record', async () => {
  const recordKey = generateRecordKey();
  const wrongKey = generateRecordKey();
  const clear = new TextEncoder().encode('allegato fittizio non sensibile');
  const encrypted = await encryptAttachmentForRecord(clear, recordKey, 'record-3', 'attachment-1');

  assert.deepEqual(
    await decryptAttachmentForRecord(encrypted, recordKey, 'record-3', 'attachment-1'),
    clear
  );
  await assert.rejects(decryptAttachmentForRecord(encrypted, wrongKey, 'record-3', 'attachment-1'));
});

test('la cache offline conserva solo la generazione già ricevuta', async () => {
  const recipient = await generateIdentityKeyPair();
  const oldKey = generateRecordKey();
  const cachedPayload = await encryptRecordPayload({revision: 1}, oldKey, 'record-4');
  const cachedEnvelope = await wrapRecordKeyForRecipient(oldKey, recipient.publicKey, 'record-4', 'recipient-offline');
  const cachedKey = await unwrapRecordKeyForRecipient(
    cachedEnvelope, recipient.privateKey, 'record-4', 'recipient-offline'
  );
  assert.deepEqual(await decryptRecordPayload(cachedPayload, cachedKey, 'record-4'), {revision: 1});

  const rotatedPayload = await encryptRecordPayload({revision: 2}, generateRecordKey(), 'record-4');
  await assert.rejects(decryptRecordPayload(rotatedPayload, cachedKey, 'record-4'));
});
