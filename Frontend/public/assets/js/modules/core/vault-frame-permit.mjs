export const FRAME_POLICY_PATH = 'vaultFramePolicy/current';
export const FRAME_PERMIT_LEASE_MS = 300_000;
export const FRAME_PERMIT_RENEW_WINDOW_MS = 60_000;
const fields = ['schemaVersion','version','enabled'];
export function framePermitFromSnapshot(snapshot, uid, now = Date.now()) {
  if (snapshot?.metadata?.fromCache !== false || snapshot.metadata.hasPendingWrites !== false || !snapshot.exists()) return null;
  const data = snapshot.data();
  if (!data || Object.keys(data).some(key => !fields.includes(key)) || fields.some(key => !Object.hasOwn(data, key)) ||
      data.schemaVersion !== 2 || data.version !== 2 || data.enabled !== true ||
      typeof uid !== 'string' || !uid || uid.length > 128 || !Number.isFinite(now)) return null;
  // The global policy is not the user's permit. Only a server confirmation can
  // issue this finite, UID-bound RAM lease; the broker wire protocol stays v1.
  const expiresAt = now + FRAME_PERMIT_LEASE_MS;
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return Object.freeze({enabled: true, uid, version: 1, expiresAt});
}
// One server listener, no persistence. RAM reads renew only in the last minute,
// through one coalesced server read; a renewal never touches Vault inactivity.
export function createFramePermitWatcher({uid, subscribe, readServer, isCurrent,
  canRefresh = () => true, onDeny = () => {}, now = Date.now, timeoutMs = 5000,
  setTimer = setTimeout, clearTimer = clearTimeout}) {
  let permit = null, epoch = 0, disposed = false, terminal = false, established = false, pending = null;
  let stop = () => {}, resolveInitial, cancelFresh = null;
  const invalidatePending = () => {epoch++; pending = null; const cancel = cancelFresh; cancelFresh = null; cancel?.();};
  const initial = new Promise(resolve => {resolveInitial = resolve;});
  const settle = value => {resolveInitial?.(value); resolveInitial = null; clearTimer(timer);};
  const deny = () => {
    if (disposed || terminal) return;
    const active = established; permit = null; invalidatePending();
    terminal = true;
    settle(false); if (active) onDeny();
  };
  const timer = setTimer(deny, timeoutMs);
  const install = snapshot => {
    if (disposed || terminal) return null;
    if (!isCurrent()) {deny(); return null;}
    if (established && permit?.expiresAt <= now()) {deny(); return null;}
    const next = framePermitFromSnapshot(snapshot, uid, now());
    if (!next) {
      // The first cached event is not authority, but wait for the initial server event.
      if (!established && snapshot?.metadata?.fromCache === true) {permit = null; return null;}
      deny(); return null;
    }
    // Every valid v2 snapshot represents the same global enabled policy. Its
    // newly issued local expiry must not cancel a concurrent read of that policy.
    // OFF, incompatible metadata/schema and identity changes deny terminally.
    permit = next; established = true; settle(true); return permit;
  };
  try {stop = subscribe(install, deny);} catch {deny();}
  function cached() {
    if (disposed || terminal || !isCurrent() || !permit || permit.expiresAt <= now()) {
      if (!disposed && established && !terminal) deny();
      return null;
    }
    return permit;
  }
  async function read(expectedUid, {fresh = false} = {}) {
    if (expectedUid !== uid || disposed || terminal) return null;
    if (!isCurrent()) {deny(); return null;}
    if (!established && !await initial) return null;
    const current = cached();
    if (!current) return null;
    if (!fresh && current.expiresAt - now() > FRAME_PERMIT_RENEW_WINDOW_MS) return current;
    // A hidden document may retain an unexpired lease but cannot extend it by
    // background polling. Visible resume still explicitly requires fresh=true.
    if (!canRefresh()) return fresh ? null : current;
    if (pending) return pending;
    const ticket = epoch;
    const operation = (async () => {
      let deadline, cancel;
      try {
        const expired = new Promise(resolve => {
          cancel = () => resolve(null); cancelFresh = cancel;
          deadline = setTimer(() => {if (ticket === epoch) deny(); resolve(null);}, timeoutMs);
        });
        const snapshot = await Promise.race([readServer(), expired]);
        if (disposed || terminal || ticket !== epoch) return null;
        if (!cached()) return null;
        return install(snapshot);
      } catch {if (ticket === epoch) deny(); return null;} finally {
        clearTimer(deadline); if (cancelFresh === cancel) cancelFresh = null;
      }
    })();
    pending = operation;
    try {return await operation;} finally {if (pending === operation) pending = null;}
  }
  return Object.freeze({read, deny, invalidatePending, state: () => ({allowed: !!cached(), established, disposed}), dispose() {
    if (disposed) return; disposed = true; permit = null; invalidatePending(); settle(false); stop();
  }});
}
