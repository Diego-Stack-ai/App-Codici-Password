import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const base='../Frontend/public/assets/js/modules/shared/';
const sources=await Promise.all(['account-widget-lifecycle.js','account-shared-credentials.js','account-embedded-widgets.js'].map(async name=>(await readFile(new URL(base+name,import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/export (async )?function/g,(_,a)=>`${a||''}function`)));
const deferred=()=>{let resolve;return {promise:new Promise(r=>resolve=r),resolve}};
function fixture(which=1){
 const nodes=[], listeners=new Set(), toasts=[], writes=[], globalListeners=new Map();
 class Node {
  constructor(tag,props={},children=[]){this.tag=tag;this.children=[];this.value='';this.dataset={};this.events={};Object.assign(this,props);const classes=new Set((this.className||'').split(' '));this.classList={add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x),toggle:(x,v)=>{const yes=v??!classes.has(x);yes?classes.add(x):classes.delete(x);return yes}};children.filter(Boolean).forEach(x=>this.appendChild(x));nodes.push(this);}
  appendChild(n){n.parent=this;this.children.push(n);return n}
  remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);this.parent=null}
  addEventListener(k,fn){this.events[k]=fn}
  setAttribute(k,v){this[k]=v}
  focus(){}
  click(){return this.onclick?.({currentTarget:this})}
  get firstElementChild(){return this.children[0]}
  get previousElementSibling(){return this.parent?.children[this.parent.children.indexOf(this)-1]}
  querySelectorAll(selector){const matches=n=>selector.split(',').some(raw=>{const q=raw.trim();return q.startsWith('.')?n.classList.contains(q.slice(1)):n.tag===q});return this.children.flatMap(n=>[...(matches(n)?[n]:[]),...n.querySelectorAll(selector)])}
  querySelector(s){return this.querySelectorAll(s)[0]}
 }
 const createElement=(...args)=>new Node(...args),clearElement=n=>{n.children.forEach(c=>c.parent=null);n.children=[]};
 const roots={};for(const prefix of ['shared-credentials','account-widgets']){roots[prefix+'-section']=createElement('section');roots[prefix+'-list']=createElement('div');}
 roots['btn-link-shared-credential']=createElement('button');roots['btn-add-account-widget']=createElement('button');
 const body=createElement('body');Object.values(roots).forEach(n=>body.appendChild(n));
 const auth={currentUser:{uid:'A'}};
 const sandbox={WeakMap,URLSearchParams,URL,AbortController,crypto:{randomUUID:()=> 'fixture'},auth,onAuthStateChanged:(_auth,fn)=>{listeners.add(fn);return()=>listeners.delete(fn)},createElement,clearElement,setChildren:(n,children)=>{clearElement(n);(Array.isArray(children)?children:[children]).filter(Boolean).forEach(c=>n.appendChild(c))},document:{body,getElementById:id=>roots[id]},navigator:{onLine:true},showToast:(...x)=>toasts.push(x),ensureVaultKeyMaterial:async()=> 'key',decrypt:async()=> 'secret',listAccountWidgets:async()=>[],listAccountWidgetsConfirmed:async()=>[],listSharedVaultData:async()=>[],listSharedVaultDataConfirmed:async()=>[],updateSharedCredential:async(...x)=>writes.push(x),linkSharedCredential:async(...x)=>writes.push(x),unlinkSharedCredential:async(...x)=>writes.push(x),createAccountWidget:async(...x)=>writes.push(x),updateAccountWidget:async(...x)=>writes.push(x),deleteAccountWidget:async(...x)=>writes.push(x)};
 sandbox.addEventListener=(name,callback)=>{if(!globalListeners.has(name))globalListeners.set(name,new Set());globalListeners.get(name).add(callback)};
 sandbox.removeEventListener=(name,callback)=>globalListeners.get(name)?.delete(callback);
 sandbox.dispatchEvent=event=>{for(const callback of [...(globalListeners.get(event.type)||[])])callback(event)};
 vm.createContext(sandbox);vm.runInContext(sources[0],sandbox);vm.runInContext(sources[which],sandbox);
 const scope={uid:'A',context:'private',accountId:'one',editable:true};
 const makeLife=(signal)=>sandbox.createAccountWidgetLifecycle({...scope,signal},{section:roots['shared-credentials-section'],list:roots['shared-credentials-list'],add:roots['btn-link-shared-credential']});
 return {sandbox,roots,body,nodes,listeners,toasts,writes,scope,makeLife,globalListeners,lock(){sandbox.dispatchEvent({type:'vault-session-locked'})},logout(){auth.currentUser=null;for(const fn of [...listeners])fn(null)},button:text=>nodes.find(n=>n.textContent===text),get dialogs(){return body.children.filter(n=>n.classList.contains('modal-overlay'))}};
}

test('same-UID Vault lock clears an open editor and confirmation and removes every lifecycle listener',async()=>{
 const f=fixture();const life=f.makeLife();
 await f.sandbox.editCredential({id:'common',revision:1,fields:[{label:'secret',encrypted:true,valueEnc:'cipher'}]}, {...f.scope,...life},async()=>{});
 const input=f.dialogs[0].querySelector('input'), save=f.button('Salva modifica comune');
 const pending=save.click();assert.equal(f.dialogs.length,2);f.lock();await pending;
 assert.equal(f.sandbox.auth.currentUser.uid,'A');assert.equal(life.active(),false);assert.equal(input.value,'');assert.equal(f.dialogs.length,0);
 assert.equal(f.listeners.size,0);assert.equal(f.globalListeners.get('vault-session-locked').size,0);assert.equal(f.globalListeners.get('pagehide').size,0);
 await save.click();assert.equal(f.writes.length,0);assert.equal(f.toasts.length,0);
});

test('same-UID Vault lock during decrypt prevents late clipboard output and leaves a newer mount intact',async()=>{
 const f=fixture(2);const life=f.makeLife();const gate=deferred();let copies=0;
 f.sandbox.navigator.clipboard={writeText:async()=>copies++};f.sandbox.decrypt=()=>gate.promise;
 const pending=f.sandbox.copyField({encrypted:true,valueEnc:'cipher'},{...f.scope,...life});await Promise.resolve();f.lock();
 const next=f.makeLife();gate.resolve('late-secret');await pending;life.destroy();
 assert.equal(copies,0);assert.equal(f.toasts.length,0);assert.equal(next.active(),true);assert.equal(f.globalListeners.get('vault-session-locked').size,1);
 next.destroy();assert.equal(f.globalListeners.get('vault-session-locked').size,0);
});
test('new mount destroys only previous instance, clears values, unregisters auth and resolves its prompt',async()=>{
 const f=fixture();const first=f.makeLife();const pending=first.requestDecision('Old','message','Yes','No',{initialValue:'private'});const old=f.dialogs[0];const input=old.querySelector('input');
 const next=f.makeLife();assert.equal(await pending,null);assert.equal(input.value,'');assert.equal(f.dialogs.length,0);assert.equal(f.listeners.size,1);
 const nextPrompt=next.requestDecision('New','message');first.destroy();assert.equal(f.dialogs.length,1);next.destroy();assert.equal(await nextPrompt,false);assert.equal(f.listeners.size,0);assert.equal(first.active(),false);
});
test('shared editor abort clears input and blocks retained save callback',async()=>{
 const f=fixture();const abort=new AbortController();const life=f.makeLife(abort.signal);
 await f.sandbox.editCredential({id:'common',revision:1,fields:[{label:'secret',encrypted:true,valueEnc:'cipher'}]}, {...f.scope,...life},async()=>{});
 const input=f.dialogs[0].querySelector('input');const save=f.button('Salva modifica comune');abort.abort();assert.equal(input.value,'');assert.equal(f.dialogs.length,0);await save.click();assert.equal(f.writes.length,0);
});
test('logout while shared confirmation waits closes both dialogs and never saves',async()=>{
 const f=fixture();const life=f.makeLife();await f.sandbox.editCredential({id:'common',revision:1,fields:[{label:'secret',encrypted:true,valueEnc:'cipher'}]}, {...f.scope,...life},async()=>{});
 const saving=f.button('Salva modifica comune').click();assert.equal(f.dialogs.length,2);f.logout();await saving;assert.equal(f.dialogs.length,0);assert.equal(f.writes.length,0);assert.equal(f.toasts.length,0);
});
test('aborted shared read cannot render into a newer account mount',async()=>{
 const f=fixture();const gate=deferred();f.sandbox.listAccountWidgetsConfirmed=()=>gate.promise;
 const a=new AbortController();const pending=f.sandbox.initAccountSharedCredentials({...f.scope,signal:a.signal});a.abort();
 f.sandbox.listAccountWidgetsConfirmed=async()=>[];const next=await f.sandbox.initAccountSharedCredentials({...f.scope,accountId:'two'});
 gate.resolve([{kind:'shared-reference',context:'private',accountId:'one',sharedDataId:'private'}]);await pending;assert.equal(f.roots['shared-credentials-list'].children.length,0);assert.equal(f.listeners.size,1);next.destroy();
});
test('embedded decrypt completed after abort cannot mount cards or reveal values',async()=>{
 const f=fixture(2);const gate=deferred();f.sandbox.listAccountWidgets=async()=>[{id:'one',kind:'embedded',context:'private',accountId:'one',fields:[{label:'PIN',encrypted:true,valueEnc:'cipher'}]}];f.sandbox.decrypt=()=>gate.promise;
 const a=new AbortController();const pending=f.sandbox.initAccountEmbeddedWidgets({...f.scope,signal:a.signal});await new Promise(r=>setImmediate(r));a.abort();gate.resolve('late-secret');const controller=await pending;
 assert.equal(f.roots['account-widgets-list'].children.length,0);await assert.rejects(controller.savePendingChanges(),/DISPOSED/);assert.equal(f.writes.length,0);
});
test('embedded editor cleanup clears fields and rejects stale submit after logout',async()=>{
 const f=fixture(2);const life=f.makeLife();await f.sandbox.openEditor({id:'w',title:'Widget',fields:[{id:'field',label:'PIN',encrypted:true,valueEnc:'cipher'}]}, {...f.scope,...life},async()=>{});
 const modal=f.dialogs[0];const form=modal.querySelector('form');const inputs=modal.querySelectorAll('input');f.logout();await form.events.submit({preventDefault(){}});assert.ok(inputs.every(n=>n.value===''));assert.equal(f.writes.length,0);assert.equal(f.dialogs.length,0);
});
test('late clipboard decrypt after teardown performs no copy or toast',async()=>{
 const f=fixture(2);const life=f.makeLife();const gate=deferred();let copies=0;f.sandbox.navigator.clipboard={writeText:async()=>copies++};f.sandbox.decrypt=()=>gate.promise;
 const pending=f.sandbox.copyField({encrypted:true,valueEnc:'cipher'},{...f.scope,...life});await Promise.resolve();life.destroy();gate.resolve('late');await pending;assert.equal(copies,0);assert.equal(f.toasts.length,0);
});

test('owned prompt supports Escape and restores focus only within the surviving context',async()=>{
 const f=fixture();let focused=0;const previous={isConnected:true,focus:()=>focused++};f.sandbox.document.activeElement=previous;
 const life=f.makeLife();const pending=life.requestDecision('Confirm','message');const modal=f.dialogs[0];const section=modal.querySelector('section');assert.equal(section['aria-labelledby'],modal.querySelector('h3').id);
 modal.events.keydown({key:'Escape',preventDefault(){}});assert.equal(await pending,false);assert.equal(focused,1);
 const aborted=life.requestDecision('Another','message');life.destroy();assert.equal(await aborted,false);assert.equal(focused,1);
});

test('detached section during read cannot render and releases its auth listener',async()=>{
 const f=fixture();const gate=deferred();f.sandbox.listAccountWidgetsConfirmed=()=>gate.promise;
 const pending=f.sandbox.initAccountSharedCredentials(f.scope);f.roots['shared-credentials-section'].isConnected=false;
 gate.resolve([]);const controller=await pending;assert.equal(f.roots['shared-credentials-list'].children.length,0);assert.equal(f.listeners.size,0);controller.destroy();
});
test('detached section during editor decrypt clears existing UI and prevents late modal or write',async()=>{
 const f=fixture();const life=f.makeLife();const gate=deferred();f.sandbox.decrypt=()=>gate.promise;
 const pending=f.sandbox.editCredential({id:'common',revision:1,fields:[{label:'secret',encrypted:true,valueEnc:'cipher'}]}, {...f.scope,...life},async()=>{});
 await Promise.resolve();f.roots['shared-credentials-section'].isConnected=false;gate.resolve('late-secret');await pending;
 assert.equal(f.dialogs.length,0);assert.equal(f.writes.length,0);assert.equal(f.listeners.size,0);assert.equal(life.active(),false);
});
test('parent context invalidation destroys child lifecycle without an AbortSignal',async()=>{
 const f=fixture();let active=true;const life=f.sandbox.createAccountWidgetLifecycle({...f.scope,active:()=>active},{section:f.roots['shared-credentials-section'],list:f.roots['shared-credentials-list'],add:f.roots['btn-link-shared-credential']});
 const pending=life.requestDecision('Review','message');active=false;assert.equal(life.active(),false);assert.equal(await pending,false);assert.equal(f.dialogs.length,0);assert.equal(f.listeners.size,0);
});
