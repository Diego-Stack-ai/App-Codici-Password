import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createFramePermitWatcher, framePermitFromSnapshot, FRAME_POLICY_PATH, FRAME_PERMIT_LEASE_MS, FRAME_PERMIT_RENEW_WINDOW_MS} from '../Frontend/public/assets/js/modules/core/vault-frame-permit.mjs';
import {createFrameSession} from '../Frontend/public/assets/js/modules/core/vault-frame-session.mjs';
import {createFrameTransport} from '../Frontend/public/assets/js/modules/core/vault-frame-transport.mjs';
import * as framePolicy from '../Frontend/public/assets/js/modules/core/vault-frame-policy.mjs';
import {frameLockCode} from '../Frontend/public/assets/js/modules/core/vault-frame-diagnostics.mjs';
const {FRAME_PROTOCOL, FRAME_ANCHORS, privateFrameUrl, consumeFrameStandaloneMarker} = framePolicy;
const pause=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const snapshot=(data={},metadata={})=>({metadata:{fromCache:false,hasPendingWrites:false,...metadata},exists:()=>true,
 data:()=>({schemaVersion:2,version:2,enabled:true,...data})});
function fixture(uid='synthetic'){let next,error;const state={current:true,visible:true,reads:0,stops:0,denies:0,now:1000,server:async()=>snapshot(),timers:[]};
 const watcher=createFramePermitWatcher({uid,now:()=>state.now,isCurrent:()=>state.current,canRefresh:()=>state.visible,
  setTimer:fn=>{state.timers.push(fn);return 1;},clearTimer(){},onDeny:()=>{state.denies++;state.onDeny?.();},
  subscribe:(n,e)=>{next=n;error=e;return()=>state.stops++;},readServer:()=>{state.reads++;return state.server();}});
 return {state,watcher,next:v=>next(v),error:()=>error()};}
for(const bad of [{enabled:false},{enabled:'true'},{uid:'synthetic'},{version:1},{schemaVersion:1},{expiresAt:{toMillis:()=>1000}},{unknown:true}])
 test('policy payload denies '+JSON.stringify(bad),()=>assert.equal(framePermitFromSnapshot(snapshot(bad),'synthetic',1000),null));
for(const meta of [{fromCache:true},{hasPendingWrites:true}])test('metadata cannot authorize '+JSON.stringify(meta),()=>assert.equal(framePermitFromSnapshot(snapshot({},meta),'synthetic',1000),null));

test('the exact global v2 policy issues isolated finite v1 RAM permits for current users',async()=>{
 const one=fixture('first-synthetic'),two=fixture('second-synthetic');one.next(snapshot());two.next(snapshot());
 const first=await one.watcher.read('first-synthetic'),second=await two.watcher.read('second-synthetic');
 assert.deepEqual(first,{enabled:true,version:1,uid:'first-synthetic',expiresAt:301000});
 assert.equal(second.uid,'second-synthetic');assert.equal(second.expiresAt,first.expiresAt);
 assert.equal(await one.watcher.read('second-synthetic'),null);assert.equal(await two.watcher.read('first-synthetic'),null);
 one.next(snapshot({enabled:false}));assert.equal(await one.watcher.read('first-synthetic'),null);
 assert.equal((await two.watcher.read('second-synthetic')).uid,'second-synthetic');
 two.next(snapshot({enabled:false}));assert.equal(await two.watcher.read('second-synthetic'),null);
 for(const uid of ['',null,undefined,'x'.repeat(129)])assert.equal(framePermitFromSnapshot(snapshot(),uid,1000),null);
 for(const time of [NaN,Infinity,Number.MAX_VALUE])assert.equal(framePermitFromSnapshot(snapshot(),'synthetic',time),null);
 const legacy=snapshot();legacy.data=()=>({schemaVersion:1,version:1,uid:'synthetic',enabled:true,expiresAt:{toMillis:()=>900000}});
 assert.equal(framePermitFromSnapshot(legacy,'synthetic',1000),null);
 for(const missing of ['schemaVersion','version','enabled']){
  const incomplete=snapshot(),data=incomplete.data();delete data[missing];incomplete.data=()=>data;
  assert.equal(framePermitFromSnapshot(incomplete,'synthetic',1000),null);
 }
 one.watcher.dispose();two.watcher.dispose();
});

test('RAM reads never extend the lease and renewal begins only in its last minute, coalesced',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());const initial=await f.watcher.read('synthetic');
 f.state.now=initial.expiresAt-FRAME_PERMIT_RENEW_WINDOW_MS-1;
 for(let i=0;i<100;i++)assert.equal((await f.watcher.read('synthetic')).expiresAt,initial.expiresAt);
 assert.equal(f.state.reads,0);f.state.now++;f.state.server=()=>pending.promise;
 const a=f.watcher.read('synthetic'),b=f.watcher.read('synthetic'),fresh=f.watcher.read('synthetic',{fresh:true});
 assert.equal(f.state.reads,1);pending.resolve(snapshot());
 const results=await Promise.all([a,b,fresh]);assert.ok(results.every(p=>p.expiresAt===f.state.now+FRAME_PERMIT_LEASE_MS));
 assert.equal((await f.watcher.read('synthetic')).expiresAt,results[0].expiresAt);assert.equal(f.state.reads,1);f.watcher.dispose();
});

test('background polling cannot renew and a lease expired during suspension cannot reopen',async()=>{
 const f=fixture();f.next(snapshot());const initial=await f.watcher.read('synthetic');f.state.visible=false;
 f.state.now=initial.expiresAt-FRAME_PERMIT_RENEW_WINDOW_MS;
 assert.equal((await f.watcher.read('synthetic')).expiresAt,initial.expiresAt);
 assert.equal(await f.watcher.read('synthetic',{fresh:true}),null);assert.equal(f.state.reads,0);
 f.state.now=initial.expiresAt;f.state.visible=true;
 assert.equal(await f.watcher.read('synthetic',{fresh:true}),null);f.next(snapshot());
 assert.equal(await f.watcher.read('synthetic'),null);assert.equal(f.state.denies,1);f.watcher.dispose();
});

for(const boundary of ['server-read','listener'])test('server confirmation after lease expiry cannot revive '+boundary,async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());const initial=await f.watcher.read('synthetic');
 f.state.server=()=>pending.promise;const request=boundary==='server-read'?f.watcher.read('synthetic',{fresh:true}):null;
 f.state.now=initial.expiresAt;if(boundary==='listener')f.next(snapshot());else pending.resolve(snapshot());
 assert.equal(await request,null);assert.equal(await f.watcher.read('synthetic'),null);
 assert.equal(f.state.denies,1);f.watcher.dispose();
});

test('a lease renewal changes no inactivity deadline, key, unlock count or session generation',async()=>{
 const f=fixture();f.next(snapshot());let unlocks=0;const origin='https://fixture.invalid',document={},frame={};
 const session=createFrameSession({origin,release:'fixture',getFrameWindow:()=>frame,getFrameDocument:()=>document,
  getFrameUrl:()=>origin+'/home_page.html',getIdentity:()=>({uid:'synthetic',epoch:'1:fence'}),
  readPermit:f.watcher.read,validateIdentity:async()=>f.state.current,now:()=>f.state.now,idleMs:300000,
  unlock:async()=>{unlocks++;return 'SYNTHETIC-MATERIAL';}});
 const documentNonce=session.beginDocument(),event=()=>({source:frame,origin,data:{protocol:FRAME_PROTOCOL,release:'fixture',documentNonce,requestId:crypto.randomUUID(),command:'key'}});
 const first=await session.handle(event()),before=session.state();assert.equal(first.kind,'key');
 f.state.now=first.expiresAt-FRAME_PERMIT_RENEW_WINDOW_MS;
 const renewed=await f.watcher.read('synthetic');assert.equal(renewed.expiresAt,f.state.now+FRAME_PERMIT_LEASE_MS);
 assert.equal(session.renewPermit(renewed,{uid:'synthetic',epoch:'1:fence'},before.generation),true);
 const after=session.state();assert.equal(after.expiresAt,before.expiresAt);assert.equal(after.generation,before.generation);
 assert.equal((await session.handle(event())).material,first.material);assert.equal(unlocks,1);
 f.state.now=before.expiresAt;assert.equal(session.state().unlocked,false);f.watcher.dispose();
});
const ownerSource=(await readFile(new URL('../Frontend/public/assets/js/modules/core/vault-frame-owner.mjs',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const flush=()=>new Promise(done=>setImmediate(done));
async function ownerFixture(){
 const f=fixture(),origin='https://fixture.invalid',window=new EventTarget(),child=new EventTarget(),iframe=new EventTarget();
 const document=new EventTarget(),childDocument=new EventTarget();document.hidden=false;childDocument.visibilityState='visible';
 document.documentElement={clientWidth:1280,clientHeight:800};document.querySelector=()=>({});
 childDocument.documentElement={style:{setProperty(){},removeProperty(){}}};
 Object.assign(window,{document,Event,location:new URL(origin+'/app.html'),setInterval:fn=>{f.interval=fn;return 1;},clearInterval(){},
  setTimeout:()=>1,clearTimeout(){},getComputedStyle:()=>({getPropertyValue:()=> '0px'})});
 window.history={pushState:(_s,_t,url)=>{window.location.href=url;},replaceState:(_s,_t,url)=>{window.location.href=url;}};
 Object.assign(child,{document:childDocument,parent:window,location:new URL(origin+'/home_page.html'),crypto,
  innerWidth:1280,innerHeight:800,setTimeout:()=>1,clearTimeout(){},history:{pushState(){},replaceState(){}}});
 child.location.replace=target=>{child.location.href=target;};
 Object.assign(iframe,{contentWindow:child,contentDocument:childDocument,style:{},remove(){},
  getBoundingClientRect:()=>({top:0,left:0,right:1280,bottom:800,width:1280,height:800})});
 f.state.posts=[];f.state.locks=[];f.state.unlocks=0;
 const message=(surface,data,source)=>surface.dispatchEvent(Object.assign(new Event('message'),{origin,source,data}));
 child.postMessage=data=>{f.state.posts.push(data);message(child,data,window);};window.postMessage=data=>message(window,data,child);
 const context=vm.createContext({...framePolicy,URL,Date:{now:()=>f.state.now},frameLockCode,beginFrameModalFocus:()=>()=>{},
  createFrameSession:options=>createFrameSession({...options,now:()=>f.state.now})});
 const createOwner=vm.runInContext(ownerSource+'\ncreateVaultFrameOwner;',context);
 const owner=createOwner({window,iframe,release:'fixture',now:()=>f.state.now,getIdentity:()=>({uid:'synthetic',epoch:'1:fence'}),
  readPermit:f.watcher.read,validateIdentity:async()=>f.state.current,readTimeout:async()=>720,
  unlock:async()=>{f.state.unlocks++;return 'SYNTHETIC-MATERIAL';},onState:value=>{if(value.locked)f.state.locks.push(value.reason);}});
 f.state.onDeny=()=>owner.session.lock('policy-revoked');f.next(snapshot());
 assert.equal(await owner.start('/home_page.html'),true);
 const transport=createFrameTransport({window:child,release:'fixture',enabled:true,now:()=>f.state.now});
 iframe.dispatchEvent(new Event('load'));await flush();await flush();
 await transport.request('key');assert.equal(transport.isUnlocked(),true);
 return {...f,window,child,iframe,owner,transport,hide(){
  f.state.visible=false;document.hidden=true;childDocument.visibilityState='hidden';
  document.dispatchEvent(new Event('visibilitychange'));childDocument.dispatchEvent(new Event('visibilitychange'));f.watcher.invalidatePending();
 },show(){
  f.state.visible=true;document.hidden=false;childDocument.visibilityState='visible';document.dispatchEvent(new Event('visibilitychange'));
 },dispose(){transport.dispose();owner.dispose();f.watcher.dispose();}};
}

test('a renewal cancelled by a short suspension cannot lock the owner; resume verifies afresh',async()=>{
 const f=await ownerFixture(),pending=pause();
 try{
  f.state.now=241000;f.state.server=()=>pending.promise;f.interval();assert.equal(f.state.reads,2);
  f.hide();await flush();assert.equal(f.owner.session.state().unlocked,true);assert.deepEqual(f.state.locks,[]);
  f.state.server=async()=>snapshot();f.show();await flush();await flush();
  assert.equal(f.state.reads,3);assert.equal(f.owner.session.state().unlocked,true);assert.equal(f.transport.isUnlocked(),true);
  pending.resolve(snapshot({enabled:false}));await flush();assert.deepEqual(f.state.locks,[]);assert.equal(f.state.unlocks,1);
  f.hide();f.next(snapshot({enabled:false}));assert.equal(f.owner.session.state().unlocked,false);
 }finally{f.dispose();}
});

test('the periodic renewal propagates the lease to the visible child without another unlock',async()=>{
 const f=await ownerFixture();
 try{
  const initial=f.owner.session.state();f.state.now=241000;f.interval();await flush();await flush();
  assert.equal(f.state.reads,2);assert.equal(f.owner.session.state().generation,initial.generation);
  assert.equal(f.state.posts.at(-1).kind,'visible');assert.equal(f.state.posts.at(-1).leaseExpiresAt,541000);
  f.state.now=initial.expiresAt+1;assert.equal(f.transport.isUnlocked(),true);assert.equal(f.owner.session.state().unlocked,true);
  assert.equal(f.state.unlocks,1);
 }finally{f.dispose();}
});

test('a renewed lease cannot send visibility to a successor Document',async()=>{
 const f=await ownerFixture(),pending=pause();
 try{
  f.state.now=241000;f.state.server=()=>pending.promise;const before=f.state.posts.length;f.interval();
  f.iframe.contentDocument={};pending.resolve(snapshot());await flush();await flush();
  assert.equal(f.state.posts.length,before);
 }finally{f.dispose();}
});

test('initial cached policy waits for the authoritative event, with zero GETs before renewal',async()=>{
 const f=fixture();let done=false;const request=f.watcher.read('synthetic').then(p=>{done=true;return p;});
 f.next(snapshot({}, {fromCache:true}));await Promise.resolve();assert.equal(done,false);assert.equal(f.state.reads,0);
 f.next(snapshot());assert.equal((await request).uid,'synthetic');for(let i=0;i<100;i++)assert.ok(await f.watcher.read('synthetic'));
 assert.equal(f.state.reads,0);f.watcher.dispose();assert.equal(f.state.stops,1);
});
for(const reason of ['cached','disabled','error','identity','expired','dispose'])test('established policy revokes on '+reason,async()=>{
 const f=fixture();f.next(snapshot());assert.ok(await f.watcher.read('synthetic'));
 if(reason==='cached')f.next(snapshot({}, {fromCache:true}));if(reason==='disabled')f.next(snapshot({enabled:false}));
 if(reason==='error')f.error();if(reason==='identity')f.state.current=false;if(reason==='expired')f.state.now+=FRAME_PERMIT_LEASE_MS;if(reason==='dispose')f.watcher.dispose();
 assert.equal(await f.watcher.read('synthetic'),null);f.next(snapshot());assert.equal(await f.watcher.read('synthetic'),null);f.watcher.dispose();
});
test('fresh server reads coalesce and cannot reauthorize after listener revocation',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());f.state.server=()=>pending.promise;
 const a=f.watcher.read('synthetic',{fresh:true}),b=f.watcher.read('synthetic',{fresh:true});assert.equal(f.state.reads,1);
 f.next(snapshot({enabled:false}));pending.resolve(snapshot());assert.deepEqual(await Promise.all([a,b]),[null,null]);assert.equal(f.state.denies,1);f.watcher.dispose();
});
test('a confirmation of the same global policy does not cancel a pending fresh read',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());f.state.server=()=>pending.promise;
 const old=f.watcher.read('synthetic',{fresh:true});f.state.now+=1000;f.next(snapshot());pending.resolve(snapshot());
 assert.equal((await old).expiresAt,f.state.now+FRAME_PERMIT_LEASE_MS);assert.equal(f.state.denies,0);f.watcher.dispose();
});
test('initial timeout and permission failure are terminal, including late positive callbacks',async()=>{
 for(const failure of ['timeout','permission']){const f=fixture(),p=f.watcher.read('synthetic');if(failure==='timeout')f.state.timers[0]();else f.error();
 assert.equal(await p,null);f.next(snapshot());assert.equal(await f.watcher.read('synthetic'),null);f.watcher.dispose();}
});
test('UID changes while a server read is pending cannot adopt its result',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());f.state.server=()=>pending.promise;
 const old=f.watcher.read('synthetic',{fresh:true});f.state.current=false;pending.resolve(snapshot());assert.equal(await old,null);f.watcher.dispose();
});

test('a fresh read has its own deadline and a late server response cannot reopen admission',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());f.state.server=()=>pending.promise;
 const a=f.watcher.read('synthetic',{fresh:true}),b=f.watcher.read('synthetic',{fresh:true});
 assert.equal(f.state.reads,1);f.state.timers.at(-1)();
 assert.deepEqual(await Promise.all([a,b]),[null,null]);assert.equal(f.state.denies,1);
 pending.resolve(snapshot());await Promise.resolve();assert.equal(await f.watcher.read('synthetic'),null);f.watcher.dispose();
});

test('resume never reuses a fresh server verification started before suspension',async()=>{
 const f=fixture(),before=pause(),after=pause();f.next(snapshot());f.state.server=()=>before.promise;
 const a=f.watcher.read('synthetic',{fresh:true});f.watcher.invalidatePending();assert.equal(await a,null);
 f.state.server=()=>after.promise;const b=f.watcher.read('synthetic',{fresh:true});assert.equal(f.state.reads,2);
 before.resolve(snapshot({enabled:false}));await Promise.resolve();assert.equal(f.state.denies,0);
 after.resolve(snapshot());assert.ok(await b);assert.equal(f.state.denies,0);f.watcher.dispose();
});

test('a suspended server-read deadline cannot revoke a newer authoritative confirmation',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());f.state.server=()=>pending.promise;
 const old=f.watcher.read('synthetic',{fresh:true}),oldDeadline=f.state.timers.at(-1);
 f.watcher.invalidatePending();f.state.now+=1000;f.next(snapshot());assert.equal(await old,null);oldDeadline();
 assert.equal(f.state.denies,0);assert.equal((await f.watcher.read('synthetic')).expiresAt,f.state.now+FRAME_PERMIT_LEASE_MS);
 pending.resolve(snapshot());f.watcher.dispose();
});

test('the production adapter wires real watcher suspension, fresh SDK reads and offline cleanup',async()=>{
 const source=(await readFile(new URL('../Frontend/public/assets/js/modules/core/vault-frame-admission.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 const window=new EventTarget();window.document=new EventTarget();window.document.hidden=false;
 const state={reads:0,stops:0,denies:0,docs:0,subscriptions:0},first=pause(),second=pause(),valid=snapshot();
 const context=vm.createContext({window,FRAME_POLICY_PATH,createFramePermitWatcher,callback:()=>state.denies++,db:{},auth:{currentUser:{uid:'synthetic'}},authSessionFence:{isLocallyCurrent:()=>true},
  doc:(_db,...parts)=>{state.docs++;assert.equal(parts.join('/'),FRAME_POLICY_PATH);return {};},
  onSnapshot:(_ref,options,next)=>{state.subscriptions++;assert.equal(options.includeMetadataChanges,true);state.next=next;return()=>state.stops++;},
  getDocFromServer:()=>{state.reads++;return state.reads===1?first.promise:second.promise;}});
 vm.runInContext(source,context);window.navigator={onLine:false};
 const offline=vm.runInContext("createProductionFrameAdmission({user:{uid:'synthetic'},fenceTicket:{}})",context);
 assert.equal(await offline.read('synthetic'),null);offline.dispose();assert.equal(state.docs,0);assert.equal(state.subscriptions,0);assert.equal(state.reads,0);
 window.navigator.onLine=true;
 const adapter=vm.runInContext("createProductionFrameAdmission({user:{uid:'synthetic'},fenceTicket:{},onDeny:()=>callback()})",context);
 try{
  state.next(valid);const before=adapter.read('synthetic',{fresh:true});window.document.hidden=true;window.document.dispatchEvent(new Event('visibilitychange'));assert.equal(await before,null);
  window.document.hidden=false;window.document.dispatchEvent(new Event('visibilitychange'));const resumed=adapter.read('synthetic',{fresh:true});assert.equal(state.reads,2);
  second.resolve(valid);assert.ok(await resumed);first.resolve(valid);window.dispatchEvent(new Event('offline'));
  assert.equal(await adapter.read('synthetic'),null);assert.equal(state.denies,1);
 }finally{adapter.dispose();}assert.equal(state.stops,1);
});
test('anchor allowlist belongs to the actual route DOM; unknown/encoded/cross-route fragments fail',async()=>{
 for(const [page,anchors]of Object.entries(FRAME_ANCHORS)){
 const html=await readFile(new URL('../Frontend/public/'+page+'.html',import.meta.url),'utf8');
 for(const id of anchors){assert.ok(html.includes('id="'+id+'"'),page+'#'+id);assert.ok(privateFrameUrl('/'+page+'.html#'+id,'https://fixture.invalid'));}}
 for(const value of ['/home_page.html#section-email','/profilo_privato.html#section-email','/modifica_azienda.html#shared-credentials-section',
 '/modifica_azienda.html#%73ection-email','/form_account_privato.html#unknown'])assert.equal(privateFrameUrl(value,'https://fixture.invalid'),null,value);
});
const routingSource=(await readFile(new URL('../Frontend/public/assets/js/modules/core/vault-frame-routing.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
function routingFixture(href='https://fixture.invalid/profilo_privato.html?profileTab=documents#documenti-view-container'){
 const state={reads:0,disposed:0,allowed:true,current:true,navigations:[],hint:true},document={};
 const window={document,navigator:{onLine:true},location:{href,replace:target=>state.navigations.push(target)},history:{replaceState:(_s,_t,target)=>{window.location.href=target;}}};window.parent=window;
 const context=vm.createContext({window,URL,consumeFrameStandaloneMarker,privateFrameUrl,auth:{currentUser:{uid:'synthetic'}},
 authSessionFence:{isCurrent:async()=>state.current,isLocallyCurrent:()=>state.current},
 createProductionFrameAdmission:()=>({read:async()=>{state.reads++;await state.waitForRead;return state.allowed?{}:null;},dispose(){state.disposed++;}})});
 context.fixtureState=state;
 vm.runInContext(routingSource,context);return {state,window,run:()=>vm.runInContext("maybeEnterVaultFrame({user:{uid:'synthetic'},fenceTicket:{},candidateHint:fixtureState.hint})",context)};
}
test('server-approved direct link preserves validated query/anchor and closes its temporary listener',async()=>{
 const f=routingFixture();assert.equal(await f.run(),true);const url=new URL(f.state.navigations[0]);assert.equal(url.pathname,'/app.html');
 assert.equal(url.searchParams.get('route'),'/profilo_privato.html?profileTab=documents#documenti-view-container');assert.equal(f.state.disposed,1);
});
for(const reason of ['denied','fence','child','unknown-query'])test('standalone is preserved on '+reason,async()=>{
 const f=routingFixture(reason==='unknown-query'?'https://fixture.invalid/profilo_privato.html?unknown=1':undefined);
 if(reason==='denied')f.state.allowed=false;if(reason==='fence')f.state.current=false;if(reason==='child')f.window.parent={};
 assert.equal(await f.run(),false);assert.equal(f.state.navigations.length,0);
});
test('one-shot version fallback is only denial, removed before the ordinary page proceeds',async()=>{
 const f=routingFixture('https://fixture.invalid/form_account_privato.html?id=synthetic&__frame_standalone_once=1#shared-credentials-section');
 assert.equal(await f.run(),false);assert.equal(f.state.reads,0);assert.equal(new URL(f.window.location.href).searchParams.has('__frame_standalone_once'),false);
 assert.equal(new URL(f.window.location.href).hash,'#shared-credentials-section');assert.equal(await f.run(),true);
});

test('the standalone marker is consumed locally even without a verified-user hint or network',async()=>{
 const f=routingFixture('https://fixture.invalid/home_page.html?__frame_standalone_once=1');f.state.hint=false;f.window.navigator.onLine=false;
 assert.equal(await f.run(),false);assert.equal(f.window.location.href,'https://fixture.invalid/home_page.html');assert.equal(f.state.reads,0);
});

for(const change of ['fence','document','href'])test('routing checks '+change+' again after the pending server read',async()=>{
 const f=routingFixture(),pending=pause();f.state.waitForRead=pending.promise;const request=f.run();
 if(change==='fence')f.state.current=false;if(change==='document')f.window.document={};if(change==='href')f.window.location.href='https://fixture.invalid/home_page.html';
 pending.resolve();assert.equal(await request,false);assert.equal(f.state.navigations.length,0);assert.equal(f.state.disposed,1);
});

for(const network of ['online','offline','slow'])test('an ineligible user '+network+' starts standalone immediately with zero permit reads across pages',async()=>{
 const f=routingFixture();f.state.hint=false;if(network==='offline')f.window.navigator.onLine=false;
 f.state.waitForRead=new Promise(()=>{});
 for(let i=0;i<10;i++)assert.equal(await f.run(),false);
 assert.equal(f.state.reads,0);assert.equal(f.state.disposed,0);assert.deepEqual(f.state.navigations,[]);
});

test('even a true routing hint cannot authorize offline or bypass a denied singleton',async()=>{
 const offline=routingFixture();offline.window.navigator.onLine=false;offline.state.waitForRead=new Promise(()=>{});
 assert.equal(await offline.run(),false);assert.equal(offline.state.reads,0);
 const denied=routingFixture();denied.state.allowed=false;assert.equal(await denied.run(),false);assert.equal(denied.state.reads,1);assert.equal(denied.state.navigations.length,0);
});

test('canonical bootstrap admits verified users without a pilot claim and reuses the existing token',async()=>{
 const main=await readFile(new URL('../Frontend/public/assets/js/main-v129.js',import.meta.url),'utf8');
 const begin=main.indexOf('let vaultFrameCandidateHint = false;'),end=main.indexOf('if (isPrivatePage && !await authSessionFence.isCurrent',begin);
 const preflight=main.slice(begin,end)+'\nreturn vaultFrameCandidateHint;';
 assert.ok(begin>0&&end>begin);
 const routeStart=main.indexOf('if (isPrivatePage && VAULT_FRAME_ENABLED && vaultFrameCandidateHint');
 assert.ok(routeStart>end);assert.match(main.slice(routeStart,routeStart+650),/candidateHint: vaultFrameCandidateHint/);
 for(const [claims,online,expected]of [[{},true,false],[{email_verified:true},true,true],[{email_verified:true,vault_frame_canary:'true'},true,true],
  [{email_verified:true,vault_frame_canary:true},true,true],[{email_verified:false,vault_frame_canary:true},true,false],[{email_verified:true,vault_frame_canary:true},false,false]]){
  for(const uid of ['first-synthetic','second-synthetic']){
  let tokens=0;const user={uid,emailVerified:true,reload:async()=>{},getIdTokenResult:async()=>{tokens++;return {claims};},getIdToken:async()=>{}};
  const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
  const run=new AsyncFunction('auth','user','navigator','isPrivatePage','gate','navigateDocument','hasCompleteRecoveryIntent',preflight);
  assert.equal(await run({currentUser:user},user,{onLine:online},true,{},()=>{},()=>false),expected);
  assert.equal(tokens,online?1:0);
  }
 }
});
