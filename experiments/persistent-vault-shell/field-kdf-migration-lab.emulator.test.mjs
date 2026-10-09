import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {migrateSyntheticFieldLab} from './field-kdf-migration-lab.mjs';
import {decryptFieldCompatibleLab} from './field-kdf-format-lab.mjs';
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');

async function legacy(plaintext, password) {
  const salt = new Uint8Array(16).fill(31), iv = new Uint8Array(12).fill(41), bytes = new TextEncoder().encode(password);
  const material = await crypto.subtle.importKey('raw', bytes, 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000}, material,
    {name: 'AES-GCM', length: 256}, false, ['encrypt']);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({name: 'AES-GCM', iv}, key, new TextEncoder().encode(plaintext)));
  return Buffer.concat([salt, iv, ciphertext]).toString('base64');
}

test('field migration is exact-version CAS and interruption leaves legacy ciphertext intact', {
  skip: process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8085', timeout: 30000
}, async () => {
  const app = initializeApp({projectId: 'demo-purge-fence'}, `field-kdf-${randomUUID()}`), store = getFirestore(app);
  const ref = store.doc(`labFieldKdf/${randomUUID()}`), password = 'Synthetic-password';
  try {
    const ciphertext = await legacy('synthetic legacy', password);
    await ref.create({secret: ciphertext, unrelated: 'preserved'});
    let snapshot = await ref.get(), expected = {ciphertext, updateTime: snapshot.updateTime};
    await assert.rejects(migrateSyntheticFieldLab(store, ref.path, 'secret', expected, password,
      async () => { throw Error('SYNTHETIC_INTERRUPTION'); }), /SYNTHETIC_INTERRUPTION/);
    assert.equal((await ref.get()).data().secret, ciphertext);
    const attempts = await Promise.allSettled([
      migrateSyntheticFieldLab(store, ref.path, 'secret', expected, password),
      migrateSyntheticFieldLab(store, ref.path, 'secret', expected, password)]);
    assert.equal(attempts.filter(item => item.status === 'fulfilled').length, 1);
    assert.equal(attempts.filter(item => item.status === 'rejected').length, 1);
    snapshot = await ref.get();
    assert.equal(snapshot.data().unrelated, 'preserved');
    assert.equal((await decryptFieldCompatibleLab(snapshot.data().secret, password)).plaintext, 'synthetic legacy');
    const current = await migrateSyntheticFieldLab(store, ref.path, 'secret',
      {ciphertext: snapshot.data().secret, updateTime: snapshot.updateTime}, password);
    assert.deepEqual(current, {status: 'current', duplicate: true});
  } finally {
    await store.recursiveDelete(store.collection('labFieldKdf'));
    await deleteApp(app);
  }
});
