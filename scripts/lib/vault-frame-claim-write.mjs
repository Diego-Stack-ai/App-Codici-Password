import {CLAIM_PROJECT,FRAME_CLAIM} from './vault-frame-claim.mjs';

const endpoint = 'https://identitytoolkit.googleapis.com/v1/projects/'+CLAIM_PROJECT+'/accounts:update';
// Admin SDK Auth HTTP retries mutations by default. Use exactly one fetch for
// this fixed administrative endpoint instead. No retry or redirect is followed.
// The caller must hold the exclusive-writer window; this is not a CAS API.
export function singleAttemptClaimWriter({credential,fetchImpl = globalThis.fetch}) {
  return async (uid,claims)=>{
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || !claims || claims[FRAME_CLAIM] !== true ||
        Buffer.byteLength(JSON.stringify(claims),'utf8')>1000) throw Error('WRITE_FAILED');
    const token = await credential.getAccessToken();
    if (typeof token?.access_token !== 'string' || !token.access_token || /[\r\n]/.test(token.access_token)) throw Error('WRITE_FAILED');
    const response = await fetchImpl(endpoint,{
      method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+token.access_token},
      body:JSON.stringify({localId:uid,customAttributes:JSON.stringify(claims)})
    });
    try { await response.body?.cancel(); } catch {}
    if (response.status !== 200) throw Error('WRITE_FAILED');
  };
}
