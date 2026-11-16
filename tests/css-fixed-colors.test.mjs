import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {auditFixedColors} from '../scripts/audit-fixed-colors.mjs';

// Giro completo dei temi (#313): nessun colore fisso decorativo nelle regole di stile,
// comprese quelle delle viste generate dopo un clic.
test('every fixed chromatic color in the stylesheets is a decided exception', async () => {
  const found = await auditFixedColors();
  const open = found.filter(item => !item.exception);
  assert.deepEqual(open.map(item => `${item.file}:${item.line} ${item.selector} { ${item.prop}: ${item.value} }`), [], 'fixed decorative colors must use the palette roles');
  assert.ok(found.length > 0 && found.length <= 80, `exceptions stay a short reviewed list (${found.length})`);
});

test('the audit catches a new fixed decorative color and accepts a delete command', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'fixed-colors-'));
  try {
    await writeFile(path.join(dir, 'sample.css'), '.new-widget { color: #3b82f6; }\n.btn-delete-row { color: #ef4444; }\n.grey { color: #94a3b8; border: 1px solid rgba(var(--accent-rgb), 0.3); }\n:root { --accent: #137fec; }\n');
    const found = await auditFixedColors(dir);
    assert.deepEqual(found.map(item => [item.selector, item.exception]), [['.new-widget', null], ['.btn-delete-row', 'comandi che cancellano o fanno uscire']]);
  } finally { await rm(dir, {recursive: true, force: true}); }
});
