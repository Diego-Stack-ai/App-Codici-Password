import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createBankingLifecycleSource} from './banking-lifecycle-source.mjs';
const cipher=Buffer.alloc(48,42).toString('base64');
function fixture() {
  const abort=new AbortController(),record={ownerId:'u',id:'a',revision:1,banking:[{bankId:'b',cards:[]}]},sent=[];
  let fail=false;
  const options={context:{user:{uid:'u'},signal:abort.signal,assertUnlocked(){},encrypt:async()=>cipher},
    getUser:()=>({uid:'u'}),account:{domain:'private',id:'a'},readRecord:async()=>structuredClone(record),assertCurrent:async()=>{},
    hash:value=>createHash('sha256').update(value).digest('hex'),isEncryptedValue:value=>value===cipher,isOnline:()=>true,
    submit:async data=>{sent.push(data);if(fail){fail=false;throw Error('lost');}return{status:'confirmed',revision:2};}};
  return {abort,record,sent,options,lose:()=>{fail=true;}};
}
test('creation snapshots drafts, encrypts secrets and retries the identical opaque command',async()=>{
  const f=fixture(),source=createBankingLifecycleSource(f.options),values={cardNumber:'synthetic',pin:'1234'};
  const pending=source.prepare('create-card',{bankId:'b',cardIndex:0,values});values.pin='changed';
  const plan=await pending;assert.deepEqual(Object.keys(plan),[]);f.lose();
  await assert.rejects(source.send(plan),/lost/);await source.send(plan);
  assert.deepEqual(f.sent[0],f.sent[1]);assert.equal(f.sent[0].values.pin,cipher);
  assert.equal(JSON.stringify(f.sent).includes('1234'),false);
  f.abort.abort();await assert.rejects(source.send(plan),/VIEW_DISPOSED/);
});
test('lock and changed basis during encryption prohibit preparing any command',async()=>{
  for(const scenario of ['lock','change','clear']) {
    const f=fixture();f.options.context.encrypt=async()=>{
      if(scenario==='lock')f.abort.abort();
      if(scenario==='change')f.record.revision++;
      return scenario==='clear'?'plaintext':cipher;
    };
    const source=createBankingLifecycleSource(f.options);
    await assert.rejects(source.prepare('create-card',{bankId:'b',cardIndex:0,values:{pin:'1234'}}),
      scenario==='lock'?/VIEW_DISPOSED/:scenario==='change'?/CONFLICT/:/ENCRYPTION_FAILED/);
    assert.equal(f.sent.length,0);source.dispose();
  }
});
test('bank identity is generated once and deletion sends no field contents',async()=>{
  const f=fixture(),source=createBankingLifecycleSource(f.options);
  const plan=await source.prepare('create-bank',{values:{iban:'SYNTHETIC'}});
  await source.send(plan);await source.send(plan);
  assert.equal(f.sent[0].bankId,f.sent[1].bankId);assert.notEqual(f.sent[0].bankId,'b');
  await source.send(await source.prepare('delete-bank',{bankId:'b'}));
  assert.equal(f.sent[2].values,null);source.dispose();
});

test('stale displayed card selection and missing selection capability cannot prepare deletion',async()=>{
  const f=fixture();
  for(const assertCurrent of [undefined,async()=>{throw Error('BANKING_CHANGED');}]) {
    const source=createBankingLifecycleSource({...f.options,assertCurrent});
    await assert.rejects(source.prepare('delete-bank',{bankId:'b'}),/SELECTION_REQUIRED|BANKING_CHANGED/);
    assert.equal(f.sent.length,0);source.dispose();
  }
});
