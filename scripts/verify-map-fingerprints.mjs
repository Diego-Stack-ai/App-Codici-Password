import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const oidPattern = /^(?:[0-9a-f]{40}|[0-9a-f]{64})$/;
const hashPattern = /^[0-9a-f]{64}$/;
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], {
  maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe']
});

// sourceSha256 remains original provenance; canonical checks never normalize bytes.
function legacyClass(blob, expected) {
  if (sha256(blob) === expected) return 'RAW';
  const crlf = blob.toString('utf8').replace(/\r\n/g, '\n').replace(/\n/g, '\r\n');
  return sha256(Buffer.from(crlf, 'utf8')) === expected ? 'CRLF' : 'OTHER';
}

export async function verifyMapFingerprints(root = defaultRoot) {
  const result = { errors: [], warnings: [], sources: 0, segments: 0, targets: 0,
    canonicalOk: 0, legacy: { RAW: 0, CRLF: 0, OTHER: 0 } };
  const { errors, warnings } = result;
  let map, manifest;
  try {
    map = JSON.parse(await readFile(path.join(root, 'scripts/docs-source-map.json'), 'utf8'));
    manifest = JSON.parse(await readFile(path.join(root, 'scripts/docs-manifest.json'), 'utf8'));
  } catch (error) { errors.push(`Mappa o manifesto non leggibile: ${error.message}`); return result; }
  if (!map || typeof map !== 'object' || !manifest || typeof manifest !== 'object') {
    errors.push('Mappa e manifesto devono essere oggetti.'); return result;
  }
  result.base = map.baseline;
  if (typeof map.baseline !== 'string' || !oidPattern.test(map.baseline)) errors.push('baseline non valida.');
  if (map.hashAlgorithm !== 'sha256') errors.push('hashAlgorithm deve essere sha256.');
  if (map.hashInput !== 'git-blob-bytes') errors.push('hashInput deve essere git-blob-bytes.');
  if (!Array.isArray(map.segments) || !map.segments.length) errors.push('segments mancanti.');
  if (!Number.isInteger(map.sourceFiles) || map.sourceFiles < 1) errors.push('sourceFiles non valido.');
  const allowed = manifest.paths;
  if (!Array.isArray(allowed) || !allowed.length || allowed.some(p => typeof p !== 'string') ||
      new Set(allowed).size !== allowed.length) errors.push('Manifesto senza percorsi univoci validi.');
  if (!Number.isInteger(map.targetFiles) || map.targetFiles !== allowed?.length) errors.push('targetFiles diverso dal manifesto.');
  if (errors.length) return result;
  try { git(root, 'cat-file', '-e', `${map.baseline}^{commit}`); }
  catch { errors.push('baseline non leggibile come commit Git.'); return result; }

  const bySource = new Map();
  const targets = new Set();
  for (const [index, s] of map.segments.entries()) {
    if (!s || typeof s !== 'object') { errors.push(`segments[${index}] non valido.`); continue; }
    if (typeof s.source !== 'string' || !s.source || typeof s.target !== 'string' ||
        typeof s.anchor !== 'string' || !s.anchor) { errors.push(`segments[${index}] senza percorsi/ancora.`); continue; }
    if (!allowed.includes(s.target)) errors.push(`${s.source}: target fuori manifesto.`);
    targets.add(s.target);
    if (!Number.isInteger(s.startLine) || !Number.isInteger(s.endLine) || s.startLine < 1 || s.endLine < s.startLine)
      errors.push(`${s.source}: intervallo non valido.`);
    if (!hashPattern.test(s.sourceSha256 || '')) errors.push(`${s.source}: sourceSha256 non valido.`);
    if (!hashPattern.test(s.sourceSha256Bytes || '')) errors.push(`${s.source}: sourceSha256Bytes non valido.`);
    if (!oidPattern.test(s.sourceBlob || '')) errors.push(`${s.source}: sourceBlob non valido.`);
    if (!bySource.has(s.source)) bySource.set(s.source, []);
    bySource.get(s.source).push(s);
  }
  result.sources = bySource.size;
  result.segments = map.segments.length;
  result.targets = targets.size;
  if (map.sourceFiles !== result.sources) errors.push(`sourceFiles=${map.sourceFiles}, sorgenti=${result.sources}.`);
  // Some manifest documents are new governance files and have no migrated source.
  for (const [source, sections] of bySource) {
    const first = sections[0];
    for (const s of sections) for (const field of ['sourceBlob', 'sourceSha256Bytes', 'sourceSha256']) {
      if (s[field] !== first[field]) errors.push(`${source}: ${field} incoerente fra segmenti.`);
    }
    let nextLine = 1;
    for (const s of [...sections].sort((a, b) => a.startLine - b.startLine)) {
      if (s.startLine !== nextLine) errors.push(`${source}: copertura non contigua (attesa riga ${nextLine}).`);
      nextLine = s.endLine + 1;
    }
    let blob, oid;
    try {
      oid = git(root, 'rev-parse', `${map.baseline}:${source}`).toString('utf8').trim();
      blob = git(root, 'cat-file', 'blob', oid);
    } catch { errors.push(`${source}: sorgente non leggibile alla base.`); continue; }
    const text = blob.toString('utf8');
    const lines = text ? text.split('\n').length - (text.endsWith('\n') ? 1 : 0) : 0;
    if (nextLine - 1 !== lines) errors.push(`${source}: copertura finale ${nextLine - 1}, righe reali ${lines}.`);
    if (oid !== first.sourceBlob) errors.push(`${source}: sourceBlob diverso dall'OID Git.`);
    if (sha256(blob) !== first.sourceSha256Bytes) errors.push(`${source}: sourceSha256Bytes diverso dai byte Git.`);
    if (oid === first.sourceBlob && sha256(blob) === first.sourceSha256Bytes) result.canonicalOk += 1;
    const legacy = legacyClass(blob, first.sourceSha256);
    result.legacy[legacy] += 1;
    if (legacy === 'OTHER') warnings.push(`${source}: impronta originale OTHER; non coincide con RAW/CRLF. Consultare la provenienza in AUDIT.`);
  }
  if (result.canonicalOk !== result.sources) errors.push(`Canonicali ${result.canonicalOk}/${result.sources}: controllo incompleto.`);
  return result;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  try {
    if (args.length && (args.length !== 2 || args[0] !== '--root' || !args[1])) throw new Error('Uso: node scripts/verify-map-fingerprints.mjs [--root directory]');
    const result = await verifyMapFingerprints(args.length ? path.resolve(args[1]) : defaultRoot);
    for (const warning of result.warnings) console.warn(`WARN ${warning}`);
    for (const error of result.errors) console.error(`ERROR ${error}`);
    console.log(`Canonicali ${result.canonicalOk}/${result.sources}; segmenti ${result.segments}; target mappati ${result.targets}; legacy RAW ${result.legacy.RAW}, CRLF ${result.legacy.CRLF}, OTHER ${result.legacy.OTHER}.`);
    process.exitCode = result.errors.length ? 1 : 0;
  } catch (error) { console.error(error.message); process.exitCode = 1; }
}
