const requestingDocument = document;
// The classic guard can use the same synchronous, non-secret navigation facade.
export function navigateDocument(target, replace = false) {
  if (requestingDocument !== window.document) return;
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
