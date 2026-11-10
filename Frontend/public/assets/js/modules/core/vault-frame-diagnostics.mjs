import {FRAME_ROUTES} from './vault-frame-policy.mjs';
export const FRAME_DIAG_OPTION = 'app_frame_diag_consent_v1', FRAME_DIAG_EVENTS = 'app_frame_diag_events_v1';
export const FRAME_DIAG_MAX = 200, FRAME_DIAG_TTL = 7 * 86400000;
export const FRAME_DIAG_CODES = Object.freeze([
  'FRAME_ENTER','FRAME_EXIT','ADMISSION_DENIED','ADMISSION_EXPIRED','VERSION_SKEW','LOGIN_REDIRECT',
  'PUSH_ACK_RECEIVED','PUSH_FALLBACK_REQUESTED','PUSH_FALLBACK_RESOLVED','PUSH_FALLBACK_FAILED',
  'LOCK_EXPIRED','LOCK_IDENTITY_CHANGED','LOCK_AUTH_REVOKED','LOCK_POLICY_REVOKED','LOCK_ADMISSION_DENIED',
  'LOCK_ADMISSION_UNAVAILABLE','LOCK_RESUME_DENIED','LOCK_ROUTE_DENIED','LOCK_VERSION_MISMATCH',
  'LOCK_PAGEHIDE','LOCK_FREEZE','LOCK_BFCACHE','LOCK_RELOAD','LOCK_DISPOSE','LOCK_CHILD_REQUEST','LOCK_EXIT','LOCK_OTHER',
  'ERROR_FRAME_MESSAGE','ERROR_FRAME_OPERATION','ERROR_STORAGE_UNAVAILABLE'
]);
const codes = new Set(FRAME_DIAG_CODES);
const pages = new Set(['app.html','login.html','index.html','imposta_nuova_password.html',...Object.keys(FRAME_ROUTES).map(name=>name+'.html')]);
const version = value => typeof value === 'string' && /^v?\d{1,3}\.\d{1,3}\.\d{1,6}$/.test(value);
const exact = (value, names) => value && typeof value === 'object' && !Array.isArray(value) && Reflect.ownKeys(value).every(key=>typeof key==='string') && Reflect.ownKeys(value).sort().join(',') === [...names].sort().join(',');
export function frameLockCode(reason) {
  const map = {'expired':'LOCK_EXPIRED','identity-changed':'LOCK_IDENTITY_CHANGED','identity-unavailable':'LOCK_IDENTITY_CHANGED',
    'auth-revoked':'LOCK_AUTH_REVOKED','policy-revoked':'LOCK_POLICY_REVOKED','admission-denied':'LOCK_ADMISSION_DENIED',
    'push-admission-denied':'LOCK_ADMISSION_DENIED','admission-revoked':'LOCK_ADMISSION_DENIED','admission-unavailable':'LOCK_ADMISSION_UNAVAILABLE',
    'resume-denied':'LOCK_RESUME_DENIED','route-denied':'LOCK_ROUTE_DENIED','history-denied':'LOCK_ROUTE_DENIED',
    'version-mismatch':'LOCK_VERSION_MISMATCH','pagehide':'LOCK_PAGEHIDE','freeze':'LOCK_FREEZE','bfcache':'LOCK_BFCACHE',
    'reload':'LOCK_RELOAD','dispose':'LOCK_DISPOSE','child-request':'LOCK_CHILD_REQUEST','child-revoked':'LOCK_CHILD_REQUEST',
    'exit':'LOCK_EXIT','message-failed':'ERROR_FRAME_MESSAGE','preference-unavailable':'LOCK_ADMISSION_UNAVAILABLE','preference-auth-denied':'LOCK_AUTH_REVOKED'};
  return Object.hasOwn(map, reason) ? map[reason] : 'LOCK_OTHER';
}
export function validFrameDiagnosticEvent(event, now) {
  return !!(exact(event,['code','at','version','page','environment']) && codes.has(event.code) && version(event.version) && pages.has(event.page) &&
    ['browser','PWA'].includes(event.environment) && Number.isSafeInteger(event.at) && event.at > 0 && event.at <= now && now-event.at < FRAME_DIAG_TTL);
}
export function createFrameDiagnostics({storage, now=Date.now, appVersion, context=()=>({ready:false}), nonce=()=>crypto.randomUUID()}={}) {
  let available = true;
  const get = key => {try {return storage.getItem(key);} catch {available=false; return null;}};
  const drop = key => {try {if (get(key)!==null) storage.removeItem(key);} catch {available=false;}};
  function consent() {
    const ctx=context(); if (!ctx.ready || !Number.isSafeInteger(ctx.revision)) return null;
    try {const value=JSON.parse(get(FRAME_DIAG_OPTION)||'null');
      return exact(value,['generation','revision']) && typeof value.generation==='string' && /^[\w-]{16,80}$/.test(value.generation) && value.revision===ctx.revision ? value : null;
    } catch {return null;}
  }
  const write = (key,value) => {try {storage.setItem(key,JSON.stringify(value));return true;} catch {available=false;return false;}};
  function events(prune=true) {
    const option=consent(); if(!option)return [];
    try {const raw=get(FRAME_DIAG_EVENTS), stored=JSON.parse(raw||'null');
      if(!stored)return [];
      if(!exact(stored,['generation','events']) || stored.generation!==option.generation || !Array.isArray(stored.events) || stored.events.length>FRAME_DIAG_MAX)return [];
      // Foreign fields/codes are rejected, never cleaned into apparently trusted events.
      const recent=[];
      for(const item of stored.events){
        if(!exact(item,['code','at','version','page','environment']) || !codes.has(item.code) || !version(item.version) || !pages.has(item.page) ||
          !['browser','PWA'].includes(item.environment) || !Number.isSafeInteger(item.at) || item.at<=0 || item.at>now())return [];
        if(now()-item.at<FRAME_DIAG_TTL)recent.push({...item});
      }
      if(prune&&recent.length!==stored.events.length)write(FRAME_DIAG_EVENTS,{generation:option.generation,events:recent});
      return recent;
    } catch {return [];}
  }
  return Object.freeze({
    enabled:()=>!!consent(), available:()=>available,
    setEnabled(enabled) {
      if(typeof enabled!=='boolean')return false;
      if(!enabled){drop(FRAME_DIAG_OPTION);drop(FRAME_DIAG_EVENTS);return true;}
      const ctx=context(); if(!ctx.ready||!Number.isSafeInteger(ctx.revision)||!version(appVersion))return false;
      const generation=nonce();if(typeof generation!=='string'||!/^[\w-]{16,80}$/.test(generation))return false;
      drop(FRAME_DIAG_EVENTS);
      return write(FRAME_DIAG_OPTION,{generation,revision:ctx.revision});
    },
    clear(){const option=consent();drop(FRAME_DIAG_EVENTS);if(option)write(FRAME_DIAG_OPTION,{generation:nonce(),revision:option.revision});},
    events,
    record(event, expectedConsent) {
      const option=consent(); if(!option || !validFrameDiagnosticEvent(event,now()) || event.version!==appVersion)return false;
      if(expectedConsent!==undefined&&get(FRAME_DIAG_OPTION)!==expectedConsent)return false;
      const values=events(false); values.push({...event});
      return write(FRAME_DIAG_EVENTS,{generation:option.generation,events:values.slice(-FRAME_DIAG_MAX)});
    }
  });
}
