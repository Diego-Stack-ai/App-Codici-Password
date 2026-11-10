import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
const root=resolve(fileURLToPath(new URL('../Frontend/public/',import.meta.url)));
const html=(await readFile(resolve(root,'impostazioni.html'),'utf8')).replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<link[^>]+href=["']https?:[^>]+>/gi,'');
const ui=(await readFile(resolve(root,'assets/js/modules/settings/frame-diagnostics-ui.js'),'utf8')).replace(/^import .+$/gm,'');
const worker=await readFile(resolve(root,'firebase-messaging-sw.js'),'utf8');
const stateModule=`export const state=window.diagState={auth:{currentUser:{uid:'PRIVATE-SYNTHETIC-UID'}},revision:3,allowed:true,language:'it',copied:'',toasts:[]};`;
const uiModule=`import {settingsCatalogs} from '/assets/js/translations/settings.js';
import {createElement,setChildren} from '/assets/js/dom-utils.js';
import {loadFrameDiagnostics} from '/assets/js/frame-navigation.js';
import {frameDiagnostics,frameDiagnosticReport,notificationWorkerReady,observeFrameDiagnostics,frameDiagnosticContext} from '/assets/js/modules/core/vault-frame-diagnostics-runtime.js';
import {state} from '/diag-state.mjs';
const t=key=>settingsCatalogs[state.language][key]||key,tf=(key,args)=>t(key).replace('{count}',args.count);
const showToast=(...args)=>state.toasts.push(args),inactivityDiagnosticTimeout=()=>60000;
${ui}`;
const driver=`import {state} from '/diag-state.mjs';
import {emitFrameDiagnostic,clearFrameDiagnostics} from '/assets/js/frame-navigation.js';
import * as runtime from '/assets/js/modules/core/vault-frame-diagnostics-runtime.js';
import {setupFrameDiagnostics} from '/diag-ui.mjs';
import {settingsCatalogs} from '/assets/js/translations/settings.js';
Object.defineProperty(navigator,'clipboard',{value:{writeText:async value=>{state.copied=value;}}});
document.body.hidden=false;document.body.inert=false;document.documentElement.dataset.i18n='ready';document.body.style.visibility='visible';document.body.classList.add('revealed');
setupFrameDiagnostics(60000);
window.diagAPI={runtime,emit:emitFrameDiagnostic,clear:clearFrameDiagnostics,catalogs:settingsCatalogs,
 report:()=>runtime.frameDiagnosticReport({idleMs:60000,pushReady:false}),
 register:async()=>{const reg=await navigator.serviceWorker.register('/firebase-messaging-sw.js',{scope:'/firebase-cloud-messaging-push-scope/'});
 if(!reg.active)await new Promise(resolve=>{const w=reg.installing||reg.waiting;w.addEventListener('statechange',()=>{if(w.state==='activated')resolve();});});return true;},
 click:async()=>{const reg=(await navigator.serviceWorker.getRegistrations()).find(r=>r.active?.scriptURL.endsWith('/firebase-messaging-sw.js'));
 const channel=new MessageChannel();return await new Promise(resolve=>{channel.port1.onmessage=e=>{channel.port1.close();resolve(e.data);};reg.active.postMessage({fixtureClick:true},[channel.port2]);});}};
window.fixtureReady=true;`;
const workerPrefix=`let testClick;const add=self.addEventListener.bind(self);self.addEventListener=(name,handler,...rest)=>{if(name==='notificationclick')testClick=handler;return add(name,handler,...rest);};`;
const workerSuffix=`self.clients.openWindow=async()=>null;
self.addEventListener('install',e=>e.waitUntil(self.skipWaiting()));
self.addEventListener('message',e=>{if(!e.data?.fixtureClick)return;e.waitUntil((async()=>{let done;testClick({notification:{data:{eventType:'deadline',deadlineId:'SYNTHETIC-RECORD-ID',notificationId:'SYNTHETIC-NOTIFICATION-ID'},close(){}},stopImmediatePropagation(){},waitUntil:p=>{done=p;}});await done;e.ports[0].postMessage('finished');})());});`;
let server,browser,base,delayRuntime=false;const runtimeWaiters=[];
test.before(async()=>{
 server=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://local.invalid').pathname;let body,type='text/javascript';
 if(path==='/late.html'){body='<body><script type="module" src="/late-driver.mjs"></script></body>';type='text/html';}
 else if(path==='/late-driver.mjs')body="import {emitFrameDiagnostic} from '/assets/js/frame-navigation.js';sessionStorage.setItem('app_frame_diag_consent_v1',JSON.stringify({generation:'late-consent-synthetic',revision:3}));emitFrameDiagnostic('FRAME_ENTER');window.fixtureReady=true;";
 else if(path==='/app.html'||path==='/impostazioni.html'){body=html.replace('</body>','<script type="module" src="/diag-driver.mjs"></script></body>');type='text/html';}
 else if(path==='/diag-state.mjs')body=stateModule;
 else if(path==='/diag-ui.mjs')body=uiModule;
 else if(path==='/diag-driver.mjs')body=driver;
 else if(path==='/assets/js/firebase-config.js')body="import {state} from '/diag-state.mjs';export const auth=state.auth;";
 else if(path==='/assets/js/auth-session-fence.js')body="import {state} from '/diag-state.mjs';export const authSessionFence={isLocallyAllowed:()=>state.allowed,diagnosticRevision:()=>state.revision};";
 else if(path==='/firebase-messaging-sw.js')body=workerPrefix+worker+workerSuffix;
 else if(path==='/assets/js/vendor/firebase-sw-runtime.js')body='self.firebase={initializeApp(){},messaging(){return {onBackgroundMessage(){}};}};';
 else {if(delayRuntime&&path.endsWith('/vault-frame-diagnostics-runtime.js'))await new Promise(resolve=>runtimeWaiters.push(resolve));const file=resolve(root,'.'+path);if(!file.startsWith(root+sep))throw Error('OUTSIDE');body=await readFile(file);if(path.endsWith('.css'))type='text/css';}
 res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store','Service-Worker-Allowed':'/'});res.end(body);
 }catch{res.writeHead(404);res.end();}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:true});
});
test.after(async()=>{await browser?.close();await new Promise(resolve=>server?.close(resolve));});
async function fixture(path='/impostazioni.html?record=PRIVATE-QUERY#PRIVATE-HASH',blocked=false){
 const context=await browser.newContext(),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',route=>route.request().url().startsWith(base)?route.continue():route.abort());
 await page.addInitScript(()=>{window.diagWrites=[];for(const method of ['setItem','removeItem']){const original=Storage.prototype[method];Storage.prototype[method]=function(key,...args){if(key.startsWith('app_frame_diag_'))window.diagWrites.push([method,key]);return original.call(this,key,...args);};}});
 if(blocked)await page.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw Error('DENIED');}});});
 await page.goto(base+path);await page.waitForFunction(()=>window.fixtureReady);
 return {context,page,errors};
}
test('real Settings DIAG starts off, writes nothing and translates all eight languages',async()=>{
 const f=await fixture();try{
 assert.equal(await f.page.locator('#frame-diagnostics-toggle').isChecked(),false);
 assert.deepEqual(await f.page.evaluate(()=>window.diagWrites),[]);
 for(const language of ['it','en','es','fr','de','zh','hi','pt']){
  await f.page.evaluate(lang=>{diagState.language=lang;window.dispatchEvent(new Event('app-language-applied'));},language);
  const label=await f.page.locator('#frame-diagnostics-summary strong').first().textContent();assert.equal(label,await f.page.evaluate(lang=>diagAPI.catalogs[lang].frame_diag_version,language));
 }
 assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('opt-in, copy and clear use the closed report and preserve Vault-independent state',async()=>{
 const f=await fixture();try{
 await f.page.locator('#frame-diagnostics-toggle').check();
 await f.page.evaluate(()=>diagAPI.emit('FRAME_ENTER'));
 await f.page.waitForFunction(()=>diagAPI.report().events.length===1);
 await f.page.locator('#btn-copy-frame-diagnostics').click();await f.page.waitForFunction(()=>diagState.copied);
 const text=await f.page.evaluate(()=>diagState.copied),report=JSON.parse(text);
 assert.equal(report.state.active,false);assert.equal(report.state.permitValid,false);assert.equal(report.state.idleMs,60000);
 assert.equal(report.events[0].page,'impostazioni.html');assert.deepEqual(Object.keys(report.events[0]).sort(),['at','code','environment','page','version']);
 for(const value of ['PRIVATE-SYNTHETIC-UID','PRIVATE-QUERY','PRIVATE-HASH','http:','record=','uid','nonce','generation'])assert.equal(text.includes(value),false,value);
 await f.page.locator('#btn-clear-frame-diagnostics').click();assert.equal(await f.page.evaluate(()=>diagAPI.report().events.length),0);assert.equal(await f.page.locator('#frame-diagnostics-toggle').isChecked(),true);
 assert.equal(await f.page.evaluate(()=>diagState.allowed),true);assert.equal(await f.page.evaluate(()=>diagState.auth.currentUser.uid),'PRIVATE-SYNTHETIC-UID');
 await f.page.locator('#frame-diagnostics-toggle').uncheck();const writes=await f.page.evaluate(()=>diagWrites.length);
 await f.page.evaluate(()=>diagAPI.emit('FRAME_EXIT'));await f.page.waitForTimeout(40);assert.equal(await f.page.evaluate(()=>diagWrites.length),writes);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
test('actual private-auth-blocked cleanup removes consent and journal before any later append',async()=>{
 const f=await fixture();try{
 await f.page.locator('#frame-diagnostics-toggle').check();await f.page.evaluate(()=>diagAPI.emit('FRAME_ENTER'));await f.page.waitForFunction(()=>diagAPI.report().events.length===1);
 await f.page.evaluate(()=>{window.dispatchEvent(new Event('private-auth-blocked'));diagAPI.emit('FRAME_EXIT');});
 assert.deepEqual(await f.page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('app_frame_diag_'))),[]);
 assert.equal(await f.page.locator('#frame-diagnostics-toggle').isChecked(),false);assert.deepEqual(await f.page.evaluate(()=>diagAPI.report().events),[]);
 }finally{await f.context.close();}
});
test('changed UID and successor fence cannot read or resurrect the prior account log',async()=>{
 const f=await fixture();try{
 await f.page.locator('#frame-diagnostics-toggle').check();await f.page.evaluate(()=>diagAPI.emit('FRAME_ENTER'));await f.page.waitForFunction(()=>diagAPI.report().events.length===1);
 await f.page.evaluate(()=>{diagState.auth.currentUser={uid:'ANOTHER-PRIVATE-UID'};diagAPI.emit('FRAME_EXIT');});
 assert.deepEqual(await f.page.evaluate(()=>diagAPI.report().events),[]);
 await f.page.evaluate(()=>{diagAPI.runtime.observeFrameDiagnostics();diagState.revision++;});
 assert.deepEqual(await f.page.evaluate(()=>Object.keys(sessionStorage).filter(k=>k.startsWith('app_frame_diag_'))),[]);
 assert.equal(await f.page.evaluate(()=>diagAPI.runtime.frameDiagnostics.enabled()),false);
 }finally{await f.context.close();}
});
test('journal survives a same-user tab reload and removes expired events before copy',async()=>{
 const f=await fixture();try{
 await f.page.locator('#frame-diagnostics-toggle').check();await f.page.evaluate(()=>diagAPI.emit('FRAME_ENTER'));await f.page.waitForFunction(()=>diagAPI.report().events.length===1);
 await f.page.reload();await f.page.waitForFunction(()=>window.fixtureReady);assert.equal(await f.page.locator('#frame-diagnostics-toggle').isChecked(),true);assert.deepEqual(await f.page.evaluate(()=>diagAPI.report().events.map(e=>e.code)),['FRAME_ENTER','FRAME_EXIT']);
 await f.page.evaluate(()=>{const key='app_frame_diag_events_v1',record=JSON.parse(sessionStorage.getItem(key));for(const event of record.events)event.at=Date.now()-7*86400000;sessionStorage.setItem(key,JSON.stringify(record));});
 await f.page.locator('#btn-copy-frame-diagnostics').click();await f.page.waitForFunction(()=>diagState.copied);assert.deepEqual(JSON.parse(await f.page.evaluate(()=>diagState.copied)).events,[]);
 }finally{await f.context.close();}
});
test('native FCM diagnostic probe and fallback outcomes are local, bounded and contain no destination IDs',async()=>{
 const f=await fixture('/app.html');try{
 await f.page.locator('#frame-diagnostics-toggle').check();await f.page.evaluate(()=>diagAPI.register());
 assert.equal(await f.page.evaluate(()=>diagAPI.runtime.notificationWorkerReady()),true);
 await f.page.evaluate(()=>diagAPI.click());await f.page.waitForFunction(()=>diagAPI.report().events.some(e=>e.code==='PUSH_FALLBACK_RESOLVED'));
 const report=await f.page.evaluate(()=>diagAPI.report());assert.deepEqual(report.events.map(e=>e.code),['PUSH_FALLBACK_REQUESTED','PUSH_FALLBACK_RESOLVED']);
 const text=JSON.stringify(report);for(const value of ['SYNTHETIC-RECORD-ID','SYNTHETIC-NOTIFICATION-ID','received','requestId','PRIVATE'])assert.equal(text.includes(value),false,value);
 assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});

test('a lazy diagnostic import resolving after pagehide cannot resurrect the old document ledger',async()=>{
 delayRuntime=true;const f=await fixture('/late.html');try{
 await f.page.evaluate(()=>window.dispatchEvent(new Event('pagehide')));
 delayRuntime=false;for(const resolve of runtimeWaiters.splice(0))resolve();
 await f.page.waitForTimeout(150);
 assert.equal(await f.page.evaluate(()=>sessionStorage.getItem('app_frame_diag_events_v1')),null);assert.deepEqual(f.errors,[]);
 }finally{delayRuntime=false;for(const resolve of runtimeWaiters.splice(0))resolve();await f.context.close();}
});
test('denied session storage leaves the controls off and copyable diagnostics empty, without fallback writes',async()=>{
 const f=await fixture('/impostazioni.html',true);try{
 await f.page.locator('#frame-diagnostics-toggle').click();assert.equal(await f.page.locator('#frame-diagnostics-toggle').isChecked(),false);
 await f.page.locator('#btn-copy-frame-diagnostics').click();await f.page.waitForFunction(()=>diagState.copied);
 const value=JSON.parse(await f.page.evaluate(()=>diagState.copied));assert.equal(value.available,false);assert.deepEqual(value.events,[]);assert.deepEqual(f.errors,[]);
 }finally{await f.context.close();}
});
