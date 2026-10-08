import test from 'node:test';
import assert from 'node:assert/strict';
import {createPurgeReferenceInventoryLab} from './purge-reference-inventory-lab.mjs';

test('inventory reads bounded complete owner collections, rejects overflow and never writes', async () => {
  const old = process.env.FIRESTORE_EMULATOR_HOST;
  process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8085';
  try {
    const uid='synthetic', prefix=`users/${uid}/`, rows={}, reads=[];
    const db={projectId:'demo-vault-shell',doc:path=>({path}),collection:path=>({path,where(field,op,value){assert.deepEqual([field,op,value],['ownerId','==',uid]);return this;},limit(n){return {path,n};}}),
      runTransaction:fn=>fn({get:async query=>{
        reads.push(query);
        if(!query.n)return {exists:true,ref:{path:query.path},updateTime:{seconds:1,nanoseconds:123},data:()=>({revision:1})};
        return {docs:(rows[query.path]||[]).slice(0,query.n).map((data,i)=>({exists:true,updateTime:{seconds:1,nanoseconds:123},ref:{path:`${query.path}/${i}`},data:()=>data}))};
      }})};
    const run=createPurgeReferenceInventoryLab(db,{limit:2});
    const request={uid,command:{context:'private',accountId:'a',operationId:'p',expectedRevision:1,confirmation:'DELETE_FOREVER'},writeBudget:20};
    rows[`${prefix}accountWidgets`]=[{context:'private',accountId:'a',kind:'embedded',ciphertext:'SYNTHETIC_SECRET'}];
    const result=await run(request);
    assert.throws(()=>run.prepare(request),/PREVIEW_INVALID/);
    assert.equal(run.prepare,run.prepareVerified);
    assert.equal(result.valid,true);assert.equal(result.applicable,false);
    assert.deepEqual(result.deletePaths,[`${prefix}accountWidgets/0`]);
    assert.equal(result.expectedDocuments.length,2);
    assert.equal(result.expectedDocuments[0].updateTime.nanoseconds,123);
    assert.ok(!JSON.stringify(result).includes('SYNTHETIC_SECRET'));
    assert.equal(reads.filter(x=>x.n===3).length,6);
    rows[`${prefix}accountWidgets`].push({},{ });
    await assert.rejects(run(request),/TOO_LARGE/);
    await assert.rejects(run({...request,command:{...request.command,expectedRevision:2}}),/VERSION_CONFLICT/);
    assert.throws(()=>createPurgeReferenceInventoryLab({...db,projectId:'real'}),/LAB_ONLY/);
  } finally {if(old===undefined)delete process.env.FIRESTORE_EMULATOR_HOST;else process.env.FIRESTORE_EMULATOR_HOST=old;}
});
