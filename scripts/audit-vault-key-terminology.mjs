import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../Frontend/public/assets/js/', import.meta.url));

async function walk(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const groups = await Promise.all(entries.map(entry => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  }));
  return groups.flat().filter(file => file.endsWith('.js'));
}

const files = await walk(root);
const sources = await Promise.all(files.map(async file => [file, await readFile(file, 'utf8')]));
const joined = sources.map(([, source]) => source).join('\n');
assert.doesNotMatch(joined, /\b_masterKey\b/, 'La variabile interna ambigua _masterKey è ricomparsa');

const findSource = suffix => sources.find(([file]) => file.endsWith(suffix))?.[1] || '';
const security = findSource(`${path.sep}core${path.sep}security-manager.js`);
assert.match(security, /let _vaultKeyMaterial = null;/, 'Il materiale Vault in RAM non usa il nome canonico');
assert.match(security, /export async function ensureVaultKeyMaterial/, 'API canonica Vault Key mancante');
assert.match(security, /export const ensureMasterKey = ensureVaultKeyMaterial;/, 'Alias di compatibilità Vault mancante');
const ambiguousNames = joined.match(/\b(?:masterKey|ensureMasterKey)\b/g) || [];
assert.deepEqual(ambiguousNames, ['ensureMasterKey'], 'Nuovi nomi masterKey ambigui introdotti fuori dall’alias compatibile');

const session = findSource(`${path.sep}core${path.sep}vault-session.js`);
assert.doesNotMatch(session, /\bmasterKey\b/, 'La sessione confonde ancora Master Password e Vault Key');
assert.match(session, /saveVaultSession\(vaultKeyMaterial, uid/, 'La sessione non dichiara il materiale Vault correttamente');
console.log('Audit terminologia Vault superato; non certifica la sicurezza della persistenza di sessione.');
