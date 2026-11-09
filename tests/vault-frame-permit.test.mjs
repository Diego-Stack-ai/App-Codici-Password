import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {createFramePermitWatcher, framePermitFromSnapshot, FRAME_POLICY_PATH} from '../Frontend/public/assets/js/modules/core/vault-frame-permit.mjs';
import {FRAME_ANCHORS, privateFrameUrl} from '../Frontend/public/assets/js/modules/core/vault-frame-policy.mjs';
const pause=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const snapshot=(data={},metadata={})=>({metadata:{fromCache:false,hasPendingWrites:false,...metadata},exists:()=>true,
 data:()=>({schemaVersion:1,version:1,uid:'synthetic',enabled:true,expiresAt:{toMillis:()=>10000},...data})});
function fixture(){let next,error;const state={current:true,reads:0,stops:0,denies:0,now:1000,server:async()=>snapshot(),timers:[]};
 const watcher=createFramePermitWatcher({uid:'synthetic',now:()=>state.now,isCurrent:()=>state.current,
  setTimer:fn=>{state.timers.push(fn);return 1;},clearTimer(){},onDeny:()=>state.denies++,
  subscribe:(n,e)=>{next=n;error=e;return()=>state.stops++;},readServer:()=>{state.reads++;return state.server();}});
 return {state,watcher,next:v=>next(v),error:()=>error()};}
for(const bad of [{enabled:false},{uid:'other'},{version:2},{schemaVersion:2},{expiresAt:{toMillis:()=>1000}},{unknown:true}])
 test('policy payload denies '+JSON.stringify(bad),()=>assert.equal(framePermitFromSnapshot(snapshot(bad),'synthetic',1000),null));
for(const meta of [{fromCache:true},{hasPendingWrites:true}])test('metadata cannot authorize '+JSON.stringify(meta),()=>assert.equal(framePermitFromSnapshot(snapshot({},meta),'synthetic',1000),null));
test('initial cached policy waits for the authoritative event, with no periodic GETs',async()=>{
 const f=fixture();let done=false;const request=f.watcher.read('synthetic').then(p=>{done=true;return p;});
 f.next(snapshot({}, {fromCache:true}));await Promise.resolve();assert.equal(done,false);assert.equal(f.state.reads,0);
 f.next(snapshot());assert.equal((await request).uid,'synthetic');for(let i=0;i<100;i++)assert.ok(await f.watcher.read('synthetic'));
 assert.equal(f.state.reads,0);f.watcher.dispose();assert.equal(f.state.stops,1);
});
for(const reason of ['cached','disabled','error','identity','expired','dispose'])test('established policy revokes on '+reason,async()=>{
 const f=fixture();f.next(snapshot());assert.ok(await f.watcher.read('synthetic'));
 if(reason==='cached')f.next(snapshot({}, {fromCache:true}));if(reason==='disabled')f.next(snapshot({enabled:false}));
 if(reason==='error')f.error();if(reason==='identity')f.state.current=false;if(reason==='expired')f.state.now=10000;if(reason==='dispose')f.watcher.dispose();
 assert.equal(await f.watcher.read('synthetic'),null);f.next(snapshot());assert.equal(await f.watcher.read('synthetic'),null);f.watcher.dispose();
});
test('fresh server reads coalesce and cannot reauthorize after listener revocation',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());f.state.server=()=>pending.promise;
 const a=f.watcher.read('synthetic',{fresh:true}),b=f.watcher.read('synthetic',{fresh:true});assert.equal(f.state.reads,1);
 f.next(snapshot({enabled:false}));pending.resolve(snapshot());assert.deepEqual(await Promise.all([a,b]),[null,null]);assert.equal(f.state.denies,1);f.watcher.dispose();
});
test('a changed authoritative policy invalidates an older server-read result',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());f.state.server=()=>pending.promise;
 const old=f.watcher.read('synthetic',{fresh:true});f.next(snapshot({expiresAt:{toMillis:()=>9000}}));pending.resolve(snapshot());
 assert.equal(await old,null);assert.equal((await f.watcher.read('synthetic')).expiresAt,9000);f.watcher.dispose();
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

test('a superseded server-read deadline cannot revoke a newer authoritative policy',async()=>{
 const f=fixture(),pending=pause();f.next(snapshot());f.state.server=()=>pending.promise;
 const old=f.watcher.read('synthetic',{fresh:true}),oldDeadline=f.state.timers.at(-1);
 f.next(snapshot({expiresAt:{toMillis:()=>9000}}));assert.equal(await old,null);oldDeadline();
 assert.equal(f.state.denies,0);assert.equal((await f.watcher.read('synthetic')).expiresAt,9000);
 pending.resolve(snapshot());f.watcher.dispose();
});

test('the production adapter wires real watcher suspension, fresh SDK reads and offline cleanup',async()=>{
 const source=(await readFile(new URL('../Frontend/public/assets/js/modules/core/vault-frame-admission.js',import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
 const window=new EventTarget();window.document=new EventTarget();window.document.hidden=false;
 const state={reads:0,stops:0,denies:0},first=pause(),second=pause(),valid=snapshot({expiresAt:{toMillis:()=>Date.now()+60000}});
 const context=vm.createContext({window,FRAME_POLICY_PATH,createFramePermitWatcher,callback:()=>state.denies++,db:{},auth:{currentUser:{uid:'synthetic'}},authSessionFence:{isLocallyCurrent:()=>true},
  doc:(_db,...parts)=>{assert.equal(parts.join('/'),FRAME_POLICY_PATH);return {};},
  onSnapshot:(_ref,options,next)=>{assert.equal(options.includeMetadataChanges,true);state.next=next;return()=>state.stops++;},
  getDocFromServer:()=>{state.reads++;return state.reads===1?first.promise:second.promise;}});
 vm.runInContext(source,context);const adapter=vm.runInContext("createProductionFrameAdmission({user:{uid:'synthetic'},fenceTicket:{},onDeny:()=>callback()})",context);
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
 const state={reads:0,disposed:0,allowed:true,current:true,navigations:[]},document={};
 const window={document,location:{href,replace:target=>state.navigations.push(target)},history:{replaceState:(_s,_t,target)=>{window.location.href=target;}}};window.parent=window;
 const context=vm.createContext({window,URL,FRAME_STANDALONE_QUERY:'__frame_standalone_once',privateFrameUrl,auth:{currentUser:{uid:'synthetic'}},
 authSessionFence:{isCurrent:async()=>state.current,isLocallyCurrent:()=>state.current},
 createProductionFrameAdmission:()=>({read:async()=>{state.reads++;await state.waitForRead;return state.allowed?{}:null;},dispose(){state.disposed++;}})});
 vm.runInContext(routingSource,context);return {state,window,run:()=>vm.runInContext("maybeEnterVaultFrame({user:{uid:'synthetic'},fenceTicket:{}})",context)};
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

for(const change of ['fence','document','href'])test('routing checks '+change+' again after the pending server read',async()=>{
 const f=routingFixture(),pending=pause();f.state.waitForRead=pending.promise;const request=f.run();
 if(change==='fence')f.state.current=false;if(change==='document')f.window.document={};if(change==='href')f.window.location.href='https://fixture.invalid/home_page.html';
 pending.resolve();assert.equal(await request,false);assert.equal(f.state.navigations.length,0);assert.equal(f.state.disposed,1);
});
