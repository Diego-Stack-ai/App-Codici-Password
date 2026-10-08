import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root = new URL('../Frontend/public/assets/js/modules/privato/', import.meta.url);
const strip = value => value.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const source = strip(await readFile(new URL('dettaglio_account_privato.js', root), 'utf8'))
    .replaceAll("import('../shared/account-note-editor.js')", "Promise.resolve({initAccountNoteEditor() {}})")
    .replace(/import\('\.\.\/shared\/account-shared-credentials\.js\?v=\d+\.\d+\.\d+'\)/, 'loadCredentials()')
    .replace(/import\('\.\.\/shared\/account-embedded-widgets\.js\?v=\d+\.\d+\.\d+'\)/, 'loadWidgets()');
const attachments = strip(await readFile(new URL('dettaglio-privato-attachments.js', root), 'utf8'));
const sharing = strip(await readFile(new URL('dettaglio-privato-sharing.js', root), 'utf8'));
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
function node(props = {}) {
    const classes = new Set();
    return {closest: () => null, children: [], value: '', textContent: '', type: 'password', isConnected: true,
        style: {setProperty() {}}, classList: {add: value => classes.add(value), remove: value => classes.delete(value),
            toggle(value, force) { if (force ?? !classes.has(value)) { classes.add(value); return true; } classes.delete(value); return false; }},
        appendChild(child) { this.children.push(child); }, prepend(child) { this.children.unshift(child); },
        remove() { this.isConnected = false; }, querySelectorAll: () => [], querySelector: () => null, ...props};
}

function detailFixture() {
    const events = new EventTarget(), observers = new Set(), calls = [], copies = [], navigations = [];
    const nodes = Object.fromEntries(['detail-nomeAccount', 'detail-username', 'detail-account', 'detail-password', 'detail-website',
        'detail-note', 'hero-title', 'header-nome-account', 'attachments-list', 'guests-list', 'banking-content', 'footer-center-actions',
        'btn-add-attachment', 'toggle-password', 'open-website', 'copy-note', 'banking-toggle', 'banking-chevron'].map(id => [id, node({id})]));
    const copy = node({closest: () => ({querySelector: () => nodes['detail-password']})});
    const span = node(); nodes['toggle-password'].querySelector = () => span;
    const container = node();
    const window = {location: {search: '?id=A', pathname: '/dettaglio_account_privato.html', href: ''}, history: {replaceState() {}}};
    const context = vm.createContext({window, URLSearchParams, AbortController, auth: {currentUser: {uid: 'owner'}},
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        document: {title: 'Dettaglio', body: {style: {}}, getElementById: id => nodes[id] || null,
            querySelector: selector => selector === '.base-container' ? container : null,
            querySelectorAll: selector => selector === '.read-only-banner' ? [] : selector === '.copy-btn' ? [copy] : [copy, ...['btn-add-attachment', 'toggle-password', 'open-website', 'copy-note', 'banking-toggle'].map(id => nodes[id])]},
        createElement: (tag, props = {}, children = []) => node({tag, ...props, children}),
        clearElement: element => { element.children = []; element.textContent = ''; },
        setChildren: (element, children) => { element.children = Array.isArray(children) ? children : [children]; },
        createSafeAccountIcon: () => node(), t: () => '', showToast: (...args) => calls.push(['toast', ...args]),
        LOG() {}, logError: (...args) => calls.push(['error', ...args]), console: {warn() {}},
        navigator: {onLine: true, clipboard: {writeText: async value => copies.push(value)}},
        openExternalUrl: value => { navigations.push(value); return true; }, db: {},
        doc: (_db, ...path) => path.join('/'), increment: value => value, updateDoc: async (...args) => calls.push(['write', ...args]),
        getPrivateAccount: async (_uid, id) => ({id, nomeAccount: id, username: `${id}-user`, password: `${id}-secret`, url: 'https://example.invalid'}),
        getPrivateAccountConfirmed: async (_uid, id) => ({id}), findPrivateAccountByLegacyId: async () => null,
        ensureVaultKeyMaterial: async () => 'key', decryptIfPossible: async value => value,
        initPrivateAttachmentModule: data => calls.push(['attachments', data]), loadPrivateAttachments: async () => calls.push(['attachment-load']),
        initPrivateSharingModule: data => calls.push(['sharing', data]), renderPrivateSharingMap() {},
        initDetailAccountMode: async data => { calls.push(['mode', data]); return new Map(); },
        renderAccountBanking: (_account, data) => calls.push(['banking', data]),
        openSourceSelector: () => calls.push(['picker-open']),
        loadCredentials: async () => ({initAccountSharedCredentials: data => calls.push(['credentials', data])}),
        loadWidgets: async () => ({initAccountEmbeddedWidgets: data => calls.push(['widgets', data])})
    });
    vm.runInContext(source, context);
    return {context, nodes, calls, copies, navigations, copy, window, observers,
        init: () => context.initDettaglioAccountPrivato({uid: context.auth.currentUser.uid}),
        edit: () => nodes['footer-center-actions'].children[0]?.children[0],
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
        pagehide: () => events.dispatchEvent(new Event('pagehide')),
        changeUid(uid) { context.auth.currentUser = {uid}; for (const callback of [...observers]) callback(context.auth.currentUser); }
    };
}

test('same UID private A to B rejects late reads and clears previous visible secrets immediately', async () => {
    const f = detailFixture(); await f.init(); const gate = deferred();
    f.context.getPrivateAccount = () => gate.promise;
    f.window.location.search = '?id=late'; const late = f.init();
    assert.equal(f.nodes['detail-password'].value, '');
    f.window.location.search = '?id=B'; f.context.getPrivateAccount = async () => ({id: 'B', password: 'B-secret'});
    await f.init(); gate.resolve({id: 'late', password: 'late-secret'}); await late; await tick();
    assert.equal(f.nodes['detail-password'].value, 'B-secret');
    assert.ok(f.calls.filter(([type]) => type === 'write').every(([, path]) => !path.includes('/late')));
});

test('private lock, pagehide and logout clear values and invalidate retained actions', async () => {
    for (const event of ['lock', 'pagehide', 'changeUid']) {
        const f = detailFixture(); await f.init();
        const edit = f.edit().onclick, copy = f.copy.onclick, web = f.nodes['open-website'].onclick;
        const banking = f.calls.find(([type]) => type === 'banking')[1];
        f[event]('other'); edit(); copy(); web(); banking.onAddBanking();
        assert.equal(f.nodes['detail-password'].value, ''); assert.equal(f.nodes['detail-username'].value, '');
        assert.equal(f.window.location.href, ''); assert.equal(f.copies.length, 0); assert.equal(f.navigations.length, 0);
        assert.equal(banking.isActive(), false); assert.equal(f.observers.size, 0);
    }
});

test('late private key, field or banking decryption cannot publish after same UID lock', async () => {
    for (const stage of ['key', 'field', 'banking']) {
        const f = detailFixture(), gate = deferred();
        f.context.getPrivateAccount = async () => ({id: 'A', _encrypted: true, username: 'cipher',
            banking: [{passwordDispositiva: 'bank-cipher', cards: [{cardNumber: 'number', pin: 'pin', ccv: 'ccv'}]}]});
        let cardDecrypts = 0;
        if (stage === 'key') f.context.ensureVaultKeyMaterial = () => gate.promise;
        else f.context.decryptIfPossible = async value => {
            if (value === (stage === 'field' ? 'cipher' : 'bank-cipher')) return gate.promise;
            if (['number', 'pin', 'ccv'].includes(value)) cardDecrypts++;
            return value;
        };
        const pending = f.init(); await tick(); f.lock(); gate.resolve('late plaintext'); await pending;
        assert.equal(f.nodes['detail-username'].value, ''); assert.equal(cardDecrypts, 0);
        assert.equal(f.calls.filter(([type]) => type === 'write').length, 0);
    }
});

test('private mode and widgets receive parent generation and late widget controller is destroyed', async () => {
    const f = detailFixture(), modeGate = deferred(); let firstMode;
    f.context.initDetailAccountMode = async options => { firstMode = options; await modeGate.promise; return new Map(); };
    const first = f.init(); await tick(); f.lock(); modeGate.resolve(); await first;
    assert.equal(firstMode.isActive(), false); assert.equal(firstMode.signal.aborted, true);
    assert.equal(f.calls.filter(([type]) => type === 'attachment-load').length, 0);
    f.context.initDetailAccountMode = async () => new Map();
    const widgetGate = deferred(); let destroyed = 0, widgetContext;
    f.context.loadWidgets = async () => ({initAccountEmbeddedWidgets: async options => { widgetContext = options; return widgetGate.promise; }});
    await f.init(); await tick(); f.window.location.search = '?id=B';
    f.context.loadWidgets = async () => ({initAccountEmbeddedWidgets() {}}); await f.init();
    widgetGate.resolve({destroy() { destroyed++; }}); await tick();
    assert.equal(widgetContext.accountId, 'A'); assert.equal(widgetContext.signal.aborted, true);
    assert.equal(widgetContext.active(), false); assert.equal(destroyed, 1);
});

test('private confirmation is single and its captured modal is cancelled on lock', async () => {
    const f = detailFixture(), gate = deferred(); let opens = 0, cancels = 0;
    const modal = node({querySelector: () => ({click() { cancels++; gate.resolve(false); }})});
    f.nodes['protocol-confirm-modal'] = modal;
    f.context.showConfirmModal = () => { opens++; return gate.promise; };
    await f.init();
    const {confirm} = f.calls.find(([type]) => type === 'mode')[1];
    const first = confirm('Synthetic', 'Synthetic');
    assert.equal(await confirm('Second', 'Second'), false); assert.equal(opens, 1);
    f.lock(); assert.equal(await first, false); assert.equal(cancels, 1); assert.equal(modal.isConnected, false);
});

function attachmentFixture() {
    const operations = [], nodes = {}, timers = new Map(); let timerId = 0;
    const parent = {replaceChild(fresh, old) { nodes[old.id] = fresh; fresh.parentNode = parent; }};
    const fileInput = id => node({id, files: [{name: 'Synthetic.txt', size: 1, type: 'text/plain'}], parentNode: parent,
        cloneNode() { return fileInput(id); }});
    for (const id of ['input-file', 'input-gallery', 'input-camera']) nodes[id] = fileInput(id);
    nodes['source-selector-modal'] = node(); nodes['btn-cancel-source'] = node(); nodes['attachments-list'] = node();
    const context = vm.createContext({document: {body: {style: {}}, getElementById: id => nodes[id] || null}, navigator: {onLine: true},
        setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id),
        showConfirmModal: async () => true, showToast() {}, showAlertModal: async () => {}, logError() {}, t: () => '',
        storage: {}, db: {}, ref: (_storage, path) => path, doc: (_db, ...path) => path.join('/'), collection: (_db, ...path) => path.join('/'),
        deleteObject: async path => operations.push(['storage-delete', path]), deleteDoc: async path => operations.push(['document-delete', path]),
        uploadBytes: async path => { operations.push(['upload', path]); return {ref: path}; },
        getDownloadURL: async () => 'https://example.invalid', addDoc: async (path, data) => operations.push(['add', path, data]),
        serverTimestamp: () => 'time', ensureVaultKeyMaterial: async () => 'key', validateAttachmentFile() {},
        createStorageObjectName: () => 'file', encryptAttachmentFile: async () => ({blob: {}, metadata: {version: 1}}),
        listPrivateAccountAttachments: async () => [],
        createElement: (tag, props = {}, children = []) => node({tag, ...props, children}), clearElement: element => { element.children = []; },
        setChildren: (element, children) => { element.children = children; },
        getBytes: async () => new Uint8Array([1]), decryptAttachmentBytes: async () => new Uint8Array([2]),
        openDecryptedAttachment: () => operations.push(['open']), openExternalUrl: () => true
    });
    vm.runInContext(attachments, context);
    return {context, operations, nodes, timers,
        init: (accountId = 'A', options = {}) => context.initPrivateAttachmentModule({ownerId: 'owner', accountId, readOnly: false, ...options})};
}
const attachment = {id: 'same-file', name: 'Synthetic', storagePath: 'users/owner/accounts/A/attachments/file'};

test('private attachment A confirmation cannot delete A bytes and B metadata after switching accounts', async () => {
    const f = attachmentFixture(), gate = deferred(); f.context.showConfirmModal = () => gate.promise; f.init();
    const pending = f.context.deleteAttachment(attachment); f.init('B'); gate.resolve(true); await pending;
    assert.equal(f.operations.length, 0);
});

test('already invoked Storage deletion cannot continue into metadata under the next account', async () => {
    const f = attachmentFixture(), gate = deferred(); f.init();
    f.context.deleteObject = async path => { f.operations.push(['storage-delete', path]); await gate.promise; };
    const pending = f.context.deleteAttachment(attachment); await tick(); f.init('B'); gate.resolve(); await pending;
    assert.deepEqual(f.operations, [['storage-delete', attachment.storagePath]]);
});

test('private upload stops after late encryption or upload and never writes metadata into another account', async () => {
    for (const stage of ['encrypt', 'upload']) {
        const f = attachmentFixture(), gate = deferred(); f.init();
        if (stage === 'encrypt') f.context.encryptAttachmentFile = () => gate.promise;
        else f.context.uploadBytes = async path => { f.operations.push(['upload', path]); return gate.promise; };
        const pending = f.context.handleFileUpload(f.nodes['input-file']); await tick(); f.init('B');
        gate.resolve(stage === 'encrypt' ? {blob: {}, metadata: {}} : {ref: 'old'}); await pending;
        assert.equal(f.operations.filter(([kind]) => kind === 'add').length, 0);
        assert.equal(f.operations.filter(([kind]) => kind === 'upload').length, stage === 'upload' ? 1 : 0);
    }
});

test('private file inputs and selector timers belong to their original account', async () => {
    const f = attachmentFixture(); f.init(); const oldInput = f.nodes['input-file'], oldChange = oldInput.onchange;
    f.context.openSourceSelector(); f.context.closeSourceSelector(); f.init('B');
    assert.notEqual(f.nodes['input-file'], oldInput); assert.equal(oldInput.onchange, null); assert.equal(oldInput.value, '');
    await oldChange(); assert.equal(f.operations.length, 0); assert.equal(f.timers.size, 0);
    await f.nodes['input-file'].onchange();
    const added = f.operations.find(([kind]) => kind === 'add');
    assert.equal(added[1], 'users/owner/accounts/B/attachments');
    assert.equal(added[2].storagePath, 'users/owner/accounts/B/attachments/file');
});

test('private late attachment list and decrypted bytes cannot render or open after teardown', async () => {
    for (const stage of ['list', 'decrypt']) {
        const f = attachmentFixture(), gate = deferred(); const mount = f.init();
        if (stage === 'list') f.context.listPrivateAccountAttachments = () => gate.promise;
        else f.context.decryptAttachmentBytes = () => gate.promise;
        const pending = stage === 'list' ? f.context.loadPrivateAttachments() : f.context.openAttachment({...attachment, encryption: {version: 1}});
        await tick(); mount.destroy(); gate.resolve(stage === 'list' ? [{...attachment, size: 1}] : new Uint8Array([1])); await pending;
        assert.equal(f.nodes['attachments-list'].children.length, 0); assert.equal(f.operations.length, 0);
    }
});

test('private sharing confirmation and transaction reads cannot revoke under a new account', async () => {
    for (const stage of ['confirm', 'read']) {
        const gate = deferred(), writes = [], reads = [];
        const realm = vm.createContext({auth: {currentUser: {uid: 'owner'}}, db: {}, t: () => '', showConfirmModal: stage === 'confirm' ? () => gate.promise : async () => true,
            doc: (_db, ...path) => path.join('/'), collection: (_db, ...path) => path.join('/'), sanitizeEmail: value => value, LOG() {}, showToast() {},
            runTransaction: async (_db, callback) => callback({get: async path => { reads.push(path); return gate.promise; }, update: (...args) => writes.push(args), delete: (...args) => writes.push(args), set: (...args) => writes.push(args)}), console});
        vm.runInContext(sharing, realm);
        realm.initPrivateSharingModule({currentUid: 'owner', ownerId: 'owner', accountId: 'A', readOnly: false});
        const pending = realm.revokeRecipient('synthetic@example.invalid'); await tick();
        realm.initPrivateSharingModule({currentUid: 'owner', ownerId: 'owner', accountId: 'B', readOnly: false});
        gate.resolve(stage === 'confirm' ? true : {exists: () => true, data: () => ({sharedWith: {}})}); await pending;
        assert.equal(writes.length, 0); assert.ok(reads.every(path => path === 'users/owner/accounts/A'));
        assert.equal(reads.length, stage === 'read' ? 1 : 0);
    }
});
