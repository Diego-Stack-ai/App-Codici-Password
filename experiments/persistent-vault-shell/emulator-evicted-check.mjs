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
    await wait(() => document.querySelector('[data-action="navigate"][data-id="banca"]'), 'UNLOCKED_VIEW');
};
const locked = () => byId('status')?.textContent.includes('bloccato') && !byId('unlock')?.disabled;
const loginVisible = () => Boolean(byId('login')) && !byId('login').disabled;
// Solo marcatori sintetici testuali: in questo laboratorio non esiste alcun dato reale.
const PRIVATE_MARKERS = ['IBAN-FITTIZIO', 'IBAN-SECONDO', 'SEGRETO-FITTIZIO', 'Nome fittizio', 'Azienda fittizia',
    'fixture@example.invalid', 'WIDGET-FITTIZIO', 'SCADENZA-FITTIZIA', 'ALLEGATO-FITTIZIO', 'POD-FITTIZIO'];
const domLeaks = () => PRIVATE_MARKERS.filter(marker => document.body.textContent.includes(marker));
const note = value => { try { sessionStorage.setItem('synthetic-evicted-note', value); } catch { /* diagnostica locale */ } };
const databaseNames = async () => { try { return (await indexedDB.databases()).map(entry => entry.name); } catch { return ['(enumerazione non disponibile)']; } };
const deleteDatabase = name => new Promise(resolve => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = request.onerror = request.onblocked = () => resolve();
});
const probeOnce = async () => {
    try {
        const {runOfflineConsultationProbe} = await import('/emulator.js');
        return {ok: true, domains: await runOfflineConsultationProbe({includeAttachmentMetadata: false})};
    } catch (error) { return {ok: false, code: error.message}; }
};
const report = (ok, passed, extra = {}) => fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok, passed, ...extra})});
const step = async (name, action) => {
    sessionStorage.setItem('synthetic-evicted-step', name);
    try { return await action(); }
    catch (error) { throw new Error(`${name}: ${error?.message ?? error}`); }
};
try {
    const phase = window.__entryRestartPhase;
    if (phase === 'prepare') {
        // ── Prepare (online): Vault pronto e preparazione offline, poi espulsione della sola cache applicativa ──
        await step('login', () => wait(() => loginVisible(), 'LOGIN'));
        byId('login').click();
        await step('auth', () => wait(() => locked(), 'AUTH'));
        await step('unlock', () => unlock());
        await step('offline-preparation', () => wait(() => byId('offline-status').dataset.state === 'ready', 'AUTOMATIC_OFFLINE_PREPARATION'));
        await step('service-worker', async () => {
            await navigator.serviceWorker.register('/emulator-cold-sw.js');
            await navigator.serviceWorker.ready;
            await wait(() => navigator.serviceWorker.controller, 'SW_CONTROLLER');
        });
        const cachesBefore = await caches.keys();
        const databasesBefore = await databaseNames();
        assert(cachesBefore.length > 0, 'SHELL_CACHE_MISSING');
        const firestore = databasesBefore.filter(name => /firestore/i.test(name));
        assert(firestore.length > 0, 'NO_FIRESTORE_CACHE_OBSERVED');
        note(`prepare: cache del browser = ${JSON.stringify(cachesBefore)}; database IndexedDB = ${JSON.stringify(databasesBefore)}; cache applicativa espulsa = ${JSON.stringify(firestore)}`);
        for (const name of firestore) await deleteDatabase(name);
        note(`prepare: database residui dopo l’espulsione = ${JSON.stringify(await databaseNames())}`);
        // Il processo browser viene terminato dal banco: nessuna scrittura successiva, nessun
        // riavvio automatico della preparazione. La cache del browser resta intatta.
        sessionStorage.setItem('synthetic-evicted-phase', 'resume');
        await report(true, ['prepare: Vault sbloccato e preparazione offline completata prima dell’espulsione',
            `prepare: cache del browser e database IndexedDB enumerati; espulsa la sola cache applicativa (${firestore.length} database)`],
        {phase: 'prepared', notes: [sessionStorage.getItem('synthetic-evicted-note') ?? '']});
    } else {
        // ── Resume (processo nuovo, rete assente): shell dalla cache, Vault chiuso, cache applicativa espulsa ──
        await step('offline', () => network(true));
        assert(navigator.serviceWorker.controller, 'NO_CACHED_SHELL_AFTER_EVICTION');
        const cachesNow = await caches.keys();
        assert(cachesNow.length > 0, 'BROWSER_CACHE_EVICTED_TOO');
        assert(Boolean(await caches.match('/')), 'SHELL_NOT_IN_BROWSER_CACHE');
        assert(domLeaks().length === 0, `LEAK_AFTER_DATA_EVICTION:${domLeaks().join('|')}`);
        // Il ripristino dell'identità persistita è asincrono: si attende che l'app si assesti
        // (Vault bloccato oppure pagina di accesso) prima di decidere quale ramo esercitare.
        await step('auth-settled', () => wait(() => locked() || loginVisible(), 'AUTH_SETTLED'));
        const identity = loginVisible() ? 'identità Firebase assente' : 'identità Firebase ripristinata';
        const lockedProbe = await step('locked-probe', () => probeOnce());
        assert(!lockedProbe.ok && lockedProbe.code === 'PROBE_SESSION', `EVICTED_LOCKED_ACCESS:${lockedProbe.code}`);
        assert(locked() || loginVisible(), 'EVICTED_STATE_UNEXPECTED');
        assert(byId('content').children.length === 0, 'EVICTED_LOCKED_VIEW');
        const preparation = byId('offline-status').dataset.state;
        let detail = `resume: ${identity}; cache del browser = ${JSON.stringify(cachesNow)}; database IndexedDB = ${JSON.stringify(await databaseNames())}; Vault chiuso e consultazione rifiutata con PROBE_SESSION; stato della preparazione offline = ${preparation}`;
        if (loginVisible()) {
            detail += '; senza identità persistita il Vault resta inaccessibile offline';
        } else {
            await step('unlock', () => unlock());
            const afterEviction = await step('evicted-probe', () => probeOnce());
            assert(!afterEviction.ok, 'EVICTED_CACHE_INVENTED_DATA');
            assert(domLeaks().length === 0, `LEAK_AFTER_EVICTED_UNLOCK:${domLeaks().join('|')}`);
            const message = (byId('message')?.textContent || '').trim().slice(0, 160);
            detail += `; dopo lo sblocco la consultazione rifiuta con ${afterEviction.code}${message ? ` («${message}»)` : ''}`;
            const bankLink = document.querySelector('[data-action="navigate"][data-id="banca"]');
            if (bankLink) {
                bankLink.click();
                await new Promise(done => setTimeout(done, 1500));
                assert(domLeaks().length === 0, `LEAK_BANK_PAGE_EVICTED:${domLeaks().join('|')}`);
                detail += `; vista bancaria senza cache: ${(byId('content')?.textContent || '').trim().slice(0, 160) || '(vuota)'}`;
            } else detail += '; senza cache la lista non offre la voce bancaria';
        }
        // Espulsione della cache del browser nella stessa sessione: la shell non è più in cache.
        for (const name of await caches.keys()) await caches.delete(name);
        assert((await caches.keys()).length === 0, 'CACHE_NOT_EVICTED');
        assert(!(await caches.match('/')), 'SHELL_STILL_IN_BROWSER_CACHE');
        assert(domLeaks().length === 0, `LEAK_AFTER_FULL_EVICTION:${domLeaks().join('|')}`);
        detail += '; dopo l’espulsione della cache del browser la shell non è più disponibile dalla cache';
        // Il referto viaggia sulla rete: la si ripristina prima di riportare, come nel banco a freddo.
        await step('report-network', () => network(false));
        sessionStorage.removeItem('synthetic-evicted-phase');
        sessionStorage.removeItem('synthetic-evicted-step');
        sessionStorage.removeItem('synthetic-evicted-note');
        await report(true, ['resume: la shell arriva dalla cache del browser con la cache applicativa espulsa (shell, dati e Storage distinti)',
            'resume: con il Vault chiuso la consultazione è rifiutata (PROBE_SESSION) e nessun marcatore privato compare',
            'resume: con la cache applicativa espulsa la consultazione offline non inventa dati (rifiuto esplicito) e nessun marcatore privato compare',
            'resume: dopo l’espulsione della cache del browser la shell non è più disponibile dalla cache e nessun marcatore privato compare',
            'resume: nessun marcatore privato in nessuno stato osservato (bloccato, sbloccato senza cache, vista bancaria, cache espulsa)'],
        {browser: navigator.userAgent, notes: [detail]});
    }
} catch (error) {
    const failedPhase = window.__entryRestartPhase ?? 'resume';
    const diagnostics = {step: sessionStorage.getItem('synthetic-evicted-step') ?? '(sconosciuto)',
        stack: String(error?.stack ?? '').slice(0, 300), controlled: Boolean(navigator.serviceWorker?.controller),
        caches: await caches.keys().catch(() => []), databases: await databaseNames(),
        online: navigator.onLine, leak: domLeaks()};
    sessionStorage.removeItem('synthetic-evicted-phase');
    sessionStorage.removeItem('synthetic-evicted-step');
    sessionStorage.removeItem('synthetic-evicted-note');
    await network(false).catch(() => {});
    await report(false, [], {code: error.message, phase: failedPhase, diagnostics});
}
