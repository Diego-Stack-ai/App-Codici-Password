import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { isOfflineExcluded } from '../scripts/offline-asset-policy.mjs';

test('offline policy excludes the complete preview directory without excluding app resources', () => {
  for (const file of ['ui-preview/index.html', 'ui-preview/ui-prove/profilo.html', 'ui-preview/ui-prove/base.css']) {
    assert.equal(isOfflineExcluded(file), true, file);
  }
  for (const file of ['profilo_privato.html', 'dati_azienda.html', 'assets/css/ui-preview.css', 'ui-preview-other.css']) {
    assert.equal(isOfflineExcluded(file), false, file);
  }
});

test('generated app shell omits preview assets while their public entry remains available', async () => {
  const publicRoot = new URL('../Frontend/public/', import.meta.url);
  const source = await readFile(new URL('offline-assets.js', publicRoot), 'utf8');
  const assets = JSON.parse(source.match(/=\s*(\[[\s\S]*\]);?\s*$/)[1]);
  assert.ok(assets.length >= 150);
  assert.deepEqual(assets.filter(isOfflineExcluded), []);
  assert.ok(assets.includes('profilo_privato.html'));
  assert.ok(assets.includes('dati_azienda.html'));
  const preview = await readFile(new URL('ui-preview/ui-prove/index.html', publicRoot), 'utf8');
  assert.match(preview, /profilo\.html/);
});
