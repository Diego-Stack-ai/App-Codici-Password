import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

// Actual owner/transport/CSS with synthetic Auth/admission; no Firebase traffic.
const root = fileURLToPath(new URL('../Frontend/public/', import.meta.url));
const parentHtml = `<!doctype html><html><head><link rel="stylesheet" href="/assets/css/vault-frame.css"><link rel="stylesheet" href="/fixture.css"><script type="module" src="/parent-fixture.mjs"></script></head><body><div data-frame-safe-area class="frame-safe-area"></div><iframe id="vault-frame" class="vault-frame" hidden inert></iframe></body></html>`;
const childHtml = `<!doctype html><html><head>${['core','core_fascie','core_ui','profile-layout'].map(name => `<link rel="stylesheet" href="/assets/css/${name}.css">`).join('')}<link rel="stylesheet" href="/fixture.css"><script type="module" src="/child-fixture.mjs"></script></head><body><header class="base-header">Synthetic</header><nav class="profile-tabs">Tabs</nav><main class="fixture-main"><button id="action">Action</button><a id="legal" href="/privacy.html">Legal</a></main><footer class="base-footer">Footer</footer></body></html>`;
const parentModule = `import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
window.fixture={unlocks:0,confirms:0,clears:0,allowed:true,fence:true,locks:[],firstVisible:[]};
const state=window.fixture, iframe=document.querySelector('iframe');
const owner=createVaultFrameOwner({window,iframe,release:'fixture',getIdentity:()=>({uid:'synthetic',epoch:'1:fence'}),
readPermit:async()=>({enabled:state.allowed,uid:'synthetic',version:1,expiresAt:Date.now()+3600000}),
validateIdentity:async()=>state.fence,readTimeout:async()=>3,
unlock:async()=>{state.unlocks++;return 'SYNTHETIC-MATERIAL';},confirmSensitive:async()=>{state.confirms++;return true;},
clearMaterial:()=>state.clears++,onState:s=>state.locks.push(s.reason||'started')});
window.frameOwner=owner;
new MutationObserver(()=>{if(iframe.style.visibility==='visible') {const doc=iframe.contentDocument;state.firstVisible.push({top:getComputedStyle(doc.querySelector('header')).height,bottom:getComputedStyle(doc.querySelector('footer')).height,tabs:getComputedStyle(doc.querySelector('nav')).top});}}).observe(iframe,{attributes:true,attributeFilter:['style']});
await owner.start('/home_page.html'); window.fixtureStarted=true;`;
const childModule = `import {createFrameTransport} from '/assets/js/modules/core/vault-frame-transport.mjs';
const client=createFrameTransport({window,release:'fixture',enabled:true});
window.fixtureChild={keys:0};
window.requestFixtureKey=async()=>{const reply=await client.request('key');if(reply.kind!=='key')throw Error('DENIED');window.fixtureChild.keys++;};
window.disposeFixture=()=>client.dispose();
await window.requestFixtureKey();`;
const fixtureCss = `.fixture-main{padding-top:220px}.frame-safe-area{padding:47px 29px 34px 31px}@media(orientation:landscape){.frame-safe-area{padding:0 47px 21px 47px}}`;
const nativeHtml = '<!doctype html><html><head><script type="module" src="/native-fixture.mjs"></script></head><body><button id="start">Start</button></body></html>';
const nativeModule = `import {executeFrameNativeAction} from '/native-action-module.mjs';
import {vaultFrameClient,confirmFrameAction} from '/native-dependencies.mjs';
window.nativeFixture={calls:0,active:false,allowed:true,framed:true,authorizations:0,done:false};
document.querySelector('#start').onclick=()=>Promise.resolve(executeFrameNativeAction({scope:'synthetic',snapshotBytes:new Uint8Array([1,2,3])},()=>{
window.nativeFixture.calls++;window.nativeFixture.active=navigator.userActivation.isActive;},{vaultFrameClient,confirmFrameAction})).then(()=>{window.nativeFixture.done=true;});`;
const clientSource = await readFile(resolve(root, 'assets/js/modules/core/vault-frame-client.js'), 'utf8');
const nativeDependencies = `const APP_VERSION='fixture', VAULT_FRAME_ENABLED=true;
const auth={get currentUser(){return {uid:'synthetic'};}};
const authSessionFence={readPermit:async()=>({uid:'synthetic'}),isCurrent:async()=>window.nativeFixture.allowed,
isLocallyCurrent:()=>window.nativeFixture.allowed};
const createFrameTransport=()=>({isChild:()=>window.nativeFixture.framed,generation:()=>0,
suspensionGeneration:()=>window.nativeFixture.suspension||0,isUnlocked:()=>window.nativeFixture.allowed,
onClear:cb=>{window.revokeNative=cb;return()=>{window.revokeNative=null;};},
request:async(kind)=>{if(kind==='fresh'){window.nativeFixture.authorizations++;await new Promise(r=>setTimeout(r,30));return {kind:'grant',grant:'synthetic'};}
return {kind:'consumed',expiresAt:Date.now()+10000};}});
` + clientSource.replace(/^import .*;\r?\n/gm, '');
let server, browser, base;
test.before(async () => {
  server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://fixture.invalid').pathname;
    try {
      const fixtures = {'/app.html': ['text/html', parentHtml], '/parent-fixture.mjs': ['text/javascript', parentModule],
        '/child-fixture.mjs': ['text/javascript', childModule], '/fixture.css': ['text/css', fixtureCss]};
      let type, content;
      if (path === '/native-ready.html') {type='text/html';content=nativeHtml;}
      else if (path === '/native-fixture.mjs') {type='text/javascript';content=nativeModule;}
      else if (path === '/native-dependencies.mjs') {type='text/javascript';content=nativeDependencies;}
      else if (path === '/native-labels.mjs') {type='text/javascript';content='export const t=key=>key;';}
      else if (path === '/native-action-module.mjs') {
        type='text/javascript'; content=(await readFile(resolve(root,'assets/js/modules/core/vault-frame-native-action.js'),'utf8'))
          .replace("'./vault-frame-client.js'","'/native-dependencies.mjs'")
          .replace("'../../dom-utils.js'","'/assets/js/dom-utils.js'")
          .replace("'../../translations.js'","'/native-labels.mjs'");
      }
      else if (fixtures[path]) [type, content] = fixtures[path];
      else if (path.endsWith('.html')) {type = 'text/html'; content = childHtml;}
      else {
        const file = resolve(root, '.' + path);
        if (!file.startsWith(root + sep) && !file.startsWith(root)) throw Error('DENIED');
        content = await readFile(file); type = path.endsWith('.css') ? 'text/css' : 'text/javascript';
      }
      res.writeHead(200, {'Content-Type': type, 'Cache-Control': 'no-store'}); res.end(content);
    } catch {res.writeHead(404); res.end();}
  });
  await new Promise(done => server.listen(0, '127.0.0.1', done));
  base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({channel: 'chrome', headless: true});
});
test.after(async () => {await browser?.close(); await new Promise(done => server?.close(done));});
async function fixture() {
  const context = await browser.newContext({viewport: {width: 393, height: 852}});
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await context.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/app.html');
  await page.waitForFunction(() => window.fixtureStarted && window.fixture.unlocks === 1 && document.querySelector('iframe').style.visibility === 'visible');
  return {context, page, errors, child: () => page.frames().find(frame => frame !== page.mainFrame())};
}
test('real broker/transport: ten private documents use one unlock, queries/fragments and back/forward persist', async () => {
  const f = await fixture();
  try {
    for (const path of ['/area_privata.html','/account_privati.html?type=standard','/profilo_privato.html?profileTab=documents#documenti-view-container',
      '/lista_aziende.html','/scadenze.html?filter=urgenti','/archivio_account.html','/impostazioni.html','/regole_scadenze.html','/configurazione_documenti.html']) {
      await f.page.evaluate(target => {const frame=document.querySelector('iframe');window.vaultFrameNavigation.navigateFromChild(frame.contentWindow,frame.contentDocument,target,false);}, path);
      await f.child().waitForFunction(() => window.fixtureChild?.keys === 1);
      assert.equal(await f.page.evaluate(() => window.fixture.unlocks), 1);
      assert.equal(new URL(f.page.url()).searchParams.get('route'), path);
    }
    await f.page.goBack(); await f.child().waitForFunction(() => window.fixtureChild?.keys === 1);
    assert.equal(new URL(f.page.url()).searchParams.get('route'), '/regole_scadenze.html');
    await f.page.goForward(); await f.child().waitForFunction(() => window.fixtureChild?.keys === 1);
    assert.equal(new URL(f.page.url()).searchParams.get('route'), '/configurazione_documenti.html');
    assert.deepEqual(f.errors, []);
  } finally {await f.context.close();}
});
test('insets are applied before first visibility and resize without another unlock', async () => {
  const f = await fixture();
  try {
    assert.deepEqual(await f.page.evaluate(() => window.fixture.firstVisible[0]), {top: '132px', bottom: '119px', tabs: '132px'});
    await f.page.setViewportSize({width: 852, height: 393});
    await f.child().waitForFunction(() => getComputedStyle(document.querySelector('footer')).height === '106px');
    assert.equal(await f.child().evaluate(() => getComputedStyle(document.querySelector('header')).height), '85px');
    assert.equal(await f.child().evaluate(() => getComputedStyle(document.querySelector('nav')).top), '85px');
    assert.equal(await f.page.evaluate(() => window.fixture.unlocks), 1);
    assert.deepEqual(f.errors, []);
  } finally {await f.context.close();}
});
test('foreign/unrelated messages do not revoke; release mismatch revokes and exits standalone', async () => {
  const f = await fixture();
  try {
    await f.child().evaluate(() => parent.postMessage({kind:'unrelated'},location.origin));
    assert.equal(await f.page.evaluate(() => window.frameOwner.session.state().unlocked), true);
    await f.child().evaluate(() => parent.postMessage({protocol:'vault-frame/v1',release:'old',kind:'hello'},location.origin));
    await f.page.waitForURL(base + '/home_page.html?__frame_standalone_once=1');
    assert.equal(f.page.frames().length, 1);
  } finally {await f.context.close();}
});
test('public links exit at top level after revoking key; old Document facade cannot affect a new child', async () => {
  const f = await fixture();
  try {
    await f.page.evaluate(() => {const iframe=document.querySelector('iframe');window.oldDocument=iframe.contentDocument;window.oldWindow=iframe.contentWindow;
      window.vaultFrameNavigation.navigateFromChild(iframe.contentWindow,iframe.contentDocument,'/area_privata.html',false);});
    await f.child().waitForFunction(() => window.fixtureChild?.keys === 1);
    assert.equal(await f.page.evaluate(() => window.vaultFrameNavigation.navigateFromChild(window.oldWindow,window.oldDocument,'/privacy.html',true)), false);
    assert.equal(await f.page.evaluate(() => window.frameOwner.session.state().unlocked), true);
    await f.child().locator('#legal').click(); await f.page.waitForURL(base + '/privacy.html');
    assert.equal(f.page.frames().length, 1);
  } finally {await f.context.close();}
});
test('external facade exits are denied; trusted external links open outside with no opener',async()=>{
 const f=await fixture();try{
  assert.equal(await f.page.evaluate(()=>{const frame=document.querySelector('iframe');return window.vaultFrameNavigation.navigateFromChild(frame.contentWindow,frame.contentDocument,'https://external.invalid/',false);}),false);
  assert.equal(await f.page.evaluate(()=>window.frameOwner.session.state().unlocked),true);
  await f.child().evaluate(()=>{const link=document.createElement('a');link.id='external';link.href='https://external.invalid/';link.textContent='External';document.body.append(link);});
  const opened=f.context.waitForEvent('page');await f.child().locator('#external').click();const popup=await opened;
  await popup.waitForLoadState().catch(()=>{});assert.equal(await popup.evaluate(()=>window.opener===null),true);await popup.close();
  assert.equal(await f.page.evaluate(()=>window.frameOwner.session.state().unlocked),true);assert.ok(f.page.url().includes('/app.html'));
 }finally{await f.context.close();}
});

test('allowed section anchors synchronize; an unknown anchor locks without exposing the child',async()=>{
 const f=await fixture();try{
  await f.page.evaluate(()=>{const frame=document.querySelector('iframe');window.vaultFrameNavigation.navigateFromChild(frame.contentWindow,frame.contentDocument,'/profilo_privato.html',false);});
  await f.child().waitForFunction(()=>window.fixtureChild?.keys===1);
  await f.child().evaluate(()=>{location.hash='documenti-view-container';});
  await f.page.waitForFunction(()=>new URL(location.href).searchParams.get('route').endsWith('#documenti-view-container'));
  await f.child().evaluate(()=>{location.hash='not-approved';});
  await f.page.waitForFunction(()=>!window.frameOwner.session.state().unlocked);
  assert.equal(await f.page.locator('iframe').count(),0);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('durable logout holds parent auth redirects until the child supplies its final reauth target', async () => {
  const f = await fixture();
  try {
    await f.page.evaluate(() => {const iframe=document.querySelector('iframe'), nav=window.vaultFrameNavigation;
      window.logoutToken=nav.beginLogoutFromChild(iframe.contentWindow,iframe.contentDocument);nav.revokeFromChild(iframe.contentWindow,iframe.contentDocument);
      nav.deferExit('/login.html',true);});
    assert.equal(await f.page.evaluate(() => window.frameOwner.session.state().unlocked), false);
    assert.ok(f.page.url().includes('/app.html'));
    const previousUrl=f.page.url(); await f.page.evaluate(()=>window.frameOwner.resume());
    assert.equal(f.page.url(),previousUrl); assert.equal(await f.page.locator('iframe').count(),1);
    await f.page.evaluate(() => {const iframe=document.querySelector('iframe'), nav=window.vaultFrameNavigation;
      nav.finishLogoutFromChild(iframe.contentWindow,iframe.contentDocument,window.logoutToken);
      nav.navigateFromChild(iframe.contentWindow,iframe.contentDocument,'/login.html?reauth=sessions-revoked',true);});
    await f.page.waitForURL(base + '/login.html?reauth=sessions-revoked');
  } finally {await f.context.close();}
});

test('native export uses a new trusted click after async authorization; standalone retains the original gesture', async () => {
  const context = await browser.newContext();
  await context.route('**/*', route => route.request().url().startsWith(base) ? route.continue() : route.abort());
  const page = await context.newPage();
  try {
    await page.goto(base + '/native-ready.html'); await page.waitForFunction(() => window.nativeFixture);
    await page.locator('#start').click(); await page.locator('.btn-primary').waitFor();
    assert.equal(await page.evaluate(() => window.nativeFixture.calls), 0);
    await page.locator('.btn-primary').click(); await page.waitForFunction(() => window.nativeFixture.done);
    assert.deepEqual(await page.evaluate(() => [window.nativeFixture.calls,window.nativeFixture.active]), [1,true]);
    await page.reload(); await page.waitForFunction(() => window.nativeFixture);
    await page.evaluate(() => {window.nativeFixture.framed=false;}); await page.locator('#start').click();
    await page.waitForFunction(() => window.nativeFixture.done);
    assert.deepEqual(await page.evaluate(() => [window.nativeFixture.calls,window.nativeFixture.active,window.nativeFixture.authorizations]), [1,true,0]);
  } finally {await context.close();}
});
test('native export cancellation or revocation does not invoke the file action', async () => {
  const context = await browser.newContext(); const page = await context.newPage();
  try {
    for (const revoke of [false,true]) {
      await page.goto(base + '/native-ready.html'); await page.waitForFunction(() => window.nativeFixture);
      await page.locator('#start').click(); await page.locator('.btn-primary').waitFor();
      if (revoke) await page.evaluate(() => window.revokeNative()); else await page.locator('.btn-secondary').click();
      await page.waitForFunction(() => window.nativeFixture.done);
      assert.equal(await page.evaluate(() => window.nativeFixture.calls), 0);
    }
  } finally {await context.close();}
});

test('native second click rejects a suspended proof or expired lease with the real checker',async()=>{
 const context=await browser.newContext(),page=await context.newPage();try{
 for(const boundary of ['suspension','lease','expiry']){
  await page.goto(base+'/native-ready.html');await page.waitForFunction(()=>window.nativeFixture);
  await page.locator('#start').click();await page.locator('.btn-primary').waitFor();
  if(boundary==='suspension')await page.evaluate(()=>{window.nativeFixture.suspension=1;});
  if(boundary==='lease')await page.evaluate(()=>{window.nativeFixture.allowed=false;});
  if(boundary==='expiry'){await page.clock.install();await page.clock.fastForward(11000);}
  else await page.locator('.btn-primary').click();
  await page.waitForFunction(()=>window.nativeFixture.done);assert.equal(await page.evaluate(()=>window.nativeFixture.calls),0);
 }
 }finally{await context.close();}
});
