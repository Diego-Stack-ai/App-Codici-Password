const requestingDocument = document;
// The classic guard can use the same synchronous, non-secret navigation facade.
export function navigateDocument(target, replace = false) {
  if (requestingDocument !== window.document) return;
  try {if (['/login.html','/imposta_nuova_password.html'].includes(new URL(target, window.location.origin).pathname)) emitFrameDiagnostic('LOGIN_REDIRECT');} catch { /* Not a diagnostic URL. */ }
  if (window.vaultFrameNavigation?.deferExit(target, replace)) return;
  try {
    if (window.parent !== window && window.parent.location.origin === window.location.origin &&
      window.parent.vaultFrameNavigation) {
      window.parent.vaultFrameNavigation.navigateFromChild(window, requestingDocument, target, replace); return;
    }
  } catch { /* Standalone fallback. */ }
  if (replace) window.location.replace(target);
  else window.location.href = target;
}

export function beginFrameCleanup(kind = 'logout') {
  if (requestingDocument !== window.document) return null;
  try {
    if (window.parent === window) return null;
    const facade = window.parent.vaultFrameNavigation;
    const token = facade?.beginLogoutFromChild(window, requestingDocument, kind);
    if (token) facade.revokeFromChild(window, requestingDocument);
    return token || null;
  } catch {return null;}
}
export const beginFrameLogout = () => beginFrameCleanup('logout');
export function finishFrameCleanup(token) {
  try {window.parent.vaultFrameNavigation?.finishCleanupFromChild(window, requestingDocument, token);} catch { /* Already revoked. */ }
}

// DIAG hooks stay small; collection code is loaded only on request/opt-in.
const diagOption = 'app_frame_diag_consent_v1', diagEvents = 'app_frame_diag_events_v1';
let diagRuntime, diagEnded=false;
export function frameDiagnosticDocumentCurrent() {
  if(diagEnded || requestingDocument!==window.document)return false;
  try{return window.parent===window || !!window.parent.vaultFrameNavigation?.diagnosticsFromChild(window,requestingDocument);}catch{return false;}
}
export function clearFrameDiagnostics() {
  try {for (const key of [diagOption,diagEvents]) if(sessionStorage.getItem(key)!==null)sessionStorage.removeItem(key);}catch{ /* Unavailable storage. */ }
  window.dispatchEvent(new Event('frame-diagnostics-changed'));
}
export function loadFrameDiagnostics() {
  if(!frameDiagnosticDocumentCurrent())return Promise.reject(new Error('DIAG_DOCUMENT_GONE'));
  return import('./modules/core/vault-frame-diagnostics-runtime.js').then(module=>{if(!frameDiagnosticDocumentCurrent())throw new Error('DIAG_DOCUMENT_GONE');diagRuntime=module;module.observeFrameDiagnostics(frameDiagnosticDocumentCurrent);return module;});
}
export function emitFrameDiagnostic(code,page=window.location.pathname.slice(1)) {
  let consent;try{consent=sessionStorage.getItem(diagOption);}catch{return;}
  if(!consent||!frameDiagnosticDocumentCurrent())return;
  const at=Date.now(), write=module=>{if(frameDiagnosticDocumentCurrent())module.recordFrameDiagnostic(code,consent,page,at);};
  if(diagRuntime)write(diagRuntime);else void loadFrameDiagnostics().then(write).catch(()=>{});
}
window.addEventListener?.('private-auth-blocked',clearFrameDiagnostics);
window.addEventListener?.('pagehide',()=>{emitFrameDiagnostic(window.vaultFrameNavigation?'LOCK_PAGEHIDE':'FRAME_EXIT');diagEnded=true;},{once:true});
window.addEventListener?.('frame-diagnostics-login',()=>emitFrameDiagnostic('LOGIN_REDIRECT'));
