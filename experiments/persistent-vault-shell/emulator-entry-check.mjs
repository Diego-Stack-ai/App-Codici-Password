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
    const offlineInput = content.querySelector('textarea');
    await network(true);
    let httpBlocked = false; try { await fetch('/emulator.css', {cache: 'no-store'}); } catch { httpBlocked = true; }
    assert(httpBlocked, 'HTTP_STILL_ONLINE');
    const offlineNote = `Nota offline sintetica ${Date.now()}`; offlineInput.value = offlineNote;
    [...content.querySelectorAll('button')].find(button => button.textContent === 'Salva nota').click();
    await wait(() => content.textContent.includes('Modifica conservata sul dispositivo'), 'OFFLINE_QUEUED');
    byId('lock').click(); await wait(() => !content.children.length, 'OFFLINE_LOCK');
    byId('unlock').click(); await wait(() => byId('master-dialog').open, 'OFFLINE_PROMPT');
    byId('unlock-value').value = 'MASTER-FITTIZIA-A!123'; byId('master-dialog').querySelector('form').requestSubmit();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'OFFLINE_UNLOCK_LIST');
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
    await backToList();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="zeta"]'), 'BACK');
    document.querySelector('[data-action="navigate"][data-id="zeta"]').click();
    await wait(() => content.textContent.includes('Modifica non disponibile'), 'READ_ONLY');
    assert(!content.querySelector('textarea') && content.textContent.includes('Zeta'), 'READ_ONLY_DETAIL_LOST');
    byId('lock').click();
    await wait(() => !content.children.length, 'LOCK');
    assert(input.value === '', 'OLD_DRAFT_RETAINED');
    await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: true, browser: navigator.userAgent,
        passed: ['unauthenticated local transport rejected', 'entry login and Vault unlock', 'private note save and detail refresh without reload',
            'DevTools offline blocks HTTP without disconnecting the host', 'offline note survives view reopening without a new editor',
            'offline Vault lock and unlock recover the existing encrypted queue', 'online return and explicit retry refresh the recovered note',
            'incompatible account remains readable', 'lock clears the view and prior draft']})});
} catch (error) {
    if (!navigator.onLine) await network(false).catch(() => {});
    await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: false, code: error.message, fixtureView: byId('content')?.textContent.slice(0, 2000)})});
}
