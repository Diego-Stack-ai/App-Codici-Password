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
const pendingNote = 'Nota sintetica conservata prima di arresto forzato';
const button = label => [...byId('content').querySelectorAll('button')].find(item => item.textContent === label);
try {
    const {runOfflineConsultationProbe} = await import('/emulator.js');
    // Only a phase marker survives reload; no Vault key or decrypted data.
    const restartPhase = window.__entryRestartPhase;
    const resumed = restartPhase === 'resume' || sessionStorage.getItem('synthetic-cold-phase') === 'reload';
    if (!resumed) {
        await wait(() => byId('login') && !byId('login').disabled, 'LOGIN');
        byId('login').click();
        await wait(() => byId('status').textContent.includes('bloccato') && !byId('unlock').disabled, 'AUTH');
        await unlock();
        await runOfflineConsultationProbe();
        await navigator.serviceWorker.register('/emulator-cold-sw.js');
        await navigator.serviceWorker.ready;
        await wait(() => navigator.serviceWorker.controller, 'SW_CONTROLLER');
        if (restartPhase === 'prepare') {
            if (window.__entryForced) {
                document.querySelector('[data-action="navigate"][data-id="alfa"]').click();
                await wait(() => byId('content').querySelector('textarea') && button('Salva nota') && !button('Salva nota').disabled, 'CRASH_EDITOR');
                await network(true);
                byId('content').querySelector('textarea').value = pendingNote;
                button('Salva nota').click();
                await wait(() => byId('content').textContent.includes('Modifica conservata sul dispositivo'), 'CRASH_QUEUE');
                // Out-of-band test report: no network restoration before termination.
                window.__entryResult(JSON.stringify({ok: true, phase: 'prepared'}));
            } else await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: true, phase: 'prepared'})});
        } else {
            sessionStorage.setItem('synthetic-cold-phase', 'reload');
            await network(true);
            location.reload();
        }
    } else {
        // DevTools keeps requests blocked across reload, but Chromium can reset
        // navigator.onLine in the new context. Reapply the same network state.
        await network(true);
        assert(!navigator.onLine, 'RELOAD_WAS_ONLINE');
        assert(navigator.serviceWorker.controller, 'NO_CACHED_SHELL');
        assert(performance.getEntriesByType('navigation')[0]?.type === (restartPhase ? 'navigate' : 'reload'), 'UNEXPECTED_NAVIGATION');
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
        const originalDocument = document;
        byId('profile').click();
        await wait(() => byId('content').textContent.includes('Nome fittizio'), 'COLD_PROFILE');
        document.querySelector('[data-profile-section="contacts"]').click();
        await wait(() => byId('content').textContent.includes('fixture@example.invalid') && byId('content').textContent.includes('000000000'), 'COLD_PROFILE_CONTACTS');
        assert(document === originalDocument, 'COLD_PROFILE_RELOAD');
        byId('private').click();
        await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'COLD_PROFILE_RETURN');
        if (window.__entryForced) {
            document.querySelector('[data-action="navigate"][data-id="alfa"]').click();
            await wait(() => byId('content').textContent.includes('già conservata sul dispositivo'), 'CRASH_QUEUE_RECOVERY');
            assert(byId('content').querySelector('textarea').readOnly && button('Salva nota').hidden, 'CRASH_NEW_COMMAND');
        }
        await network(false);
        if (window.__entryForced) {
            button('Riprova sincronizzazione').click();
            await wait(() => byId('content').textContent.includes('Nota salvata.') &&
                [...byId('content').querySelectorAll('pre')].some(item => item.textContent === pendingNote), 'CRASH_QUEUE_SYNC');
        }
        assert(JSON.stringify(await runOfflineConsultationProbe()) === JSON.stringify(domains), 'RECONNECT_MATRIX');
        byId('logout').click();
        await wait(() => byId('status').textContent === 'Accesso non effettuato' && !byId('login').disabled, 'LOGOUT');
        denied = false;
        try { await runOfflineConsultationProbe(); } catch (error) { denied = error.message === 'PROBE_SESSION'; }
        assert(denied && !byId('content').children.length, 'LOGOUT_CACHE_ACCESS');
        sessionStorage.removeItem('synthetic-cold-phase');
        await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: true, browser: navigator.userAgent,
            passed: [restartPhase ? 'static laboratory shell starts offline in a new browser process' : 'static laboratory shell reloads without network', 'Firebase identity restored from persistent storage',
                'reloaded Vault remains locked and denies consultation', 'uncached HTTP remains blocked', 'new Master Password prompt required', 'profile identity and contacts render offline after restart without a prior profile visit',
                ...domains.map(domain => `persistent cached decryption after reload: ${domain}`),
                ...(window.__entryForced ? ['offline pending note recovered after forced termination', 'recovered note synchronized explicitly after reconnect'] : []),
                'domain matrix readable after reconnect', 'logout denies persistent cache consultation']})});
    }
} catch (error) {
    window.__coldFailure = error.message;
    await network(false).catch(() => {});
    sessionStorage.removeItem('synthetic-cold-phase');
    await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: false, code: error.message})});
}
