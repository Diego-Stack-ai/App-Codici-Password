import {doc, onSnapshot, getDocFromServer} from '/assets/js/vendor/firebase-runtime.js';
import {auth, db} from '../../firebase-config.js?v=1.2.270';
import {authSessionFence} from '../../auth-session-fence.js';
import {FRAME_POLICY_PATH, createFramePermitWatcher} from './vault-frame-permit.mjs';
export function createProductionFrameAdmission({user, fenceTicket, onDeny}) {
  if (window.navigator?.onLine === false) return {read: async () => null, deny() {}, dispose() {}};
  const reference = doc(db, ...FRAME_POLICY_PATH.split('/'));
  const watcher = createFramePermitWatcher({uid: user.uid, onDeny,
    isCurrent: () => auth.currentUser?.uid === user.uid && authSessionFence.isLocallyCurrent(fenceTicket),
    subscribe: (next, error) => onSnapshot(reference, {includeMetadataChanges: true}, next, error),
    readServer: () => getDocFromServer(reference)});
  const offline = () => watcher.deny();
  const hidden = () => {if (window.document.hidden) watcher.invalidatePending();};
  window.addEventListener('offline', offline);
  window.document.addEventListener('visibilitychange', hidden);
  return {read: watcher.read, deny: watcher.deny, dispose() {
    window.removeEventListener('offline', offline); window.document.removeEventListener('visibilitychange', hidden); watcher.dispose();
  }};
}
