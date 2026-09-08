import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

async function loadModel() {
  const source = await readFile('Frontend/public/assets/js/modules/settings/backup-import-model.js', 'utf8');
  const result = await build({stdin: {contents: source, loader: 'js'}, bundle: true, format: 'esm', platform: 'browser', write: false});
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

test('suddivide senza superare il limite backend e conserva l’ordine', async () => {
  const api = await loadModel();
  const records = Array.from({length: 401}, (_, id) => ({id: `r${id}`, data: {value: id}}));
  const chunks = api.chunkRestoreRecords(records);
  assert.deepEqual(chunks.map(chunk => chunk.length), [400, 1]);
  assert.equal(chunks.flat()[400].id, 'r400');
});

test('footer e percorsi allegato devono corrispondere esattamente', async () => {
  const api = await loadModel();
  assert.equal(api.validateBackupFooter({kind: 'footer', entryCount: 3, recordCount: 2, attachmentCount: 1}, {entries: 3, records: 2, attachments: 1}), true);
  assert.throws(() => api.validateBackupFooter({kind: 'footer', entryCount: 2}, {entries: 3, records: 2, attachments: 1}), /FOOTER/);
  assert.equal(api.validateRestoreStoragePath('users/owner/accounts/a/attachments/f', 'owner'), 'users/owner/accounts/a/attachments/f');
  assert.throws(() => api.validateRestoreStoragePath('users/other/file', 'owner'), /STORAGE_PATH/);
});
