// Ordinary frame control plane: fixed target, CI-only CLI, no Auth/user-data operations.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';

export const POLICY_NAME = 'projects/appcodici-password/databases/(default)/documents/vaultFramePolicy/current';
export const POLICY_URL = 'https://firestore.googleapis.com/v1/' + POLICY_NAME;
export const RULE_RELEASE_URL = 'https://firebaserules.googleapis.com/v1/projects/appcodici-password/releases/cloud.firestore';
const root = fileURLToPath(new URL('../', import.meta.url));
const exact = (object, fields) => object && typeof object === 'object' && !Array.isArray(object) &&
  Object.keys(object).length === fields.length && fields.every(key => Object.hasOwn(object, key));
const integer = (field, value) => exact(field, ['integerValue']) && field.integerValue === String(value);
const boolean = field => exact(field, ['booleanValue']) && typeof field.booleanValue === 'boolean';
const timestamp = value => typeof value === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,9})?Z$/.test(value) && Number.isFinite(Date.parse(value));
export const ordinaryPolicyFields = enabled => {
  assert.equal(typeof enabled, 'boolean');
  return {schemaVersion:{integerValue:'2'},version:{integerValue:'2'},enabled:{booleanValue:enabled}};
};
export function storedPolicy(document) {
  if (!document || document.name !== POLICY_NAME || !timestamp(document.updateTime) ||
      Object.keys(document).some(key => !['name','fields','createTime','updateTime'].includes(key))) return null;
  const f = document.fields;
  if (exact(f,['schemaVersion','version','enabled']) && integer(f.schemaVersion,2) && integer(f.version,2) && boolean(f.enabled))
    return {kind:'ordinary',enabled:f.enabled.booleanValue,updateTime:document.updateTime};
  if (exact(f,['schemaVersion','version','uid','enabled','expiresAt']) && integer(f.schemaVersion,1) && integer(f.version,1) &&
      exact(f.uid,['stringValue']) && typeof f.uid.stringValue === 'string' && f.uid.stringValue.length > 0 &&
      boolean(f.enabled) && exact(f.expiresAt,['timestampValue']) && timestamp(f.expiresAt.timestampValue))
    return {kind:'pilot',enabled:f.enabled.booleanValue,updateTime:document.updateTime};
  return null;
}
export function assertPolicyCi(environment, commit, git = (...args) => execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim(), mode = 'enable') {
  assert.ok(['enable','disable'].includes(mode));
  assert.equal(environment.GITHUB_ACTIONS,'true');
  assert.equal(environment.GITHUB_EVENT_NAME,'workflow_dispatch');
  assert.equal(environment.GITHUB_REPOSITORY,'Diego-Stack-ai/App-Codici-Password');
  assert.equal(environment.GITHUB_REF,'refs/heads/master');
  assert.equal(environment.GITHUB_WORKFLOW_REF,'Diego-Stack-ai/App-Codici-Password/.github/workflows/vault-frame-ordinary-policy.yml@refs/heads/master');
  assert.match(commit,/^[0-9a-f]{40}$/);
  assert.equal(environment.GITHUB_SHA,commit);
  assert.equal(git('rev-parse','HEAD'),commit);
  assert.equal(git('status','--porcelain'),'');
  if (mode === 'enable') assert.equal(git('ls-remote','origin','refs/heads/master').split(/\s+/)[0],commit);
}
export async function verifyPublishedRules(request, expectedSource) {
  const release = await request('GET',RULE_RELEASE_URL);
  assert.equal(release.status,200);
  const name = release.data?.rulesetName;
  assert.match(name,/^projects\/appcodici-password\/rulesets\/[A-Za-z0-9_-]+$/);
  const ruleset = await request('GET','https://firebaserules.googleapis.com/v1/' + name);
  assert.equal(ruleset.status,200);
  const files = ruleset.data?.source?.files;
  assert.ok(Array.isArray(files) && files.length === 1 && files[0].name === 'firestore.rules');
  assert.equal(files[0].content.replace(/\r\n/g,'\n'),expectedSource.replace(/\r\n/g,'\n'));
}
export async function manageOrdinaryPolicy({mode, request, verifyRelease, beforeWrite = () => {}}) {
  assert.ok(['enable','disable'].includes(mode));
  // Disable is always independent of Hosting. Enable requires deployed bytes AND Rules.
  if (mode === 'enable') await verifyRelease('initial');
  const read = async () => {
    const response = await request('GET',POLICY_URL);
    if (response.status === 404) return null;
    assert.equal(response.status,200);
    assert.ok(storedPolicy(response.data),'Unrecognized policy; no write');
    return response.data;
  };
  let document = await read(), writes = 0, ownWriteTime = null;
  const patch = async (fields, prior, intent = mode) => {
    beforeWrite(intent);
    const query = new URLSearchParams();
    if (prior) query.set('currentDocument.updateTime',prior.updateTime);
    else query.set('currentDocument.exists','false');
    // Explicit deletion of legacy fields; no caller-controlled masks or paths.
    for (const field of ['schemaVersion','version','enabled','uid','expiresAt']) query.append('updateMask.fieldPaths',field);
    const response = await request('PATCH',POLICY_URL + '?' + query,{name:POLICY_NAME,fields});
    writes++;
    assert.equal(response.status,200);
    assert.ok(storedPolicy(response.data));
    ownWriteTime = response.data.updateTime;
    const reread = await read();
    assert.equal(reread?.updateTime,ownWriteTime,'Concurrent policy update; do not retry');
    return reread;
  };
  try {
    if (!document) {
      if (mode === 'disable') return {mode,enabled:false,writes,missing:true};
      document = await patch(ordinaryPolicyFields(false),null);
    }
    const prior = storedPolicy(document);
    if (mode === 'enable') {
      assert.ok(prior.kind === 'ordinary' || prior.enabled === false,'Live pilot must be disabled first');
      if (prior.kind === 'ordinary' && prior.enabled) {
        await verifyRelease('after-enable');
        const final = await read();
        assert.ok(storedPolicy(final)?.kind === 'ordinary' && storedPolicy(final).enabled);
        assert.equal(final.updateTime,document.updateTime,'Concurrent policy update after proof');
        return {mode,enabled:true,writes};
      }
      await verifyRelease('before-enable');
      document = await patch(ordinaryPolicyFields(true),document);
      await verifyRelease('after-enable');
      const final = await read();
      assert.ok(storedPolicy(final)?.kind === 'ordinary' && storedPolicy(final).enabled);
      assert.equal(final.updateTime,document.updateTime,'Concurrent policy update after proof');
      document = final;
    } else if (prior.enabled) {
      // A legacy pilot may only be switched OFF; retain its private binding.
      const fields = prior.kind === 'pilot' ? {...document.fields,enabled:{booleanValue:false}} : ordinaryPolicyFields(false);
      document = await patch(fields,document);
    }
    assert.equal(storedPolicy(document).enabled,mode === 'enable');
    return {mode,enabled:mode === 'enable',writes};
  } catch {
    // Roll back only the exact write owned by this operation. A conflict is never retried.
    let offVerified = false;
    if (mode === 'enable' && ownWriteTime) {
      try {
        const current = await read();
        if (current?.updateTime === ownWriteTime && storedPolicy(current)?.kind === 'ordinary' && storedPolicy(current).enabled)
          offVerified = storedPolicy(await patch(ordinaryPolicyFields(false),current,'disable')).enabled === false;
        else offVerified = storedPolicy(current)?.enabled === false;
      } catch { /* State remains uncertain; the CLI reports OFF_REQUIRED. */ }
    }
    const error = Error(offVerified ? 'C2_POLICY_FAILED_OFF_VERIFIED' : 'C2_POLICY_FAILED_OFF_REQUIRED');
    error.code = error.message;
    throw error;
  }
}
async function main(args) {
  assert.equal(args.length,4);
  assert.equal(args[0],'--mode');assert.equal(args[2],'--commit');
  const mode=args[1], commit=args[3];
  assert.ok(['enable','disable'].includes(mode));
  const fence = (intent = mode) => assertPolicyCi(process.env,commit,undefined,intent);
  fence(); // Before credentials are accessed or any request is made.
  assert.ok(process.env.FIREBASE_TOKEN);
  const {getAccessToken} = createRequire(import.meta.url)('firebase-tools/lib/auth');
  const credentials = await getAccessToken(process.env.FIREBASE_TOKEN,['https://www.googleapis.com/auth/cloud-platform']);
  assert.ok(typeof credentials.access_token === 'string' && credentials.access_token.length > 0);
  process.stdout.write('::add-mask::' + credentials.access_token + '\n');
  const request = async (method,url,body) => {
    assert.ok((method === 'GET' && (url === POLICY_URL || url === RULE_RELEASE_URL ||
      /^https:\/\/firebaserules\.googleapis\.com\/v1\/projects\/appcodici-password\/rulesets\/[A-Za-z0-9_-]+$/.test(url))) ||
      (method === 'PATCH' && url.startsWith(POLICY_URL + '?')));
    const response = await fetch(url,{method,redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer ' + credentials.access_token,'Content-Type':'application/json'},
      ...(body ? {body:JSON.stringify(body)} : {})});
    const raw = await response.text();assert.ok(raw.length <= 2_000_000);
    return {status:response.status,data:raw ? JSON.parse(raw) : null};
  };
  const verifyRelease = async stage => {
    if (stage === 'initial') {
      execFileSync(process.execPath,[resolve(root,'scripts/release-manifest.mjs'),'--write','--commit',commit,'--require-clean'],{cwd:root,stdio:'pipe'});
      execFileSync(process.execPath,[resolve(root,'scripts/release-manifest.mjs'),'--commit',commit,'--require-clean',
        '--verify-url','https://appcodici-password.web.app','--retries','3','--delay-ms','3000'],{cwd:root,stdio:'pipe'});
    }
    const expected = readFileSync(resolve(root,'Frontend/public/release-manifest.json'));
    const response = await fetch('https://appcodici-password.web.app/release-manifest.json',
      {redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
    assert.equal(response.status,200);
    const actual = Buffer.from(await response.arrayBuffer());
    assert.equal(createHash('sha256').update(actual).digest('hex'),createHash('sha256').update(expected).digest('hex'));
    await verifyPublishedRules(request,readFileSync(resolve(root,'firestore.rules'),'utf8'));
  };
  const result = await manageOrdinaryPolicy({mode,request,verifyRelease,beforeWrite:fence});
  // Closed non-identifying receipt. No policy body, credentials, UID or provider error.
  console.log(JSON.stringify({schemaVersion:1,commit,...result,personalLeaseMs:300000}));
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2)).catch(error => {
    console.error(error?.code === 'C2_POLICY_FAILED_OFF_VERIFIED' ? error.code : 'C2_POLICY_FAILED_OFF_REQUIRED');
    process.exitCode=1;
  });
