import {FRAME_PROTOCOL, PRIVATE_FRAME_PATHS} from './frame-policy.mjs';
import {createChildMaterial} from './child-material.mjs';

// Transient child RAM copy; never DOM, storage, URLs or logs.
let documentNonce = null, active = true, lastActivity = 0;
const material = createChildMaterial();
const pending = new Map(), origin = location.origin, childNonce = crypto.randomUUID();
document.querySelector('#route').textContent = location.pathname;
const access = document.querySelector('#access');
for (const path of PRIVATE_FRAME_PATHS) {
  const link = document.createElement('a'); link.href = path; link.textContent = path;
  document.querySelector('#routes').append(link);
}
function request(command, extra = {}) {
  if (!active || !documentNonce || parent === window) return Promise.reject(Error('NO_FRAME_SESSION'));
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {pending.delete(requestId); reject(Error('REQUEST_TIMEOUT'));}, 10_000);
    pending.set(requestId, {resolve, reject, timer});
    parent.postMessage({protocol: FRAME_PROTOCOL, documentNonce, requestId, command, ...extra}, origin);
  });
}
function clear() {
  material.clear(); documentNonce = null;
  for (const item of pending.values()) {clearTimeout(item.timer); item.reject(Error('SESSION_RETIRED'));}
  pending.clear();
}
async function acquire() {
  const epoch = material.epoch(), challenge = documentNonce;
  const current = () => active && material.epoch() === epoch && documentNonce === challenge;
  try {
    const accepted = await material.acquire(async () => (await request('key')).material);
    if (current()) access.textContent = accepted ? 'Accesso sintetico aperto' : 'Accesso negato o sessione bloccata';
  } catch {if (current()) {material.clear(); access.textContent = 'Accesso negato o sessione bloccata';}}
}
window.addEventListener('message', event => {
  if (event.source !== parent || event.origin !== origin || event.data?.protocol !== FRAME_PROTOCOL || !active) return;
  const data = event.data;
  if (data.kind === 'challenge' && /^[\w-]{16,80}$/.test(data.documentNonce || '')) {
    parent.postMessage({protocol: FRAME_PROTOCOL, kind: 'hello', documentNonce: data.documentNonce, childNonce}, origin); return;
  }
  if (data.kind === 'ready' && data.childNonce === childNonce && /^[\w-]{16,80}$/.test(data.documentNonce || '')) {
    clear(); documentNonce = data.documentNonce; acquire(); return;
  }
  if (data.documentNonce !== documentNonce) return;
  const item = pending.get(data.requestId);
  if (!item) return;
  pending.delete(data.requestId); clearTimeout(item.timer);
  if (data.kind === 'error') item.reject(Error(data.code)); else item.resolve(data);
});
document.querySelector('#retry').addEventListener('click', acquire);
document.querySelector('#child-lock').addEventListener('click', () => {
  request('lock').catch(() => {}); clear(); access.textContent = 'Sessione bloccata';
});
document.querySelector('#sensitive').addEventListener('click', async () => {
  const action = document.querySelector('#action');
  if (!material.isOpen()) {action.textContent = 'Sblocco richiesto'; return;}
  const epoch = material.epoch(), challenge = documentNonce;
  const current = () => active && material.epoch() === epoch && documentNonce === challenge;
  try {
    const intent = {purpose: 'backup-export', target: 'synthetic-vault'};
    const grant = await request('fresh', intent);
    if (!current()) return;
    const result = await request('consume', {...intent, grant: grant.grant});
    if (current()) action.textContent = result.kind === 'consumed' ? 'Operazione sintetica autorizzata una volta' : 'Operazione negata';
  } catch {if (current()) action.textContent = 'Operazione annullata o negata';}
});
const activity = event => {
  if (!event.isTrusted || !material.isOpen() || Date.now() - lastActivity < 1000) return;
  lastActivity = Date.now(); request('activity').catch(() => {});
};
document.addEventListener('pointerdown', activity, {passive: true});
document.addEventListener('keydown', activity);
window.addEventListener('pagehide', () => {active = false; clear();});
document.addEventListener('freeze', () => {active = false; clear();});
