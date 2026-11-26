import {VAULT_FRAME_ENABLED} from './app-env.js';

// This is routing only: it cannot unlock or activate the frame.
const hasTopLevelLogout = () => {
  if (window.parent !== window) return false;
  try { return sessionStorage.getItem('codex_explicit_logout') === '1'; }
  catch { return true; /* Storage unavailable: keep the shell closed. */ }
};
const leaveLoggedOutShell = () => {
  if (!hasTopLevelLogout()) return false;
  try { window.location.replace('/login.html'); }
  catch { /* Remain hidden/inert if navigation cannot be requested. */ }
  return true;
};

// Explicit logout takes precedence over the disabled-feature stub as well.
if (leaveLoggedOutShell()) {
  // No Auth, owner or main import while leaving this new document.
} else if (window.parent !== window || !VAULT_FRAME_ENABLED) {
  document.documentElement.removeAttribute('data-private-auth-state');
  document.body.hidden = false; document.body.inert = false;
} else {
  let guardLoaded = false;
  try {
    await new Promise((resolve, reject) => {
      const guard = document.createElement('script');
      guard.src = '/assets/js/private-auth-gate.js'; guard.onload = resolve; guard.onerror = reject;
      document.head.append(guard);
    });
    guardLoaded = true;
  } catch (error) {
    if (!leaveLoggedOutShell()) throw error;
  }
  if (guardLoaded) {
    // The loaded gate owns any exit already requested: do not navigate twice.
    if (hasTopLevelLogout()) window.privateAuthGate.reject();
    else await import('./main-v129.js?v=1.2.299');
  }
}
