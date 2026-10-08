import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { verifyMapFingerprints } from '../scripts/verify-map-fingerprints.mjs';

const script = fileURLToPath(new URL('../scripts/verify-map-fingerprints.mjs', import.meta.url));
const sha256 = value => createHash('sha256').update(value).digest('hex');

async function fixture(t) {
  const parent = path.resolve(os.tmpdir());
  const root = await mkdtemp(path.join(parent, 'codex-map-test-'));
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(root)), parent);
    assert.ok(path.basename(root).startsWith('codex-map-test-'));
    await rm(root, { recursive: true, force: true });
  });
  await mkdir(path.join(root, 'scripts'));
  await mkdir(path.join(root, 'empty-template'));
  await writeFile(path.join(root, 'a.txt'), '# A\n\nTesto A.\n');
  await writeFile(path.join(root, 'b.txt'), '# B\n\nTesto B.\n');
  const git = (...args) => execFileSync('git', ['-C', root, '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { stdio: ['ignore', 'pipe', 'pipe'] });
  git('init', '-q', '--template=empty-template');
  git('add', 'a.txt', 'b.txt');
  git('-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.invalid', 'commit', '-q', '-m', 'base sintetica');
  const baseline = git('rev-parse', 'HEAD').toString().trim();
  const segments = ['a.txt', 'b.txt'].map((source, i) => {
    const sourceBlob = git('rev-parse', `HEAD:${source}`).toString().trim();
    const blob = git('cat-file', 'blob', sourceBlob);
    return { source, target: `target-${i}.md`, anchor: `source-${i}`, startLine: 1, endLine: 3,
      sourceBlob, sourceSha256Bytes: sha256(blob), sourceSha256: sha256(blob.toString().replace(/\n/g, '\r\n')) };
  });
  const map = { baseline, sourceFiles: 2, targetFiles: 3, hashAlgorithm: 'sha256', hashInput: 'git-blob-bytes', segments };
  await writeFile(path.join(root, 'scripts/docs-manifest.json'), JSON.stringify({ paths: ['target-0.md', 'target-1.md', 'new-governance.md'] }));
  const run = async mutate => {
    const candidate = structuredClone(map);
    mutate?.(candidate);
    await writeFile(path.join(root, 'scripts/docs-source-map.json'), JSON.stringify(candidate));
    return verifyMapFingerprints(root);
  };
  return { root, run };
}

test('Git reale: OID/byte verificati, target mappati sottoinsieme del manifesto', async t => {
  const f = await fixture(t), r = await f.run();
  assert.deepEqual(r.errors, []);
  assert.equal(r.sources, 2); assert.equal(r.targets, 2); assert.equal(r.canonicalOk, 2);
  assert.equal(r.legacy.CRLF, 2);
});

test('OTHER è provenienza non risolta dal confronto RAW/CRLF, non falso errore canonico', async t => {
  const f = await fixture(t), r = await f.run(m => { m.segments[0].sourceSha256 = 'e'.repeat(64); });
  assert.deepEqual(r.errors, []); assert.equal(r.legacy.OTHER, 1); assert.equal(r.warnings.length, 1);
});

test('metadati canonici assenti, OID errato e hash errato vengono respinti', async t => {
  const f = await fixture(t);
  for (const [field, value] of [['sourceBlob', 'f'.repeat(40)], ['sourceSha256Bytes', '0'.repeat(64)], ['sourceSha256Bytes', undefined]]) {
    const r = await f.run(m => { m.segments[0][field] = value; });
    assert.ok(r.errors.some(e => e.includes(field)));
  }
});

test('sorgente divisa valida; legacy discordante e sovrapposizione respinti', async t => {
  const f = await fixture(t);
  const split = m => { m.segments.push({ ...m.segments[0], startLine: 2, endLine: 3, anchor: 'second' }); m.segments[0].endLine = 1; };
  assert.deepEqual((await f.run(split)).errors, []);
  const inconsistent = await f.run(m => { split(m); m.segments[2].sourceSha256 = 'd'.repeat(64); });
  assert.ok(inconsistent.errors.some(e => e.includes('sourceSha256 incoerente')));
  const overlap = await f.run(m => { split(m); m.segments[2].startLine = 1; });
  assert.ok(overlap.errors.some(e => e.includes('copertura non contigua')));
});

test('buchi iniziale, intermedio e finale, oltre fine e intervalli invalidi respinti', async t => {
  const f = await fixture(t);
  const mutations = [m => { m.segments[0].startLine = 2; }, m => { m.segments[0].endLine = 2; },
    m => { m.segments[0].endLine = 9; }, m => { m.segments[0].startLine = 0; },
    m => { m.segments[0].endLine = 1; m.segments.push({ ...m.segments[0], startLine: 3, endLine: 3 }); }];
  for (const mutate of mutations) assert.ok((await f.run(mutate)).errors.length);
});

test('base inesistente, sorgente assente, schema e conteggi non coerenti respinti', async t => {
  const f = await fixture(t);
  for (const mutate of [m => { m.baseline = '1'.repeat(40); }, m => { m.segments[0].source = 'missing.txt'; },
    m => { delete m.hashAlgorithm; }, m => { delete m.hashInput; }, m => { delete m.sourceFiles; },
    m => { m.sourceFiles = 71; }, m => { m.targetFiles = 2; }, m => { m.segments[0].target = 'outside.md'; },
    m => { m.segments[0] = null; }]) assert.ok((await f.run(mutate)).errors.length);
});

test('CLI: exit 0 canonico e exit 1 sul tampering, nessun override MAP_BASE', async t => {
  const f = await fixture(t); await f.run();
  const run = () => spawnSync(process.execPath, [script, '--root', f.root], { encoding: 'utf8', env: { ...process.env, MAP_BASE: '1'.repeat(40) } });
  assert.equal(run().status, 0);
  await f.run(m => { m.segments[0].sourceSha256Bytes = '0'.repeat(64); });
  assert.equal(run().status, 1);
});
