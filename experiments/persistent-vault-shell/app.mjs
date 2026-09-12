import {createMemoryVault} from './memory-vault.mjs';
import {createRouter} from './router.mjs';
import {createFixture, decryptRecord} from './fixture.mjs';

const view = document.querySelector('#view');
const status = document.querySelector('#status');
const unlock = document.querySelector('#unlock');
const fixture = await createFixture();
let router, mounts = 0, cleanups = 0;
const vault = createMemoryVault({
    unlockKey: fixture.unlockKey, decryptRecord,
    onLock(reason) {
        router?.stop();
        view.replaceChildren();
        status.textContent = reason === 'logout' ? 'Demo terminata' : 'Vault bloccata';
    }
});
const route = () => location.hash === '#account' ? 'account' : 'overview';
function element(tag, text, className) {
    const node = document.createElement(tag);
    node.textContent = text;
    if (className) node.className = className;
    return node;
}
function counters() {
    document.querySelector('#mounts').textContent = `Viste montate: ${mounts} · Viste smontate: ${cleanups}`;
}
async function mount({signal, route: name}) {
    mounts++;
    counters();
    const container = element('div', '');
    view.replaceChildren(container);
    const heading = element('h2', name === 'account' ? 'Account demo' : 'Panoramica');
    container.append(heading);
    for (const link of document.querySelectorAll('nav a')) {
        if (link.hash === `#${name}`) link.setAttribute('aria-current', 'page');
        else link.removeAttribute('aria-current');
    }
    const cleanup = () => { container.replaceChildren(); container.remove(); cleanups++; counters(); };
    signal.addEventListener('abort', () => container.replaceChildren(), {once: true});
    if (!vault.isUnlocked()) container.append(element('p', 'Sblocca la demo per leggere i dati fittizi.'));
    else {
        try {
            const value = await vault.read('demo-user', fixture.records[name]);
            if (!signal.aborted) container.append(element('p', value, 'secret'));
        } catch {
            if (!signal.aborted) container.append(element('p', 'Sessione scaduta. Sblocca nuovamente la demo.'));
        }
    }
    return cleanup;
}
router = createRouter({routes: {overview: mount, account: mount}, onError: () => vault.lock('error')});
unlock.disabled = false;
unlock.addEventListener('click', async () => {
    unlock.disabled = true;
    try {
        await vault.unlock('demo-user');
        status.textContent = 'Vault sbloccata · chiave solo in memoria';
        await router.navigate(route());
    } catch { status.textContent = 'Sblocco annullato. Riprova.'; }
    finally { unlock.disabled = false; }
});
document.querySelector('#lock').addEventListener('click', () => { vault.lock(); router.navigate(route()); });
document.querySelector('#logout').addEventListener('click', () => { vault.lock('logout'); router.navigate(route()); });
window.addEventListener('hashchange', () => router.navigate(route()));
// Lock before a page can enter the browser's back/forward cache.
window.addEventListener('pagehide', () => vault.lock('pagehide'));
window.addEventListener('pageshow', event => {
    if (event.persisted) { vault.lock('pageshow'); router.navigate(route()); }
});
document.addEventListener('visibilitychange', () => { if (!document.hidden) vault.isUnlocked(); });
for (const event of ['pointerdown', 'keydown']) document.addEventListener(event, () => vault.touch(), {passive: true});
setInterval(() => vault.isUnlocked(), 500);
status.textContent = 'Vault bloccata';
router.navigate(route());
