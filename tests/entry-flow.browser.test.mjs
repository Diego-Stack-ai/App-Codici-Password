import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';
import {inspectDynamicPaint} from '../scripts/dynamic-visual-map.mjs';
const root=resolve(import.meta.dirname,'../Frontend/public');
const main=(await readFile(resolve(root,'assets/js/main-v129.js'),'utf8')).replace(/\r\n/g,'\n');
function cut(from,to){const a=main.indexOf(from),b=main.indexOf(to,a);assert.ok(a>=0&&b>a,from);return main.slice(a,b);}
const identity=cut('const publicPages =','if (isPrivatePage && navigator.onLine) firebaseRuntime.enableAppCheck');
const routing=cut('const frameStandaloneOnce =','if (isPrivatePage) {\n                    let vaultKeyMaterial').trim();
const key=cut('let vaultKeyMaterial = null;','if (vaultKeyMaterial) {').trim();
const reveal=cut('switch (currentPage) {',"if (currentPage === 'home' && !firstConfigurationComplete)");
const failure=main.split('\n').find(line=>line.includes("gate.active(authAttempt)")&&line.includes("gate.reject('error')"));
assert.ok(failure);
async function pageHtml(name){return (await readFile(resolve(root,name),'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'')
 .replace('<head>','<head><script src="/assets/js/private-auth-gate.js"></script>')
 .replace('</body>','<script type="module" src="/entry-fixture.mjs"></script></body>');}
const fixture=[
"import {showInputModal} from '/entry-ui.mjs';",
"import {createElement} from '/assets/js/dom-utils.js';import {t} from '/entry-labels.mjs';",
"import {loadLanguage,applyGlobalTranslations} from '/assets/js/translations.js';await loadLanguage('it');applyGlobalTranslations();",
cut('function getCurrentPage() {','async function bootstrapMain()'),
"const gate=window.privateAuthGate,currentPage=getCurrentPage(),fenceTicket={};",
"const wait=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};",
"const phases={identity:wait(),routing:wait(),key:wait(),init:wait(),finalFence:wait()};",
"const state=window.entry={phase:'identity',clear:0,init:0,current:true};",
"window.release=(name,value)=>phases[name].resolve(value);",
"const user={uid:'synthetic',emailVerified:true,reload:()=>phases.identity.promise,getIdTokenResult:async()=>({claims:{email_verified:true}})};",
"const auth=window.entryAuth={currentUser:user};",
"const authSessionFence={isCurrent:async()=>state.phase==='finalFence'?await phases.finalFence.promise:state.current};",
"window.authSessionFence={isLocallyAllowed:()=>state.current};",
"const authAttempt=gate.begin(user.uid),VAULT_FRAME_ENABLED=true,consumeFrameStandaloneMarker=()=>new URLSearchParams(location.search).has('standalone');",
"window.routeEntry=async()=>{state.phase='routing';const result=await phases.routing.promise;if(result==='throw')throw Error('synthetic routing failure');return result;};",
"const securityModules=[{clearSession(){state.clear++;},ensureVaultKeyMaterial:async()=>{",
"state.phase='key';const result=await phases.key.promise;",
"if(result==='prompt')return showInputModal('SBLOCCO VAULT','','Master Password','',{vaultSecret:true});",
"if(result==='throw')throw Error('synthetic unlock failure');return result;",
"}}];",
"const Pages=new Proxy({},{get:()=>async()=>{state.phase='init';state.init++;if(await phases.init.promise==='throw')throw Error('synthetic init failure');state.phase='finalFence';}});",
"const navigateDocument=destination=>location.assign(destination),hasCompleteRecoveryIntent=()=>false,COMPLETE_RECOVERY_LOGIN_PATH='/login.html';",
"window.runEntry=async()=>{try{",
identity,
routing.replace("await import('./modules/core/vault-frame-routing.js')","await Promise.resolve({maybeEnterVaultFrame:window.routeEntry})"),
key,reveal,
"state.phase='shown';",
"}catch(error){"+failure+";state.phase='error';}};window.entryDone=window.runEntry();"
].join('\n');
let server,browser,base;
test.before(async()=>{
 server=createServer(async(req,res)=>{try{
 const url=new URL(req.url,'http://fixture.invalid');let body,type='text/javascript';
 if(['/home_page.html','/dati_azienda.html','/profilo_privato.html','/account_privati.html'].includes(url.pathname)){body=await pageHtml(url.pathname.slice(1));type='text/html';}
 else if(url.pathname==='/entry-fixture.mjs')body=fixture;
 else if(url.pathname==='/entry-ui.mjs')body=(await readFile(resolve(root,'assets/js/ui-core-v129.js'),'utf8')).replace("'./dom-utils.js'","'/assets/js/dom-utils.js'").replace("'./translations.js'","'/entry-labels.mjs'").replace("'./modules/core/password-policy.js'","'/entry-policy.mjs'");
 else if(url.pathname==='/entry-labels.mjs')body="export const t=k=>({cancel:'Annulla',confirm:'Conferma',frame_locked_title:'Vault bloccata',frame_unlock_resume:'Sblocca e riprendi'})[k]||k;";
 else if(url.pathname==='/entry-policy.mjs')body='export const generateSecurePassword=()=>"";export const bindPasswordChecklist=()=>()=>{};';
 else if(url.pathname==='/login.html'){body='<p>Login</p>';type='text/html';}
 else{const file=resolve(root,'.'+url.pathname);if(!file.startsWith(root+sep))throw Error();body=await readFile(file);type=file.endsWith('.css')?'text/css':'text/javascript';}
 res.writeHead(200,{'Content-Type':type});res.end(body);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();server?.closeAllConnections();await new Promise(r=>server?.close(r));});
async function open(width=393,query='',name='home_page.html'){
 const context=await browser.newContext({viewport:{width,height:852}}),page=await context.newPage();
 await context.route('**/*',r=>r.request().url().startsWith(base)?r.continue():r.abort());
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/'+name+query);await page.waitForFunction(()=>window.entry);
 return {context,page,errors};
}
const release=(page,name,value)=>page.evaluate(({name,value})=>window.release(name,value),{name,value});
async function hiddenHome(page){
 assert.equal(await page.locator('.matrix-grid').count(),1);
 assert.equal(await page.locator('.matrix-grid').isVisible(),false);
 assert.equal(await page.locator('#private-entry-status').isVisible(),false);
}
async function toKey(page,route=false){
 await release(page,'identity');await page.waitForFunction(()=>window.entry.phase==='routing');
 await hiddenHome(page);assert.equal(await page.locator('body').evaluate(e=>e.hidden||e.inert),false);
 await release(page,'routing',route);await page.waitForFunction(()=>window.entry.phase==='key');
}
// Actual head gate, Home/CSS, main source fragments and Master popup. Dependencies paused with invented data.
test('real Home presentation stays neutral through identity, routing, unlock and init at phone and desktop sizes',async()=>{
 for(const width of [320,393,1280]){
 const f=await open(width);try{
 await hiddenHome(f.page);await toKey(f.page);
 await release(f.page,'key','SYNTHETIC');await f.page.waitForFunction(()=>window.entry.phase==='init');await hiddenHome(f.page);
 await release(f.page,'init');await f.page.waitForFunction(()=>window.entry.phase==='finalFence');await hiddenHome(f.page);
 await release(f.page,'finalFence',true);await f.page.waitForFunction(()=>window.entry.phase==='shown');
 assert.equal(await f.page.locator('.matrix-grid').isVisible(),true);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
 }
});
test('real Master Password modal is visible and focusable while Home is held; cancellation ends in usable resume',async()=>{
 const f=await open();try{
 await toKey(f.page);await release(f.page,'key','prompt');await f.page.locator('#protocol-input-modal.active').waitFor();
 await hiddenHome(f.page);const input=f.page.locator('#protocol-input-modal-input');assert.equal(await input.isVisible(),true);await input.focus();
 assert.equal(await input.evaluate(e=>document.activeElement===e),true);await f.page.locator('#modal-cancel-btn').click();
 await f.page.locator('#private-entry-status').waitFor();assert.equal(await f.page.locator('.matrix-grid').isVisible(),false);
 assert.equal(await f.page.locator('#private-entry-retry').isVisible(),true);assert.equal(await f.page.evaluate(()=>window.entry.clear),1);assert.equal(await f.page.evaluate(()=>window.entry.init),0);
 assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('routing failure falls back to standalone unlock and unlock failure terminates the neutral wait',async()=>{
 const f=await open();try{
 await toKey(f.page,'throw');await release(f.page,'key','throw');await f.page.locator('#private-entry-status').waitFor();
 assert.equal(await f.page.evaluate(()=>window.entry.init),0);
 assert.equal(await f.page.locator('.matrix-grid').isVisible(),false);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('standalone-once does not route, and an identity change during final fence read cannot reveal Home',async()=>{
 const f=await open(393,'?standalone=1');try{
 await release(f.page,'identity');await f.page.waitForFunction(()=>window.entry.phase==='key');
 await release(f.page,'key','SYNTHETIC');await f.page.waitForFunction(()=>window.entry.phase==='init');
 await release(f.page,'init');await f.page.waitForFunction(()=>window.entry.phase==='finalFence');
 await f.page.evaluate(()=>{window.entryAuth.currentUser={uid:'successor',emailVerified:true};});
 await release(f.page,'finalFence',true);await f.page.evaluate(()=>window.entryDone);
 assert.equal(await f.page.locator('.matrix-grid').isVisible(),false);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('a stale bootstrap error cannot reject a newer accepted attempt',async()=>{
 const f=await open();try{
 await toKey(f.page);await release(f.page,'key','SYNTHETIC');await f.page.waitForFunction(()=>window.entry.phase==='init');
 await f.page.evaluate(()=>{const gate=window.privateAuthGate;const next=gate.begin('synthetic');gate.acceptIdentity(next,window.entryAuth.currentUser);});
 await release(f.page,'init','throw');await f.page.evaluate(()=>window.entryDone);
 assert.equal(new URL(f.page.url()).pathname,'/home_page.html');
 assert.equal(await f.page.evaluate(()=>window.privateAuthGate.isReady()),true);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('the Home waiting label follows the selected catalogue before reveal',async()=>{
 const f=await open();try{
 for(const language of ['it','en','es','fr','de','pt','zh','hi']){
 const result=await f.page.evaluate(async lang=>{
  const i18n=await import('/assets/js/translations.js');await i18n.loadLanguage(lang);i18n.applyGlobalTranslations();
  return {label:document.documentElement.dataset.privateLoadingLabel,expected:i18n.t('entry_loading'),paint:getComputedStyle(document.documentElement,'::before').content};
 },language);
 assert.equal(result.label,result.expected);assert.ok(result.paint.includes(result.label));await hiddenHome(f.page);
 }
 assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

async function privateKey(page){
 await release(page,'identity');await page.waitForFunction(()=>window.entry.phase==='routing');
 await release(page,'routing',false);await page.waitForFunction(()=>window.entry.phase==='key');
}
for(const name of ['dati_azienda.html','profilo_privato.html','account_privati.html'])for(const outcome of ['empty','error','cancel'])
test('private non-Home entry blocks '+name+' after '+outcome,{timeout:20000},async()=>{
 const f=await open(393,'?id=QA_RECORD_001',name);try{
  assert.equal(await f.page.locator('#private-entry-status').count(),0,'real non-Home HTML has no prebuilt Home status');
  await privateKey(f.page);
  await release(f.page,'init');
  await release(f.page,'key',outcome==='cancel'?'prompt':outcome==='error'?'throw':null);
  if(outcome==='cancel'){await f.page.locator('#protocol-input-modal.active').waitFor();await f.page.locator('#modal-cancel-btn').click();}
  await f.page.evaluate(()=>window.entryDone);
  assert.equal(await f.page.evaluate(()=>window.entry.init),0,'missing material must stop every private initializer');
  assert.equal(await f.page.locator('#private-entry-status').count(),1);
  assert.equal(await f.page.locator('#private-entry-retry').count(),1);
  assert.equal(await f.page.locator('#private-entry-status').evaluate(e=>e.parentElement===document.body),true);
  assert.equal(await f.page.locator('#private-entry-status').isVisible(),true);
  assert.equal(await f.page.locator('#private-entry-retry').isEnabled(),true);
  assert.equal(await f.page.locator('#private-entry-status').getAttribute('role'),'status');
  assert.equal(await f.page.locator('#private-entry-retry').getAttribute('data-t'),'frame_unlock_resume');
  assert.equal(await f.page.locator('html').getAttribute('data-private-page-state'),'blocked');
  assert.equal(await f.page.locator('.base-container').isVisible(),false,'private content is hidden behind the neutral status');
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('private standalone retry retains URL, creates no duplicate status and allows a later valid unlock',{timeout:25000},async()=>{
 const f=await open(393,'?id=QA_RECORD_001&profileTab=documents#wrapper-email-section','dati_azienda.html');try{
  const original=f.page.url();await privateKey(f.page);await release(f.page,'init');await release(f.page,'key',null);await f.page.evaluate(()=>entryDone);
  assert.equal(await f.page.evaluate(()=>entry.init),0);
  await f.page.evaluate(()=>window.runEntry());
  assert.equal(await f.page.locator('#private-entry-status').count(),1);assert.equal(await f.page.locator('#private-entry-retry').count(),1);
  const navigation=f.page.waitForNavigation();await f.page.locator('#private-entry-retry').click();await navigation;
  assert.equal(f.page.url(),original,'retry preserves pathname, query and fragment');
  await f.page.waitForFunction(()=>window.entry);await privateKey(f.page);await release(f.page,'key','SYNTHETIC');
  await f.page.waitForFunction(()=>entry.phase==='init');await release(f.page,'init');await f.page.evaluate(()=>entryDone);
  assert.equal(await f.page.evaluate(()=>entry.init),1);assert.equal(await f.page.locator('html').getAttribute('data-private-page-state'),null);
  assert.equal(await f.page.locator('.base-container').isVisible(),true);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('private blocked status follows seven palettes in both liveries and sizes',{timeout:40000},async()=>{
 const f=await open(320,'?id=QA_RECORD_001','dati_azienda.html');try{
  await privateKey(f.page);await release(f.page,'init');await release(f.page,'key',null);await f.page.evaluate(()=>entryDone);
  await f.page.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
  for(const width of [320,1280])for(const graphics of ['classic','new'])for(const theme of ['light','dark'])for(const palette of ['blue','green','red','sand','petrol','lavender','dusty-rose']){
   await f.page.setViewportSize({width,height:852});
   const heading=await f.page.evaluate(({graphics,theme,palette})=>{
    const root=document.documentElement;root.dataset.uiGraphics=graphics;root.dataset.colorTheme=palette;root.classList.toggle('dark',theme==='dark');
    const probe=document.createElement('span');probe.style.color='var(--text-primary)';document.body.append(probe);
    const expected=getComputedStyle(probe).color;probe.remove();return {actual:getComputedStyle(document.querySelector('#private-entry-status h1')).color,expected};
   },{graphics,theme,palette});
   assert.equal(heading.actual,heading.expected);
   for(const paint of [{selector:'#private-entry-retry',property:'backgroundColor',role:'--rev-fill'},{selector:'#private-entry-retry',property:'color',role:'#fff',minimum:4.5}]){
    const values=await inspectDynamicPaint(f.page,paint,{graphics,theme});assert.equal(values.length,1);
    assert.equal(values[0].rolePass,true,JSON.stringify({width,graphics,theme,palette,paint,values}));
    if(paint.minimum)assert.equal(values[0].contrast.pass,true,JSON.stringify(values));
   }
   const button=f.page.locator('#private-entry-retry');await button.focus();
   assert.equal(await button.evaluate(e=>document.activeElement===e),true);
   for(const selector of ['#private-entry-status h1','#private-entry-retry']){
    const box=await f.page.locator(selector).boundingBox();assert.ok(box&&box.x>=0&&box.y>=0&&box.x+box.width<=width&&box.y+box.height<=852);
   }
   assert.equal(await f.page.locator('.base-container').isVisible(),false);
  }
  assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
