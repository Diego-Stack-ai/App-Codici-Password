const byId = id => document.getElementById(id);
const wait = async (predicate, label) => {
    for (let i = 0; i < 400; i++) { if (predicate()) return; await new Promise(done => setTimeout(done, 50)); }
    throw new Error(`TIMEOUT_${label}: ${byId('message')?.textContent}`);
};
const assert = (value, label) => { if (!value) throw new Error(label); };
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
    const back = [...content.querySelectorAll('button')].find(button => button.textContent === 'Torna alla lista'); back.click();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="zeta"]'), 'BACK');
    document.querySelector('[data-action="navigate"][data-id="zeta"]').click();
    await wait(() => content.textContent.includes('Modifica non disponibile'), 'READ_ONLY');
    assert(!content.querySelector('textarea') && content.textContent.includes('Zeta'), 'READ_ONLY_DETAIL_LOST');
    byId('lock').click();
    await wait(() => !content.children.length, 'LOCK');
    assert(input.value === '', 'OLD_DRAFT_RETAINED');
    await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: true, browser: navigator.userAgent,
        passed: ['unauthenticated local transport rejected', 'entry login and Vault unlock', 'private note save and detail refresh without reload', 'incompatible account remains readable', 'lock clears the view and prior draft']})});
} catch (error) {
    await fetch('/entry-result', {method: 'POST', body: JSON.stringify({ok: false, code: error.message, fixtureView: byId('content')?.textContent.slice(0, 2000)})});
}
