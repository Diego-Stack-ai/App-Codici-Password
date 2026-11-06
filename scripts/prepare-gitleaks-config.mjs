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

// Each exception identifies one immutable historical diff. A later commit,
// even at the same path and line, does not inherit the exception.
export const APPROVED_HISTORICAL_FINDINGS = Object.freeze([
  '0c8029efd813227c6820e7642549144fb32d42af:tests/fixtures/maturity-dataset.json:generic-api-key:27',
  '0c8029efd813227c6820e7642549144fb32d42af:tests/fixtures/maturity-dataset.json:generic-api-key:38',
  'bc40fe48d10ca6b41a758a2e9208927c654d614e:scripts/test-functions-emulator.mjs:jwt:6',
  'b91a76962df4ab3808e66f78801d2cdbc9538f36:Frontend/public/assets/js/modules/shared/push-manager.js:generic-api-key:6',
  'b98a751ccbbc0b67abd6eaeee9879b5588467191:Frontend/public/sw.js:gcp-api-key:8',
  'b98a751ccbbc0b67abd6eaeee9879b5588467191:Frontend/public/assets/js/modules/shared/push-manager.js:generic-api-key:6',
  '6e8ea85a5fdb9d4c6d959367e8facd8c9a81bec8:scripts_import_dati/verify_pwd.js:gcp-api-key:1',
  'cbbe0d6ebe0794e2f88b164ace58e2c5f1e320f5:Frontend/public/assets/js/modules/shared/push_manager.js:generic-api-key:11',
  '20b4e6e8db4f56aa10bade4a5336f2b3919ff91b:Frontend/public/assets/js/modules/home/setup_flusso.js:generic-api-key:182',
  '20b4e6e8db4f56aa10bade4a5336f2b3919ff91b:Frontend/public/assets/js/modules/settings/impostazioni.js:generic-api-key:461',
  'c33e735e4885c7806209947d6f976bc7aef8de18:Frontend/modifiche.txt:private-key:3167',
  '14e908ee6256825057421316ecc771092a591a70:functions/index.js:private-key:22'
]);

export function validateHistoricalFindings(source) {
  if (typeof source !== 'string') throw new Error('Baseline Gitleaks assente.');
  const findings = source.split(/\r?\n/).map(line => line.trim())
    .filter(line => line && !line.startsWith('#'));
  const approved = new Set(APPROVED_HISTORICAL_FINDINGS);
  const seen = new Set();
  for (const finding of findings) {
    if (!/^[a-f0-9]{40}:[^:\s]+:[a-z0-9-]+:[1-9][0-9]*$/.test(finding) ||
        !approved.has(finding) || seen.has(finding)) {
      throw new Error('Baseline Gitleaks non riconosciuta: revisione dei fingerprint obbligatoria.');
    }
    seen.add(finding);
  }
  if (seen.size !== approved.size) {
    throw new Error('Baseline Gitleaks incompleta: attesi soltanto i 12 reperti storici revisionati.');
  }
  return findings;
}

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
  validateHistoricalFindings(await readFile(path.join(repoRoot, '.gitleaksignore'), 'utf8'));
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
