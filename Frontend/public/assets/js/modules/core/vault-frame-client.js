import {createFrameMediaLifetime} from './vault-frame-media-lifetime.mjs';
import {auth} from '../../firebase-config.js?v=1.2.268';
import {authSessionFence} from '../../auth-session-fence.js';
import {APP_VERSION, VAULT_FRAME_ENABLED} from '../../app-env.js';
import {createFrameTransport} from './vault-frame-transport.mjs';
export const vaultFrameClient = createFrameTransport({window, release: APP_VERSION, enabled: VAULT_FRAME_ENABLED});

// A fresh grant is consumed in this same document immediately before mutation.
export async function confirmFrameAction(purpose, target) {
  if (!vaultFrameClient.isChild()) return;
  const uid = auth.currentUser?.uid, generation = vaultFrameClient.generation(), suspension = vaultFrameClient.suspensionGeneration();
  const permit = await authSessionFence.readPermit();
  const bytes = new TextEncoder().encode(JSON.stringify(target));
  if (!uid || !permit || bytes.byteLength > 65536) throw Error('FRAME_CONFIRMATION_REQUIRED');
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  target = Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join('');
  let proofExpiry = Infinity;
  const assertLocal = () => {
    if (auth.currentUser?.uid !== uid || generation !== vaultFrameClient.generation() || suspension !== vaultFrameClient.suspensionGeneration() ||
      Date.now() >= proofExpiry || !vaultFrameClient.isUnlocked() || !authSessionFence.isLocallyCurrent(permit)) throw Error('FRAME_CONFIRMATION_REQUIRED');
  };
  const current = async () => {
    assertLocal();
    if (!await authSessionFence.isCurrent(permit)) throw Error('FRAME_CONFIRMATION_REQUIRED');
    assertLocal();
  };
  await current();
  const grant = await vaultFrameClient.request('fresh', {purpose, target});
  if (grant.kind !== 'grant') throw Error('FRAME_CONFIRMATION_REQUIRED');
  const consumed = await vaultFrameClient.request('consume', {purpose, target, grant: grant.grant});
  if (consumed.kind !== 'consumed') throw Error('FRAME_CONFIRMATION_REQUIRED');
  await current();
  if (!Number.isFinite(consumed.expiresAt) || consumed.expiresAt <= Date.now()) throw Error('FRAME_CONFIRMATION_REQUIRED');
  proofExpiry = consumed.expiresAt;
  current.assertLocal = assertLocal; current.expiresAt = consumed.expiresAt;
  return current;
}

export async function confirmFrameRemoval(readItem, scope) {
  if (!vaultFrameClient.isChild()) return;
  const item = readItem();
  if (!item) throw Error('FRAME_TARGET_CHANGED');
  await confirmFrameAction('permanent-delete', {scope, id: item.id, revision: item.revision});
  if (readItem() !== item) throw Error('FRAME_TARGET_CHANGED');
}

export function frameMediaLifetime(options = {}) {
  if (!vaultFrameClient.isChild() && !options.signal) return {signal: undefined, valid: () => true, dispose() {}};
  const uid = auth.currentUser?.uid, generation = vaultFrameClient.generation();
  const lifetime = createFrameMediaLifetime({window, document, ...options,
    isCurrent: () => auth.currentUser?.uid === uid && generation === vaultFrameClient.generation() && (options.requireUnlocked === false || vaultFrameClient.isUnlocked())});
  const remove = vaultFrameClient.onClear(lifetime.cancel);
  return {signal: lifetime.signal, valid: lifetime.valid, dispose() {remove(); lifetime.dispose();}};
}

// No native-export UI or its dependencies on ordinary page startup.
export function executeFrameNativeAction(target, action) {
  if (!vaultFrameClient.isChild()) return action();
  const generation = vaultFrameClient.generation(), suspension = vaultFrameClient.suspensionGeneration();
  return import('./vault-frame-native-action.js').then(module => {
    if (generation !== vaultFrameClient.generation() || suspension !== vaultFrameClient.suspensionGeneration() || !vaultFrameClient.isUnlocked()) throw Error('FRAME_CONFIRMATION_REQUIRED');
    return module.executeFrameNativeAction(target, action, {vaultFrameClient, confirmFrameAction});
  });
}
