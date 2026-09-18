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
async function checkProfileLink(mode, id, target) {
    const action = kind => document.querySelector(`[data-profile-link-source="${id}"][data-profile-link-action="${kind}"]`);
    const button = label => [...byId('content').querySelectorAll('button')].find(node => node.textContent === label);
    await wait(() => action('unlink'), 'LINK_ACTION_' + id);
    const originalCount = byId('content').querySelectorAll('[data-profile-link-action="unlink"]').length;
    action('unlink').click();
    await wait(() => button('Conferma scollegamento'), 'LINK_EDITOR_' + id);
    if (mode !== 'online') {
        assert(button('Conferma scollegamento').disabled, 'LINK_OFFLINE_DISABLED');
        button('Annulla collegamento').click();
        await wait(() => action('unlink'), 'LINK_OFFLINE_CANCEL');
    } else {
        button('Conferma scollegamento').click();
        await wait(() => action('change')?.textContent === 'Collega Account', 'LINK_UNLINK_' + id);
        assert(byId('content').querySelectorAll('[data-profile-link-action="unlink"]').length === originalCount - 1, 'LINK_OTHER_CONTACTS_PRESERVED');
        action('change').click();
        await wait(() => document.querySelector('[data-profile-account-picker] input'), 'LINK_PICKER');
        await wait(() => button('Crea un nuovo Account') && !button('Crea un nuovo Account').disabled, 'ACCOUNT_CREATE_READY');
        button('Crea un nuovo Account').click();
        await wait(() => document.querySelector('[data-profile-account-create]'), 'ACCOUNT_CREATE');
        const createHost = document.querySelector('[data-profile-account-create]'), fields = createHost.querySelectorAll('input');
        fields[0].value = `Creato da ${id}`; fields[1].value = `${id}@example.invalid`;
        button('Crea e collega').click();
        await wait(() => action('unlink'), 'ACCOUNT_CREATED_' + id);
        action('unlink').click(); await wait(() => button('Conferma scollegamento'), 'ACCOUNT_CREATED_UNLINK_' + id);
        button('Conferma scollegamento').click(); await wait(() => action('change'), 'ACCOUNT_CREATED_DETACHED_' + id);
        action('change').click(); await wait(() => document.querySelector('[data-profile-account-picker] input'), 'LINK_PICKER_REOPEN');
        const search = document.querySelector('[data-profile-account-picker] input');
        search.value = target; search.dispatchEvent(new Event('input'));
        await wait(() => [...document.querySelectorAll('[data-profile-account-picker] button')].some(node => node.textContent.startsWith(target + ' — ')), 'LINK_TARGET');
        [...document.querySelectorAll('[data-profile-account-picker] button')].find(node => node.textContent.startsWith(target + ' — ')).click();
        assert(search.value === '', 'LINK_SEARCH_CLEAR');
        await wait(() => button('Salva collegamento') && !button('Salva collegamento').disabled, 'LINK_SAVE');
        button('Salva collegamento').click();
        await wait(() => action('unlink'), 'LINK_RESTORED_' + id);
        assert(byId('content').querySelectorAll('[data-profile-link-action="unlink"]').length === originalCount, 'LINK_ALL_RESTORED');
    }
    profileChecks.push(`profile link ${id} ${mode}: refresh, shared destination and offline guard`);
}
async function checkAccountNote(mode, scope) {
    const content = byId('content'), action = () => content.querySelector('[data-account-note-action]');
    await wait(() => action() && !action().hidden, 'ACCOUNT_NOTE_ACTION'); action().click();
    await wait(() => content.querySelector('textarea'), 'ACCOUNT_NOTE_EDITOR');
    const area = content.querySelector('textarea'), original = area.value;
    const button = label => [...content.querySelectorAll('button')].find(node => node.textContent === label);
    if (mode === 'online') {
        const updated = 'Nota collegata sintetica ' + scope;
        area.value = updated; button('Salva nota').click();
        await wait(() => action() && !action().hidden && [...content.querySelectorAll('pre')].some(node => node.textContent === updated), 'ACCOUNT_NOTE_REFRESH');
        assert(area.value === '', 'ACCOUNT_NOTE_DRAFT_CLEAR');
        action().click(); await wait(() => content.querySelector('textarea'), 'ACCOUNT_NOTE_REOPEN');
        content.querySelector('textarea').value = ''; button('Salva nota').click();
        await wait(() => action()?.textContent === 'Aggiungi nota' && !action().hidden, 'ACCOUNT_NOTE_CLEARED');
        action().click(); await wait(() => content.querySelector('textarea'), 'ACCOUNT_NOTE_EMPTY_EDITOR');
        content.querySelector('textarea').value = original; button('Salva nota').click();
        await wait(() => action()?.textContent === '✎' && !action().hidden && [...content.querySelectorAll('pre')].some(node => node.textContent === original), 'ACCOUNT_NOTE_RESTORED');
    } else {
        assert(area.readOnly && button('Salva nota').disabled, 'ACCOUNT_NOTE_OFFLINE');
        button('Annulla').click(); assert(area.value === '', 'ACCOUNT_NOTE_CANCEL_CLEAR');
    }
    profileChecks.push(`${scope} Account note ${mode}: scoped editor, refresh and cleanup`);
}
async function checkAccountStandard(mode, scope) {
    const content = byId('content'), action = () => content.querySelector('[data-account-standard-action]');
    const button = label => [...content.querySelectorAll('button')].find(node => node.textContent === label);
    await wait(() => action(), 'ACCOUNT_STANDARD_ACTION_' + scope); action().click();
    await wait(() => content.querySelector('[data-account-standard-editor]'), 'ACCOUNT_STANDARD_EDITOR_' + scope);
    const inputs = Object.fromEntries([...content.querySelectorAll('[data-account-standard-editor] input')].map(node => [node.dataset.field, node]));
    assert(inputs.password.type === 'password' && inputs.username.type !== 'password' && inputs.account.type !== 'password', 'ACCOUNT_STANDARD_PASSWORD_SEMANTICS');
    const original = Object.fromEntries(Object.entries(inputs).map(([field, node]) => [field, node.value]));
    if (mode === 'online') {
        inputs.nomeAccount.value = `Account A6 ${scope}`; inputs.username.value = `a6-${scope}@example.invalid`;
        inputs.account.value = `CODICE-A6-${scope}`; inputs.password.value = `SEGRETO-A6-${scope}`; inputs.url.value = `https://example.invalid/a6/${scope}`;
        button('Salva Account').click();
        await wait(() => !content.querySelector('[data-account-standard-editor]') && action() && content.textContent.includes(`Account A6 ${scope}`), 'ACCOUNT_STANDARD_REFRESH_' + scope);
        assert(Object.values(inputs).every(node => node.value === '' && node.defaultValue === ''), 'ACCOUNT_STANDARD_SAVE_CLEAR');
        action().click(); await wait(() => content.querySelector('[data-account-standard-editor]'), 'ACCOUNT_STANDARD_REOPEN_' + scope);
        const restored = Object.fromEntries([...content.querySelectorAll('[data-account-standard-editor] input')].map(node => [node.dataset.field, node]));
        assert(restored.username.value === `a6-${scope}@example.invalid` && restored.account.value === `CODICE-A6-${scope}`, 'ACCOUNT_STANDARD_SAVED_VALUES');
        for (const [field, value] of Object.entries(original)) restored[field].value = value;
        button('Salva Account').click();
        await wait(() => !content.querySelector('[data-account-standard-editor]') && action() && content.textContent.includes(original.nomeAccount), 'ACCOUNT_STANDARD_RESTORE_' + scope);
        assert(Object.values(restored).every(node => node.value === '' && node.defaultValue === ''), 'ACCOUNT_STANDARD_RESTORE_CLEAR');
    } else {
        assert(Object.values(inputs).every(node => node.readOnly), 'ACCOUNT_STANDARD_OFFLINE_READONLY');
        assert(button('Salva Account').disabled, 'ACCOUNT_STANDARD_OFFLINE_DISABLED');
        button('Annulla').click(); await wait(() => !content.querySelector('[data-account-standard-editor]') && action(), 'ACCOUNT_STANDARD_CANCEL_' + scope);
        assert(Object.values(inputs).every(node => node.value === '' && node.defaultValue === ''), 'ACCOUNT_STANDARD_CANCEL_CLEAR');
    }
    profileChecks.push(`${scope} Account standard editor ${mode}: five fields, refresh, password semantics and cleanup`);
}
async function checkAnagraphic(mode, company) {
    const button = label => [...byId('content').querySelectorAll('button')].find(node => node.textContent === label);
    document.querySelector('[data-profile-section="personal"]').click();
    await wait(() => button('Modifica anagrafica'), 'ANAGRAPHIC_TAB');
    button('Modifica anagrafica').click();
    await wait(() => document.querySelector('[data-profile-field="note"]'), 'ANAGRAPHIC_EDITOR');
    const inputs = [...document.querySelectorAll('[data-profile-field]')], note = document.querySelector('[data-profile-field="note"]');
    const original = note.value;
    assert(!document.querySelector('[data-profile-text-editor] input[type="password"]'), 'ANAGRAPHIC_NOT_PASSWORD');
    if (mode === 'online') {
        note.value = 'Nota laboratorio aggiornata'; button('Salva anagrafica').click();
        await wait(() => !document.querySelector('[data-profile-text-editor]') && [...byId('content').querySelectorAll('dd')].some(node => node.textContent === 'Nota laboratorio aggiornata'), 'ANAGRAPHIC_REFRESH');
        assert(inputs.every(node => node.value === ''), 'ANAGRAPHIC_SAVE_CLEAR');
        button('Modifica anagrafica').click(); await wait(() => document.querySelector('[data-profile-field="note"]'), 'ANAGRAPHIC_REOPEN');
        assert(document.querySelector('[data-profile-field="note"]').value === 'Nota laboratorio aggiornata', 'ANAGRAPHIC_SAVED_VALUE');
        document.querySelector('[data-profile-field="note"]').value = original; button('Salva anagrafica').click();
        await wait(() => !document.querySelector('[data-profile-text-editor]') && button('Modifica anagrafica') && !byId('content').textContent.includes('Nota laboratorio aggiornata'), 'ANAGRAPHIC_RESTORE');
    } else {
        assert(note.readOnly && button('Salva anagrafica').disabled, 'ANAGRAPHIC_OFFLINE_READONLY');
        button('Annulla').click(); await wait(() => !document.querySelector('[data-profile-text-editor]') && button('Modifica anagrafica'), 'ANAGRAPHIC_CANCEL');
        assert(inputs.every(node => node.value === ''), 'ANAGRAPHIC_CANCEL_CLEAR');
    }
    profileChecks.push(`${company ? 'company' : 'private'} anagraphic editor ${mode}: values, refresh and revocation`);
}
async function checkContactsEditor(mode) {
    const button = label => [...byId('content').querySelectorAll('button')].find(node => node.textContent === label);
    const rows = () => [...document.querySelectorAll('[data-contact-row]')];
    const inputs = () => [...document.querySelectorAll('[data-contact-field]')];
    byId('profile').click();
    await wait(() => byId('content').textContent.includes('Nome fittizio'), 'CONTACTS_PROFILE');
    document.querySelector('[data-profile-section="contacts"]').click();
    let openContacts;
    await wait(() => (openContacts = button('Modifica contatti')) !== undefined, 'CONTACTS_TAB');
    openContacts.click();
    await wait(() => document.querySelector('[data-profile-contacts-editor]'), 'CONTACTS_EDITOR');
    assert(rows().length === 3, 'CONTACTS_ROWS');
    const linked = rows().find(row => row.dataset.contactId === 'email');
    assert(linked.querySelector('[data-contact-action="delete"]').disabled, 'CONTACTS_LINKED_DELETE');
    if (mode === 'online') {
        const original = inputs();
        await wait(() => document.querySelector('[data-contact-add="contactEmails"]'), 'CONTACTS_ADD');
        document.querySelector('[data-contact-add="contactEmails"]').click();
        const created = rows().find(row => row.dataset.contactNew === 'true');
        assert(created && created.dataset.contactId.startsWith('email-'), 'CONTACTS_NEW_ID');
        created.querySelector('[data-contact-field="address"]').value = 'laboratorio-contatti@example.invalid';
        button('Salva contatti').click();
        await wait(() => !document.querySelector('[data-profile-contacts-editor]') && button('Modifica contatti') && byId('content').textContent.includes('laboratorio-contatti@example.invalid'), 'CONTACTS_REFRESH');
        assert(original.every(node => node.value === ''), 'CONTACTS_SAVE_CLEAR');
        button('Modifica contatti').click();
        await wait(() => document.querySelector('[data-profile-contacts-editor]'), 'CONTACTS_REOPEN');
        const fresh = rows().find(row => [...row.querySelectorAll('[data-contact-field="address"]')].some(node => node.value === 'laboratorio-contatti@example.invalid'));
        assert(fresh, 'CONTACTS_SAVED_VALUE');
        const remove = fresh.querySelector('[data-contact-action="delete"]');
        assert(!remove.disabled, 'CONTACTS_DELETE_ALLOWED');
        remove.click(); remove.click();
        button('Salva contatti').click();
        await wait(() => !document.querySelector('[data-profile-contacts-editor]') && button('Modifica contatti') && !byId('content').textContent.includes('laboratorio-contatti@example.invalid'), 'CONTACTS_DELETED');
        button('Modifica contatti').click();
        await wait(() => document.querySelector('[data-profile-contacts-editor]'), 'CONTACTS_REOPEN_DELETE');
        assert(rows().length === 3, 'CONTACTS_ROWS_RESTORED');
    } else {
        assert(inputs().every(node => node.readOnly), 'CONTACTS_OFFLINE_READONLY');
        assert(button('Salva contatti').disabled, 'CONTACTS_OFFLINE_DISABLED');
        assert(byId('content').textContent.includes('sola consultazione'), 'CONTACTS_OFFLINE_NOTICE');
    }
    button('Annulla').click();
    await wait(() => !document.querySelector('[data-profile-contacts-editor]') && button('Modifica contatti'), 'CONTACTS_CANCEL');
    assert(inputs().length === 0, 'CONTACTS_CLEARED');
    profileChecks.push('private contacts editor ' + mode + ': id guard, add, refresh, delete and cleanup');
}

async function checkBanking(mode, {reopen = false} = {}) {
    const openScope = async scope => {
        if (scope === 'private') byId('private').click();
        else {
            byId('companies').click(); await wait(() => document.querySelector('[data-company-accounts="company"]'), 'BANK_COMPANY_DIRECTORY');
            document.querySelector('[data-company-accounts="company"]').click();
        }
        await wait(() => document.querySelector('[data-action="navigate"][data-id="banca"]'), 'BANK_ACCOUNT');
        document.querySelector('[data-action="navigate"][data-id="banca"]').click();
        await wait(() => document.querySelector('[data-bank-id="fixture-two"] [data-bank-part="cards"] button'), 'BANK_MOUNT');
    };
    const fieldsText = () => [...byId('content').querySelectorAll('[data-bank-part="fields"]')].map(node => node.textContent);
    const reveal = async scope => {
        const pins = [], ccvs = [];
        for (const [id, iban, pin, ccv] of [['fixture', 'IBAN-FITTIZIO', '1234', '000'], ['fixture-two', 'IBAN-SECONDO', '5678', '111']]) {
            const bank = document.querySelector(`[data-bank-id="${id}"]`);
            assert(bank.children[0].dataset.bankPart === 'fields' && bank.children[1].dataset.bankPart === 'widgets' && bank.children[2].dataset.bankPart === 'cards', 'BANK_ORDER');
            assert(bank.children[0].textContent.includes(iban), 'BANK_IBAN');
            const widget = bank.querySelector(`[data-widget-id="bank-${scope}-${id}"]`);
            assert(widget, 'BANK_WIDGET_PARENT'); widget.querySelector('button').click();
            await wait(() => widget.textContent.includes(`BANK-WIDGET-${scope}-${id}-A`), 'BANK_WIDGET_VALUE');
            const card = bank.children[2];
            const revealButton = label => [...card.querySelectorAll('button')].find(node => node.textContent === label);
            assert(revealButton('Mostra PIN') && revealButton('Mostra CCV'), 'BANK_CARD_ACTIONS');
            revealButton('Mostra PIN').click();
            await wait(() => [...card.querySelectorAll('.shared-account-value')].some(node => node.textContent === pin), 'BANK_PIN');
            revealButton('Mostra CCV').click();
            await wait(() => [...card.querySelectorAll('.shared-account-value')].some(node => node.textContent === ccv), 'BANK_CCV');
            pins.push(pin); ccvs.push(ccv);
        }
        return {pins, ccvs};
    };
    for (const scope of ['private', 'company']) {
        await openScope(scope);
        const first = await reveal(scope);
        if (reopen) {
            // Leave the detail and re-enter it without reloading: the same two
            // banks, Widgets and card secrets must come back deterministically.
            const before = fieldsText();
            await openScope(scope);
            assert(JSON.stringify(fieldsText()) === JSON.stringify(before), 'BANK_REOPEN_FIELDS');
            const second = await reveal(scope);
            assert(JSON.stringify(second) === JSON.stringify(first), 'BANK_REOPEN_SECRETS');
            profileChecks.push(`reopened ${scope} banking detail keeps two banks, Widgets, PIN and CCV ${mode}`);
        }
        const values = [...byId('content').querySelectorAll('.shared-account-value')];
        byId('private').click(); await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'BANK_BACK');
        assert(values.every(node => node.textContent === ''), 'BANK_CLEAR');
        profileChecks.push(`two ${scope} banks keep Widgets above cards, reveal PIN and CCV and clear secrets ${mode}`);
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
    await checkAccountNote(mode, 'second-company');
    await checkAccountStandard(mode, 'second-company');
    const widgetValues = await checkWidgets('second-company', mode);
    [...byId('content').querySelectorAll('button')].find(node=>node.textContent==='Torna alla lista').click();
    await wait(()=>document.querySelector('[data-action="navigate"][data-id="zeta"]'),'SECOND_DETAIL_BACK');
    assert(byId('content').textContent.includes('Zeta seconda A'),'SECOND_RETURN_SCOPE');
    assert(widgetValues.every(node => node.textContent === ''), 'WIDGET_EXIT_CLEAR');
    byId('companies').click();await wait(()=>document.querySelector('[data-company-profile="company"]'),'COMPANY_DIRECTORY_BACK');
    document.querySelector('[data-company-profile="company"]').click();
    await wait(()=>byId('content').textContent.includes('IVA-FITTIZIA'),'COMPANY_PROFILE');
    await checkAnagraphic(mode, true);
    const buttons=label=>[...byId('content').querySelectorAll('button')].filter(node=>node.textContent===label);
    document.querySelector('[data-profile-section="contacts"]').click();
    await wait(()=>byId('content').textContent.includes('pec@example.invalid'),'COMPANY_CONTACTS');
    await checkProfileLink(mode, 'pec', 'Zeta azienda A');
    assert(buttons('Mostra password').length===3,'COMPANY_LINK_COUNT');
    for(const node of buttons('Mostra password')) {node.click();await wait(()=>node.textContent==='Nascondi password'&&!node.disabled,'COMPANY_PASSWORD');}
    const values=[...byId('content').querySelectorAll('dd')];
    assert(values.filter(node=>node.textContent==='SEGRETO-FITTIZIO-company-Zeta-A').length===2,'COMPANY_SHARED_DESTINATION');
    assert(values.some(node=>node.textContent==='SEGRETO-FITTIZIO-private-Zeta-A'),'COMPANY_PRIVATE_DESTINATION');
    buttons('Apri Account collegato')[1].click();
    await wait(()=>byId('content').textContent.includes('Zeta privato A')&&buttons('Torna al profilo').length,'COMPANY_OPEN');
    await checkAccountNote(mode, 'private-linked');
    await checkAccountStandard(mode, 'private-linked');
    assert(values.every(node=>node.textContent===''),'COMPANY_CLEAR');
    buttons('Torna al profilo')[0].click();await wait(()=>byId('content').textContent.includes('IVA-FITTIZIA'),'COMPANY_BACK');
    for(const [section,value] of [['addresses','Filiale fittizia'],['documents','Visura fittizia']]) {
        document.querySelector('[data-profile-section="'+section+'"]').click();await wait(()=>byId('content').textContent.includes(value),'COMPANY_'+section);
    }
    document.querySelector('[data-profile-section="digital-card"]').click();
    await wait(()=>document.querySelector('[data-digital-card-preview]'),'COMPANY_DIGITAL_TAB');
    buttons('Modifica selezione')[0].click();
    await wait(()=>buttons('Salva selezione').length, 'COMPANY_QR_EDITOR');
    const phoneChoice = () => [...byId('content').querySelectorAll('label')].find(node => node.textContent === 'Telefono aziendale').querySelector('input');
    if (mode === 'online') {
        phoneChoice().checked = true; buttons('Salva selezione')[0].click();
        await wait(()=>byId('content').textContent.includes('Selezione salvata.'), 'COMPANY_QR_SAVED');
        buttons('Modifica selezione')[0].click();
        await wait(()=>buttons('Salva selezione').length && !buttons('Salva selezione')[0].disabled, 'COMPANY_QR_REOPENED');
    }
    assert(phoneChoice().checked, 'COMPANY_QR_SELECTION_PERSISTED');
    const companyEditorLabels = [...byId('content').querySelectorAll('label span')];
    buttons('Genera QR dalla selezione salvata')[0].click();
    await wait(()=>byId('content').textContent.includes('QR pronto.'),'COMPANY_DIGITAL_READY');
    const companyQr = document.querySelector('[data-digital-card-preview]'), companyCanvas = companyQr.querySelector('canvas');
    assert(companyQr.title.includes('FN:Azienda fittizia') && companyQr.title.includes('pec@example.invalid'), 'COMPANY_DIGITAL_DATA');
    assert(companyQr.title.includes('111111111'), 'COMPANY_DIGITAL_SELECTED_PHONE');
    assert(!/SEGRETO|personale@example.invalid|Visura/.test(companyQr.title), 'COMPANY_DIGITAL_EXCLUSION');
    document.querySelector('[data-profile-section="pdf-summary"]').click();
    await wait(()=>buttons('Prepara PDF').length, 'COMPANY_PDF_TAB');
    buttons('Prepara PDF')[0].click();
    await wait(()=>byId('content').textContent.includes('PDF pronto.'), 'COMPANY_PDF_READY');
    const pdfValues = [...document.querySelectorAll('[data-company-pdf-preview] dd')];
    assert(pdfValues.some(node => node.textContent === 'Azienda fittizia') && pdfValues.some(node => node.textContent === 'pec@example.invalid'), 'COMPANY_PDF_DATA');
    assert(!pdfValues.some(node => /SEGRETO|Visura/.test(node.textContent)), 'COMPANY_PDF_EXCLUSION');
    assert(!buttons('Scarica PDF')[0].disabled, 'COMPANY_PDF_DOWNLOAD_READY');
    byId('private').click();await wait(()=>document.querySelector('[data-action="navigate"][data-id="alfa"]'),'COMPANY_EXIT');
    assert(companyCanvas.width === 0 && !companyQr.title, 'COMPANY_DIGITAL_CLEAR');
    assert(companyEditorLabels.every(node => node.textContent === ''), 'COMPANY_QR_EDITOR_CLEAR');
    assert(pdfValues.every(node => node.textContent === ''), 'COMPANY_PDF_CLEAR');
    assert(document===marker,'COMPANY_RELOAD');
    profileChecks.push('company canonical profile tabs rendered '+mode,'company shared and private linked credentials with safe navigation '+mode);
    profileChecks.push('company directory search and second profile '+mode,'same Account ID in different companies navigates with correct company scope '+mode);
}
async function checkProfile(mode) {
    const originalDocument = document;
    byId('profile').click();
    await wait(() => byId('content').textContent.includes('Nome fittizio'), 'PROFILE_PERSONAL');
    assert(document.querySelector('[data-profile-section="overview"][aria-pressed="true"]'), 'PROFILE_OVERVIEW_DEFAULT');
    assert(byId('content').textContent.includes('fixture@example.invalid') && !byId('content').textContent.includes('Nota anagrafica fittizia'), 'PROFILE_OVERVIEW_MINIMAL');
    [...byId('content').querySelectorAll('button')].find(node => node.textContent === 'Apri Anagrafica').click();
    await wait(() => byId('content').textContent.includes('Nota anagrafica fittizia'), 'PROFILE_OVERVIEW_NAVIGATION');
    await checkAnagraphic(mode, false);
    const profileNote = [...byId('content').querySelectorAll('dd')].find(node => node.textContent === 'Nota anagrafica fittizia');
    assert(profileNote, 'PROFILE_NOTE');
    await wait(() => document.querySelector('[data-profile-widget="fixture"] > button'), 'PROFILE_WIDGET_MOUNT');
    document.querySelector('[data-profile-widget="fixture"] > button').click();
    await wait(() => [...byId('content').querySelectorAll('button')].some(node => node.textContent === 'Mostra PIN profilo'), 'PROFILE_WIDGET_EXPAND');
    assert(!byId('content').textContent.includes('WIDGET-FITTIZIO') && !byId('content').textContent.includes('ANTEPRIMA-FITTIZIA'), 'PROFILE_WIDGET_PREVIEW');
    [...byId('content').querySelectorAll('button')].find(node => node.textContent === 'Mostra PIN profilo').click();
    await wait(() => byId('content').textContent.includes('WIDGET-FITTIZIO'), 'PROFILE_WIDGET_REVEAL');
    const profileWidgetValues = [...byId('content').querySelectorAll('.shared-account-value')];
    document.querySelector('[data-profile-section="digital-card"]').click();
    await wait(() => document.querySelector('[data-digital-card-preview]'), 'DIGITAL_CARD_TAB');
    assert(!document.querySelector('[data-digital-card-preview] canvas'), 'DIGITAL_CARD_EXPLICIT');
    const qrButton = label => [...byId('content').querySelectorAll('button')].find(node => node.textContent === label);
    qrButton('Modifica selezione').click();
    await wait(() => qrButton('Salva selezione'), 'QR_EDITOR_READY');
    const birthChoice = () => [...byId('content').querySelectorAll('label')].find(node => node.textContent === 'Nascita').querySelector('input');
    if (mode === 'online') {
        birthChoice().checked = true; qrButton('Salva selezione').click();
        await wait(() => byId('content').textContent.includes('Selezione salvata.'), 'QR_EDITOR_SAVED');
        qrButton('Modifica selezione').click();
        await wait(() => qrButton('Salva selezione') && !qrButton('Salva selezione').disabled, 'QR_EDITOR_REOPENED');
    }
    assert(birthChoice().checked, 'QR_EDITOR_PERSISTED');
    const editorLabels = [...byId('content').querySelectorAll('label span')];
    [...byId('content').querySelectorAll('button')].find(node => node.textContent === 'Genera QR dalla selezione salvata').click();
    await wait(() => byId('content').textContent.includes('QR pronto.'), 'DIGITAL_CARD_GENERATED');
    const qrPreview = document.querySelector('[data-digital-card-preview]'), qrCanvas = qrPreview.querySelector('canvas');
    assert(qrPreview.title.includes('EMAIL:fixture@example.invalid') && !qrPreview.title.includes('SEGRETO') && !qrPreview.title.includes('WIDGET-FITTIZIO'), 'DIGITAL_CARD_PROJECTION');
    for (const [section, expected] of [['contacts','fixture@example.invalid'],['addresses','Via fittizia'],['documents','DOC-FITTIZIO']]) {
        document.querySelector('[data-profile-section="'+section+'"]').click();
        await wait(() => byId('content').textContent.includes(expected), 'PROFILE_'+section);
        assert(profileNote.textContent === '', 'PROFILE_NOTE_CLEAR');
        assert(profileWidgetValues.every(node => node.textContent === ''), 'PROFILE_WIDGET_TAB_CLEAR');
        assert(qrCanvas.width === 0 && !qrPreview.title, 'DIGITAL_CARD_CLEAR');
        assert(editorLabels.every(node => node.textContent === ''), 'QR_EDITOR_CLEAR');
        await checkProfileLink(mode, section === 'contacts' ? 'email' : section === 'addresses' ? 'utility' : 'document', section === 'addresses' ? 'Zeta azienda A' : 'Zeta privato A');
        if (section === 'contacts') await checkProfileLink(mode, 'phone', 'Zeta privato A');
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
    for (const headers of [{}, {'x-firebase-appcheck': 'synthetic-app-check', authorization: 'Bearer invalid'}]) {
        for (const endpoint of ['applyPrivateQrSelection', 'applyCompanyQrSelection', 'applyProfileTextMutation', 'applyAccountNoteMutation', 'applyAccountStandardMutation', 'applyProfileLinkMutation', 'applyProfileAccountCreate', 'applyProfileContactsMutation', 'applyCompanyContactsMutation', 'applyPrivateAddressesMutation', 'applyCompanyAddressesMutation']) {
            const qrDenied = await fetch('/demo-vault-shell/europe-west1/' + endpoint, {method: 'POST', headers, body: '{}'});
            assert(qrDenied.status === 401, 'QR_UNAUTHENTICATED_BRIDGE_ACCEPTED');
        }
    }
    await wait(() => byId('login') && !byId('login').disabled, 'LOGIN');
    byId('login').click();
    await wait(() => byId('status').textContent.includes('bloccato') && !byId('unlock').disabled, 'AUTH');
    byId('unlock').click();
    await wait(() => byId('master-dialog').open, 'PROMPT');
    byId('unlock-value').value = 'MASTER-FITTIZIA-A!123';
    byId('master-dialog').querySelector('form').requestSubmit();
    await wait(() => document.querySelector('[data-action="navigate"][data-id="alfa"]'), 'LIST');
    await checkProfile('online');
    await checkContactsEditor('online');
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
    await checkContactsEditor('offline');
    await checkCompanyProfile('offline');
    await checkBanking('offline', {reopen: true});
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
    await checkAccountNote('online', 'private-linked-after-recovery');
    assert(content.textContent.includes('Zeta'), 'LINKED_DETAIL_LOST');
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
