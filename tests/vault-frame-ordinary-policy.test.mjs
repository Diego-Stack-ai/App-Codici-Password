import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {POLICY_NAME,POLICY_URL,RULE_RELEASE_URL,ordinaryPolicyFields,storedPolicy,assertPolicyCi,
  verifyPublishedRules,manageOrdinaryPolicy} from '../scripts/manage-vault-frame-policy.mjs';
const {load}=createRequire(import.meta.url)('js-yaml');
const sha='a'.repeat(40);
const legacy={schemaVersion:{integerValue:'1'},version:{integerValue:'1'},uid:{stringValue:'private-synthetic-binding'},
  enabled:{booleanValue:false},expiresAt:{timestampValue:'2026-11-18T22:59:00Z'}};
function fixture(fields=legacy) {
  const state={clock:0,proofs:0,writes:[],calls:[],fences:0};
  const stamp=()=>new Date(Date.UTC(2026,10,14,23,0,++state.clock)).toISOString();
  state.document=fields ? {name:POLICY_NAME,fields:structuredClone(fields),updateTime:stamp()} : null;
  state.request=async(method,url,body)=>{
    state.calls.push({method,url});
    assert.ok(url.startsWith(POLICY_URL),'only the fixed singleton is accessed');
    if(method==='GET')return state.document ? {status:200,data:structuredClone(state.document)} : {status:404,data:null};
    assert.equal(method,'PATCH');
    const query=new URL(url).searchParams;
    assert.deepEqual(query.getAll('updateMask.fieldPaths'),['schemaVersion','version','enabled','uid','expiresAt']);
    if(state.document)assert.equal(query.get('currentDocument.updateTime'),state.document.updateTime);
    else assert.equal(query.get('currentDocument.exists'),'false');
    state.writes.push(structuredClone(body));
    state.document={...structuredClone(body),updateTime:stamp()};
    return {status:200,data:structuredClone(state.document)};
  };
  state.run=mode=>manageOrdinaryPolicy({mode,request:state.request,
    verifyRelease:async()=>{state.proofs++;},beforeWrite:()=>{state.fences++;}});
  return state;
}
test('migration replaces an OFF pilot with exactly the three global fields and CAS',async()=>{
  const f=fixture();const receipt=await f.run('enable');
  assert.deepEqual(receipt,{mode:'enable',enabled:true,writes:1});
  assert.equal(f.proofs,3);assert.equal(f.fences,1);
  assert.deepEqual(f.writes[0],{name:POLICY_NAME,fields:ordinaryPolicyFields(true)});
  assert.equal('uid' in f.document.fields,false);assert.equal('expiresAt' in f.document.fields,false);
  assert.deepEqual(f.calls.map(v=>v.method),['GET','PATCH','GET','GET']);
});
test('missing policy is first created OFF, reread, then activated with a new precondition',async()=>{
  const f=fixture(null);assert.equal((await f.run('enable')).writes,2);
  assert.deepEqual(f.writes.map(v=>v.fields.enabled.booleanValue),[false,true]);
  assert.equal(f.fences,2);
});
test('a live legacy pilot is never migrated to ON',async()=>{
  const f=fixture({...legacy,enabled:{booleanValue:true}});
  await assert.rejects(f.run('enable'),/C2_POLICY_FAILED_OFF_REQUIRED/);
  assert.equal(f.writes.length,0);
});
test('disable works without Hosting proofs, including the legacy pilot and idempotent OFF',async()=>{
  const f=fixture({...legacy,enabled:{booleanValue:true}});
  assert.equal((await f.run('disable')).enabled,false);
  assert.equal(f.proofs,0);assert.deepEqual(f.document.fields,{...legacy,enabled:{booleanValue:false}});
  assert.equal((await f.run('disable')).writes,0);
  const absent=fixture(null);assert.deepEqual(await absent.run('disable'),{mode:'disable',enabled:false,writes:0,missing:true});
});
test('already enabled ordinary policy is idempotent but still requires release proofs',async()=>{
  const f=fixture(ordinaryPolicyFields(true));assert.equal((await f.run('enable')).writes,0);assert.equal(f.proofs,2);
});
test('a failed deployment proof makes zero API calls',async()=>{
  const f=fixture();
  await assert.rejects(manageOrdinaryPolicy({mode:'enable',request:f.request,verifyRelease:async()=>{throw Error('proof');}}));
  assert.equal(f.calls.length,0);
});
test('unknown payloads and metadata never cause a write',async()=>{
  for(const mutate of [
    d=>{d.fields.extra={stringValue:'unknown'};},d=>{d.name=POLICY_NAME+'/other';},
    d=>{delete d.updateTime;},d=>{d.fields.version={integerValue:'3'};},d=>{d.fields.enabled={booleanValue:'true'};}
  ]){const f=fixture(ordinaryPolicyFields(false));mutate(f.document);await assert.rejects(f.run('enable'));assert.equal(f.writes.length,0);}
});
test('permission or precondition failures are not retried',async()=>{
  for(const status of [401,403,409,412]){
    const f=fixture(),request=f.request;let patches=0;
    f.request=async(method,url,body)=>method==='PATCH'?(patches++,{status,data:{}}):request(method,url,body);
    await assert.rejects(manageOrdinaryPolicy({mode:'enable',request:f.request,verifyRelease:async()=>{}}));
    assert.equal(patches,1);
  }
});
test('an interleaved operator update is not overwritten by rollback',async()=>{
  const f=fixture(),request=f.request;let changed=false;
  const transport=async(method,url,body)=>{
    if(method==='GET'&&f.writes.length&&!changed){changed=true;f.document.updateTime='2026-11-14T23:59:00Z';}
    return request(method,url,body);
  };
  await assert.rejects(manageOrdinaryPolicy({mode:'enable',request:transport,verifyRelease:async()=>{}}));
  assert.equal(f.writes.length,1,'no stale rollback or retry');
});
test('a post-activation deployment mismatch rolls back only its own write and verifies OFF',async()=>{
  const f=fixture();
  await assert.rejects(manageOrdinaryPolicy({mode:'enable',request:f.request,
    verifyRelease:async stage=>{if(stage==='after-enable')throw Error('source changed');}}),/C2_POLICY_FAILED_OFF_VERIFIED/);
  assert.deepEqual(f.writes.map(write=>write.fields.enabled.booleanValue),[true,false]);
  assert.equal(storedPolicy(f.document).enabled,false);
});
test('OFF during the final deployment proof cannot produce an ON receipt',async()=>{
  for (const initial of [legacy,ordinaryPolicyFields(true)]) {
    const f=fixture(initial);
    await assert.rejects(manageOrdinaryPolicy({mode:'enable',request:f.request,
      verifyRelease:async stage=>{
        if(stage==='after-enable')f.document={name:POLICY_NAME,fields:ordinaryPolicyFields(false),updateTime:'2026-11-14T23:59:00Z'};
      }}));
    assert.equal(storedPolicy(f.document).enabled,false);
  }
});
test('rollback uses an OFF fence even when current master advances after activation',async()=>{
  const f=fixture(),fences=[];let advanced=false;
  await assert.rejects(manageOrdinaryPolicy({mode:'enable',request:f.request,
    verifyRelease:async stage=>{if(stage==='after-enable'){advanced=true;throw Error('source changed');}},
    beforeWrite:mode=>{fences.push(mode);if(advanced&&mode!=='disable')throw Error('master advanced');}
  }),/C2_POLICY_FAILED_OFF_VERIFIED/);
  assert.deepEqual(fences,['enable','disable']);
  assert.equal(storedPolicy(f.document).enabled,false);
});
test('only the exact published Rules source authorizes activation proofs',async()=>{
  const source='rules_version = "2";\n';
  const request=async(method,url)=>({status:200,data:url===RULE_RELEASE_URL
    ? {rulesetName:'projects/appcodici-password/rulesets/synthetic'}
    : {source:{files:[{name:'firestore.rules',content:source}]}}});
  await verifyPublishedRules(request,source);
  await assert.rejects(verifyPublishedRules(request,source+'// changed'));
  await assert.rejects(verifyPublishedRules(async()=>({status:200,data:{rulesetName:'projects/other/rulesets/synthetic'}}),source));
});
test('CI guard binds event, repository, workflow, clean HEAD and current master',()=>{
  const env={GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'Diego-Stack-ai/App-Codici-Password',
    GITHUB_REF:'refs/heads/master',GITHUB_WORKFLOW_REF:'Diego-Stack-ai/App-Codici-Password/.github/workflows/vault-frame-ordinary-policy.yml@refs/heads/master',GITHUB_SHA:sha};
  const git=(...args)=>args[0]==='status'?'':args[0]==='ls-remote'?sha+'\trefs/heads/master':sha;
  assertPolicyCi(env,sha,git);
  for(const key of Object.keys(env))assert.throws(()=>assertPolicyCi({...env,[key]:'unexpected'},sha,git));
  assert.throws(()=>assertPolicyCi(env,sha,(...args)=>args[0]==='status'?'dirty':git(...args)));
  assert.throws(()=>assertPolicyCi(env,sha,(...args)=>args[0]==='ls-remote'?'b'.repeat(40):git(...args)));
  assertPolicyCi(env,sha,(...args)=>args[0]==='ls-remote'?'b'.repeat(40):git(...args),'disable');
});
test('policy workflow has a protected independent gate and no deploy or identity inputs',()=>{
  const workflow=load(readFileSync(new URL('../.github/workflows/vault-frame-ordinary-policy.yml',import.meta.url),'utf8'));
  assert.deepEqual(Object.keys(workflow.on),['workflow_dispatch']);
  assert.deepEqual(Object.keys(workflow.on.workflow_dispatch.inputs),['mode','expected_commit']);
  assert.deepEqual(workflow.on.workflow_dispatch.inputs.mode.options,['disable','enable']);
  assert.equal(workflow.on.workflow_dispatch.inputs.mode.default,'disable');
  assert.equal(workflow.jobs.policy.environment,'production');
  assert.equal(workflow.jobs.policy.needs,'validate');
  assert.deepEqual(workflow.jobs.policy.concurrency,{group:'firebase-production','cancel-in-progress':false});
  const source=JSON.stringify(workflow);
  assert.doesNotMatch(source,/firebase\.js deploy|--force|uid|service.account|id-token/);
});
test('the executable refuses local invocation before accessing credentials',()=>{
  const script=fileURLToPath(new URL('../scripts/manage-vault-frame-policy.mjs',import.meta.url));
  const result=spawnSync(process.execPath,[script,'--mode','enable','--commit',sha],{env:{},encoding:'utf8',timeout:10000});
  assert.notEqual(result.status,0);assert.equal(result.stdout,'');
  assert.equal(result.stderr.trim(),'C2_POLICY_FAILED_OFF_REQUIRED');
});
