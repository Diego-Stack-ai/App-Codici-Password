import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile, rm, unlink, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {buildFrameHostingHeaders,effectiveHostingHeaders} from '../scripts/lib/hosting-frame-headers.mjs';
import {
  buildReleaseManifest,
  hashPublicTree,
  isWorktreeDirty,
  readCanonicalVersion,
  verifyRemote
} from '../scripts/release-manifest.mjs';

const commit = 'a'.repeat(40);
const fixtureCsp = "default-src 'self'; object-src 'none'; frame-ancestors 'none';";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'release-manifest-'));
  const publicRoot = path.join(root, 'Frontend', 'public');
  await mkdir(path.join(publicRoot, 'assets', 'js'), {recursive: true});
  await mkdir(path.join(publicRoot, 'assets', 'js', 'modules', 'assistant'), {recursive: true});
  await mkdir(path.join(publicRoot, 'assets', 'js', 'modules', 'settings'), {recursive: true});
  await mkdir(path.join(publicRoot, 'assets', 'js', 'translations'), {recursive: true});
  await writeFile(path.join(root, 'package.json'), '{"version":"1.2.259"}\n');
  await writeFile(path.join(root, 'firebase.json'), JSON.stringify({
    hosting: {
      headers: [
        {source: '/release-manifest.json', headers: [{key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate'}]},
        {source: '**', headers: [{key: 'Content-Security-Policy', value: fixtureCsp}]}
      ],
      redirects: [{source: '/login-v115.html', destination: '/login.html', type: 302}],
      rewrites: [{source: '/home', destination: '/home_page.html'}]
    }
  }, null, 2));
  await writeFile(path.join(publicRoot, 'assets', 'js', 'app-env.js'), "export const APP_VERSION = 'v1.2.259';\n");
  await writeFile(path.join(publicRoot, 'assets', 'js', 'components-v129.js'), 'export const components = true;\n');
  await writeFile(path.join(publicRoot, 'assets', 'js', 'env-v126.js'), "export {APP_VERSION} from './app-env.js';\n");
  await writeFile(path.join(publicRoot, 'assets', 'js', 'main-v129.js'), 'export const main = true;\n');
  await writeFile(path.join(publicRoot, 'assets', 'js', 'modules', 'assistant', 'documentation-catalog.json'), '{}\n');
  await writeFile(path.join(publicRoot, 'assets', 'js', 'modules', 'settings', 'impostazioni.js'), 'export const settings = true;\n');
  await writeFile(path.join(publicRoot, 'assets', 'js', 'private-auth-gate.js'), 'export const gate = true;\n');
  await writeFile(path.join(publicRoot, 'assets', 'js', 'translations.js'), 'export const translations = true;\n');
  await writeFile(path.join(publicRoot, 'assets', 'js', 'translations', 'settings.js'), 'export const settingsTranslations = true;\n');
  await writeFile(path.join(publicRoot, 'home_page.html'), '<span data-app-version>v1.2.259</span>\n');
  await writeFile(path.join(publicRoot, 'index.html'), '<title>Index</title>\n');
  await writeFile(path.join(publicRoot, 'sw.js'), "const CACHE_NAME = 'codex-shell-v1.2.259';\n");
  await writeFile(path.join(publicRoot, 'login.html'), '<title>Login</title>\n');
  await writeFile(path.join(publicRoot, 'manifest.json'), '{}\n');
  await writeFile(path.join(publicRoot, 'offline-assets.js'), 'export const assets = [];\n');
  return {root, publicRoot};
}

test('il manifest collega versione, commit, albero pubblico e asset critici', async t => {
  const {root} = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  assert.equal(await readCanonicalVersion(root), '1.2.259');
  const manifest = await buildReleaseManifest({repoRoot: root, commit, sourceDirty: false});
  assert.equal(manifest.appVersion, '1.2.259');
  assert.equal(manifest.sourceCommit, commit);
  assert.equal(manifest.sourceDirty, false);
  assert.equal(manifest.schemaVersion, 2);
  assert.equal(manifest.hostingContract.legacyLoginRedirect.location, '/login.html');
  assert.equal(manifest.publicTree.fileCount, 15);
  assert.equal(Object.keys(manifest.files).length, 15);
  assert.equal(manifest.files['/assets/js/env-v126.js'], manifest.criticalAssets['/assets/js/env-v126.js']);
  assert.deepEqual(Object.keys(manifest.criticalAssets), [
    '/assets/js/app-env.js',
    '/assets/js/components-v129.js',
    '/assets/js/env-v126.js',
    '/assets/js/main-v129.js',
    '/assets/js/modules/assistant/documentation-catalog.json',
    '/assets/js/modules/settings/impostazioni.js',
    '/assets/js/private-auth-gate.js',
    '/assets/js/translations.js',
    '/assets/js/translations/settings.js',
    '/home_page.html',
    '/index.html',
    '/login.html',
    '/manifest.json',
    '/offline-assets.js',
    '/sw.js'
  ]);
});

test('release-manifest.json non modifica il fingerprint dell’albero che descrive', async t => {
  const {root, publicRoot} = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  const before = await hashPublicTree(publicRoot);
  await writeFile(path.join(publicRoot, 'release-manifest.json'), '{"stale":true}\n');
  const after = await hashPublicTree(publicRoot);
  assert.deepEqual(after, before);
});

test('una versione canonica divergente blocca il rilascio', async t => {
  const {root, publicRoot} = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  await writeFile(path.join(publicRoot, 'sw.js'), "const CACHE_NAME = 'codex-shell-v1.2.258';\n");
  await assert.rejects(() => readCanonicalVersion(root), /Versioni canoniche non allineate/);
});

test('un file pubblico non tracciato blocca il gate di pulizia', async t => {
  const {root, publicRoot} = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  await writeFile(path.join(root, '.gitignore'), 'Frontend/public/release-manifest.json\n');
  execFileSync('git', ['init'], {cwd: root, stdio: 'ignore'});
  execFileSync('git', ['config', 'user.name', 'Release Test'], {cwd: root});
  execFileSync('git', ['config', 'user.email', 'release-test@example.invalid'], {cwd: root});
  execFileSync('git', ['add', '.'], {cwd: root});
  execFileSync('git', ['commit', '-m', 'fixture'], {cwd: root, stdio: 'ignore'});

  assert.equal(isWorktreeDirty(root), false);
  await writeFile(path.join(publicRoot, 'release-manifest.json'), '{}\n');
  assert.equal(isWorktreeDirty(root), false, 'il manifest generato e ignorato');
  await writeFile(path.join(publicRoot, 'unexpected.js'), 'console.log("unexpected");\n');
  assert.equal(isWorktreeDirty(root), true, 'un asset pubblico non tracciato deve bloccare il rilascio');
  await unlink(path.join(publicRoot, 'unexpected.js'));
  assert.equal(isWorktreeDirty(root), false);
});

test('la verifica remota copre payload, redirect, rewrite, cache e CSP', async t => {
  const {root, publicRoot} = await fixture();
  t.after(() => rm(root, {recursive: true, force: true}));
  const manifest = await buildReleaseManifest({repoRoot: root, commit, sourceDirty: false});
  let servedCsp = fixtureCsp;
  let redirectLocation = '/login.html';
  const payload = new Map();
  for (const asset of Object.keys(manifest.files)) {
    payload.set(asset, await readFile(path.join(publicRoot, asset.slice(1))));
  }
  const server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://fixture.invalid').pathname;
    if (pathname === '/release-manifest.json') {
      response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      response.setHeader('Content-Type', 'application/json');
      response.end(JSON.stringify(manifest));
      return;
    }
    if (pathname === '/login-v115.html') {
      response.statusCode = 302;
      response.setHeader('Location', redirectLocation);
      response.end();
      return;
    }
    if (pathname === '/') {
      response.setHeader('Content-Security-Policy', servedCsp);
      response.end(payload.get('/index.html'));
      return;
    }
    if (pathname === '/home') {
      response.end(payload.get('/home_page.html'));
      return;
    }
    const bytes = payload.get(pathname);
    if (!bytes) {
      response.statusCode = 404;
      response.end('missing');
      return;
    }
    response.end(bytes);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  t.after(() => new Promise(resolve => server.close(resolve)));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  await verifyRemote(baseUrl, manifest);
  redirectLocation='https://foreign.invalid/login.html';
  await assert.rejects(()=>verifyRemote(baseUrl,manifest),/redirect pubblico/);
  redirectLocation='/login.html';
  servedCsp = `${fixtureCsp} script-src 'self' 'unsafe-eval';`;
  await assert.rejects(
    () => verifyRemote(baseUrl, manifest),
    /CSP pubblica non corrisponde/
  );
});

test('the release verifier rejects selective child header drift even with identical payload hashes',async t=>{
 const {root,publicRoot}=await fixture();t.after(()=>rm(root,{recursive:true,force:true}));
 const file=path.join(root,'firebase.json'),config=JSON.parse(await readFile(file,'utf8'));
 config.hosting.headers[1].headers=[
  {key:'Content-Security-Policy',value:fixtureCsp+" frame-src https://www.google.com;"},
  {key:'Permissions-Policy',value:'camera=(self), microphone=(self)'},
  {key:'X-Frame-Options',value:'DENY'}];
 config.hosting.headers=buildFrameHostingHeaders(config.hosting);await writeFile(file,JSON.stringify(config));
 await writeFile(path.join(publicRoot,'app.html'),'<title>Frame</title>');
 const manifest=await buildReleaseManifest({repoRoot:root,commit,sourceDirty:false}),payload=new Map();
 for(const asset of Object.keys(manifest.files))payload.set(asset,await readFile(path.join(publicRoot,asset.slice(1))));
 assert.equal(manifest.hostingContract.routeSecurityHeaders['/home_page.html'].xFrameOptions,'SAMEORIGIN');
 assert.equal(manifest.hostingContract.routeSecurityHeaders['/app.html'].xFrameOptions,'DENY');
 assert.equal(manifest.hostingContract.routeSecurityHeaders['/login-v115.html'],undefined);
 let drift='';const server=createServer((request,response)=>{
  const pathname=new URL(request.url,'http://fixture.invalid').pathname;
  const headers=effectiveHostingHeaders(config.hosting,pathname);
  for(const [key,value]of Object.entries(headers))response.setHeader(key,value);
  if(pathname==='/home_page.html'&&drift)response.setHeader(drift,drift==='x-frame-options'?'DENY':fixtureCsp);
  if(pathname==='/release-manifest.json'){response.end(JSON.stringify(manifest));return;}
  if(pathname==='/login-v115.html'){response.writeHead(302,{Location:'/login.html'});response.end();return;}
  const bytes=payload.get(pathname==='/'?'/index.html':pathname==='/home'?'/home_page.html':pathname);
  if(!bytes)response.statusCode=404;response.end(bytes||'missing');
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));t.after(()=>new Promise(done=>server.close(done)));
 const baseUrl='http://127.0.0.1:'+server.address().port;await verifyRemote(baseUrl,manifest);
 for(const header of ['x-frame-options','content-security-policy']){drift=header;await assert.rejects(()=>verifyRemote(baseUrl,manifest),/Header pubblici non conformi/);}
});
