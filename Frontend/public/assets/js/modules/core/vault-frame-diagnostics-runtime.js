import {APP_VERSION} from '../../app-env.js';
import {auth} from '../../firebase-config.js?v=1.2.273';
import {authSessionFence} from '../../auth-session-fence.js';
import {createFrameDiagnostics, FRAME_DIAG_CODES, FRAME_DIAG_OPTION, FRAME_DIAG_EVENTS} from './vault-frame-diagnostics.mjs';
import {messagingRegistration} from './vault-frame-push.mjs';
const requestingDocument = document, protocol = 'vault-frame-diag/v1';
let boundIdentity=auth.currentUser?.uid, disposed=false, documentGuard=()=>false;
window.addEventListener('pagehide',()=>{disposed=true;},{once:true});
export function frameDiagnosticContext() {return {ready:!!auth.currentUser&&auth.currentUser.uid===boundIdentity&&!disposed&&documentGuard()&&authSessionFence.isLocallyAllowed(),revision:authSessionFence.diagnosticRevision()};}
const environment = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true ? 'PWA' : 'browser';
const storage = {getItem:key=>sessionStorage.getItem(key),setItem:(key,value)=>sessionStorage.setItem(key,value),removeItem:key=>sessionStorage.removeItem(key)};
export const frameDiagnostics = createFrameDiagnostics({storage,appVersion:APP_VERSION,context:frameDiagnosticContext});
const alive = () => window.document === requestingDocument && documentGuard() && frameDiagnosticContext().ready;
const signal = () => window.dispatchEvent(new Event('frame-diagnostics-changed'));
export function recordFrameDiagnostic(code, consent, page=location.pathname.slice(1), at=Date.now()) {
  if(!alive())return false;
  const accepted=frameDiagnostics.record({code,at,version:APP_VERSION,page,environment:environment()},consent);
  if(accepted)signal();return accepted;
}
let observing=false;
function clearFrameDiagnostics() {
  try{for(const key of [FRAME_DIAG_OPTION,FRAME_DIAG_EVENTS])if(sessionStorage.getItem(key)!==null)sessionStorage.removeItem(key);}catch{ /* Storage unavailable. */ }
  signal();
}
export function observeFrameDiagnostics(isCurrent) {
  if(typeof isCurrent==='function')documentGuard=isCurrent;
  if(auth.currentUser?.uid!==boundIdentity){clearFrameDiagnostics();boundIdentity=auth.currentUser?.uid;}
  if(observing)return;observing=true;
  try {const option=JSON.parse(sessionStorage.getItem(FRAME_DIAG_OPTION)||'null');
    if(option&&option.revision!==frameDiagnosticContext().revision)clearFrameDiagnostics();
  }catch{clearFrameDiagnostics();}
  if(!navigator.serviceWorker)return;
  navigator.serviceWorker.addEventListener('message', event=>{
    const data=event.data;
    if(event.isTrusted!==true || event.origin!==location.origin || !data || Array.isArray(data) ||
      Object.keys(data).sort().join(',')!=='code,protocol' || data.protocol!==protocol ||
      !FRAME_DIAG_CODES.includes(data.code) || !data.code.startsWith('PUSH_') || !frameDiagnostics.enabled() || !alive())return;
    let consent;try{consent=sessionStorage.getItem(FRAME_DIAG_OPTION);}catch{return;}
    const at=Date.now();
    void navigator.serviceWorker.getRegistrations().then(registrations=>{
      if(!alive() || !registrations.some(r=>messagingRegistration(r,location.origin)&&r.active===event.source&&event.source.state==='activated'))return;
      recordFrameDiagnostic(data.code,consent,location.pathname.slice(1),at);
    }).catch(()=>{});
  });
}
export async function notificationWorkerReady() {
  if(!navigator.serviceWorker)return false;
  try {
    const registrations=await navigator.serviceWorker.getRegistrations();
    const registration=registrations.find(r=>messagingRegistration(r,location.origin)&&r.active?.state==='activated');
    if(!registration || !alive())return false;
    const worker=registration.active, channel=new MessageChannel();
    return await new Promise(resolve=>{
      let done=false;
      const finish=value=>{if(done)return;done=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(value);};
      const timer=setTimeout(()=>finish(false),800);
      channel.port1.onmessage=event=>{
        const data=event.data;
        finish(alive() && registration.active===worker && worker.state==='activated' && data && !Array.isArray(data) &&
          Object.keys(data).sort().join(',')==='kind,protocol,revision' && data.protocol===protocol && data.kind==='ready' && data.revision===1);
      };
      try{worker.postMessage({protocol,kind:'probe'},[channel.port2]);}catch{finish(false);}
    });
  } catch{return false;}
}
export function frameDiagnosticReport({idleMs=null,pushReady=false}={}) {
  let owner=null;
  try {if(parent!==window)owner=parent.vaultFrameNavigation?.diagnosticsFromChild(window,requestingDocument);}catch{ /* Standalone. */ }
  const events=alive()?frameDiagnostics.events():[];
  const latestBlock=[...events].reverse().find(event=>event.code.startsWith('LOCK_')||event.code==='ERROR_FRAME_MESSAGE')?.code || null;
  const snapshot={version:APP_VERSION,active:owner?.active===true,permitValid:owner?.permitValid===true,
    permitExpiresAt:Number.isSafeInteger(owner?.permitExpiresAt)&&owner.permitExpiresAt>0?owner.permitExpiresAt:null,
    idleMs:Number.isFinite(owner?.idleMs)&&owner.idleMs>0?owner.idleMs:Number.isFinite(idleMs)&&idleMs>0?idleMs:null,
    pushReady:pushReady===true,lastBlock:owner?.lastBlock||latestBlock};
  // Reconstruct the closed snapshot; never serialize an owner, worker or exception.
  if(snapshot.lastBlock!==null&&!FRAME_DIAG_CODES.includes(snapshot.lastBlock))snapshot.lastBlock=null;
  return {state:snapshot,enabled:alive()&&frameDiagnostics.enabled(),available:frameDiagnostics.available(),events};
}
