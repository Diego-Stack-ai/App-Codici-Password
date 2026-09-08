import assert from 'node:assert/strict'; import test from 'node:test';
import {exportEncryptedBackup, generateRecoveryKey, importEncryptedBackup} from './backup-format.mjs';
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
