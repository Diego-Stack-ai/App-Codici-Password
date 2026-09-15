const byId = id => document.getElementById(id);
const wait = async (predicate, label) => {
    for (let i = 0; i < 400; i++) { if (predicate()) return; await new Promise(done => setTimeout(done, 50)); }
    throw new Error(`TIMEOUT_${label}: ${byId('message')?.textContent}`);
};
const assert = (value, label) => { if (!value) throw new Error(label); };
let networkSerial = 0;
const networkWaits = new Map();
window.__entryNetworkDone = (id, ok) => { const entry = networkWaits.get(id); networkWaits.delete(id); ok ? entry?.resolve() : entry?.reject(new Error('NETWORK_CONTROL_FAILED')); };
const network = async offline => {
    await wait(() => typeof window.__entryNetworkControl === 'function', 'NETWORK_CONTROL');
    await new Promise((resolve, reject) => { const id = ++networkSerial; networkWaits.set(id, {resolve, reject}); window.__entryNetworkControl(JSON.stringify({id, offline})); });
    await wait(() => navigator.onLine === !offline, 'NETWORK_STATE');
};
const profileChecks = [];
async function checkBanking(mode) {
    for (const scope of ['private', 'company']) {
        if (scope === 'private') byId('private').click();
        else {
            byId('companies').click(); await wait(() => document.querySelector('[data-company-accounts="company"]'), 'BANK_COMPANY_DIRECTORY');
            document.querySelector('[data-company-accounts="company"]').click();
        }
        await wait(() => document.querySelector('[data-action="navigate"][data-id="banca"]'), 'BANK_ACCOUNT');
        document.querySelector('[data-action="navigate"][data-id="banca"]').click();
        await wait(() => document.querySelector('[data-bank-id="fixture-two"] [data-bank-part="cards"] button'), 'BANK_MOUNT');
        for (const [id, iban, pin] of [['fixture', 'IBAN-FITTIZIO', '1234'], ['fixture-two', 'IBAN-SECONDO', '5678']]) {
            const bank = document.querySelector(`[data-bank-id="${id}"]`);
            assert(bank.children[0].dataset.bankPart === 'fields' && bank.children[1].dataset.bankPart === 'widgets' && bank.children[2].dataset.bankPart === 'cards', 'BANK_ORDER');
            assert(bank.children[0].textContent.includes(iban), 'BANK_IBAN');
            const widget = bank.querySelector(`[data-widget-id="bank-${scope}-${id}"]`);
            assert(widget, 'BANK_WIDGET_PARENT'); widget.querySelector('button').click();
            await wait(() => widget.textContent.includes(`BANK-WIDGET-${scope}-${id}-A`), 'BANK_WIDGET_VALUE');
            [...bank.children[2].querySelectorAll('button')].find(node => node.textContent === 'Mostra PIN').click();
            await wait(() => [...bank.children[2].querySelectorAll('.shared-account-value')].some(node => node.textContent === pin), 'BANK_PIN');
        }
        const values = [...byId('content').querySelectorAll('.shared-account-value')];
        byId('private').click(); await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'BANK_BACK');
        assert(values.every(node => node.textContent === ''), 'BANK_CLEAR');
        profileChecks.push(`two ${scope} banks keep Widgets above cards and clear secrets ${mode}`);
    }
}
async function checkWidgets(scope, mode) {
    await wait(() => document.querySelector(`[data-widget-id="widget-${scope}"] button`), 'WIDGET_MOUNT');
    const card = document.querySelector(`[data-widget-id="widget-${scope}"]`);
    const reveal = [...card.querySelectorAll('button')].find(node => node.textContent === 'Mostra PIN Widget');
    assert(reveal && !byId('content').textContent.includes('WIDGET-'), 'WIDGET_INITIAL_MASK');
    reveal.click(); await wait(() => card.textContent.includes(`WIDGET-${scope}-A`), 'WIDGET_REVEAL');
    reveal.click(); await wait(() => !card.textContent.includes('WIDGET-'), 'WIDGET_MASK');
    const shared = document.querySelector(`[data-widget-id="link-${scope}"]`);
    await wait(() => shared?.querySelector('button'), 'COMMON_MOUNT');
    shared.querySelector('button').click(); await wait(() => shared.textContent.includes('COMMON-A'), 'COMMON_REVEAL');
    assert(!byId('content').textContent.includes('COMMON-B'), 'COMMON_UID');
    profileChecks.push(`Widget and common credential displayed and masked ${scope} ${mode}`);
    return [...byId('content').querySelectorAll('.shared-account-value')];
}
async function checkCompanyProfile(mode) {
    const marker=document;
    byId('companies').click();
    await wait(()=>document.querySelector('[data-company-profile="second-company"]'),'COMPANY_DIRECTORY');
    const search=document.querySelector('[data-company-search]');search.value='Seconda';search.dispatchEvent(new Event('input'));
    assert(document.querySelectorAll('[data-company-profile]').length===1,'COMPANY_SEARCH');
    document.querySelector('[data-company-profile="second-company"]').click();
    await wait(()=>byId('content').textContent.includes('IVA-SECONDA'),'SECOND_COMPANY_PROFILE');
    assert(search.value==='','COMPANY_SEARCH_CLEARED');
    document.querySelector('[data-profile-section="contacts"]').click();
    await wait(()=>byId('content').textContent.includes('seconda@example.invalid'),'SECOND_CONTACT');
    [...byId('content').querySelectorAll('button')].find(node=>node.textContent==='Mostra password').click();
    await wait(()=>byId('content').textContent.includes('SEGRETO-FITTIZIO-second-company-Zeta-A'),'SECOND_PASSWORD');
    byId('companies').click();await wait(()=>document.querySelector('[data-company-accounts="second-company"]'),'SECOND_ACCOUNTS_DIRECTORY');
    document.querySelector('[data-company-accounts="second-company"]').click();
    await wait(()=>byId('content').textContent.includes('Zeta seconda A'),'SECOND_ACCOUNTS');
    document.querySelector('[data-action="navigate"][data-id="zeta"]').click();
    await wait(()=>byId('content').textContent.includes('Dettaglio Account')&&byId('content').textContent.includes('Zeta seconda A'),'SECOND_DETAIL');
    const widgetValues = await checkWidgets('second-company', mode);
    [...byId('content').querySelectorAll('button')].find(node=>node.textContent==='Torna alla lista').click();
    await wait(()=>document.querySelector('[data-action="navigate"][data-id="zeta"]'),'SECOND_DETAIL_BACK');
    assert(byId('content').textContent.includes('Zeta seconda A'),'SECOND_RETURN_SCOPE');
    assert(widgetValues.every(node => node.textContent === ''), 'WIDGET_EXIT_CLEAR');
    byId('companies').click();await wait(()=>document.querySelector('[data-company-profile="company"]'),'COMPANY_DIRECTORY_BACK');
    document.querySelector('[data-company-profile="company"]').click();
    await wait(()=>byId('content').textContent.includes('IVA-FITTIZIA'),'COMPANY_PROFILE');
    const buttons=label=>[...byId('content').querySelectorAll('button')].filter(node=>node.textContent===label);
    document.querySelector('[data-profile-section="contacts"]').click();
    await wait(()=>byId('content').textContent.includes('pec@example.invalid'),'COMPANY_CONTACTS');
    assert(buttons('Mostra password').length===3,'COMPANY_LINK_COUNT');
    for(const node of buttons('Mostra password')) {node.click();await wait(()=>node.textContent==='Nascondi password'&&!node.disabled,'COMPANY_PASSWORD');}
    const values=[...byId('content').querySelectorAll('dd')];
    assert(values.filter(node=>node.textContent==='SEGRETO-FITTIZIO-company-Zeta-A').length===2,'COMPANY_SHARED_DESTINATION');
    assert(values.some(node=>node.textContent==='SEGRETO-FITTIZIO-private-Zeta-A'),'COMPANY_PRIVATE_DESTINATION');
    buttons('Apri Account collegato')[1].click();
    await wait(()=>byId('content').textContent.includes('Zeta privato A')&&buttons('Torna al profilo').length,'COMPANY_OPEN');
    assert(values.every(node=>node.textContent===''),'COMPANY_CLEAR');
    buttons('Torna al profilo')[0].click();await wait(()=>byId('content').textContent.includes('IVA-FITTIZIA'),'COMPANY_BACK');
    for(const [section,value] of [['addresses','Filiale fittizia'],['documents','Visura fittizia']]) {
        document.querySelector('[data-profile-section="'+section+'"]').click();await wait(()=>byId('content').textContent.includes(value),'COMPANY_'+section);
    }
    byId('private').click();await wait(()=>document.querySelector('[data-action="navigate"][data-id="alfa"]'),'COMPANY_EXIT');
    assert(document===marker,'COMPANY_RELOAD');
    profileChecks.push('company canonical profile tabs rendered '+mode,'company shared and private linked credentials with safe navigation '+mode);
    profileChecks.push('company directory search and second profile '+mode,'same Account ID in different companies navigates with correct company scope '+mode);
}
async function checkProfile(mode) {
    const originalDocument = document;
    byId('profile').click();
    await wait(() => byId('content').textContent.includes('Nome fittizio'), 'PROFILE_PERSONAL');
    const profileNote = [...byId('content').querySelectorAll('dd')].find(node => node.textContent === 'Nota anagrafica fittizia');
    assert(profileNote, 'PROFILE_NOTE');
    for (const [section, expected] of [['contacts','fixture@example.invalid'],['addresses','Via fittizia'],['documents','DOC-FITTIZIO']]) {
        document.querySelector('[data-profile-section="'+section+'"]').click();
        await wait(() => byId('content').textContent.includes(expected), 'PROFILE_'+section);
        assert(profileNote.textContent === '', 'PROFILE_NOTE_CLEAR');
        if (section === 'addresses' || section === 'documents') {
            if (section === 'addresses') assert(byId('content').textContent.includes('POD-FITTIZIO'), 'PROFILE_UTILITY_VALUE');
            const toggle=[...byId('content').querySelectorAll('button')].find(node=>node.textContent==='Mostra password');
            assert(toggle, 'PROFILE_NESTED_LINK'); toggle.click();
            await wait(()=>toggle.textContent==='Nascondi password'&&!toggle.disabled,'PROFILE_NESTED_PASSWORD');
            assert(byId('content').textContent.includes(section==='addresses'?'SEGRETO-FITTIZIO-company-Zeta-A':'SEGRETO-FITTIZIO-private-Zeta-A'),'PROFILE_NESTED_TARGET');
            toggle.click(); await wait(()=>!byId('content').textContent.includes('SEGRETO-FITTIZIO'),'PROFILE_NESTED_MASK');
            profileChecks.push(section+' linked credential rendered and masked '+mode);
        }
        if (section === 'contacts') {
            assert(byId('content').textContent.includes('000000000'), 'PROFILE_PHONE_CANONICAL_FIELD');
            const buttons = label => [...byId('content').querySelectorAll('button')].filter(button => button.textContent === label);
            assert(buttons('Mostra password').length === 3, 'PROFILE_LINK_COUNT');
            for (const button of buttons('Mostra password')) {
                button.click();
                await wait(() => button.textContent === 'Nascondi password' && !button.disabled, 'PROFILE_REVEAL');
            }
            const values = [...byId('content').querySelectorAll('dd')];
            assert(values.filter(node => node.textContent === 'SEGRETO-FITTIZIO-private-Zeta-A').length === 2, 'PROFILE_SHARED_PRIVATE_ACCOUNT');
            assert(values.some(node => node.textContent === 'SEGRETO-FITTIZIO-company-Zeta-A'), 'PROFILE_COMPANY_ACCOUNT');
            for (const button of buttons('Nascondi password')) button.click();
            await wait(() => !byId('content').textContent.includes('SEGRETO-FITTIZIO'), 'PROFILE_MASK');
            for (const [index, title] of [[0, 'Zeta privato A'], [2, 'Zeta azienda A']]) {
                const detached = [...byId('content').querySelectorAll('dd')];
                buttons('Apri Account collegato')[index].click();
                await wait(() => byId('content').textContent.includes(title) && buttons('Torna al profilo').length, 'PROFILE_LINK_DETAIL');
                assert(detached.every(node => node.textContent === ''), 'PROFILE_LINK_DETACHED_VALUES');
                const widgetValues = await checkWidgets(index === 0 ? 'private' : 'company', mode);
                buttons('Torna al profilo')[0].click();
                await wait(() => byId('content').textContent.includes('Nome fittizio'), 'PROFILE_LINK_BACK');
                assert(widgetValues.every(node => node.textContent === ''), 'PROFILE_WIDGET_EXIT_CLEAR');
                document.querySelector('[data-profile-section="contacts"]').click();
                await wait(() => buttons('Apri Account collegato').length === 3, 'PROFILE_LINK_CONTACTS');
            }
            profileChecks.push('linked shared private and company passwords revealed and masked '+mode, 'linked Account navigation returns to profile '+mode);
        }
    }
    const oldValues = [...byId('content').querySelectorAll('dd')];
    byId('private').click();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'PROFILE_RETURN');
    assert(oldValues.every(node => node.textContent === ''), 'PROFILE_VALUES_RETAINED');
    assert(document === originalDocument, 'PROFILE_RELOADED');
    profileChecks.push('profile canonical identity contacts addresses documents rendered '+mode+' without reload', 'profile detached plaintext cleared '+mode);
}
try {
    const denied = await fetch('/demo-vault-shell/europe-west1/applyPrivateAccountMutation', {method: 'POST', body: '{}'});
    assert(denied.status === 401, 'UNAUTHENTICATED_BRIDGE_ACCEPTED');
    await wait(() => byId('login') && !byId('login').disabled, 'LOGIN');
    byId('login').click();
    await wait(() => byId('status').textContent.includes('bloccato') && !byId('unlock').disabled, 'AUTH');
    byId('unlock').click();
    await wait(() => byId('master-dialog').open, 'PROMPT');
    byId('unlock-value').value = 'MASTER-FITTIZIA-A!123';
    byId('master-dialog').querySelector('form').requestSubmit();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'LIST');
    await checkProfile('online');
    await checkCompanyProfile('online');
    await checkBanking('online');
    document.querySelector('[data-action="navigate"][data-id="alfa"]').click();
    await wait(() => document.querySelector('#content textarea'), 'NOTE_EDITOR');
    const content = byId('content'), input = content.querySelector('textarea'), marker = document;
    const note = `Nota sintetica aggiornata ${Date.now()}`;
    const save = [...content.querySelectorAll('button')].find(button => button.textContent.includes('Salva nota'));
    assert(save, 'SAVE_BUTTON');
    await wait(() => !save.disabled && !input.readOnly, 'QUEUE_READY');
    input.value = note; save.click();
    await wait(() => content.textContent.includes('Nota salvata.') && [...content.querySelectorAll('pre')].some(node => node.textContent === note), 'SAVE_REFRESH');
    assert(document === marker && performance.getEntriesByType('navigation').length === 1, 'DOCUMENT_RELOADED');
    const backToList = async () => {
        [...content.querySelectorAll('button')].find(button => button.textContent === 'Torna alla lista').click();
        await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'BACK');
    };
    await backToList();
    document.querySelector('[data-action="navigate"][data-id="alfa"]').click();
    await wait(() => content.querySelector('textarea') && [...content.querySelectorAll('button')].some(button => button.textContent === 'Salva nota' && !button.disabled), 'SECOND_EDITOR');
    const {runOfflineConsultationProbe} = await import('/emulator.js');
    const loadedDomains = await runOfflineConsultationProbe();
    const offlineInput = content.querySelector('textarea');
    await network(true);
    let httpBlocked = false; try { await fetch('/emulator.css', {cache: 'no-store'}); } catch { httpBlocked = true; }
    assert(httpBlocked, 'HTTP_STILL_ONLINE');
    const offlineNote = `Nota offline sintetica ${Date.now()}`; offlineInput.value = offlineNote;
    [...content.querySelectorAll('button')].find(button => button.textContent === 'Salva nota').click();
    await wait(() => content.textContent.includes('Modifica conservata sul dispositivo'), 'OFFLINE_QUEUED');
    byId('lock').click(); await wait(() => !content.children.length, 'OFFLINE_LOCK');
    let offlineLocked = false;
    try { await runOfflineConsultationProbe(); } catch (error) { offlineLocked = error.message === 'PROBE_SESSION'; }
    assert(offlineLocked, 'OFFLINE_LOCKED_DATA_ACCESS');
    byId('unlock').click(); await wait(() => byId('master-dialog').open, 'OFFLINE_PROMPT');
    byId('unlock-value').value = 'MASTER-FITTIZIA-A!123'; byId('master-dialog').querySelector('form').requestSubmit();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'OFFLINE_UNLOCK_LIST');
    const cachedDomains = await runOfflineConsultationProbe();
    assert(JSON.stringify(cachedDomains) === JSON.stringify(loadedDomains), 'OFFLINE_DOMAIN_MATRIX');
    await checkProfile('offline');
    await checkCompanyProfile('offline');
    await checkBanking('offline');
    document.querySelector('[data-action="navigate"][data-id="alfa"]').click();
    await wait(() => content.textContent.includes('già conservata sul dispositivo'), 'OFFLINE_RECOVERY');
    const recoveredInput = content.querySelector('textarea');
    assert(recoveredInput.readOnly && [...content.querySelectorAll('button')].find(button => button.textContent === 'Salva nota').hidden, 'OFFLINE_NEW_EDITOR');
    [...content.querySelectorAll('button')].find(button => button.textContent === 'Riprova sincronizzazione').click();
    await wait(() => content.textContent.includes('Modifica conservata sul dispositivo'), 'OFFLINE_RETRY_RETAINED');
    await network(false);
    [...content.querySelectorAll('button')].find(button => button.textContent === 'Riprova sincronizzazione').click();
    await wait(() => content.textContent.includes('Nota salvata.') && [...content.querySelectorAll('pre')].some(node => node.textContent === offlineNote), 'ONLINE_RECOVERED');
    assert(document === marker, 'OFFLINE_RELOADED_DOCUMENT');
    assert(JSON.stringify(await runOfflineConsultationProbe()) === JSON.stringify(loadedDomains), 'RECONNECTED_DOMAIN_MATRIX');
    await backToList();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="zeta"]'), 'BACK');
    document.querySelector('[data-action="navigate"][data-id="zeta"]').click();
    await wait(() => content.textContent.includes('Modifica non disponibile'), 'READ_ONLY');
    assert(!content.querySelector('textarea') && content.textContent.includes('Zeta'), 'READ_ONLY_DETAIL_LOST');
    byId('lock').click();
    await wait(() => !content.children.length, 'LOCK');
    assert(input.value === '', 'OLD_DRAFT_RETAINED');
    let onlineLocked = false;
    try { await runOfflineConsultationProbe(); } catch (error) { onlineLocked = error.message === 'PROBE_SESSION'; }
    assert(onlineLocked, 'ONLINE_LOCKED_DATA_ACCESS');
    await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: true, browser: navigator.userAgent,
        passed: [...profileChecks, 'unauthenticated local transport rejected', 'entry login and Vault unlock', 'private note save and detail refresh without reload',
            'DevTools offline blocks HTTP without disconnecting the host', 'offline note survives view reopening without a new editor',
            'offline Vault lock and unlock recover the existing encrypted queue', 'online return and explicit retry refresh the recovered note',
            ...cachedDomains.map(domain => `cached repository and protected decryption: ${domain}`), 'uncached document remains unavailable offline',
            'offline lock denies cached data access', 'online lock denies cached data access', 'domain matrix remains readable after reconnect',
            'incompatible account remains readable', 'lock clears the view and prior draft']})});
} catch (error) {
    if (!navigator.onLine) await network(false).catch(() => {});
    await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: false, code: error.message, fixtureView: byId('content')?.textContent.slice(0, 2000)})});
}
