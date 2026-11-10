import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import {validateImpersonatedAdc,createVaultFrameClaimAdmin,policyRestReader,IMPERSONATION_URL,POLICY_READ_URL} from '../scripts/lib/vault-frame-claim-admin.mjs';
import {CLAIM_PROJECT,FRAME_CLAIM,runVaultFrameClaim} from '../scripts/lib/vault-frame-claim.mjs';

const fakeAdc=()=>({type:'impersonated_service_account',service_account_impersonation_url:IMPERSONATION_URL,delegates:[],
  source_credentials:{type:'authorized_user',client_id:'fixture-client',client_secret:'fixture-secret',refresh_token:'fixture-refresh'}});
test('only the reviewed dedicated impersonated ADC shape and official endpoint are accepted',()=>{
  assert.deepEqual(validateImpersonatedAdc(fakeAdc()),{type:'impersonated_service_account',targetServiceAccountVerified:true});
  const mutations=[a=>a.type='authorized_user',a=>a.type='service_account',a=>a.service_account_impersonation_url='https://example.invalid/token',
    a=>a.service_account_impersonation_url=IMPERSONATION_URL.replace('vault-frame-canary-operator','foreign'),
    a=>a.delegates=['another-principal'],a=>a.quota_project_id=CLAIM_PROJECT,a=>a.universe_domain='example.invalid',
    a=>a.extra='unexpected',a=>a.source_credentials.token_uri='https://example.invalid/token',
    a=>a.source_credentials.type='external_account',a=>a.source_credentials.refresh_token='',a=>a.source_credentials.client_id+='\n',
    a=>a.source_credentials.quota_project_id=CLAIM_PROJECT];
  for(const mutation of mutations){const adc=fakeAdc();mutation(adc);assert.throws(()=>validateImpersonatedAdc(adc),/ADC_INVALID/);}
});
test('rejected ADC and emulator or quota override never load Admin or issue a request',async()=>{
  let loads=0,sends=0;const options={env:{GOOGLE_APPLICATION_CREDENTIALS:path.resolve('synthetic-adc.json')},
    adminRequire:()=>{loads++;throw Error('must not load');},fetchImpl:()=>{sends++;throw Error('must not send');}};
  await assert.rejects(()=>createVaultFrameClaimAdmin({...options,adcRead:async()=>'{"type":"authorized_user"}'}),/ADC_INVALID/);
  for(const key of ['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','GOOGLE_CLOUD_QUOTA_PROJECT'])
    await assert.rejects(()=>createVaultFrameClaimAdmin({...options,env:{...options.env,[key]:'blocked'},adcRead:async()=>JSON.stringify(fakeAdc())}),/LOCAL_CONFIG_INVALID/);
  assert.equal(loads,0);assert.equal(sends,0);
});
test('singleton reader uses only fixed REST GET with impersonated bearer and strictly typed fields',async()=>{
  const requests=[];const reader=policyRestReader({credential:{getAccessToken:async()=>({access_token:'fixture-sa-token'})},
    fetchImpl:async(url,request)=>{requests.push({url,request});return {status:200,json:async()=>({updateTime:'fixture-revision',fields:{
      schemaVersion:{integerValue:'1'},version:{integerValue:'1'},uid:{stringValue:'fixture-target'},enabled:{booleanValue:false},
      expiresAt:{timestampValue:'2030-01-01T00:00:00Z'}}})};}});
  const snap=await reader();assert.equal(snap.exists,true);assert.equal(snap.data.schemaVersion,1);assert.equal(snap.data.enabled,false);
  assert.equal(snap.data.expiresAt.toMillis(),Date.parse('2030-01-01T00:00:00Z'));
  assert.equal(requests.length,1);assert.equal(requests[0].url,POLICY_READ_URL);assert.equal(requests[0].request.method,'GET');
  assert.equal(requests[0].request.body,undefined);assert.equal(requests[0].request.redirect,'error');
  assert.equal(requests[0].request.headers.Authorization,'Bearer fixture-sa-token');
  const missing=policyRestReader({credential:{getAccessToken:async()=>({access_token:'fixture'})},fetchImpl:async()=>({status:404})});
  assert.equal((await missing()).exists,false);
});

// Real pinned SDK credential/lookup code; every external transport is replaced
// or hard denied. No ADC from the PC, metadata service, emulator or cloud is used.
test('pinned Admin and GoogleAuth impersonate offline for Auth read, singleton read, grant and removal',async()=>{
  const require=createRequire(new URL('../functions/package.json',import.meta.url));
  const adminApp=require('firebase-admin/app'); // Import before denying transports; no initialization or I/O.
  const adminPath=path.dirname(require.resolve('firebase-admin/app'));
  const {HttpClient}=require(path.join(adminPath,'../utils/api-request.js'));
  const authRequire=createRequire(require.resolve('google-auth-library'));
  const {Gaxios}=authRequire('gaxios');
  const adminPackage=JSON.parse(await (await import('node:fs/promises')).readFile(path.join(adminPath,'../../package.json'),'utf8'));
  assert.equal(adminPackage.version,'14.5.0');
  assert.equal(require('google-auth-library/package.json').version,'11.3.3');
  const directory=await mkdtemp(path.join(os.tmpdir(),'frame-adc-offline-'));
  const filename=path.join(directory,'application_default_credentials.json');await writeFile(filename,JSON.stringify(fakeAdc()));
  const envKeys=['GOOGLE_APPLICATION_CREDENTIALS','GOOGLE_CLOUD_QUOTA_PROJECT','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','CLOUDSDK_CONFIG','google_application_credentials'];
  const previousEnv=Object.fromEntries(envKeys.map(key=>[key,process.env[key]]));
  const old={connect:net.Socket.prototype.connect,http:http.request,https:https.request,fetch:globalThis.fetch,
    adapter:Gaxios.prototype._defaultAdapter,send:HttpClient.prototype.send};
  const uid='fixture-target';const email='fixture@appcodici-password.invalid';let claims={other:{preserved:true}};
  let networkAttempts=0,oauth=0,mints=0,lookups=0;const mutations=[],policyCalls=[];
  const blocked=()=>{networkAttempts++;throw Error('NETWORK_DISABLED');};
  const response=(config,data)=>({config,data,status:200,statusText:'OK',headers:new Headers()});
  let admin;
  try{
    for(const key of envKeys.slice(1))delete process.env[key];process.env.GOOGLE_APPLICATION_CREDENTIALS=filename;
    // Divergent discovery paths must never replace the already validated JSON.
    process.env.CLOUDSDK_CONFIG=path.join(directory,'not-the-approved-adc');
    if(process.platform!=='win32')process.env.google_application_credentials=path.join(directory,'not-the-approved-adc.json');
    net.Socket.prototype.connect=blocked;http.request=blocked;https.request=blocked;globalThis.fetch=blocked;
    Gaxios.prototype._defaultAdapter=async function(config){
      const url=String(config.url);
      if(url==='https://oauth2.googleapis.com/token'){
        oauth++;assert.equal(config.method,'POST');
        return response(config,{access_token:'fixture-source-token',expires_in:3600,token_type:'Bearer'});
      }
      assert.equal(url,IMPERSONATION_URL);mints++;
      assert.equal(config.headers.get('authorization'),'Bearer fixture-source-token');
      assert.ok(config.data.scope.includes('https://www.googleapis.com/auth/identitytoolkit'));
      return response(config,{accessToken:'fixture-sa-token',expireTime:new Date(Date.now()+3600000).toISOString()});
    };
    HttpClient.prototype.send=async function(request){
      assert.equal(request.url,'https://identitytoolkit.googleapis.com/v1/projects/'+CLAIM_PROJECT+'/accounts:lookup');
      assert.equal(request.method,'POST');assert.equal(request.headers.Authorization,'Bearer fixture-sa-token');
      assert.equal(request.headers['x-goog-user-project'],undefined);assert.deepEqual(request.data,{localId:[uid]});lookups++;
      return {status:200,data:{users:[{localId:uid,email,emailVerified:true,disabled:false,customAttributes:JSON.stringify(claims)}]}};
    };
    const fetchImpl=async(url,request)=>{
      assert.equal(request.headers.Authorization,'Bearer fixture-sa-token');assert.equal(request.redirect,'error');
      if(url===POLICY_READ_URL){
        assert.equal(request.method,'GET');policyCalls.push(url);
        return {status:200,json:async()=>({updateTime:'fixture-revision',fields:{schemaVersion:{integerValue:'1'},version:{integerValue:'1'},
          uid:{stringValue:uid},enabled:{booleanValue:false},expiresAt:{timestampValue:'2030-01-01T00:00:00Z'}}})};
      }
      assert.equal(url,'https://identitytoolkit.googleapis.com/v1/projects/'+CLAIM_PROJECT+'/accounts:update');assert.equal(request.method,'POST');
      const payload=JSON.parse(request.body);assert.deepEqual(Object.keys(payload).sort(),['customAttributes','localId']);assert.equal(payload.localId,uid);
      claims=JSON.parse(payload.customAttributes);mutations.push(structuredClone(claims));return {status:200};
    };
    admin=await createVaultFrameClaimAdmin({fetchImpl});
    assert.equal((await admin.readPolicy()).exists,true);
    const target={schemaVersion:1,projectId:CLAIM_PROJECT,uid,expectedEmail:email,phase:'test',approvedForCanary:true};
    for(const operation of ['grant','remove']){
      const report=await runVaultFrameClaim({auth:admin.auth,readPolicy:admin.readPolicy,target,
        options:{uid,phase:'test',mode:'apply',operation,exclusiveWriter:true},saveBefore:async()=>{}});
      assert.equal(report.verified,true);assert.doesNotMatch(JSON.stringify(report),/fixture-target|fixture@|fixture-sa-token/);
    }
    assert.deepEqual(mutations,[{other:{preserved:true},[FRAME_CLAIM]:true},{other:{preserved:true}}]);
    assert.equal(lookups,6);assert.equal(policyCalls.length,7);assert.equal(oauth,1);assert.equal(mints,1);assert.equal(networkAttempts,0);
  } finally {
    await admin?.close();
    Gaxios.prototype._defaultAdapter=old.adapter;HttpClient.prototype.send=old.send;
    net.Socket.prototype.connect=old.connect;http.request=old.http;https.request=old.https;globalThis.fetch=old.fetch;
    for(const key of envKeys)if(previousEnv[key]===undefined)delete process.env[key];else process.env[key]=previousEnv[key];
    await rm(directory,{recursive:true,force:true});
    assert.equal(adminApp.getApps().some(app=>app.name==='vault-frame-claim-once'),false);
  }
});
