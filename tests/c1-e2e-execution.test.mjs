import test from 'node:test';
import assert from 'node:assert/strict';
import {authorizeC1,readQa2Secrets,verifyC1Release} from '../scripts/lib/c1-e2e-execution.mjs';
import {timerCase} from '../scripts/lib/c1-e2e-priority.mjs';
import {browserEnvironment,sanitizeCase,assertCaseDiagnostics,writeSanitizedReport,runAuthorizedC1} from '../scripts/lib/c1-e2e-runner.mjs';
import {createLocalFixturePort} from '../scripts/lib/c1-e2e-production-port.mjs';
import {C1_AUTH_CODES} from '../scripts/lib/c1-e2e-contract.mjs';
import {access,mkdtemp,readFile,writeFile,unlink,rmdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const good=()=>({GITHUB_ACTIONS:'true',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REPOSITORY:'Diego-Stack-ai/App-Codici-Password',
 GITHUB_REF:'refs/heads/master',GITHUB_SHA:'a'.repeat(40),C1_REVIEWED_RUNNER_SHA:'a'.repeat(40),
 GITHUB_ACTOR:'synthetic-operator',C1_ALLOWED_OPERATOR:'synthetic-operator',
 C1_EXECUTION_ORDER:'https://github.com/Diego-Stack-ai/App-Codici-Password/pull/292#issuecomment-1',
 C1_PREFLIGHT_CONFIRMED:'true',C1_EFFECTS_CONFIRMED:'true',C1_ACCEPT_D02_LIMIT:'true',
 C1_PROFILE:'chrome-desktop',C1_RELEASE_SHA:'b'.repeat(40),C1_RELEASE_VERSION:'1.2.270'});
test('execution requires dispatch/master/reviewed SHA/operator/order and all separate attestations',()=>{
 assert.equal(authorizeC1(good(),'win32').version,'1.2.270');
 for(const key of ['GITHUB_ACTIONS','GITHUB_EVENT_NAME','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_SHA',
   'C1_REVIEWED_RUNNER_SHA','GITHUB_ACTOR','C1_ALLOWED_OPERATOR','C1_EXECUTION_ORDER','C1_PREFLIGHT_CONFIRMED','C1_EFFECTS_CONFIRMED','C1_ACCEPT_D02_LIMIT']){
   const env=good();delete env[key];assert.throws(()=>authorizeC1(env,'win32'),/^Error: C1_EXECUTION_NOT_AUTHORIZED$/);
 }
 assert.throws(()=>authorizeC1({...good(),DEBUG:'pw:api'},'win32'),/^Error: C1_EXECUTION_NOT_AUTHORIZED$/);
 assert.throws(()=>authorizeC1(good(),'linux'),/^Error: C1_PLATFORM_UNSUPPORTED$/);
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
 for(const code of C1_AUTH_CODES){
  const row={id:'SETUP',status:'BLOCKED',code,diag:null};
  assert.deepEqual(sanitizeCase(row),row);
  for(const extra of [{url:'https://synthetic.invalid/private'},{host:'synthetic.invalid'},{uid:'synthetic-only'}])
   assert.throws(()=>sanitizeCase({...row,...extra}),/^Error: C1_REPORT_INVALID$/);
 }
 assert.throws(()=>sanitizeCase({id:'SETUP',status:'BLOCKED',code:'C1_AUTH_HTTP_OTHER synthetic-private',diag:null}),/^Error: C1_REPORT_INVALID$/);
});

test('response handler preserves the first Auth host code and stops before credentials or Master',async()=>{
 // Event doubles only: no browser, DNS, request, provider or production access.
 for(const status of [401,403])for(const [host,code] of [
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
  await assert.rejects(()=>port.start(),new RegExp('^Error: '+code+'$'));
  assert.equal(inputs,0);
  assert.equal(port.timerRestoreRequired(),false);
 }
});
test('artifact flag is set only for a newly written report, never for a stale wx file',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'c1-sanitized-report-')),output=join(dir,'output');
 const env={RUNNER_TEMP:dir,GITHUB_OUTPUT:output},file=join(dir,'c1-qa2-report.json');
 try{
  await writeFile(output,'');
  await writeSanitizedReport({schemaVersion:1,cases:[]},env);
  assert.equal(await readFile(output,'utf8'),'report_written=true\n');
  await writeFile(output,'');
  await assert.rejects(()=>writeSanitizedReport({schemaVersion:2,cases:[]},env),/^Error: C1_REPORT_WRITE$/);
  assert.equal(await readFile(output,'utf8'),'');
  assert.equal(JSON.parse(await readFile(file,'utf8')).schemaVersion,1);
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
