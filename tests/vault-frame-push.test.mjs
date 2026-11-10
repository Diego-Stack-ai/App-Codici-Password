import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {installFramePushNavigation,framePushPath,FRAME_PUSH_PROTOCOL} from '../Frontend/public/assets/js/modules/core/vault-frame-push.mjs';
const origin='https://fixture.invalid';
const source=await readFile(new URL('../Frontend/public/firebase-messaging-sw.js',import.meta.url),'utf8');
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
function workerFixture(clients=[]){
 const state={calls:[],messages:[],timers:new Map(),order:[]};let listener,timerId=0;
 const self={location:{origin},crypto:{randomUUID:()=> 'synthetic-request-00000001'},addEventListener:(name,fn)=>{state.order.push(name);listener=fn;},
  registration:{showNotification:async()=>{}},clients:{matchAll:async()=>clients,openWindow:async target=>{state.calls.push(['open',target]);}}};
 const firebase={initializeApp(){},messaging:()=>({onBackgroundMessage(){}})};
 vm.runInNewContext(source,{self,firebase,URL,MessageChannel,Date,Promise,console,importScripts:()=>state.order.push('import'),
  setTimeout:(fn,ms)=>{state.timers.set(++timerId,{fn,ms});return timerId;},clearTimeout:id=>state.timers.delete(id)});
 const client=(name,path,{ack=true,focused=false,visible=true,type='top-level',focusFailure=false,postFailure=false}={})=>({
  url:origin+path,frameType:type,focused,visibilityState:visible?'visible':'hidden',
  focus:async()=>{state.calls.push(['focus',name]);if(focusFailure)throw Error('fixture');return null;},
  navigate:async target=>{state.calls.push(['navigate',name,target]);return null;},
  postMessage:(data,ports)=>{state.messages.push({name,data,port:ports[0]});if(postFailure)throw Error('fixture');
   if(ack!==null){ports[0].postMessage({protocol:FRAME_PUSH_PROTOCOL,kind:'ack',requestId:data.requestId,path:data.path,accepted:ack});ports[0].close();}}
 });
 return {state,client,clients,async click(data={eventType:'deadline',deadlineId:'synthetic',notificationId:'notice'}){
  let done=Promise.resolve();listener({notification:{data,close:()=>state.calls.push(['close'])},stopImmediatePropagation(){},waitUntil:p=>{done=p;}});return done;
 },expire(){for(const value of [...state.timers.values()])value.fn();}};
}

test('the custom click handler is installed before the FCM library',()=>{
 const f=workerFixture();assert.deepEqual(f.state.order,['notificationclick','import']);
});
test('worker selects focused top-level frame before visible ordinary and nested clients, with coordinate-only ACK',async()=>{
 const f=workerFixture();f.clients.push(f.client('ordinary','/home_page.html',{focused:true}),f.client('nested','/app.html',{focused:true,type:'nested'}),
  f.client('hidden','/app.html',{visible:false}),f.client('selected','/app.html?route=x',{focused:true}));
 await f.click();assert.equal(f.state.messages[0].name,'selected');assert.equal(f.state.messages.length,1);
 assert.deepEqual(f.state.calls.filter(c=>['open','navigate'].includes(c[0])),[]);
 assert.deepEqual(Object.keys(f.state.messages[0].data).sort(),['expiresAt','kind','path','protocol','requestId']);
 assert.equal(f.state.messages[0].data.path,'/dettaglio_scadenza.html?id=synthetic&notification=notice');
 assert.equal(f.state.timers.size,0);
});
test('worker preserves received and notification coordinates',async()=>{
 const f=workerFixture();await f.click({eventType:'external_deadline',receivedDeadlineId:'received',notificationId:'notice'});
 assert.deepEqual(f.state.calls.at(-1),['open',origin+'/dettaglio_scadenza.html?received=received&notification=notice']);
});
for(const mode of ['negative','timeout','post-error','focus-error'])test('frame '+mode+' never calls navigate and falls back exactly once',async()=>{
 const f=workerFixture();f.clients.push(f.client('frame','/app.html',{ack:mode==='timeout'?null:mode==='focus-error',focusFailure:mode==='focus-error',postFailure:mode==='post-error'}));
 const run=f.click();await turn();
 if(mode==='timeout')f.expire();await run;
 assert.equal(f.state.calls.filter(c=>c[0]==='navigate').length,0);
 assert.equal(f.state.calls.filter(c=>c[0]==='open').length,mode==='focus-error'?0:1);
 if(mode==='timeout'){
  const item=f.state.messages[0];item.port.postMessage({protocol:FRAME_PUSH_PROTOCOL,kind:'ack',requestId:item.data.requestId,path:item.data.path,accepted:true});item.port.close();await turn();
  assert.equal(f.state.calls.filter(c=>c[0]==='open').length,1);
 }
});
test('worker rejects an uncorrelated ACK until timeout',async()=>{
 const f=workerFixture();f.clients.push(f.client('frame','/app.html',{ack:null}));const run=f.click();await turn();
 const item=f.state.messages[0];item.port.postMessage({protocol:FRAME_PUSH_PROTOCOL,kind:'ack',requestId:'wrong',path:item.data.path,accepted:true});await turn();
 assert.equal(f.state.calls.filter(c=>c[0]==='open').length,0);f.expire();await run;item.port.close();
 assert.equal(f.state.calls.filter(c=>c[0]==='open').length,1);
});
test('without a frame the preferred ordinary client retains navigation/focus behavior',async()=>{
 const f=workerFixture();f.clients.push(f.client('hidden','/home_page.html',{visible:false}),f.client('visible','/profilo_privato.html'));
 await f.click({eventType:'share_invite'});assert.deepEqual(f.state.calls.filter(c=>c[0]==='navigate'),[['navigate','visible',origin+'/home_page.html']]);
 assert.equal(f.state.calls.filter(c=>c[0]==='open').length,0);
});
test('ordinary focus rejection after navigation retains the new-window fallback',async()=>{
 const f=workerFixture();f.clients.push(f.client('ordinary','/home_page.html',{focusFailure:true}));await f.click();
 assert.equal(f.state.calls.filter(c=>c[0]==='navigate').length,1);assert.equal(f.state.calls.filter(c=>c[0]==='open').length,1);
});
test('foreign-lookalike and nested-only clients cannot be navigation targets',async()=>{
 const f=workerFixture();const foreign=f.client('foreign','/app.html');foreign.url=origin+'.evil/app.html';
 f.clients.push(foreign,f.client('nested','/home_page.html',{type:'nested'}));await f.click();assert.equal(f.state.calls.filter(c=>c[0]==='open').length,1);
});
for(const data of [null,[],{eventType:'other'},{eventType:'deadline',deadlineId:{}},{eventType:'deadline',deadlineId:'x/y'},
 {eventType:'deadline',deadlineId:'x'.repeat(1025)},{eventType:'external_deadline',receivedDeadlineId:'<script>'}])
 test('malformed notification cannot navigate '+JSON.stringify(data).slice(0,85),async()=>{
  const f=workerFixture();await f.click(data);assert.deepEqual(f.state.calls,[['close']]);
 });

function receiverFixture(){
 let handler;const state={now:1000,adopted:[],updates:0},worker={scriptURL:origin+'/firebase-messaging-sw.js',state:'activated'};
 const registration={scope:origin+'/firebase-cloud-messaging-push-scope-r2/',active:worker,update:async()=>{state.updates++;}};
 const workers={addEventListener:(_n,fn)=>{handler=fn;},removeEventListener:()=>{handler=null;},getRegistrations:async()=>[registration]};
 const window={document:{},navigator:{serviceWorker:workers},location:{origin,pathname:'/app.html'},setTimeout,clearTimeout};window.parent=window;
 const owner={navigateFromPush:async(path,options)=>{if(!await options.validateSource()||!options.isActive())return false;state.adopted.push(path);return true;}};
 const dispose=installFramePushNavigation({window,owner,now:()=>state.now});
 const send=(overrides={},eventOverrides={})=>{
  const replies=[],port={closed:0,postMessage:value=>replies.push(value),close(){this.closed++;}};
  const data={protocol:FRAME_PUSH_PROTOCOL,kind:'navigate',requestId:'synthetic-request-00000001',expiresAt:2500,path:'/dettaglio_scadenza.html?id=item&notification=notice',...overrides};
  handler?.({isTrusted:true,origin,source:worker,ports:[port],data,...eventOverrides});return {replies,port};
 };
 return {state,window,worker,registration,workers,owner,dispose,send};
}
test('receiver accepts only the registered FCM worker, not the offline controller',async()=>{
 const f=receiverFixture();f.window.navigator.serviceWorker.controller={scriptURL:origin+'/sw.js'};
 try{const item=f.send();await turn();assert.equal(item.replies[0].accepted,true);assert.equal(f.state.adopted.length,1);assert.ok(item.port.closed);assert.equal(f.state.updates,1);}finally{f.dispose();}
});
for(const reason of ['synthetic-event','origin','script','not-active','scope','expired','extra','replay'])test('receiver denies '+reason,async()=>{
 const f=receiverFixture();try{
  const event={},data={};if(reason==='synthetic-event')event.isTrusted=false;if(reason==='origin')event.origin=origin+'.evil';
  if(reason==='script')event.source={scriptURL:origin+'/sw.js'};if(reason==='not-active')event.source={...f.worker};
  if(reason==='scope')f.registration.scope=origin+'/unrelated/';if(reason==='expired')data.expiresAt=999;if(reason==='extra')data.material='SYNTHETIC';
  if(reason==='replay'){f.send();await turn();f.state.adopted=[];}
  const item=f.send(data,event);await turn();assert.deepEqual(f.state.adopted,[]);assert.ok(item.port.closed);
  assert.ok(!item.replies.some(reply=>reply.accepted));
 }finally{f.dispose();}
});
for(const path of ['/impostazioni.html','//foreign.invalid/home_page.html','blob:'+origin+'/x','/home_page.html?uid=x',
 '/dettaglio_scadenza.html?id=x&received=y','/dettaglio_scadenza.html?id=x&id=y','/scadenze.html#unknown'])
 test('push path is a closed subset of the private allowlist: '+path,()=>assert.equal(framePushPath(path,origin),null));
test('receiver disposal and timeout invalidate pending source verification',async()=>{
 for(const mode of ['dispose','expire']){
  const f=receiverFixture(),pending=deferred();await turn();f.workers.getRegistrations=()=>pending.promise;
  const item=f.send();if(mode==='dispose')f.dispose();else f.state.now=2501;
  pending.resolve([f.registration]);await turn();assert.deepEqual(f.state.adopted,[]);assert.ok(!item.replies.some(reply=>reply.accepted));f.dispose();
 }
});
