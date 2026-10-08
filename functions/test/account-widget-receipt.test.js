const test = require('node:test');
const assert = require('node:assert/strict');
const {createAccountWidgetBinding: bind, verifyAccountWidgetReceipt: verify} = require('../account-widget-receipt');
const base = () => ({action:'update', operationId:'op', widgetId:'widget', context:'private', accountId:'account',
  expectedRevision:1, data:{title:'Synthetic', fields:[{id:'one',valueEnc:'synthetic-a'},{id:'two',valueEnc:'synthetic-b'}]}});
test('widget digest binds complete payload, identity, owner and bank omission versus null', () => {
  const command=base(), original=bind(command,'owner');
  for (const patch of [{operationId:'other'},{widgetId:'other'},{accountId:'other'},{expectedRevision:2},
    {context:'company',companyId:'company'}, {data:{...command.data,title:'Changed'}},
    {data:{...command.data,fields:[...command.data.fields].reverse()}},
    {data:{...command.data,bankId:null}}, {data:{...command.data,bankId:'bank'}}, {extra:'bound'}]) {
    assert.notEqual(bind({...command,...patch},'owner').commandDigest, original.commandDigest);
  }
  assert.notEqual(bind(command,'other').commandDigest,original.commandDigest);
  assert.equal(bind({...command,data:{fields:command.data.fields,title:'Synthetic'}},'owner').commandDigest,original.commandDigest);
  assert.equal(Object.hasOwn(original,'data'),false);
});
test('widget receipt verifies every binding field and returns only attested result', () => {
  const binding=bind(base(),'owner'), receipt={...binding,status:'applied',duplicate:false,revision:2,extra:'never-return'};
  assert.deepEqual(verify(receipt,binding),{status:'applied',duplicate:true,revision:2});
  for (const key of Object.keys(binding)) {
    assert.throws(()=>verify({...receipt,[key]:'tampered'},binding),/ACCOUNT_WIDGET_RESULT_UNVERIFIED/);
  }
  for (const patch of [{status:'processing'},{duplicate:true},{revision:3}]) {
    assert.throws(()=>verify({...receipt,...patch},binding),/ACCOUNT_WIDGET_RESULT_UNVERIFIED/);
  }
});
test('widget binding rejects unsafe revisions and accessors without invoking them', () => {
  for (const expectedRevision of [null,0,-1,1.5,Number.MAX_SAFE_INTEGER,Infinity]) {
    assert.throws(()=>bind({...base(),expectedRevision},'owner'),/ACCOUNT_WIDGET_RESULT_UNVERIFIED/);
  }
  let invoked=false;
  const command=base(); Object.defineProperty(command.data,'title',{enumerable:true,get(){invoked=true;return 'bad';}});
  assert.throws(()=>bind(command,'owner'),/ACCOUNT_WIDGET_RESULT_UNVERIFIED/); assert.equal(invoked,false);
  assert.throws(()=>bind({...base(),data:{bankId:undefined}},'owner'),/ACCOUNT_WIDGET_RESULT_UNVERIFIED/);
});
