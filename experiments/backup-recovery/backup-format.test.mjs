import assert from 'node:assert/strict'; import test from 'node:test';
import {buildRestoreTransaction, createBackupPayload, exportEncryptedBackup, generateRecoveryKey, importEncryptedBackup, stageBackupRestore} from './backup-format.mjs';
test('esporta e ripristina un backup senza plaintext', async () => {
  const recoveryKey = generateRecoveryKey(); const data = {accounts: [{password: 'FIXTURE-NON-SEGRETO'}]};
  const backup = await exportEncryptedBackup({ownerUid: 'owner', data, recoveryKey});
  assert.equal(JSON.stringify(backup).includes('FIXTURE-NON-SEGRETO'), false);
  assert.deepEqual(await importEncryptedBackup(backup, {ownerUid: 'owner', recoveryKey}), data);
});
test('chiave, proprietario e contenuto errati bloccano il ripristino', async () => {
  const recoveryKey = generateRecoveryKey(); const backup = await exportEncryptedBackup({ownerUid: 'owner', data: {fixture: true}, recoveryKey});
  await assert.rejects(importEncryptedBackup(backup, {ownerUid: 'other', recoveryKey}), /FORMAT/);
  await assert.rejects(importEncryptedBackup(backup, {ownerUid: 'owner', recoveryKey: generateRecoveryKey()}));
  backup.ciphertext = `${backup.ciphertext.slice(0, -2)}AA`; await assert.rejects(importEncryptedBackup(backup, {ownerUid: 'owner', recoveryKey}));
});
test('ogni Recovery Key ha 192 bit casuali e formato leggibile', () => {
  const keys = new Set(Array.from({length: 100}, generateRecoveryKey)); assert.equal(keys.size, 100);
  for (const key of keys) assert.match(key, /^[a-f0-9]{8}(?:-[a-f0-9]{8}){5}$/);
});

test('manifest e staging verificano record, allegati e digest prima del ripristino', async () => {
  const payload = await createBackupPayload({
    records: [{id: 'record-1', title: 'Fixture'}],
    attachments: [{id: 'attachment-1', recordId: 'record-1', content: Buffer.from('fixture allegato').toString('base64')}]
  });
  const staged = await stageBackupRestore(payload, {ownerUid: 'owner'});
  const transaction = buildRestoreTransaction(staged);
  assert.equal(staged.status, 'validated');
  assert.equal(transaction.records.length, 1);
  assert.equal(transaction.attachments[0].digest, payload.manifest.attachments[0].digest);
});

test('staging rifiuta allegati mancanti, duplicati, alterati o senza record', async () => {
  const original = await createBackupPayload({
    records: [{id: 'record-1'}],
    attachments: [{id: 'attachment-1', recordId: 'record-1', content: Buffer.from('fixture').toString('base64')}]
  });
  const missing = structuredClone(original); missing.attachments = [];
  await assert.rejects(stageBackupRestore(missing, {ownerUid: 'owner'}), /MANIFEST/);
  const duplicate = structuredClone(original); duplicate.attachments.push(structuredClone(duplicate.attachments[0])); duplicate.manifest.attachmentCount = 2;
  await assert.rejects(stageBackupRestore(duplicate, {ownerUid: 'owner'}), /ATTACHMENT_ID/);
  const altered = structuredClone(original); altered.attachments[0].content = Buffer.from('alterato').toString('base64');
  await assert.rejects(stageBackupRestore(altered, {ownerUid: 'owner'}), /INTEGRITY/);
  const orphan = structuredClone(original); orphan.attachments[0].recordId = 'record-missing';
  await assert.rejects(stageBackupRestore(orphan, {ownerUid: 'owner'}), /REFERENCE/);
});

test('il piano di ripristino non modifica il target e blocca le collisioni', async () => {
  const target = [{id: 'existing'}];
  const payload = await createBackupPayload({records: [{id: 'record-1'}]});
  const staged = await stageBackupRestore(payload, {ownerUid: 'owner'});
  assert.throws(() => buildRestoreTransaction(staged, {existingRecordIds: ['record-1']}), /COLLISION/);
  assert.deepEqual(target, [{id: 'existing'}]);
  assert.deepEqual(buildRestoreTransaction(staged, {existingRecordIds: target.map(item => item.id)}).records, [{id: 'record-1'}]);
});
