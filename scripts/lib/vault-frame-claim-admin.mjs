import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import {CLAIM_PROJECT,ClaimPreparationError} from './vault-frame-claim.mjs';
import {singleAttemptClaimWriter} from './vault-frame-claim-write.mjs';

export const CLAIM_SERVICE_ACCOUNT = 'vault-frame-canary-operator@'+CLAIM_PROJECT+'.iam.gserviceaccount.com';
export const IMPERSONATION_URL = 'https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/'+CLAIM_SERVICE_ACCOUNT+':generateAccessToken';
export const POLICY_READ_URL = 'https://firestore.googleapis.com/v1/projects/'+CLAIM_PROJECT+'/databases/(default)/documents/vaultFramePolicy/current';
const invalid = () => { throw new ClaimPreparationError('ADC_INVALID'); };
export function validateImpersonatedAdc(data) {
  const keys=['type','service_account_impersonation_url','source_credentials','delegates','quota_project_id','universe_domain'];
  if (!data || Object.keys(data).some(key=>!keys.includes(key)) || data.type !== 'impersonated_service_account' ||
      data.service_account_impersonation_url !== IMPERSONATION_URL ||
      (data.delegates != null && (!Array.isArray(data.delegates) || data.delegates.length)) ||
      (data.universe_domain != null && data.universe_domain !== 'googleapis.com') ||
      (data.quota_project_id != null && data.quota_project_id !== '')) invalid();
  const source=data.source_credentials;
  const sourceKeys=['type','client_id','client_secret','refresh_token','universe_domain','account','quota_project_id','rapt_token'];
  if (!source || Object.keys(source).some(key=>!sourceKeys.includes(key)) || source.type !== 'authorized_user' ||
      ['client_id','client_secret','refresh_token'].some(key=>typeof source[key] !== 'string' || !source[key] || /[\r\n]/.test(source[key])) ||
      (source.universe_domain != null && source.universe_domain !== 'googleapis.com') ||
      (source.quota_project_id != null && source.quota_project_id !== '')) invalid();
  return {type:'impersonated_service_account',targetServiceAccountVerified:true};
}
async function readImpersonatedAdc({env=process.env,read=readFile}={}) {
  const filename=env.GOOGLE_APPLICATION_CREDENTIALS || (env.APPDATA && path.join(env.APPDATA,'gcloud/application_default_credentials.json'));
  if (!filename || !path.isAbsolute(filename)) invalid();
  try { const data=JSON.parse(await read(filename,'utf8'));validateImpersonatedAdc(data);return data; } catch { invalid(); }
}
export function policyRestReader({credential,fetchImpl=globalThis.fetch}) {
  return async()=>{
    const token=await credential.getAccessToken();
    if (typeof token?.access_token !== 'string' || !token.access_token || /[\r\n]/.test(token.access_token)) throw Error('POLICY_READ_FAILED');
    const response=await fetchImpl(POLICY_READ_URL,{method:'GET',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{Authorization:'Bearer '+token.access_token}});
    if (response.status===404) { try { await response.body?.cancel(); } catch {} return {exists:false,data:undefined,revision:''}; }
    if (response.status!==200) throw Error('POLICY_READ_FAILED');
    const payload=await response.json(),data={};
    for (const [key,value] of Object.entries(payload.fields || {})) {
      if (key==='schemaVersion' || key==='version') data[key]=typeof value.integerValue==='string' && /^-?\d+$/.test(value.integerValue) ? Number(value.integerValue) : null;
      else if (key==='uid') data[key]=typeof value.stringValue==='string' ? value.stringValue : null;
      else if (key==='enabled') data[key]=typeof value.booleanValue==='boolean' ? value.booleanValue : null;
      else if (key==='expiresAt') {
        const millis=typeof value.timestampValue==='string' ? Date.parse(value.timestampValue) : NaN;
        data[key]=Number.isFinite(millis) ? {toMillis:()=>millis} : null;
      } else data[key]=null; // Preserve unknown keys so the policy model rejects them.
    }
    return {exists:true,data,revision:typeof payload.updateTime==='string' ? payload.updateTime : ''};
  };
}
export async function createVaultFrameClaimAdmin({env=process.env,
  adminRequire=createRequire(new URL('../../functions/package.json',import.meta.url)),
  fetchImpl=globalThis.fetch,adcRead=readFile}={}) {
  const adc=await readImpersonatedAdc({env,read:adcRead});
  if (['FIREBASE_AUTH_EMULATOR_HOST','FIRESTORE_EMULATOR_HOST','GOOGLE_CLOUD_QUOTA_PROJECT'].some(key=>env[key])) throw new ClaimPreparationError('LOCAL_CONFIG_INVALID');
  try {
    const {initializeApp,deleteApp}=adminRequire('firebase-admin/app');
    const {getAuth}=adminRequire('firebase-admin/auth');
    const {GoogleAuth}=adminRequire('google-auth-library');
    // Pin the once-validated JSON in memory. Never let Admin rediscover a
    // different ADC through environment aliases, CLOUDSDK_CONFIG or SDK caches.
    const googleAuth=new GoogleAuth({credentials:adc,projectId:CLAIM_PROJECT,
      scopes:['https://www.googleapis.com/auth/cloud-platform','https://www.googleapis.com/auth/identitytoolkit']});
    const client=await googleAuth.getClient();
    const credential={getAccessToken:async()=>{
      const result=await client.getAccessToken();
      if (typeof result.token!=='string' || !result.token || /[\r\n]/.test(result.token) ||
          !Number.isFinite(client.credentials.expiry_date) || client.credentials.expiry_date<=Date.now()) throw Error('TOKEN_UNAVAILABLE');
      return {access_token:result.token,expires_in:Math.max(1,Math.floor((client.credentials.expiry_date-Date.now())/1000))};
    }};
    const app=initializeApp({projectId:CLAIM_PROJECT,credential},'vault-frame-claim-once');
    const reader=getAuth(app);
    return {auth:{getUser:uid=>reader.getUser(uid),setCustomUserClaims:singleAttemptClaimWriter({credential,fetchImpl})},
      readPolicy:policyRestReader({credential,fetchImpl}),close:()=>deleteApp(app)};
  } catch { throw new ClaimPreparationError('ADAPTER_UNAVAILABLE'); }
}
