import {FRAME_PROTOCOL, privateFrameUrl, residualInsets, inactivityMilliseconds, invalidInactivityPreference} from './vault-frame-policy.mjs';
import {createFrameSession} from './vault-frame-session.mjs';

// Injectable host, used by the canonical authenticated bootstrap and browser tests.
// No writable client-side admission switch; the production adapter defaults DENY.
export function createVaultFrameOwner({window: win, iframe, release, getIdentity,
  readPermit = async () => null, validateIdentity = async () => false,
  unlock, confirmSensitive, readTimeout = async () => null, clearMaterial = () => {},
  onState = () => {}, onDispose = () => {}}) {
  const origin = win.location.origin;
  let disposed = false, locked = false, nonce = null, route = null, sequence = 0, visibilityEpoch = 0;
  let checking = null, internalClear = false, nextCheck = 0;
  let logoutHold = false, logoutDone = false, logoutTimer = null, queuedExit = null, logoutContext = null;
  const handlers = [], identity = getIdentity;
  const currentUrl = () => {try {return iframe.contentWindow.location.href;} catch {return '';} };
  const currentDocument = () => {try {return iframe.contentDocument;} catch {return null;} };
  const post = data => iframe.contentWindow?.postMessage({protocol: FRAME_PROTOCOL, release, documentNonce: nonce, ...data}, origin);
  const mask = value => { iframe.hidden = false; iframe.style.visibility = value ? 'hidden' : 'visible'; iframe.inert = value; };
  const session = createFrameSession({origin, release, getFrameWindow: () => iframe.contentWindow,
    getFrameUrl: currentUrl, getFrameDocument: currentDocument, getIdentity: identity,
    readPermit, validateIdentity, unlock, confirmSensitive,
    refreshPreference: readTimeout,
    onLock(reason) {
      if (disposed || locked) return;
      locked = true; visibilityEpoch++; mask(true);
      // Revoke immediately, preserving a child that is finishing durable logout.
      if (nonce) post({kind: 'revoke'});
      try {iframe.contentWindow?.dispatchEvent(new win.Event('vault-frame-revoked'));} catch { /* Detached or opaque child. */ }
      nonce = null;
      if (!logoutHold) iframe.remove();
      if (!internalClear) { internalClear = true; try { clearMaterial(); } finally { internalClear = false; } }
      onState({locked: true, reason});
    }
  });
  const isOwnChild = (source, documentObject = currentDocument()) => source === iframe.contentWindow &&
    documentObject === currentDocument() && !!documentObject && !!privateFrameUrl(currentUrl(), origin);
  function outerUrl(url) { const outer = new URL('/app.html', origin); outer.searchParams.set('route', url.pathname + url.search + url.hash); return outer; }
  function navigate(target, replace = false) {
    const url = privateFrameUrl(target, origin);
    if (!url || disposed || locked) return false;
    session.retireDocument(); nonce = null; mask(true); route = url;
    win.history[replace ? 'replaceState' : 'pushState'](null, '', outerUrl(url));
    // replace avoids duplicate iframe + parent history entries.
    iframe.contentWindow.location.replace(url.href);
    return true;
  }
  function exit(target, replace = true) {
    const url = new URL(target, origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return false;
    win.clearTimeout(logoutTimer); logoutHold = false;
    session.lock('exit'); iframe.remove();
    if (replace) win.location.replace(url.href); else win.location.assign(url.href);
    return true;
  }
  function insets() {
    if (!nonce || locked || disposed) return;
    const probe = win.document.querySelector('[data-frame-safe-area]');
    if (!probe) return;
    const computed = win.getComputedStyle(probe), names = ['top', 'right', 'bottom', 'left'];
    const measured = Object.fromEntries(names.map(name => [name, Number.parseFloat(computed.getPropertyValue(`padding-${name}`))]));
    const root = win.document.documentElement;
    const value = residualInsets(measured, {width: root.clientWidth, height: root.clientHeight}, iframe.getBoundingClientRect());
    post({kind: 'insets', sequence: ++sequence, insets: value});
  }
  async function admission() {
    const before = identity(), generation = session.state().generation;
    if (!before) return false;
    const permit = await readPermit(before.uid);
    if (disposed || !await validateIdentity(before)) return false;
    const after = identity();
    return after?.uid === before.uid && after?.epoch === before.epoch &&
      session.renewPermit(permit, before, generation);
  }
  async function message(event) {
    if (disposed || event.origin !== origin || !isOwnChild(event.source)) return;
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    if (typeof data.protocol !== 'string' || !data.protocol.startsWith('vault-frame/')) return;
    if (data.protocol !== FRAME_PROTOCOL || data.release !== release) {
      // Version-skew recovery is standalone; no reload loop in a mismatched shell.
      session.lock('version-mismatch'); if (route) exit(route.href); return;
    }
    if (data.kind === 'hello') {
      if (locked) return;
      if (!nonce) return;
      if (data.documentNonce !== nonce) { post({kind: 'challenge'}); return; }
      if (typeof data.childNonce !== 'string' || !/^[\w-]{16,80}$/.test(data.childNonce)) return;
      const documentToken = nonce, documentObject = currentDocument();
      const ok = await admission();
      if (disposed || locked || nonce !== documentToken || currentDocument() !== documentObject) return;
      if (!ok) { session.lock('admission-denied'); return; }
      post({kind: 'ready', childNonce: data.childNonce}); insets();
      return;
    }
    if (data.kind === 'insets-applied' && data.documentNonce === nonce && data.sequence === sequence && !locked) {
      const token = nonce, seq = sequence, doc = currentDocument();
      const ok = await admission();
      if (disposed || token !== nonce || doc !== currentDocument() || seq !== sequence) return;
      if (!ok) {session.lock('admission-denied'); return;}
      session.tick();
      if (!locked && token === nonce && doc === currentDocument() && seq === sequence && !win.document.hidden) {
        mask(false); post({kind: 'visible', leaseExpiresAt: session.state().expiresAt});
      }
      return;
    }
    const reply = await session.handle(event);
    if (reply) await session.deliver(reply);
  }
  const listen = (surface, name, handler, options) => {surface.addEventListener(name, handler, options); handlers.push(() => surface.removeEventListener(name, handler, options));};
  listen(win, 'message', event => {
    const token = nonce, doc = currentDocument();
    void message(event).catch(() => {if (!disposed && token === nonce && doc === currentDocument()) session.lock('message-failed');});
  });
  listen(iframe, 'load', () => {
    if (disposed || locked) return;
    const url = privateFrameUrl(currentUrl(), origin);
    if (!url) {
      const raw = currentUrl(); session.lock('route-denied');
      try {if (new URL(raw).origin === origin) exit(raw, true);} catch { /* Cross-origin/opaque document stays blocked. */ }
      return;
    }
    route = url; win.history.replaceState(null, '', outerUrl(url));
    nonce = session.beginDocument(); post({kind: 'challenge'});
  });
  listen(win, 'popstate', () => {
    const target = new URL(win.location.href).searchParams.get('route');
    if (!navigate(target || '/home_page.html', true)) session.lock('history-denied');
  });
  listen(win.document, 'visibilitychange', () => {
    mask(true); const epoch = ++visibilityEpoch;
    session.setVisibility(!win.document.hidden);
    if (!win.document.hidden && !locked) void admission().then(ok => {
      if (disposed || epoch !== visibilityEpoch) return;
      session.tick();
      if (!ok) session.lock('resume-denied');
      else if (epoch === visibilityEpoch && !locked && !win.document.hidden) insets();
    }).catch(() => {if (!disposed && epoch === visibilityEpoch) session.lock('resume-denied');});
  });
  for (const name of ['pointerdown', 'keydown']) listen(win.document, name, event => {if (event.isTrusted) session.touch();}, {passive: true});
  listen(win, 'pagehide', () => session.lock('pagehide'));
  listen(win.document, 'freeze', () => session.lock('freeze'));
  listen(win, 'private-auth-blocked', () => session.lock('auth-revoked'));
  listen(win, 'pageshow', event => {if (event.persisted) session.lock('bfcache');});
  for (const name of ['resize', 'orientationchange']) listen(win, name, insets);
  if (win.visualViewport) for (const name of ['resize', 'scroll']) listen(win.visualViewport, name, insets);
  const resizeObserver = win.ResizeObserver ? new win.ResizeObserver(insets) : null;
  resizeObserver?.observe(iframe);
  const timer = win.setInterval(() => {
    session.tick();
    if (!locked && !checking && Date.now() >= nextCheck) { nextCheck = Date.now() + 10000; checking = admission().then(ok => {if (!disposed && !ok) session.lock('admission-revoked');})
      .catch(() => {if (!disposed) session.lock('admission-unavailable');}).finally(() => {checking = null;}); }
  }, 1000);
  const facade = Object.freeze({
    navigateFromChild(source, documentObject, target, replace) {
      if (!isOwnChild(source, documentObject)) return false;
      if (logoutHold && documentObject !== logoutContext?.documentObject) return false;
      if (logoutHold && !logoutDone) {queuedExit = {target, replace}; return true;}
      return privateFrameUrl(target, origin) ? navigate(target, replace) : exit(target, replace);
    },
    beginLogoutFromChild(source, documentObject, kind = 'logout') {
      if (!isOwnChild(source, documentObject)) return false;
      if (!['logout', 'vault-reset'].includes(kind)) return false;
      if (logoutHold && logoutContext?.documentObject === documentObject && !logoutDone) return logoutContext.token;
      logoutHold = true; logoutDone = false;
      logoutContext = {documentObject, kind, token: win.crypto.randomUUID()};
      win.clearTimeout(logoutTimer);
      logoutTimer = win.setTimeout(() => {
        if (disposed) return;
        if (logoutContext.kind === 'logout') exit(queuedExit?.target || '/login.html', true);
        else {logoutHold = false; iframe.remove();}
      }, 20000);
      return logoutContext.token;
    },
    finishLogoutFromChild(source, documentObject, token) {
      if (isOwnChild(source, documentObject) && logoutContext?.documentObject === documentObject && logoutContext.token === token) {
        logoutDone = true; logoutContext.token = null;
      }
    },
    finishCleanupFromChild(source, documentObject, token) {
      if (!isOwnChild(source, documentObject) || logoutContext?.kind !== 'vault-reset' || logoutContext.documentObject !== documentObject || logoutContext.token !== token) return;
      logoutContext.token = null; logoutHold = false; win.clearTimeout(logoutTimer); iframe.remove();
    },
    deferExit(target, replace = true) {
      if (!logoutHold) return false;
      queuedExit = {target, replace}; return true;
    },
    revokeFromChild(source, documentObject) {if (isOwnChild(source, documentObject)) session.lock('child-revoked');},
    syncFromChild(source, documentObject) {
      if (!isOwnChild(source, documentObject) || locked) return;
      route = privateFrameUrl(currentUrl(), origin); win.history.replaceState(null, '', outerUrl(route));
    }
  });
  win.vaultFrameNavigation = facade;
  return Object.freeze({session, async start(target) {
    mask(true);
    if (!await admission()) {session.lock('admission-denied'); return false;}
    const minutes = await readTimeout();
    if (disposed || locked || !await admission()) return false;
    session.setTimeouts(inactivityMilliseconds(minutes), invalidInactivityPreference(minutes));
    session.setVisibility(!win.document.hidden);
    const started = navigate(target, true);
    if (started) onState({locked: false});
    return started;
  }, updatePreference(value) {
    if (!disposed && !locked) session.setTimeouts(inactivityMilliseconds(value), invalidInactivityPreference(value));
  }, resume() {if (logoutHold) return true; if (!route) return false; session.lock('reload'); win.location.reload(); return true;}, dispose() {
    session.lock('dispose'); iframe.remove(); disposed = true; win.clearInterval(timer); win.clearTimeout(logoutTimer); resizeObserver?.disconnect();
    for (const remove of handlers) remove(); if (win.vaultFrameNavigation === facade) delete win.vaultFrameNavigation; onDispose();
  }});
}
