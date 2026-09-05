import assert from 'node:assert/strict';
import { access, readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const publicRoot = path.join(root, 'Frontend', 'public');
const exists = async file => access(file).then(() => true, () => false);
const walk = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async entry => {
  const target = path.join(dir, entry.name);
  return entry.isDirectory() ? walk(target) : target;
}))).flat();

const files = await walk(publicRoot);
const textFiles = files.filter(file => /\.(?:html|js|css|json)$/i.test(file));
const errors = [];

for (const file of textFiles) {
  const text = await readFile(file, 'utf8');
  const relativeFile = path.relative(publicRoot, file).replaceAll('\\', '/');
  const references = [];

  if (file.endsWith('.html')) {
    for (const match of text.matchAll(/\b(?:src|href)=["']([^"']+)["']/g)) references.push({ value: match[1], base: path.dirname(file) });
  }
  if (file.endsWith('.js')) {
    for (const match of text.matchAll(/(?:from\s*|import\s*\()["']([^"']+)["']/g)) references.push({ value: match[1], base: path.dirname(file) });
    for (const match of text.matchAll(/["'`]([A-Za-z0-9_./-]+\.html)(?:[?#][^"'`]*)?["'`]/g)) references.push({ value: match[1], base: publicRoot });
  }
  if (file.endsWith('.css')) {
    for (const match of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) references.push({ value: match[1], base: path.dirname(file) });
  }

  for (const { value: reference, base } of references) {
    if (!reference || /^(?:https?:|data:|blob:|mailto:|tel:|#|\/\/)/i.test(reference)) continue;
    const clean = reference.split(/[?#]/)[0];
    const target = clean.startsWith('/')
      ? path.join(publicRoot, clean.slice(1))
      : path.resolve(base, clean);
    if (!(await exists(target))) errors.push(`${relativeFile} -> ${reference}`);
  }
}

const forbiddenAliases = [
  'assets/js/components.js',
  'assets/js/components-v126.js',
  'assets/js/ui-core.js',
  'assets/js/env.js',
  'assets/js/db.js',
];
for (const file of textFiles) {
  const text = await readFile(file, 'utf8');
  for (const alias of forbiddenAliases) {
    assert.ok(!text.includes(alias), `${path.relative(root, file)} usa ancora l’alias rimosso ${alias}`);
  }
}

assert.deepEqual(errors, [], `Riferimenti statici inesistenti:\n${errors.join('\n')}`);
console.log(`Riferimenti statici verificati in ${textFiles.length} file: OK`);
