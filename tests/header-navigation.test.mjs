import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/components-v129.js', import.meta.url), 'utf8');

test('il dettaglio scadenza torna sempre al contenitore Scadenze', () => {
  assert.match(
    source,
    /path\.endsWith\('dettaglio_scadenza\.html'\)[\s\S]*?fallbackHref = 'scadenze\.html';[\s\S]*?preferHistory = false;/
  );
});
