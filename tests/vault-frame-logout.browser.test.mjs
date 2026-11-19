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
const childHtml = shell('logout-child.mjs') + '<button id="logout">Esci</button><button id="legal">Privacy</button></body></html>';
const publicHtml = '<!doctype html><html><body><label>Username<input id="username"></label><button id="login" onclick="this.dataset.clicked=1">Accedi</button></body></html>';
const parentModule = `
import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
import {authSessionFence} from '/assets/js/auth-session-fence.js';
const options=window.fixtureOptions;
window.recordFixture=value=>{const log=JSON.parse(sessionStorage.getItem('fixture-log')||'[]');log.push(value);sessionStorage.setItem('fixture-log',JSON.stringify(log));};
const permit=await authSessionFence.readPermit();
window.privateAuthGate.acceptIdentity(window.privateAuthGate.begin('synthetic'),{uid:'synthetic',emailVerified:true});
const iframe=document.querySelector('iframe');
const owner=createVaultFrameOwner({window,iframe,release:'fixture',getIdentity:()=>({uid:'synthetic',epoch:'fixture'}),
 readPermit:async()=>({enabled:true,uid:'synthetic',version:1,expiresAt:Date.now()+3600000}),
 validateIdentity:async()=>authSessionFence.isLocallyAllowed(),readTimeout:async()=>720,
 unlock:async()=>'SYNTHETIC-MATERIAL',clearMaterial:()=>window.recordFixture({kind:'clear'}),
 onState:state=>{if(state.locked)window.recordFixture({kind:'locked',reason:state.reason});}});
window.frameOwner=owner;
if(options.interrupt){
 let delegating=false;
 const facade=window.vaultFrameNavigation;
 window.vaultFrameNavigation={...facade,navigateFromChild(...args){delegating=true;try{return facade.navigateFromChild(...args);}finally{delegating=false;}}};
 const remove=iframe.remove.bind(iframe);
 iframe.remove=()=>{remove();if(delegating){window.recordFixture({kind:'synthetic-caller-detached'});throw Error('SYNTHETIC_CALLER_DETACHED');}};
}
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
window.fixtureReady=true;`;

let server, browser, base;
test.before(async () => {
  server = createServer(async (req, res) => {
    const pathname = new URL(req.url, 'http://fixture.invalid').pathname;
    try {
      let body, type = 'text/html';
      if (pathname === '/app.html') body = parentHtml;
      else if (pathname === '/home_page.html') body = childHtml;
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
