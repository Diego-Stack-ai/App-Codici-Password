import {auth} from '../../firebase-config.js?v=1.2.270';
import {authSessionFence} from '../../auth-session-fence.js';
import {privateFrameUrl, consumeFrameStandaloneMarker} from './vault-frame-policy.mjs';
import {createProductionFrameAdmission} from './vault-frame-admission.js';
export async function maybeEnterVaultFrame({window: win = window, user, fenceTicket, candidateHint = false}) {
  if (win.parent !== win) return false;
  const current = new URL(win.location.href);
  // This is exclusively a one-shot DENIAL. It never grants frame admission.
  if (consumeFrameStandaloneMarker(win)) return false;
  // The hint never grants access.
  if (candidateHint !== true || win.navigator?.onLine === false) return false;
  const target = privateFrameUrl(current.href, current.origin);
  if (!target) return false;
  const document = win.document, href = win.location.href;
  const admission = createProductionFrameAdmission({user, fenceTicket});
  try {
    const permit = await admission.read(user.uid, {fresh: true});
    if (!permit || auth.currentUser?.uid !== user.uid || !await authSessionFence.isCurrent(fenceTicket) ||
        auth.currentUser?.uid !== user.uid || !authSessionFence.isLocallyCurrent(fenceTicket) ||
        win.document !== document || win.location.href !== href) return false;
    const shell = new URL('/app.html', current.origin);
    shell.searchParams.set('route', target.pathname + target.search + target.hash);
    win.location.replace(shell.href); return true;
  } finally {admission.dispose();}
}
