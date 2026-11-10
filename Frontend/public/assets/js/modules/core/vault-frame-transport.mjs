import {FRAME_PROTOCOL, privateFrameUrl, safeAreaInsets} from './vault-frame-policy.mjs';

// No Firebase or security-manager imports: the manager remains the sole adopter.
export function createFrameTransport({window: win, release, enabled = false, now = Date.now} = {}) {
  const requestingDocument = win.document;
  let candidate = false;
  try { candidate = enabled && win.parent !== win && win.parent.location.origin === win.location.origin &&
    win.parent.location.pathname === '/app.html' && !!privateFrameUrl(win.location.href, win.location.origin); } catch { /* DENY */ }
  let suspensionGeneration = 0, suspended = true;
  const visibleWaiters = new Set();
  let disposed = false, documentNonce = null, ready = false, generation = 0, expiry = 0, areaSequence = -1;
  const childNonce = candidate ? win.crypto.randomUUID() : null, pending = new Map(), clears = new Set();
  const cleanups = [];
  const listen = (surface, name, handler, options) => {surface.addEventListener(name, handler, options); cleanups.push(() => surface.removeEventListener(name, handler, options));};
  let readyResolve;
  const waiting = new Promise(resolve => { readyResolve = resolve; });
  const send = value => win.parent.postMessage({protocol: FRAME_PROTOCOL, release, ...value}, win.location.origin);
  function clear() {
    generation++; expiry = 0; suspended = true;
    for (const waiter of visibleWaiters) waiter.reject(Error('FRAME_REVOKED')); visibleWaiters.clear(); ready = false; documentNonce = null; areaSequence = -1;
    for (const request of pending.values()) { win.clearTimeout(request.timer); request.reject(Error('FRAME_REVOKED')); }
    pending.clear();
    for (const name of ['top', 'right', 'bottom', 'left']) win.document.documentElement.style.removeProperty(`--frame-safe-area-inset-${name}`);
    for (const callback of clears) callback();
  }
  async function whenVisible() {
    if (!candidate || disposed) throw Error('FRAME_DISABLED');
    if (!suspended && win.document.visibilityState !== 'hidden') return;
    return new Promise((resolve, reject) => {
      const waiter = {resolve: () => {win.clearTimeout(timer);resolve();}, reject: error => {win.clearTimeout(timer);reject(error);}};
      const timer = win.setTimeout(() => {visibleWaiters.delete(waiter);reject(Error('FRAME_TIMEOUT'));}, 12000);
      visibleWaiters.add(waiter);
    });
  }
  async function request(command, details = {}) {
    if (!candidate || disposed) throw Error('FRAME_DISABLED');
    const before = generation;
    if (!ready) await Promise.race([waiting, new Promise((_, reject) => win.setTimeout(() => reject(Error('FRAME_UNAVAILABLE')), 12000))]);
    await whenVisible();
    if (!ready || generation !== before) throw Error('FRAME_REVOKED');
    const requestId = win.crypto.randomUUID();
    return new Promise((resolve, reject) => {
      const timer = win.setTimeout(() => { pending.delete(requestId); reject(Error('FRAME_TIMEOUT')); }, 60000);
      pending.set(requestId, {resolve, reject, timer, generation});
      send({documentNonce, requestId, command, ...details});
    });
  }
  function message(event) {
    if (disposed || !candidate || event.origin !== win.location.origin || event.source !== win.parent) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (typeof data.protocol !== 'string' || !data.protocol.startsWith('vault-frame/')) return;
    if (data.protocol !== FRAME_PROTOCOL || data.release !== release) { clear(); return; }
    if (data.kind === 'challenge' && typeof data.documentNonce === 'string' && /^[\w-]{16,80}$/.test(data.documentNonce)) {
      if (documentNonce && documentNonce !== data.documentNonce) clear();
      documentNonce = data.documentNonce;
      send({kind: 'hello', documentNonce, childNonce}); return;
    }
    if (data.documentNonce !== documentNonce || !documentNonce) return;
    if (data.kind === 'revoke') { clear(); return; }
    if (data.kind === 'ready' && data.childNonce === childNonce) { ready = true; readyResolve(); return; }
    if (data.kind === 'visible' && ready && win.document.visibilityState !== 'hidden') {
      if (Number.isFinite(data.leaseExpiresAt) && data.leaseExpiresAt > now()) expiry = data.leaseExpiresAt;
      suspended = false; for (const waiter of visibleWaiters) waiter.resolve(); visibleWaiters.clear(); return;
    }
    if (data.kind === 'insets' && ready && Number.isSafeInteger(data.sequence) && data.sequence > areaSequence) {
      const insets = safeAreaInsets(data.insets, win.innerWidth, win.innerHeight);
      areaSequence = data.sequence;
      for (const name of ['top', 'right', 'bottom', 'left']) {
        if (insets) win.document.documentElement.style.setProperty(`--frame-safe-area-inset-${name}`, `${insets[name]}px`);
        else win.document.documentElement.style.removeProperty(`--frame-safe-area-inset-${name}`);
      }
      if (insets) send({kind: 'insets-applied', documentNonce, sequence: areaSequence});
      return;
    }
    const entry = pending.get(data.requestId);
    if (!entry || !ready || entry.generation !== generation) return;
    pending.delete(data.requestId); win.clearTimeout(entry.timer);
    if (data.kind === 'error') { entry.reject(Error('FRAME_REQUEST_DENIED')); return; }
    if (data.kind === 'key' || data.kind === 'activity') {
      if (!Number.isFinite(data.expiresAt) || data.expiresAt <= now()) { clear(); entry.reject(Error('FRAME_EXPIRED')); return; }
      expiry = data.expiresAt;
    }
    if (['grant', 'consumed'].includes(data.kind)) {
      if (!Number.isFinite(data.leaseExpiresAt) || data.leaseExpiresAt <= now()) {clear(); entry.reject(Error('FRAME_EXPIRED')); return;}
      expiry = data.leaseExpiresAt;
    }
    entry.resolve(data);
  }
  if (candidate) {
    listen(win.document, 'click', event => {
      const anchor = event.target?.closest?.('a[href]');
      if (event.defaultPrevented || !anchor || anchor.hasAttribute('download') ||
        (anchor.target && anchor.target !== '_self') || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      try {
        const url = new URL(anchor.href, win.location.href);
        if (!['https:', 'http:'].includes(url.protocol)) {if (!['tel:', 'mailto:'].includes(url.protocol)) event.preventDefault(); return;}
        if (url.origin !== win.location.origin) {
          event.preventDefault();
          if (event.isTrusted && !url.username && !url.password) win.open(url.href, '_blank', 'noopener,noreferrer');
          return;
        }
        if (win.parent.vaultFrameNavigation?.navigateFromChild(win, requestingDocument, url.href, false)) event.preventDefault();
      } catch { /* No navigation authority. */ }
    });
    listen(win, 'hashchange', () => {try {win.parent.vaultFrameNavigation?.syncFromChild(win, requestingDocument);} catch {clear();}});
    for (const method of ['replaceState', 'pushState']) {
      const original = win.history[method].bind(win.history);
      const wrapper = (...args) => {
        const result = original(...args);
        try { win.parent.vaultFrameNavigation?.syncFromChild(win, requestingDocument); } catch { /* Parent gone. */ }
        return result;
      };
      win.history[method] = wrapper;
      cleanups.push(() => {if (win.history[method] === wrapper) win.history[method] = original;});
    }
    listen(win, 'message', message);
    listen(win, 'pagehide', clear);
    listen(win, 'vault-frame-revoked', clear);
    listen(win.document, 'freeze', clear);
    listen(win.document, 'visibilitychange', () => {
      if (win.document.visibilityState !== 'hidden') return;
      suspensionGeneration++; suspended = true;
      for (const entry of pending.values()) {win.clearTimeout(entry.timer);entry.reject(Error('FRAME_HIDDEN'));}
      pending.clear();
    });
    send({kind: 'hello', childNonce});
    let lastActivity = 0;
    for (const name of ['pointerdown', 'keydown', 'touchstart', 'wheel']) listen(win.document, name, event => {
      if (!event.isTrusted || !ready || win.document.visibilityState !== 'visible' || now() - lastActivity < 1000) return;
      lastActivity = now(); void request('activity').catch(() => {});
    }, {passive: true});
  }
  return Object.freeze({isChild: () => candidate, isUnlocked: () => ready && !suspended && win.document.visibilityState !== 'hidden' && now() < expiry,
    generation: () => generation, suspensionGeneration: () => suspensionGeneration, whenVisible, request, clear, onClear: callback => {clears.add(callback); return () => clears.delete(callback);},
    lock() { if (candidate && ready) send({documentNonce, command: 'lock', requestId: win.crypto.randomUUID()}); clear(); },
    dispose() { if (disposed) return; clear(); disposed = true; for (const remove of cleanups) remove(); clears.clear(); }
  });
}
