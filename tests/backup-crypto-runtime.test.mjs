import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

async function loadModule() {
  const source = await readFile('Frontend/public/assets/js/modules/settings/backup-crypto.js', 'utf8');
  const result = await build({
    stdin: {contents: source, loader: 'js'},
    bundle: true, format: 'esm', platform: 'browser', write: false
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

test('il formato runtime cifra record concatenati e li riapre in ordine', async () => {
  const api = await loadModule();
  const recoveryKey = api.generateRecoveryKey();
  const header = api.createBackupHeader('owner', 1234);
  const key = await api.deriveBackupKey(header, recoveryKey, 'owner');
  const first = await api.encryptBackupEntry({header, key, sequence: 0, entry: {kind: 'record', data: {secret: 'FIXTURE-NON-SEGRETO'}}});
  const second = await api.encryptBackupEntry({header, key, sequence: 1, previousDigest: first.digest, entry: {kind: 'footer', entryCount: 1}});
  assert.equal(JSON.stringify(first.envelope).includes('FIXTURE-NON-SEGRETO'), false);
  const openedFirst = await api.decryptBackupEntry({header, key, expectedSequence: 0, envelope: first.envelope});
  const openedSecond = await api.decryptBackupEntry({header, key, expectedSequence: 1, previousDigest: openedFirst.digest, envelope: second.envelope});
  assert.equal(openedFirst.entry.data.secret, 'FIXTURE-NON-SEGRETO');
  assert.equal(openedSecond.entry.kind, 'footer');
  const verified = await api.verifyBackupChain({header, key, envelopes: [first.envelope, second.envelope]});
  assert.equal(verified.entries.length, 1);
  await assert.rejects(api.verifyBackupChain({header, key, envelopes: [first.envelope]}), /FOOTER/);
});

test('proprietario, chiave, ordine, catena e manomissione sono vincolanti', async () => {
  const api = await loadModule();
  const recoveryKey = api.generateRecoveryKey();
  const header = api.createBackupHeader('owner');
  const key = await api.deriveBackupKey(header, recoveryKey, 'owner');
  const encrypted = await api.encryptBackupEntry({header, key, sequence: 0, entry: {kind: 'record', id: 'r1'}});
  await assert.rejects(api.deriveBackupKey(header, recoveryKey, 'other'), /FORMAT/);
  await assert.rejects(api.decryptBackupEntry({header, key, expectedSequence: 1, envelope: encrypted.envelope}), /CHAIN/);
  encrypted.envelope.ciphertext = `${encrypted.envelope.ciphertext.slice(0, -2)}AA`;
  await assert.rejects(api.decryptBackupEntry({header, key, expectedSequence: 0, envelope: encrypted.envelope}));
});
