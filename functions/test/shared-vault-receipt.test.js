const test = require('node:test');
const assert = require('node:assert/strict');
const {canonicalJson,createSharedVaultBinding:bind,verifySharedVaultReceipt:verify} = require('../shared-vault-receipt');
const command = {operationId:'op',action:'update',sharedDataId:'s',expectedRevision:1,
  data:{title:'synthetic',fields:[{id:'f',valueEnc:'synthetic-cipher',encrypted:true}]}};
test('binding includes entire normalized payload, identity and array order',()=>{
  const first = bind(command,'u');
  for (const mutate of [c=>c.data.title='other',c=>c.data.fields[0].valueEnc='other',c=>c.expectedRevision=2,
    c=>c.operationId='other',c=>c.extra=true]) {
    const copy=structuredClone(command); mutate(copy); assert.notEqual(bind(copy,'u').commandDigest,first.commandDigest);
  }
  assert.notEqual(bind(command,'other').commandDigest,first.commandDigest);
  assert.equal(canonicalJson({b:2,a:1}),canonicalJson({a:1,b:2}));
  assert.notEqual(canonicalJson([1,2]),canonicalJson([2,1]));
  const link={operationId:'op',action:'link',sharedDataId:'s',expectedRevision:1,linkId:'l',widgetId:'w',link:{context:'private',accountId:'a',order:0}};
  assert.notEqual(bind(link,'u').commandDigest,bind({...link,link:{...link.link,order:1}},'u').commandDigest);
});
test('canonical encoding refuses accessors without invoking them and unsupported values',()=>{
  let invoked=false;
  const getter=[]; Object.defineProperty(getter,'0',{enumerable:true,get(){invoked=true;return 1;}});
  const extra=[1]; extra.other=2;
  const symbol={}; symbol[Symbol('x')]=1;
  const hidden={}; Object.defineProperty(hidden,'x',{value:1});
  const cyclic={}; cyclic.self=cyclic;
  for(const value of [getter,extra,symbol,hidden,cyclic,[,1],undefined,Infinity,new Date(),Object.create(null)]) assert.throws(()=>canonicalJson(value));
  assert.equal(invoked,false);
});
test('receipt verifies exact result and refuses modified binding',()=>{
  const binding=bind(command,'u'), receipt={...binding,status:'applied',duplicate:false,revision:2};
  assert.deepEqual(verify(receipt,binding),{status:'applied',duplicate:true,revision:2});
  for(const patch of [{revision:3},{duplicate:true},{domain:'other'},{commandDigest:'bad'},{ownerUid:'other'}]) assert.throws(()=>verify({...receipt,...patch},binding));
  for(const expectedRevision of [null,undefined,0,-1,1.5,Number.MAX_SAFE_INTEGER]) assert.throws(()=>bind({...command,expectedRevision},'u'));
});
