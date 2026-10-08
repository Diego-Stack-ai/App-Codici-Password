import { readdir, readFile, lstat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const excluded = new Set(['.git', 'node_modules', '.codex-tmp', '.codex-worktrees']);
const slash = value => value.replaceAll('\\', '/');

function contentLines(text) {
  let fence = null;
  return text.split(/\r?\n/).flatMap((line, index) => {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match) {
      const mark = match[1][0];
      if (!fence) fence = { mark, length: match[1].length };
      else if (fence.mark === mark && match[1].length >= fence.length) fence = null;
      return [];
    }
    return fence ? [] : [{ line, number: index + 1 }];
  });
}

function sectionIds(text) {
  const result = new Set();
  const occurrences = new Map();
  for (const { line } of contentLines(text)) {
    for (const explicit of line.matchAll(/<a\s+id="([^"]+)"\s*>/g)) result.add(explicit[1]);
    const heading = line.match(/^#{1,6}\s+(.+?)(?:\s+#+)?$/);
    if (!heading) continue;
    const id = heading[1].replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/<[^>]*>/g, '').toLowerCase()
      .replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').replaceAll(' ', '-');
    const n = occurrences.get(id) || 0;
    occurrences.set(id, n + 1);
    result.add(id + (n ? `-${n}` : ''));
  }
  return result;
}

export async function auditDocs(root = defaultRoot, { baseline } = {}) {
  const errors = [];
  const manifestPath = path.join(root, 'scripts/docs-manifest.json');
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const allowed = manifest.paths;
  if (!Array.isArray(allowed) || allowed.length !== 31 || new Set(allowed).size !== 31)
    return { errors: ['Il manifesto deve contenere esattamente 31 percorsi univoci.'], files: 0, links: 0 };
  for (const file of allowed) {
    if (file !== slash(path.posix.normalize(file)) || path.isAbsolute(file) || file.startsWith('../') || !file.endsWith('.md'))
      errors.push(`Percorso non valido nel manifesto: ${file}`);
  }
  const found = [];
  async function walk(directory, relative = '') {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory() && excluded.has(entry.name)) continue;
      if (entry.isSymbolicLink()) {
        errors.push(`Collegamento simbolico non ammesso nella scansione documentale: ${rel}`);
        continue;
      }
      if (entry.isDirectory()) await walk(path.join(directory, entry.name), rel);
      else if (/\.(md|markdown|mdown)$/i.test(entry.name)) found.push(rel);
    }
  }
  await walk(root);
  for (const file of found) if (!allowed.includes(file)) errors.push(`MD fuori elenco (anche non versionato): ${file}`);
  for (const file of allowed) if (!found.includes(file)) errors.push(`MD mancante o rinominato: ${file}`);

  // The filesystem catches untracked and ignored additions. Git also catches
  // project files placed in directories reserved for dependencies/scratch.
  try {
    const tracked = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).split('\0').filter(Boolean);
    for (const file of tracked) {
      if (/\.(md|markdown|mdown)$/i.test(file) && file.split('/').some(part => excluded.has(part)))
        errors.push(`MD versionato in cartella riservata: ${file}`);
    }
  } catch (error) {
    // A fixture may intentionally have no Git repository. Real CLI execution
    // validates this separately through --require-git.
  }

  const documents = new Map();
  for (const file of allowed.filter(f => found.includes(f))) {
    const text = await readFile(path.join(root, file), 'utf8');
    documents.set(file, { text, ids: sectionIds(text) });
  }
  let links = 0;
  for (const [file, { text }] of documents) {
    for (const { line, number } of contentLines(text)) {
      for (const match of line.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
        const url = match[1].replace(/^<|>$/g, '');
        if (/^[a-z][\w+.-]*:/i.test(url) || url.startsWith('//')) continue;
        links++;
        let decoded;
        try { decoded = decodeURIComponent(url); } catch { errors.push(`${file}:${number}: URL non valido`); continue; }
        const hashIndex = decoded.indexOf('#');
        const targetPath = hashIndex < 0 ? decoded : decoded.slice(0, hashIndex);
        const fragment = hashIndex < 0 ? '' : decoded.slice(hashIndex + 1);
        const absolute = targetPath.startsWith('/') ? path.resolve(root, `.${targetPath}`)
          : path.resolve(path.dirname(path.join(root, file)), targetPath || path.basename(file));
        const rel = slash(path.relative(root, absolute));
        if (rel.startsWith('../') || path.isAbsolute(rel)) {
          errors.push(`${file}:${number}: riferimento fuori repository ${url}`); continue;
        }
        try { await lstat(absolute); } catch { errors.push(`${file}:${number}: destinazione mancante ${url}`); continue; }
        if (fragment && documents.has(rel) && !documents.get(rel).ids.has(fragment))
          errors.push(`${file}:${number}: sezione mancante ${url}`);
      }
    }
  }
  if (baseline) {
    if (!/^[0-9a-f]{40}$/i.test(baseline)) errors.push('La base del controllo struttura deve essere uno SHA completo.');
    else {
      try {
        const previousText = execFileSync('git', ['-C', root, 'show', `${baseline}:scripts/docs-manifest.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
        const previous = JSON.parse(previousText);
        if (JSON.stringify(previous.paths) !== JSON.stringify(allowed)) errors.push('Elenco MD cambiato rispetto alla base: necessario ordine esplicito di Diego e revisione della struttura.');
        // Use the previous version's protected list, not the list proposed by the change.
        const protectedPaths = previous.protectedFiles || [];
        for (const file of protectedPaths) {
          const old = execFileSync('git', ['-C', root, 'show', `${baseline}:${file}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
          const current = await readFile(path.join(root, file), 'utf8');
          if (old.replaceAll('\r\n', '\n') !== current.replaceAll('\r\n', '\n')) errors.push(`Controllo strutturale protetto modificato: ${file}`);
        }
      } catch (error) {
        errors.push('Impossibile verificare il manifesto/controlli alla base richiesta. Prima adozione o aggiornamento strutturale richiede revisione esplicita.');
      }
    }
  }
  return { errors, files: found.length, links };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const rootIndex = args.indexOf('--root');
  const baseIndex = args.indexOf('--base');
  const root = rootIndex < 0 ? defaultRoot : path.resolve(args[rootIndex + 1]);
  try {
    execFileSync('git', ['-C', root, 'rev-parse', '--show-toplevel'], { stdio: 'pipe' });
    const result = await auditDocs(root, { baseline: baseIndex < 0 ? undefined : args[baseIndex + 1] });
    if (result.errors.length) {
      console.error(result.errors.join('\n'));
      process.exitCode = 1;
    } else console.log(`Documentazione verificata: ${result.files} MD ammessi, ${result.links} collegamenti locali.`);
  } catch (error) {
    console.error(`Controllo documentale non completato: ${error.message}`);
    process.exitCode = 1;
  }
}
