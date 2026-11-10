import {privateFrameUrl} from './vault-frame-policy.mjs';

export const FRAME_PUSH_PROTOCOL = 'vault-frame-push/v1';
export const FRAME_PUSH_TIMEOUT_MS = 1500;
export function framePushPath(value, origin) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//')) return null;
  const url = privateFrameUrl(value, origin);
  if (!url || url.hash || !['/home_page.html','/scadenze.html','/dettaglio_scadenza.html'].includes(url.pathname)) return null;
  if (url.pathname !== '/dettaglio_scadenza.html') return url.search ? null : url.pathname;
  const keys = [...url.searchParams.keys()];
  if (keys.some(key => !['id','received','notification'].includes(key)) ||
      url.searchParams.has('id') === url.searchParams.has('received')) return null;
  return url.pathname + url.search;
}
function messagingScript(value, origin) {
  try {const url = new URL(value); return url.origin === origin && url.pathname === '/firebase-messaging-sw.js' && !url.search && !url.hash && !url.username && !url.password;}
  catch {return false;}
}
export function messagingRegistration(registration, origin) {
  try {
    const url = new URL(registration.scope);
    return url.origin === origin && !url.search && !url.hash && !url.username && !url.password &&
      /^\/firebase-cloud-messaging-push-scope(?:-r[1-9]\d*)?\/?$/.test(url.pathname) && messagingScript(registration.active?.scriptURL, origin);
  } catch {return false;}
}

export function installFramePushNavigation({window: win, owner, now = Date.now}) {
  const workers = win.navigator?.serviceWorker, document = win.document, origin = win.location.origin;
  if (!workers || win.parent !== win || win.location.pathname !== '/app.html') return () => {};
  const seen = new Map(); let disposed = false, current = null;
  const handler = event => {
    const data = event.data, port = event.ports?.[0];
    const close = () => {for (const item of event.ports || []) {try {item.close();} catch { /* Detached port. */ }}};
    if (disposed || event.isTrusted !== true || event.origin !== origin || !messagingScript(event.source?.scriptURL, origin) ||
        !data || Array.isArray(data) || Object.keys(data).sort().join(',') !== 'expiresAt,kind,path,protocol,requestId' ||
        data.protocol !== FRAME_PUSH_PROTOCOL || data.kind !== 'navigate' || typeof data.requestId !== 'string' ||
        !/^[\w-]{16,80}$/.test(data.requestId) || !Number.isSafeInteger(data.expiresAt) ||
        data.expiresAt <= now() || data.expiresAt > now() + FRAME_PUSH_TIMEOUT_MS || event.ports?.length !== 1 || !port || seen.has(data.requestId)) {close(); return;}
    const path = framePushPath(data.path, origin);
    if (!path || path !== data.path) {close(); return;}
    for (const [id, deadline] of seen) if (deadline <= now()) seen.delete(id);
    if (seen.size >= 64) {close(); return;}
    seen.set(data.requestId, data.expiresAt);
    current?.finish(false);
    const record = {done: false, registration: null}; current = record;
    const active = () => !disposed && !record.done && current === record && win.document === document && now() < data.expiresAt &&
      (!record.registration || (record.registration.active === event.source && event.source.state === 'activated'));
    let timer;
    record.finish = accepted => {
      if (record.done) return; record.done = true; win.clearTimeout(timer);
      try {port.postMessage({protocol: FRAME_PUSH_PROTOCOL, kind: 'ack', requestId: data.requestId, path, accepted: accepted === true});}
      catch { /* The worker may already have timed out. */ }
      close(); if (current === record) current = null;
    };
    timer = win.setTimeout(() => record.finish(false), Math.max(0, data.expiresAt - now()));
    void owner.navigateFromPush(path, {expiresAt: data.expiresAt, isActive: active, validateSource: async () => {
      const registrations = await workers.getRegistrations();
      record.registration = registrations.find(registration => messagingRegistration(registration, origin) && registration.active === event.source);
      return active() && !!record.registration;
    }}).then(accepted => record.finish(accepted)).catch(() => record.finish(false));
  };
  workers.addEventListener('message', handler);
  // FCM has a separate registration; updating sw.js alone does not update it.
  void workers.getRegistrations().then(registrations => {
    if (disposed) return;
    for (const registration of registrations) if (messagingRegistration(registration, origin)) void registration.update().catch(() => {});
  }).catch(() => {});
  return () => {disposed = true; workers.removeEventListener('message', handler); current?.finish(false); seen.clear();};
}
