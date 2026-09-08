import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import test from 'node:test';

async function load(relativePath) {
  const source = await readFile(new URL(relativePath, import.meta.url), 'utf8');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const identityApi = await load('../Frontend/public/assets/js/modules/core/sharing-identity.js');
const sharingApi = await load('../experiments/sharing-key-prototype/record-sharing-crypto.mjs');

test('fixture dispositivo A → B riapre identità e record senza esportare chiavi in chiaro', async () => {
  const vaultKey = 'fixture-vault-key-shared-between-authorized-devices';
  const createdOnDeviceA = await identityApi.createSharingIdentity({uid: 'recipient-1', vaultKeyMaterial: vaultKey});
  const transferred = JSON.parse(JSON.stringify(createdOnDeviceA));
  assert.equal(JSON.stringify(transferred).includes('"d"'), false);

  const openedOnDeviceB = await identityApi.openSharingIdentity({
    ...transferred, uid: 'recipient-1', vaultKeyMaterial: vaultKey
  });
  const recordKey = sharingApi.generateRecordKey();
  const encrypted = await sharingApi.encryptRecordPayload({title: 'fixture', revision: 1}, recordKey, 'record-1');
  const envelope = await sharingApi.wrapRecordKeyForRecipient(
    recordKey, openedOnDeviceB.publicKey, 'record-1', 'recipient-1'
  );
  const unwrapped = await sharingApi.unwrapRecordKeyForRecipient(
    envelope, openedOnDeviceB.privateKey, 'record-1', 'recipient-1'
  );
  assert.deepEqual(await sharingApi.decryptRecordPayload(encrypted, unwrapped, 'record-1'), {title: 'fixture', revision: 1});
});

test('un dispositivo non autorizzato non riapre il pacchetto trasferito', async () => {
  const identity = await identityApi.createSharingIdentity({uid: 'recipient-1', vaultKeyMaterial: 'authorized-key'});
  await assert.rejects(identityApi.openSharingIdentity({
    ...identity, uid: 'recipient-1', vaultKeyMaterial: 'unauthorized-key'
  }), /AUTHENTICITY/);
});
