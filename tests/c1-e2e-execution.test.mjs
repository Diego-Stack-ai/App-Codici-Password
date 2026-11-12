import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeC1,readQa2Secrets,verifyC1Release} from '../scripts/lib/c1-e2e-execution.mjs';
import {timerCase} from '../scripts/lib/c1-e2e-priority.mjs';
import {browserEnvironment,sanitizeCase,sanitizeC1Report,assertCaseDiagnostics,writeSanitizedReport,runAuthorizedC1} from '../scripts/lib/c1-e2e-runner.mjs';
import {createLocalFixturePort} from '../scripts/lib/c1-e2e-production-port.mjs';
import {C1_AUTH_CODES,C1_HTTP_FAILURE_CODES} from '../scripts/lib/c1-e2e-contract.mjs';
import {access,mkdtemp,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const good=()=>({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'Diego-Stack-ai/App-Codici-Password',
 GITHUB_REF:'refs/heads/master',GITHUB_SHA:'a'.repeat(40),C1_REVIEWED_RUNNER_SHA:'a'.repeat(40),
 GITHUB_ACTOR:'synthetic-operator',C1_ALLOWED_OPERATOR:'synthetic-operator',
 C1_EXECUTION_ORDER:'https://github.com/Diego-Stack-ai/App-Codici-Password/pull/292#issuecomment-1',
 C1_PREFLIGHT_CONFIRMED:'true',C1_EFFECTS_CONFIRMED:'true',C1_ACCEPT_D02_LIMIT:'true',
 C1_PROFILE:'chrome-desktop',C1_RELEASE_SHA:'b'.repeat(40),C1_RELEASE_VERSION:'1.2.270'});
const reportV4=()=>({schemaVersion:4,profile:'chrome-desktop',platform:'win32',engineVersion:'156.0',runnerSha:'a'.repeat(40),
 release:{version:'1.2.270',sourceSha:'b'.repeat(40),publicTreeSha256:'c'.repeat(64)},productionExecuted:true,possibleAppWrites:true,
 network:true,diagSource:'getter',cases:[{id:'SETUP',status:'FAIL',code:'C1_RUNTIME_FAILURE',diag:null}],code:'C1_RUNTIME_FAILURE',
 failureDiagCode:'C1_DIAG_UNAVAILABLE',offRequired:true,timeoutRestoreRequired:false,
 firstError:{phase:'FRAME_ENTRY',source:'console',frame:'top',tag:'BLINDA',host:null,
  kind:'OTHER',origin:'app',hasArgs:true,firebaseComponent:null,googlePath:null},
 thirdPartyConsole:{count:0,firstPhase:null,googlePath:null}});
async function nativeConsoleHarness(){
 const handlers=new Map();let fills=0;
 const page={url:()=> 'http://127.0.0.1:9191/login.html',on:(event,callback)=>handlers.set(event,callback),
  context:()=>({serviceWorkers:()=>[],route:async()=>{},on:(event,callback)=>handlers.set('context:'+event,callback)}),addInitScript:async()=>{},setDefaultTimeout:()=>{},
  locator:()=>{fills++;throw Error('MUST_NOT_FILL');}};
 return {port:await createLocalFixturePort(page,{},{}),handlers,fills:()=>fills};
}
const nativeConsoleMessage=(url='https://www.google.com/recaptcha/api2/anchor?key=synthetic-private',args=[],text='Synthetic native notice')=>
 ({type:()=> 'error',text:()=>text,location:()=>({url}),args:()=>args});
test('native recaptcha-shaped console error is registered rather than fatal',async()=>{
 for(const [url,googlePath]of [['https://www.google.com/recaptcha/api.js','recaptcha-api'],
  ['https://www.recaptcha.net/recaptcha/api2/anchor','recaptcha-frame'],
  ['https://www.gstatic.com/recaptcha/releases/synthetic/recaptcha.js','gstatic-recaptcha']]){
  const h=await nativeConsoleHarness();h.handlers.get('console')(nativeConsoleMessage(url));
  assert.equal(h.port.firstError('C1_RUNTIME_FAILURE'),null);
  assert.deepEqual(h.port.thirdPartyConsole(),{count:1,firstPhase:'LOGIN_READY',googlePath});
  assert.equal(h.port.failureCode(Error('C1_READINESS')),'C1_READINESS');assert.equal(h.fills(),0);
 }
});
test('recaptcha exception negatives remain fatal before any secret input',async()=>{
 const url='https://www.google.com/recaptcha/api2/anchor?private=never-export';
 const unreadable=()=>{throw Error('synthetic-private');};
 const cases=[
  nativeConsoleMessage(url,[{}]),nativeConsoleMessage(url,[undefined]),
  {...nativeConsoleMessage(url),args:unreadable},{...nativeConsoleMessage(url),args:()=>({length:0})},
  nativeConsoleMessage('https://www.google.com/unrelated'),
  nativeConsoleMessage('https://appcodici-password.web.app/recaptcha/api2/anchor'),
  nativeConsoleMessage('https://www.google.com.evil.invalid/recaptcha/api2/anchor'),
  nativeConsoleMessage(url,[],'Failed to load resource: synthetic-private'),
  nativeConsoleMessage(url,[],'[BLINDA] synthetic-private'),
  nativeConsoleMessage(url,[],'Refused to frame private because of Content Security Policy'),
  nativeConsoleMessage(url,[],'The source list for Content Security Policy directive contains an invalid source'),
  nativeConsoleMessage(url,[],'Access to private has been blocked by CORS policy'),
  nativeConsoleMessage(url,[],'Unknown CORS problem'),
  nativeConsoleMessage(url,[],'Permissions policy violation: synthetic-private'),
  nativeConsoleMessage(url,[],'The Permissions-Policy header is invalid'),
  nativeConsoleMessage(url,[],'@firebase/auth: synthetic-private'),
  nativeConsoleMessage(url,[],'Uncaught (in promise) synthetic-private'),
  nativeConsoleMessage(url,[],''),nativeConsoleMessage(url,[],'  '),
  {...nativeConsoleMessage(url),text:unreadable},{...nativeConsoleMessage(url),text:()=>({toString:unreadable})},
  {...nativeConsoleMessage(url),location:unreadable}
 ];
 for(const message of cases){
  const h=await nativeConsoleHarness();h.handlers.get('console')(message);
  assert.equal(h.port.failureCode(Error('C1_READINESS')),'C1_RUNTIME_FAILURE');
  assert.deepEqual(h.port.thirdPartyConsole(),{count:0,firstPhase:null,googlePath:null});
  await assert.rejects(()=>h.port.collectDiag(),/^Error: C1_RUNTIME_FAILURE$/);assert.equal(h.fills(),0);
 }
});
test('HTTP, pageerror, failed requests and modal channels remain fatal after a recorded exception',async()=>{
 for(const [channel,event,code]of [
  ['response',{status:()=>400,url:()=> 'https://firebaseappcheck.googleapis.com/private'},'C1_HTTP_FAILURE_APPCHECK'],
  ['response',{status:()=>401,url:()=> 'https://identitytoolkit.googleapis.com/private'},'C1_AUTH_HTTP_IDENTITY'],
  ['response',{status:()=>503,url:()=> 'https://firestore.googleapis.com/private'},'C1_HTTP_FAILURE_FIRESTORE'],
  ['response',{status:()=>400,url:()=> 'https://www.google.com/recaptcha/api2/anchor'},'C1_HTTP_FAILURE_OTHER'],
  ['pageerror',Error('synthetic-private'),'C1_RUNTIME_FAILURE'],
  ['requestfailed',{failure:()=>({errorText:'net::ERR_FAILED'})},'C1_NETWORK_FAILURE'],
  ['dialog',{dismiss:async()=>{}},'C1_MODAL_UNEXPECTED'],
  ['download',{cancel:async()=>{}},'C1_MODAL_UNEXPECTED'],
  ['context:page',{close:async()=>{}},'C1_MODAL_UNEXPECTED']
 ]){
  const h=await nativeConsoleHarness();const message=nativeConsoleMessage();h.handlers.get('console')(message);
  h.handlers.get(channel)(event);assert.equal(h.port.failureCode(Error('C1_READINESS')),code);
  const first=h.port.firstError(code);h.port.beginCases();h.handlers.get('console')(message);
  h.handlers.get('pageerror')(Error('later-private'));
  assert.equal(h.port.failureCode(Error('C1_READINESS')),code);assert.deepEqual(h.port.firstError(code),first);
  assert.deepEqual(h.port.thirdPartyConsole(),{count:1,firstPhase:'LOGIN_READY',googlePath:'recaptcha-frame'});
  await assert.rejects(()=>h.port.collectDiag(),new RegExp('^Error: '+code+'$'));assert.equal(h.fills(),0);
 }
});
test('exception record saturates, preserves its first context and freezes before cleanup',async()=>{
 const h=await nativeConsoleHarness();h.handlers.get('console')(nativeConsoleMessage());h.port.beginCases();
 for(let i=0;i<25;i++)h.handlers.get('console')(nativeConsoleMessage('https://www.gstatic.com/recaptcha/synthetic.js'));
 const expected={count:20,firstPhase:'LOGIN_READY',googlePath:'recaptcha-frame'};
 const snapshot=h.port.thirdPartyConsole();assert.deepEqual(snapshot,expected);snapshot.count=0;
 assert.deepEqual(h.port.thirdPartyConsole(),expected);h.port.freezeErrors();h.handlers.get('console')(nativeConsoleMessage());
 h.handlers.get('pageerror')(Error('cleanup-private'));
 assert.deepEqual(h.port.thirdPartyConsole(),expected);assert.equal(h.port.firstError('C1_RUNTIME_FAILURE'),null);
});
test('v4 report preserves the bounded exception record even with no DIAG',()=>{
 const report={...reportV4(),schemaVersion:4,firstError:{...reportV4().firstError,googlePath:null},
  thirdPartyConsole:{count:1,firstPhase:'FRAME_ENTRY',googlePath:'recaptcha-frame'}};
 assert.deepEqual(sanitizeC1Report(report),report);
 for(const delta of [{count:-1},{count:1.5},{count:21},{count:'1'},{count:true},{firstPhase:'private-phase'},{googlePath:'private-path'},
  {count:0},{url:'https://never-export.invalid'},{[Symbol('private')]:true}])
  assert.throws(()=>sanitizeC1Report({...report,thirdPartyConsole:{...report.thirdPartyConsole,...delta}}),/^Error: C1_REPORT_INVALID$/);
 assert.doesNotMatch(JSON.stringify(sanitizeC1Report(report)),/https?:|private/);
 assert.deepEqual(sanitizeC1Report({...report,thirdPartyConsole:{count:0,firstPhase:null,googlePath:null}}).thirdPartyConsole,
  {count:0,firstPhase:null,googlePath:null});
 assert.throws(()=>sanitizeC1Report({...report,schemaVersion:3}),/^Error: C1_REPORT_INVALID$/);
 for(const delta of [{count:1,firstPhase:null},{googlePath:'other'},{count:0,firstPhase:null,googlePath:'recaptcha-api'}])
  assert.throws(()=>sanitizeC1Report({...report,thirdPartyConsole:{...report.thirdPartyConsole,...delta}}),/^Error: C1_REPORT_INVALID$/);
});
test('execution requires dispatch/master/reviewed SHA/operator/order and all separate attestations',()=>{
 assert.equal(authorizeC1(good(),'win32').version,'1.2.270');
 for(const key of ['GITHUB_ACTIONS','GITHUB_EVENT_NAME','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_SHA',
   'C1_REVIEWED_RUNNER_SHA','GITHUB_ACTOR','C1_ALLOWED_OPERATOR','C1_EXECUTION_ORDER','C1_PREFLIGHT_CONFIRMED','C1_EFFECTS_CONFIRMED','C1_ACCEPT_D02_LIMIT']){
   const env=good();delete env[key];assert.throws(()=>authorizeC1(env,'win32'),/^Error: C1_EXECUTION_NOT_AUTHORIZED$/);
 }
 assert.throws(()=>authorizeC1({...good(),DEBUG:'pw:api'},'win32'),/^Error: C1_EXECUTION_NOT_AUTHORIZED$/);
 assert.throws(()=>authorizeC1(good(),'linux'),/^Error: C1_PLATFORM_UNSUPPORTED$/);
});
test('v4 diagnostic report accepts only the extended closed metadata',()=>{
 const report={...reportV4(),schemaVersion:4,firstError:{...reportV4().firstError,
  kind:'OTHER',origin:'app',hasArgs:true,firebaseComponent:null,googlePath:null}};
 assert.deepEqual(sanitizeC1Report(report),report);
 for(const delta of [{kind:'private-kind'},{origin:'https://never-export.invalid'},{hasArgs:'true'},
  {firebaseComponent:'private-component'},{kind:'CSP',firebaseComponent:'auth'},{url:'https://never-export.invalid'}])
  assert.throws(()=>sanitizeC1Report({...report,firstError:{...report.firstError,...delta}}),/^Error: C1_REPORT_INVALID$/);
 assert.throws(()=>sanitizeC1Report({...report,schemaVersion:2}),/^Error: C1_REPORT_INVALID$/);
});
test('direct runner import also rejects an unauthorized call before any network',async()=>{
 await assert.rejects(()=>runAuthorizedC1({}, {}, {}),/^Error: C1_EXECUTION_NOT_AUTHORIZED$/);
});
test('no personal target, absent secret or reused Master can pass private input validation',()=>{
 const env={C1_QA2_EMAIL:'codex.qa2@appcodici-password.invalid',C1_QA2_EXPECTED_UID:'synthetic-only',
   C1_QA2_PASSWORD:'Synthetic-login-only-123!',C1_QA2_MASTER_PASSWORD:'Synthetic-master-only-456!'};
 assert.equal(readQa2Secrets(env).uid,'synthetic-only');
 for(const delta of [{C1_QA2_EMAIL:'personal@example.invalid'},{C1_QA2_EXPECTED_UID:''},
   {C1_QA2_MASTER_PASSWORD:env.C1_QA2_PASSWORD},{C1_QA2_PASSWORD:''}])
   assert.throws(()=>readQa2Secrets({...env,...delta}),/^Error: C1_TARGET_DENIED$/);
});
test('manifest verification precedes browser: exact public version/source, no redirects or cache',async()=>{
 const config=authorizeC1(good(),'win32');
 let options;
 const manifest={schemaVersion:2,sourceDirty:false,appVersion:config.version,sourceCommit:config.releaseSha,publicTree:{sha256:'c'.repeat(64),fileCount:362}};
 const fake=async(url,opts)=>{assert.equal(url,'https://appcodici-password.web.app/release-manifest.json');options=opts;return {ok:true,text:async()=>JSON.stringify(manifest)};};
 assert.equal((await verifyC1Release(config,fake)).sourceSha,config.releaseSha);
 assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
 await assert.rejects(()=>verifyC1Release({...config,releaseSha:'d'.repeat(40)},fake),/^Error: C1_RELEASE_MISMATCH$/);
 await assert.rejects(()=>verifyC1Release(config,async()=>{throw Error('private SDK text');}),/^Error: C1_RELEASE_MISMATCH$/);
});
function syntheticTimer({activityRenews=true,navigationRenews=false}={}){
 let now=0,last=0,idle=0,resumes=0;
 return {port:{
   timerStart:async minutes=>{idle=minutes*60000;last=now;},
   wait:async ms=>{now+=ms;},
   assertUnlocked:async()=>{if(now-last>=idle)throw Error('C1_CONTINUITY_BROKEN');},
   trustedActivity:async()=>{if(activityRenews)last=now;},
   passiveBack:async()=>{if(navigationRenews)last=now;},
   isLocked:async()=>now-last>=idle,resumeExpectedOnce:async()=>{resumes++;}
 },state:()=>({now,resumes})};
}
test('timer algorithm requires activity renewal and passive navigation without renewal, at 1 and 3 minutes',async()=>{
 for(const minutes of [1,3]){
  const good=syntheticTimer();await timerCase(good.port,minutes);assert.equal(good.state().resumes,1);
  const missingActivity=syntheticTimer({activityRenews:false});
  await assert.rejects(()=>timerCase(missingActivity.port,minutes),/^Error: C1_CONTINUITY_BROKEN$/);
  const navRenews=syntheticTimer({navigationRenews:true});
  await assert.rejects(()=>timerCase(navRenews.port,minutes),/^Error: C1_TIMEOUT_NOT_LOCKED$/);
  assert.equal(navRenews.state().resumes,0);
 }
});
test('case oracle rejects DIAG errors, admission failure and unexpected locks/reentry',()=>{
 const diag=code=>({events:[{code,at:100}]});
 for(const code of ['ERROR_FRAME_OPERATION','ADMISSION_DENIED','VERSION_SKEW','LOGIN_REDIRECT','LOCK_CHILD_REQUEST','FRAME_ENTER'])
  assert.throws(()=>assertCaseDiagnostics('D02',diag(code),99),/^Error: C1_UNEXPECTED_DIAG$/);
 assert.doesNotThrow(()=>assertCaseDiagnostics('D05-A',diag('LOCK_PAGEHIDE'),99));
 assert.doesNotThrow(()=>assertCaseDiagnostics('D06-1',diag('LOCK_EXPIRED'),99));
 assert.doesNotThrow(()=>assertCaseDiagnostics('D04-core',diag('LOCK_EXPIRED'),101));
 assert.throws(()=>assertCaseDiagnostics('D02',{events:Array.from({length:200},()=>({code:'FRAME_EXIT',at:100}))},99),/^Error: C1_DIAG_TRUNCATED$/);
});
test('browser receives system environment only, reports refuse extra case data and free errors',()=>{
 assert.deepEqual(browserEnvironment({Path:'synthetic-path',SystemRoot:'synthetic-root',
  C1_QA2_MASTER_PASSWORD:'never-share',GITHUB_TOKEN:'never-share',GOOGLE_APPLICATION_CREDENTIALS:'never-share',DEBUG:'pw:api'}),
  {Path:'synthetic-path',SystemRoot:'synthetic-root'});
 assert.deepEqual(sanitizeCase({id:'D02',status:'LIMITE',code:'C1_CONFIG_DOC_ROUTE_UNAVAILABLE',diag:null}),
  {id:'D02',status:'LIMITE',code:'C1_CONFIG_DOC_ROUTE_UNAVAILABLE',diag:null});
 for(const row of [
  {id:'D02',status:'PASS',code:null,diag:null,uid:'never-share'},
  {id:'D02',status:'PASS',code:'free SDK error',diag:null}])
  assert.throws(()=>sanitizeCase(row),/^Error: C1_REPORT_INVALID$/);
 for(const code of [...C1_AUTH_CODES,...C1_HTTP_FAILURE_CODES]){
  const row={id:'SETUP',status:C1_AUTH_CODES.includes(code)?'BLOCKED':'FAIL',code,diag:null};
  assert.deepEqual(sanitizeCase(row),row);
  for(const extra of [{url:'https://synthetic.invalid/private'},{host:'synthetic.invalid'},{uid:'synthetic-only'}])
   assert.throws(()=>sanitizeCase({...row,...extra}),/^Error: C1_REPORT_INVALID$/);
 }
 assert.throws(()=>sanitizeCase({id:'SETUP',status:'BLOCKED',code:'C1_AUTH_HTTP_OTHER synthetic-private',diag:null}),/^Error: C1_REPORT_INVALID$/);
});

test('v4 report rejects sensitive additions, malformed metadata and legacy versions instead of silently spreading',()=>{
 assert.deepEqual(sanitizeC1Report(reportV4()),reportV4());
 for(const mutate of [r=>r.uid='synthetic-private',r=>r.firstError.message='synthetic-private',
  r=>r.firstError.frame='private-frame',r=>r.firstError.tag='private-tag',r=>r.release.url='https://synthetic.invalid/private',
  r=>r.cases[0].value='private',r=>r.code='private-error',r=>r.schemaVersion=1,r=>delete r.firstError,
  r=>r[Symbol('private')]=true,r=>r.firstError[Symbol('private')]=true,r=>r.cases[0][Symbol('private')]=true]){
  const r=reportV4();mutate(r);assert.throws(()=>sanitizeC1Report(r),/^Error: C1_REPORT_INVALID$/);
 }
 const serialized=JSON.stringify(sanitizeC1Report(reportV4()));
 assert.doesNotMatch(serialized,/uid|email|password|token|https?:|synthetic-private/);
});

test('response handler preserves the first HTTP host code and stops before credentials or Master',async()=>{
 // Event doubles only: no browser, DNS, request, provider or production access.
 for(const status of [400,401,403,404,429,500,503])for(const [host,code] of [
  ['content-firebaseappcheck.googleapis.com','C1_AUTH_HTTP_APPCHECK'],
  ['firebaseappcheck.googleapis.com','C1_AUTH_HTTP_APPCHECK'],
  ['identitytoolkit.googleapis.com','C1_AUTH_HTTP_IDENTITY'],
  ['securetoken.googleapis.com','C1_AUTH_HTTP_IDENTITY'],
  ['firestore.googleapis.com','C1_AUTH_HTTP_FIRESTORE'],
  ['firebaseappcheck.googleapis.com.evil.invalid','C1_AUTH_HTTP_OTHER'],
  ['content-firebaseappcheck.googleapis.com.evil.invalid','C1_AUTH_HTTP_OTHER'],
  ['content-firebaseappcheck.googleapis.com@other.invalid','C1_AUTH_HTTP_OTHER']
 ]){
  const handlers=new Map();let inputs=0;
  const page={url:()=> 'http://127.0.0.1:9191/login.html',on:(event,callback)=>handlers.set(event,callback),
   context:()=>({serviceWorkers:()=>[],route:async()=>{},on:()=>{}}),addInitScript:async()=>{},setDefaultTimeout:()=>{},
   goto:async()=>{
    handlers.get('response')({status:()=>status,url:()=> 'https://'+host+'/synthetic-private?key=never-export'});
    handlers.get('pageerror')(new Error('synthetic private provider detail'));
   },locator:()=>{inputs++;throw Error('MUST_NOT_REACH_INPUTS');}};
  const port=await createLocalFixturePort(page,{},{});
  const expected=status===401||status===403?code:code.replace('C1_AUTH_HTTP_','C1_HTTP_FAILURE_');
  await assert.rejects(()=>port.start(),new RegExp('^Error: '+expected+'$'));
  assert.equal(inputs,0);
  assert.equal(port.timerRestoreRequired(),false);
  const first=port.firstError(expected);
  assert.equal(port.failureCode(new Error('C1_READINESS')),expected);
  assert.deepEqual(first,{phase:'LOGIN_READY',source:'http',frame:'other',tag:null,host:code.slice('C1_AUTH_HTTP_'.length).toLowerCase(),
   kind:null,origin:code.endsWith('_OTHER')?'other':'firebase',hasArgs:null,firebaseComponent:null,googlePath:null});
  port.beginCases();handlers.get('pageerror')(new Error('later synthetic-private'));
  assert.deepEqual(port.firstError(expected),first);
 }
});

test('HTTP failure during language inspection remains first and never clicks or fills',async()=>{
 for(const stage of ['count','evaluate']){
  const handlers=new Map();let actions=0;
  const rejected=()=>handlers.get('response')({status:()=>403,url:()=> 'https://content-firebaseappcheck.googleapis.com/synthetic'});
  const overlay={count:async()=>{if(stage==='count')rejected();return 1;},
   evaluate:async()=>{rejected();return false;},locator:()=>{actions++;throw Error('MUST_NOT_CLICK');}};
  const page={url:()=> 'http://127.0.0.1:9191/login.html',on:(event,callback)=>handlers.set(event,callback),
   context:()=>({serviceWorkers:()=>[],route:async()=>{},on:()=>{}}),addInitScript:async()=>{},setDefaultTimeout:()=>{},
   goto:async()=>{},waitForFunction:async()=>true,locator:selector=>{
    if(selector==='#initial-language-dialog')return overlay;actions++;throw Error('MUST_NOT_FILL');}};
  const port=await createLocalFixturePort(page,{},{});
  await assert.rejects(()=>port.start(),/^Error: C1_AUTH_HTTP_APPCHECK$/);
  assert.equal(actions,0);
 }
});

test('pending or absent console realm stays OTHER without delaying failure or replacing its first phase',async()=>{
 for(const pending of [false,true]){
  const handlers=new Map();
  const message={type:()=> 'error',text:()=> 'Failed to load resource: synthetic-private',
   location:()=>({url:'https://firestore.googleapis.com/private?token=synthetic-private'}),
   args:()=>pending?[{evaluate:()=>new Promise(()=>{})}]:[]};
  const page={url:()=> 'http://127.0.0.1:9191/login.html',on:(event,callback)=>handlers.set(event,callback),
   context:()=>({serviceWorkers:()=>[],route:async()=>{},on:()=>{}}),addInitScript:async()=>{},setDefaultTimeout:()=>{},
   goto:async()=>{handlers.get('console')(message);},locator:()=>{throw Error('MUST_NOT_FILL');}};
  const port=await createLocalFixturePort(page,{},{});
  await assert.rejects(()=>port.start(),/^Error: C1_RUNTIME_FAILURE$/);
  const first={phase:'LOGIN_READY',source:'console',frame:'other',tag:'RESOURCE',host:'firestore',
   kind:'OTHER',origin:'firebase',hasArgs:pending,firebaseComponent:null,googlePath:null};
  assert.deepEqual(port.firstError('C1_RUNTIME_FAILURE'),first);
  port.beginCases();handlers.get('pageerror')(new Error('later synthetic-private'));
  assert.deepEqual(port.firstError('C1_RUNTIME_FAILURE'),first);
  assert.equal(port.firstError('C1_TARGET_DENIED'),null);
 }
});
test('console metadata counts handles once without reading their values or delaying first fatal',async()=>{
 for(const mode of ['empty','pending','destroyed','unavailable']){
  const handlers=new Map();let argsReads=0,valueReads=0,fills=0;
  const handle={evaluate:()=>mode==='destroyed'?Promise.reject(Error('synthetic-private')):new Promise(()=>{}),
   jsonValue:()=>{valueReads++;throw Error('MUST_NOT_READ');},getProperties:()=>{valueReads++;throw Error('MUST_NOT_READ');}};
  const message={type:()=> 'error',text:()=> 'Permissions policy violation: synthetic-private',
   location:()=>({url:'https://www.google.com/recaptcha/private?key=synthetic-private'}),
   args:()=>{argsReads++;if(mode==='unavailable')throw Error('synthetic-private');return mode==='empty'?[]:[handle];}};
  const page={url:()=> 'http://127.0.0.1:9191/login.html',on:(event,callback)=>handlers.set(event,callback),
   context:()=>({serviceWorkers:()=>[],route:async()=>{},on:()=>{}}),addInitScript:async()=>{},setDefaultTimeout:()=>{},
   goto:async()=>{handlers.get('console')(message);},locator:()=>{fills++;throw Error('MUST_NOT_FILL');}};
  const port=await createLocalFixturePort(page,{},{});
  await assert.rejects(()=>port.start(),/^Error: C1_RUNTIME_FAILURE$/);
  const detail=port.firstError('C1_RUNTIME_FAILURE');
  assert.deepEqual(detail,{phase:'LOGIN_READY',source:'console',frame:'other',tag:'OTHER',host:null,
   kind:'PERMISSIONS_POLICY',origin:'google',hasArgs:mode==='unavailable'?null:mode!=='empty',firebaseComponent:null,googlePath:'other'});
  assert.equal(argsReads,1);assert.equal(valueReads,0);assert.equal(fills,0);
  assert.doesNotMatch(JSON.stringify(detail),/synthetic-private|recaptcha|https?:|key=/);
  port.beginCases();handlers.get('console')(message);port.freezeErrors();handlers.get('pageerror')(Error('later private'));
  assert.deepEqual(port.firstError('C1_RUNTIME_FAILURE'),detail);assert.equal(argsReads,1);
 }
});

test('errors during failure collection and cleanup cannot create metadata for a different failure',async()=>{
 const handlers=new Map();
 const page={url:()=> 'http://127.0.0.1:9191/login.html',on:(event,callback)=>handlers.set(event,callback),
  context:()=>({serviceWorkers:()=>[],route:async()=>{},on:()=>{}}),addInitScript:async()=>{},setDefaultTimeout:()=>{}};
 const port=await createLocalFixturePort(page,{},{});port.freezeErrors();
 handlers.get('pageerror')(new Error('synthetic-private'));
 assert.equal(port.firstError('C1_RUNTIME_FAILURE'),null);
});
test('artifact flag is set only for a newly written report, never for a stale wx file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'c1-sanitized-report-')),output=join(dir,'output');
 const env={RUNNER_TEMP:dir,GITHUB_OUTPUT:output},file=join(dir,'c1-qa2-report.json');
 try{
  await writeFile(output,'');
  await writeSanitizedReport(reportV4(),env);
  assert.equal(await readFile(output,'utf8'),'report_written=true\n');
  await writeFile(output,'');
  await assert.rejects(()=>writeSanitizedReport(reportV4(),env),/^Error: C1_REPORT_WRITE$/);
  assert.equal(await readFile(output,'utf8'),'');
  assert.equal(JSON.parse(await readFile(file,'utf8')).schemaVersion,4);
 }finally{await unlink(file).catch(()=>{});await unlink(output).catch(()=>{});await rmdir(dir);}
});
test('installed workflow is manual-only, pinned, without cloud roles, and uploads only current report',async()=>{
 const source=await readFile(new URL('../.github/workflows/c1-qa2-e2e.yml',import.meta.url),'utf8');
 await assert.rejects(access(new URL('../scripts/workflows/c1-qa2-e2e.yml',import.meta.url)),{code:'ENOENT'});
 const triggers=source.match(/^'on':\r?\n([\s\S]*?)^permissions:/m);
 assert.ok(triggers,'the installed workflow must declare its event block');
 assert.deepEqual([...triggers[1].matchAll(/^  ([a-z_]+):/gm)].map(match=>match[1]),['workflow_dispatch']);
 assert.match(source,/permissions:\s+contents: read/);
 assert.doesNotMatch(source,/id-token|firebase deploy|gcloud auth|GOOGLE_APPLICATION_CREDENTIALS/);
 assert.match(source,/environment: c1-qa2-production/);
 assert.match(source,/cancel-in-progress: false/);
 assert.match(source,/steps\.c1\.outputs\.report_written == 'true'/);
 assert.match(source,/retention-days: 7/);
 const actions=[...source.matchAll(/uses: ([^\n]+)/g)];
 assert.equal(actions.length,3);
 assert.ok(actions.every(match=>/@[a-f0-9]{40}/.test(match[1])));
});
