import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {mkdir,readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';

// Real shell, gate, production adapter, owner, transport and Master modal.
// Only identity/admission/key acquisition are synthetic; all traffic is loopback.
const root=resolve(import.meta.dirname,'../Frontend/public');
const app=(await readFile(resolve(root,'app.html'),'utf8'))
 .replace(/<script type="module" src="assets\/js\/vault-frame-entry[^>]+><\/script>/,'<script src="/assets/js/private-auth-gate.js"></script><script type="module" src="/resume-fixture.mjs"></script>');
const production=(await readFile(resolve(root,'assets/js/modules/core/vault-frame-production.js'),'utf8'))
 .replace(/^import .*;\r?\n/gm,'');
const dependencies=`
import {createVaultFrameOwner as realOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
export const APP_VERSION='fixture',auth={currentUser:{uid:'synthetic',emailVerified:true}},db={};
export const authSessionFence={isCurrent:async()=>true,isLocallyAllowed:()=>true};
export const doc=()=>({}),onSnapshot=()=>()=>{},getUserProfile=async()=>({lock_timeout:720});
export const emitFrameDiagnostic=()=>{};
export const createProductionFrameAdmission=()=>({read:async()=>window.resumeFixture.denyAdmission?null:({enabled:true,uid:'synthetic',version:1,expiresAt:Date.now()+3600000}),dispose(){}});
export const installFramePushNavigation=()=>()=>{};
export const createVaultFrameOwner=options=>{const owner=realOwner(options);window.frameOwner=owner;return owner;};
`;
const productionFixture="import {APP_VERSION,auth,db,authSessionFence,doc,onSnapshot,getUserProfile,emitFrameDiagnostic,createProductionFrameAdmission,installFramePushNavigation,createVaultFrameOwner} from '/resume-dependencies.mjs';\n"+production;
const entry=`
import {startVaultFrame} from '/resume-production.mjs';
import {showInputModal} from '/assets/js/ui-core-v129.js';
const pause=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const state=window.resumeFixture={identity:pause(),proof:pause(),unlockCalled:false};
const mode=new URL(location.href).searchParams.get('deny');
state.mount=crypto.randomUUID();
state.denyAdmission=mode==='always'||(mode==='once'&&!sessionStorage.getItem('denied-once'));
if(state.denyAdmission)sessionStorage.setItem('denied-once','1');
const held=sessionStorage.getItem('resume-hold')==='1';
if(!held){state.identity.resolve();state.proof.resolve('SYNTHETIC-MATERIAL');}
await state.identity.promise;
const gate=window.privateAuthGate;gate.acceptIdentity(gate.begin('synthetic'),{uid:'synthetic',emailVerified:true});
await startVaultFrame({user:{uid:'synthetic'},fenceTicket:{revision:1,nonce:'fixture'},securityManager:{
 setFrameExpiryAuthority(){},clearSession(){},async ensureVaultKeyMaterial(){
  state.unlockCalled=true;const result=await state.proof.promise;
  if(result==='prompt')return showInputModal('SBLOCCO VAULT','','Master Password','',{vaultSecret:true});
  if(result==='throw')throw Error('SYNTHETIC_UNLOCK_FAILURE');return result;
 }
}});`;
const child=`<!doctype html><html><head><script type="module">
import {createFrameTransport} from '/assets/js/modules/core/vault-frame-transport.mjs';
const client=createFrameTransport({window,release:'fixture',enabled:true});
try{const reply=await client.request('key');if(reply.kind!=='key')throw Error('DENIED');await client.whenVisible();window.syntheticReady=true;}
catch{window.parent.frameOwner.session.lock('unlock-failed');}
</script></head><body>Contenuto sintetico</body></html>`;
let browser,server,base;
test.before(async()=>{
 server=createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://fixture.invalid').pathname;
  let body,type='text/javascript';
  if(pathname==='/app.html'){body=app;type='text/html';}
  else if(['/home_page.html','/dati_azienda.html'].includes(pathname)){body=child;type='text/html';}
  else if(pathname==='/resume-fixture.mjs')body=entry;
  else if(pathname==='/resume-production.mjs')body=productionFixture;
  else if(pathname==='/resume-dependencies.mjs')body=dependencies;
  else{const file=resolve(root,'.'+pathname);if(!file.startsWith(root+sep))throw Error('DENIED');body=await readFile(file);type=file.endsWith('.css')?'text/css':file.endsWith('.json')?'application/json':'text/javascript';}
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(body);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server?.close(r));});
async function open(){
 const context=await browser.newContext({viewport:{width:393,height:852}}),page=await context.newPage(),errors=[];
 await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/app.html');
 try{await page.waitForFunction(()=>window.frameOwner?.session.state().unlocked,null,{timeout:5000});}
 catch(error){const state=await page.evaluate(()=>({fixture:!!window.resumeFixture,called:window.resumeFixture?.unlockCalled,owner:window.frameOwner?.session.state(),frame:document.querySelector('iframe')?.getAttribute('src'),frames:window.frames.length,gate:document.documentElement.dataset.privateAuthState}));await context.close();throw Error(JSON.stringify({state,errors}),{cause:error});}
 return {context,page,errors};
}
async function resumeWithDeferredIdentity(page){
 await page.evaluate(()=>{
  sessionStorage.setItem('resume-hold','1');window.frameOwner.session.lock('fixture-idle');
  const resume=document.getElementById('frame-resume');
  resume.addEventListener('click',()=>{
   const s=getComputedStyle(resume,'::before');
   sessionStorage.setItem('resume-click',JSON.stringify({busy:resume.getAttribute('aria-busy'),disabled:resume.getAttribute('aria-disabled'),spinner:{content:s.content,animation:s.animationName,width:parseFloat(s.width),height:parseFloat(s.height),ink:s.borderTopColor,transparent:s.borderRightColor}}));
   resume.click();
  },{once:true});
 });
 const navigation=page.waitForNavigation();await page.locator('#frame-resume').click({noWaitAfter:true});
 await navigation;await page.waitForFunction(()=>window.resumeFixture);
}
const spin=async(page,selector,pseudo)=>page.locator(selector).evaluate((e,pseudo)=>{
 const s=getComputedStyle(e,pseudo);return {content:s.content,animation:s.animationName,width:parseFloat(s.width),height:parseFloat(s.height),ink:s.borderTopColor,transparent:s.borderRightColor};
},pseudo);
function assertSpinner(value){assert.equal(value.content,'""');assert.equal(value.animation,'ui-state-spin');assert.ok(value.width>=16&&value.height>=16);assert.notEqual(value.ink,'rgba(0, 0, 0, 0)');assert.equal(value.transparent,'rgba(0, 0, 0, 0)');}
async function capture(page,name){if(process.env.FRAME_WAIT_CAPTURE){await mkdir('.codex-tmp/frame-wait',{recursive:true});await page.screenshot({path:'.codex-tmp/frame-wait/'+name+'.png'});}}

test('real resume reload keeps feedback through identity and proof, and cancellation leaves a usable retry',{timeout:60000},async()=>{
 const f=await open();try{
  await resumeWithDeferredIdentity(f.page);
  const clicked=await f.page.evaluate(()=>JSON.parse(sessionStorage.getItem('resume-click')));
  assert.equal(clicked.busy,'true');assert.equal(clicked.disabled,'true');assertSpinner(clicked.spinner);
  assert.equal(await f.page.locator('html').getAttribute('data-private-auth-state'),'pending');
  assertSpinner(await spin(f.page,'html','::after'));
  assert.equal(await f.page.locator('body').evaluate(e=>e.hidden&&e.inert),true);
  await capture(f.page,'identity-phone');
  await f.page.evaluate(()=>window.resumeFixture.identity.resolve());
  await f.page.waitForFunction(()=>window.resumeFixture.unlockCalled);
  assert.equal(await f.page.locator('#frame-loading').isVisible(),true);
  assert.equal(await f.page.locator('#frame-loading').getAttribute('aria-busy'),'true');
  assertSpinner(await spin(f.page,'#frame-loading','::before'));
  await capture(f.page,'vault-wait-phone');
  await f.page.evaluate(()=>window.resumeFixture.proof.resolve('prompt'));
  await f.page.locator('#protocol-input-modal.active').waitFor();
  await capture(f.page,'modal-phone');
  await f.page.locator('#protocol-input-modal-input').focus();
  assert.equal(await f.page.locator('#protocol-input-modal-input').evaluate(e=>document.activeElement===e),true);
  await f.page.locator('#modal-cancel-btn').click();await f.page.locator('#frame-resume').waitFor();
  assert.equal(await f.page.locator('#frame-loading').isVisible(),false);
  assert.equal(await f.page.locator('#frame-resume').getAttribute('aria-busy'),null);
  assert.equal(await f.page.evaluate(()=>window.frameOwner.session.state().unlocked),false);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('waiting indicators follow all palettes, aspects and graphics, including reduced motion',{timeout:60000},async()=>{
 const f=await open();try{
  await resumeWithDeferredIdentity(f.page);
  const palettes=['blue','green','red','sand','petrol','lavender','dusty-rose'];
  const matrix=async(selector,pseudo,role)=>{
   for(const width of [320,1280])for(const graphics of ['classica','tre-livelli'])for(const dark of [false,true])for(const palette of palettes){
    await f.page.setViewportSize({width,height:852});
    const expected=await f.page.evaluate(({graphics,dark,palette,role})=>{
     const root=document.documentElement;root.dataset.uiGraphics=graphics==='classica'?'classic':'new';root.classList.toggle('dark',dark);root.dataset.colorTheme=palette;
     const probe=document.createElement('span');probe.style.color=role.startsWith('--')?'var('+role+')':role;document.body.append(probe);const color=getComputedStyle(probe).color;probe.remove();return color;
    },{graphics,dark,palette,role});
    const actual=await spin(f.page,selector,pseudo);assertSpinner(actual);assert.equal(actual.ink,expected);
   }
  };
  await matrix('html','::after','--text-primary');
  await f.page.evaluate(()=>window.resumeFixture.identity.resolve());await f.page.waitForFunction(()=>window.resumeFixture.unlockCalled);
  await matrix('#frame-loading','::before','--text-primary');
  await f.page.emulateMedia({reducedMotion:'reduce'});assert.equal((await spin(f.page,'#frame-loading','::before')).animation,'none');
  assert.equal(await f.page.locator('#frame-loading').evaluate(e=>getComputedStyle(e).pointerEvents),'none');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

for(const outcome of ['success','error'])test('feedback ends after real transport unlock '+outcome,async()=>{
 const f=await open();try{
  await resumeWithDeferredIdentity(f.page);await f.page.evaluate(()=>window.resumeFixture.identity.resolve());
  await f.page.waitForFunction(()=>window.resumeFixture.unlockCalled);
  await f.page.evaluate(value=>window.resumeFixture.proof.resolve(value),outcome==='success'?'SYNTHETIC-MATERIAL':'throw');
  if(outcome==='success')await f.page.waitForFunction(()=>window.frameOwner.session.state().unlocked);
  else await f.page.locator('#frame-resume').waitFor();
  assert.equal(await f.page.locator('#frame-loading').isVisible(),false);
  assert.equal(await f.page.locator('#frame-loading').getAttribute('aria-busy'),null);
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

for(const mode of ['once','always'])test('startup admission denied '+mode+' retries the original company route through the gate',{timeout:20000},async()=>{
 const context=await browser.newContext({viewport:{width:393,height:852}}),page=await context.newPage(),errors=[];
 await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 page.on('pageerror',e=>errors.push(e.message));
 try{
  const route='/dati_azienda.html?id=QA_COMPANY_001&profileTab=documents#wrapper-email-section';
  await page.goto(base+'/app.html?route='+encodeURIComponent(route)+'&deny='+mode);
  await page.locator('#frame-resume').waitFor();const original=page.url();
  for(let attempt=0;attempt<(mode==='always'?2:1);attempt++){
   assert.equal(await page.evaluate(()=>resumeFixture.unlockCalled),false);
   assert.equal(await page.locator('iframe').count(),0);
   const mount=await page.evaluate(()=>resumeFixture.mount);
   const request=page.waitForRequest(r=>r.isNavigationRequest()&&r.frame()===page.mainFrame());
   const navigation=page.waitForNavigation();await page.locator('#frame-resume').click();await navigation;
   await page.waitForFunction(()=>window.resumeFixture);
   assert.equal((await request).url(),original,'native fallback requests exactly the original document and full query');
   assert.equal(new URL(page.url()).searchParams.get('route'),route,'owner normalization preserves nested query and fragment');
   assert.notEqual(await page.evaluate(()=>resumeFixture.mount),mount,'a new gated document is loaded');
   if(mode==='always')await page.locator('#frame-resume').waitFor();
  }
  if(mode==='once'){
   await page.waitForFunction(()=>window.frameOwner?.session.state().unlocked&&document.querySelector('iframe')?.contentWindow?.syntheticReady);
   assert.equal(await page.evaluate(()=>{const l=document.querySelector('iframe').contentWindow.location;return l.pathname+l.search+l.hash;}),route);
   assert.equal(await page.evaluate(()=>resumeFixture.unlockCalled),true);
  }else{
   assert.equal(await page.evaluate(()=>resumeFixture.unlockCalled),false);
   assert.equal(await page.evaluate(()=>frameOwner.session.state().unlocked),false);
   assert.equal(await page.locator('iframe').count(),0);
  }
  assert.deepEqual(errors,[]);
 }finally{await context.close();}
});

for(const route of ['https://outside.invalid/dati_azienda.html','/app.html'])test('resume cannot admit an invalid route '+route,async()=>{
 const context=await browser.newContext(),page=await context.newPage(),external=[];
 await context.route('**/*',r=>{if(r.request().url().startsWith(base+'/'))return r.continue();external.push(r.request().url());return r.abort();});
 try{
  await page.goto(base+'/app.html?route='+encodeURIComponent(route));await page.locator('#frame-resume').waitFor();
  const original=page.url(),navigation=page.waitForNavigation();await page.locator('#frame-resume').click();await navigation;
  await page.locator('#frame-resume').waitFor();assert.equal(page.url(),original);
  assert.equal(await page.evaluate(()=>resumeFixture.unlockCalled),false);
  assert.equal(await page.locator('iframe').count(),0);assert.deepEqual(external,[]);
 }finally{await context.close();}
});
