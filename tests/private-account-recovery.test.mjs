import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const path='../Frontend/public/assets/js/modules/privato/';
const formSource=await readFile(new URL(path+'form_account_privato.js',import.meta.url),'utf8');
const restoreSource=formSource.slice(formSource.indexOf('async function restoreM6ConflictDraft'),formSource.indexOf('// --- INITIALIZATION ---'));
const policySource=await readFile(new URL(path+'private-account-offline-policy.js',import.meta.url),'utf8');
const {canRecoverPrivateAccount}=await import('data:text/javascript;base64,'+Buffer.from(policySource).toString('base64'));

test('recupero rifiuta account diventato condiviso, bancario, archiviato o collegato',()=>{
 const base={type:'account',visibility:'private'};assert.equal(canRecoverPrivateAccount(base,'owner'),true);
 for(const extra of [{ownerId:'other'},{ownerId:null},{visibility:'shared'},{isArchived:true},{banking:[{}]},{cards:[{}]},{sharedWith:{guest:true}},{sharedWithUids:['guest']},{sharedWithEmails:['g@example.invalid']},{acceptedCount:1},{linkedProfileField:{id:'x'}},{linkedCompanyProfileFields:[{}]},{type:'company'}]){
  assert.equal(canRecoverPrivateAccount({...base,...extra},'owner'),false,JSON.stringify(extra));
 }
});

test('decifratura fallita o cambio sessione lasciano modulo e copia recupero intatti',async()=>{
 for(const mode of ['decrypt','session','success']){
  const writes=[];const operation={operationId:'old',uid:'owner',record:{username:'cipher',password:'cipher'}};
  const sandbox={structuredClone,currentRevision:7,recoveryOperation:null,decodeProfileContactValue:async value=>{if(mode==='decrypt')throw Error('DECRYPT_FAILED');return value?'plain':''},document:{getElementById:()=>({set value(v){writes.push(v)}})}};
  vm.createContext(sandbox);vm.runInContext(restoreSource,sandbox);
  const action=sandbox.restoreM6ConflictDraft(operation,'key',9,()=>mode!=='session');
  if(mode==='success'){await action;assert.ok(writes.length);assert.equal(sandbox.currentRevision,9);assert.equal(sandbox.recoveryOperation.operationId,'old');}
  else {await assert.rejects(action);assert.deepEqual(writes,[]);assert.equal(sandbox.currentRevision,7);assert.equal(sandbox.recoveryOperation,null);}
  assert.equal(operation.record.username,'cipher');
 }
});

async function saveFixture(status,{recover=true,active=true}={}){
 let replaced=0,enqueued=0,handoffs=0;const messages=[],navigations=[];
 const button={disabled:false,dataset:{},setAttribute(){}};
 const nodes={'btn-save-footer':button,'account-name':{value:'Fixture'}};
 const pilotFixture={replacePrivateAccountPilotOperation:async()=>{replaced++;return status},enqueuePrivateAccountPilot:async()=>{enqueued++;return status},storePrivateAccountHandoff:()=>handoffs++};
 const sandbox={pilotFixture,document:{getElementById:id=>nodes[id],querySelector:()=>null},auth:{currentUser:{uid:'owner'}},db:{},
  showToast:message=>messages.push(message),hasInvalidCardExpiry:()=>false,ensureVaultKeyMaterial:async()=> 'key',encrypt:async v=>v?'cipher':'',
  accountModeFromFlags:()=> 'account-private',validateAccountMode:()=>({}),recordFieldsFromAccountMode:()=>({type:'account',visibility:'private'}),
  classifyPrivateAccountOfflineWrite:()=>({eligible:true}),navigator:{onLine:true},doc:()=>({id:'record'}),t:x=>x,console:{error(){}},
  setTimeout:fn=>fn(),window:{location:{replace:url=>navigations.push(url)}}};
 let source=await readFile(new URL(path+'form-privato-save.js',import.meta.url),'utf8');
 source=source.replace(/^import[\s\S]*?;\r?\n/gm,'').replace('export async function','async function').replace("await import('../data/private-account-offline-pilot.js')",'pilotFixture');
 vm.createContext(sandbox);vm.runInContext(source,sandbox);
 await sandbox.savePrivateAccount({bankAccounts:[],invitedEmails:[],currentUid:'owner',currentDocId:'record',isEditing:true,baseRevision:1,
  recoveryOperation:recover?{uid:'owner',operationId:'old',recordId:'record'}:null,isActive:()=>active});
 return {replaced,enqueued,handoffs,messages,navigations,button};
}

test('salvataggio non confermato non mostra successo né naviga, anche su lease occupato',async()=>{
 for(const result of [{status:'reconciliation-required'},{status:'conflict'},{status:'recoverable-error'},{acquired:false},{status:'offline'}]){
  const f=await saveFixture(result);assert.equal(f.replaced,1);assert.equal(f.enqueued,0);assert.equal(f.handoffs,0);assert.deepEqual(f.navigations,[]);
  assert.equal(f.messages.includes('success_save'),false);assert.equal(f.button.disabled,true);
 }
});

test('recupero salvato usa sostituzione; nuova modifica usa enqueue; sessione scaduta nessuno',async()=>{
 const recovered=await saveFixture({status:'saved'});assert.equal(recovered.replaced,1);assert.equal(recovered.handoffs,1);assert.equal(recovered.navigations.length,1);
 const ordinary=await saveFixture({status:'saved'},{recover:false});assert.equal(ordinary.enqueued,1);assert.equal(ordinary.replaced,0);
 const expired=await saveFixture({status:'saved'},{active:false});assert.equal(expired.enqueued+expired.replaced,0);
});


test('scelta locale o più tardi non elimina la coda; solo scelta server la scarta',async()=>{
 const start=formSource.indexOf('            const reconciliation =');
 const end=formSource.indexOf("            } else if (lastState?.state === 'recoverable-error'",start);
 const flow='async function resume(){'+formSource.slice(start,end)+'}}';
 for(const choice of ['local','server',null,'expired']){
  let active=true,discarded=0,restored=0;const button={disabled:false};
  const operation={uid:'owner',operationId:'old',recordId:'record',record:{type:'account'}};
  const sandbox={outcome:{status:'reconciliation-required',operation},lastState:null,currentDocId:'record',user:{uid:'owner'},vaultKeyMaterial:'key',
   active:()=>active,document:{getElementById:()=>button},showToast(){},showM6ConflictChoice:async()=>{if(choice==='expired')active=false;return choice==='expired'?'server':choice},
   pilot:{discardPrivateAccountPilotOperation:async()=>discarded++},getPrivateAccountConfirmed:async()=>({type:'account',visibility:'private',revision:2}),
   canRecoverPrivateAccount,restoreM6ConflictDraft:async()=>restored++,setTimeout(){}};
  vm.createContext(sandbox);vm.runInContext(flow,sandbox);await sandbox.resume();
  assert.equal(discarded,choice==='server'?1:0);assert.equal(restored,choice==='local'?1:0);assert.equal(button.disabled,choice!=='local');
 }
});
