import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source=await readFile(new URL('../Frontend/public/assets/js/modules/privato/form_account_privato.js',import.meta.url),'utf8');
const callback=source.slice(source.indexOf('let bankingRenderVersion'),source.indexOf('// Utility per recupero')).replace("await import('../shared/banking-renderer.js')",'await loadBankingRenderer()');
function fixture(){let imports=0,resolve;const rendered=[],toasts=[];const gate=new Promise(r=>resolve=r);const state={formVersion:1,currentUid:'A',auth:{currentUser:{uid:'A'}},bankAccounts:[],document:{getElementById:()=>({})},clearElement(){},showToast:message=>toasts.push(message),loadBankingRenderer:()=>{imports++;return gate}};vm.createContext(state);vm.runInContext(callback,state);return {state,rendered,toasts,get imports(){return imports},run:()=>vm.runInContext('rerender()',state),resolve:()=>resolve({renderBankAccounts:(data,rerender)=>rendered.push({data,rerender})})};}
test('bank editor is absent from initial imports and loads only for real bank fields',async()=>{
 assert.doesNotMatch(source,/^import .* from ['"]\.\.\/shared\/banking-renderer\.js['"]/m);
 const f=fixture();assert.equal(f.imports,0);await f.run();assert.equal(f.imports,0);f.state.bankAccounts=[{iban:'fixture'}];const rendering=f.run();assert.equal(f.imports,1);f.resolve();await rendering;assert.equal(f.rendered.length,1);assert.equal(f.rendered[0].data,f.state.bankAccounts);
});
test('late bank editor import cannot render for a previous account or logged-out user',async()=>{
 for(const mode of ['navigation','logout']){const f=fixture();f.state.bankAccounts=[{iban:'fixture'}];const rendering=f.run();if(mode==='navigation')f.state.formVersion++;else f.state.auth.currentUser=null;f.resolve();await rendering;assert.equal(f.rendered.length,0);assert.equal(f.toasts.length,0);}
});
test('overlapping bank render requests apply only newest state',async()=>{
 const f=fixture();f.state.bankAccounts=[{iban:'old'}];const first=f.run();f.state.bankAccounts=[{iban:'new'}];const second=f.run();f.resolve();await Promise.all([first,second]);assert.equal(f.rendered.length,1);assert.equal(f.rendered[0].data[0].iban,'new');
});
