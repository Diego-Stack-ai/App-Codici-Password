import {FRAME_DIAG_CODES, validFrameDiagnosticEvent, FRAME_DIAG_MAX} from '../../Frontend/public/assets/js/modules/core/vault-frame-diagnostics.mjs';

export const C1_CASES = Object.freeze(['D02-core', 'D04-core', 'D05-A']);
export const C1_PROFILES = Object.freeze(['chrome-desktop', 'android-emulated', 'iphone-emulated']);
export const C1_AUTH_CODES = Object.freeze([
  'C1_AUTH_HTTP_APPCHECK', 'C1_AUTH_HTTP_IDENTITY', 'C1_AUTH_HTTP_FIRESTORE', 'C1_AUTH_HTTP_OTHER',
  'C1_AUTH_EMAIL_UNVERIFIED', 'C1_AUTH_NOT_READY_LOGIN', 'C1_AUTH_NOT_READY_ROUTE',
  'C1_AUTH_NOT_READY_RESOURCE', 'C1_AUTH_NOT_READY_USER', 'C1_LANGUAGE_DIALOG'
]);
const httpFailureByAuth = Object.freeze({
  C1_AUTH_HTTP_APPCHECK: 'C1_HTTP_FAILURE_APPCHECK',
  C1_AUTH_HTTP_IDENTITY: 'C1_HTTP_FAILURE_IDENTITY',
  C1_AUTH_HTTP_FIRESTORE: 'C1_HTTP_FAILURE_FIRESTORE',
  C1_AUTH_HTTP_OTHER: 'C1_HTTP_FAILURE_OTHER'
});
export const C1_HTTP_FAILURE_CODES = Object.freeze(Object.values(httpFailureByAuth));
export const C1_CODES = Object.freeze([
  'C1_LOCAL_ONLY', 'C1_OPTIONS_INVALID', 'C1_TARGET_DENIED', 'C1_REPORT_INVALID',
  'C1_CONTINUITY_BROKEN', 'C1_DESTINATION_WRONG', 'C1_UNLOCK_MISSING',
  'C1_UNLOCK_REPEATED', 'C1_TECHNICAL', 'C1_PRODUCTION_NOT_IMPLEMENTED',
  'C1_EXECUTION_NOT_AUTHORIZED','C1_PLATFORM_UNSUPPORTED','C1_RELEASE_MISMATCH',
  ...C1_AUTH_CODES,...C1_HTTP_FAILURE_CODES,'C1_MFA_BLOCKED','C1_BOOTSTRAP_MISMATCH','C1_READINESS',
  'C1_NETWORK_FAILURE','C1_HTTP_FAILURE','C1_RUNTIME_FAILURE','C1_FRAME_NOT_ENTERED','C1_MODAL_UNEXPECTED',
  'C1_DIAG_UNAVAILABLE','C1_CONFIG_DOC_ROUTE_UNAVAILABLE','C1_TIMEOUT_NOT_LOCKED',
  'C1_TIMEOUT_BASELINE','C1_LOGOUT_FAILED','C1_REPORT_WRITE','C1_FIXTURE_MISSING','C1_ROUTE_UNAVAILABLE',
  'C1_UNEXPECTED_DIAG','C1_DIAG_TRUNCATED'
]);
// Only exact service hosts select a fixed code. Never retain/return the URL,
// credentials, path, query, response body or a provider's free error message.
export function authHttpFailureCode(url) {
  let host;
  try { host = typeof url === 'string' ? new URL(url).hostname : ''; } catch { host = ''; }
  switch (host) {
    case 'content-firebaseappcheck.googleapis.com':
    case 'firebaseappcheck.googleapis.com': return 'C1_AUTH_HTTP_APPCHECK';
    case 'identitytoolkit.googleapis.com':
    case 'securetoken.googleapis.com': return 'C1_AUTH_HTTP_IDENTITY';
    case 'firestore.googleapis.com': return 'C1_AUTH_HTTP_FIRESTORE';
    default: return 'C1_AUTH_HTTP_OTHER';
  }
}
export function httpFailureCode(status, url) {
  if (!Number.isInteger(status) || status < 400) return null;
  const authCode = authHttpFailureCode(url);
  return status === 401 || status === 403 ? authCode : httpFailureByAuth[authCode];
}
export function fail(code) {
  throw new Error(C1_CODES.includes(code) ? code : 'C1_TECHNICAL');
}
const exact = (value, keys) => value && Object.getPrototypeOf(value) === Object.prototype &&
  Reflect.ownKeys(value).every(key=>typeof key==='string')&&Reflect.ownKeys(value).sort().join(',') === [...keys].sort().join(',');

export const C1_ERROR_PHASES=Object.freeze(['LOGIN_READY','LOGIN_SUBMIT','AUTH_WAIT','FRAME_ENTRY','UNLOCK','SETTINGS','DIAG_OPT_IN','CASE']);
export const C1_ERROR_TAGS=Object.freeze(['Titan-Lock','LOGIN','PWA','BLINDA','V3.1-DEBUG','V3.1-EXCEPTION',
 'NEW-PASS','REGISTER','RESET','Account note','V3.1-ERROR','CRYPTO-AUDIT','SECURITY-AUDIT','HOME',
 'ACCOUNTS','Accounts','AreaPrivata','addPhone','editPhone','addEmail','editEmail','Address','Utility',
 'Phone','Email','Doc','FRONTEND-ERROR','SHARED CREDENTIALS','COMPANY AREA','SETTINGS','PUSH TEST','PUSH',
 'RESOURCE','OTHER']);
const errorHosts=Object.freeze(['appcheck','identity','firestore','other']);
export const C1_ERROR_KINDS=Object.freeze(['CSP','CORS','PERMISSIONS_POLICY','FIREBASE_SDK','UNCAUGHT_PROMISE','OTHER']);
export const C1_ERROR_ORIGINS=Object.freeze(['app','google','firebase','none','other']);
export const C1_FIREBASE_COMPONENTS=Object.freeze(['app-check','auth','firestore','messaging','installations','app']);
export const C1_GOOGLE_PATHS=Object.freeze(['recaptcha-api','recaptcha-frame','gstatic-recaptcha','other']);
export const C1_THIRD_PARTY_CONSOLE_MAX=20;
const googleLocations=new Set(['www.google.com','www.gstatic.com','www.recaptcha.net','recaptcha.google.com']);
const firebaseLocations=new Set(['content-firebaseappcheck.googleapis.com','firebaseappcheck.googleapis.com',
 'identitytoolkit.googleapis.com','securetoken.googleapis.com','firestore.googleapis.com','firebase.googleapis.com',
 'firebaseinstallations.googleapis.com','fcmregistrations.googleapis.com','fcm.googleapis.com']);
export function errorHostCategory(url){
 return authHttpFailureCode(url).slice('C1_AUTH_HTTP_'.length).toLowerCase();
}
// Classify only the location supplied by the browser API, never URLs in text.
// This is an observation, not proof of the publisher or the cause.
export function errorOriginCategory(value){
 if(value===null||value===undefined||value==='')return 'none';
 if(typeof value!=='string')return 'other';
 try{
  const url=new URL(value);
  if(url.protocol!=='https:'||url.username||url.password||url.port)return 'other';
  if(url.origin==='https://appcodici-password.web.app')return 'app';
  if(firebaseLocations.has(url.hostname)||url.hostname==='www.gstatic.com'&&url.pathname.startsWith('/firebasejs/'))return 'firebase';
  if(googleLocations.has(url.hostname))return 'google';
 }catch{/* Missing or malformed locations never enter the report. */}
 return 'other';
}
function recaptchaLocationCategory(value){
 if(errorOriginCategory(value)!=='google')return 'other';
 const {hostname,pathname}=new URL(value);
 if(pathname.includes('%'))return 'other';
 if(hostname==='www.gstatic.com')return pathname.startsWith('/recaptcha/')&&pathname.length>'/recaptcha/'.length?'gstatic-recaptcha':'other';
 if(!['www.google.com','www.recaptcha.net','recaptcha.google.com'].includes(hostname))return 'other';
 if(['/recaptcha/api.js','/recaptcha/enterprise.js'].includes(pathname))return 'recaptcha-api';
 return ['/recaptcha/api2/','/recaptcha/enterprise/'].some(prefix=>pathname.startsWith(prefix)&&pathname.length>prefix.length)?'recaptcha-frame':'other';
}
export function validateThirdPartyConsole(value){
 if(!exact(value,['count','firstPhase','googlePath'])||!Number.isInteger(value.count)||value.count<0||
  value.count>C1_THIRD_PARTY_CONSOLE_MAX||
  (value.count===0?value.firstPhase!==null||value.googlePath!==null:
   !C1_ERROR_PHASES.includes(value.firstPhase)||!C1_GOOGLE_PATHS.slice(0,3).includes(value.googlePath)))fail('C1_REPORT_INVALID');
 return {count:value.count,firstPhase:value.firstPhase,googlePath:value.googlePath};
}
function consoleKind(text){
 if(typeof text!=='string')return {kind:'OTHER',firebaseComponent:null};
 if(['Refused to ','Framing ','Loading ','Connecting ','Executing '].some(prefix=>text.startsWith(prefix))&&
  text.includes('Content Security Policy'))return {kind:'CSP',firebaseComponent:null};
 if(text.startsWith('Access to ')&&text.includes('blocked by CORS policy'))return {kind:'CORS',firebaseComponent:null};
 if(['Permissions policy violation:','Potential permissions policy violation:','Error with Permissions-Policy header:',
  '[Violation] Permissions policy violation:'].some(prefix=>text.startsWith(prefix)))return {kind:'PERMISSIONS_POLICY',firebaseComponent:null};
 const component=text.match(/^(?:\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z\]\s+)?@firebase\/([a-z-]+)(?=[:\s]|$)/)?.[1];
 if(C1_FIREBASE_COMPONENTS.includes(component))return {kind:'FIREBASE_SDK',firebaseComponent:component};
 if(text.startsWith('Uncaught (in promise)'))return {kind:'UNCAUGHT_PROMISE',firebaseComponent:null};
 return {kind:'OTHER',firebaseComponent:null};
}
export function consoleErrorCategory(text,locationUrl){
 // The original string is transient: return canonical enums, never its suffix.
 const origin=errorOriginCategory(locationUrl);
 const detail={...consoleKind(text),origin,googlePath:origin==='google'?recaptchaLocationCategory(locationUrl):null};
 if(typeof text==='string'&&/^Failed to load resource(?::|\s|$)/.test(text))
  return {tag:'RESOURCE',host:errorHostCategory(locationUrl),...detail};
 const prefix=typeof text==='string'?text.match(/^\[([^\]\r\n]{1,40})\]/)?.[1]:null;
 return {tag:C1_ERROR_TAGS.find(tag=>tag!=='RESOURCE'&&tag!=='OTHER'&&tag===prefix)||'OTHER',host:null,...detail};
}
export function validateFirstError(value){
 if(value===null)return null;
 if(!exact(value,['phase','source','frame','tag','host','kind','origin','hasArgs','firebaseComponent','googlePath']))fail('C1_REPORT_INVALID');
 const {phase,source,frame,tag,host,kind,origin,hasArgs,firebaseComponent,googlePath}=value;
 if(!C1_ERROR_PHASES.includes(phase)||!['console','pageerror','http'].includes(source)||
  !['top','vault-child','other'].includes(frame)||
  (source==='console'?!C1_ERROR_TAGS.includes(tag):tag!==null)||
  (source==='http'||source==='console'&&tag==='RESOURCE'?!errorHosts.includes(host):host!==null)||
  !C1_ERROR_ORIGINS.includes(origin)||
  (source==='console'?!C1_ERROR_KINDS.includes(kind)||!(hasArgs===null||typeof hasArgs==='boolean')||
   (tag!=='OTHER'&&kind!=='OTHER')||
   (kind==='FIREBASE_SDK'?!C1_FIREBASE_COMPONENTS.includes(firebaseComponent):firebaseComponent!==null):
   kind!==null||hasArgs!==null||firebaseComponent!==null)||
  source==='pageerror'&&origin!=='none'||
  (source==='console'&&origin==='google'?!C1_GOOGLE_PATHS.includes(googlePath):googlePath!==null))fail('C1_REPORT_INVALID');
 return {phase,source,frame,tag,host,kind,origin,hasArgs,firebaseComponent,googlePath};
}

// This prototype cannot accept a production URL, profile directory or credentials.
export function assertLoopback(url) {
  try {
    const value = new URL(url);
    if (value.protocol === 'http:' && value.hostname === '127.0.0.1' &&
        value.port && !value.username && !value.password) return value.origin;
  } catch { /* Never echo untrusted input. */ }
  fail('C1_LOCAL_ONLY');
}

// Proposed pre-Master guard, tested with invented metadata only. No SDK/ADC/admin imports.
export function qa2IdentityAllowed(actual, expected) {
  return !!(actual && expected && typeof expected.uid === 'string' &&
    /^[A-Za-z0-9_-]{1,128}$/.test(expected.uid) &&
    expected.email === 'codex.qa2@appcodici-password.invalid' &&
    actual.uid === expected.uid && actual.email === expected.email &&
    actual.emailVerified === true && actual.projectId === 'appcodici-password' &&
    actual.canary === true);
}

export function validateDiag(report, now = Date.now()) {
  const fields = ['version','active','permitValid','permitExpiresAt','idleMs','pushReady','lastBlock'];
  if (!exact(report, ['state','enabled','available','events']) || !exact(report.state, fields) ||
      typeof report.enabled !== 'boolean' || typeof report.available !== 'boolean' ||
      !Array.isArray(report.events) || report.events.length > FRAME_DIAG_MAX) fail('C1_REPORT_INVALID');
  const s = report.state;
  if (typeof s.version !== 'string' || !/^v?\d{1,3}\.\d{1,3}\.\d{1,6}$/.test(s.version) ||
      !['active','permitValid','pushReady'].every(k => typeof s[k] === 'boolean') ||
      !(s.permitExpiresAt === null || Number.isSafeInteger(s.permitExpiresAt) && s.permitExpiresAt > 0) ||
      !(s.idleMs === null || Number.isSafeInteger(s.idleMs) && s.idleMs > 0 && s.idleMs <= 43200000) ||
      !(s.lastBlock === null || FRAME_DIAG_CODES.includes(s.lastBlock)) ||
      !report.events.every(event => validFrameDiagnosticEvent(event, now))) fail('C1_REPORT_INVALID');
  // Reconstruct, do not spread input or attach arbitrary errors/metadata.
  return {
    state: Object.fromEntries(fields.map(k => [k, s[k]])),
    enabled: report.enabled, available: report.available,
    events: report.events.map(e => ({code:e.code,at:e.at,version:e.version,page:e.page,environment:e.environment}))
  };
}

export function safeFailure(error) {
  return C1_CODES.includes(error?.message) ? error.message : 'C1_TECHNICAL';
}
