import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

async function loadModel() {
  const source = await readFile('Frontend/public/assets/js/modules/settings/backup-export-model.js', 'utf8');
  const result = await build({stdin: {contents: source, loader: 'js'}, bundle: true, format: 'esm', platform: 'browser', write: false});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

test('serializza Timestamp, date e byte senza perdere il tipo', async () => {
  const api = await loadModel();
  const timestamp = {seconds: 10, nanoseconds: 20, toMillis() { return 10000; }};
  assert.deepEqual(api.encodeFirestoreValue({timestamp, date: new Date('2030-01-01T00:00:00Z'), bytes: new Uint8Array([1, 2])}), {
    timestamp: {$type: 'timestamp', seconds: 10, nanoseconds: 20},
    date: {$type: 'date', value: '2030-01-01T00:00:00.000Z'},
    bytes: {$type: 'bytes', value: [1, 2]}
  });
});

test('descrittori e allegati restano confinati al proprietario', async () => {
  const api = await loadModel();
  const snapshot = {id: 'a1', data: () => ({file: {storagePath: 'users/owner/accounts/a1/attachments/f1'}})};
  const record = api.createRecordDescriptor('private-account', snapshot);
  assert.equal(api.createRecordDescriptorFromData('private-account', {id: 'a2', title: 'Fixture'}).id, 'a2');
  const linked = api.createRecordDescriptorFromData(
    'shared-vault-data-link', {id: 'l1', label: 'Legal Mail'}, {sharedDataId: 's1'}
  );
  assert.equal(linked.sharedDataId, 's1');
  assert.deepEqual(api.collectStoragePaths([record], 'owner'), ['users/owner/accounts/a1/attachments/f1']);
  assert.throws(() => api.collectStoragePaths([{data: {storagePath: 'users/other/file'}}], 'owner'), /STORAGE_PATH/);
});

test('rifiuta oggetti Firestore non supportati invece di convertirli silenziosamente', async () => {
  const api = await loadModel();
  assert.throws(() => api.encodeFirestoreValue(new Map([['x', 1]])), /UNSUPPORTED/);
});
