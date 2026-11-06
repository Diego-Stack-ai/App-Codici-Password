import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {createHash, X509Certificate} from 'node:crypto';
import {mkdir, mkdtemp, readFile, rm, unlink, writeFile} from 'node:fs/promises';
import {test} from 'node:test';
import {rootCertificates} from 'node:tls';
import os from 'node:os';
import path from 'node:path';

import {
  buildGitleaksConfig,
  APPROVED_HISTORICAL_FINDINGS,
  EXPECTED_PUBLIC_FIREBASE_KEY_SHA256,
  PUBLIC_FIREBASE_KEY_PATHS,
  validateHistoricalFindings,
  validatePublicFirebaseKeys
} from '../scripts/prepare-gitleaks-config.mjs';
import {
  CONTROL_CERTIFICATE_URL,
  HISTORICAL_CERTIFICATE_URLS,
  verifyHistoricalCredentialStatus
} from '../scripts/verify-historical-credential-status.mjs';

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
    await removeTestDirectory(root);
  }
}

async function removeTestDirectory(directory) {
  const absolute = path.resolve(directory);
  assert.equal(path.dirname(absolute), path.resolve(os.tmpdir()));
  assert.match(path.basename(absolute), /^gitleaks-(?:config|history)-/);
  await rm(absolute, {recursive: true, force: true});
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

test('la baseline contiene soltanto i 12 fingerprint storici completi revisionati', async () => {
  const source = await readFile(new URL('../.gitleaksignore', import.meta.url), 'utf8');
  assert.deepEqual(validateHistoricalFindings(source), [...APPROVED_HISTORICAL_FINDINGS]);
  assert.equal(APPROVED_HISTORICAL_FINDINGS.filter(item => item.includes(':private-key:')).length, 2);
  assert.throws(() => validateHistoricalFindings(''), /incompleta/);
  assert.throws(() => validateHistoricalFindings(source + '\n' + APPROVED_HISTORICAL_FINDINGS[0]), /non riconosciuta/);
  assert.throws(() => validateHistoricalFindings(source.replace(APPROVED_HISTORICAL_FINDINGS[0], '.*:private-key:.*')), /non riconosciuta/);
  assert.throws(() => validateHistoricalFindings(source + '\n' +
    'a'.repeat(40) + ':src/new.js:private-key:1'), /non riconosciuta/);
  assert.throws(() => validateHistoricalFindings(source.replace(APPROVED_HISTORICAL_FINDINGS[0],
    APPROVED_HISTORICAL_FINDINGS[0].replace(/^[^:]+/, 'b'.repeat(40)))), /non riconosciuta/);
});

const publicCertificate = rootCertificates.find(pem => {
  const certificate = new X509Certificate(pem);
  return Date.parse(certificate.validFrom) <= Date.now() && Date.now() < Date.parse(certificate.validTo);
});
assert.ok(publicCertificate, 'Node deve avere almeno un certificato pubblico corrente per la fixture');
const publicCertificateMap = {['a'.repeat(40)]: publicCertificate};
const notFoundBody = {error: {code: 404, status: 'NOT_FOUND', message: 'Requested entity was not found.'}};

function providerFixture({targetStatus = 404, targetBody = notFoundBody,
  controlStatus = 200, controlBody = publicCertificateMap, mutateTarget} = {}) {
  return async (url, options) => {
    assert.equal(options.redirect, 'error');
    assert.equal(options.cache, 'no-store');
    assert.equal(options.headers['Cache-Control'], 'no-cache');
    assert.equal(options.credentials, undefined);
    assert.equal(options.method, undefined);
    assert.ok(options.signal instanceof AbortSignal);
    if (url === CONTROL_CERTIFICATE_URL) return Response.json(controlBody, {status: controlStatus});
    assert.ok(HISTORICAL_CERTIFICATE_URLS.includes(url));
    if (mutateTarget) return mutateTarget(url);
    return Response.json(targetBody, {status: targetStatus});
  };
}

test('preflight usa soltanto gli endpoint Google e le identità storica e di controllo revisionate', () => {
  assert.deepEqual(HISTORICAL_CERTIFICATE_URLS, [
    'https://www.googleapis.com/robot/v1/metadata/x509/gmail-sender%40halogen-acumen-473312-f4.iam.gserviceaccount.com',
    'https://www.googleapis.com/service_accounts/v1/metadata/x509/gmail-sender%40halogen-acumen-473312-f4.iam.gserviceaccount.com'
  ]);
  assert.equal(CONTROL_CERTIFICATE_URL,
    'https://www.googleapis.com/service_accounts/v1/metadata/x509/securetoken%40system.gserviceaccount.com');
});

test('preflight accetta soltanto due assenze Google e un controllo con certificati validi', async () => {
  const called = [];
  const fixture = providerFixture();
  const result = await verifyHistoricalCredentialStatus({fetchImpl: (url, options) => {
    called.push(url);
    return fixture(url, options);
  }});
  assert.equal(result.issuerAbsent, true);
  assert.equal(result.controlStatus, 200);
  assert.deepEqual(result.targetStatuses, [404, 404]);
  assert.deepEqual(new Set(called), new Set([CONTROL_CERTIFICATE_URL, ...HISTORICAL_CERTIFICATE_URLS]));
});

test('preflight blocca account ricomparso, permessi negati, falso 404 e risposta mista', async () => {
  for (const config of [
    {targetStatus: 200, targetBody: publicCertificateMap},
    {targetStatus: 403},
    {targetBody: {error: {code: 404, status: 'UNKNOWN', message: 'Requested entity was not found.'}}},
    {targetBody: {error: {code: 403, status: 'NOT_FOUND', message: 'Requested entity was not found.'}}},
    {targetBody: {}},
    {mutateTarget: url => url === HISTORICAL_CERTIFICATE_URLS[0]
      ? Response.json(notFoundBody, {status: 404}) : Response.json(publicCertificateMap)}
  ]) {
    await assert.rejects(verifyHistoricalCredentialStatus({fetchImpl: providerFixture(config)}),
      /HISTORICAL_CREDENTIAL_ISSUER_ABSENCE_NOT_CONFIRMED/);
  }
});

test('preflight blocca controllo negato, vuoto, malformato o scaduto', async () => {
  for (const config of [
    {controlStatus: 403}, {controlBody: {}}, {controlBody: []},
    {controlBody: {['a'.repeat(40)]: 'not-a-certificate'}},
    {controlBody: {notAKeyId: publicCertificate}}
  ]) {
    await assert.rejects(verifyHistoricalCredentialStatus({fetchImpl: providerFixture(config)}),
      /HISTORICAL_CREDENTIAL_CONTROL_FAILED/);
  }
  await assert.rejects(verifyHistoricalCredentialStatus({fetchImpl: providerFixture(),
    now: Date.parse(new X509Certificate(publicCertificate).validTo) + 1}),
  /HISTORICAL_CREDENTIAL_CONTROL_FAILED/);
});

test('preflight fallisce chiuso su rete, JSON non valido e timeout senza stampare la risposta', async () => {
  for (const fetchImpl of [
    async () => { throw new Error('uncontrolled response'); },
    async () => new Response('<html>proxy 404</html>', {status: 404}),
    (_url, {signal}) => new Promise((_resolve, reject) => {
      signal.addEventListener('abort', () => reject(new Error('timeout')), {once: true});
    })
  ]) {
    await assert.rejects(verifyHistoricalCredentialStatus({fetchImpl, timeoutMs: 10}), error => {
      assert.equal(error.message, 'HISTORICAL_CREDENTIAL_STATUS_UNAVAILABLE');
      return true;
    });
  }
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

test('una eccezione storica esatta non nasconde la stessa chiave in un nuovo commit o percorso', {
  skip: gitleaks ? false : 'Gitleaks 8.30.1 non installato'
}, async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'gitleaks-history-'));
  try {
    const git = (...args) => {
      const result = spawnSync('git', ['-c', 'core.hooksPath=.git/no-hooks', '-c', 'commit.gpgSign=false',
        '-c', 'user.name=Synthetic Gitleaks QA', '-c', 'user.email=qa-synthetic@example.invalid', ...args],
      {cwd: root, encoding: 'utf8'});
      assert.equal(result.status, 0, result.stderr || result.stdout);
      return result.stdout.trim();
    };
    git('init', '--initial-branch=main');
    git('config', 'core.autocrlf', 'false');
    await mkdir(path.join(root, 'src'));
    const relative = 'src/synthetic-private-key.js';
    const source = ['-----BEGIN ' + 'PRIVATE KEY-----',
      'VGhpcyBlIHVuYSBjaGlhdmUgc2ludGV0aWNhIHBlciBpIHRlc3Qu',
      '-----END ' + 'PRIVATE KEY-----', ''].join('\n');
    const configPath = path.join(root, 'gitleaks.toml');
    const reportPath = path.join(root, 'report.json');
    await writeFile(configPath, buildGitleaksConfig(syntheticPublicKey), 'utf8');
    await writeFile(path.join(root, relative), source, 'utf8');
    git('add', relative);
    git('commit', '-m', 'Synthetic historical credential');
    const scan = async expectedStatus => {
      const result = spawnSync(gitleaks, ['git', '--log-opts=--all', '--config', configPath,
        '--no-banner', '--redact', '--report-format=json', '--report-path', reportPath],
      {cwd: root, encoding: 'utf8'});
      assert.equal(result.status, expectedStatus, result.stderr || result.stdout);
      return JSON.parse(await readFile(reportPath, 'utf8'));
    };
    const initial = await scan(1);
    assert.equal(initial.length, 1);
    const historicalFingerprint = initial[0].Fingerprint;
    assert.match(historicalFingerprint, /^[a-f0-9]{40}:src\/synthetic-private-key\.js:private-key:[1-9][0-9]*$/);
    await writeFile(path.join(root, '.gitleaksignore'), historicalFingerprint + '\n', 'utf8');
    assert.deepEqual(await scan(0), []);
    await unlink(path.join(root, relative));
    git('add', relative);
    git('commit', '-m', 'Remove synthetic historical credential');
    await writeFile(path.join(root, relative), source, 'utf8');
    git('add', relative);
    git('commit', '-m', 'Reintroduce synthetic credential');
    const reintroducedCommit = git('rev-parse', 'HEAD');
    const reintroduced = await scan(1);
    assert.ok(reintroduced.some(item => item.Commit === reintroducedCommit && item.File === relative));
    assert.ok(reintroduced.every(item => item.Fingerprint !== historicalFingerprint));
    const otherPath = 'src/other-synthetic-key.js';
    await writeFile(path.join(root, otherPath), source, 'utf8');
    git('add', otherPath);
    git('commit', '-m', 'Add synthetic credential in another path');
    const anotherPath = await scan(1);
    assert.ok(anotherPath.some(item => item.File === otherPath));
    assert.ok(anotherPath.some(item => item.Commit === reintroducedCommit));
    assert.ok(anotherPath.every(item => item.Fingerprint !== historicalFingerprint));
  } finally {
    await removeTestDirectory(root);
  }
});
