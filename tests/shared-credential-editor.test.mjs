import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../Frontend/public/assets/js/modules/shared/account-shared-credentials.js',import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/export (async )?function/g, '$1function');
function fixture(){
 const nodes=[], updates=[]; let decrypted=0, active=true, confirm=true, fail=false;
 const createElement=(tag, props={},children=[])=>{const n={tag,...props,children, classList:{toggle(){}},appendChild(x){this.children.push(x)},remove(){this.removed=true}};nodes.push(n);return n};
 const body=createElement('body');
 const context={editable:true,active:()=>active};
 const record={id:'common',revision:3,title:'Legalmail',fields:[{id:'secret',label:'PIN',type:'sensitive',encrypted:true,valueEnc:'cipher'},{id:'bool',label:'Flag',type:'boolean',value:false,encrypted:false}]};
 const sandbox={createElement,document:{body},ensureVaultKeyMaterial:async()=> 'key',decrypt:async()=>{decrypted++;return 'old'},showConfirmModal:async()=>typeof confirm === 'function' ? confirm() : confirm,showToast(){},updateSharedCredential:async(...args)=>{if(fail)throw Error('failure');updates.push(args)}};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 return {nodes,updates,record,context,open:()=>sandbox.editCredential(record,context,async()=>{}),get decrypted(){return decrypted},set active(v){active=v},set confirm(v){confirm=v},set fail(v){fail=v},button:t=>nodes.find(n=>n.textContent===t),inputs:()=>nodes.filter(n=>n.tag==='input')};
}
test('editor decrypts only on open, preserves structure and needs confirmation',async()=>{const f=fixture();assert.equal(f.decrypted,0);await f.open();assert.equal(f.decrypted,1);const inputs=f.inputs();assert.equal(inputs[0].type,'text');assert.match(inputs[0].className,/local-data-masked/);inputs[0].value='new';f.confirm=false;await f.button('Salva modifica comune').onclick();assert.equal(f.updates.length,0);f.confirm=true;await f.button('Salva modifica comune').onclick();const [id,rev,data]=f.updates[0];assert.equal(id,'common');assert.equal(rev,3);assert.equal(data.fields[0].id,'secret');assert.equal(data.fields[0].encrypted,true);assert.equal(data.fields[0].value,'new');assert.equal(data.fields[1].value,false);assert.equal(f.record.fields[0].valueEnc,'cipher');assert.equal(inputs[0].value,'');});
test('failure keeps editor values and original; cancel clears inputs',async()=>{const f=fixture();await f.open();f.inputs()[0].value='draft';f.fail=true;await f.button('Salva modifica comune').onclick();assert.equal(f.inputs()[0].value,'draft');assert.equal(f.record.fields[0].valueEnc,'cipher');f.button('Annulla').onclick();assert.equal(f.inputs()[0].value,'');});
test('read-only and expired context cannot edit or submit',async()=>{const f=fixture();f.context.readOnly=true;await f.open();assert.equal(f.decrypted,0);f.context.readOnly=false;await f.open();f.active=false;await f.button('Salva modifica comune').onclick();assert.equal(f.updates.length,0);});

test('UID change while confirmation waits clears editor and sends nothing',async()=>{const f=fixture();await f.open();f.confirm=()=>{f.active=false;return true};await f.button('Salva modifica comune').onclick();assert.equal(f.updates.length,0);assert.equal(f.inputs()[0].value,'');});
