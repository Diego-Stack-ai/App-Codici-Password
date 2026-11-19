import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {webcrypto} from 'node:crypto';
import {createFrameMediaLifetime} from '../Frontend/public/assets/js/modules/core/vault-frame-media-lifetime.mjs';
import {probeMicrophoneAccess} from '../Frontend/public/assets/js/modules/assistant/voice-recognition-model.js';
import {bankingRemovalPlan,markBankingRemoval} from '../Frontend/public/assets/js/modules/core/vault-frame-removal-plan.mjs';
const source=async name=>(await readFile(new URL('../Frontend/public/assets/js/modules/core/'+name,import.meta.url),'utf8')).replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'');
const pause=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const flush=()=>new Promise(done=>setImmediate(done));
const actionSource=await source('vault-frame-client.js');
function actionFixture(){
  const state={fenceRead:async()=>true,now:1000,uid:'synthetic',generation:1,suspension:0,allowed:true,unlocked:true,calls:[]};
  const client={isChild:()=>true,generation:()=>state.generation,suspensionGeneration:()=>state.suspension,isUnlocked:()=>state.unlocked,
    request:async kind=>{state.calls.push(kind);return kind==='fresh'?{kind:'grant',grant:'g'}:{kind:'consumed',expiresAt:1500};}};
  const context=vm.createContext({window:{},createFrameTransport:()=>client,APP_VERSION:'fixture',VAULT_FRAME_ENABLED:true,
    auth:{get currentUser(){return {uid:state.uid};}},authSessionFence:{readPermit:async()=>({}),isCurrent:async()=>state.allowed && await state.fenceRead(),isLocallyCurrent:()=>state.allowed},
    TextEncoder,crypto:webcrypto,Uint8Array,Date:{now:()=>state.now}});
  vm.runInContext(actionSource,context);return {state,run:code=>vm.runInContext(code,context)};
}
for(const boundary of ['suspension','generation','identity','fence','lease','proof-expiry']) test('actual consumed checker rejects '+boundary,async()=>{
  const f=actionFixture(),check=await f.run("confirmFrameAction('backup-export',{scope:'synthetic'})");
  assert.deepEqual(f.state.calls,['fresh','consume']);await check();check.assertLocal();
  if(boundary==='suspension')f.state.suspension++;
  if(boundary==='generation')f.state.generation++;
  if(boundary==='identity')f.state.uid='other';
  if(boundary==='fence')f.state.allowed=false;
  if(boundary==='lease')f.state.unlocked=false;
  if(boundary==='proof-expiry')f.state.now=1500;
  await assert.rejects(check,/FRAME_CONFIRMATION_REQUIRED/);assert.throws(()=>check.assertLocal(),/FRAME_CONFIRMATION_REQUIRED/);
});
test('remove then add a bank card of equal count retains explicit removal intent',()=>{
  const after=[{bankId:'b',cards:[{}]}];markBankingRemoval(after,{bankId:'b',cardIndex:0});
  assert.deepEqual(bankingRemovalPlan([{bankId:'b',cards:[{}]}],after),[{bankId:'b',cardIndex:0}]);
});
function mediaFixture(options={}){const document=new EventTarget(),window=new EventTarget();document.hidden=false;window.document=document;
 return {document,window,lifetime:createFrameMediaLifetime({window,document,...options})};}
for(const event of ['pagehide','vault-session-locked','private-auth-blocked','freeze','hidden']) test('media lifetime revokes on '+event,()=>{
 const f=mediaFixture();assert.equal(f.lifetime.valid(),true);
 if(event==='hidden'){f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));}
 else (event==='freeze'?f.document:f.window).dispatchEvent(new Event(event));
 assert.equal(f.lifetime.valid(),false);assert.equal(f.lifetime.signal.aborted,true);f.lifetime.dispose();
});
test('native picker survives short hidden state but not revocation or a successor document',()=>{
 const f=mediaFixture({stopWhenHidden:false});f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));assert.equal(f.lifetime.valid(),true);
 f.window.dispatchEvent(new Event('vault-session-locked'));assert.equal(f.lifetime.valid(),false);f.lifetime.dispose();
 const g=mediaFixture();g.window.document={};assert.equal(g.lifetime.valid(),false);g.lifetime.dispose();
});
test('microphone permission resolving after cancellation cannot acquire a stream',async()=>{
 const f=mediaFixture(),permission=pause();let calls=0;
 const pending=probeMicrophoneAccess({permissions:{query:()=>permission.promise},mediaDevices:{getUserMedia:()=>{calls++;}},isActive:f.lifetime.valid});
 f.window.dispatchEvent(new Event('vault-session-locked'));permission.resolve({state:'granted'});
 assert.equal((await pending).code,'microphone-cancelled');assert.equal(calls,0);f.lifetime.dispose();
});
test('microphone stream resolving after cancellation stops every late track',async()=>{
 const f=mediaFixture(),acquire=pause();let stops=0;
 const pending=probeMicrophoneAccess({mediaDevices:{getUserMedia:()=>acquire.promise},isActive:f.lifetime.valid});
 f.document.hidden=true;f.document.dispatchEvent(new Event('visibilitychange'));acquire.resolve({getTracks:()=>[{stop:()=>stops++},{stop:()=>stops++}]});
 assert.equal((await pending).code,'microphone-cancelled');assert.equal(stops,2);f.lifetime.dispose();
});
const productionSource=await source('vault-frame-production.js');
function productionFixture(started=true){
 const state={snap:null,error:null,updates:[],locks:[],valid:()=>Promise.resolve(true),resume:0,confirmations:[],clears:0};
 const attributes=()=>{const values=new Map();return {setAttribute:(k,v)=>values.set(k,v),getAttribute:k=>values.get(k)??null,removeAttribute:k=>values.delete(k)};};
 const elements=Object.fromEntries(['frame-status','frame-loading','vault-frame'].map(id=>[id,{hidden:id==='frame-status',...attributes()}]));
 const anchor=Object.assign(new EventTarget(),attributes());const owner={session:{state:()=>({expiresAt:1}),lock:reason=>state.locks.push(reason)},start:async()=>{if(started==='throw')throw Error('synthetic startup error');return state.startResult??started;},
 updatePreference:v=>state.updates.push(v),resume:()=>{state.resume++;if(state.resumeMode==='throw')throw Error('synthetic reload failure');return state.resumeMode!==false;},dispose(){state.onState?.({locked:true,reason:'dispose'});}};
 const context=vm.createContext({window:{location:{href:'https://fixture.invalid/app.html'}},document:{getElementById:id=>id==='frame-resume'?anchor:elements[id]},
 URL,APP_VERSION:'fixture',auth:{currentUser:{uid:'synthetic'}},db:{},doc:()=>({}),getUserProfile:async()=>({lock_timeout:3}),
 createProductionFrameAdmission:()=>({read:async()=>null,dispose(){}}),
 installFramePushNavigation:()=>()=>{}, emitFrameDiagnostic:()=>{},
 authSessionFence:{isCurrent:()=>state.valid(),isLocallyAllowed:()=>true},createVaultFrameOwner:options=>{state.onState=options.onState;state.confirmSensitive=options.confirmSensitive;state.unlock=options.unlock;return owner;},
 onSnapshot:(_ref,next,error)=>{state.snap=next;state.error=error;return()=>{};}});
 context.securityManager={setFrameExpiryAuthority(){},clearSession(){state.clears++;},ensureVaultKeyMaterial:async options=>{state.confirmations.push(options);return 'fixture-material';}};
 vm.runInContext(productionSource,context);return {state,anchor,elements,context,start:()=>vm.runInContext("startVaultFrame({user:{uid:'synthetic'},fenceTicket:{revision:1,nonce:'n'},securityManager})",context)};
}
test('production confirmation enables fresh biometric proof only for backup-export',async()=>{
 const f=productionFixture();await f.start();
 for(const purpose of ['backup-export','portable-export','master-change','sharing-change','permanent-delete','session-unlock',undefined]){
  const signal=new AbortController().signal;
  assert.equal(await f.state.confirmSensitive({purpose,signal}),true);
  const options=f.state.confirmations.at(-1);
  assert.equal(options.forceReload,true);assert.equal(options.promptImmediately,true);
  assert.equal(options.allowBiometricForReload,purpose==='backup-export');assert.equal(options.signal,signal);
 }
 f.state.valid=async()=>false;
 assert.equal(await f.state.confirmSensitive({purpose:'backup-export',signal:new AbortController().signal}),false);
 assert.equal(f.state.confirmations.length,7);
});

test('production confirmation aborted during fresh proof clears material and never grants',async()=>{
 const f=productionFixture();await f.start();const entered=pause(),pending=pause(),controller=new AbortController();
 f.context.securityManager.ensureVaultKeyMaterial=async()=>{entered.resolve();return pending.promise;};
 const result=f.state.confirmSensitive({purpose:'backup-export',signal:controller.signal});
 await entered.promise;controller.abort();pending.resolve('fixture-late');
 assert.equal(await result,false);assert.equal(f.state.clears,1);
});

test('out-of-order preference snapshots cannot extend the newer short timeout',async()=>{
 const f=productionFixture();await f.start();const old=pause();let call=0;f.state.valid=()=>++call===1?old.promise:Promise.resolve(true);
 f.state.snap({exists:()=>true,data:()=>({lock_timeout:720})});f.state.snap({exists:()=>true,data:()=>({lock_timeout:1})});
 await flush();assert.deepEqual(f.state.updates,[1]);old.resolve(true);await flush();assert.deepEqual(f.state.updates,[1]);
});
test('subscription failure revokes without a reference error and retires old snapshot',async()=>{
 const f=productionFixture();await f.start();const old=pause();f.state.valid=()=>old.promise;
 f.state.snap({exists:()=>true,data:()=>({lock_timeout:720})});f.state.error();old.resolve(true);await flush();
 assert.deepEqual(f.state.locks,['preference-unavailable']);assert.deepEqual(f.state.updates,[]);
});
test('denied start keeps the Home anchor usable as a standalone exit',async()=>{
 const f=productionFixture(false);await f.start();const click=new Event('click',{cancelable:true});f.anchor.dispatchEvent(click);
 assert.equal(click.defaultPrevented,false);assert.equal(f.state.resume,0);
});

test('proof expiring during a durable fence read is rejected after the await',async()=>{
 const f=actionFixture(),check=await f.run("confirmFrameAction('backup-export',{scope:'synthetic'})"),pending=pause();
 f.state.fenceRead=()=>pending.promise;const validation=check();f.state.now=1500;pending.resolve(true);
 await assert.rejects(validation,/FRAME_CONFIRMATION_REQUIRED/);
});

test('parent starts neutral, hides waiting on child presentation, and shows only actual lock',async()=>{
 const f=productionFixture();await f.start();
 assert.equal(f.elements['frame-status'].hidden,true);
 assert.equal(f.elements['frame-loading'].hidden,false);
 f.state.onState({locked:false,visible:true});
 assert.equal(f.elements['frame-loading'].hidden,true);
 assert.equal(f.elements['frame-status'].hidden,true);
 f.state.onState({locked:true});
 assert.equal(f.elements['frame-status'].hidden,false);assert.equal(f.anchor.hidden,false);
});
test('a throwing frame start ends waiting and retains the standalone exit',async()=>{
 const f=productionFixture('throw');await f.start();
 assert.equal(f.elements['frame-loading'].hidden,true);assert.equal(f.elements['frame-status'].hidden,false);
 const click=new Event('click',{cancelable:true});f.anchor.dispatchEvent(click);
 assert.equal(click.defaultPrevented,false);assert.equal(f.state.resume,0);
});

test('accepted resume shows busy immediately and rejects duplicate clicks while fallback stays usable',async()=>{
 const f=productionFixture();await f.start();
 const click=new Event('click',{cancelable:true});f.anchor.dispatchEvent(click);
 assert.equal(click.defaultPrevented,true);assert.equal(f.state.resume,1);
 assert.equal(f.anchor.getAttribute('aria-busy'),'true');assert.equal(f.anchor.getAttribute('aria-disabled'),'true');
 const repeat=new Event('click',{cancelable:true});f.anchor.dispatchEvent(repeat);
 assert.equal(repeat.defaultPrevented,true);assert.equal(f.state.resume,1);
 for(const mode of [false,'throw']){
  const fallback=productionFixture();await fallback.start();fallback.state.resumeMode=mode;
  const event=new Event('click',{cancelable:true});fallback.anchor.dispatchEvent(event);
  assert.equal(event.defaultPrevented,false);assert.equal(fallback.anchor.getAttribute('aria-busy'),null);
  assert.equal(fallback.anchor.getAttribute('aria-disabled'),null);
 }
});

test('unlock feedback covers the identity read and pending proof, then clears on every settlement',async()=>{
 for(const outcome of ['success','cancel','error']){
  const f=productionFixture();await f.start();const identity=pause(),proof=pause();
  f.state.valid=()=>identity.promise;f.context.securityManager.ensureVaultKeyMaterial=()=>proof.promise;
  const pending=f.state.unlock('synthetic',{signal:new AbortController().signal});
  assert.equal(f.elements['frame-loading'].hidden,false);
  assert.equal(f.elements['frame-loading'].getAttribute('aria-busy'),'true');
  f.state.onState({locked:false,visible:true});assert.equal(f.elements['frame-loading'].hidden,false);
  identity.resolve(true);await flush();
  if(outcome==='error'){proof.resolve(Promise.reject(Error('synthetic failure')));await assert.rejects(pending,/synthetic failure/);}
  else {proof.resolve(outcome==='success'?'fixture-material':null);assert.equal(await pending,outcome==='success'?'fixture-material':null);}
  assert.equal(f.elements['frame-loading'].hidden,true);assert.equal(f.elements['frame-loading'].getAttribute('aria-busy'),null);
 }
});

test('actual lock stops unlock feedback even while an identity check is pending',async()=>{
 const f=productionFixture();await f.start();const identity=pause(),controller=new AbortController();f.state.valid=()=>identity.promise;
 const pending=f.state.unlock('synthetic',{signal:controller.signal});
 controller.abort();f.state.onState({locked:true});
 assert.equal(f.elements['frame-loading'].hidden,true);assert.equal(f.elements['frame-status'].hidden,false);
 identity.resolve(true);await assert.rejects(pending,/FRAME_AUTH_DENIED/);
 assert.equal(f.elements['frame-loading'].getAttribute('aria-busy'),null);
});

test('an old unlock settlement cannot hide the successor mount feedback',async()=>{
 const f=productionFixture();await f.start();const old=pause(),current=pause();let calls=0;
 f.context.securityManager.ensureVaultKeyMaterial=()=>++calls===1?old.promise:current.promise;
 const previous=f.state.unlock('synthetic',{signal:new AbortController().signal});await flush();
 await f.start();const successor=f.state.unlock('synthetic',{signal:new AbortController().signal});await flush();
 old.resolve('fixture-old');await previous;
 assert.equal(f.elements['frame-loading'].hidden,false);assert.equal(f.elements['frame-loading'].getAttribute('aria-busy'),'true');
 current.resolve('fixture-current');await successor;assert.equal(f.elements['frame-loading'].hidden,true);
});

test('a stale busy click listener cannot disable a failed successor standalone exit',async()=>{
 const f=productionFixture();await f.start();f.anchor.dispatchEvent(new Event('click',{cancelable:true}));
 assert.equal(f.anchor.getAttribute('aria-busy'),'true');f.state.startResult=false;await f.start();
 const click=new Event('click',{cancelable:true});f.anchor.dispatchEvent(click);
 assert.equal(click.defaultPrevented,false);assert.equal(f.state.resume,1);assert.equal(f.anchor.getAttribute('aria-busy'),null);
});
