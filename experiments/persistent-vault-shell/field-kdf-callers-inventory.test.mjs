import test from 'node:test';
import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import {resolve, relative} from 'node:path';

const root = resolve('Frontend/public/assets/js');
async function files(dir) {
  const entries = await readdir(dir, {withFileTypes: true}), result = [];
  for (const entry of entries) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) result.push(...await files(path));
    else if (entry.isFile() && entry.name.endsWith('.js')) result.push(path);
  }
  return result;
}

const expectedWriters = [
  'modules/azienda/account_azienda.js', 'modules/azienda/dati_azienda.js', 'modules/azienda/form-azienda-save.js',
  'modules/azienda/form_account_azienda.js', 'modules/azienda/ma_save.js', 'modules/data/account-widget-client.js',
  'modules/data/shared-vault-data-client.js', 'modules/home/home.js', 'modules/privato/account_privati.js',
  'modules/privato/area_privata.js', 'modules/privato/form-privato-save.js', 'modules/privato/form_account_privato.js',
  'modules/privato/profilo-actions.js', 'modules/privato/profilo-links.js', 'modules/privato/profilo-sync.js',
  'modules/privato/profilo-widgets.js', 'modules/privato/profilo_privato.js', 'modules/settings/account-field-usage-service.js',
  'modules/settings/archive-account-service.js', 'modules/settings/credential-health-service.js',
  'modules/settings/impostazioni.js', 'modules/settings/shared-credentials-controller.js',
  'modules/shared/account-embedded-widgets.js', 'modules/shared/account-note-editor.js',
  'modules/shared/account-shared-credentials.js', 'modules/shared/card-secret.js'
].sort();

test('all field encrypt/decrypt writers cross the single security-manager boundary', async () => {
  const writers = [], directRaw = [];
  for (const path of await files(root)) {
    const source = await readFile(path, 'utf8'), name = relative(root, path).replaceAll('\\', '/');
    for (const match of source.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
      const imported = match[1].split(',').map(item => item.trim().split(/\s+as\s+/)[0]);
      if (!imported.some(item => item === 'encrypt' || item === 'decrypt')) continue;
      if (match[2].endsWith('/core/security-manager.js') || match[2] === './core/security-manager.js') writers.push(name);
      if (match[2].endsWith('crypto-utils.js') && name !== 'modules/core/security-manager.js') directRaw.push(name);
    }
  }
  assert.deepEqual([...new Set(writers)].sort(), expectedWriters);
  assert.deepEqual(directRaw, []);
});
