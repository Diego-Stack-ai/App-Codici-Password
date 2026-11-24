import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Real gates, IndexedDB/BroadcastChannel fence, owner, transport and logout.
// Auth/admission/material/signOut are synthetic; no Firebase traffic or secrets.
const root = resolve(fileURLToPath(new URL('../Frontend/public/', import.meta.url)));
const shell = module => `<!doctype html><html><head><link rel="stylesheet" href="/assets/css/core.css"><script src="/assets/js/private-auth-gate.js"></script><script type="module" src="/${module}"></script></head><body hidden inert>`;
const parentHtml = shell('logout-parent.mjs') + '<div data-frame-safe-area style="padding:0"></div><iframe id="vault-frame" hidden inert></iframe></body></html>';
const childHtml = shell('logout-child.mjs') + '<button id="logout">Esci</button><button id="legal">Privacy</button><button id="next">Account</button></body></html>';
const publicHtml = '<!doctype html><html><body><script>sessionStorage.setItem("fixture-public-renders",String(Number(sessionStorage.getItem("fixture-public-renders")||0)+1))</script><label>Username<input id="username"></label><button id="login" onclick="this.dataset.clicked=1">Accedi</button></body></html>';
const parentModule = `
import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
import {authSessionFence} from '/assets/js/auth-session-fence.js';
const options=window.fixtureOptions;
window.recordFixture=value=>{const log=JSON.parse(sessionStorage.getItem('fixture-log')||'[]');log.push(value);sessionStorage.setItem('fixture-log',JSON.stringify(log));};
// Model delayed/restored Auth before its callback can consult the fence. The
// real presentation guard must leave logged-out history without that callback.
if(options.pauseLoggedOutAuth && sessionStorage.getItem('codex_explicit_logout')==='1')await new Promise(()=>{});
const permit=await authSessionFence.readPermit();
window.privateAuthGate.acceptIdentity(window.privateAuthGate.begin('synthetic'),{uid:'synthetic',emailVerified:true});
const iframe=document.querySelector('iframe');
const owner=createVaultFrameOwner({window,iframe,release:'fixture',getIdentity:()=>({uid:'synthetic',epoch:'fixture'}),
 readPermit:async()=>({enabled:true,uid:'synthetic',version:1,expiresAt:Date.now()+3600000}),
 validateIdentity:async()=>authSessionFence.isLocallyAllowed(),readTimeout:async()=>720,
 unlock:async()=>{window.recordFixture({kind:'unlock'});return 'SYNTHETIC-MATERIAL';},clearMaterial:()=>window.recordFixture({kind:'clear'}),
 onState:state=>{if(state.locked)window.recordFixture({kind:'locked',reason:state.reason});}});
window.frameOwner=owner;
if(options.interrupt){
 let delegating=false;
 const facade=window.vaultFrameNavigation;
 window.vaultFrameNavigation={...facade,navigateFromChild(...args){delegating=true;try{return facade.navigateFromChild(...args);}finally{delegating=false;}}};
 const remove=iframe.remove.bind(iframe);
 iframe.remove=()=>{remove();if(delegating){window.recordFixture({kind:'synthetic-caller-detached'});throw Error('SYNTHETIC_CALLER_DETACHED');}};
}
window.recordFixture({kind:'owner-start'});
await owner.start('/home_page.html');`;
const childModule = `
import {authSessionFence} from '/assets/js/auth-session-fence.js';
import {createFrameTransport} from '/assets/js/modules/core/vault-frame-transport.mjs';
import {logoutWithCleanup} from '/assets/js/logout-session.js';
import {navigateDocument} from '/assets/js/frame-navigation.js';
await authSessionFence.readPermit();
const authAttempt=window.privateAuthGate.begin('synthetic');
window.privateAuthGate.acceptIdentity(authAttempt,{uid:'synthetic',emailVerified:true});
const client=createFrameTransport({window,release:'fixture',enabled:true});
await client.request('key');await client.whenVisible();
window.privateAuthGate.reveal(authAttempt);
document.querySelector('#logout').onclick=()=>logoutWithCleanup(async()=>{
 const denied=await authSessionFence.readPermit()===null;
 window.parent.recordFixture({kind:'sdk',denied,childHidden:document.body.hidden,childInert:document.body.inert,unlocked:window.parent.frameOwner.session.state().unlocked});
 // Concurrent real-gate invalidation must not beat the final reauth target.
 window.parent.privateAuthGate.reject();
 if(window.parent.fixtureOptions.mode==='failure')throw Error('SYNTHETIC_SIGNOUT_FAILURE');
 if(window.parent.fixtureOptions.mode==='pending')await new Promise(()=>{});
},'/login.html?reauth=sessions-revoked');
document.querySelector('#legal').onclick=()=>navigateDocument('/privacy.html',true);
document.querySelector('#next').onclick=()=>navigateDocument(location.pathname==='/home_page.html'
 ? '/area_privata.html' : location.pathname==='/area_privata.html'
 ? '/account_privati.html?type=standard' : '/impostazioni.html');
window.fixtureReady=true;`;

let server, browser, base;
test.before(async () => {
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://fixture.invalid').pathname;
    try {
      let body, type = 'text/html';
      if (pathname === '/app.html') body = new URL(req.url, 'http://fixture.invalid').searchParams.get('fixture') === 'real-app' ? await readFile(resolve(root, 'app.html')) : parentHtml;
      else if (['/home_page.html','/area_privata.html','/account_privati.html','/impostazioni.html'].includes(pathname)) body = childHtml;
      else if (['/login.html', '/privacy.html'].includes(pathname)) body = publicHtml;
      else if (pathname === '/logout-parent.mjs') {body = parentModule; type = 'text/javascript';}
      else if (pathname === '/logout-child.mjs') {body = childModule; type = 'text/javascript';}
      else {
        const file = resolve(root, '.' + pathname);
        if (!file.startsWith(root + sep)) throw Error('DENIED');
        body = await readFile(file); type = pathname.endsWith('.css') ? 'text/css' : 'text/javascript';
      }
      res.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store'}); res.end(body);
    } catch {res.writeHead(404); res.end();}
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({channel: 'chrome', headless: true});
});
test.after(async () => {await browser?.close(); await new Promise(done => server?.close(done));});

async function fixture(options) {
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith(base + '/') ? route.continue() : route.abort());
  await context.addInitScript(value => {window.fixtureOptions = value;}, options);
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {if (response.status() >= 400) errors.push(`HTTP ${response.status()} ${new URL(response.url()).pathname}`);});
  try {
    await page.goto(base + '/app.html');
    await page.waitForFunction(() => document.querySelector('iframe')?.contentWindow?.fixtureReady === true, null, {timeout: 5000});
    const child = page.frameLocator('#vault-frame');
    await child.locator('#logout').waitFor({state: 'visible', timeout: 5000});
    return {context, page, child, errors};
  } catch (error) {
    const state = await page.evaluate(() => ({pending: document.documentElement.dataset.privateAuthState,
      frame: document.querySelector('iframe')?.outerHTML, log: sessionStorage.getItem('fixture-log')}));
    await context.close();
    throw new Error(JSON.stringify({errors, state}), {cause: error});
  }
}

async function assertPublicLogin(f, path) {
  await f.page.waitForURL(base + path, {timeout: 25000});
  assert.equal(f.page.frames().length, 1);
  assert.deepEqual(await f.page.evaluate(() => ({hidden: document.body.hidden, inert: document.body.inert,
    pending: document.documentElement.dataset.privateAuthState || null})), {hidden: false, inert: false, pending: null});
  await f.page.locator('#username').fill('synthetic'); await f.page.locator('#login').click();
  assert.equal(await f.page.locator('#login').getAttribute('data-clicked'), '1');
  assert.deepEqual(f.errors, []);
}

for (const mode of ['success', 'failure', 'pending']) for (const interrupt of [false, true]) {
  test(`real child logout reaches usable top-level login: ${mode}, teardown stress ${interrupt}`, {timeout: 35000}, async () => {
    const f = await fixture({mode, interrupt});
    try {
      await f.child.locator('#logout').click();
      await assertPublicLogin(f, '/login.html?reauth=sessions-revoked');
      const log = await f.page.evaluate(() => JSON.parse(sessionStorage.getItem('fixture-log')));
      const sdk = log.find(value => value.kind === 'sdk');
      assert.deepEqual(sdk, {kind: 'sdk', denied: true, childHidden: true, childInert: true, unlocked: false});
      assert.ok(log.some(value => value.kind === 'clear'));
      assert.ok(!log.some(value => value.kind === 'synthetic-caller-detached'));
      assert.equal(await f.page.evaluate(() => sessionStorage.getItem('codex_explicit_logout')), '1');
    } finally {await f.context.close();}
  });
}

test('real child legal exit without cleanup hold remains protected during teardown stress', {timeout: 35000}, async () => {
  const f = await fixture({mode: 'success', interrupt: true});
  try {
    await f.child.locator('#legal').click(); await assertPublicLogin(f, '/privacy.html');
    const log = await f.page.evaluate(() => JSON.parse(sessionStorage.getItem('fixture-log')));
    assert.ok(log.some(value => value.kind === 'clear'));
    assert.ok(!log.some(value => value.kind === 'sdk'));
    assert.ok(!log.some(value => value.kind === 'synthetic-caller-detached'));
  } finally {await f.context.close();}
});

for (const mode of ['success', 'failure']) test('historical private documents after logout return to usable login repeatedly despite paused Auth: ' + mode, {timeout: 25000}, async () => {
  const f = await fixture({mode, interrupt: false, pauseLoggedOutAuth: true});
  try {
    for (const pathname of ['/area_privata.html','/account_privati.html','/impostazioni.html']) {
      await f.child.locator('#next').click();
      await f.page.waitForFunction(path => {
        const child = document.querySelector('iframe')?.contentWindow;
        return child?.location.pathname === path && child.fixtureReady;
      }, pathname, {timeout: 5000});
    }
    const before = await f.page.evaluate(() => JSON.parse(sessionStorage.getItem('fixture-log'))
      .filter(event => ['owner-start','unlock'].includes(event.kind)));
    assert.ok(before.some(event => event.kind === 'owner-start'));
    assert.ok(before.some(event => event.kind === 'unlock'));
    await f.child.locator('#logout').click();
    await assertPublicLogin(f, '/login.html?reauth=sessions-revoked');
    for (let traversal = 0; traversal < 3; traversal++) {
      const renders = await f.page.evaluate(() => Number(sessionStorage.getItem('fixture-public-renders')));
      await f.page.goBack({waitUntil: 'commit'});
      // A matching URL on the old login alone cannot count as a new return.
      await f.page.waitForFunction(previous => location.pathname === '/login.html' &&
        Number(sessionStorage.getItem('fixture-public-renders')) > previous, renders, {timeout: 5000});
      await assertPublicLogin(f, '/login.html');
      const after = await f.page.evaluate(() => JSON.parse(sessionStorage.getItem('fixture-log'))
        .filter(event => ['owner-start','unlock'].includes(event.kind)));
      assert.deepEqual(after, before, 'history must not start another owner or unlock');
      assert.equal(await f.page.evaluate(() => sessionStorage.getItem('codex_explicit_logout')), '1');
    }
  } finally {await f.context.close();}
});

test('ordinary pageshow while real child logout is pending keeps cleanup and final target owned by parent', {timeout: 35000}, async () => {
  const f = await fixture({mode: 'pending', interrupt: false});
  try {
    await f.child.locator('#logout').click();
    await f.page.waitForFunction(() => JSON.parse(sessionStorage.getItem('fixture-log') || '[]').some(event => event.kind === 'sdk'));
    const state = await f.page.evaluate(() => {
      window.dispatchEvent(new PageTransitionEvent('pageshow', {persisted: false}));
      return {path: location.pathname, childRetained: !!document.querySelector('iframe'),
        parentHidden: document.body.hidden, unlocked: frameOwner.session.state().unlocked};
    });
    assert.deepEqual(state, {path: '/app.html', childRetained: true, parentHidden: true, unlocked: false});
    await assertPublicLogin(f, '/login.html?reauth=sessions-revoked');
  } finally {await f.context.close();}
});


// The real shell/entry are served unchanged. Only main is synthetic: no Auth,
// admission or key material. Samples concern the DOM, not native iOS snapshots.
const realShellPath = '/app.html?fixture=real-app&route=%2Fhome_page.html';
const entryPath = '/assets/js/vault-frame-entry.js';
const guardPath = '/assets/js/private-auth-gate.js';
const startupPath = '/assets/js/vault-frame-logout-startup.js';
const mainPath = '/assets/js/main-v129.js';
function deferred() {
  let resolve;
  const promise = new Promise(done => {resolve = done;});
  return {promise, resolve};
}
async function realShellFixture({logout = true, hold = [], fail = [], disabled = false, storageDenied = false} = {}) {
  const context = await browser.newContext();
  const requests = [], gates = new Map(hold.map(path => [path, deferred()]));
  await context.addInitScript(({logout, storageDenied}) => {
    if (!sessionStorage.getItem('fixture-real-seeded')) {
      sessionStorage.setItem('fixture-real-seeded', '1');
      sessionStorage.setItem('codex_explicit_logout', logout ? '1' : '0');
    }
    if (storageDenied) {
      const read = Storage.prototype.getItem;
      Storage.prototype.getItem = function(key) {
        if (key === 'codex_explicit_logout') throw new DOMException('Synthetic storage denial', 'SecurityError');
        return read.call(this, key);
      };
    }
    if (location.pathname !== '/app.html') return;
    window.realEntryLoaded = false;
    document.addEventListener('load', event => {
      if (event.target?.tagName === 'SCRIPT' && new URL(event.target.src).pathname === '/assets/js/vault-frame-entry.js') window.realEntryLoaded = true;
    }, true);
    const sample = phase => {
      const body = document.body, frame = document.querySelector('#vault-frame');
      const samples = JSON.parse(sessionStorage.getItem('fixture-real-samples') || '[]');
      if (samples.length < 200 || phase === 'pagehide') {
        samples.push({phase, bodyPresent: !!body, bodyHidden: body?.hidden ?? true, bodyInert: body?.inert ?? true,
          framePresent: !!frame, frameHidden: frame?.hidden ?? true, frameInert: frame?.inert ?? true});
        sessionStorage.setItem('fixture-real-samples', JSON.stringify(samples));
      }
    };
    // Absence of a parsed body is explicit evidence, not an empty samples array.
    sample('init');
    new MutationObserver(() => sample('mutation')).observe(document, {childList: true, subtree: true, attributes: true});
    const paint = () => {sample('paint'); requestAnimationFrame(paint);};
    requestAnimationFrame(paint);
    addEventListener('pagehide', () => sample('pagehide'));
  }, {logout, storageDenied});
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== base) {await route.abort(); return;}
    const path = url.pathname;
    requests.push(path);
    if (gates.has(path)) await gates.get(path).promise;
    try {
      if (fail.includes(path)) {await route.abort(); return;}
      if (path === mainPath) {
        await route.fulfill({contentType: 'text/javascript', body: 'window.realMainRuns=(window.realMainRuns||0)+1;'}); return;
      }
      if (disabled && path === '/assets/js/app-env.js') {
        const original = await readFile(resolve(root, 'assets/js/app-env.js'), 'utf8');
        assert.ok(original.includes('VAULT_FRAME_ENABLED = true;'));
        await route.fulfill({contentType: 'text/javascript', body: original.replace('VAULT_FRAME_ENABLED = true;', 'VAULT_FRAME_ENABLED = false;')}); return;
      }
      await route.continue();
    } catch (error) {
      if (!/closed|cancel|intercept|invalid|disposed/i.test(String(error))) throw error;
    }
  });
  const page = await context.newPage();
  return {page, context, requests, release(path) {gates.get(path)?.resolve();},
    async close() {for (const gate of gates.values()) gate.resolve(); await context.close();}};
}
async function assertRealLogin(f) {
  await f.page.waitForURL(base + '/login.html', {timeout: 1800});
  await f.page.locator('#username').waitFor({state: 'visible', timeout: 1800});
  const samples = await f.page.evaluate(() => JSON.parse(sessionStorage.getItem('fixture-real-samples') || '[]'));
  assert.ok(samples.length > 0, 'DOM observations must not be an empty evidence set');
  assert.ok(samples.some(s => s.phase === 'pagehide'), 'include the departing shell, not just its initial state');
  assert.ok(samples.every(s => (!s.bodyPresent || s.bodyHidden && s.bodyInert) && s.frameHidden && s.frameInert),
    'every observed shell DOM state is absent or hidden/inert; this does not observe native iOS snapshots');
  assert.equal(f.requests.filter(path => path === '/login.html').length, 1, 'request a single login navigation');
  assert.equal(f.requests.filter(path => path === mainPath).length, 0);
  assert.equal(f.page.frames().length, 1);
  await f.page.locator('#username').fill('synthetic');
}
for (const asset of [entryPath, '/assets/js/app-env.js', '/assets/css/core.css', guardPath]) {
  test('real shell: logged-out cold entry reaches login while dependency is held: ' + asset, {timeout: 10000}, async () => {
    const f = await realShellFixture({hold: [asset]});
    try {
      await f.page.goto(base + realShellPath, {waitUntil: 'commit'});
      await assertRealLogin(f);
      // The dependency is deliberately released only in close(), after assertions.
    } finally {await f.close();}
  });
}
for (const asset of [guardPath, startupPath]) {
  test('real shell: logged-out entry reaches login with a failed guard asset: ' + asset, {timeout: 10000}, async () => {
    const f = await realShellFixture({fail: [asset]});
    try {await f.page.goto(base + realShellPath, {waitUntil: 'commit'}); await assertRealLogin(f);}
    finally {await f.close();}
  });
}
test('real shell: marker appearing during guard load prevents main import', {timeout: 10000}, async () => {
  const f = await realShellFixture({logout: false, hold: [guardPath, '/login.html']});
  try {
    await f.page.goto(base + realShellPath, {waitUntil: 'commit'});
    await f.page.waitForFunction(() => document.querySelector('script[src="/assets/js/private-auth-gate.js"]'), null, {timeout: 3000});
    await f.page.evaluate(() => sessionStorage.setItem('codex_explicit_logout', '1'));
    f.release(guardPath);
    await f.page.waitForFunction(() => window.realEntryLoaded, null, {timeout: 3000});
    assert.equal(f.requests.filter(path => path === mainPath).length, 0, 'do not compete with login navigation by starting main');
    f.release('/login.html'); await assertRealLogin(f);
  } finally {await f.close();}
});
test('real shell: failed guard after marker appears still reaches login', {timeout: 10000}, async () => {
  const f = await realShellFixture({logout: false, hold: [guardPath], fail: [guardPath]});
  try {
    await f.page.goto(base + realShellPath, {waitUntil: 'commit'});
    await f.page.waitForFunction(() => document.querySelector('script[src="/assets/js/private-auth-gate.js"]'), null, {timeout: 3000});
    await f.page.evaluate(() => sessionStorage.setItem('codex_explicit_logout', '1'));
    f.release(guardPath); await assertRealLogin(f);
  } finally {await f.close();}
});
test('real shell: failed guard without logout stays hidden and does not start main', {timeout: 10000}, async () => {
  const f = await realShellFixture({logout: false, fail: [guardPath]});
  try {
    const failed = f.page.waitForEvent('pageerror');
    await f.page.goto(base + realShellPath, {waitUntil: 'commit'}); await failed;
    assert.equal(new URL(f.page.url()).pathname, '/app.html');
    assert.deepEqual(await f.page.evaluate(() => ({hidden: document.body.hidden, inert: document.body.inert,
      frameHidden: document.querySelector('#vault-frame').hidden})), {hidden: true, inert: true, frameHidden: true});
    assert.equal(f.requests.filter(path => path === mainPath).length, 0);
    assert.equal(f.requests.filter(path => path === '/login.html').length, 0);
  } finally {await f.close();}
});
test('real shell: no logout preserves the ordinary main bootstrap', {timeout: 10000}, async () => {
  const f = await realShellFixture({logout: false});
  try {
    await f.page.goto(base + realShellPath);
    await f.page.waitForFunction(() => window.realMainRuns === 1);
    assert.equal(new URL(f.page.url()).pathname, '/app.html');
    assert.equal(f.requests.filter(path => path === '/login.html').length, 0);
  } finally {await f.close();}
});
for (const logout of [false, true]) test('real shell: disabled switch preserves inert feature with logout precedence: ' + logout, {timeout: 10000}, async () => {
  const f = await realShellFixture({logout, disabled: true, fail: [startupPath]});
  try {
    await f.page.goto(base + realShellPath, {waitUntil: 'commit'});
    if (logout) await assertRealLogin(f);
    else {
      await f.page.waitForFunction(() => window.realEntryLoaded);
      assert.equal(new URL(f.page.url()).pathname, '/app.html');
      assert.equal(await f.page.evaluate(() => document.body.hidden), false);
      assert.equal(f.requests.filter(path => path === guardPath || path === mainPath).length, 0);
    }
  } finally {await f.close();}
});
test('real shell: embedded entry cannot redirect its parent or bootstrap main', {timeout: 10000}, async () => {
  const f = await realShellFixture({logout: true, storageDenied: true});
  try {
    await f.page.route(base + '/embedded.html', route => route.fulfill({contentType: 'text/html', body: '<iframe id="embedded" src="' + realShellPath + '"></iframe>'}));
    await f.page.goto(base + '/embedded.html');
    const child = f.page.frames().find(frame => new URL(frame.url()).pathname === '/app.html');
    assert.ok(child); await child.waitForFunction(() => window.realEntryLoaded);
    assert.equal(new URL(f.page.url()).pathname, '/embedded.html');
    assert.equal(new URL(child.url()).pathname, '/app.html');
    assert.equal(f.requests.filter(path => path === mainPath || path === '/login.html' || path === guardPath).length, 0);
  } finally {await f.close();}
});
test('real shell: unavailable marker storage fails closed before module dependency', {timeout: 10000}, async () => {
  const f = await realShellFixture({logout: false, storageDenied: true, hold: ['/assets/js/app-env.js']});
  try {await f.page.goto(base + realShellPath, {waitUntil: 'commit'}); await assertRealLogin(f);}
  finally {await f.close();}
});
