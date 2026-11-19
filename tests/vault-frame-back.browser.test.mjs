import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTourHarness} from '../scripts/lib/view-tour-harness.mjs';

const shell=(await readFile(new URL('../Frontend/public/app.html',import.meta.url),'utf8'))
 .replace(/<script\b[\s\S]*?<\/script>/gi,'')
 .replace('</body>','<script type="module" src="/__back-parent.mjs"></script></body>');
const parentModule=`
import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
import {APP_VERSION} from '/assets/js/app-env.js';
document.body.hidden=false;document.body.inert=false;document.querySelector('#frame-loading').hidden=true;
window.backProbe={id:crypto.randomUUID(),unlocks:0,clears:0,locks:[]};
sessionStorage.setItem('back-owner-loads',String(Number(sessionStorage.getItem('back-owner-loads')||0)+1));
const iframe=document.querySelector('#vault-frame');
window.backOwner=createVaultFrameOwner({window,iframe,release:APP_VERSION,
 getIdentity:()=>({uid:'synthetic-local-only',epoch:'1:fence'}),validateIdentity:async()=>true,
 readPermit:async()=>({enabled:true,uid:'synthetic-local-only',version:1,expiresAt:Date.now()+3600000}),
 readTimeout:async()=>720,unlock:async()=>{backProbe.unlocks++;return 'SYNTHETIC-MATERIAL';},
 clearMaterial:()=>backProbe.clears++,confirmSensitive:async()=>true,
 onState:s=>{if(s.locked)backProbe.locks.push(s.reason);}});
iframe.addEventListener('load',()=>iframe.contentWindow?.postMessage('view-tour-frame-loaded',location.origin));
await backOwner.start(new URL(location.href).searchParams.get('route')||'/home_page.html');window.backStarted=true;`;
let harness;
test.before(async()=>{harness=await createTourHarness({memory:true,frameIntegration:true,localFixtures:{
 '/app.html':{type:'text/html',body:shell},'/__back-parent.mjs':{type:'text/javascript',body:parentModule},
 '/login.html':{type:'text/html',body:'<!doctype html><title>Local synthetic login predecessor</title>'}
}});});
test.after(async()=>{await harness?.close();});
const child=f=>f.page.frames().find(frame=>frame.parentFrame()===f.page.mainFrame());
async function ready(f,file){
 try{
  await f.page.waitForFunction(file=>{
   const iframe=document.querySelector('#vault-frame'),win=iframe?.contentWindow;
   const outer=new URL(location.href),actual=win?win.location.pathname+win.location.search+win.location.hash:null;
   return outer.pathname==='/app.html'&&outer.searchParams.get('route')===actual&&!!window.backStarted&&iframe?.style.visibility==='visible'&&win?.location.pathname==='/'+file&&win?.__viewTour?.ready;
  },file,{timeout:10000});
  assert.equal(await child(f).evaluate(()=>window.__viewTour?.bootError),undefined,'real page boot must succeed before the navigation assertion');
 }catch(error){
  const actual=await f.page.evaluate(()=>({path:location.pathname,probe:window.backProbe,
   frame:document.querySelector('iframe')?.contentWindow?.location.pathname,
   bootError:document.querySelector('iframe')?.contentWindow?.__viewTour?.bootError})).catch(()=>({gone:true}));
  assert.fail('Real header return must retain the frame at '+file+': '+JSON.stringify(actual)+'; '+error.message);
 }
}
async function fixture(initial='home_page.html'){
 const f=await harness.open('home_page.html',{graphics:'tre-livelli',theme:'light',palette:'lavender'});
 try{
  await f.page.goto(harness.base+'/login.html');
  await f.page.goto(harness.base+'/app.html?route='+encodeURIComponent('/'+initial));
  await ready(f,initial);
  f.ownerId=await f.page.evaluate(()=>backProbe.id);
  return f;
 }catch(error){await f.context.close();throw error;}
}
async function intact(f){
 const value=await f.page.evaluate(()=>({id:window.backProbe?.id,unlocks:window.backProbe?.unlocks,
  clears:window.backProbe?.clears,locks:window.backProbe?.locks,loads:sessionStorage.getItem('back-owner-loads'),
  errors:document.querySelector('iframe')?.contentWindow?.__viewTour?.errors}));
 assert.equal(value.id,f.ownerId,'same parent document');assert.equal(value.loads,'1','no parent reload');
 assert.equal(value.unlocks,1,'one unlock for the whole owner');assert.equal(value.clears,0);assert.deepEqual(value.locks,[]);
 assert.deepEqual(value.errors,[],'no asynchronous child errors');
}
const back=f=>child(f).locator('#header-left button.btn-icon-header').click();

test('real header and cleanup: repeated Profile tab returns keep one unlock and the parent',{timeout:90000},async()=>{
 const f=await fixture();
 try{
  for(let i=0;i<3;i++){
   await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
   await child(f).locator('#profile-tab-personal').click();await child(f).locator('#profile-tab-addresses').click();
   await f.page.setViewportSize({width:852,height:393});await f.page.setViewportSize({width:393,height:852});
   await back(f);await ready(f,'home_page.html');await intact(f);
  }
 }finally{await f.context.close();}
});

test('Profile entered directly falls back inside the owner instead of its login predecessor',{timeout:45000},async()=>{
 const f=await fixture('profilo_privato.html');
 try{await back(f);await ready(f,'home_page.html');await intact(f);}finally{await f.context.close();}
});

test('real Settings entry retains the previous route, query, fragment and browser Forward/Back',{timeout:60000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('a[href="area_privata.html"]').click();await ready(f,'area_privata.html');
  await child(f).locator('a[href="impostazioni.html"]').click();await ready(f,'impostazioni.html');
  await child(f).locator('#digital-card-settings-link').click();await ready(f,'profilo_privato.html');
  assert.equal(await child(f).locator('#profile-tab-digital-card').getAttribute('aria-selected'),'true');
  await child(f).evaluate(()=>history.replaceState(null,'',location.pathname+location.search+'#documenti-view-container'));
  await back(f);await ready(f,'impostazioni.html');await intact(f);
  await f.page.goForward();await ready(f,'profilo_privato.html');
  const route=await child(f).evaluate(()=>location.search+location.hash);
  assert.ok(route.includes('profileTab=digital-card'));assert.ok(route.endsWith('#documenti-view-container'));
  await f.page.goBack();await ready(f,'impostazioni.html');await intact(f);
  await back(f);await ready(f,'area_privata.html');await intact(f);
 }finally{await f.context.close();}
});

for(const direct of [false,true])test('real standalone header with cleanup preserves '+(direct?'hierarchical fallback':'internal previous page'),{timeout:45000},async()=>{
 const f=await harness.open('home_page.html');
 try{
  const expected=direct?harness.base+'/home_page.html':f.page.url();
  if(direct){await f.page.goto(harness.base+'/login.html');await f.page.goto(harness.base+'/profilo_privato.html');}
  else await f.page.locator('.header-greeting-trigger').click();
  await f.page.waitForFunction(()=>location.pathname==='/profilo_privato.html'&&window.__viewTour?.ready);
  await f.page.locator('#header-left button.btn-icon-header').click();
  await f.page.waitForURL(expected);
  await f.page.waitForFunction(()=>window.__viewTour?.ready);
  assert.equal(new URL(f.page.url()).pathname,'/home_page.html');
 }finally{await f.context.close();}
});

test('unrecognized owner history falls back inside the frame',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('a[href="impostazioni.html"]').click();await ready(f,'impostazioni.html');
  await child(f).locator('#digital-card-settings-link').click();await ready(f,'profilo_privato.html');
  await f.page.evaluate(()=>history.replaceState({frameNavigationOwner:'unrecognized',frameNavigationEntry:1},'',location.href));
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

test('duplicate Back requests are consumed while the real traversal is pending',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
  const accepted=await f.page.evaluate(()=>{const frame=document.querySelector('iframe'),nav=window.vaultFrameNavigation;
   return [nav.backFromChild(frame.contentWindow,frame.contentDocument,'/home_page.html',true),
    nav.backFromChild(frame.contentWindow,frame.contentDocument,'/home_page.html',true)];});
  assert.deepEqual(accepted,[true,true]);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

for(const failure of ['missing','throw'])test('Back has a finite in-frame fallback when traversal is '+failure,{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
  // Fault injection only in these two cases; ordinary path tests use native history.
  await f.page.evaluate(failure=>{history.back=()=>{if(failure==='throw')throw Error('SYNTHETIC_HISTORY_FAILURE');};},failure);
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});

test('stale document, external fallback, logout hold and lock cannot reopen through Back',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await f.page.evaluate(()=>window.staleBackDocument=document.querySelector('iframe').contentDocument);
  await child(f).locator('.header-greeting-trigger').click();await ready(f,'profilo_privato.html');
  const result=await f.page.evaluate(()=>{const frame=document.querySelector('iframe'),nav=window.vaultFrameNavigation;
   return {stale:nav.backFromChild(frame.contentWindow,staleBackDocument,'/home_page.html',true),
    external:nav.backFromChild(frame.contentWindow,frame.contentDocument,'https://example.invalid/',true)};});
  assert.deepEqual(result,{stale:false,external:true});await ready(f,'profilo_privato.html');await intact(f);
  await f.page.evaluate(()=>{const frame=document.querySelector('iframe');window.vaultFrameNavigation.beginLogoutFromChild(frame.contentWindow,frame.contentDocument);});
  await back(f);await ready(f,'profilo_privato.html');await intact(f);
  const locked=await f.page.evaluate(()=>{const frame=document.querySelector('iframe'),source=frame.contentWindow,doc=frame.contentDocument;
   backOwner.session.lock('synthetic-lock');
   return {accepted:window.vaultFrameNavigation.backFromChild(source,doc,'/home_page.html',true),
    unlocked:backOwner.session.state().unlocked,unlocks:backProbe.unlocks,clears:backProbe.clears};});
  // Logout deliberately retains the revoked child until cleanup; true consumes
  // its Back without reopening or granting anything.
  assert.deepEqual(locked,{accepted:true,unlocked:false,unlocks:1,clears:1});
 }finally{await f.context.close();}
});

test('an unheld lock removes the child and rejects its stale Back',{timeout:45000},async()=>{
 const f=await fixture('profilo_privato.html');
 try{
  const value=await f.page.evaluate(()=>{const frame=document.querySelector('iframe'),source=frame.contentWindow,doc=frame.contentDocument;
   backOwner.session.lock('synthetic-lock');
   return {accepted:window.vaultFrameNavigation.backFromChild(source,doc,'/home_page.html',true),
    unlocked:backOwner.session.state().unlocked,unlocks:backProbe.unlocks,clears:backProbe.clears,removed:!frame.isConnected};});
  assert.deepEqual(value,{accepted:false,unlocked:false,unlocks:1,clears:1,removed:true});
 }finally{await f.context.close();}
});

for(const method of ['push','hash','native'])test('unmanaged child '+method+' uses a safe in-frame Back fallback',{timeout:45000},async()=>{
 const f=await fixture();
 try{
  await child(f).locator('a[href="area_privata.html"]').click();await ready(f,'area_privata.html');
  await child(f).locator('a[href="impostazioni.html"]').click();await ready(f,'impostazioni.html');
  await child(f).locator('#digital-card-settings-link').click();await ready(f,'profilo_privato.html');
  if(method==='push')await child(f).evaluate(()=>history.pushState(null,'',location.pathname+location.search+'#documenti-view-container'));
  else if(method==='hash')await child(f).evaluate(()=>{location.hash='documenti-view-container';});
  else {
   await child(f).evaluate(()=>{location.href='/profilo_privato.html?profileTab=personal';});
   await child(f).waitForURL(harness.base+'/profilo_privato.html?profileTab=personal');
  }
  await ready(f,'profilo_privato.html');
  if(method==='hash')await f.page.waitForFunction(()=>new URL(location.href).searchParams.get('route').endsWith('#documenti-view-container'));
  await back(f);await ready(f,'home_page.html');await intact(f);
 }finally{await f.context.close();}
});
