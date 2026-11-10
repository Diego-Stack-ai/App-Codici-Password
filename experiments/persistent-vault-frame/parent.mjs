import {createFrameSession} from './frame-session.mjs';
import {FRAME_PROTOCOL, PRIVATE_FRAME_PATHS, privateFrameUrl} from './frame-policy.mjs';

// A deliberate test adapter, never a client-side production entitlement.
// Production requires an independently verified server permit and real Auth epoch.
if (window.top !== window) throw Error('TOP_LEVEL_REQUIRED');
const frame = document.querySelector('#private-frame');
let enabled = false, identityEpoch = 0, unlocks = 0, confirmations = 0, loadedDocument = null;
const initialRoute = privateFrameUrl(new URL(location.href).searchParams.get('route') || PRIVATE_FRAME_PATHS[0], location.origin);
let route = initialRoute ? initialRoute.pathname + initialRoute.search : PRIVATE_FRAME_PATHS[0];
const actualUrl = () => {try {return frame.contentWindow?.location.href;} catch {return null;}};
const session = createFrameSession({origin: location.origin,
  getFrameWindow: () => frame.contentWindow, getFrameUrl: actualUrl, getFrameDocument: () => frame.contentDocument,
  getIdentity: () => ({uid: 'synthetic-fixture-owner', epoch: identityEpoch}),
  readPermit: async uid => ({uid, enabled, version: 1, expiresAt: Date.now() + 60_000}),
  unlock: async () => {unlocks++; return `synthetic-only-${crypto.randomUUID()}`;},
  confirmSensitive: async () => {confirmations++; render(); return window.confirm('Fixture sintetica: confermi nuovamente questa singola operazione?');},
  onLock: () => {
    loadedDocument = null;
    if (actualUrl() !== 'about:blank') frame.src = 'about:blank';
    queueMicrotask(render);
  },
});
function render() {
  const state = session.state();
  document.querySelector('#state').textContent = enabled
    ? state.unlocked ? 'Fixture abilitata · sessione aperta in RAM' : 'Fixture abilitata · sessione bloccata'
    : 'Fixture disabilitata · accesso negato';
  document.querySelector('#unlocks').value = String(unlocks);
  document.querySelector('#confirmations').value = String(confirmations);
}
function outerUrl(path) {const url = new URL('/app.html', location.origin); url.searchParams.set('route', path); return url;}
function navigate(path, push = false) {
  const url = privateFrameUrl(path, location.origin);
  if (!url) {session.lock('route-denied'); return;}
  route = url.pathname + url.search; loadedDocument = null;
  session.retireDocument();
  history[push ? 'pushState' : 'replaceState'](null, '', outerUrl(route));
  frame.contentWindow.location.replace(url.href);
}
frame.addEventListener('load', () => {
  if (actualUrl() === 'about:blank') {session.lock('empty-document'); return;}
  const url = privateFrameUrl(actualUrl(), location.origin);
  if (!url) {session.lock('route-denied'); return;}
  const loaded = url.pathname + url.search;
  // Native iframe links already create a joint history entry. Do not double it.
  history.replaceState(null, '', outerUrl(loaded)); route = loaded;
  loadedDocument = frame.contentDocument;
  const documentNonce = session.beginDocument();
  if (documentNonce) frame.contentWindow.postMessage({protocol: FRAME_PROTOCOL, kind: 'challenge', documentNonce}, location.origin);
  render();
});
window.addEventListener('message', async event => {
  const data = event.data;
  if (data?.kind === 'hello') {
    if (event.source === frame.contentWindow && event.origin === location.origin &&
      loadedDocument && loadedDocument === frame.contentDocument && privateFrameUrl(actualUrl(), location.origin) &&
      data.protocol === FRAME_PROTOCOL && session.isCurrentDocument(data.documentNonce) && /^[\w-]{16,80}$/.test(data.childNonce || '')) {
      // Echo a nonce created by this child document, so queued replies to an old
      // WindowProxy cannot bootstrap a new document after same-route navigation.
      frame.contentWindow.postMessage({protocol: FRAME_PROTOCOL, kind: 'ready', documentNonce: data.documentNonce, childNonce: data.childNonce}, location.origin);
    }
    return;
  }
  const reply = await session.handle(event);
  if (reply) session.deliver(reply); // Model rechecks actual URL and epoch at delivery.
  render();
});
document.querySelector('#enable').addEventListener('click', () => {enabled = true; navigate(route); render();});
document.querySelector('#disable').addEventListener('click', () => {enabled = false; session.lock('disabled'); render();});
document.querySelector('#lock').addEventListener('click', () => {session.lock('manual'); render();});
document.querySelector('#logout').addEventListener('click', () => {identityEpoch++; enabled = false; session.lock('logout'); render();});
document.querySelector('#resume').addEventListener('click', () => navigate(route));
window.addEventListener('popstate', () => navigate(new URL(location.href).searchParams.get('route') || PRIVATE_FRAME_PATHS[0]));
document.addEventListener('pointerdown', event => {if (event.isTrusted) session.touch();}, {passive: true});
document.addEventListener('keydown', event => {if (event.isTrusted) session.touch();});
document.addEventListener('visibilitychange', () => {session.setVisibility(!document.hidden); render();});
window.addEventListener('pagehide', () => session.lock('pagehide'));
document.addEventListener('freeze', () => session.lock('freeze'));
window.addEventListener('pageshow', event => {if (event.persisted) {session.lock('bfcache'); render();}});
setInterval(() => {session.tick(); render();}, 1000);
session.setVisibility(!document.hidden); navigate(route); render();
