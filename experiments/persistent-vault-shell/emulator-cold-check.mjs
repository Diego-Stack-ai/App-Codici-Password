const byId = id => document.getElementById(id);
const assert = (condition, code) => { if (!condition) throw new Error(code); };
const wait = async (predicate, code) => {
    for (let i = 0; i < 400; i++) { if (predicate()) return; await new Promise(done => setTimeout(done, 50)); }
    throw new Error(`TIMEOUT_${code}: ${byId('message')?.textContent}`);
};
let serial = 0;
const pending = new Map();
window.__entryNetworkDone = (id, ok) => { const item = pending.get(id); pending.delete(id); ok ? item?.resolve() : item?.reject(new Error('NETWORK_CONTROL_FAILED')); };
const network = async offline => {
    await wait(() => typeof window.__entryNetworkControl === 'function', 'NETWORK_CONTROL');
    await new Promise((resolve, reject) => { const id = ++serial; pending.set(id, {resolve, reject}); window.__entryNetworkControl(JSON.stringify({id, offline})); });
    await wait(() => navigator.onLine === !offline, 'NETWORK_STATE');
};
const unlock = async () => {
    byId('unlock').click();
    await wait(() => byId('master-dialog').open, 'MASTER_PROMPT');
    byId('unlock-value').value = 'MASTER-FITTIZIA-A!123';
    byId('master-dialog').querySelector('form').requestSubmit();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="banca"]'), 'BANK_LIST');
};
try {
    const {runOfflineConsultationProbe} = await import('/emulator.js');
    // Only a phase marker survives reload; no Vault key or decrypted data.
    const resumed = sessionStorage.getItem('synthetic-cold-phase') === 'reload';
    if (!resumed) {
        await wait(() => byId('login') && !byId('login').disabled, 'LOGIN');
        byId('login').click();
        await wait(() => byId('status').textContent.includes('bloccato') && !byId('unlock').disabled, 'AUTH');
        await unlock();
        await runOfflineConsultationProbe();
        await navigator.serviceWorker.register('/emulator-cold-sw.js');
        await navigator.serviceWorker.ready;
        await wait(() => navigator.serviceWorker.controller, 'SW_CONTROLLER');
        sessionStorage.setItem('synthetic-cold-phase', 'reload');
        await network(true);
        location.reload();
    } else {
        // DevTools keeps requests blocked across reload, but Chromium can reset
        // navigator.onLine in the new context. Reapply the same network state.
        await network(true);
        assert(!navigator.onLine, 'RELOAD_WAS_ONLINE');
        assert(navigator.serviceWorker.controller, 'NO_CACHED_SHELL');
        assert(performance.getEntriesByType('navigation')[0]?.type === 'reload', 'NOT_A_REAL_RELOAD');
        await wait(() => byId('status').textContent.includes('bloccato') && !byId('unlock').disabled, 'RESTORED_AUTH');
        assert(!byId('content').children.length, 'RESTORED_UNLOCKED_VIEW');
        let denied = false;
        try { await runOfflineConsultationProbe(); } catch (error) { denied = error.message === 'PROBE_SESSION'; }
        assert(denied, 'RESTORED_VAULT_KEY');
        let blocked = false;
        try { await fetch('/never-cached', {cache: 'no-store'}); } catch { blocked = true; }
        assert(blocked, 'NETWORK_NOT_BLOCKED');
        await unlock();
        const domains = await runOfflineConsultationProbe();
        await network(false);
        assert(JSON.stringify(await runOfflineConsultationProbe()) === JSON.stringify(domains), 'RECONNECT_MATRIX');
        byId('logout').click();
        await wait(() => byId('status').textContent === 'Accesso non effettuato' && !byId('login').disabled, 'LOGOUT');
        denied = false;
        try { await runOfflineConsultationProbe(); } catch (error) { denied = error.message === 'PROBE_SESSION'; }
        assert(denied && !byId('content').children.length, 'LOGOUT_CACHE_ACCESS');
        sessionStorage.removeItem('synthetic-cold-phase');
        await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: true, browser: navigator.userAgent,
            passed: ['static laboratory shell reloads without network', 'Firebase identity restored from persistent storage',
                'reloaded Vault remains locked and denies consultation', 'uncached HTTP remains blocked', 'new Master Password prompt required',
                ...domains.map(domain => `persistent cached decryption after reload: ${domain}`),
                'domain matrix readable after reconnect', 'logout denies persistent cache consultation']})});
    }
} catch (error) {
    window.__coldFailure = error.message;
    await network(false).catch(() => {});
    sessionStorage.removeItem('synthetic-cold-phase');
    await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: false, code: error.message})});
}
