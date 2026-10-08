import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { auditDocs } from '../scripts/audit-docs.mjs';
import { writeGeneratedDocSection } from '../scripts/lib/generated-doc-section.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const original = JSON.parse(await readFile(path.join(repo, 'scripts/docs-manifest.json'), 'utf8'));
async function fixture(t) {
  const temporaryParent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(temporaryParent, 'codex-docs-test-'));
  t.after(async () => {
    const target = path.resolve(root);
    assert.equal(path.dirname(target), temporaryParent);
    assert.ok(path.basename(target).startsWith('codex-docs-test-'));
    await rm(target, { recursive: true, force: true });
  });
  for (const file of original.paths) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), '# Documento\n\n## Sezione valida\n', 'utf8');
  }
  await mkdir(path.join(root, 'scripts'), { recursive: true });
  await writeFile(path.join(root, 'scripts/docs-manifest.json'), JSON.stringify(original), 'utf8');
  return root;
}
const errors = async root => (await auditDocs(root)).errors;

test('elenco esatto valido; nuova domanda nello stesso documento non crea violazioni', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'docs/domande/M6_OFFLINE.md'), '# Domande\n\n## M6-C4\n\nStato: APERTA.\n');
  assert.deepEqual(await errors(root), []);
});

test('rifiuta nuovi MD non versionati e ignorati, anche in cartelle nuove', async t => {
  const root = await fixture(t);
  await mkdir(path.join(root, 'notes'));
  await writeFile(path.join(root, '.gitignore'), 'notes/\n');
  await writeFile(path.join(root, 'notes/nuovo.MD'), '# nuovo');
  assert.ok((await errors(root)).some(e => e.includes('notes/nuovo.MD')));
});

test('una rinomina a conteggio invariato viene respinta', async t => {
  const root = await fixture(t);
  await rename(path.join(root, 'docs/progetto/STATO.md'), path.join(root, 'docs/progetto/STATO-v2.md'));
  const result = await errors(root);
  assert.ok(result.some(e => e.includes('fuori elenco')));
  assert.ok(result.some(e => e.includes('mancante o rinominato')));
});

test('rifiuta un documento cancellato', async t => {
  const root = await fixture(t);
  await rm(path.join(root, 'docs/progetto/STATO.md'));
  assert.ok((await errors(root)).some(e => e.includes('mancante o rinominato')));
});

test('rileva destinazioni e ancore inesistenti, accetta ancore esplicite e Unicode', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'docs/progetto/STATO.md'), '# Stato\n\n<a id="punto-esatto"></a>\n\n## Validità\n');
  await writeFile(path.join(root, 'docs/LEGGIMI.md'), '[ok](progetto/STATO.md#punto-esatto)\n[ok](progetto/STATO.md#validit%C3%A0)\n[no](progetto/STATO.md#manca)\n[no](assente.md)\n');
  const result = await errors(root);
  assert.equal(result.length, 2);
  assert.ok(result.some(e => e.includes('sezione mancante')));
  assert.ok(result.some(e => e.includes('destinazione mancante')));
});

test('ignora esempi nei blocchi di codice senza ignorare i link del testo', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'docs/LEGGIMI.md'), '# Indice\n\n```md\n[esempio](non-esiste.md)\n```\n[vero](progetto/STATO.md#sezione-valida)\n');
  assert.deepEqual(await errors(root), []);
});

test('blocca riferimenti locali che escono dal repository', async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, 'docs/LEGGIMI.md'), '[fuori](../../esterno.md)');
  assert.ok((await errors(root)).some(e => e.includes('fuori repository')));
});

test('un manifesto con percorsi duplicati non può mascherare un file mancante', async t => {
  const root = await fixture(t);
  const changed = structuredClone(original);
  changed.paths[1] = changed.paths[0];
  await writeFile(path.join(root, 'scripts/docs-manifest.json'), JSON.stringify(changed));
  assert.ok((await errors(root)).some(e => e.includes('31 percorsi univoci')));
});

test('il confronto con la base rileva manifesto e controllo modificati', async t => {
  const root = await fixture(t);
  function git(...args) {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  }
  for (const file of original.protectedFiles.filter(f => f !== 'scripts/docs-manifest.json')) {
    await mkdir(path.dirname(path.join(root, file)), { recursive: true });
    await writeFile(path.join(root, file), 'controllo originale\n');
  }
  git('init'); git('add', '-A');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-m', 'baseline sintetica');
  const baseline = git('rev-parse', 'HEAD');
  assert.deepEqual((await auditDocs(root, { baseline })).errors, []);
  const changed = structuredClone(original);
  changed.paths[changed.paths.indexOf('docs/progetto/STATO.md')] = 'docs/progetto/ALTRO.md';
  await rename(path.join(root, 'docs/progetto/STATO.md'), path.join(root, 'docs/progetto/ALTRO.md'));
  await writeFile(path.join(root, 'scripts/docs-manifest.json'), JSON.stringify(changed));
  await writeFile(path.join(root, 'scripts/audit-docs.mjs'), 'controllo indebolito\n');
  const result = (await auditDocs(root, { baseline })).errors;
  assert.ok(result.some(e => e.includes('Elenco MD cambiato')));
  assert.ok(result.some(e => e.includes('scripts/audit-docs.mjs')));
});

test('il generatore conserva testo manuale e l’altra sezione', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'docs/evidenze/INVENTARI.md');
  const before = '# Manuale\n\nNon sovrascrivere.\n\n<!-- generated:files:start -->\nvecchio\n<!-- generated:files:end -->\n\n<!-- generated:pages:start -->\npagine invariate\n<!-- generated:pages:end -->\n';
  await writeFile(file, before);
  await writeGeneratedDocSection(file, 'files', '# Nuovo inventario\n\ncontenuto');
  const after = await readFile(file, 'utf8');
  assert.ok(after.startsWith('# Manuale\n\nNon sovrascrivere.\n\n'));
  assert.ok(after.includes('### Nuovo inventario'));
  assert.ok(after.endsWith('<!-- generated:pages:start -->\npagine invariate\n<!-- generated:pages:end -->\n'));
});

test('delimitatori mancanti o duplicati fermano il generatore senza scrivere', async t => {
  const root = await fixture(t);
  const file = path.join(root, 'docs/evidenze/INVENTARI.md');
  for (const before of ['# Senza blocchi\n', '<!-- generated:files:start -->\n<!-- generated:files:start -->\n<!-- generated:files:end -->']) {
    await writeFile(file, before);
    await assert.rejects(writeGeneratedDocSection(file, 'files', 'nuovo'), /Delimitatori/);
    assert.equal(await readFile(file, 'utf8'), before);
  }
});
