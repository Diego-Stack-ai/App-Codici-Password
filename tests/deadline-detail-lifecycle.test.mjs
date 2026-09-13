import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const root = new URL('../Frontend/public/assets/js/modules/scadenze/', import.meta.url);
const source = await readFile(new URL('dettaglio_scadenza.js', root), 'utf8');
const strip = value => value.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const model = strip(await readFile(new URL('deadline-model.js', root), 'utf8'));
const tick = () => new Promise(setImmediate);
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
class Element {
    constructor(tag = 'div', props = {}, children = []) {
        this.tag = tag; this.children = []; this.value = ''; this.textContent = ''; this.isConnected = true;
        Object.assign(this, props);
        const classes = new Set((props.className || '').split(' '));
        this.classList = {add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value)};
        children.filter(Boolean).forEach(child => this.appendChild(child));
    }
    appendChild(child) { this.children.push(child); child.parentNode = this; }
    remove() { this.isConnected = false; if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); }
    querySelectorAll(selector) {
        return this.children.flatMap(child => [...((selector.startsWith('#') ? child.id === selector.slice(1) : child.tag === selector) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    click() { return this.onclick?.(); }
}
function fixture({footerReady = true} = {}) {
    const events = new EventTarget(), document = new EventTarget(), observers = new Set(), calls = [], writes = [], batches = [], toasts = [], opened = [];
    const ids = ['detail-title', 'detail-intestatario', 'detail-category', 'detail-date-day', 'detail-date-year', 'display-veicolo',
        'detail-note-body', 'detail-email1', 'detail-email2', 'detail-preavviso', 'detail-frequenza', 'detail-template', 'detail-page-actions',
        'display-attachments', 'display-reference-url', 'section-vehicle', 'section-attachments', 'section-reference-url', 'section-emails', 'section-planning', 'section-template'];
    const nodes = Object.fromEntries(ids.map(id => [id, new Element('div', {id})]));
    const container = new Element(), label = new Element(), footer = {center: new Element(), right: new Element()};
    const window = {location: {search: '?id=A', href: ''}};
    Object.assign(document, {getElementById: id => nodes[id] || nodes['detail-page-actions'].querySelector(`#${id}`),
        querySelector: selector => selector === '.base-container' ? container : selector === '.detail-page-label' ? label : null,
        querySelectorAll: () => nodes['detail-page-actions'].querySelectorAll('button')});
    const context = vm.createContext({window, document, URLSearchParams, AbortController, auth: {currentUser: {uid: 'ownerA'}},
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        getFooterReady: () => footerReady ? footer : null,
        createElement: (tag, props = {}, children = []) => new Element(tag, props, children),
        clearElement: element => { element.textContent = ''; element.children = []; },
        setChildren: (element, children) => { element.children = []; (Array.isArray(children) ? children : [children]).forEach(child => element.appendChild(child)); },
        db: {}, storage: {}, functions: {}, enableAppCheck() {}, doc: (_db, ...path) => path.join('/'), ref: (_storage, path) => path,
        deleteDoc: async path => writes.push(['delete', path]), updateDoc: async (path, data) => writes.push(['update', path, data]), serverTimestamp: () => 'time',
        writeBatch: () => { const changes = []; return {delete: path => changes.push(['delete', path]), update: (path, value) => changes.push(['update', path, value]), commit: async () => batches.push(changes)}; },
        getDeadline: async (uid, id) => { calls.push(['read', uid, id]); return {title: id}; },
        getReceivedDeadline: async (uid, id) => { calls.push(['received', uid, id]); return {title: id, permission: 'manage', dueDate: '2027-03-04'}; },
        getDeadlineNotification: async () => null, getUserProfile: async () => ({documenti: []}),
        deadlineRecipientsFromRecord: record => record.recipients || [],
        respondConfirm: async () => true, cancelConfirm() {},
        showConfirmModal: (...args) => {
            calls.push(['confirm', ...args]);
            nodes['protocol-confirm-modal'] = new Element('div', {}, [new Element('button', {id: 'confirm-cancel-btn', onclick: () => context.cancelConfirm()})]);
            return context.respondConfirm();
        },
        respond: async () => ({data: {dueDate: '2027-05-06'}}),
        httpsCallable: () => async command => { calls.push(['rpc', command]); return context.respond(command); },
        ensureVaultKeyMaterial: async () => 'key', getBytes: async () => { calls.push(['bytes']); return new Uint8Array([1]); },
        decryptAttachmentBytes: async () => { calls.push(['decrypt']); return new Uint8Array([2]); },
        openDecryptedAttachment: () => opened.push('decrypted'), openExternalUrl: url => { opened.push(url); return true; },
        showToast: (...args) => toasts.push(args), console: {warn() {}}, t: () => ''
    });
    vm.runInContext(model, context); vm.runInContext(strip(source), context);
    return {context, nodes, window, footer, calls, writes, batches, toasts, opened, observers,
        init: () => context.initDettaglioScadenza({uid: context.auth.currentUser.uid}),
        deleteButton: () => footer.center.querySelectorAll('button')[0],
        editButton: () => footer.center.querySelectorAll('button')[1],
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
        pagehide: () => events.dispatchEvent(new Event('pagehide')),
        changeUid(uid) { context.auth.currentUser = {uid}; for (const callback of [...observers]) callback(context.auth.currentUser); },
        holdConfirmation() { const gate = deferred(); context.respondConfirm = () => gate.promise; context.cancelConfirm = () => gate.resolve(false); return gate; },
        footerReady() { const event = new Event('footer:ready'); Object.defineProperty(event, 'detail', {value: footer}); document.dispatchEvent(event); }
    };
}

test('late deadline A cannot replace same UID B or install old footer actions', async () => {
    const f = fixture(), gate = deferred(); f.context.getDeadline = async (_uid, id) => id === 'A' ? gate.promise : {title: 'B'};
    const first = f.init(); f.window.location.search = '?id=B'; await f.init(); gate.resolve({title: 'A'}); await first;
    assert.equal(f.nodes['detail-title'].textContent, 'B'); f.editButton().onclick();
    assert.equal(f.window.location.href, 'aggiungi_scadenza.html?id=B');
});

test('deadline delete confirmation is owned and cannot target a new user or deadline', async () => {
    const f = fixture(); await f.init(); const gate = f.holdConfirmation(), oldDelete = f.deleteButton().onclick;
    const pending = oldDelete(); const oldModal = f.nodes['protocol-confirm-modal'];
    assert.equal(f.calls.find(([type]) => type === 'confirm')[4], 'Annulla');
    f.changeUid('ownerB'); f.window.location.search = '?id=B'; await f.init(); gate.resolve(true); await pending; await oldDelete();
    assert.equal(f.writes.length, 0); assert.equal(f.window.location.href, ''); assert.equal(oldModal.isConnected, false);
});

test('late profile lookup cannot unlink the next deadline document, and normal delete preserves other links', async () => {
    const f = fixture(), gate = deferred(); f.context.getDeadline = async (_uid, id) => ({title: id, sourceRef: {type: 'profileDocument', id: `doc${id}`}});
    f.context.getUserProfile = () => gate.promise; await f.init(); const pending = f.deleteButton().onclick(); await tick();
    f.window.location.search = '?id=B'; await f.init();
    gate.resolve({documenti: [{id: 'docA', expiryReference: 'A'}, {id: 'docB', expiryReference: 'B'}]}); await pending;
    assert.equal(f.batches.length, 0);
    const healthy = fixture(); healthy.context.getDeadline = f.context.getDeadline;
    healthy.context.getUserProfile = async () => ({documenti: [{id: 'docA', expiryReference: 'A'}, {id: 'docB', expiryReference: 'B'}]});
    await healthy.init(); await healthy.deleteButton().onclick();
    const changes = healthy.batches[0]; assert.equal(changes[0][1], 'users/ownerA/scadenze/A');
    assert.equal(changes[1][2].documenti[0].expiryReference, null); assert.equal(changes[1][2].documenti[1].expiryReference, 'B');
});

test('deadline lock and pagehide clear optional data and invalidate retained URL/profile actions', async () => {
    for (const event of ['lock', 'pagehide']) {
        const f = fixture(); f.context.getDeadline = async () => ({title: 'A', notes: 'Synthetic note', referenceUrl: 'https://example.invalid',
            sourceRef: {type: 'profileDocument', id: 'docA'}, recipients: [{email: 'synthetic@example.invalid', sendEmail: true}], veicolo_modello: 'Synthetic vehicle'});
        await f.init(); const url = f.nodes['display-reference-url'].querySelector('button').onclick;
        const profile = f.nodes['detail-page-actions'].querySelector('button').onclick, edit = f.editButton().onclick;
        f[event](); url(); profile(); edit();
        assert.equal(f.nodes['detail-note-body'].textContent, ''); assert.equal(f.nodes['detail-email1'].textContent, '');
        assert.equal(f.nodes['section-vehicle'].classList.contains('hidden'), true);
        assert.equal(f.opened.length, 0); assert.equal(f.window.location.href, ''); assert.equal(f.observers.size, 0);
    }
});

test('deadline notification lookup keeps original owner/id and never marks after a remount', async () => {
    const f = fixture(), gate = deferred(); f.window.location.search = '?id=A&notification=noticeA';
    f.context.getDeadlineNotification = () => gate.promise;
    const first = f.init(); await tick(); f.window.location.search = '?id=B'; await f.init();
    gate.resolve({deadlineId: 'A', status: 'unread'}); await first;
    assert.equal(f.writes.length, 0);
    f.window.location.search = '?id=B&notification=noticeB'; f.context.getDeadlineNotification = async () => ({deadlineId: 'B', status: 'unread'});
    await f.init(); assert.equal(f.writes[0][1], 'users/ownerA/deadlineNotifications/noticeB');
});

test('late deadline footer listener is removed on teardown', async () => {
    const f = fixture({footerReady: false}); const mount = await f.init(); mount.destroy(); f.footerReady();
    assert.equal(f.footer.center.children.length, 0); assert.equal(f.footer.right.children.length, 0);
});

test('received manage deadline imports its date helper and sends captured expected owner', async () => {
    assert.match(source, /import\s*\{[^}]*deadlineDateInputFields[^}]*\}\s*from '\.\/deadline-model\.js'/);
    const f = fixture(); f.window.location.search = '?received=receivedA'; await f.init();
    assert.equal(f.footer.center.children.length, 0);
    const actions = f.nodes['detail-page-actions']; const input = actions.querySelector('input');
    assert.equal(input.value, '2027-03-04'); input.value = '2027-05-06';
    await actions.querySelectorAll('button').at(-1).onclick();
    const command = f.calls.find(([type]) => type === 'rpc')[1];
    assert.equal(command.expectedOwnerUid, 'ownerA'); assert.equal(command.receivedDeadlineId, 'receivedA');
    assert.equal(command.action, 'renew'); assert.equal(command.nextDueDate, '2027-05-06');
});

test('received read-only deadline has no management controls and stale manage controls cannot invoke RPC', async () => {
    const f = fixture(); f.window.location.search = '?received=manageA'; await f.init();
    const oldRenew = f.nodes['detail-page-actions'].querySelectorAll('button').at(-1).onclick;
    f.window.location.search = '?received=readB'; f.context.getReceivedDeadline = async () => ({title: 'readB', permission: 'read'}); await f.init();
    await oldRenew(); assert.equal(f.nodes['detail-page-actions'].querySelectorAll('button').length, 0);
    assert.equal(f.calls.filter(([type]) => type === 'rpc').length, 0);
});

test('received completion confirmation and late RPC cannot affect a new mount', async () => {
    for (const stage of ['confirm', 'rpc']) {
        const f = fixture(); f.window.location.search = '?received=A'; await f.init();
        const gate = stage === 'confirm' ? f.holdConfirmation() : deferred();
        if (stage === 'rpc') f.context.respond = () => gate.promise;
        const pending = f.nodes['detail-page-actions'].querySelectorAll('button')[0].onclick(); await tick();
        f.window.location.search = '?received=B'; await f.init(); gate.resolve(stage === 'confirm' ? true : {data: {dueDate: '2040-01-01'}}); await pending;
        assert.equal(f.nodes['detail-title'].textContent, 'B'); assert.equal(f.toasts.length, 0);
        assert.equal(f.calls.filter(([type]) => type === 'rpc').length, stage === 'rpc' ? 1 : 0);
    }
});

test('deadline attachment key, bytes and decrypt continuations stop on lock', async () => {
    for (const stage of ['key', 'bytes', 'decrypt']) {
        const f = fixture(), gate = deferred(); f.context.getDeadline = async () => ({title: 'A', attachments: [{name: 'Synthetic.txt', storagePath: 'users/ownerA/file', encryption: {version: 1}}]});
        if (stage === 'key') f.context.ensureVaultKeyMaterial = () => gate.promise;
        if (stage === 'bytes') f.context.getBytes = () => gate.promise;
        if (stage === 'decrypt') f.context.decryptAttachmentBytes = () => gate.promise;
        await f.init(); const pending = f.nodes['display-attachments'].querySelector('button').onclick(); await tick();
        f.lock(); gate.resolve(stage === 'key' ? 'old-key' : new Uint8Array([1])); await pending;
        assert.equal(f.opened.length, 0); assert.equal(f.nodes['display-attachments'].children.length, 0);
        if (stage === 'key') assert.equal(f.calls.filter(([type]) => type === 'bytes').length, 0);
    }
});

test('rendering a deadline with no optional values clears the previous sections', async () => {
    const f = fixture(); f.context.getDeadline = async (_uid, id) => id === 'A' ? {title: 'A', notes: 'Old note', veicolo_modello: 'Old vehicle',
        referenceUrl: 'https://example.invalid', templateText: 'Old template', attachments: [{name: 'Old.txt', url: 'https://example.invalid'}]} : {title: 'B'};
    await f.init(); f.window.location.search = '?id=B'; await f.init();
    for (const id of ['section-vehicle', 'section-reference-url', 'section-template', 'section-attachments']) assert.equal(f.nodes[id].classList.contains('hidden'), true);
    assert.equal(f.nodes['detail-note-body'].textContent, ''); assert.equal(f.nodes['display-attachments'].children.length, 0);
});

test('failed deadline reads or rendering clear partial data and never enable footer mutations', async () => {
    for (const stage of ['read', 'render']) {
        const f = fixture();
        f.context.getDeadline = async () => {
            if (stage === 'read') throw new Error('private provider detail');
            return {title: 'Partial synthetic data', notes: 'Partial note', templateText: 123,
                referenceUrl: 'https://example.invalid', sourceRef: {type: 'profileDocument', id: 'docA'}};
        };
        await f.init();
        assert.equal(f.nodes['detail-title'].textContent, ''); assert.equal(f.nodes['detail-note-body'].textContent, '');
        assert.equal(f.nodes['detail-page-actions'].children.length, 0); assert.equal(f.nodes['display-reference-url'].children.length, 0);
        assert.equal(f.footer.center.querySelectorAll('button').length, 0); assert.equal(f.writes.length, 0);
        assert.equal(f.toasts.length, 1); assert.doesNotMatch(f.toasts[0][0], /provider detail/);
    }
});
