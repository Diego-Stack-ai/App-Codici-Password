import {FRAME_PROTOCOL, privateFrameUrl, SENSITIVE_ACTIONS} from './frame-policy.mjs';

// No Firebase adapter or application key is connected. Admission defaults to DENY.
// The parent owns session continuity; a successful key reply creates a transient
// RAM copy in the child. An unchanged legacy page cannot be promised key-free.
export function createFrameSession({origin, getFrameWindow, getFrameUrl, getFrameDocument = () => null,
  getIdentity = () => null, readPermit = async () => null,
  unlock = async () => null, confirmSensitive = async () => false,
  now = Date.now, nonce = () => crypto.randomUUID(), idleMs = 180_000,
  backgroundMs = 180_000, grantMs = 15_000, onLock = () => {}} = {}) {
  if ([idleMs, backgroundMs, grantMs].some(value => !Number.isFinite(value) || value <= 0)) throw Error('INVALID_TIMEOUT');
  let key = null, owner = null, generation = 0, documentEpoch = 0, documentNonce = null;
  let ownerEpoch = null, frameDocument = null;
  let lastActivity = 0, hiddenAt = null, permitExpiry = 0, pendingUnlock = null;
  const grants = new Map(), requests = new Set(), replies = new WeakMap();
  const identity = () => {
    try {
      const value = getIdentity();
      return typeof value?.uid === 'string' && value.uid.length > 0 && value.uid.length <= 128 &&
        Number.isSafeInteger(value.epoch) && value.epoch >= 0 ? {uid: value.uid, epoch: value.epoch} : null;
    } catch { return null; }
  };
  const nonceValid = value => typeof value === 'string' && /^[\w-]{16,80}$/.test(value);
  function lock(reason = 'manual') {
    generation++; documentEpoch++; documentNonce = null; frameDocument = null;
    key = null; owner = null; ownerEpoch = null; permitExpiry = 0; lastActivity = 0;
    pendingUnlock?.controller.abort(); pendingUnlock = null; grants.clear(); requests.clear();
    onLock(reason);
  }
  function tick() {
    const current = identity(), active = key !== null || pendingUnlock !== null;
    if (active && (!current || (owner && (current.uid !== owner || current.epoch !== ownerEpoch)) ||
      (pendingUnlock && (current.uid !== pendingUnlock.uid || current.epoch !== pendingUnlock.identityEpoch)))) lock('identity-changed');
    if ((key !== null && now() - lastActivity >= idleMs) ||
      ((key !== null || pendingUnlock) && permitExpiry && now() >= permitExpiry) ||
      (pendingUnlock && now() - pendingUnlock.startedAt >= idleMs) ||
      ((key !== null || pendingUnlock || documentNonce) && hiddenAt !== null && now() - hiddenAt >= backgroundMs)) lock('expired');
    for (const [id, grant] of grants) if (now() >= grant.expiresAt) grants.delete(id);
  }
  function retireDocument() {
    documentEpoch++; documentNonce = null; frameDocument = null; grants.clear(); requests.clear();
    pendingUnlock?.controller.abort(); pendingUnlock = null;
  }
  function currentUrl() { try { return privateFrameUrl(getFrameUrl(), origin); } catch { return null; } }
  function currentDocument() {try {return getFrameDocument();} catch {return null;}}
  function beginDocument() {
    retireDocument(); tick();
    if (!getFrameWindow() || !currentUrl() || !currentDocument()) { lock('route-denied'); return null; }
    frameDocument = currentDocument();
    documentNonce = nonce();
    if (!nonceValid(documentNonce)) throw Error('INVALID_NONCE');
    return documentNonce;
  }
  function assertCurrent(ticket, allowHidden = false) {
    tick();
    if (ticket.generation !== generation || ticket.documentEpoch !== documentEpoch ||
      ticket.documentNonce !== documentNonce || ticket.source !== getFrameWindow() ||
      ticket.href !== currentUrl()?.href || ticket.frameDocument !== currentDocument()) throw Error('STALE_REQUEST');
    const current = identity();
    if (!current || current.uid !== ticket.uid || current.epoch !== ticket.identityEpoch) {
      lock('identity-changed'); throw Error('STALE_REQUEST');
    }
    if (!allowHidden && hiddenAt !== null) throw Error('FRAME_HIDDEN');
  }
  async function admitted(ticket) {
    let permit;
    try { permit = await readPermit(ticket.uid); }
    catch { assertCurrent(ticket, true); lock('admission-unavailable'); throw Error('ADMISSION_DENIED'); }
    assertCurrent(ticket);
    if (permit?.enabled !== true || permit.uid !== ticket.uid ||
      permit.version !== 1 || !Number.isFinite(permit.expiresAt) || permit.expiresAt <= now()) {
      lock('admission-denied'); throw Error('ADMISSION_DENIED');
    }
    if ((owner && (owner !== ticket.uid || ownerEpoch !== ticket.identityEpoch)) ||
      (pendingUnlock && (pendingUnlock.uid !== ticket.uid || pendingUnlock.identityEpoch !== ticket.identityEpoch))) {
      lock('identity-changed'); throw Error('ADMISSION_DENIED');
    }
    permitExpiry = permit.expiresAt;
    return ticket.uid;
  }
  async function material(ticket, uid) {
    if (key !== null) return key;
    if (!pendingUnlock) {
      const controller = new AbortController();
      pendingUnlock = {uid, identityEpoch: ticket.identityEpoch, startedAt: now(), controller,
        promise: Promise.resolve().then(() => unlock(uid, {signal: controller.signal}))};
    }
    const pending = pendingUnlock;
    try {
      const candidate = await pending.promise;
      assertCurrent(ticket);
      if (await admitted(ticket) !== uid) throw Error('ADMISSION_DENIED');
      // Recheck after the admission Promise, before mutating session state.
      assertCurrent(ticket);
      if (typeof candidate !== 'string' || !candidate) throw Error('UNLOCK_FAILED');
      key = candidate; owner = uid; ownerEpoch = ticket.identityEpoch; lastActivity = now();
      return key;
    } finally { if (pendingUnlock === pending) pendingUnlock = null; }
  }
  async function handle(event) {
    const data = event?.data, source = getFrameWindow(), href = currentUrl()?.href;
    if (!source || event?.source !== source || event.origin !== origin || !href || !documentNonce || !frameDocument || frameDocument !== currentDocument() ||
      !data || Array.isArray(data) || data.protocol !== FRAME_PROTOCOL || data.documentNonce !== documentNonce ||
      !nonceValid(data.requestId) || requests.has(data.requestId) ||
      !['key', 'activity', 'lock', 'fresh', 'consume'].includes(data.command) ||
      Object.keys(data).some(name => !['protocol', 'documentNonce', 'requestId', 'command', 'purpose', 'target', 'grant'].includes(name))) return null;
    requests.add(data.requestId);
    if (requests.size > 128) requests.delete(requests.values().next().value);
    const current = identity();
    if (!current) { lock('identity-unavailable'); return null; }
    const ticket = {generation, documentEpoch, documentNonce, frameDocument, source, href, uid: current.uid, identityEpoch: current.epoch};
    const reply = details => {
      const value = {protocol: FRAME_PROTOCOL, documentNonce: ticket.documentNonce, requestId: data.requestId, ...details};
      replies.set(value, ticket);
      return Object.freeze(value);
    };
    try {
      if (data.command === 'lock') { assertCurrent(ticket, true); lock('child-request'); return null; }
      assertCurrent(ticket);
      if (hiddenAt !== null) throw Error('FRAME_HIDDEN');
      const uid = await admitted(ticket); assertCurrent(ticket);
      if (data.command === 'activity') { if (key !== null) lastActivity = now(); return reply({kind: 'activity'}); }
      if (data.command === 'key') {
        const value = await material(ticket, uid); assertCurrent(ticket);
        return reply({kind: 'key', material: value});
      }
      if (!SENSITIVE_ACTIONS.includes(data.purpose) || !/^[\w:-]{1,128}$/.test(data.target || '') || key === null) throw Error('FRESH_CONFIRMATION_REQUIRED');
      if (data.command === 'fresh') {
        if (grants.size >= 8) throw Error('FRESH_CONFIRMATION_REQUIRED');
        if (await confirmSensitive({uid, purpose: data.purpose, target: data.target}) !== true) throw Error('CONFIRMATION_CANCELLED');
        assertCurrent(ticket);
        if (await admitted(ticket) !== uid) throw Error('ADMISSION_DENIED');
        assertCurrent(ticket);
        if (grants.size >= 8) throw Error('FRESH_CONFIRMATION_REQUIRED');
        const id = nonce();
        if (!nonceValid(id)) throw Error('INVALID_NONCE');
        grants.set(id, {uid, purpose: data.purpose, target: data.target, documentEpoch, generation, expiresAt: now() + grantMs});
        return reply({kind: 'grant', grant: id});
      }
      const grant = grants.get(data.grant);
      if (!grant || grant.uid !== uid || grant.purpose !== data.purpose || grant.target !== data.target || grant.documentEpoch !== documentEpoch ||
        grant.generation !== generation || now() >= grant.expiresAt) throw Error('GRANT_DENIED');
      grants.delete(data.grant);
      return reply({kind: 'consumed'});
    } catch (error) {
      try { assertCurrent(ticket); } catch { return null; }
      const code = ['FRAME_HIDDEN', 'UNLOCK_FAILED', 'FRESH_CONFIRMATION_REQUIRED', 'CONFIRMATION_CANCELLED', 'GRANT_DENIED'].includes(error?.message) ? error.message : 'REQUEST_DENIED';
      return reply({kind: 'error', code});
    }
  }
  return Object.freeze({handle, beginDocument, retireDocument, lock, tick,
    deliver(value) {
      const ticket = value && replies.get(value);
      if (!ticket) return false;
      replies.delete(value);
      try { assertCurrent(ticket); } catch { return false; }
      ticket.source.postMessage(value, origin);
      return true;
    },
    isCurrentDocument: value => value !== null && value === documentNonce,
    touch() { tick(); if (key !== null && hiddenAt === null) lastActivity = now(); },
    setVisibility(visible) {
      tick();
      if (visible) hiddenAt = null;
      else if (hiddenAt === null) hiddenAt = now();
    },
    state() { tick(); return Object.freeze({unlocked: key !== null, generation, documentEpoch, grants: grants.size}); },
  });
}
