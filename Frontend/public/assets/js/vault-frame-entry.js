import {VAULT_FRAME_ENABLED} from './app-env.js';

// The A2 page is inert without the compiled switch AND B1 server admission.
if (window.parent !== window || !VAULT_FRAME_ENABLED) {
  document.documentElement.removeAttribute('data-private-auth-state');
  document.body.hidden = false; document.body.inert = false;
} else {
  await new Promise((resolve, reject) => {
    const guard = document.createElement('script');
    guard.src = '/assets/js/private-auth-gate.js'; guard.onload = resolve; guard.onerror = reject;
    document.head.append(guard);
  });
  await import('./main-v129.js?v=1.2.269');
}
