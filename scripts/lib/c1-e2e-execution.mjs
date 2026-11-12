import {C1_PROFILES,fail} from './c1-e2e-contract.mjs';
export const C1_ORIGIN='https://appcodici-password.web.app';
export const C1_PRIORITY_CASES=Object.freeze(['D02','D04-core','D05-A','D06-1','D06-3','D08-local']);
const sha=value=>typeof value==='string'&&/^[a-f0-9]{40}$/.test(value);
export function authorizeC1(env,platform=process.platform){
  if(env.GITHUB_ACTIONS!=='true'||env.GITHUB_EVENT_NAME!=='workflow_dispatch'||
    env.GITHUB_REPOSITORY!=='Diego-Stack-ai/App-Codici-Password'||env.GITHUB_REF!=='refs/heads/master'||
    !sha(env.GITHUB_SHA)||env.C1_REVIEWED_RUNNER_SHA!==env.GITHUB_SHA||
    !/^[A-Za-z0-9-]{1,39}$/.test(env.C1_ALLOWED_OPERATOR||'')||env.GITHUB_ACTOR!==env.C1_ALLOWED_OPERATOR||
    !/^https:\/\/github\.com\/Diego-Stack-ai\/App-Codici-Password\/(pull|issues)\/\d+#issuecomment-\d+$/.test(env.C1_EXECUTION_ORDER||'')||
    env.C1_PREFLIGHT_CONFIRMED!=='true'||env.C1_EFFECTS_CONFIRMED!=='true'||env.C1_ACCEPT_D02_LIMIT!=='true')
    fail('C1_EXECUTION_NOT_AUTHORIZED');
  if(!C1_PROFILES.includes(env.C1_PROFILE)||!sha(env.C1_RELEASE_SHA)||
    !/^\d{1,3}\.\d{1,3}\.\d{1,6}$/.test(env.C1_RELEASE_VERSION||''))fail('C1_OPTIONS_INVALID');
  if(platform!==(env.C1_PROFILE==='iphone-emulated'?'darwin':'win32'))fail('C1_PLATFORM_UNSUPPORTED');
  if(['DEBUG','PWDEBUG','NODE_OPTIONS','FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST',
    'FIREBASE_APPCHECK_DEBUG_TOKEN'].some(k=>env[k]))fail('C1_EXECUTION_NOT_AUTHORIZED');
  return Object.freeze({runnerSha:env.GITHUB_SHA,releaseSha:env.C1_RELEASE_SHA,version:env.C1_RELEASE_VERSION,profile:env.C1_PROFILE});
}
export function readQa2Secrets(env){
  if(env.C1_QA2_EMAIL!=='codex.qa2@appcodici-password.invalid'||
    !/^[A-Za-z0-9_-]{1,128}$/.test(env.C1_QA2_EXPECTED_UID||'')||
    typeof env.C1_QA2_PASSWORD!=='string'||env.C1_QA2_PASSWORD.length<16||
    typeof env.C1_QA2_MASTER_PASSWORD!=='string'||env.C1_QA2_MASTER_PASSWORD.length<16||
    env.C1_QA2_MASTER_PASSWORD===env.C1_QA2_PASSWORD)fail('C1_TARGET_DENIED');
  return {email:env.C1_QA2_EMAIL,uid:env.C1_QA2_EXPECTED_UID,password:env.C1_QA2_PASSWORD,master:env.C1_QA2_MASTER_PASSWORD};
}
export async function verifyC1Release(config,fetcher=fetch){
  let response,manifest;
  try{
    response=await fetcher(C1_ORIGIN+'/release-manifest.json',{redirect:'error',cache:'no-store',
      headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    if(!response.ok)fail('C1_RELEASE_MISMATCH');
    const text=await response.text();
    if(text.length>2000000)fail('C1_RELEASE_MISMATCH');
    manifest=JSON.parse(text);
  }catch{fail('C1_RELEASE_MISMATCH');}
  if(manifest.schemaVersion!==2||manifest.sourceDirty!==false||manifest.appVersion!==config.version||
    manifest.sourceCommit!==config.releaseSha||!sha(manifest.sourceCommit)||
    !/^[a-f0-9]{64}$/.test(manifest.publicTree?.sha256||'')||
    !Number.isSafeInteger(manifest.publicTree?.fileCount)||manifest.publicTree.fileCount<1)fail('C1_RELEASE_MISMATCH');
  return {version:manifest.appVersion,sourceSha:manifest.sourceCommit,publicTreeSha256:manifest.publicTree.sha256};
}
