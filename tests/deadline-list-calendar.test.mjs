import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const base=new URL('../Frontend/public/assets/js/modules/scadenze/',import.meta.url);
const strip=s=>s.replace(/^import .*;\r?\n/gm,'').replace(/\bexport /g,'');
const source=(await Promise.all(['deadline-model.js','scadenze.js'].map(p=>readFile(new URL(p,base),'utf8')))).map(strip).join('\n');
function fixture(route=''){
 let clock=new Date(2026,8,26,23,59,59).getTime(), ready=true, pending=null;
 class Clock extends Date{constructor(...a){super(...(a.length?a:[clock]));}}
 const events=new Map(),timers=new Map(),callbacks=[],swipes=[],reads=[],writes=[],confirmations=[];
 const target={addEventListener:(n,fn)=>{if(!events.has(n))events.set(n,new Set());events.get(n).add(fn);},removeEventListener:(n,fn)=>events.get(n)?.delete(fn)};
 const node=(tag,props={},children=[])=>{const local=new Map();return{tag,...props,children,
  appendChild(x){this.children.push(x);},replaceChildren(...xs){this.children=xs;},
  addEventListener(n,fn){if(!local.has(n))local.set(n,new Set());local.get(n).add(fn);},
  removeEventListener(n,fn){local.get(n)?.delete(fn);},dispatch(n,event={}){for(const fn of local.get(n)||[])fn(event);}};};
 const list=node('div'),count=node('span'),search=node('input',{value:''});
 const data={owned:[{id:'same',type:'Bollo',dueDate:'2026-09-26'}],received:[{id:'same',type:'Bollo',dueDate:'2026-09-26',permission:'view'}]};
 const auth={currentUser:{uid:'A'}};
 const location={search:route,href:`https://app.test/scadenze.html${route}`};
 let replaced='';
 const history={replaceState(_state,_title,value){replaced=value;const parsed=new URL(value,location.href);location.href=parsed.href;location.search=parsed.search;}};
 const context=vm.createContext({Date:Clock,URL,URLSearchParams,auth,db:{},console,
  document:{...target,visibilityState:'visible',querySelector:s=>s==='#scadenze-list'?list:null,querySelectorAll:()=>[],
   getElementById:id=>id==='deadline-count'?count:id==='deadline-search'?search:null},
  window:{...target,location,history,privateAuthGate:{isReady:()=>ready}},
  setTimeout:(fn,ms)=>{const id=Symbol();timers.set(id,{fn,ms});return id;},clearTimeout:id=>timers.delete(id),
  createElement:node,setChildren:(n,xs)=>n.replaceChildren(...(Array.isArray(xs)?xs:[xs])),clearElement:n=>n.replaceChildren(),t:k=>k,
  getFooterReady:()=>({center:null}),SwipeList:class{
   constructor(selector,options){this.selector=selector;this.options=options;swipes.push(this);}
   destroy(){this.destroyed=true;}
  },
  onAuthStateChanged:(_,fn)=>{const cb={fn,stopped:false};callbacks.push(cb);return()=>cb.stopped=true;},
  listDeadlines:async uid=>{reads.push(uid);const result=data.owned;if(pending)await pending;return result;},
  listReceivedDeadlines:async uid=>{reads.push(uid);const result=data.received;if(pending)await pending;return result;},
  doc:(_, ...parts)=>parts.join('/'),serverTimestamp:()=>({server:true}),
  updateDoc:async(...a)=>writes.push(['update',...a]),deleteDoc:async(...a)=>writes.push(['delete',...a]),
  showConfirmModal:async(...a)=>{confirmations.push(a);return true;},showToast(){},logError(){}
 });
 vm.runInContext(source,context);
 const drain=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
 return {context,data,auth,list,count,search,reads,writes,swipes,callbacks,timers,confirmations,
  start:()=>vm.runInContext('initScadenze(auth.currentUser)',context),
  input:value=>{search.value=value;search.dispatch('input',{target:search});},replaced:()=>replaced,
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
 assert.equal(f.list.children[0].children.length,3);assert.equal(f.list.children[1].children.length,1);
 assert.equal(f.swipes[0].selector,'.deadline-card-owned');
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
 const initialHref=f.context.window.location.href;
 await f.fire(event);card.onclick();await swipe.onSwipeLeft({dataset:{id:'same'}});
 assert.equal(f.list.children.length,0);assert.equal(f.timers.size,0);assert.equal(f.callbacks[0].stopped,true);
 assert.equal(f.context.window.location.href,initialHref);assert.equal(f.writes.length,0);
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
test('rule route is shown in search and clearing it removes the exact rule constraint',async()=>{
 const f=fixture('?rule=Bollo');
 f.data.owned.push({id:'insurance',type:'Assicurazione',dueDate:'2026-09-26'});
 await f.start();
 assert.equal(f.search.value,'Bollo');assert.equal(f.count.textContent,2);
 f.input('');
 assert.equal(f.count.textContent,3);assert.equal(f.replaced(),'/scadenze.html');
});
test('deadline cards expose a chevron that indicates opening the detail',async()=>{
 const f=fixture();await f.start();
 const descendants=node=>[node,...(node.children||[]).flatMap(descendants)];
 const nodes=descendants(f.list.children[0]);
 assert.ok(nodes.some(node=>node.className?.includes('deadline-card-chevron')));
 assert.ok(nodes.some(node=>node.textContent==='chevron_right'));
});

test('right swipe archives active deadlines and restores archived deadlines',async()=>{
 const f=fixture();f.data.received=[];await f.start();
 const activeSwipe=f.swipes.at(-1).options;
 assert.equal(activeSwipe.canSwipeLeft({dataset:{archived:'false'}}),true);
 await activeSwipe.onSwipeRight({dataset:{id:'same',archived:'false'}});
 assert.equal(JSON.stringify(f.writes.at(-1)),JSON.stringify(['update','users/A/scadenze/same',{completed:true,completedAt:{server:true}}]));
 f.filter('completed');
 const archivedSwipe=f.swipes.at(-1).options;
 assert.equal(archivedSwipe.canSwipeLeft({dataset:{archived:'true'}}),true);
 await archivedSwipe.onSwipeRight({dataset:{id:'same',archived:'true'}});
 assert.equal(JSON.stringify(f.writes.at(-1)),JSON.stringify(['update','users/A/scadenze/same',{completed:false,completedAt:null}]));
});

test('left swipe permanently deletes active and archived owned deadlines after confirmation',async()=>{
 for(const archived of [false,true]){
  const f=fixture();f.data.received=[];f.data.owned[0].completed=archived;await f.start();
  if(archived)f.filter('completed');
  const swipe=f.swipes.at(-1).options;
  assert.equal(swipe.canSwipeLeft({dataset:{archived:String(archived)}}),true);
  await swipe.onSwipeLeft({dataset:{id:'same',archived:String(archived)}});
  assert.equal(f.confirmations.length,1);
  assert.deepEqual(f.writes.at(-1),['delete','users/A/scadenze/same']);
 }
});
