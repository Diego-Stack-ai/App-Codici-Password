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

test('confronta il Vault fantasma senza modificare i record', async () => {
  const api = await loadModel();
  const backup = [
    {scope: 'profile', id: 'u1', data: {name: 'Mario'}},
    {scope: 'private-account', id: 'a1', data: {value: 1}},
    {scope: 'private-account', id: 'a2', data: {value: 2}}
  ];
  const current = [
    {scope: 'profile', id: 'u1', data: {name: 'Mario'}},
    {scope: 'private-account', id: 'a1', data: {value: 9}}
  ];
  const result = api.compareRestoreRecords(backup, current);
  assert.deepEqual(result.counts, {missing: 1, unchanged: 1, changed: 1});
  assert.deepEqual(result.entries.map(item => item.status), ['unchanged', 'changed', 'missing']);
  assert.deepEqual(result.entries.map(item => item.description), ['Profilo utente', 'Account senza nome', 'Account senza nome']);
  assert.equal(current[1].data.value, 9);
});

test('descrive account, aziende e allegati senza esporre credenziali', async () => {
  const api = await loadModel();
  const descriptions = api.describeRestoreRecords([
    {scope: 'company', id: 'c1', data: {ragioneSociale: 'Azienda Alfa'}},
    {scope: 'company-account', companyId: 'c1', id: 'a1', data: {nomeAccount: 'Portale', password: 'segreta'}},
    {scope: 'company-account-attachment', companyId: 'c1', accountId: 'a1', id: 'f1', data: {originalName: 'contratto.pdf'}}
  ]);
  assert.deepEqual(descriptions, ['Azienda Alfa', 'Portale — Azienda Alfa', 'contratto.pdf — Portale']);
  assert.equal(descriptions.join(' ').includes('segreta'), false);
});

test('descrive widget e credenziali comuni senza esporre valori protetti', async () => {
  const api = await loadModel();
  const descriptions = api.describeRestoreRecords([
    {scope: 'private-account', id: 'a1', data: {nomeAccount: 'Portale'}},
    {scope: 'private-account-widget', accountId: 'a1', id: 'w1', data: {title: 'Domande', fields: [{valueEnc: 'segreto'}]}},
    {scope: 'company', id: 'c1', data: {ragioneSociale: 'Azienda Alfa'}},
    {scope: 'company-account', companyId: 'c1', id: 'a2', data: {nomeAccount: 'PEC'}},
    {scope: 'company-account-widget', companyId: 'c1', accountId: 'a2', id: 'w2', data: {title: 'Referente'}},
    {scope: 'shared-vault-data', id: 's1', data: {title: 'Codice app', fields: [{valueEnc: 'vietato'}]}},
    {scope: 'shared-vault-data-link', sharedDataId: 's1', id: 'l1', data: {label: 'Collegamento Legal Mail'}}
  ]);
  assert.deepEqual(descriptions, [
    'Portale', 'Domande — Portale', 'Azienda Alfa', 'PEC — Azienda Alfa',
    'Referente — PEC', 'Codice app', 'Collegamento Legal Mail'
  ]);
  assert.equal(descriptions.join(' ').includes('segreto'), false);
  assert.equal(descriptions.join(' ').includes('vietato'), false);
});
