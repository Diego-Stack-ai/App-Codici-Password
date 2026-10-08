import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const guardSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/credential-decrypt-guard.js', import.meta.url), 'utf8');
const {DECRYPT_FAILURE_MESSAGE, accountSaveBlockedReason, createAccountLoadContext, isAccountSaveAllowed} = await import(`data:text/javascript;base64,${Buffer.from(guardSource).toString('base64')}`);

const cryptoSource = await readFile(new URL('../Frontend/public/assets/js/modules/core/crypto-utils.js', import.meta.url), 'utf8');
const {createVaultKeyring, decrypt: realDecrypt, decryptRequiredValue: realStrict, encrypt: realEncrypt, generateVaultKey} =
    await import(`data:text/javascript;base64,${Buffer.from(cryptoSource).toString('base64')}`);
const deferred = () => { let resolve, reject; const promise = new Promise((res, rej) => { resolve = res; reject = rej; }); return {promise, resolve, reject}; };
const node = () => ({value: '', checked: false, src: '', dataset: {},
    classList: {add() {}, remove() {}, toggle() {}, contains: () => false},
    closest: () => ({classList: {add() {}, remove() {}}}), setAttribute() {}, addEventListener() {}, querySelectorAll: () => []});
const goodData = {_encrypted: true, username: 'CIPH-U', account: 'CIPH-A', password: 'CIPH-P', note: 'CIPH-N',
    numeroIscrizione: 'CIPH-I', codiceSocieta: 'CIPH-S', nomeAccount: 'Fixture', revision: 1};
const decryptGate = ({expected, value = 'plain'}) => {
    let release, signalEntered, entered = 0;
    const open = new Promise(resolve => { release = resolve; });
    const enteredAll = new Promise(resolve => { signalEntered = resolve; });
    return {decrypt: () => { entered += 1; if (entered === expected) signalEntered(); return open.then(() => value); },
        enteredAll, release: () => release(), count: () => entered};
};

async function fixture(domain, {decrypt, keyMaterial = 'key', strictDecrypt} = {}) {
    const path = domain === 'privato'
        ? '../Frontend/public/assets/js/modules/privato/form_account_privato.js'
        : '../Frontend/public/assets/js/modules/azienda/form_account_azienda.js';
    const source = await readFile(new URL(path, import.meta.url), 'utf8');
    const start = source.indexOf('async function loadData() {');
    const end = source.indexOf('async function loadRubrica()');
    assert.ok(start >= 0 && end > start, 'loadData non individuata');
    const body = source.slice(start, end);
    assert.match(body, /context\.markLoaded\(loadToken\)/, 'la coda della loadData deve essere inclusa');
    const fetches = [], messages = [], nodes = new Map();
    const getNode = id => { if (!nodes.has(id)) nodes.set(id, node()); return nodes.get(id); };
    // Solo i valori CIPH-* sono ciphertext nello stub; i casi reali usano il modulo crypto.
    const strictAdapter = strictDecrypt ?? (async (value, key) => {
        const decoded = await decrypt(value, key);
        if (decoded === '--ERRORE--' || (value?.startsWith('CIPH-') && decoded === value)) throw new Error('DECRYPT_FAILED');
        return decoded;
    });
    const context = createAccountLoadContext({mode: 'edit'});
    const sandbox = {
        loadContext: context, DECRYPT_FAILURE_MESSAGE,
        navigator: {onLine: true}, document: {getElementById: getNode, querySelector: () => null, querySelectorAll: () => []},
        showToast: message => messages.push(message), t: key => key, logError: () => {}, history: {back() {}},
        currentUid: 'owner', currentDocId: 'record', currentAziendaId: 'azienda',
        currentRevision: 0, hasLinkedProfileField: false, profileContactLinkDraft: null,
        ensureVaultKeyMaterial: async () => keyMaterial, decrypt, decryptRequiredValue: strictAdapter, decodeProfileContactValue: strictAdapter,
        normalizeEditableBankingAccounts: () => [], hasRealBankingData: () => false, bankAccounts: [], savedBankIds: new Set(),
        rerender: async () => {}, renderGuestsList: () => {}, invitedEmails: [], isExplicitMemo: false,
        accountModeFromRecord: () => 'account-private', mountEpoch: 1, markerConfirmed: false, toggleLoading: () => {},
        observedRevision: undefined, observedSharing: null, baseUpdatedAt: '',
        getPrivateAccount: () => { const d = deferred(); fetches.push(d); return d.promise; },
        getPrivateAccountConfirmed: () => { const d = deferred(); fetches.push(d); return d.promise; },
        getCompanyAccount: () => { const d = deferred(); fetches.push(d); return d.promise; }
    };
    vm.createContext(sandbox);
    vm.runInContext(body, sandbox);
    return {sandbox, context, fetches, messages, nodes, getNode, run: () => vm.runInContext('loadData()', sandbox)};
}

test('privato: decrypt fallito arriva alla coda della loadData e NON riapre il salvataggio', async () => {
    const f = await fixture('privato', {decrypt: async value => { if (value === 'CIPH-A') throw new Error('DECRYPT_FAILED'); return 'plain-' + value; }});
    const pending = f.run();
    f.fetches[0].resolve(goodData);
    await pending;
    assert.equal(f.getNode('account-name').value, 'Fixture');
    assert.equal(f.context.isFailed(), true);
    assert.equal(f.context.isReady(), false);
    assert.equal(isAccountSaveAllowed(f.context), false);
    assert.equal(accountSaveBlockedReason(f.context), 'ACCOUNT_DECRYPT_FAILED');
    assert.equal(f.getNode('account-code').value, '');
    assert.equal(f.messages.includes(DECRYPT_FAILURE_MESSAGE), true);
});

test('azienda: decrypt fallito resta chiuso, caricamento integro diventa pronto', async () => {
    const ko = await fixture('azienda', {decrypt: async () => { throw new Error('DECRYPT_FAILED'); }});
    const koPending = ko.run();
    ko.fetches[0].resolve(goodData);
    await koPending;
    assert.equal(ko.context.isFailed(), true);
    assert.equal(isAccountSaveAllowed(ko.context), false);
    assert.equal(ko.getNode('account-name').value, 'Fixture');
    const ok = await fixture('azienda', {decrypt: async value => 'plain-' + value});
    const okPending = ok.run();
    ok.fetches[0].resolve(goodData);
    await okPending;
    assert.equal(ok.context.isReady(), true);
    assert.equal(isAccountSaveAllowed(ok.context), true);
    assert.deepEqual(ok.messages, []);
});

test('due contesti con token 1: il completamento vecchio non tocca il nuovo ne il DOM', async () => {
    const f = await fixture('privato', {decrypt: async value => 'plain-' + value});
    const pending = f.run();
    const contextB = createAccountLoadContext({mode: 'edit'});
    const tokenB = contextB.beginLoad();
    assert.equal(f.context.generation, tokenB);
    f.context.invalidate();
    f.sandbox.loadContext = contextB;
    f.fetches[0].resolve(goodData);
    await pending;
    assert.equal(contextB.isReady(), false);
    assert.equal(contextB.isFailed(), false);
    assert.equal(accountSaveBlockedReason(contextB), 'ACCOUNT_LOAD_PENDING');
    assert.equal(f.getNode('account-name').value, '');
    assert.equal(f.getNode('account-username').value, '');
});

test('ordine inverso: il caricamento piu vecchio risolto dopo non altera lo stato', async () => {
    const f = await fixture('privato', {decrypt: async value => 'plain-' + value});
    const older = f.run();
    const newer = f.run();
    f.fetches[1].resolve(goodData);
    await newer;
    assert.equal(f.context.isReady(), true);
    f.fetches[0].resolve(goodData);
    await older;
    assert.equal(f.context.isReady(), true);
    assert.equal(f.context.isFailed(), false);
    assert.equal(isAccountSaveAllowed(f.context), true);
});

// Prove sintetiche con il modulo crypto reale, senza servizi o dati dell'utente.
const realFields = {'account-username': ['username', 'utente-sintetico'], 'account-code': ['account', 'codice-sintetico'],
    'account-password': ['password', 'password-sintetica'], 'account-note': ['note', 'nota-sintetica'],
    'account-numero-iscrizione': ['numeroIscrizione', 'iscrizione-sintetica'], 'account-codice-societa': ['codiceSocieta', 'societa-sintetica']};
for (const domain of ['privato', 'azienda']) {
    test(`${domain}: sentinella restituita blocca senza popolare i campi`, async () => {
        const f = await fixture(domain, {decrypt: async () => '--ERRORE--'});
        const pending = f.run(); f.fetches[0].resolve(goodData); await pending;
        assert.equal(accountSaveBlockedReason(f.context), 'ACCOUNT_DECRYPT_FAILED');
        assert.equal(isAccountSaveAllowed(f.context), false);
        assert.equal(f.getNode('account-code').value, '');
        assert.equal([...f.nodes.values()].some(n => n.value === '--ERRORE--'), false);
        assert.ok(f.messages.includes(DECRYPT_FAILURE_MESSAGE));
    });
    for (const scenario of ['valido', 'chiave errata', 'alterato']) {
        test(`${domain}: crypto reale ${scenario}, sorgente preservata`, async () => {
            const keyMaterial = createVaultKeyring(generateVaultKey());
            const data = {_encrypted: true, nomeAccount: 'Fixture', revision: 1, updatedAt: ''};
            for (const [field, plain] of Object.values(realFields)) data[field] = await realEncrypt(plain, keyMaterial);
            if (scenario === 'alterato') data.account = data.account.slice(0, 30) + (data.account[30] === 'A' ? 'B' : 'A') + data.account.slice(31);
            const original = {...data};
            const f = await fixture(domain, {keyMaterial: scenario === 'chiave errata' ? createVaultKeyring(generateVaultKey()) : keyMaterial,
                decrypt: realDecrypt, strictDecrypt: realStrict});
            const pending = f.run(); f.fetches[0].resolve(data); await pending;
            assert.equal(f.context.isReady(), scenario === 'valido');
            assert.equal(isAccountSaveAllowed(f.context), scenario === 'valido');
            if (scenario !== 'valido') assert.equal(accountSaveBlockedReason(f.context), 'ACCOUNT_DECRYPT_FAILED');
            for (const [id, [, plain]] of Object.entries(realFields)) {
                if (domain === 'privato' && ['account-numero-iscrizione', 'account-codice-societa'].includes(id)) continue;
                assert.equal(f.getNode(id).value, scenario === 'chiave errata' || (scenario === 'alterato' && id === 'account-code') ? '' : plain);
            }
            assert.equal([...f.nodes.values()].some(n => n.value === '--ERRORE--'), false);
            assert.deepEqual(data, original);
        });
    }
    for (const encrypted of [false, true]) {
        test(`${domain}: plaintext e vuoti preservati, _encrypted=${encrypted}`, async () => {
            const keyMaterial = createVaultKeyring(generateVaultKey());
            const data = {_encrypted: encrypted, nomeAccount: 'Fixture', revision: 1,
                username: encrypted ? await realEncrypt('utente-sintetico', keyMaterial) : 'utente-sintetico',
                account: 'codice-in-chiaro-non-cifrato', password: '', note: 'nota-in-chiaro'};
            const f = await fixture(domain, {keyMaterial, decrypt: realDecrypt, strictDecrypt: realStrict});
            const pending = f.run(); f.fetches[0].resolve(data); await pending;
            assert.equal(isAccountSaveAllowed(f.context), true);
            assert.equal(f.getNode('account-username').value, 'utente-sintetico');
            assert.equal(f.getNode('account-code').value, data.account);
            assert.equal(f.getNode('account-password').value, '');
            assert.equal(f.getNode('account-note').value, data.note);
            assert.deepEqual(f.messages, []);
        });
    }
}

for (const [domain, expected] of [['privato', 4], ['azienda', 6]]) {
    test(`lock durante il decrypt (${domain}): zero aggiornamenti DOM`, async () => {
        const gate = decryptGate({expected});
        const f = await fixture(domain, {decrypt: gate.decrypt});
        const pending = f.run();
        assert.equal(f.fetches.length, 1);
        f.fetches[0].resolve(goodData);
        await gate.enteredAll;
        assert.equal(gate.count(), expected);
        f.context.invalidate();
        gate.release();
        await pending;
        assert.equal(accountSaveBlockedReason(f.context), 'ACCOUNT_LOAD_INVALIDATED');
        assert.equal(isAccountSaveAllowed(f.context), false);
        assert.equal(f.getNode('account-name').value, '');
        assert.equal(f.getNode('account-username').value, '');
        assert.equal(f.getNode('account-code').value, '');
        assert.equal(f.getNode('account-note').value, '');
        assert.equal(f.getNode('flag-banking').checked, false);
        assert.deepEqual(f.messages.filter(message => message === DECRYPT_FAILURE_MESSAGE), []);
    });
}
