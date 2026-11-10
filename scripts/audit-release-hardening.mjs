import {effectiveHostingHeaders, FRAME_CHILD_PATHS} from './lib/hosting-frame-headers.mjs';
import assert from 'node:assert/strict';
import {existsSync, readFileSync, readdirSync} from 'node:fs';

const read = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const firebase = JSON.parse(read('firebase.json'));
const functions = read('functions/index.js');
const firestore = read('firestore.rules');
const storage = read('storage.rules');
const packageLock = JSON.parse(read('package-lock.json'));
const deployWorkflow = read('.github/workflows/firebase-deploy.yml');
const secretWorkflow = read('.github/workflows/secret-scan.yml');
const securityPolicy = read('SECURITY.md');
const offlineBuilder = read('scripts/build-offline-runtime.mjs');
const workflowDirectory = new URL('../.github/workflows/', import.meta.url);
const workflows = readdirSync(workflowDirectory)
  .filter(name => /\.ya?ml$/i.test(name))
  .map(name => ({name, source: read(`.github/workflows/${name}`)}));

const headers = Object.entries(effectiveHostingHeaders(firebase.hosting, '/')).map(([key, value]) => ({key, value}));
const header = name => headers.find(item => item.key.toLowerCase() === name.toLowerCase())?.value;
const csp = header('Content-Security-Policy') ?? '';

assert.equal(header('X-Frame-Options'), 'DENY', 'X-Frame-Options deve negare il framing');
assert.equal(header('X-Content-Type-Options'), 'nosniff', 'X-Content-Type-Options mancante');
assert.match(csp, /frame-ancestors 'none'/, 'CSP frame-ancestors mancante');
const scriptPolicy = csp.match(/(?:^|;)\s*script-src\s+([^;]+)/)?.[1] ?? '';
const scriptSources = new Set(scriptPolicy.trim().split(/\s+/).filter(Boolean));
assert.equal(scriptSources.has("'unsafe-eval'"), false, 'CSP non deve consentire unsafe-eval JavaScript');
assert.equal(scriptSources.has("'wasm-unsafe-eval'"), false,
  'CSP non deve conservare la compilazione WebAssembly della AI locale rimossa');
assert.doesNotMatch(scriptPolicy, /'unsafe-inline'/, 'CSP script-src non deve consentire script inline');
assert.doesNotMatch(scriptPolicy, /cdnjs\.cloudflare\.com/,
  'CSP non deve autorizzare CDN di script non usate dall applicazione');
assert.match(csp, /(?:^|;)\s*object-src 'none'/, 'CSP object-src deve negare i plugin');
assert.match(csp, /(?:^|;)\s*base-uri 'self'/, 'CSP base-uri deve essere confinata');
assert.match(csp, /(?:^|;)\s*form-action 'self'/, 'CSP form-action deve essere confinata');
for (const path of ['/', '/home', '/app.html', '/profilo_privato.html/', ...FRAME_CHILD_PATHS]) {
  const value = effectiveHostingHeaders(firebase.hosting, path);
  const child = FRAME_CHILD_PATHS.includes(path);
  assert.equal(value['x-frame-options'], child ? 'SAMEORIGIN' : 'DENY', path);
  assert.match(value['content-security-policy'], child ? /frame-ancestors 'self';/ : /frame-ancestors 'none';/, path);
  const sources = value['content-security-policy'].match(/frame-src ([^;]+)/)[1].split(/\s+/);
  assert.equal(sources.includes("'self'"), path === '/app.html', path);
}
assert.match(firestore, /request\.auth\.uid/, 'Firestore Rules senza vincolo UID');
assert.match(storage, /request\.auth\.uid/, 'Storage Rules senza vincolo UID');
assert.equal(packageLock.lockfileVersion >= 3, true, 'package-lock obsoleto');
assert.equal(existsSync(new URL('../Frontend/public/assets/js/app-env.js', import.meta.url)), true,
  'Il runtime deve usare il nome stabile app-env.js');
const legacyEnvPath = new URL('../Frontend/public/assets/js/env-v126.js', import.meta.url);
assert.equal(existsSync(legacyEnvPath), true,
  'L alias env-v126.js deve restare disponibile per i client precedenti');
const legacyEnv = read('Frontend/public/assets/js/env-v126.js');
assert.match(legacyEnv, /export \{APP_ENV, APP_VERSION\} from '\.\/app-env\.js';/,
  'L alias env-v126.js deve riesportare soltanto il runtime canonico');
assert.equal((legacyEnv.match(/\bexport\b/g) ?? []).length, 1,
  'L alias env-v126.js non deve contenere runtime paralleli');

const redirects = firebase.hosting?.redirects ?? [];
assert.deepEqual(
  redirects.find(item => item.source === '/login-v115.html'),
  {source: '/login-v115.html', destination: '/login.html', type: 302},
  'La vecchia URL di login deve restare compatibile e reversibile durante la finestra di rollback'
);
const rewrites = firebase.hosting?.rewrites ?? [];
assert.equal(rewrites.some(item => item.source === '**'), false,
  'Il catch-all non deve trasformare asset o rotte inesistenti nella pagina di login');
assert.equal(firebase.functions?.[0]?.ignore?.includes('**/*-lab.js'), true,
  'I prototipi *-lab.js devono restare esclusi dal pacchetto Functions');
assert.equal(firebase.hosting?.ignore?.includes('assets/local-ai-packages/**'), true,
  'I pacchetti AI rimossi devono essere esclusi sia dal manifest sia da Hosting');
assert.match(offlineBuilder, /relativePath\.startsWith\('assets\/local-ai-packages\/'\)/,
  'I pacchetti AI rimossi devono restare esclusi anche dalla shell offline');
assert.match(offlineBuilder, /'release-manifest\.json'/,
  'Il manifest auto-descrittivo non deve entrare nella shell offline');
assert.match(deployWorkflow, /release-manifest\.mjs --write[\s\S]*--require-clean/,
  'Il workflow deve generare un manifest da un sorgente pulito');
assert.match(deployWorkflow, /prepare-gitleaks-config\.mjs[\s\S]*gitleaks\/gitleaks-action@[a-f0-9]{40}/,
  'Il workflow di rilascio deve includere direttamente la scansione segreti reale');
assert.match(deployWorkflow,
  /name: Verify historical credential status before release scan\s+if: github\.event_name == 'workflow_dispatch'\s+run: node scripts\/verify-historical-credential-status\.mjs[\s\S]*?name: Scan release commits for secrets/,
  'Il rilascio manuale deve verificare lo stato provider prima della scansione storica');
assert.match(deployWorkflow,
  /name: Verify historical credential status before publication\s+run: node scripts\/verify-historical-credential-status\.mjs[\s\S]*?name: Recheck master and deploy Hosting only/,
  'Lo stato provider deve essere ricontrollato prima della pubblicazione Hosting');
assert.match(deployWorkflow, /release-manifest\.mjs[\s\S]*?--verify-url/,
  'Il workflow deve verificare manifest e asset dopo il deploy');
assert.match(deployWorkflow,
  /name: Recheck master and deploy Hosting only[\s\S]*?git ls-remote origin refs\/heads\/master[\s\S]*?test "\$GITHUB_SHA" = "\$remote_master"[\s\S]*?firebase\.js deploy/,
  'Il workflow deve ricontrollare master immediatamente prima del deploy');
const releaseManifestHeaders = firebase.hosting?.headers?.find(
  item => item.source === '/release-manifest.json'
)?.headers ?? [];
assert.equal(
  releaseManifestHeaders.find(item => item.key === 'Cache-Control')?.value,
  'no-cache, no-store, must-revalidate',
  'Il manifest di rilascio deve evitare copie CDN obsolete'
);
assert.match(secretWorkflow, /gitleaks\/gitleaks-action@[a-f0-9]{40}/,
  'Gitleaks deve essere bloccato a un commit verificabile');
assert.match(secretWorkflow, /prepare-gitleaks-config\.mjs/,
  'Il workflow deve validare la chiave Firebase web pubblica prima della scansione');
assert.doesNotMatch(secretWorkflow, /pull_request_target/,
  'La scansione segreti non deve eseguire codice non fidato con pull_request_target');
assert.match(securityPolicy, /GitHub Security Advisories/,
  'SECURITY.md deve indicare un canale privato per le vulnerabilita');
for (const workflow of workflows) {
  for (const match of workflow.source.matchAll(/\buses:\s*([^\s#]+)/g)) {
    assert.match(match[1], /@[a-f0-9]{40}$/,
      `${workflow.name}: ogni Action deve essere fissata a un commit SHA`);
  }
}

const callables = [...functions.matchAll(/exports\.([A-Za-z0-9_]+)\s*=\s*onCall\s*\(/g)].map(match => ({name: match[1], offset: match.index}));
for (const callable of callables) {
  const declaration = functions.slice(callable.offset, callable.offset + 240);
  assert.match(declaration, /enforceAppCheck:\s*true/, `${callable.name} deve imporre App Check`);
}

console.log(`Hardening statico superato: ${headers.length} header, ${callables.length} callable con App Check, Rules vincolate all'UID.`);
