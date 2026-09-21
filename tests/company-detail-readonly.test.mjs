import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/azienda/dettaglio_account_azienda.js', import.meta.url), 'utf8');
// M7-R7C-5: la pagina usa gli helper di ciclo/invito di `utils.js` e il messaggio
// di errore condiviso; il banco li inietta perché gli import vengono rimossi.
const utilsSource = await readFile(new URL('../Frontend/public/assets/js/utils.js', import.meta.url), 'utf8');
const {inviteIdForGuest, sanitizeEmail, sharingCycleOf} = await import('data:text/javascript;base64,' + Buffer.from(utilsSource).toString('base64'));
const messageSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/read-error-message.js', import.meta.url), 'utf8');
const {readErrorMessage} = await import('data:text/javascript;base64,' + Buffer.from(messageSource).toString('base64'));
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return {promise, resolve}; };
function fixture({suspended = false, denied = false, networkError = false} = {}) {
    const writes = [], reads = [], errors = [], modules = [], classes = new Set(), suspendedReads = [];
    const footer = {children: [], classList: {
        add: value => classes.add(value),
        toggle(value, enabled) { if (enabled) classes.add(value); else classes.delete(value); }
    }};
    const find = (nodes, id) => {
        for (const node of Array.isArray(nodes) ? nodes : [nodes]) {
            if (node?.props?.id === id) return node;
            const nested = node?.children && find(node.children, id);
            if (nested) return nested;
        }
    };
    let read = async () => ({nomeAccount: 'Synthetic company account'});
    const window = {location: {search: '?id=account&aziendaId=company', pathname: '/dettaglio_account_azienda.html', href: ''}, history: {replaceState() {}}};
    const context = vm.createContext({URLSearchParams, AbortController, auth:{currentUser:null}, onAuthStateChanged:()=>()=>{}, window, navigator: {onLine: true}, console,
        readErrorMessage, inviteIdForGuest, sanitizeEmail, sharingCycleOf,
        document: {getElementById: id => id === 'footer-center-actions' ? footer : find(footer.children, id),
            querySelector: () => null, querySelectorAll: () => []},
        db: {}, doc: (_db, ...path) => path.join('/'), increment: value => ({increment: value}),
        updateDoc: async (path, change) => writes.push({path, change}),
        getCompanyAccount: async (...args) => { reads.push(args); return read(); },
        getCompanyAccountConfirmed: async (...args) => {
            reads.push(args);
            if (networkError) throw new Error('NETWORK_ERROR');
            return denied ? null : read();
        },
        // M7-R7C-4: per un ospite la sospensione nota viene verificata prima della lettura.
        findSuspendedGuestInvite: async (ownerId, accountId, email, companyId) => {
            suspendedReads.push([ownerId, accountId, email, companyId]);
            return suspended ? {accountId, ownerId, aziendaId: companyId, sharingState: 'suspended'} : null;
        },
        createElement: (tag, props, children) => ({tag, props, children}),
        setChildren: (node, children) => { node.children = children; },
        clearElement: node => { node.children = []; }, createSafeAccountIcon: () => ({}),
        showToast() {}, t: value => value, logError: (...args) => errors.push(args),
        initAttachmentModule: options => modules.push(['attachments', options]),
        initSharingModule: options => modules.push(['sharing', options]),
        initDetailAccountMode: async options => { modules.push(['mode', options]); return {}; },
        renderSharingMap() {}, loadAttachments: async () => {}, renderAccountBanking() {},
        loadModule: async () => ({initAccountNoteEditor() {}, initAccountSharedCredentials() {}, initAccountEmbeddedWidgets() {}}),
        setTimeout() {}, history: {back() {}}
    });
    vm.runInContext(source.replace(/^import[\s\S]*?;\s*$/gm, '').replace('export async function', 'async function').replace(/\bimport\(/g, 'loadModule('), context);
    return {writes, reads, errors, modules, footer, classes, window, suspendedReads,
        button: () => find(footer.children, 'btn-edit-footer'),
        read: value => { read = value; }, init: uid => {context.auth.currentUser={uid};return context.initDettaglioAccountAzienda({uid})}};
}

test('guest never gets an edit footer, including while fetch is pending, and submits no view write', async () => {
    const f = fixture(), pending = deferred();
    f.window.location.search += '&ownerId=owner'; f.read(() => pending.promise);
    const opening = f.init('guest');
    assert.equal(f.button(), undefined); assert.ok(f.classes.has('hidden')); assert.equal(f.writes.length, 0);
    pending.resolve({nomeAccount: 'Shared synthetic account'}); await opening;
    assert.equal(f.writes.length, 0); assert.equal(f.button(), undefined); assert.equal(f.errors.length, 0);
    assert.deepEqual(f.reads[0], ['owner', 'company', 'account']);
    for (const [name, options] of f.modules) assert.equal(name === 'attachments' ? options.readOnly : options.isReadOnly ?? options.readOnly, true);
});

// M7-R7C-4 correzione: con Account già in cache e invito sospeso il dettaglio non
// deve leggere né renderizzare nulla, perché la sospensione è già nota.
test('guest deep link to a suspended company account renders nothing even with a cached record', async () => {
    const f = fixture({suspended: true});
    f.window.location.search += '&ownerId=owner';
    f.read(async () => ({nomeAccount: 'Shared synthetic account', username: 'cached-user'}));
    await f.init('guest');
    assert.deepEqual(f.suspendedReads, [['owner', 'account', undefined, 'company']]);
    assert.equal(f.reads.length, 0, 'nessuna lettura dell\'Account');
    assert.equal(f.modules.length, 0, 'nessun modulo di contenuto inizializzato');
    assert.equal(f.button(), undefined);
    assert.equal(f.writes.length, 0);
});

// M7-R7C-4: online l'ospite viene autorizzato solo da una lettura confermata dal
// server; un diniego o un errore di rete non ammettono fallback sulla cache.
test('guest deep link to a revoked company account does not render from the cache', async () => {
    const f = fixture({denied: true});
    f.window.location.search += '&ownerId=owner';
    f.read(async () => ({nomeAccount: 'Cached synthetic account', username: 'cached-user'}));
    await f.init('guest');
    assert.equal(f.reads.length, 1, 'solo il tentativo confermato, nessun fallback locale');
    assert.equal(f.modules.length, 0, 'nessun contenuto inizializzato');
    assert.equal(f.button(), undefined);
    assert.equal(f.writes.length, 0);
    assert.equal(f.errors.length, 0);
});

test('guest online with a network error renders nothing and reports the unverified state', async () => {
    const f = fixture({networkError: true});
    f.window.location.search += '&ownerId=owner';
    f.read(async () => ({nomeAccount: 'Cached synthetic account'}));
    await f.init('guest');
    assert.equal(f.reads.length, 1);
    assert.equal(f.modules.length, 0);
    assert.equal(f.writes.length, 0);
});

test('owner retains exactly one views increment and a working edit footer', async () => {
    const f = fixture(); await f.init('owner');
    assert.equal(f.errors.length, 0); assert.equal(f.classes.has('hidden'), false);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0].path, 'users/owner/aziende/company/accounts/account');
    assert.equal(f.writes[0].change.views.increment, 1);
    f.button().props.onclick();
    assert.equal(f.window.location.href, 'form_account_azienda.html?id=account&aziendaId=company');
});

test('guest reinitialization removes owner footer and invalidates its retained edit callback', async () => {
    const f = fixture(); await f.init('owner'); const previous = f.button();
    f.window.location.search += '&ownerId=owner'; await f.init('guest');
    previous.props.onclick();
    assert.equal(f.window.location.href, ''); assert.equal(f.button(), undefined); assert.equal(f.writes.length, 1);
    f.window.location.search = '?id=account&aziendaId=company'; await f.init('owner');
    assert.ok(f.button()); assert.equal(f.classes.has('hidden'), false); assert.equal(f.writes.length, 2);
});

test('a late guest fetch cannot acquire write permission from a later owner initialization', async () => {
    const f = fixture(), pending = deferred();
    f.window.location.search += '&ownerId=owner'; f.read(() => pending.promise);
    const opening = f.init('guest');
    f.read(async () => ({nomeAccount: 'Owner account'})); await f.init('owner');
    assert.equal(f.writes.length, 1);
    pending.resolve({nomeAccount: 'Late guest record'}); await opening;
    assert.equal(f.writes.length, 1); assert.equal(f.errors.length, 0);
});

test('a late owner fetch cannot write after switching to another authenticated owner', async () => {
    const f = fixture(), pending = deferred(); f.read(() => pending.promise);
    const opening = f.init('first');
    f.read(async () => ({nomeAccount: 'Second account'})); await f.init('second');
    pending.resolve({nomeAccount: 'Late first record'}); await opening;
    assert.equal(f.writes.length, 1); assert.equal(f.writes[0].path, 'users/second/aziende/company/accounts/account');
});
