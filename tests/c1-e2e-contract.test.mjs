import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {assertLoopback,qa2IdentityAllowed,validateDiag,safeFailure,authHttpFailureCode,httpFailureCode,C1_AUTH_CODES,C1_HTTP_FAILURE_CODES,C1_CODES,
 consoleErrorCategory,errorHostCategory,validateFirstError,C1_ERROR_PHASES,C1_ERROR_TAGS} from '../scripts/lib/c1-e2e-contract.mjs';
import {createLocalC1Driver} from '../scripts/lib/c1-e2e-cases.mjs';
const now=1794440000000;
const report=()=>({state:{version:'v1.2.270',active:true,permitValid:true,permitExpiresAt:now+60000,idleMs:180000,pushReady:false,lastBlock:null},
  enabled:true,available:true,events:[{code:'FRAME_ENTER',at:now-1,version:'v1.2.270',page:'home_page.html',environment:'browser'}]});
test('closed DIAG reconstructs approved fields only',()=>{
  assert.deepEqual(validateDiag(report(),now),report());
  for(const mutate of [
    r=>r.uid='private',r=>r.state.email='private',r=>r.events[0].value='private',
    r=>r.events[0].code='SECRET_FREE_TEXT',r=>r.events[0].page='home_page.html?private=1',
    r=>r.events[0].at=now-7*86400000,r=>r.events.push(...Array.from({length:200},()=>({...r.events[0]}))),
    r=>r.state.lastBlock='private',r=>r.state.active='true',r=>r.state.version='private',
    r=>r.state.version={toString:()=> 'v1.2.270',toJSON:()=>({private:'never-export'})}
  ]) {const r=report();mutate(r);assert.throws(()=>validateDiag(r,now),/^Error: C1_REPORT_INVALID$/);}
});

test('first error accepts only closed phase/source/frame/tag/host combinations',()=>{
 const value={phase:'FRAME_ENTRY',source:'console',frame:'top',tag:'BLINDA',host:null};
 assert.equal(validateFirstError(null),null);
 for(const phase of C1_ERROR_PHASES)assert.deepEqual(validateFirstError({...value,phase}),{...value,phase});
 for(const tag of C1_ERROR_TAGS)assert.equal(validateFirstError({...value,tag,host:tag==='RESOURCE'?'other':null}).tag,tag);
 for(const source of ['http','pageerror'])assert.deepEqual(validateFirstError({...value,source,tag:null,host:source==='http'?'identity':null}),
  {...value,source,tag:null,host:source==='http'?'identity':null});
 for(const extra of [{uid:'synthetic-private'},{url:'https://synthetic.invalid/private'},{message:'synthetic-private'},{stack:'synthetic-private'}])
  assert.throws(()=>validateFirstError({...value,...extra}),/^Error: C1_REPORT_INVALID$/);
 assert.throws(()=>validateFirstError({...value,[Symbol('synthetic-private')]:true}),/^Error: C1_REPORT_INVALID$/);
 for(const delta of [{phase:'SECRET'},{source:'worker-private'},{frame:'private-frame-name'},
  {tag:'BLINDA synthetic-private'},{host:'identitytoolkit.googleapis.com'},
  {source:'pageerror'},{source:'http',tag:null,host:null},{tag:'RESOURCE',host:null}])
  assert.throws(()=>validateFirstError({...value,...delta}),/^Error: C1_REPORT_INVALID$/);
});

test('console classification discards suffixes and uses exact resource hosts only',()=>{
 assert.deepEqual(consoleErrorCategory('[BLINDA] synthetic uid/token/value/private-url'),{tag:'BLINDA',host:null});
 for(const text of ['[UNLISTED] synthetic-private','[BLINDA-private] value','prefix [BLINDA] value','synthetic private'])
  assert.deepEqual(consoleErrorCategory(text),{tag:'OTHER',host:null});
 for(const [host,category]of [['content-firebaseappcheck.googleapis.com','appcheck'],['identitytoolkit.googleapis.com','identity'],
  ['firestore.googleapis.com','firestore'],['firestore.googleapis.com.evil.invalid','other']]){
  const url='https://synthetic:private@'+host+'/private?key=synthetic-secret#private';
  assert.equal(errorHostCategory(url),category);
  assert.deepEqual(consoleErrorCategory('Failed to load resource: synthetic free text',url),{tag:'RESOURCE',host:category});
 }
 assert.deepEqual(consoleErrorCategory({toString:()=>{throw Error('MUST_NOT_READ');}}),{tag:'OTHER',host:null});
});
test('prototype refuses production and URL tricks without echoing input',()=>{
  assert.equal(assertLoopback('http://127.0.0.1:9191/app.html'),'http://127.0.0.1:9191');
  for(const url of ['https://appcodici-password.web.app/app.html','http://127.0.0.1.evil.invalid:9191','http://private@127.0.0.1:9191','file:///private'])
    assert.throws(()=>assertLoopback(url),/^Error: C1_LOCAL_ONLY$/);
});
test('identity guard has no personal fallback and checks private target before Master',()=>{
  const expected={uid:'synthetic-only',email:'codex.qa2@appcodici-password.invalid'};
  const actual={...expected,emailVerified:true,projectId:'appcodici-password',canary:true};
  assert.equal(qa2IdentityAllowed(actual,expected),true);
  for(const delta of [{uid:'other'},{email:'personal@example.invalid'},{emailVerified:false},{projectId:'other'},{canary:false}])
    assert.equal(qa2IdentityAllowed({...actual,...delta},expected),false);
  assert.equal(qa2IdentityAllowed(actual,{...expected,email:'personal@example.invalid'}),false);
  assert.equal(qa2IdentityAllowed(null,expected),false);
});
test('untrusted errors never enter a report',()=>{
  assert.equal(safeFailure(new Error('private URL token uid contents')),'C1_TECHNICAL');
  assert.equal(safeFailure(new Error('C1_CONTINUITY_BROKEN')),'C1_CONTINUITY_BROKEN');
});

test('Auth HTTP diagnostics classify exact hosts only and never echo private URL parts',()=>{
  for(const [host,code] of [
    ['content-firebaseappcheck.googleapis.com','C1_AUTH_HTTP_APPCHECK'],
    ['firebaseappcheck.googleapis.com','C1_AUTH_HTTP_APPCHECK'],
    ['identitytoolkit.googleapis.com','C1_AUTH_HTTP_IDENTITY'],
    ['securetoken.googleapis.com','C1_AUTH_HTTP_IDENTITY'],
    ['firestore.googleapis.com','C1_AUTH_HTTP_FIRESTORE'],
    ['other.invalid','C1_AUTH_HTTP_OTHER']
  ]) assert.equal(authHttpFailureCode('https://synthetic:never-export@'+host+'/private-record?key=never-export#private'),code);
  assert.equal(authHttpFailureCode('https://FIREBASEAPPCHECK.GOOGLEAPIS.COM/v1'),'C1_AUTH_HTTP_APPCHECK');
  for(const url of [null,{},'', 'not a URL',
    'https://firebaseappcheck.googleapis.com.evil.invalid/private',
    'https://content-firebaseappcheck.googleapis.com.evil.invalid/private',
    'https://content-firebaseappcheck.googleapis.com@other.invalid/private',
    'https://firebaseappcheck.googleapis.com@other.invalid/private',
    'https://other.invalid/firebaseappcheck.googleapis.com?host=firestore.googleapis.com'])
    assert.equal(authHttpFailureCode(url),'C1_AUTH_HTTP_OTHER');
  assert.equal(C1_AUTH_CODES.length,10);
  assert.equal(C1_CODES.includes('C1_AUTH_NOT_READY'),false);
  assert.equal(C1_CODES.includes('C1_AUTH_BLOCKED'),false);
  for(const code of C1_AUTH_CODES){
    assert.equal(safeFailure(new Error(code)),code);
    assert.equal(safeFailure(new Error(code+': synthetic-private-detail')),'C1_TECHNICAL');
  }
});

test('all HTTP failures keep the host category, while non-errors produce no code',()=>{
  for(const [host,code] of [
    ['content-firebaseappcheck.googleapis.com','C1_HTTP_FAILURE_APPCHECK'],
    ['identitytoolkit.googleapis.com','C1_HTTP_FAILURE_IDENTITY'],
    ['firestore.googleapis.com','C1_HTTP_FAILURE_FIRESTORE'],
    ['content-firebaseappcheck.googleapis.com.evil.invalid','C1_HTTP_FAILURE_OTHER']
  ]) for(const status of [400,404,429,500,503]){
    assert.equal(httpFailureCode(status,'https://'+host+'/private?key=synthetic-secret'),code);
    assert.equal(C1_CODES.includes(code),true);
  }
  for(const status of [401,403])assert.equal(httpFailureCode(status,'https://content-firebaseappcheck.googleapis.com/v1'),'C1_AUTH_HTTP_APPCHECK');
  assert.equal(httpFailureCode(400,'not a URL'),'C1_HTTP_FAILURE_OTHER');
  for(const status of [0,200,204,302,null,'400',NaN])assert.equal(httpFailureCode(status,'not a URL'),null);
  assert.equal(C1_HTTP_FAILURE_CODES.length,4);
  for(const code of C1_HTTP_FAILURE_CODES){
    assert.equal(safeFailure(new Error(code)),code);
    assert.equal(safeFailure(new Error(code+': synthetic-private-detail')),'C1_TECHNICAL');
  }
});
test('driver rechecks origin before reload and callback, and guards outgoing requests',async()=>{
  let current='http://127.0.0.1:9191/app.html',reloads=0,unlocks=0,guard;
  const context={serviceWorkers:()=>[],route:async(_pattern,fn)=>{guard=fn;}};
  const page={url:()=>current,context:()=>context,reload:async()=>{reloads++;}};
  const driver=await createLocalC1Driver(page);
  current='https://appcodici-password.web.app/app.html';
  await assert.rejects(()=>driver.reloadOwner(async()=>{unlocks++;}),/^Error: C1_LOCAL_ONLY$/);
  assert.equal(reloads,0);assert.equal(unlocks,0);
  let aborted=0,continued=0;
  for(const url of ['https://external.invalid','http://127.0.0.1:9191/app.html']){
    await guard({request:()=>({url:()=>url}),abort:()=>{aborted++;},continue:()=>{continued++;}});
  }
  assert.equal(aborted,1);assert.equal(continued,1);
});
test('CLI default and unauthorized production request fail before browser, secrets or network',()=>{
  for(const args of [[],['--production'],['--url','https://appcodici-password.web.app']]) {
    const run=spawnSync(process.execPath,['scripts/c1-e2e.mjs',...args],{encoding:'utf8'});
    assert.equal(run.status,2);assert.equal(run.stderr,'');
    assert.deepEqual(JSON.parse(run.stdout),{code:args[0]==='--url'?'C1_OPTIONS_INVALID':'C1_EXECUTION_NOT_AUTHORIZED',wrote:false,network:false});
  }
  const list=spawnSync(process.execPath,['scripts/c1-e2e.mjs','--list'],{encoding:'utf8'});
  assert.equal(list.status,0);assert.equal(JSON.parse(list.stdout).productionReady,false);
});
