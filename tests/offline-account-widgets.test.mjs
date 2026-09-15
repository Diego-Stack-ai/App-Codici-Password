import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const base='../Frontend/public/assets/js/modules/shared/';
const sources=await Promise.all(['account-shared-credentials.js','account-embedded-widgets.js'].map(async name=>(await readFile(new URL(base+name,import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/export (async )?function/g,(_,a)=>`${a||''}function`)));
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
 const sandbox={WeakMap,URLSearchParams,URL,AbortController,crypto:{randomUUID:()=> 'fixture'},auth,onAuthStateChanged:(_auth,fn)=>{listeners.add(fn);return()=>listeners.delete(fn)},createElement,clearElement,setChildren:(n,children)=>{clearElement(n);(Array.isArray(children)?children:[children]).filter(Boolean).forEach(c=>n.appendChild(c))},document:{body,getElementById:id=>roots[id],querySelectorAll:()=>[]},navigator:{onLine:true},showToast:(...x)=>toasts.push(x),ensureVaultKeyMaterial:async()=> 'key',decrypt:async()=> 'secret',listAccountWidgets:async()=>[],listAccountWidgetsConfirmed:async()=>[],listSharedVaultData:async()=>[],listSharedVaultDataConfirmed:async()=>[],updateSharedCredential:async(...x)=>writes.push(x),linkSharedCredential:async(...x)=>writes.push(x),unlinkSharedCredential:async(...x)=>writes.push(x),createAccountWidget:async(...x)=>writes.push(x),updateAccountWidget:async(...x)=>writes.push(x),deleteAccountWidget:async(...x)=>writes.push(x)};
 sandbox.addEventListener=(name,callback)=>{if(!globalListeners.has(name))globalListeners.set(name,new Set());globalListeners.get(name).add(callback)};
 sandbox.removeEventListener=(name,callback)=>globalListeners.get(name)?.delete(callback);
 sandbox.dispatchEvent=event=>{for(const callback of [...(globalListeners.get(event.type)||[])])callback(event)};
 vm.createContext(sandbox);vm.runInContext(sources[which-1],sandbox);
 const scope={uid:'A',context:'private',accountId:'one',editable:true};
 const makeLife=(signal)=>sandbox.createAccountWidgetLifecycle({...scope,signal},{section:roots['shared-credentials-section'],list:roots['shared-credentials-list'],add:roots['btn-link-shared-credential']});
 return {sandbox,roots,body,nodes,listeners,toasts,writes,scope,makeLife,globalListeners,lock(){sandbox.dispatchEvent({type:'vault-session-locked'})},logout(){auth.currentUser=null;for(const fn of [...listeners])fn(null)},button:text=>nodes.find(n=>n.textContent===text),get dialogs(){return body.children.filter(n=>n.classList.contains('modal-overlay'))}};
}

for (const company of [false, true]) {
 for (const which of [1, 2]) {
  test((company ? 'company' : 'private') + ': offline ' + (which === 1 ? 'common credential' : 'embedded widget') + ' renders cached fields, reveals and masks without a server request', async () => {
   const f = fixture(which);
   f.sandbox.navigator.onLine = false;
   const scope = {...f.scope, editable: false, context: company ? 'company' : 'private', ...(company ? {companyId:'company-one'} : {})};
   const field = {label:'PIN', encrypted:true, valueEnc:'cipher', order:0};
   const widget = {id:'widget', kind:which === 1 ? 'shared-reference' : 'embedded', context:scope.context, companyId:scope.companyId, accountId:'one', sharedDataId:'common', title:'Test widget', fields:[field], order:0};
   f.sandbox.listAccountWidgets = async () => [widget];
   f.sandbox.listSharedVaultData = async () => [{id:'common', title:'Common', fields:[field]}];
   f.sandbox.listAccountWidgetsConfirmed = f.sandbox.listSharedVaultDataConfirmed = async () => { throw new Error('Unexpected server read offline'); };
   await (which === 1 ? f.sandbox.initAccountSharedCredentials : f.sandbox.initAccountEmbeddedWidgets)(scope);
   const reveal = f.nodes.find(node => node['aria-label'] === 'Mostra PIN');
   assert.ok(reveal, 'cached field is rendered');
   await reveal.click();
   assert.equal(reveal.previousElementSibling.textContent, 'secret');
   await reveal.click();
   assert.notEqual(reveal.previousElementSibling?.textContent, 'secret');
   assert.equal(f.writes.length, 0);
  });
 }
}
