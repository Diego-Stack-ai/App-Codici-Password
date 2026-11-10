import {withStandaloneFrame} from './lib/standalone-frame-context.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {testTranslate} from './helpers/test-translator.mjs';
const guardSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/credential-decrypt-guard.js', import.meta.url), 'utf8');
const {DECRYPT_FAILURE_MESSAGE, assertAccountSaveAllowed, createAccountLoadContext, isAccountSaveAllowed} =
    await import(`data:text/javascript;base64,${Buffer.from(guardSource).toString('base64')}`);

const moduleRoot = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
async function sourceModule(path) {
    const source = await readFile(new URL(path, moduleRoot), 'utf8');
    return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}
const model = await sourceModule('privato/profile-model.js');
const companyModel = await sourceModule('azienda/company-profile-model.js');
const modes = await sourceModule('shared/account-mode-model.js');
const crypto = await sourceModule('core/crypto-utils.js');
// M7-FIX-1B: gli scrittori reali usano `sanitizeEmail`, `sharingCycleOf` e
// `inviteIdForGuest` da `utils.js`; il banco inietta gli helper REALI (nessuno
// stub) perché gli import vengono rimossi dal caricatore.
const utils = await sourceModule('../utils.js');

// Esegue il codice applicativo reale sostituendo solo i confini browser/Firebase.
async function loadController(path, dependencies, exports) {
    dependencies = withStandaloneFrame(dependencies);
    const source = (await readFile(new URL(path, moduleRoot), 'utf8'))
        .replace(/import\s+(?!\()[\s\S]*?\sfrom\s*['"][^'"]+['"];?/g, '')
        .replace(/export\s+(?=(async\s+)?function|const|let)/g, '');
    return new Function(...Object.keys(dependencies), `${source}\nreturn {${exports.join(',')}};`)(...Object.values(dependencies));
}

test('schede Profilo: telefono collegabile e password legacy ancora recuperabile dopo il collegamento', async () => {
    const containers = { 'telefoni-view-container': { children: [] }, 'email-view-container': { children: [] } };
    const createElement = (tag, props = {}, children = []) => ({ tag, ...props, children: children.flat().filter(Boolean), setAttribute(key, value) { this[key] = value; } });
    const createLinkedAccountButton = (contact, open, connect) => {
        const linked = Boolean(contact.linkedAccountId);
        const button = createElement('button', {
            textContent: linked ? 'Apri Account collegato' : 'Collega o crea Account',
            onclick: linked ? open : connect
        });
        if (linked) Promise.resolve().then(() => { button.textContent = 'Apri: IrenYou'; });
        return button;
    };
    const controller = await loadController('privato/profilo-phones-emails.js', {
        ...model, createElement, createLinkedAccountButton, clearElement: node => { node.children = []; },
        setChildren: (node, children) => { node.children = children; },
        document: { getElementById: id => containers[id] }, t: value => value
    }, ['initPhonesEmailsModule', 'renderPhonesView', 'renderEmailsView']);
    const phone = { id: 'p', number: '+390001' };
    const email = { id: 'e', address: 'fixture@example.test', password: 'SECRET-FIXTURE', linkedAccountId: 'a' };
    const calls = [];
    controller.initPhonesEmailsModule(() => ({ contactPhones: [phone], contactEmails: [email], qrCodeInclusions: { phones: [], emails: [] } }), {
        connectPhoneAccount: contact => calls.push(contact), openLinkedAccount: id => calls.push(id),
        readLinkedAccountName: async () => 'IrenYou'
    });
    controller.renderPhonesView();
    controller.renderEmailsView();
    const walk = node => [node, ...(node.children || []).flatMap(walk)];
    const phoneNodes = walk(containers['telefoni-view-container']);
    phoneNodes.find(node => node.textContent === 'Collega o crea Account').onclick();
    assert.equal(calls[0], phone);
    const emailNodes = walk(containers['email-view-container']);
    assert.ok(emailNodes.some(node => node.textContent === 'Password legacy'));
    assert.ok(emailNodes.some(node => node.textContent === 'Verifica trasferimento password'));
    assert.equal(emailNodes.some(node => node.textContent === 'SECRET-FIXTURE'), false);
    await Promise.resolve();
    emailNodes.find(node => node.textContent === 'Apri: IrenYou').onclick();
    assert.equal(calls[1], 'a');
});

test('precompila solo i campi vuoti senza sostituire credenziali esistenti', () => {
    const email = { address: 'fixture@example.test', password: 'legacy', note: 'nota profilo' };
    assert.deepEqual(model.prepareProfileEmailAccountValues(email), {
        username: email.address, password: 'legacy', note: 'nota profilo'
    });
    const existing = { username: 'altro', password: 'password Account', note: 'nota Account' };
    assert.deepEqual(model.prepareProfileEmailAccountValues(email, existing), existing);
});

for (const type of ['email', 'phone']) {
    for (const createNew of [false, true]) {
      for (const company of [false, true]) {
        test(`${type} ${company ? 'azienda' : 'personale'}: seleziona e apre ${createNew ? 'un nuovo Account' : 'un Account esistente'} senza passare segreti`, async () => {
            let modal;
            const storage = new Map();
            const window = { location: { href: '' } };
            const dependencies = {
                ...model, ...modes, auth: { currentUser: { uid: 'owner' } },
                listPrivateAccounts: async () => [
                    { id: 'account-a', nomeAccount: 'Account fixture', username: 'fixture@example.test' },
                    { id: 'account-b', nomeAccount: 'Account fixture', username: 'fixture@example.test' },
                    { id: 'shared-owned', nomeAccount: 'IrenYou', visibility: 'shared', username: 'energia@example.test' },
                    { id: 'shared-received', nomeAccount: 'Ricevuto', visibility: 'shared', _isGuest: true },
                    { id: 'archived', isArchived: true },
                    { id: 'memo', nomeAccount: 'Memorandum', type: 'memorandum' },
                    { id: 'memo-shared', nomeAccount: 'Memorandum condiviso', type: 'memo', visibility: 'shared', isMemoShared: true },
                    { id: 'used', linkedProfileField: { type: 'email', id: 'another' } }
                ],
                listCompanies: async () => [{ id: 'company-1', ragioneSociale: 'Azienda fixture' }],
                listCompanyAccounts: async () => [{ id: 'account-b', nomeAccount: 'Account aziendale' }],
                ensureVaultKeyMaterial: async () => 'key', decrypt: async value => value,
                showProfileAccountPicker: options => { modal = options; },
                sessionStorage: { setItem: (key, value) => storage.set(key, value) }, window
            };
            const controller = await loadController('privato/profilo-links.js', dependencies, ['connectEmailAccount', 'connectPhoneAccount']);
            const contact = { id: 'contact-1', address: 'fixture@example.test', number: '+390001', password: 'SECRET-FIXTURE', pin: 'PIN-FIXTURE' };
            let synced = 0;
            await controller[type === 'email' ? 'connectEmailAccount' : 'connectPhoneAccount'](contact, async () => { synced++; });
            assert.equal(modal.accounts.length, 7);
            assert.equal(modal.accounts.filter(item => item.id === 'account-b').length, 2);
            assert.equal(modal.accounts.some(item => item.id === 'shared-owned' && item.name === 'IrenYou'), true);
            assert.equal(modal.accounts.some(item => item.id === 'shared-received'), false);
            assert.equal(modal.accounts.some(item => item.id === 'memo'), true);
            assert.equal(modal.accounts.some(item => item.id === 'memo-shared'), true);
            await modal.onSelect(createNew ? { companyId: company ? 'company-1' : '' } : modal.accounts.find(item => item.id === 'account-b' && Boolean(item.companyId) === company));
            assert.equal(window.location.href.includes('aziendaId=company-1'), company);
            assert.equal(window.location.href.includes('form_account_azienda.html'), company);
            assert.equal(synced, 1);
            assert.match(window.location.href, /profileContactId=contact-1/);
            assert.equal(window.location.href.includes('id=account-b'), !createNew);
            const serialized = storage.get('profile-account-link-draft');
            assert.equal(JSON.parse(serialized).contactType, type);
            assert.equal(JSON.parse(serialized).ownerUid, 'owner');
            assert.doesNotMatch(serialized, /SECRET-FIXTURE|PIN-FIXTURE/);
        });
    }
}

}

test('un errore di sincronizzazione non apre il form e non persiste la bozza', async () => {
    let modal, wrote = false;
    const window = { location: { href: '' } };
    const controller = await loadController('privato/profilo-links.js', {
        ...model, ...modes, auth: { currentUser: { uid: 'owner' } },
        listPrivateAccounts: async () => [{ id: 'a' }],
        listCompanies: async () => [],
        ensureVaultKeyMaterial: async () => 'key',
        showProfileAccountPicker: options => { modal = options; },
        sessionStorage: { setItem: () => { wrote = true; } }, window
    }, ['connectPhoneAccount']);
    await controller.connectPhoneAccount({ id: 'p' }, async () => { throw new Error('offline'); });
    await assert.rejects(modal.onSelect(modal.accounts[0]), /offline/);
    assert.equal(wrote, false);
    assert.equal(window.location.href, '');
});

async function saveFixture({ type = 'email', password = 'legacy', legacy = 'legacy', failCommit = false, conflict = false, missing = false, editing = true, unreadable = false, company = false, wrongCompany = false, sourceCompany = false, multiple = false, shared = false, memo = false, memoShared = false, companyPasswordDecision = 'keep' } = {}) {
    const profileKey = {email:'contactEmails',phone:'contactPhones',document:'documenti',utility:'userAddresses'}[type];
    const contact = { id: 'contact-1', number: '+390001', address: 'fixture@example.test', password: legacy ? `cipher:${legacy}` : '', note: 'cipher:nota', custom: 'preserve' };
    const records = missing ? [] : [contact, {id:'other',password:'cipher:other',...(multiple?{linkedAccountId:'account-1',linkedAccountCompanyId:company?'company-1':''}:{})}];
    const profile = {[profileKey]:type==='utility'?[{id:'address',utilities:records}]:records};
    const sourceData = {emails:{extra:[{...contact,email:contact.address}]},telefonoAzienda:contact.number};
    const fields = { 'account-name': { value: 'Fixture' }, 'account-password': { value: memo || memoShared ? '' : password }, 'account-username': { value: memo || memoShared ? '' : 'fixture@example.test' }, 'flag-shared': { checked: shared }, 'flag-memo': { checked: memo }, 'flag-memo-shared': { checked: memoShared }, 'btn-save-footer': { disabled: false }, 'save-btn-footer': { disabled: false } };
    const committed = [];
    const messages = [];
    let draftRemoved = false;
    function ref(...parts) {
        const path = parts.map(part => typeof part === 'string' ? part : part?.path || '').filter(Boolean).join('/');
        return { path, id: path.split('/').at(-1) };
    }
    const dependencies = {
        ...utils, ...model, ...modes,
        auth: { currentUser: { uid: 'owner', email: 'owner@example.test' } }, db: {}, LOG: () => {},
        doc: (...parts) => parts.length === 1 ? ref(parts[0], 'new-account') : ref(...parts), collection: ref,
        increment: amount => amount, deleteField: () => 'DELETE',
        isAccountSaveAllowed, assertAccountSaveAllowed, DECRYPT_FAILURE_MESSAGE,
        runTransaction: async (db, callback) => {
            const staged = [];
            await callback({
                get: async reference => ({ exists: () => true, data: () => reference.path === 'users/owner/aziende/source' ? sourceData : reference.path === 'users/owner' ? profile : { revision: conflict ? 2 : 1, updatedAt: conflict ? 'changed' : '', ...(multiple?{linkedProfileField:{type,id:'other'},linkedCompanyProfileField:{companyId:'another',type:'phone',id:'already'}}:{}) } }),
                update: (reference, value) => staged.push({ path: reference.path, value }),
                set: (reference, value) => staged.push({ path: reference.path, value }), delete: () => {}
            });
            if (failCommit) throw new Error('fixture commit failed');
            committed.push(...staged);
        },
        showToast: (message, severity) => messages.push({ message, severity }), t: key => key,
        promptCompanyProfilePasswordChoice: async ({accountPassword}) => ({
            proceed: companyPasswordDecision !== 'cancel',
            accountPassword: companyPasswordDecision === 'transfer' ? legacy : accountPassword,
            clearProfilePassword: ['clear','transfer'].includes(companyPasswordDecision),
            expectedProfilePassword: `cipher:${legacy}`,
            outcome: companyPasswordDecision
        }),
        encrypt: async value => value ? `cipher:${value}` : '', ensureVaultKeyMaterial: async () => 'key',
        decodeProfileContactValue: async value => { if (unreadable) throw new Error('unreadable'); return value?.replace(/^cipher:/, '') || ''; },
        classifyPrivateAccountOfflineWrite: () => ({ eligible: false, reason: 'profile-link' }),
        hasInvalidCardExpiry: () => false, formatCardExpiry: value => value,
        document: { getElementById: id => fields[id] || null, querySelector: () => null }, navigator: { onLine: true },
        sessionStorage: { removeItem: () => { draftRemoved = true; } },
        setTimeout: () => {}, console: { error: () => {} }
    };
    dependencies.prepareCompanyProfileLink = (await loadController('azienda/company-profile-link.js',{...dependencies,...companyModel},['prepareCompanyProfileLink'])).prepareCompanyProfileLink;
    dependencies.decryptRequiredValue = dependencies.decodeProfileContactValue;
    const method = company ? 'saveAccount' : 'savePrivateAccount';
    const controller = await loadController(company ? 'azienda/form-azienda-save.js' : 'privato/form-privato-save.js', dependencies, [method]);
    await controller[method]({ bankAccounts: [], invitedEmails: shared || memoShared ? ['recipient@example.test'] : [], currentUid: 'owner', currentDocId: 'account-1', currentAziendaId: 'company-1', isEditing: editing, baseRevision: 1, loadContext: createAccountLoadContext({mode: 'create'}),
        profileContactLinkDraft: { profileContactId: sourceCompany && type === 'phone' ? 'telefonoAzienda' : 'contact-1', contactType: type, ownerUid: 'owner', ...(type==='utility'?{parentAddressId:'address'}:{}), ...(sourceCompany ? {sourceCompanyId:'source',contactValue:type==='phone'?contact.number:contact.address} : {}), ...(company ? { companyId: wrongCompany ? 'wrong-company' : 'company-1' } : {}) } });
    return { committed, contact, messages, draftRemoved, profileKey };
}

for (const editing of [true, false]) test(`salvataggio ${editing ? 'esistente' : 'nuovo'}: trasferisce password e collegamento nella stessa transazione`, async () => {
    const result = await saveFixture({ editing });
    assert.equal(result.committed.length, 2);
    const account = result.committed.find(item => item.path.includes('/accounts/'));
    const profile = result.committed.find(item => item.path === 'users/owner').value;
    assert.equal(account.value.password, 'cipher:legacy');
    assert.equal(profile.contactEmails[0].password, '');
    assert.equal(profile.contactEmails[0].linkedAccountId, account.path.split('/').at(-1));
    assert.deepEqual(account.value.linkedProfileField, { type: 'email', id: 'contact-1' });
    assert.equal(profile.contactEmails[1].password, 'cipher:other');
    assert.equal(result.contact.password, 'cipher:legacy');
    assert.equal(result.draftRemoved, true);
});

test('un Account condiviso dal proprietario conserva il collegamento al Profilo', async () => {
    const result = await saveFixture({ shared: true });
    assert.ok(result.committed.length >= 2);
    const account = result.committed.find(item => item.path === 'users/owner/accounts/account-1');
    assert.equal(account.value.visibility, 'shared');
    assert.deepEqual(account.value.linkedProfileField, { type: 'email', id: 'contact-1' });
    assert.equal(result.committed.find(item => item.path === 'users/owner').value.contactEmails[0].linkedAccountId, 'account-1');
});

for (const memoShared of [false, true]) test(`${memoShared ? 'Memorandum condiviso' : 'Memorandum'} del proprietario collegabile al Profilo`, async () => {
    const result = await saveFixture(memoShared ? { memoShared: true } : { memo: true });
    const account = result.committed.find(item => item.path === 'users/owner/accounts/account-1');
    assert.equal(account.value.type, 'memo');
    assert.equal(account.value.visibility, memoShared ? 'shared' : 'private');
    assert.deepEqual(account.value.linkedProfileField, { type: 'email', id: 'contact-1' });
    assert.equal(result.committed.find(item => item.path === 'users/owner').value.contactEmails[0].linkedAccountId, 'account-1');
});

test('ricerca per nome, utente e azienda, senza dipendere da accenti o maiuscole', () => {
    const accounts = [{ id: 'same', name: 'Caffè', username: 'diego', companyId: '', companyName: '' },
        { id: 'same', name: 'Portale', username: 'diego', companyId: 'c1', companyName: 'Società Alfa' }];
    assert.deepEqual(model.filterProfileAccounts(accounts, 'CAFFE'), [accounts[0]]);
    assert.deepEqual(model.filterProfileAccounts(accounts, 'societa diego'), [accounts[1]]);
    assert.deepEqual(model.filterProfileAccounts(accounts, '', 'personal'), [accounts[0]]);
    assert.deepEqual(model.filterProfileAccounts(accounts, '', 'company:c1'), [accounts[1]]);
    assert.deepEqual(model.filterProfileAccounts(accounts, 'inesistente'), []);
    assert.equal(model.profileAccountUrl('same', 'c1', { edit: true, contactId: 'phone-1' }), 'form_account_azienda.html?id=same&aziendaId=c1&profileContactId=phone-1');
    assert.equal(model.profileAccountUrl('same'), 'dettaglio_account_privato.html?id=same');
});

for (const editing of [true, false]) test(`Account aziendale ${editing ? 'esistente' : 'nuovo'}: trasferimento atomico e riferimento completo`, async () => {
    const result = await saveFixture({ company: true, editing });
    assert.equal(result.committed.length, 2);
    const contact = result.committed.find(item => item.path === 'users/owner').value.contactEmails[0];
    assert.equal(contact.linkedAccountCompanyId, 'company-1');
    assert.equal(contact.password, '');
    assert.equal(result.committed[0].path, `users/owner/aziende/company-1/accounts/${editing ? 'account-1' : 'new-account'}`);
});
test('telefono aziendale: conserva i dati e registra anche ID azienda', async () => {
    const result = await saveFixture({ company: true, type: 'phone' });
    const contact = result.committed.find(item => item.path === 'users/owner').value.contactPhones[0];
    assert.deepEqual(contact, { ...result.contact, linkedAccountId: 'account-1', linkedAccountCompanyId: 'company-1' });
});
test('Account aziendale con password diversa: conserva la password del Profilo', async () => {
    const result = await saveFixture({ company: true, password: 'different' });
    assert.equal(result.committed.find(item => item.path === 'users/owner').value.contactEmails[0].password, 'cipher:legacy');
});
for (const condition of ['failCommit', 'conflict', 'missing', 'unreadable', 'wrongCompany']) test(`Account aziendale ${condition}: conserva dati e bozza`, async () => {
    const result = await saveFixture({ company: true, [condition]: true });
    assert.deepEqual(result.committed, []);
    assert.equal(result.draftRemoved, false);
});

for (const password of ['', 'different']) test(`password Account ${password || 'vuota'}: conserva il valore legacy`, async () => {
    const result = await saveFixture({ password });
    assert.equal(result.committed.find(item => item.path === 'users/owner').value.contactEmails[0].password, 'cipher:legacy');
    assert.equal(result.messages.at(-1).severity, 'warning');
});

test('telefono: collega entrambi i record e conserva tutti i campi preesistenti', async () => {
    const result = await saveFixture({ type: 'phone' });
    const phone = result.committed.find(item => item.path === 'users/owner').value.contactPhones[0];
    assert.deepEqual(phone, { ...result.contact, linkedAccountId: 'account-1' });
    assert.deepEqual(result.committed[0].value.linkedProfileField, { type: 'phone', id: 'contact-1' });
});

for (const condition of ['failCommit', 'conflict', 'missing', 'unreadable']) test(`${condition}: nessuna scrittura parziale o cancellazione della bozza`, async () => {
    const result = await saveFixture({ [condition]: true });
    assert.deepEqual(result.committed, []);
    assert.equal(result.draftRemoved, false);
    assert.equal(result.messages.at(-1).severity, 'error');
});

test('decifratura reale: confronto esatto e rifiuto di un ciphertext illeggibile', async () => {
    const decodeProfileContactValue = crypto.decryptRequiredValue;
    const key = crypto.generateVaultKey();
    const value = await crypto.encrypt('FIXTURE password con spazi ', key);
    const decoded = await decodeProfileContactValue(value, key);
    assert.equal(model.isProfileEmailPasswordTransferred(decoded, 'FIXTURE password con spazi '), true);
    assert.equal(model.isProfileEmailPasswordTransferred(decoded, 'FIXTURE password con spazi'), false);
    await assert.rejects(decodeProfileContactValue(value, crypto.generateVaultKey()));
});

for (const company of [false, true]) {
    test('lettura password collegata ' + (company ? 'aziendale' : 'personale') + ' dal solo Account', async () => {
        const calls = [];
        const controller = await loadController('privato/profilo-links.js', {
            auth: {currentUser: {uid: 'owner'}}, ensureVaultKeyMaterial: async () => 'vault',
            getPrivateAccountConfirmed: async (...args) => {calls.push(args); return {password: 'cipher'};},
            getCompanyAccountConfirmed: async (...args) => {calls.push(args); return {password: 'cipher'};},
            decryptRequiredValue: async (value, key) => {assert.equal(value, 'cipher'); assert.equal(key, 'vault'); return 'account-password';}
        }, ['readLinkedEmailAccountPassword']);
        const email = {id: 'e', linkedAccountId: 'a', ...(company ? {linkedAccountCompanyId: 'c'} : {})};
        assert.equal(await controller.readLinkedEmailAccountPassword(email), 'account-password');
        assert.deepEqual(calls, [company ? ['owner', 'c', 'a'] : ['owner', 'a']]);
        assert.equal(Object.hasOwn(email, 'password'), false);
    });
}

test('password Account: mascherata all’avvio, copia senza rivelare, mostra e nascondi, errore senza segreti', async () => {
    const createElement = (tag, props = {}, children = []) => ({tag, ...props, children: children.filter(Boolean), isConnected: true, setAttribute(k,v) {this[k]=v;}});
    let reads = 0, fail = false;
    const copied = [];
    const controller = await loadController('privato/profilo-phones-emails.js', {
        createElement, t: testTranslate,
        navigator: {clipboard: {writeText: async value => copied.push(value)}}
    }, ['initPhonesEmailsModule', 'createLinkedAccountPassword']);
    controller.initPhonesEmailsModule(() => ({}), {readLinkedEmailAccountPassword: async () => {reads++; if(fail) throw Error('unreadable'); return 'SECRET-FIXTURE';}});
    const row = controller.createLinkedAccountPassword({linkedAccountId:'a'});
    const [value,toggle,copy] = row.children[1].children;
    const event = {stopPropagation(){}};
    assert.equal(value.textContent, '••••••••'); assert.equal(reads, 0);
    await copy.onclick(event); assert.deepEqual(copied, ['SECRET-FIXTURE']); assert.equal(value.textContent, '••••••••');
    await toggle.onclick(event); assert.equal(value.textContent, 'SECRET-FIXTURE');
    await toggle.onclick(event); assert.equal(value.textContent, '••••••••'); assert.equal(reads, 2);
    fail = true; await toggle.onclick(event); assert.equal(value.textContent, '••••••••');
    assert.match(row.children[2].textContent, /non riuscita/);
    assert.equal(toggle.disabled, false);
});

test('lettura password: account mancante e cambio sessione non espongono il dato', async () => {
    const auth = {currentUser:{uid:'owner'}};
    let missing = true;
    const controller = await loadController('privato/profilo-links.js', {
        auth, ensureVaultKeyMaterial: async () => 'vault',
        getPrivateAccountConfirmed: async () => missing ? null : {password:'cipher'},
        decryptRequiredValue: async () => {auth.currentUser = {uid:'other'}; return 'secret';}
    }, ['readLinkedEmailAccountPassword']);
    await assert.rejects(controller.readLinkedEmailAccountPassword({linkedAccountId:'a'}), /non disponibile/);
    missing = false;
    await assert.rejects(controller.readLinkedEmailAccountPassword({linkedAccountId:'a'}), /Sessione cambiata/);
});

for (const company of [false,true]) for (const editing of [false,true]) for (const type of ['email','phone']) test('Profilo aziendale → Account '+(company?'aziendale':'personale')+' '+(editing?'esistente':'nuovo')+' '+type,async()=>{
    const result=await saveFixture({sourceCompany:true,company,editing,type});
    assert.equal(result.committed.length,2,JSON.stringify(result.messages));
    const source=result.committed.find(item=>item.path==='users/owner/aziende/source').value;
    const account=result.committed.find(item=>item.path.includes('/accounts/'));
    const link=type==='email'?source.emails.extra[0]:source.phoneAccountLinks.telefonoAzienda;
    assert.equal(link.linkedAccountId,account.path.split('/').at(-1));
    assert.equal(link.linkedAccountCompanyId,company?'company-1':'');
    if(type==='email'){assert.equal(link.password,'cipher:legacy');assert.equal(link.custom,'preserve');}
    assert.deepEqual(account.value.linkedCompanyProfileField,{companyId:'source',type,id:type==='email'?'contact-1':'telefonoAzienda'});
    assert.equal(account.value.linkedProfileField,undefined);
    assert.equal(result.draftRemoved,true);
});
for (const company of [false,true]) test('Profilo aziendale: scelta esplicita elimina il duplicato nello stesso commit '+company,async()=>{
    const result=await saveFixture({sourceCompany:true,company,type:'email',companyPasswordDecision:'clear'});
    const source=result.committed.find(item=>item.path==='users/owner/aziende/source').value;
    const account=result.committed.find(item=>item.path.includes('/accounts/')).value;
    assert.equal(source.emails.extra[0].password,'');
    assert.equal(account.password,'cipher:legacy');
});
test('Profilo aziendale: annullare il confronto non salva né cancella dati',async()=>{
    const result=await saveFixture({sourceCompany:true,type:'email',companyPasswordDecision:'cancel'});
    assert.deepEqual(result.committed,[]);
    assert.equal(result.draftRemoved,false);
    assert.match(result.messages.at(-1).message,/annullato/i);
});
test('scelta password aziendale: uguale, trasferibile e diversa restano decisioni esplicite',async()=>{
    const draft={sourceCompanyId:'source',contactType:'email',profileContactId:'contact-1',contactValue:'fixture@example.test'};
    const source={emails:{extra:[{id:'contact-1',email:'fixture@example.test',password:'cipher:profilo'}]}};
    const answers=[];const prompts=[];
    const controller=await loadController('azienda/company-profile-link.js',{
        ...companyModel,auth:{currentUser:{uid:'owner'}},getCompany:async()=>source,
        decryptRequiredValue:async value=>value.replace(/^cipher:/,''),
        showConfirmModal:async(...args)=>{prompts.push(args);return answers.shift();}
    },['promptCompanyProfilePasswordChoice']);
    answers.push(true);
    const same=await controller.promptCompanyProfilePasswordChoice({uid:'owner',draft,accountName:'Gmail amministrazione',accountPassword:'profilo',vaultKeyMaterial:'key'});
    assert.equal(same.clearProfilePassword,true);assert.equal(same.outcome,'removed-duplicate');
    answers.push(true);draft._accountPasswordInitiallyEmpty=true;
    const transfer=await controller.promptCompanyProfilePasswordChoice({uid:'owner',draft,accountName:'Gmail amministrazione',accountPassword:'profilo',vaultKeyMaterial:'key'});
    assert.equal(transfer.accountPassword,'profilo');assert.equal(transfer.clearProfilePassword,true);assert.equal(transfer.outcome,'transferred');
    answers.push(false);
    const keepProfile=await controller.promptCompanyProfilePasswordChoice({uid:'owner',draft,accountName:'Gmail amministrazione',accountPassword:'profilo',vaultKeyMaterial:'key'});
    assert.equal(keepProfile.accountPassword,'');assert.equal(keepProfile.clearProfilePassword,false);assert.equal(keepProfile.outcome,'kept-profile');
    delete draft._accountPasswordInitiallyEmpty;answers.push(false);
    const different=await controller.promptCompanyProfilePasswordChoice({uid:'owner',draft,accountName:'Gmail amministrazione',accountPassword:'diversa',vaultKeyMaterial:'key'});
    assert.equal(different.proceed,false);assert.equal(different.clearProfilePassword,false);assert.equal(different.outcome,'cancelled');
    assert.match(prompts[0][1],/coincidono/);assert.match(prompts[1][1],/non contiene/);assert.match(prompts[2][1],/non contiene/);assert.match(prompts[3][1],/diverse/);
});
for(const company of [false,true]) for(const condition of ['conflict','failCommit']) test('Profilo aziendale: nessuna modifica parziale '+company+' '+condition,async()=>{
    const result=await saveFixture({sourceCompany:true,company,[condition]:true});
    assert.deepEqual(result.committed,[]);assert.equal(result.draftRemoved,false);
});

for(const company of [false,true]) for(const type of ['email','phone','utility','document']) test('Riutilizza Account '+company+' per più '+type+' conservando i collegamenti precedenti',async()=>{
 const r=await saveFixture({company,type,multiple:true});assert.equal(r.committed.length,2,JSON.stringify(r.messages));
 const account=r.committed.find(x=>x.path.includes('/accounts/')).value;
 assert.equal(account.linkedProfileFields.length,2);assert.deepEqual(account.linkedProfileFields.map(x=>x.id),['contact-1','other']);
 const profile=r.committed.find(x=>x.path==='users/owner').value;
 const items=type==='utility'?profile.userAddresses[0].utilities:profile[r.profileKey];
 assert.equal(items[0].linkedAccountId,'account-1');assert.equal(items[1].linkedAccountId,'account-1');assert.equal(items[1].password,'cipher:other');
 if(type==='document')assert.equal(items[0].password,'cipher:legacy');
});
test('Riferimenti aziendali multipli: aggiunta e rimozione non toccano gli altri contatti',()=>{
 const first={companyId:'c',type:'phone',id:'mobile'},second={companyId:'c',type:'phone',id:'fixed'};
 const refs=companyModel.companyAccountReferences({linkedCompanyProfileField:first},second);
 assert.deepEqual(refs,[first,second]);assert.deepEqual(companyModel.companyAccountReferences({linkedCompanyProfileField:first,linkedCompanyProfileFields:refs},first,true),[second]);
});
test('Foto vCard soltanto con inclusione esplicita e senza righe iniettate',async()=>{
 const qr=await sourceModule('shared/qr_code_utils-v2.js');const user={photoURL:'https://example.test/avatar.jpg\nTEL:fake'};
 assert.doesNotMatch(qr.buildVCard(user,{}),/PHOTO/);
 const card=qr.buildVCard(user,{photo:true});assert.match(card,/PHOTO;VALUE=URI:https:/);assert.doesNotMatch(card,/\nTEL:fake/);
 assert.doesNotMatch(qr.buildVCard({photoURL:'javascript:alert(1)'},{photo:true}),/PHOTO/);
});

test('Utenze con ID uguale in indirizzi diversi: aggiorna soltanto l’indirizzo selezionato',()=>{
 const profile={userAddresses:[{id:'home',utilities:[{id:'u',value:'cipher:pod',custom:1}]},{id:'office',utilities:[{id:'u',value:'cipher:other'}]}]};
 const draft={contactType:'utility',profileContactId:'u',parentAddressId:'home'};
 const found=model.findProfileAccountItem(profile,draft);const patch=model.patchProfileAccountItem(profile,draft,{...found,linkedAccountId:'a'});
 assert.equal(patch.userAddresses[0].utilities[0].linkedAccountId,'a');assert.deepEqual(patch.userAddresses[1],profile.userAddresses[1]);assert.equal(patch.userAddresses[0].utilities[0].value,'cipher:pod');
});
test('Eliminare un telefono conserva i riferimenti di email, utenze e documenti dello stesso Account',async()=>{
 const profile={contactPhones:[],contactEmails:[{id:'e',linkedAccountId:'a'}],documenti:[{id:'d',linkedAccountId:'a'}],userAddresses:[{id:'address',utilities:[{id:'u',linkedAccountId:'a'}]}]};
 let patch;
 const ctrl=await loadController('privato/profilo-links.js',{...model,auth:{currentUser:{uid:'owner'}},db:{},doc:(db,...parts)=>parts.join('/'),deleteField:()=> 'DELETE',showToast:()=>{},runTransaction:async(db,cb)=>cb({get:async ref=>({exists:()=>true,data:()=>ref==='users/owner'?profile:{linkedProfileField:{type:'phone',id:'removed'}}}),update:(ref,data)=>{patch=data;}})},['refreshProfileAccountReferences']);
 await ctrl.refreshProfileAccountReferences('a');assert.deepEqual(patch.linkedProfileFields.map(x=>x.type),['email','document','utility']);assert.deepEqual(patch.linkedProfileField,{type:'email',id:'e'});
});

for (const sourceCompany of [false, true]) for (const company of [false, true]) test(`consultazione offline password collegata: profilo aziendale=${sourceCompany}, Account aziendale=${company}`, async () => {
    const calls = [];
    const fn = sourceCompany ? 'readLinkedPassword' : 'readLinkedEmailAccountPassword';
    const controller = await loadController(sourceCompany ? 'azienda/company-profile-ui.js' : 'privato/profilo-links.js', {
        globalThis: {navigator: {onLine: false}}, auth: {currentUser: {uid: 'owner'}}, ensureVaultKeyMaterial: async () => 'vault',
        getPrivateAccount: async (...args) => { calls.push(args); return {ownerId: 'owner', password: 'cached-cipher'}; },
        getCompanyAccount: async (...args) => { calls.push(args); return {ownerId: 'owner', password: 'cached-cipher'}; },
        getPrivateAccountConfirmed: async () => { throw new Error('SERVER_MUST_NOT_BE_USED'); },
        getCompanyAccountConfirmed: async () => { throw new Error('SERVER_MUST_NOT_BE_USED'); },
        decryptRequiredValue: async value => { assert.equal(value, 'cached-cipher'); return 'synthetic-secret'; }
    }, [fn]);
    assert.equal(await controller[fn]({linkedAccountId: 'account', ...(company ? {linkedAccountCompanyId: 'company'} : {})}), 'synthetic-secret');
    assert.deepEqual(calls, [company ? ['owner', 'company', 'account'] : ['owner', 'account']]);
});

for (const sourceCompany of [false, true]) test(`cache mancante o proprietario discordante non espongono password, profilo aziendale=${sourceCompany}`, async () => {
    let record = null, decrypted = 0;
    const fn = sourceCompany ? 'readLinkedPassword' : 'readLinkedEmailAccountPassword';
    const controller = await loadController(sourceCompany ? 'azienda/company-profile-ui.js' : 'privato/profilo-links.js', {
        globalThis: {navigator: {onLine: false}}, auth: {currentUser: {uid: 'owner'}}, ensureVaultKeyMaterial: async () => 'vault',
        getPrivateAccount: async () => record, getCompanyAccount: async () => record,
        decryptRequiredValue: async () => { decrypted++; return 'secret'; }
    }, [fn]);
    await assert.rejects(controller[fn]({linkedAccountId: 'account'}));
    record = {ownerId: 'other', password: 'cipher'}; await assert.rejects(controller[fn]({linkedAccountId: 'account'}));
    assert.equal(decrypted, 0);
});
