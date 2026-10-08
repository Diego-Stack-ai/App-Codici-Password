import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const base=new URL('../Frontend/public/assets/js/modules/scadenze/',import.meta.url);
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'');
const source=(await Promise.all(['deadline-model.js','scadenze.js'].map(p=>readFile(new URL(p,base),'utf8')))).map(strip).join('\n');
function fixture(){
 let clock=new Date(2026,8,26,23,59,59).getTime(), ready=true, pending=null;
 class Clock extends Date{constructor(...a){super(...(a.length?a:[clock]));}}
 const events=new Map(),timers=new Map(),callbacks=[],swipes=[],reads=[],writes=[];
 const target={addEventListener:(n,fn)=>{if(!events.has(n))events.set(n,new Set());events.get(n).add(fn);},removeEventListener:(n,fn)=>events.get(n)?.delete(fn)};
 const node=(tag,props={},children=[])=>({tag,...props,children,appendChild(x){this.children.push(x);},replaceChildren(...xs){this.children=xs;}});
 const list=node('div'),count=node('span');
 const data={owned:[{id:'same',type:'Bollo',dueDate:'2026-09-26'}],received:[{id:'same',type:'Bollo',dueDate:'2026-09-26',permission:'view'}]};
 const auth={currentUser:{uid:'A'}};
 const context=vm.createContext({Date:Clock,URLSearchParams,auth,db:{},console,
  document:{...target,visibilityState:'visible',querySelector:s=>s==='#scadenze-list'?list:null,querySelectorAll:()=>[],getElementById:id=>id==='deadline-count'?count:null},
  window:{...target,location:{search:'',href:''},privateAuthGate:{isReady:()=>ready}},
  setTimeout:(fn,ms)=>{const id=Symbol();timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  createElement:node,setChildren:(n,xs)=>n.replaceChildren(...(Array.isArray(xs)?xs:[xs])),clearElement:n=>n.replaceChildren(),t:k=>k,
  getFooterReady:()=>({center:null}),SwipeList:class{constructor(selector,options){swipes.push({selector,options});}},
  onAuthStateChanged:(_,fn)=>{const cb={fn,stopped:false};callbacks.push(cb);return()=>cb.stopped=true;},
  listDeadlines:async uid=>{reads.push(uid);const result=data.owned;if(pending)await pending;return result;},
  listReceivedDeadlines:async uid=>{reads.push(uid);const result=data.received;if(pending)await pending;return result;},
  doc:(_, ...parts)=>parts.join('/'),updateDoc:async(...a)=>writes.push(a),deleteDoc:async(...a)=>writes.push(a),showToast(){},logError(){}
 });
 vm.runInContext(source,context);
 const drain=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 return {context,data,auth,list,count,reads,writes,swipes,callbacks,timers,
  start:()=>vm.runInContext('initScadenze(auth.currentUser)',context),
  filter:value=>{context.filterValue=value;vm.runInContext('activeFilter=filterValue;renderFilteredScadenze()',context);},
  fire:async name=>{for(const fn of [...(events.get(name)||[])])fn();await drain();},
  date:value=>clock=value.getTime(),
  tick:async()=>{const [id,{fn}]=timers.entries().next().value;timers.delete(id);fn();await drain();},
  defer:()=>{let release;pending=new Promise(r=>release=r);return()=>{pending=null;release();};}
 };
}
test('list uses calendar boundary for owned and received without merging same ids or enabling received swipe',async()=>{
 const f=fixture();await f.start();assert.equal(f.count.textContent,2);
 assert.ok(f.list.children.every(n=>n.className.includes('deadline-card-upcoming')));
 assert.equal(f.list.children[0].dataset.href,'dettaglio_scadenza.html?id=same');
 assert.equal(f.list.children[1].dataset.href,'dettaglio_scadenza.html?received=same');
 assert.equal(f.list.children[1].children.length,1);assert.equal(f.swipes[0].selector,'.deadline-card-owned');
 f.filter('urgent');assert.equal(f.count.textContent,0);
 f.date(new Date(2026,8,27));await f.tick();assert.equal(f.count.textContent,2);
 assert.ok(f.list.children.every(n=>n.className.includes('deadline-card-expired')));assert.equal(f.writes.length,0);
});
test('completed records excluded from urgency, invalid dates excluded, 30-day boundary inclusive',async()=>{
 const f=fixture();f.data.received=[];
 f.data.owned=[0,30,31,-1].map((d,i)=>({id:String(i),dueDate:new Date(2026,8,26+d)}));
 f.data.owned.push({id:'done',dueDate:'2026-09-20',completed:true},{id:'bad',dueDate:'invalid'});
 await f.start();f.filter('expiring');assert.equal(f.count.textContent,2);
 f.filter('urgent');assert.equal(f.count.textContent,1);
 f.filter('completed');assert.equal(f.count.textContent,1);
});
for(const event of ['pagehide','private-auth-blocked'])test(`list ${event} cancels timer and stale card/swipe callbacks`,async()=>{
 const f=fixture();await f.start();const card=f.list.children[0],swipe=f.swipes[0].options;
 await f.fire(event);card.onclick();await swipe.onSwipeLeft({dataset:{id:'same'}});
 assert.equal(f.list.children.length,0);assert.equal(f.timers.size,0);assert.equal(f.callbacks[0].stopped,true);
 assert.equal(f.context.window.location.href,'');assert.equal(f.writes.length,0);
});
test('old UID and same UID pending loads cannot replace the fresh mount',async()=>{
 const f=fixture();const release=f.defer();const first=f.start();
 f.auth.currentUser={uid:'B'};f.callbacks[0].fn(f.auth.currentUser);
 f.data.owned=[{id:'new',dueDate:'2026-09-26'}];f.data.received=[];
 const second=f.start();release();await Promise.all([first,second]);
 assert.equal(f.list.children[0].dataset.id,'new');assert.equal(f.swipes.length,1);
 const unlock=f.defer();const third=f.start();const fourth=f.start();unlock();await Promise.all([third,fourth]);
 assert.equal(f.swipes.length,2);assert.equal(f.callbacks.filter(x=>!x.stopped).length,1);
});
test('visibility refresh picks up completion/date changes without writes',async()=>{
 const f=fixture();await f.start();f.data.owned[0].completed=true;f.data.received[0].dueDate='2026-09-20';
 await f.fire('visibilitychange');assert.equal(f.count.textContent,1);
 assert.ok(f.list.children[0].className.includes('deadline-card-expired'));assert.equal(f.writes.length,0);
});
