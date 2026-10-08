import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {bankingLifecycleBasis,validateBankingLifecycleRequest} from './banking-lifecycle-contract.mjs';
import {createBankingLifecycleHandler} from './banking-lifecycle-handler.mjs';
const hash = value=>createHash('sha256').update(value).digest('hex');
function fixture(company=false) {
  const uid='synthetic', account=company ? {domain:'company',companyId:'firm',id:'a'} : {domain:'private',id:'a'};
  const parent=company ? `users/${uid}/aziende/firm` : `users/${uid}`, path=`${parent}/accounts/a`;
  const original={ownerId:uid,id:'a',revision:2,banking:[{bankId:'bank',unknown:'KEEP',cards:[{type:'Credit',pin:''},{type:'Debit',pin:''}]}],note:'KEEP'};
  const records=new Map([[path,structuredClone(original)],[parent,{ownerId:uid}]]), widgets=[];
  let fenced=false,writes=0;
  const db={doc:path=>path,collection:path=>{
    const query={path,filters:[],where(...args){this.filters.push(args);return this;},limit(){return this;}}; return query;
  },async runTransaction(run){
    const pending=[];
    const result=await run({get:async ref=>typeof ref==='string' ? {exists:records.has(ref),data:()=>structuredClone(records.get(ref))}
      : {empty:!widgets.some(row=>ref.filters.every(([key,,value])=>row[key]===value))},
      update:(ref,data)=>pending.push(()=>records.set(ref,{...records.get(ref),...data})),
      create:(ref,data)=>pending.push(()=>{assert.equal(records.has(ref),false);records.set(ref,data);})});
    pending.forEach(write=>{write();writes++;}); return result;
  }};
  const handler=createBankingLifecycleHandler({db,hash,timestamp:()=>1000,beforeAccountWrite:async()=>{
    if(fenced)throw Error('PURGE_FENCED'); return ()=>{};
  }});
  const command=(action,options={})=>{
    const basis=bankingLifecycleBasis(records.get(path),uid,account);
    return {expectedOwnerUid:uid,operationId:action,account,action,bankId:'bank',cardIndex:action.endsWith('bank')?null:0,
      values:action.startsWith('create')?{}:null,expectedRevision:basis.revision,expectedFingerprint:hash(basis.fingerprintInput),...options};
  };
  return {handler,command,records,path,widgets,original,trusted:{auth:{uid},app:{appId:'demo'}},
    block:()=>{fenced=true;},writes:()=>writes};
}
for(const company of [false,true]) test(`bank/card lifecycle preserves unrelated fields and receipts: company=${company}`,async()=>{
  const f=fixture(company);
  for(const [action,options] of [['create-bank',{bankId:'new',values:{iban:'SYNTHETIC'}}],
    ['create-card',{cardIndex:2,values:{cardType:'Synthetic',pin:''}}],['delete-card',{cardIndex:1}],['delete-bank',{bankId:'new'}]]) {
    const request=f.command(action,options);
    await f.handler(request,f.trusted); const count=f.writes();
    await f.handler(request,f.trusted); assert.equal(f.writes(),count);
    await assert.rejects(f.handler({...request,expectedFingerprint:'f'.repeat(64)},f.trusted),/OPERATION_CONFLICT/);
  }
  const saved=f.records.get(f.path);
  assert.equal(saved.note,'KEEP');assert.equal(saved.banking[0].unknown,'KEEP');
  assert.equal(saved.banking.length,1);assert.equal(saved.banking[0].cards.length,2);
  assert.equal(saved.banking[0].cards[1].cardType,'Synthetic');
});
test('bank deletion checks widgets in the exact account, including archived references',async()=>{
  const f=fixture(true), request=f.command('delete-bank');
  f.widgets.push({context:'company',companyId:'firm',accountId:'a',bankId:'bank',isArchived:true});
  await assert.rejects(f.handler(request,f.trusted),/WIDGETS_PRESENT/);assert.equal(f.writes(),0);
  f.widgets[0].companyId='different';
  await f.handler(request,f.trusted);assert.deepEqual(f.records.get(f.path).banking,[]);
  await f.handler(f.command('create-bank',{bankId:'fresh'}),f.trusted);
  assert.equal(f.records.get(f.path).banking[0].bankId,'fresh');
});
test('fence, stale snapshot, noncanonical data and invalid ciphertext cannot mutate',async()=>{
  const f=fixture(), request=f.command('create-card',{cardIndex:2});
  for(const changes of [{values:{pin:'clear'}},{values:{cards:[]}},{cardIndex:-1},{action:'unknown'},{extra:true}])
    assert.throws(()=>validateBankingLifecycleRequest({...request,...changes}));
  await assert.rejects(f.handler({...request,expectedOwnerUid:'other'},f.trusted),/OWNER/);
  await assert.rejects(f.handler(request,{auth:{uid:'synthetic'}}),/UNAUTHENTICATED/);
  const record=f.records.get(f.path);record.banking[0].cards.reverse();
  await assert.rejects(f.handler(request,f.trusted),/CONFLICT/);
  f.block(); await assert.rejects(f.handler(f.command('delete-bank'),f.trusted),/PURGE_FENCED/);
  assert.equal(f.writes(),0);
  assert.throws(()=>bankingLifecycleBasis({...f.original,banking:undefined},'synthetic',request.account),/NONCANONICAL/);
});
