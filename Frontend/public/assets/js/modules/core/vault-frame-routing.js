import {auth} from '../../firebase-config.js?v=1.2.268';
import {authSessionFence} from '../../auth-session-fence.js';
import {privateFrameUrl, FRAME_STANDALONE_QUERY} from './vault-frame-policy.mjs';
import {createProductionFrameAdmission} from './vault-frame-admission.js';
export async function maybeEnterVaultFrame({window: win = window, user, fenceTicket}) {
  if (win.parent !== win) return false;
  const current = new URL(win.location.href);
  // This is exclusively a one-shot DENIAL. It never grants frame admission.
  if (current.searchParams.has(FRAME_STANDALONE_QUERY)) {
    current.searchParams.delete(FRAME_STANDALONE_QUERY); win.history.replaceState(null, '', current.href); return false;
  }
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
