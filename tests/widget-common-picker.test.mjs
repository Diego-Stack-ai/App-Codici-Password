import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../Frontend/public/assets/js/modules/shared/account-embedded-widgets.js',import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?\n/gm,'').replace('export async function','async function');
function fixture(){
 const nodes=[], links=[];let created=0,decrypted=0, refreshed=0, active=true;
 const createElement=(tag,props={},children=[])=>{const n={tag,value:'',...props,children:children.filter(Boolean),events:{},classList:{toggle(){}},addEventListener(k,fn){this.events[k]=fn},setAttribute(k,v){this[k]=v},appendChild(x){this.children.push(x)},remove(){this.removed=true},focus(){},get firstElementChild(){return this.children[0]}};nodes.push(n);return n};
 const sandbox={clearWidgetValues:root=>{ for(const node of nodes) if(node.tag==='input') node.value=''; },createElement,setChildren:(n,c)=>n.children=(Array.isArray(c)?c:[c]).filter(Boolean),clearElement:n=>n.children=[],crypto:{randomUUID:()=> 'fixture'},document:{body:createElement('body')},showToast(){},decrypt:async()=>{decrypted++;throw Error('no common decrypt')},ensureVaultKeyMaterial:async()=>{throw Error('no common unlock')},createAccountWidget:async()=>created++,linkSharedCredential:async(...args)=>links.push(args)};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const context={uid:'A',accountId:'second',companyId:'company-B',context:'company',editable:true,active:()=>active,registerCleanup:()=>()=>{},onSharedLinked:async()=>refreshed++};
 return {sandbox,nodes,links,context,get created(){return created},get decrypted(){return decrypted},get refreshed(){return refreshed},set active(v){active=v},open:commons=>sandbox.openEditor(null,context,async()=>{},[],commons)};
}
const pec={id:'pec',title:'PEC Legalmail',revision:4,fields:[{valueEnc:'never-read'}]};
test('common already used by another account/company remains available, only exact account is excluded',()=>{
 const f=fixture();const widgets=[{kind:'shared-reference',context:'company',accountId:'first',companyId:'company-A',sharedDataId:'pec'}];
 assert.equal(f.sandbox.availableCommonCredentials([pec],widgets,f.context).length,1);
 widgets[0].accountId='second';assert.equal(f.sandbox.availableCommonCredentials([pec],widgets,f.context).length,1);
 widgets[0].companyId='company-B';assert.equal(f.sandbox.availableCommonCredentials([pec],widgets,f.context).length,0);
 widgets[0].context='private';assert.equal(f.sandbox.availableCommonCredentials([pec],widgets,f.context).length,1);
});
test('picker links same central ID without creating a widget or decrypting common values',async()=>{
 const f=fixture();await f.open([pec]);const select=f.nodes.find(n=>n.tag==='select');
 assert.ok(select.children.some(n=>n.textContent==='Collega credenziale comune: PEC Legalmail'));
 select.value='common:0';select.events.change();const title=f.nodes.find(n=>n.placeholder==='Titolo del widget');assert.equal(title.hidden,true);assert.equal(title.required,false);
 await f.nodes.find(n=>n.tag==='form').events.submit({preventDefault(){}});
 assert.equal(f.links.length,1);assert.equal(f.links[0][0],'pec');assert.equal(f.links[0][1],4);assert.equal(f.links[0][2].accountId,'second');assert.equal(f.links[0][2].companyId,'company-B');assert.equal(f.created,0);assert.equal(f.decrypted,0);assert.equal(f.refreshed,1);
});
test('expired context prevents common link; switching back restores embedded editor',async()=>{
 const f=fixture();await f.open([pec]);const select=f.nodes.find(n=>n.tag==='select');select.value='common:0';select.events.change();f.active=false;
 await f.nodes.find(n=>n.tag==='form').events.submit({preventDefault(){}});assert.equal(f.links.length,0);
 select.value='';select.events.change();const title=f.nodes.find(n=>n.placeholder==='Titolo del widget');assert.equal(title.hidden,false);assert.equal(title.required,true);
});

test('failed common link preserves picker and never falls back to embedded creation',async()=>{
 const f=fixture();f.sandbox.linkSharedCredential=async()=>{throw Error('conflict')};await f.open([pec]);const select=f.nodes.find(n=>n.tag==='select');select.value='common:0';select.events.change();
 await f.nodes.find(n=>n.tag==='form').events.submit({preventDefault(){}});
 assert.equal(f.created,0);assert.equal(f.refreshed,0);assert.equal(f.nodes.find(n=>n.className==='modal-overlay active').removed,undefined);assert.equal(f.nodes.find(n=>n.type==='submit').disabled,false);
});
