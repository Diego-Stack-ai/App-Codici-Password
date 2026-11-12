import {writeFile,appendFile} from 'node:fs/promises';
import {isAbsolute,join,relative} from 'node:path';
import {C1_PRIORITY_CASES,verifyC1Release,authorizeC1,readQa2Secrets} from './c1-e2e-execution.mjs';
import {C1_CODES,C1_AUTH_CODES,C1_PROFILES,safeFailure,validateDiag,validateFirstError,fail} from './c1-e2e-contract.mjs';
import {createProductionPort} from './c1-e2e-production-port.mjs';
import {runPriorityC1} from './c1-e2e-priority.mjs';

const caseIds=new Set(['SETUP',...C1_PRIORITY_CASES]),statuses=new Set(['PASS','LIMITE','FAIL','BLOCKED','NE']);
const browserKeys=new Set(['PATH','SYSTEMROOT','WINDIR','TEMP','TMP','TMPDIR','USERPROFILE','LOCALAPPDATA','APPDATA',
 'HOME','HOMEDRIVE','HOMEPATH','DISPLAY','XDG_RUNTIME_DIR','LANG','COMSPEC','PROGRAMFILES','PROGRAMFILES(X86)','PROGRAMDATA']);
export function browserEnvironment(env){
 return Object.fromEntries(Object.entries(env).filter(([key])=>browserKeys.has(key.toUpperCase())));
}
export function sanitizeCase(row){
 if(!row||!Reflect.ownKeys(row).every(key=>typeof key==='string')||Reflect.ownKeys(row).sort().join(',')!=='code,diag,id,status'||!caseIds.has(row.id)||
  !statuses.has(row.status)||!(row.code===null||C1_CODES.includes(row.code)))fail('C1_REPORT_INVALID');
 return {id:row.id,status:row.status,code:row.code,diag:row.diag===null?null:validateDiag(row.diag)};
}
export function sanitizeC1Report(value){
 const exact=(v,keys)=>v&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(key=>typeof key==='string')&&Reflect.ownKeys(v).sort().join(',')===[...keys].sort().join(',');
 const keys=['schemaVersion','profile','platform','engineVersion','runnerSha','release','productionExecuted',
  'possibleAppWrites','network','diagSource','cases','code','failureDiagCode','offRequired','timeoutRestoreRequired','firstError'];
 const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
 const version=v=>typeof v==='string'&&/^\d{1,3}\.\d{1,3}\.\d{1,6}$/.test(v);
 if(!exact(value,keys)||value.schemaVersion!==3||!C1_PROFILES.includes(value.profile)||
  !['win32','darwin'].includes(value.platform)||!sha(value.runnerSha)||
  !(value.engineVersion===null||typeof value.engineVersion==='string'&&/^[0-9.]{1,40}$/.test(value.engineVersion))||
  !['productionExecuted','possibleAppWrites','network','timeoutRestoreRequired'].every(key=>typeof value[key]==='boolean')||
  value.offRequired!==true||value.diagSource!=='getter'||!Array.isArray(value.cases)||value.cases.length<1||value.cases.length>7||
  !(value.code===null||C1_CODES.includes(value.code))||!(value.failureDiagCode===null||value.failureDiagCode==='C1_DIAG_UNAVAILABLE'))fail('C1_REPORT_INVALID');
 let release=null;
 if(value.release!==null){
  const r=value.release;
  if(!exact(r,['version','sourceSha','publicTreeSha256'])||!version(r.version)||!sha(r.sourceSha)||
   typeof r.publicTreeSha256!=='string'||!/^[a-f0-9]{64}$/.test(r.publicTreeSha256))fail('C1_REPORT_INVALID');
  release={version:r.version,sourceSha:r.sourceSha,publicTreeSha256:r.publicTreeSha256};
 }
 const firstError=validateFirstError(value.firstError);
 if(firstError&&(firstError.source==='http'?!/^(C1_AUTH_HTTP_|C1_HTTP_FAILURE_)/.test(value.code):value.code!=='C1_RUNTIME_FAILURE'))fail('C1_REPORT_INVALID');
 return {schemaVersion:3,profile:value.profile,platform:value.platform,engineVersion:value.engineVersion,runnerSha:value.runnerSha,
  release,productionExecuted:value.productionExecuted,possibleAppWrites:value.possibleAppWrites,network:value.network,
  diagSource:'getter',cases:value.cases.map(sanitizeCase),code:value.code,failureDiagCode:value.failureDiagCode,
  offRequired:true,timeoutRestoreRequired:value.timeoutRestoreRequired,firstError};
}
export function assertCaseDiagnostics(id,diag,startedAt){
 if(diag.events.length>=200)fail('C1_DIAG_TRUNCATED');
 const allowed=id==='D05-A'?['LOCK_PAGEHIDE']:id.startsWith('D06-')?['LOCK_EXPIRED','LOCK_RELOAD','LOCK_PAGEHIDE']:[];
 for(const event of diag.events.filter(event=>event.at>=startedAt)){
  if(event.code.startsWith('ERROR_')||event.code.startsWith('ADMISSION_')||
    ['VERSION_SKEW','LOGIN_REDIRECT','PUSH_FALLBACK_FAILED'].includes(event.code)||
    event.code.startsWith('LOCK_')&&!allowed.includes(event.code)||
    event.code==='FRAME_ENTER'&&['D02','D04-core'].includes(id))fail('C1_UNEXPECTED_DIAG');
 }
}
export async function writeSanitizedReport(report,env){
 try{
  if(!env.RUNNER_TEMP||!isAbsolute(env.RUNNER_TEMP)||!env.GITHUB_OUTPUT||!isAbsolute(env.GITHUB_OUTPUT))fail('C1_REPORT_WRITE');
  const outputRelative=relative(env.RUNNER_TEMP,env.GITHUB_OUTPUT);
  if(!outputRelative||outputRelative.startsWith('..')||isAbsolute(outputRelative)||
    env.GITHUB_OUTPUT===join(env.RUNNER_TEMP,'c1-qa2-report.json'))fail('C1_REPORT_WRITE');
  const safe=sanitizeC1Report(report);
  await writeFile(join(env.RUNNER_TEMP,'c1-qa2-report.json'),JSON.stringify(safe,null,2)+'\n',{flag:'wx'});
  await appendFile(env.GITHUB_OUTPUT,'report_written=true\n');
 }catch{fail('C1_REPORT_WRITE');}
}
export async function runAuthorizedC1(config,secrets,env){
 const authorized=authorizeC1(env),target=readQa2Secrets(env);
 if(JSON.stringify(authorized)!==JSON.stringify(config)||['uid','email','password','master'].some(key=>target[key]!==secrets[key]))
  fail('C1_EXECUTION_NOT_AUTHORIZED');
 let browser,context,port,network=false,possibleAppWrites=false,publicRelease=null,failure=null,current='SETUP',failureDiagCode=null,firstError=null,startedAt=Date.now(),engineVersion=null;
 const cases=[];
 try{
  network=true;publicRelease=await verifyC1Release(config);
  const {chromium,webkit,devices}=await import('playwright');
  const type=config.profile==='iphone-emulated'?webkit:chromium;
  const launch={headless:true,env:browserEnvironment(env)};
  if(config.profile==='chrome-desktop')launch.channel='chrome';
  browser=await type.launch(launch);
  const version=browser.version();engineVersion=/^[0-9.]{1,40}$/.test(version)?version:null;
  const device=config.profile==='android-emulated'?devices['Pixel 5']:config.profile==='iphone-emulated'?devices['iPhone 13']:{viewport:{width:1280,height:900}};
  if(!device)fail('C1_PLATFORM_UNSUPPORTED');
  context=await browser.newContext({...device,locale:'it-IT',timezoneId:'Europe/Rome',permissions:[],acceptDownloads:false});
  const page=await context.newPage();
  port=await createProductionPort(page,config,secrets);
  possibleAppWrites=true;
  const initial=await port.start();
  assertCaseDiagnostics('SETUP',initial,startedAt);
  cases.push(sanitizeCase({id:'SETUP',status:'PASS',code:null,diag:initial}));
  port.beginCases();
  await runPriorityC1(port,async(id,status,code,provided)=>{
   const diag=provided??await port.collectDiag();
   assertCaseDiagnostics(id,diag,startedAt);
   cases.push(sanitizeCase({id,status,code,diag}));
  },id=>{current=id;startedAt=Date.now();});
 }catch(error){
  failure=port?.failureCode(error)??safeFailure(error);
  port?.freezeErrors(); // No later DIAG/cleanup error may become the first failure.
  console.log(JSON.stringify({signal:'OFF_REQUIRED',code:failure}));
  const diag=await port?.tryFailureDiag()??null;
  if(!diag)failureDiagCode='C1_DIAG_UNAVAILABLE';
  const blocked=C1_AUTH_CODES.includes(failure)||['C1_MFA_BLOCKED','C1_TARGET_DENIED','C1_BOOTSTRAP_MISMATCH','C1_FRAME_NOT_ENTERED','C1_FIXTURE_MISSING','C1_TIMEOUT_BASELINE'].includes(failure);
  cases.push(sanitizeCase({id:current,status:blocked?'BLOCKED':'FAIL',code:failure,diag}));
 }
 finally{
  port?.freezeErrors();firstError=port?.firstError(failure)??null;
  await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
 }
 const report=sanitizeC1Report({
  schemaVersion:3,profile:config.profile,platform:process.platform,engineVersion,runnerSha:config.runnerSha,
  release:publicRelease,productionExecuted:possibleAppWrites,possibleAppWrites,network,
  diagSource:'getter',cases,code:failure,failureDiagCode,offRequired:true,
  timeoutRestoreRequired:port?.timerRestoreRequired()===true,firstError
 });
 // Always OFF after an authorized run, including success; no administrative write is attempted.
 try{await writeSanitizedReport(report,env);}catch{report.code??='C1_REPORT_WRITE';}
 return report;
}
