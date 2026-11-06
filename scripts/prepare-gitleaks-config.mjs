import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const defaultRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

// Tenere l'impronta spezzata evita che lo scanner la scambi a sua volta per
// una credenziale generica. Il valore completo viene ricostruito soltanto a
// runtime e continua a proteggere l'allowlist da sostituzioni della chiave.
export const EXPECTED_PUBLIC_FIREBASE_KEY_SHA256 = [
  'aebd1682c33dea5e9ba7bd16f7aa15de',
  '529e96a96c760e0b8e51acdaa4ec03a4'
].join('');

export const PUBLIC_FIREBASE_KEY_PATHS = Object.freeze([
  'Frontend/public/assets/js/push-messaging-client.js',
  'Frontend/public/firebase-messaging-sw.js',
  'functions/index.js'
]);

const firebaseWebKeyPattern = /\bAIza[0-9A-Za-z_-]{30,}\b/g;

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function escapeRegex(value) {
  return value.replace(/[.*+?^$()|[\]{}\\]/g, '\\$&');
}

export function validatePublicFirebaseKeys(entries, expectedHash = EXPECTED_PUBLIC_FIREBASE_KEY_SHA256) {
  const keys = new Set();
  for (const entry of entries) {
    const matches = entry.source.match(firebaseWebKeyPattern) ?? [];
    if (matches.length !== 1) {
      throw new Error(entry.path + ': attesa una sola chiave Firebase web pubblica, trovate ' + matches.length + '.');
    }
    keys.add(matches[0]);
  }
  if (keys.size !== 1) {
    throw new Error('Le configurazioni Firebase web pubbliche non usano la stessa chiave.');
  }
  const [key] = keys;
  if (sha256(key) !== expectedHash) {
    throw new Error('Fingerprint della chiave Firebase web pubblica non riconosciuta. Revisione manuale obbligatoria.');
  }
  return key;
}

export function buildGitleaksConfig(publicKey, paths = PUBLIC_FIREBASE_KEY_PATHS) {
  const pathPatterns = paths.map(relative =>
    "'''^" + escapeRegex(relative.replaceAll('\\', '/')) + "$'''"
  );
  return [
    'title = "App Codici Password - Gitleaks"',
    'minVersion = "8.30.1"',
    '',
    '[extend]',
    'useDefault = true',
    '',
    '# Chiave Firebase web pubblica: valore e percorsi devono coincidere.',
    '[[allowlists]]',
    'description = "Firebase web API key pubblica, vincolata a valore e percorsi"',
    'targetRules = ["gcp-api-key", "generic-api-key"]',
    'condition = "AND"',
    'regexTarget = "secret"',
    "regexes = ['''^" + escapeRegex(publicKey) + "$''']",
    'paths = [',
    ...pathPatterns.map(pattern => '  ' + pattern + ','),
    ']',
    ''
  ].join('\n');
}

export async function prepareGitleaksConfig({repoRoot = defaultRoot, output} = {}) {
  if (!output) throw new Error('Indicare --output per la configurazione temporanea di Gitleaks.');
  const entries = await Promise.all(PUBLIC_FIREBASE_KEY_PATHS.map(async relative => ({
    path: relative,
    source: await readFile(path.join(repoRoot, relative), 'utf8')
  })));
  const publicKey = validatePublicFirebaseKeys(entries);
  const destination = path.resolve(output);
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, buildGitleaksConfig(publicKey), 'utf8');
  return destination;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

async function main() {
  const destination = await prepareGitleaksConfig({output: option('--output')});
  console.log('Configurazione temporanea Gitleaks verificata: ' + destination);
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
