/* Deny logged-out cold shell entries before CSS and module loading. */
(() => {
  if (window.parent !== window) return;
  let loggedOut = true;
  try { loggedOut = sessionStorage.getItem('codex_explicit_logout') === '1'; }
  catch { /* Keep the same fail-closed storage policy as the presentation gate. */ }
  if (loggedOut) {
    try { window.location.replace('/login.html'); }
    catch { /* The inert shell stays closed; its entry can retry when loaded. */ }
  }
})();
