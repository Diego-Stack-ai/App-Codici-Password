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
 const state={snap:null,error:null,updates:[],locks:[],valid:()=>Promise.resolve(true),resume:0};
 const anchor=new EventTarget();const owner={session:{state:()=>({expiresAt:1}),lock:reason=>state.locks.push(reason)},start:async()=>started,
 updatePreference:v=>state.updates.push(v),resume:()=>{state.resume++;return true;},dispose(){}};
 const context=vm.createContext({window:{location:{href:'https://fixture.invalid/app.html'}},document:{getElementById:id=>id==='frame-resume'?anchor:{}},
 URL,APP_VERSION:'fixture',auth:{currentUser:{uid:'synthetic'}},db:{},doc:()=>({}),getUserProfile:async()=>({lock_timeout:3}),
 authSessionFence:{isCurrent:()=>state.valid(),isLocallyAllowed:()=>true},createVaultFrameOwner:()=>owner,
 onSnapshot:(_ref,next,error)=>{state.snap=next;state.error=error;return()=>{};}});
 vm.runInContext(productionSource,context);return {state,anchor,start:()=>vm.runInContext("startVaultFrame({user:{uid:'synthetic'},fenceTicket:{revision:1,nonce:'n'},securityManager:{setFrameExpiryAuthority(){}}})",context)};
}
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
