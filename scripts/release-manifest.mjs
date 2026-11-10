import {effectiveHostingHeaders} from './lib/hosting-frame-headers.mjs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {mkdir, readFile, readdir, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const defaultRoot = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const manifestName = 'release-manifest.json';
const remoteRequestTimeoutMs = 15_000;
const ignoredDirectories = new Set([
  '_dev_tools',
  'graphify-out',
  'node_modules'
]);

export const CRITICAL_RELEASE_ASSETS = Object.freeze([
  'assets/js/app-env.js',
  'assets/js/components-v129.js',
  'assets/js/env-v126.js',
  'assets/js/main-v129.js',
  'assets/js/modules/assistant/documentation-catalog.json',
  'assets/js/modules/settings/impostazioni.js',
  'assets/js/private-auth-gate.js',
  'assets/js/translations.js',
  'assets/js/translations/settings.js',
  'home_page.html',
  'index.html',
  'login.html',
  'manifest.json',
  'offline-assets.js',
  'sw.js'
]);

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function toPosix(value) {
  return value.split(path.sep).join('/');
}

function git(root, args) {
  const result = spawnSync('git', args, {cwd: root, encoding: 'utf8'});
  if (result.status !== 0) {
    throw new Error(`git ${args.join(' ')}: ${(result.stderr || result.stdout || '').trim()}`);
  }
  return result.stdout.trim();
}

export function isWorktreeDirty(repoRoot = defaultRoot) {
  return Boolean(git(repoRoot, ['status', '--porcelain=v1', '--untracked-files=all']));
}

function normalizeCommit(value) {
  const commit = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commit)) {
    throw new Error(`Commit di rilascio non valido: ${value || '<vuoto>'}`);
  }
  return commit;
}

async function listFiles(root, directory = root) {
  const files = [];
  const entries = await readdir(directory, {withFileTypes: true});
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absolute = path.join(directory, entry.name);
    const relative = toPosix(path.relative(root, absolute));
    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name) || relative === 'assets/local-ai-packages') continue;
      files.push(...await listFiles(root, absolute));
      continue;
    }
    if (relative === manifestName) continue;
    files.push({absolute, relative});
  }
  return files.sort((left, right) => left.relative.localeCompare(right.relative));
}

export async function hashPublicTree(publicRoot) {
  const digest = createHash('sha256');
  const files = await listFiles(publicRoot);
  const hashes = {};
  for (const file of files) {
    const bytes = await readFile(file.absolute);
    digest.update(file.relative);
    digest.update('\0');
    digest.update(bytes);
    digest.update('\0');
    hashes[`/${file.relative}`] = sha256(bytes);
  }
  return {sha256: digest.digest('hex'), fileCount: files.length, files: hashes};
}

export async function readCanonicalVersion(repoRoot = defaultRoot) {
  const read = relative => readFile(path.join(repoRoot, relative), 'utf8');
  const pkg = JSON.parse(await read('package.json'));
  const env = await read('Frontend/public/assets/js/app-env.js');
  const home = await read('Frontend/public/home_page.html');
  const worker = await read('Frontend/public/sw.js');
  const versions = {
    package: pkg.version,
    environment: env.match(/APP_VERSION\s*=\s*'v([^']+)'/)?.[1],
    home: home.match(/data-app-version>v([^<]+)</)?.[1],
    serviceWorker: worker.match(/CACHE_NAME\s*=\s*'codex-shell-v([^']+)'/)?.[1]
  };
  const unique = new Set(Object.values(versions));
  if (unique.size !== 1 || unique.has(undefined) || !/^\d+\.\d+\.\d+$/.test(pkg.version)) {
    throw new Error(`Versioni canoniche non allineate: ${JSON.stringify(versions)}`);
  }
  return pkg.version;
}

async function readHostingContract(repoRoot = defaultRoot) {
  const firebase = JSON.parse(await readFile(path.join(repoRoot, 'firebase.json'), 'utf8'));
  const hosting = firebase.hosting;
  const manifestHeaders = hosting.headers?.find(
    item => item.source === `/${manifestName}`
  )?.headers ?? [];
  const csp = effectiveHostingHeaders(hosting, '/', {strictSecurity: false})['content-security-policy'] || '';
  const cacheControl = manifestHeaders.find(item => item.key === 'Cache-Control')?.value || '';
  const legacy = hosting.redirects?.find(item => item.source === '/login-v115.html');
  const home = hosting.rewrites?.find(item => item.source === '/home');
  if (!csp || !cacheControl || !legacy || !home) {
    throw new Error('Contratto Hosting incompleto per il rilascio attestato.');
  }
  let routeSecurityHeaders;
  if (hosting.headers.some(rule => rule.regex)) {
    const html = (await listFiles(path.join(repoRoot, 'Frontend', 'public'))).filter(file => file.relative.endsWith('.html')).map(file => '/' + file.relative);
    // Redirect middleware runs before file response headers. Its status and
    // same-origin destination are attested separately below, not as a document.
    const paths = [...new Set(['/', '/home', '/__frame_missing__.html', '/app.html/', '/profilo_privato.html/', ...html])].sort();
    routeSecurityHeaders = Object.fromEntries(paths.map(pathname => {
      const value = effectiveHostingHeaders(hosting, pathname);
      return [pathname, {cspSha256: sha256(value['content-security-policy']), xFrameOptions: value['x-frame-options'], permissionsPolicy: value['permissions-policy']}];
    }));
  }
  return {
    ...(routeSecurityHeaders ? {routeSecurityHeaders} : {}),
    contentSecurityPolicySha256: sha256(csp),
    releaseManifestCacheControl: cacheControl,
    legacyLoginRedirect: {
      status: legacy.type,
      location: legacy.destination
    },
    homeRewrite: {
      source: home.source,
      destination: home.destination
    }
  };
}

export async function buildReleaseManifest({
  repoRoot = defaultRoot,
  commit,
  sourceDirty
} = {}) {
  const publicRoot = path.join(repoRoot, 'Frontend', 'public');
  const sourceCommit = normalizeCommit(commit || git(repoRoot, ['rev-parse', 'HEAD']));
  const dirty = sourceDirty ?? isWorktreeDirty(repoRoot);
  const appVersion = await readCanonicalVersion(repoRoot);
  const hostingContract = await readHostingContract(repoRoot);
  const publicTreeResult = await hashPublicTree(publicRoot);
  const publicTree = {
    sha256: publicTreeResult.sha256,
    fileCount: publicTreeResult.fileCount
  };
  const files = publicTreeResult.files;
  const criticalAssets = {};
  for (const relative of CRITICAL_RELEASE_ASSETS) {
    const asset = `/${relative}`;
    if (!files[asset]) throw new Error(`Asset critico assente dall'albero pubblico: ${asset}`);
    criticalAssets[asset] = files[asset];
  }
  return {
    schemaVersion: 2,
    appVersion,
    sourceCommit,
    sourceDirty: dirty,
    hostingContract,
    publicTree,
    files,
    criticalAssets
  };
}

function sameManifest(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

async function writeManifest(options) {
  const manifest = await buildReleaseManifest(options);
  const destination = path.join(options.repoRoot, 'Frontend', 'public', manifestName);
  await mkdir(path.dirname(destination), {recursive: true});
  await writeFile(destination, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
  return {manifest, destination};
}

async function checkManifest(options) {
  const expected = await buildReleaseManifest(options);
  const source = await readFile(path.join(options.repoRoot, 'Frontend', 'public', manifestName), 'utf8');
  const actual = JSON.parse(source);
  if (!sameManifest(actual, expected)) {
    throw new Error('release-manifest.json non corrisponde al sorgente corrente. Rigenerarlo prima del deploy.');
  }
  return actual;
}

function verifySecurityHeaders(response, expected, pathname) {
  if (!expected) return;
  if (sha256(response.headers.get('content-security-policy') || '') !== expected.cspSha256 ||
      response.headers.get('x-frame-options') !== expected.xFrameOptions ||
      response.headers.get('permissions-policy') !== expected.permissionsPolicy) throw Error(`Header pubblici non conformi: ${pathname}`);
}
async function fetchBytes(url, security) {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: {'cache-control': 'no-cache'},
    signal: AbortSignal.timeout(remoteRequestTimeoutMs)
  });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  verifySecurityHeaders(response, security, new URL(url).pathname);
  return Buffer.from(await response.arrayBuffer());
}

async function verifyRemoteOnce(baseUrl, expected) {
  const root = baseUrl.replace(/\/$/, '');
  const nonce = Date.now();
  const manifestUrl = `${root}/${manifestName}?verify=${nonce}`;
  const manifestResponse = await fetch(manifestUrl, {
    cache: 'no-store',
    headers: {'cache-control': 'no-cache'},
    signal: AbortSignal.timeout(remoteRequestTimeoutMs)
  });
  if (!manifestResponse.ok) throw new Error(`${manifestUrl}: HTTP ${manifestResponse.status}`);
  const cacheControl = manifestResponse.headers.get('cache-control') || '';
  if (cacheControl !== expected.hostingContract.releaseManifestCacheControl) {
    throw new Error('release-manifest.json non espone la policy no-cache/no-store prevista.');
  }
  const remote = await manifestResponse.json();
  if (!sameManifest(remote, expected)) {
    throw new Error('Il manifest pubblico non corrisponde al candidato locale.');
  }

  const legacyUrl = `${root}/login-v115.html?verify=${nonce}`;
  const legacyResponse = await fetch(legacyUrl, {
    redirect: 'manual',
    cache: 'no-store',
    headers: {'cache-control': 'no-cache'},
    signal: AbortSignal.timeout(remoteRequestTimeoutMs)
  });
  const legacyLocation = legacyResponse.headers.get('location') || '';
  if (legacyResponse.status !== expected.hostingContract.legacyLoginRedirect.status
      || new URL(legacyLocation, `${root}/`).origin !== new URL(root).origin
      || new URL(legacyLocation, `${root}/`).pathname
        !== expected.hostingContract.legacyLoginRedirect.location) {
    throw new Error('Il redirect pubblico login-v115.html -> login.html non e quello atteso.');
  }

  const rootUrl = `${root}/?verify=${nonce}`;
  const rootResponse = await fetch(rootUrl, {
    cache: 'no-store',
    headers: {'cache-control': 'no-cache'},
    signal: AbortSignal.timeout(remoteRequestTimeoutMs)
  });
  if (!rootResponse.ok) throw new Error(`${rootUrl}: HTTP ${rootResponse.status}`);
  verifySecurityHeaders(rootResponse, expected.hostingContract.routeSecurityHeaders?.['/'], '/');
  const csp = rootResponse.headers.get('content-security-policy') || '';
  if (sha256(csp) !== expected.hostingContract.contentSecurityPolicySha256) {
    throw new Error('La CSP pubblica non corrisponde alla configurazione attestata.');
  }
  const indexBytes = Buffer.from(await rootResponse.arrayBuffer());
  if (sha256(indexBytes) !== expected.files['/index.html']) {
    throw new Error('La route pubblica / non corrisponde a index.html.');
  }

  const homeBytes = await fetchBytes(`${root}${expected.hostingContract.homeRewrite.source}?verify=${nonce}`, expected.hostingContract.routeSecurityHeaders?.['/home']);
  if (sha256(homeBytes) !== expected.files[expected.hostingContract.homeRewrite.destination]) {
    throw new Error('La rewrite pubblica /home non corrisponde a home_page.html.');
  }

  const assets = Object.entries(expected.files);
  let cursor = 0;
  const verifyNext = async () => {
    while (cursor < assets.length) {
      const [asset, expectedHash] = assets[cursor];
      cursor += 1;
      const url = new URL(asset, `${root}/`);
      url.searchParams.set('verify', String(nonce));
      const bytes = await fetchBytes(url, expected.hostingContract.routeSecurityHeaders?.[asset]);
      if (sha256(bytes) !== expectedHash) throw new Error(`Hash pubblico non valido: ${asset}`);
    }
  };
  const workers = await Promise.allSettled(
    Array.from({length: Math.min(8, assets.length)}, verifyNext)
  );
  const failed = workers.find(result => result.status === 'rejected');
  if (failed) throw failed.reason;
  for (const [pathname, headers] of Object.entries(expected.hostingContract.routeSecurityHeaders || {})) {
    if (pathname === '/' || pathname === '/home' || expected.files[pathname]) continue;
    const response = await fetch(`${root}${pathname}?verify=${nonce}`, {redirect: 'manual', cache: 'no-store', signal: AbortSignal.timeout(remoteRequestTimeoutMs)});
    verifySecurityHeaders(response, headers, pathname); await response.arrayBuffer();
  }
  return remote;
}

export async function verifyRemote(baseUrl, expected, {retries = 1, delayMs = 0} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await verifyRemoteOnce(baseUrl, expected);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : '';
}

function integerOption(name, fallback) {
  const value = option(name);
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`${name}: valore non valido`);
  return parsed;
}

async function main() {
  const repoRoot = defaultRoot;
  const commit = option('--commit') || git(repoRoot, ['rev-parse', 'HEAD']);
  const options = {repoRoot, commit};
  if (process.argv.includes('--require-clean')) {
    const dirty = isWorktreeDirty(repoRoot);
    if (dirty) throw new Error('Il manifest di produzione richiede un worktree tracciato pulito.');
    options.sourceDirty = false;
  }
  if (process.argv.includes('--write')) {
    const {manifest, destination} = await writeManifest(options);
    console.log(`Manifest ${manifest.appVersion} scritto: ${destination}`);
    console.log(`Commit ${manifest.sourceCommit} · ${manifest.publicTree.fileCount} file · ${manifest.publicTree.sha256}`);
    return;
  }
  if (process.argv.includes('--check')) {
    const manifest = await checkManifest(options);
    console.log(`Manifest locale verificato: ${manifest.appVersion} @ ${manifest.sourceCommit}`);
    return;
  }
  const baseUrl = option('--verify-url');
  if (baseUrl) {
    const expected = await checkManifest(options);
    await verifyRemote(baseUrl, expected, {
      retries: integerOption('--retries', 1),
      delayMs: integerOption('--delay-ms', 1)
    });
    console.log(`Release pubblica verificata: ${expected.appVersion} @ ${expected.sourceCommit}`);
    return;
  }
  throw new Error('Usa --write, --check oppure --verify-url URL.');
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
