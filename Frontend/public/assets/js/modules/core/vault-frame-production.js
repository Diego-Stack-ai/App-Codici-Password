import {emitFrameDiagnostic} from '../../frame-navigation.js';
import {createProductionFrameAdmission} from './vault-frame-admission.js';
import {doc, onSnapshot} from '/assets/js/vendor/firebase-runtime.js';
import {APP_VERSION} from '../../app-env.js';
import {auth, db} from '../../firebase-config.js?v=1.2.272';
import {authSessionFence} from '../../auth-session-fence.js';
import {getUserProfile} from '../data/vault-repository.js';
import {createVaultFrameOwner} from './vault-frame-owner.mjs';
import {installFramePushNavigation} from './vault-frame-push.mjs';


let mounted = null, mountGeneration = 0;
export async function startVaultFrame({user, securityManager, fenceTicket}) {
  mounted?.dispose();
  const generation = ++mountGeneration;
  mounted = null;
  const epoch = `${fenceTicket.revision}:${fenceTicket.nonce}`;
  const valid = async expected => expected.uid === user.uid && expected.epoch === epoch &&
    auth.currentUser?.uid === user.uid && await authSessionFence.isCurrent(fenceTicket);
  const getIdentity = () => auth.currentUser?.uid === user.uid && authSessionFence.isLocallyAllowed()
    ? {uid: user.uid, epoch} : null;
  let stopPreference = () => {}, stopPush = () => {}, preferenceEpoch = 0;
  const status = document.getElementById('frame-status'), resume = document.getElementById('frame-resume');
  let owner;
  const admission = createProductionFrameAdmission({user, fenceTicket, onDeny: () => owner?.session.lock('policy-revoked')});
  owner = createVaultFrameOwner({window, iframe: document.getElementById('vault-frame'), release: APP_VERSION,
    getIdentity, validateIdentity: valid, readPermit: admission.read, onDiagnostic: emitFrameDiagnostic,
    readTimeout: async () => (await getUserProfile(user.uid))?.lock_timeout,
    unlock: async (uid, {signal}) => {
      if (uid !== user.uid || !await valid({uid, epoch}) || signal.aborted) throw Error('FRAME_AUTH_DENIED');
      const cancel = () => securityManager.clearSession();
      signal.addEventListener('abort', cancel, {once: true});
      try {return await securityManager.ensureVaultKeyMaterial({signal});}
      finally {signal.removeEventListener('abort', cancel);}
    },
    confirmSensitive: async ({signal}) => {
      if (signal.aborted || !await valid({uid: user.uid, epoch}) || signal.aborted) return false;
      const cancel = () => securityManager.clearSession();
      signal.addEventListener('abort', cancel, {once: true});
      try {
        await securityManager.ensureVaultKeyMaterial({forceReload: true, promptImmediately: true, signal});
        return !signal.aborted && await valid({uid: user.uid, epoch}) && !signal.aborted;
      } finally {signal.removeEventListener('abort', cancel);}
    }, clearMaterial: () => {if (generation === mountGeneration) securityManager.clearSession();},
    onDispose: () => {stopPush(); stopPreference(); admission.dispose();},
    onState: state => {if (generation !== mountGeneration) return; if (state.locked) {stopPush(); stopPreference(); admission.dispose();} status.hidden = !state.locked; resume.hidden = !state.locked;}
  });
  mounted = owner;
  stopPush = installFramePushNavigation({window, owner});
  securityManager.setFrameExpiryAuthority(() => owner.session.state().expiresAt);
  resume.addEventListener('click', event => {if (mounted === owner && owner.resume()) event.preventDefault();});
  const route = new URL(window.location.href).searchParams.get('route') || '/home_page.html';
  const started = await owner.start(route);
  if (generation !== mountGeneration || mounted !== owner) {owner.dispose(); return;}
  if (!started) {owner.dispose(); mounted = null; securityManager.setFrameExpiryAuthority(null); return;}
  stopPreference = onSnapshot(doc(db, 'users', user.uid), snapshot => {
    const preferenceTicket = ++preferenceEpoch;
    void (async () => {
      if (mounted !== owner || generation !== mountGeneration || preferenceTicket !== preferenceEpoch) return;
      const ok = await valid({uid: user.uid, epoch});
      if (mounted !== owner || generation !== mountGeneration || preferenceTicket !== preferenceEpoch) return;
      if (!ok) {owner.session.lock('preference-auth-denied'); return;}
      owner.updatePreference(snapshot.exists() ? snapshot.data().lock_timeout : null);
    })().catch(() => {if (mounted === owner && generation === mountGeneration && preferenceTicket === preferenceEpoch) owner.session.lock('preference-unavailable');});
  }, () => {if (mounted === owner && generation === mountGeneration) {preferenceEpoch++; owner.session.lock('preference-unavailable');}});
}
