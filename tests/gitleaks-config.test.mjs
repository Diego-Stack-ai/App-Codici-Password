import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, rm, writeFile} from 'node:fs/promises';
import {test} from 'node:test';
import os from 'node:os';
import path from 'node:path';

import {
  buildGitleaksConfig,
  EXPECTED_PUBLIC_FIREBASE_KEY_SHA256,
  PUBLIC_FIREBASE_KEY_PATHS,
  validatePublicFirebaseKeys
} from '../scripts/prepare-gitleaks-config.mjs';

const syntheticPublicKey = 'AIzaSyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p';
const syntheticHash = createHash('sha256').update(syntheticPublicKey).digest('hex');

function findGitleaks() {
  const candidates = [
    process.env.GITLEAKS_BIN,
    'gitleaks',
    process.platform === 'win32' && process.env.LOCALAPPDATA
      ? path.join(
        process.env.LOCALAPPDATA,
        'Microsoft',
        'WinGet',
        'Packages',
        'Gitleaks.Gitleaks_Microsoft.Winget.Source_8wekyb3d8bbwe',
        'gitleaks.exe'
      )
      : ''
  ].filter(Boolean);
  for (const candidate of candidates) {
    const probe = spawnSync(candidate, ['version'], {encoding: 'utf8'});
    if (probe.status !== 0) continue;
    const version = `${probe.stdout || ''}\n${probe.stderr || ''}`.trim();
    if (!/\b8\.30\.1\b/.test(version)) {
      throw new Error(`Versione Gitleaks inattesa per ${candidate}: ${version || '<vuota>'}`);
    }
    return candidate;
  }
  if (process.env.GITLEAKS_REQUIRED === '1') {
    throw new Error('Gitleaks 8.30.1 obbligatorio ma non disponibile');
  }
  return '';
}

async function runGitleaksScenario(binary, relative, source) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gitleaks-config-'));
  try {
    await mkdir(path.join(root, path.dirname(relative)), {recursive: true});
    await writeFile(path.join(root, relative), source, 'utf8');
    const configPath = path.join(root, 'gitleaks.toml');
    await writeFile(configPath, buildGitleaksConfig(syntheticPublicKey), 'utf8');
    return spawnSync(binary, [
      'dir',
      '.',
      '--config',
      configPath,
      '--no-banner',
      '--redact'
    ], {cwd: root, encoding: 'utf8'});
  } finally {
    await rm(root, {recursive: true, force: true});
  }
}

test('accetta soltanto la chiave Firebase web con fingerprint approvato', () => {
  const entries = PUBLIC_FIREBASE_KEY_PATHS.map(path => ({
    path,
    source: "const config = {apiKey: '" + syntheticPublicKey + "'};"
  }));
  assert.equal(validatePublicFirebaseKeys(entries, syntheticHash), syntheticPublicKey);
});

test('rifiuta una chiave Firebase web sostituita', () => {
  const changedKey = syntheticPublicKey.slice(0, -1) + 'X';
  const entries = PUBLIC_FIREBASE_KEY_PATHS.map(path => ({
    path,
    source: "const config = {apiKey: '" + changedKey + "'};"
  }));
  assert.throws(
    () => validatePublicFirebaseKeys(entries, syntheticHash),
    /Fingerprint/
  );
});

test('la allowlist richiede insieme regola, valore e percorso', () => {
  const config = buildGitleaksConfig(syntheticPublicKey);
  assert.match(config, /\[\[allowlists\]\]/);
  assert.match(config, /targetRules = \["gcp-api-key", "generic-api-key"\]/);
  assert.match(config, /condition = "AND"/);
  assert.match(config, /regexTarget = "secret"/);
  for (const relative of PUBLIC_FIREBASE_KEY_PATHS) {
    assert.ok(config.includes(relative.replaceAll('.', '\\.')));
  }
  assert.doesNotMatch(config, /private[_-]?key/i);
  assert.notEqual(syntheticHash, EXPECTED_PUBLIC_FIREBASE_KEY_SHA256);
});

const gitleaks = findGitleaks();
test('Gitleaks reale limita valore e percorso e continua a bloccare chiavi private', {
  skip: gitleaks ? false : 'Gitleaks 8.30.1 non installato'
}, async () => {
  const allowed = await runGitleaksScenario(
    gitleaks,
    PUBLIC_FIREBASE_KEY_PATHS[0],
    `const apiKey = '${syntheticPublicKey}';\n`
  );
  assert.equal(allowed.status, 0, allowed.stderr || allowed.stdout);

  const wrongPath = await runGitleaksScenario(
    gitleaks,
    'Frontend/public/assets/js/not-authorized.js',
    `const apiKey = '${syntheticPublicKey}';\n`
  );
  assert.equal(wrongPath.status, 1, 'la stessa chiave fuori percorso deve essere segnalata');

  const privateKey = await runGitleaksScenario(
    gitleaks,
    'src/private-key-fixture.js',
    [
      '-----BEGIN ' + 'PRIVATE KEY-----',
      'VGhpcyBlIHVuYSBjaGlhdmUgc2ludGV0aWNhIHBlciBpIHRlc3Qu',
      '-----END ' + 'PRIVATE KEY-----',
      ''
    ].join('\n')
  );
  assert.equal(privateKey.status, 1, 'una chiave privata sintetica deve essere segnalata');
});
