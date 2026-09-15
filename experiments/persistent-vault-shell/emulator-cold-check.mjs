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
    const {runOfflineConsultationProbe: probe} = await import('/emulator.js');
    const runOfflineConsultationProbe = () => probe({includeAttachmentMetadata: false});
    // Only a phase marker survives reload; no Vault key or decrypted data.
    const restartPhase = window.__entryRestartPhase;
    const resumed = restartPhase === 'resume' || sessionStorage.getItem('synthetic-cold-phase') === 'reload';
    if (!resumed) {
        await wait(() => byId('login') && !byId('login').disabled, 'LOGIN');
        byId('login').click();
        await wait(() => byId('status').textContent.includes('bloccato') && !byId('unlock').disabled, 'AUTH');
        await unlock();
        // No probe or page visits prime the cache: exercise normal shell startup.
        await wait(() => byId('offline-status').dataset.state === 'ready', 'AUTOMATIC_OFFLINE_PREPARATION');
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
        assert(document.querySelector('[data-profile-section="overview"][aria-pressed="true"]'), 'COLD_OVERVIEW_DEFAULT');
        assert(byId('content').textContent.includes('fixture@example.invalid'), 'COLD_OVERVIEW_CONTACT');
        document.querySelector('[data-profile-section="personal"]').click();
        await wait(() => byId('content').textContent.includes('Nota anagrafica fittizia'), 'COLD_PERSONAL');
        assert(byId('content').textContent.includes('Nota anagrafica fittizia'), 'COLD_PROFILE_NOTE');
        const profileNote = [...byId('content').querySelectorAll('dd')].find(node => node.textContent === 'Nota anagrafica fittizia');
        await wait(() => document.querySelector('[data-profile-widget="fixture"] > button'), 'COLD_PROFILE_WIDGET');
        document.querySelector('[data-profile-widget="fixture"] > button').click();
        await wait(() => [...byId('content').querySelectorAll('button')].some(node => node.textContent === 'Mostra PIN profilo'), 'COLD_WIDGET_EXPAND');
        assert(!byId('content').textContent.includes('ANTEPRIMA-FITTIZIA'), 'COLD_WIDGET_PREVIEW');
        [...byId('content').querySelectorAll('button')].find(node => node.textContent === 'Mostra PIN profilo').click();
        await wait(() => byId('content').textContent.includes('WIDGET-FITTIZIO'), 'COLD_WIDGET_VALUE');
        const profileWidgetValues = [...byId('content').querySelectorAll('.shared-account-value')];
        document.querySelector('[data-profile-section="contacts"]').click();
        await wait(() => byId('content').textContent.includes('fixture@example.invalid') && byId('content').textContent.includes('000000000'), 'COLD_PROFILE_CONTACTS');
        assert(profileNote.textContent === '', 'COLD_PROFILE_NOTE_CLEAR');
        assert(profileWidgetValues.every(node => node.textContent === ''), 'COLD_WIDGET_CLEAR');
        assert(document === originalDocument, 'COLD_PROFILE_RELOAD');
        const linkedButtons = [...byId('content').querySelectorAll('button')].filter(node => node.textContent === 'Mostra password');
        assert(linkedButtons.length === 3, 'COLD_PROFILE_LINKS');
        for (const node of linkedButtons) {
            node.click();
            await wait(() => node.textContent === 'Nascondi password' && !node.disabled, 'COLD_PROFILE_PASSWORD');
        }
        const linkedValues = [...byId('content').querySelectorAll('dd')];
        assert(linkedValues.filter(node => node.textContent === 'SEGRETO-FITTIZIO-private-Zeta-A').length === 2, 'COLD_SHARED_PASSWORD');
        assert(linkedValues.some(node => node.textContent === 'SEGRETO-FITTIZIO-company-Zeta-A'), 'COLD_COMPANY_PASSWORD');
        byId('private').click();
        await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'COLD_PROFILE_RETURN');
        assert(linkedValues.every(node => node.textContent === ''), 'COLD_PROFILE_PASSWORD_CLEARED');
        byId('profile').click();await wait(()=>byId('content').textContent.includes('Nome fittizio'),'COLD_UTILITY_PROFILE');
        document.querySelector('[data-profile-section="addresses"]').click();
        await wait(()=>byId('content').textContent.includes('POD-FITTIZIO'),'COLD_UTILITY');
        button('Mostra password').click();
        await wait(()=>byId('content').textContent.includes('SEGRETO-FITTIZIO-company-Zeta-A'),'COLD_UTILITY_PASSWORD');
        byId('companies').click();
        await wait(()=>document.querySelector('[data-company-accounts="second-company"]'),'COLD_COMPANY_DIRECTORY');
        document.querySelector('[data-company-accounts="second-company"]').click();
        await wait(()=>byId('content').textContent.includes('Zeta seconda A'),'COLD_SECOND_COMPANY_ACCOUNTS');
        document.querySelector('[data-action="navigate"][data-id="zeta"]').click();
        await wait(() => document.querySelector('[data-widget-id="widget-second-company"] button'), 'COLD_WIDGET');
        const widget = document.querySelector('[data-widget-id="widget-second-company"]');
        [...widget.querySelectorAll('button')].find(node => node.textContent === 'Mostra PIN Widget').click();
        await wait(() => widget.textContent.includes('WIDGET-second-company-A'), 'COLD_WIDGET_VALUE');
        const sharedWidget = document.querySelector('[data-widget-id="link-second-company"]');
        await wait(() => sharedWidget?.querySelector('button'), 'COLD_COMMON');
        sharedWidget.querySelector('button').click();
        await wait(() => sharedWidget.textContent.includes('COMMON-A'), 'COLD_COMMON_VALUE');
        const widgetValues = [...byId('content').querySelectorAll('.shared-account-value')];
        byId('companies').click();await wait(()=>document.querySelector('[data-company-profile="company"]'),'COLD_COMPANY_DIRECTORY_BACK');
        assert(widgetValues.every(node => node.textContent === ''), 'COLD_WIDGET_CLEARED');
        document.querySelector('[data-company-profile="company"]').click();
        await wait(()=>byId('content').textContent.includes('IVA-FITTIZIA'),'COLD_COMPANY_PROFILE');
        document.querySelector('[data-profile-section="contacts"]').click();
        await wait(()=>byId('content').textContent.includes('pec@example.invalid'),'COLD_COMPANY_CONTACTS');
        button('Mostra password').click();
        await wait(()=>byId('content').textContent.includes('SEGRETO-FITTIZIO-company-Zeta-A'),'COLD_COMPANY_PASSWORD');
        const companyValues=[...byId('content').querySelectorAll('dd')];
        byId('private').click();
        await wait(()=>document.querySelector('[data-action="navigate"][data-id="alfa"]'),'COLD_COMPANY_RETURN');
        assert(companyValues.every(node=>node.textContent===''),'COLD_COMPANY_CLEARED');
        document.querySelector('[data-action="navigate"][data-id="banca"]').click();
        await wait(() => document.querySelector('[data-bank-id="fixture-two"] [data-bank-part="cards"] button'), 'COLD_BANKS');
        const bank = document.querySelector('[data-bank-id="fixture-two"]');
        assert(bank.children[0].textContent.includes('IBAN-SECONDO') && bank.children[1].dataset.bankPart === 'widgets' && bank.children[2].dataset.bankPart === 'cards', 'COLD_BANK_ORDER');
        bank.children[1].querySelector('button').click();
        await wait(() => bank.textContent.includes('BANK-WIDGET-private-fixture-two-A'), 'COLD_BANK_WIDGET');
        [...bank.children[2].querySelectorAll('button')].find(node => node.textContent === 'Mostra PIN').click();
        await wait(() => [...bank.children[2].querySelectorAll('.shared-account-value')].some(node => node.textContent === '5678'), 'COLD_BANK_PIN');
        const bankValues = [...bank.querySelectorAll('.shared-account-value')];
        byId('private').click(); await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'COLD_BANK_BACK');
        assert(bankValues.every(node => node.textContent === ''), 'COLD_BANK_CLEAR');
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
                  'linked shared private and company credentials readable after offline restart and cleared on exit',
                  'company profile and linked credential readable on first offline visit after restart',
                  'normal shell startup prepared textual domains without a probe or prior page visits',
                  'address utility and its linked credential readable offline after restart',
                  'company directory and second-company accounts available after automatic offline preparation',
                  'nonempty Account Widget and common credential render after cold offline restart and clear on exit',
                  'two banks and their Widget/card composition readable on first visit after offline restart',
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
