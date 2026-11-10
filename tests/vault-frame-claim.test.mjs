import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {CLAIM_PROJECT,FRAME_CLAIM,ClaimPreparationError,parseClaimArguments,runVaultFrameClaim,safeClaimError} from '../scripts/lib/vault-frame-claim.mjs';
import {privateFilePath,savePrivateClaimReceipt} from '../scripts/lib/vault-frame-private-receipt.mjs';
import {claimMain} from '../scripts/prepare-vault-frame-claim.mjs';
import {singleAttemptClaimWriter} from '../scripts/lib/vault-frame-claim-write.mjs';

// Synthetic adapters only. Importing the CLI never imports Admin or calls cloud.
const uid='synthetic-fixture-target';
const target={schemaVersion:1,projectId:CLAIM_PROJECT,uid,expectedEmail:'fixture@appcodici-password.invalid',phase:'test',approvedForCanary:true};
const baseOptions={uid,phase:'test',privateConfig:'private-fixture.json',mode:'dry-run'};
function fixture({claims={admin:false,nested:{array:[1,'preserved',false]}},complete=true}={}) {
  const state={claims:structuredClone(claims),reads:0,policyReads:0,writes:[],receipts:[],revision:'1:1',expiry:9999999999999,
    user:{uid,email:target.expectedEmail,emailVerified:true,disabled:false}};
  const auth={getUser:async input=>{assert.equal(input,uid);state.reads++;await state.beforeRead?.();return {...state.user,customClaims:structuredClone(state.claims)};},
    setCustomUserClaims:async (input,value)=>{assert.equal(input,uid);state.writes.push(structuredClone(value));state.claims=structuredClone(value);await state.afterWrite?.();}};
  const readPolicy=async()=>{state.policyReads++;return {exists:true,revision:state.revision,data:{
    schemaVersion:1,version:1,uid,enabled:false,...(complete?{expiresAt:{toMillis:()=>state.expiry}}:{})}};};
  const saveBefore=async receipt=>{state.receipts.push(structuredClone(receipt));await state.afterReceipt?.();};
  return {state,auth,readPolicy,saveBefore,target,options:{...baseOptions},now:()=>100};
}
const apply=f=>({...f,options:{...f.options,mode:'apply',exclusiveWriter:true}});
const rejectsCode=(operation,code)=>assert.rejects(operation,error=>safeClaimError(error)===code);

test('arguments default to read-only and require explicit UID and phase without fallback',()=>{
  const args=['--uid',uid,'--phase','test','--private-config','private.json'];
  assert.equal(parseClaimArguments(args).mode,'dry-run');
  for(const bad of [[],args.slice(2),[...args,'--uid',uid],[...args,'--dry-run','--apply'],[...args,'--unknown'],[...args,'--uid'],
    ['--uid','bad\nUID','--phase','test','--private-config','private.json']]) assert.throws(()=>parseClaimArguments(bad),ClaimPreparationError);
  assert.throws(()=>parseClaimArguments([...args,'--apply']),/EXCLUSIVE_WRITER_REQUIRED/);
  assert.throws(()=>parseClaimArguments([...args,'--apply','--confirm-exclusive-writer']),/RECEIPT_REQUIRED/);
  assert.equal(parseClaimArguments([...args,'--apply','--confirm-exclusive-writer','--receipt-file','private.dpapi']).mode,'apply');
});
test('dry-run explicitly shows only the selected UID and intended claim change, never writes or saves receipt',async()=>{
  const f=fixture();const report=await runVaultFrameClaim(f);
  assert.equal(report.targetUid,uid);assert.deepEqual(report.intendedChange,{claim:FRAME_CLAIM,value:true});
  assert.equal(report.wouldWrite,true);assert.equal(report.wrote,false);assert.equal(report.verified,false);
  assert.equal(f.state.writes.length,0);assert.equal(f.state.receipts.length,0);
  assert.doesNotMatch(JSON.stringify(report),/fixture@|preserved|nested|admin|token/i);
});
test('incomplete OFF singleton is reported by dry-run and prevents apply without inventing expiry',async()=>{
  const f=fixture({complete:false});const report=await runVaultFrameClaim(f);
  assert.equal(report.policyComplete,false);assert.equal(report.applyReady,false);assert.equal(report.wouldWrite,false);
  await rejectsCode(()=>runVaultFrameClaim(apply(f)),'POLICY_INCOMPLETE');
  assert.equal(f.state.writes.length,0);assert.equal(f.state.receipts.length,0);
});
test('one write preserves every other nested claim, protects the before state and verifies reread',async()=>{
  const f=fixture({claims:{role:'synthetic',nested:{items:[true,2,{v:'unchanged'}]},[FRAME_CLAIM]:false}});
  const before=structuredClone(f.state.claims);const report=await runVaultFrameClaim(apply(f));
  assert.deepEqual(f.state.writes,[{...before,[FRAME_CLAIM]:true}]);
  assert.deepEqual(f.state.receipts[0].previousClaims,before);assert.equal(f.state.reads,3);
  assert.equal(report.wrote,true);assert.equal(report.verified,true);assert.equal(Object.hasOwn(report,'targetUid'),false);
});
test('already true is idempotent, rereads and never overwrites or creates another receipt',async()=>{
  const f=fixture({claims:{[FRAME_CLAIM]:true,other:42}});const report=await runVaultFrameClaim(apply(f));
  assert.equal(report.alreadySet,true);assert.equal(report.verified,true);assert.equal(f.state.reads,3);
  assert.equal(f.state.writes.length,0);assert.equal(f.state.receipts.length,0);
});
test('both phases require a privately approved matching identity, never a default QA account',async()=>{
  for(const mutation of [
    f=>f.target={...target,uid:'different'},f=>f.target={...target,approvedForCanary:false},
    f=>f.target={...target,projectId:'other'},f=>f.target={...target,phase:'personal'},
    f=>f.target={...target,expectedEmail:'real@example.test'},f=>f.target={...target,extra:true}
  ]){const f=fixture();mutation(f);await rejectsCode(()=>runVaultFrameClaim(f),'TARGET_NOT_APPROVED');assert.equal(f.state.reads,0);}
  const f=fixture();f.options.phase='personal';f.target={...target,phase:'personal'};
  assert.equal((await runVaultFrameClaim(f)).phase,'personal');
});
test('disabled, unverified and identity mismatch are rejected before any write',async()=>{
  for(const patch of [{uid:'other'},{disabled:true},{emailVerified:false},{email:'foreign@example.test'}]){
    const f=fixture();Object.assign(f.state.user,patch);
    await rejectsCode(()=>runVaultFrameClaim(apply(f)),'IDENTITY_MISMATCH');assert.equal(f.state.writes.length,0);
  }
});
test('policy UID, shape, schema, disabled status and expiry are enforced',async()=>{
  for(const patch of [{uid:'foreign'},{enabled:true},{schemaVersion:2},{version:2},{extra:true},{expiresAt:'not-a-timestamp'}]){
    const f=fixture();const read=f.readPolicy;f.readPolicy=async()=>{const snap=await read();Object.assign(snap.data,patch);return snap;};
    await rejectsCode(()=>runVaultFrameClaim(apply(f)),'POLICY_INVALID');assert.equal(f.state.writes.length,0);
  }
  const f=fixture();f.state.expiry=1;await rejectsCode(()=>runVaultFrameClaim(apply(f)),'POLICY_INCOMPLETE');
});
test('claim JSON, unexpected existing flag and UTF-8 payload size are rejected without write',async()=>{
  for(const claims of [{bad:undefined},{bad:NaN},{[FRAME_CLAIM]:'true'},{long:'é'.repeat(510)}]){
    const f=fixture({claims});await assert.rejects(()=>runVaultFrameClaim(apply(f)),ClaimPreparationError);assert.equal(f.state.writes.length,0);
  }
});
test('receipt failure stops before second Auth read and before any claim write',async()=>{
  const f=fixture();f.saveBefore=async()=>{throw Error('SENSITIVE receipt path and content');};
  await rejectsCode(()=>runVaultFrameClaim(apply(f)),'RECEIPT_FAILED');assert.equal(f.state.writes.length,0);assert.equal(f.state.reads,1);
});
test('concurrent claims or policy changes during receipt preparation stop without write',async()=>{
  for(const change of [f=>f.state.claims.newRole='concurrent',f=>f.state.revision='1:2',f=>f.state.expiry=500,
    f=>f.state.user.disabled=true]){
    const f=fixture();f.state.afterReceipt=()=>change(f);
    await assert.rejects(()=>runVaultFrameClaim(apply(f)),ClaimPreparationError);assert.equal(f.state.writes.length,0);
  }
});
test('a write error has unknown outcome and is never retried or rolled back',async()=>{
  const f=fixture();f.state.afterWrite=()=>{throw Error('SENSITIVE token and email');};
  await rejectsCode(()=>runVaultFrameClaim(apply(f)),'WRITE_OUTCOME_UNKNOWN');assert.equal(f.state.writes.length,1);
});
test('post-write claim loss, extra claims or policy drift fail verification without rollback',async()=>{
  for(const change of [f=>delete f.state.claims.nested,f=>f.state.claims.extra=1,f=>f.state.revision='1:2',
    f=>f.state.user.disabled=true]){
    const f=fixture();f.state.afterWrite=()=>change(f);
    await rejectsCode(()=>runVaultFrameClaim(apply(f)),'POSTCHECK_FAILED');assert.equal(f.state.writes.length,1);
  }
});
test('UID or email drift immediately before or after the set is rejected',async()=>{
  for(const patch of [{uid:'foreign'},{email:'foreign@example.test'}]){
    const before=fixture();before.state.afterReceipt=()=>Object.assign(before.state.user,patch);
    await rejectsCode(()=>runVaultFrameClaim(apply(before)),'IDENTITY_MISMATCH');assert.equal(before.state.writes.length,0);
    const after=fixture();after.state.afterWrite=()=>Object.assign(after.state.user,patch);
    await rejectsCode(()=>runVaultFrameClaim(apply(after)),'POSTCHECK_FAILED');assert.equal(after.state.writes.length,1);
  }
});
test('prototype-like claim keys and nested JSON are preserved as own data properties',async()=>{
  const f=fixture({claims:JSON.parse('{"__proto__":{"fixture":true},"constructor":"own-data","nested":[{"a":1}]}')});
  const before=structuredClone(f.state.claims);await runVaultFrameClaim(apply(f));
  assert.deepEqual(f.state.writes[0],{...before,[FRAME_CLAIM]:true});
  assert.equal(Object.hasOwn(f.state.writes[0],'__proto__'),true);
  assert.equal({}.fixture,undefined);
});
test('real write adapter fixes endpoint and sends only UID/customAttributes in a single POST',async()=>{
  const calls=[];const writer=singleAttemptClaimWriter({credential:{getAccessToken:async()=>({access_token:'SYNTHETIC_TOKEN'})},
    fetchImpl:async(...args)=>{calls.push(args);return {status:200};}});
  const claims={nested:{value:1},[FRAME_CLAIM]:true};await writer(uid,claims);
  assert.equal(calls.length,1);
  const [url,request]=calls[0];
  assert.equal(url,'https://identitytoolkit.googleapis.com/v1/projects/appcodici-password/accounts:update');
  assert.equal(request.method,'POST');assert.equal(request.redirect,'error');assert.ok(request.signal);
  assert.deepEqual(JSON.parse(request.body),{localId:uid,customAttributes:JSON.stringify(claims)});
  assert.equal(request.headers.Authorization,'Bearer SYNTHETIC_TOKEN');
});
test('real write adapter never repeats 503, redirect, timeout or connection-reset outcomes',async()=>{
  for(const failure of [503,302,'ETIMEDOUT','ECONNRESET']){
    let sends=0;const writer=singleAttemptClaimWriter({credential:{getAccessToken:async()=>({access_token:'SYNTHETIC_TOKEN'})},
      fetchImpl:async()=>{sends++;if(typeof failure==='string')throw Error(failure);return {status:failure};}});
    await assert.rejects(()=>writer(uid,{[FRAME_CLAIM]:true}));assert.equal(sends,1);
  }
});
test('CLI guards and help never load an SDK; runtime uses only injected synthetic adapters',async()=>{
  let loads=0;const outputs=[];const deps={output:value=>outputs.push(value),readTarget:async()=>target,
    loadAdmin:async()=>{loads++;const f=fixture();return {...f,close:async()=>{}};}};
  await claimMain(['--help'],deps);assert.equal(loads,0);
  await assert.rejects(()=>claimMain(['--apply'],deps));assert.equal(loads,0);
  await claimMain(['--uid',uid,'--phase','test','--private-config','fixture.json'],deps);
  assert.equal(loads,1);assert.equal(outputs.at(-1).wrote,false);
});
test('unapproved config and invalid receipt path fail before any Admin SDK import',async()=>{
  let loads=0;const args=['--uid',uid,'--phase','test','--private-config','fixture.json'];
  const deps={readTarget:async()=>({...target,approvedForCanary:false}),loadAdmin:async()=>{loads++;throw Error('must not load');}};
  await rejectsCode(()=>claimMain(args,deps),'TARGET_NOT_APPROVED');assert.equal(loads,0);
  deps.readTarget=async()=>target;deps.checkReceiptPath=async()=>{throw Error('SENSITIVE PATH');};
  await rejectsCode(()=>claimMain([...args,'--apply','--confirm-exclusive-writer','--receipt-file','private.dpapi'],deps),'RECEIPT_FAILED');
  assert.equal(loads,0);
});
test('CLI apply report and fixed error codes omit target UID, email, token and other claims',async()=>{
  const outputs=[];const f=fixture();
  const args=['--uid',uid,'--phase','test','--private-config','fixture.json','--apply','--confirm-exclusive-writer','--receipt-file','private.dpapi'];
  await claimMain(args,{readTarget:async()=>target,checkReceiptPath:async()=>{},
    loadAdmin:async()=>({...f,close:async()=>{}}),saveReceipt:async()=>{},output:value=>outputs.push(value)});
  assert.doesNotMatch(JSON.stringify(outputs),new RegExp(uid+'|fixture@|SYNTHETIC_TOKEN|nested|preserved'));
  assert.equal(outputs[0].verified,true);
});
test('safe diagnostics never expose raw SDK messages or mutable error codes',async()=>{
  const f=fixture();f.auth.getUser=async()=>{throw Error('SENSITIVE TOKEN EMAIL UID');};
  let failure;try{await runVaultFrameClaim(f);}catch(error){failure=error;}
  assert.equal(safeClaimError(failure),'READ_FAILED');
  assert.equal(safeClaimError(Error('SENSITIVE')),'READ_FAILED');
  const changed=new ClaimPreparationError('READ_FAILED');changed.code='SENSITIVE';
  assert.equal(safeClaimError(changed),'READ_FAILED');
});
test('private files reject Git/OneDrive locations and existing receipt destinations',async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'frame-private-path-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const file=path.join(directory,'input.json');await writeFile(file,'{}');
  assert.equal(await privateFilePath(file),file);
  await assert.rejects(()=>privateFilePath(file,{mustExist:false}));
  await assert.rejects(()=>privateFilePath('relative.json'));
  for(const kind of ['OneDrive - fixture','repository']){
    const parent=path.join(directory,kind);await mkdir(parent);
    if(kind==='repository')await writeFile(path.join(parent,'.git'),'synthetic marker');
    const secret=path.join(parent,'input.json');await writeFile(secret,'{}');
    await assert.rejects(()=>privateFilePath(secret));
  }
});
test('Windows DPAPI protects synthetic before receipt locally and refuses overwriting it',{skip:process.platform!=='win32'},async t=>{
  const directory=await mkdtemp(path.join(os.tmpdir(),'frame-dpapi-'));t.after(()=>rm(directory,{recursive:true,force:true}));
  const filename=path.join(directory,'before.dpapi');
  const payload={fixture:'SYNTHETIC-ONLY-RECEIPT',previousClaims:{test:true}};
  await savePrivateClaimReceipt(filename,payload);
  const bytes=await readFile(filename);assert.ok(bytes.length>32);assert.equal(bytes.includes(Buffer.from(payload.fixture)),false);
  await assert.rejects(()=>savePrivateClaimReceipt(filename,payload));assert.deepEqual(await readFile(filename),bytes);
});
