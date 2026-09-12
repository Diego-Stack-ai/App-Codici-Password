import {createMemoryVault} from './memory-vault.mjs';
import {createFixture, decryptRecord} from './fixture.mjs';
import {mountRealList, createProtectedSession} from './real-lists.mjs';

const view = document.querySelector('#view');
const status = document.querySelector('#status');
const unlock = document.querySelector('#unlock');
const fixture = await createFixture();
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').then(() => navigator.serviceWorker.ready).then(() => {
        document.querySelector('#offline').textContent = 'Demo disponibile anche offline';
    }).catch(() => { document.querySelector('#offline').textContent = 'Demo offline non disponibile'; });
} else document.querySelector('#offline').textContent = 'Browser senza supporto offline';
let mounts = 0, cleanups = 0;
let demoUser = {uid: 'demo-user'}, identityObserver;
const route = () => ['account', 'private', 'company'].includes(location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}
function counters() {
    document.querySelector('#mounts').textContent = `Viste montate: ${mounts} · Viste smontate: ${cleanups}`;
}
async function mount({signal, route: name, unlocked, read}) {
    mounts++;
    counters();
    const container = element('div', '');
    view.replaceChildren(container);
    let disposeList;
    const heading = element('h2', {overview: 'Panoramica', account: 'Account demo', private: 'Account privati · dati fittizi', company: 'Account aziendali · dati fittizi'}[name]);
    container.append(heading);
    for (const link of document.querySelectorAll('nav a')) {
        if (link.hash === `#${name}`) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
    const cleanup = () => { disposeList?.(); container.replaceChildren(); container.remove(); cleanups++; counters(); };
    signal.addEventListener('abort', () => container.replaceChildren(), {once: true});
    if (!unlocked) container.append(element('p', 'Sblocca la demo per leggere i dati fittizi.'));
    else {
        try {
            const isList = name === 'private' || name === 'company';
            const value = await read(fixture.records[isList ? 'lists' : name]);
            if (!signal.aborted) {
                if (isList) {
                    container.replaceChildren();
                    disposeList = await mountRealList(container, JSON.parse(value), {signal, company: name === 'company'});
                } else container.append(element('p', value, 'secret'));
            }
        } catch {
            if (!signal.aborted) container.append(element('p', 'Sessione scaduta. Sblocca nuovamente la demo.'));
        }
    }
    return cleanup;
}
const session = createProtectedSession({
    getUser: () => demoUser,
    subscribeUser: listener => { identityObserver = listener; return () => { identityObserver = null; }; },
    createVault: callbacks => createMemoryVault({unlockKey: fixture.unlockKey, decryptRecord, ...callbacks}),
    routes: {overview: mount, account: mount, private: mount, company: mount},
    onState({state}) {
        if (state !== 'unlocked') view.replaceChildren();
        status.textContent = state === 'unlocked' ? 'Vault sbloccata · chiave solo in memoria'
            : state === 'signed-out' ? 'Demo terminata' : 'Vault bloccata';
    }
});
unlock.disabled = false;
unlock.addEventListener('click', async () => {
    unlock.disabled = true;
    try {
        if (!demoUser) { demoUser = {uid: 'demo-user'}; identityObserver?.(); }
        await session.unlock();
        await session.navigate(route());
    } catch { status.textContent = demoUser ? 'Sblocco annullato. Riprova.' : 'Demo terminata'; }
    finally { unlock.disabled = false; }
});
document.querySelector('#lock').addEventListener('click', () => { session.lock(); session.navigate(route()); });
document.querySelector('#logout').addEventListener('click', async () => {
    await session.logout(async () => { demoUser = null; identityObserver?.(); });
    session.navigate(route());
});
window.addEventListener('hashchange', () => session.navigate(route()));
// Lock before a page can enter the browser's back/forward cache.
window.addEventListener('pagehide', () => session.lock('pagehide'));
window.addEventListener('pageshow', event => {
    if (event.persisted) { session.lock('pageshow'); session.navigate(route()); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) session.check(); });
for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => session.touch(), {passive: true});
setInterval(() => session.check(), 500);
status.textContent = 'Vault bloccata';
session.navigate(route());
