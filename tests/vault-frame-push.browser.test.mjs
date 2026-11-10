import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {chromium} from 'playwright';

// Real worker/WindowClients/MessageChannel and broker. Synthetic click driver,
// Auth/admission and vendor stub: no FCM network or physical notification.
const root=resolve(fileURLToPath(new URL('../Frontend/public/',import.meta.url)));
const workerSource=await readFile(resolve(root,'firebase-messaging-sw.js'),'utf8');
const driverPrefix=`let fixtureClick;const originalAdd=self.addEventListener.bind(self);
self.addEventListener=(name,fn,...rest)=>{if(name==='notificationclick')fixtureClick=fn;return originalAdd(name,fn,...rest);};`;
const driverSuffix=`
self.fixtureMetrics={opened:[],clicks:0};
self.clients.openWindow=async target=>{self.fixtureMetrics.opened.push(target);return null;};
self.fixtureClick=async data=>{let done=Promise.resolve();self.fixtureMetrics.clicks++;
fixtureClick({notification:{data,close(){}},stopImmediatePropagation(){},waitUntil:p=>{done=p;}});await done;return self.fixtureMetrics;};
self.fixtureIntent=async path=>{const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 const target=clients.find(client=>new URL(client.url).pathname==='/app.html'&&client.frameType==='top-level');
 if(!target)return null;const channel=new MessageChannel();return new Promise(resolve=>{
 const timer=setTimeout(()=>{channel.port1.close();resolve(null);},250);
 channel.port1.onmessage=event=>{clearTimeout(timer);channel.port1.close();resolve(event.data);};
 target.postMessage({protocol:'vault-frame-push/v1',kind:'navigate',requestId:'synthetic-request-00000002',expiresAt:Date.now()+1500,path},[channel.port2]);});};
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));`;
const offlineWorker=`self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
${driverSuffix.replace(/self\.fixtureClick=async data=>[\s\S]*?return self\.fixtureMetrics;\};/,'')}`;
const parentHtml='<!doctype html><html><head><script type="module" src="/parent-fixture.mjs"></script></head><body><div data-frame-safe-area style="padding:0"></div><iframe id="vault-frame" hidden inert></iframe></body></html>';
const childHtml='<!doctype html><html><head><script type="module" src="/child-fixture.mjs"></script></head><body>synthetic child</body></html>';
const standaloneHtml='<!doctype html><html><body>synthetic standalone</body></html>';
const parentModule=`import {createVaultFrameOwner} from '/assets/js/modules/core/vault-frame-owner.mjs';
import {installFramePushNavigation} from '/assets/js/modules/core/vault-frame-push.mjs';
window.fixture={runId:crypto.randomUUID(),unlocks:0,uid:'synthetic',epoch:'fence-1',fence:true,allowed:true,hold:false,pending:[],reads:0};
const state=window.fixture;
window.releaseAdmission=()=>{state.hold=false;for(const resolve of state.pending.splice(0))resolve();};
await navigator.serviceWorker.register('/offline-fixture-sw.js',{scope:'/'});await navigator.serviceWorker.ready;
if(!navigator.serviceWorker.controller)await new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true}));
const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/firebase-cloud-messaging-push-scope-r3/'});
if(!registration.active)await new Promise(resolve=>{const worker=registration.installing||registration.waiting;const check=()=>{if(worker.state==='activated')resolve();};worker.addEventListener('statechange',check);check();});
let stop=()=>{};const owner=createVaultFrameOwner({window,iframe:document.querySelector('iframe'),release:'fixture',
 getIdentity:()=>({uid:state.uid,epoch:state.epoch}),validateIdentity:async()=>state.fence,readTimeout:async()=>3,
 readPermit:async()=>{state.reads++;if(state.hold)await new Promise(resolve=>state.pending.push(resolve));return {enabled:state.allowed,uid:'synthetic',version:1,expiresAt:Date.now()+3600000};},
 unlock:async()=>{state.unlocks++;return 'SYNTHETIC-MATERIAL';},clearMaterial(){},onState:s=>{if(s.locked)stop();}});
window.frameOwner=owner;stop=installFramePushNavigation({window,owner});await owner.start('/home_page.html');window.fixtureStarted=true;`;
const childModule=`import {createFrameTransport} from '/assets/js/modules/core/vault-frame-transport.mjs';
const client=createFrameTransport({window,release:'fixture',enabled:true});
await client.request('key');window.fixtureChildReady=true;`;
let server,browser,base;
test.before(async()=>{
 server=createServer(async(req,res)=>{try{
 const path=new URL(req.url,'http://fixture.invalid').pathname;let body,type='text/javascript';
 if(path==='/app.html'){body=parentHtml;type='text/html';}
 else if(path.endsWith('.html')){body=req.headers['sec-fetch-dest']==='iframe'?childHtml:standaloneHtml;type='text/html';}
 else if(path==='/parent-fixture.mjs')body=parentModule;
 else if(path==='/child-fixture.mjs')body=childModule;
 else if(path==='/firebase-messaging-sw.js')body=driverPrefix+workerSource+driverSuffix;
 else if(path==='/offline-fixture-sw.js')body=offlineWorker;
 else if(path==='/assets/js/vendor/firebase-sw-runtime.js')body='self.firebase={initializeApp(){},messaging(){return {onBackgroundMessage(){}};}};';
 else{const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error('DENIED');body=await readFile(file);}
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Service-Worker-Allowed':'/'});res.end(body);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();await new Promise(done=>server?.close(done));});
async function fixture(){
 const context=await browser.newContext(),page=await context.newPage();
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 await page.goto(base+'/app.html');
 try {await page.waitForFunction(()=>window.fixtureStarted&&window.fixture.unlocks===1&&document.querySelector('iframe').style.visibility==='visible',{},{timeout:10000});}
 catch(error){await context.close();throw Error(error.message+' '+JSON.stringify(errors));}
 const worker=context.serviceWorkers().find(worker=>worker.url()===base+'/firebase-messaging-sw.js');assert.ok(worker);
 return {context,page,worker,errors,child:()=>page.frames().find(frame=>frame!==page.mainFrame()),click:data=>worker.evaluate(data=>self.fixtureClick(data),data)};
}
test('real messaging worker routes two notifications into the child without replacing the parent or key',async()=>{
 const f=await fixture();try{
 const runId=await f.page.evaluate(()=>window.fixture.runId);
 assert.equal(await f.page.evaluate(()=>navigator.serviceWorker.controller.scriptURL),base+'/offline-fixture-sw.js');
 for(const [data,route]of [
  [{eventType:'deadline',deadlineId:'owned',notificationId:'n1'},'/dettaglio_scadenza.html?id=owned&notification=n1'],
  [{eventType:'external_deadline',receivedDeadlineId:'received',notificationId:'n2'},'/dettaglio_scadenza.html?received=received&notification=n2']]){
  const result=await f.click(data);assert.deepEqual(result.opened,[]);
  await f.child().waitForFunction(()=>window.fixtureChildReady);
  assert.equal(new URL(f.page.url()).searchParams.get('route'),route);
  assert.equal(await f.page.evaluate(()=>window.fixture.runId),runId);assert.equal(await f.page.evaluate(()=>window.fixture.unlocks),1);
 }
 assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('locked frame requests one fallback and never directly navigates the parent',async()=>{
 const f=await fixture();try{
 const runId=await f.page.evaluate(()=>window.fixture.runId);await f.page.evaluate(()=>window.frameOwner.session.lock('fixture'));
 const result=await f.click({eventType:'deadline',deadlineId:'owned'});
 assert.deepEqual(result.opened,[base+'/dettaglio_scadenza.html?id=owned']);assert.equal(await f.page.evaluate(()=>window.fixture.runId),runId);
 assert.equal(await f.page.evaluate(()=>window.fixture.unlocks),1);
 }finally{await f.context.close();}
});
test('no frame preserves actual ordinary WindowClient navigation',async()=>{
 const context=await browser.newContext(),page=await context.newPage();try{
 await page.goto(base+'/ordinary.html');await page.evaluate(async()=>{
 const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/firebase-cloud-messaging-push-scope-r3/'});
 if(!registration.active)await new Promise(resolve=>{const worker=registration.installing||registration.waiting;const check=()=>{if(worker.state==='activated')resolve();};worker.addEventListener('statechange',check);check();});
 });
 await page.goto(base+'/firebase-cloud-messaging-push-scope-r3/ordinary.html');
 const worker=context.serviceWorkers().find(worker=>worker.url()===base+'/firebase-messaging-sw.js');
 const clicked=worker.evaluate(()=>self.fixtureClick({eventType:'deadline',deadlineId:'owned'}));
 await page.waitForURL(base+'/dettaglio_scadenza.html?id=owned',{timeout:5000});await clicked;
 assert.equal(await page.locator('iframe').count(),0);
 }finally{await context.close();}
});
test('an ordinary client outside FCM scope retains navigation or the native-error fallback',async()=>{
 const context=await browser.newContext(),page=await context.newPage();try{
 await page.goto(base+'/ordinary.html');await page.evaluate(async()=>{
 const registration=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/firebase-cloud-messaging-push-scope-r3/'});
 if(!registration.active)await new Promise(resolve=>{const worker=registration.installing||registration.waiting;const check=()=>{if(worker.state==='activated')resolve();};worker.addEventListener('statechange',check);check();});
 });
 const worker=context.serviceWorkers().find(worker=>worker.url()===base+'/firebase-messaging-sw.js');
 const result=await worker.evaluate(()=>self.fixtureClick({eventType:'deadline',deadlineId:'owned'}));
 if(result.opened.length)assert.deepEqual(result.opened,[base+'/dettaglio_scadenza.html?id=owned']);
 else await page.waitForURL(base+'/dettaglio_scadenza.html?id=owned',{timeout:5000});
 assert.equal(await page.locator('iframe').count(),0);
 }finally{await context.close();}
});
test('native messages from the wrong worker or with a non-allowlisted path are ignored',async()=>{
 const f=await fixture();try{
 const url=f.page.url();const wrong=f.context.serviceWorkers().find(worker=>worker.url().endsWith('/offline-fixture-sw.js'));
 assert.equal(await wrong.evaluate(()=>self.fixtureIntent('/dettaglio_scadenza.html?id=owned')),null);
 assert.equal(await f.worker.evaluate(()=>self.fixtureIntent('/impostazioni.html')),null);
 assert.equal(f.page.url(),url);assert.equal(await f.page.evaluate(()=>window.fixture.unlocks),1);
 }finally{await f.context.close();}
});
test('an admission completing after the worker deadline cannot navigate late',async()=>{
 const f=await fixture();try{
 const url=f.page.url();await f.page.evaluate(()=>{window.fixture.hold=true;});const clicked=f.click({eventType:'deadline',deadlineId:'late'});
 await f.page.waitForFunction(()=>window.fixture.pending.length>0);const result=await clicked;
 assert.deepEqual(result.opened,[base+'/dettaglio_scadenza.html?id=late']);
 await f.page.evaluate(()=>window.releaseAdmission());await f.page.waitForTimeout(100);
 assert.equal(f.page.url(),url);assert.equal(await f.page.evaluate(()=>window.fixture.unlocks),1);
 }finally{await f.context.close();}
});
test('revocation, identity, visibility or child replacement during admission rejects the pending intent',async()=>{
 for(const mode of ['revoke','document','auth','uid','hidden']){
 const f=await fixture();try{
 await f.page.evaluate(()=>{window.fixture.hold=true;});const clicked=f.click({eventType:'deadline',deadlineId:'stale'});
 await f.page.waitForFunction(()=>window.fixture.pending.length>0);
 await f.page.evaluate(mode=>{
  if(mode==='revoke')window.frameOwner.session.lock('fixture');
  if(mode==='document'){const frame=document.querySelector('iframe');window.vaultFrameNavigation.navigateFromChild(frame.contentWindow,frame.contentDocument,'/area_privata.html',false);}
  if(mode==='auth')window.fixture.fence=false;if(mode==='uid')window.fixture.uid='other';
  if(mode==='hidden'){Object.defineProperty(document,'hidden',{value:true,configurable:true});document.dispatchEvent(new Event('visibilitychange'));}
  window.releaseAdmission();
 },mode);
 const result=await clicked;assert.equal(result.opened.length,1);
 assert.notEqual(new URL(f.page.url()).searchParams.get('route'),'/dettaglio_scadenza.html?id=stale');
 }finally{await f.context.close();}
 }
});
