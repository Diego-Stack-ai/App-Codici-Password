import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const source=(await readFile(new URL('../Frontend/public/assets/js/modules/data/account-widget-client.js',import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/export async function/g,'async function');

test('widget create/update rifiutano cambio UID o teardown durante cifratura',async()=>{
 for(const action of ['create','update'])for(const change of ['uid','context','none']){
  let sent=0,active=true;
  const auth={currentUser:{uid:'owner'}},account={uid:'owner',context:'private',accountId:'record',active:()=>active};
  const sandbox={auth,functions:{},httpsCallable:()=>async command=>{assert.equal(command.expectedOwnerUid,'owner');sent++;return{data:{status:'applied'}}},navigator:{onLine:true},
   ensureVaultKeyMaterial:async()=> 'key',encrypt:async v=>v,createEmbeddedWidgetIdentifiers:()=>({widgetId:'widget'}),
   prepareEmbeddedAccountWidget:async()=>{if(change==='uid')auth.currentUser={uid:'other'};if(change==='context')active=false;return{context:'private',accountId:'record'}}};
  vm.createContext(sandbox);vm.runInContext(source,sandbox);
  const promise=action==='create'?sandbox.createAccountWidget({},account):sandbox.updateAccountWidget('widget',1,{},account);
  if(change==='none'){await promise;assert.equal(sent,1);}else{await assert.rejects(promise,/SESSION_CHANGED/);assert.equal(sent,0);}
 }
});

test('widget deletion sends an explicit owner and rejects a stale account context',async()=>{
 const calls=[],auth={currentUser:{uid:'owner'}};
 const sandbox={auth,functions:{},httpsCallable:()=>async command=>{calls.push(command);return{data:{status:'applied'}}},navigator:{onLine:true},createEmbeddedWidgetIdentifiers:()=>({widgetId:'widget'})};
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 const widget={id:'widget',revision:1,context:'private',accountId:'record'};
 await sandbox.deleteAccountWidget(widget,{uid:'owner'});
 assert.equal(calls[0].expectedOwnerUid,'owner');assert.equal(calls[0].action,'delete');
 auth.currentUser={uid:'other'};
 await assert.rejects(sandbox.deleteAccountWidget(widget,{uid:'owner'}),/SESSION_CHANGED/);
 assert.equal(calls.length,1);
});
