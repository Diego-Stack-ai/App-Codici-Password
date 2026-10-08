import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const base = new URL('../Frontend/public/assets/js/modules/settings/', import.meta.url);
const strip = text => text.replace(/^export \{[^}]*\} from ['"][^'"]*['"];\r?\n/gm, '')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const service = strip(await readFile(new URL('archive-account-service.js', base), 'utf8'));
const archiveModel = strip(await readFile(new URL('archive-account-model.js', base), 'utf8'));
const ui = strip(await readFile(new URL('archivio_account.js', base), 'utf8'));
// M7-R7C-1: il servizio usa gli helper di ciclo/invito da `utils.js`; il banco li
// inietta nel contesto perché gli `import` vengono rimossi dai sorgenti.
const utilsSource = await readFile(new URL('../../utils.js', base), 'utf8');
const {inviteIdForGuest, nextSharingCycle, sharingCycleOf} = await import('data:text/javascript;base64,' + Buffer.from(utilsSource).toString('base64'));
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
const tick = () => new Promise(setImmediate);
const account = (id = 'same', context = 'privato') => ({id, context, revision: 1, nomeAccount: 'Synthetic', isArchived: true});

class Element extends EventTarget {
    constructor(tag, props = {}, children = []) {
        super(); this.tag = tag; this.children = []; this.dataset = {}; this.value = ''; this.textContent = ''; this.isConnected = true;
        Object.assign(this, props);
        const classes = new Set((props.className || '').split(' '));
        this.classList = {add: (...values) => values.forEach(value => classes.add(value)), remove: value => classes.delete(value),
            contains: value => classes.has(value), toggle: value => classes.has(value) ? classes.delete(value) : classes.add(value)};
        children.filter(Boolean).forEach(child => this.appendChild(child));
    }
    appendChild(child) { child.parentNode = this; child.isConnected = true; this.children.push(child); return child; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this); this.isConnected = false; }
    focus() {}
    setAttribute(name, value) { this[name] = value; }
    removeAttribute(name) { delete this[name]; }
    querySelectorAll(selector) {
        const matches = element => selector.startsWith('.') ? element.classList.contains(selector.slice(1)) : element.tag === selector;
        return this.children.flatMap(child => [...(matches(child) ? [child] : []), ...child.querySelectorAll(selector)]);
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture(withUi = false) {
    const events = new EventTarget(), observers = new Set(), calls = [], writes = [], swipes = [], toasts = [], timers = new Map();
    const auth = {currentUser: {uid: 'A'}};
    const nodes = Object.fromEntries(['accounts-container', 'archive-filter-btn', 'archive-context-menu', 'active-context-label', 'btn-empty-trash']
        .map(id => [id, new Element('div', {id})]));
    const search = new Element('input'), body = new Element('body'), document = new EventTarget();
    Object.assign(document, {body, activeElement: search, getElementById: id => nodes[id], querySelector: () => search});
    let operationCount = 0, stored = {isArchived: true, revision: 1};
    // M7-R7C-1: la transazione legge anche gli inviti identificabili del ciclo.
    const invites = new Map();
    let transactionRuns = 0;
    const context = vm.createContext({
        auth, db: {}, functions: {}, AbortController, crypto: {randomUUID: () => `operation-${++operationCount}`}, console: {warn() {}},
        inviteIdForGuest, nextSharingCycle, sharingCycleOf,
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        doc: (_db, ...path) => path.join('/'), deleteField: () => ({delete: true}),
        updateDoc: async (...args) => writes.push(args),
        runTransaction: async (_db, callback) => {
            transactionRuns++;
            const staged = [];
            await callback({get: async reference => {
                    const path = typeof reference === 'string' ? reference : reference.path;
                    const record = path.startsWith('invites/') ? (invites.has(path) ? invites.get(path) : null) : stored;
                    return {exists: () => record !== null && record !== undefined, data: () => record};
                },
                update: (...args) => staged.push(args),
                // M7-R7C-1: la sospensione non cancella mai inviti o dati.
                delete: () => { throw new Error('M7R7C1_NO_DELETE'); }});
            writes.push(...staged);
        },
        respond: async () => ({data: {status: 'purged'}}),
        httpsCallable: () => async command => { calls.push(command); return context.respond(command); },
        listArchivedPrivateAccounts: async () => [account()], listCompanies: async () => [],
        listCompanyAccounts: async () => [], getCompany: async () => ({ragioneSociale: 'Synthetic'}),
        ensureVaultKeyMaterial: async () => 'key', decrypt: async () => 'Synthetic username',
        document, navigator: {clipboard: {writeText: async () => {}}},
        createElement: (tag, props, children) => new Element(tag, props, children),
        clearElement: node => { node.children = []; node.textContent = ''; },
        setChildren: (node, children) => { node.children = []; children.forEach(child => node.appendChild(child)); },
        createUiState: props => new Element('div', props), t: () => '', showToast: (...args) => toasts.push(args),
        SwipeList: class { constructor(selector, options) { this.options = options; swipes.push(this); } destroy() { this.destroyed = true; } },
        setTimeout: callback => { const id = timers.size + 1; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id)
    });
    vm.runInContext(archiveModel, context);
    vm.runInContext(service, context);
    if (withUi) vm.runInContext(ui, context);
    return {context, calls, writes, nodes, search, body, swipes, toasts, observers, timers, invites,
        get transactionRuns() { return transactionRuns; },
        set stored(value) { stored = value; },
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
        pagehide: () => events.dispatchEvent(new Event('pagehide')),
        changeUid: uid => { auth.currentUser = uid ? {uid} : null; for (const callback of [...observers]) callback(auth.currentUser); },
        init: () => context.initArchivioAccount({uid: auth.currentUser.uid}),
        confirm(value = 'SI') { const overlay = body.children.at(-1); overlay.querySelector('input').value = value; overlay.querySelectorAll('button')[1].onclick(); }
    };
}

test('archive search preserves loading and failed states instead of showing an empty archive', async () => {
    const f = fixture(true), gate = deferred();
    f.context.listArchivedPrivateAccounts = async () => { await gate.promise; throw new Error('SYNTHETIC_FAILURE'); };
    const pending = f.init();
    await tick();
    assert.equal(f.nodes['accounts-container'].children[0].kind, 'loading');
    f.search.value = 'synthetic'; f.search.oninput();
    assert.equal(f.nodes['accounts-container'].children[0].kind, 'loading');
    gate.resolve(); await pending;
    assert.equal(f.nodes['accounts-container'].children[0].kind, 'error');
    f.search.oninput();
    assert.equal(f.nodes['accounts-container'].children[0].kind, 'error');
    assert.equal(f.writes.length, 0);
    assert.equal(f.calls.length, 0);
});

test('archive late failed mount cannot replace a newer successful list or show a toast', async () => {
    const f = fixture(true), gate = deferred();
    f.context.listArchivedPrivateAccounts = async () => { await gate.promise; throw new Error('OLD_FAILURE'); };
    const oldMount = f.init(); await tick();
    f.context.listArchivedPrivateAccounts = async () => [];
    await f.init();
    assert.equal(f.nodes['accounts-container'].children[0].kind, 'empty');
    gate.resolve(); await oldMount;
    assert.equal(f.nodes['accounts-container'].children[0].kind, 'empty');
    assert.equal(f.toasts.length, 0);
});

test('archive failed read after lock does not become a visible source error', async () => {
    const f = fixture(true), gate = deferred();
    f.context.listArchivedPrivateAccounts = async () => { await gate.promise; throw new Error('AbortError'); };
    const pending = f.init(); await tick(); f.lock(); gate.resolve(); await pending;
    assert.equal(f.nodes['accounts-container'].children.length, 0);
    assert.equal(f.toasts.length, 0);
});

test('purge binds captured owner and target while SDK token lookup can cross a microtask', async () => {
    const f = fixture(), target = account('original');
    const pending = f.context.deleteArchivedAccount('A', target);
    target.id = 'changed'; f.changeUid('B');
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].expectedOwnerUid, 'A');
    assert.equal(f.calls[0].accountId, 'original');
    await assert.rejects(f.context.deleteArchivedAccount('A', target), /ARCHIVE_SESSION_INVALIDATED/);
    assert.equal(f.calls.length, 1);
});

test('empty archive stops after an already submitted request when Vault locks or identity changes', async () => {
    for (const event of ['lock', 'changeUid']) {
        const f = fixture(), gate = deferred(); f.context.respond = () => gate.promise;
        const pending = f.context.emptyArchivedAccounts('A', [account('one'), account('two')]);
        f[event]('B'); gate.resolve({data: {status: 'purged'}});
        await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
        assert.equal(f.calls.length, 1); assert.equal(f.observers.size, 0);
    }
});

test('late key and decryption cannot return archive plaintext after invalidation', async () => {
    for (const stage of ['key', 'decrypt']) {
        const f = fixture(), gate = deferred();
        f.context.listArchivedPrivateAccounts = async () => [{...account(), _encrypted: true, username: 'cipher'}];
        if (stage === 'key') f.context.ensureVaultKeyMaterial = () => gate.promise;
        else f.context.decrypt = () => gate.promise;
        const pending = f.context.loadArchivedAccounts('A', 'privato'); await tick(); f.lock(); gate.resolve('old plaintext');
        await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
        assert.equal(f.observers.size, 0);
    }
});

test('late company list cannot fan out reads after an owner change and restore cannot start stale', async () => {
    const f = fixture(), gate = deferred(); let companyReads = 0;
    f.context.listCompanies = () => gate.promise;
    f.context.listCompanyAccounts = async () => { companyReads++; return []; };
    const pending = f.context.loadArchivedAccounts('A'); await tick(); f.changeUid('B'); gate.resolve([{id: 'company'}]);
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
    await assert.rejects(f.context.restoreArchivedAccount('A', account()), /ARCHIVE_SESSION_INVALIDATED/);
    assert.equal(companyReads, 0); assert.equal(f.writes.length, 0);
});

function restoreFixture(record = {isArchived: true, revision: 1, password: 'synthetic-cipher'}) {
    const f = fixture(), reads = [];
    // M7-R7C-2: il ripristino legge anche gli inviti quando deve neutralizzare.
    const invites = new Map();
    let server = record, afterRead = async () => {}, retry = false;
    f.context.runTransaction = async (_db, callback) => {
        for (;;) {
            const staged = [];
            await callback({
                get: async reference => {
                    reads.push(reference);
                    const isInvite = String(reference).startsWith('invites/');
                    const snapshot = isInvite ? (invites.has(reference) ? structuredClone(invites.get(reference)) : null) : structuredClone(server);
                    await afterRead();
                    return {exists: () => snapshot !== null, data: () => snapshot};
                },
                update: (reference, patch) => staged.push([reference, patch]),
                delete: () => { throw new Error('M7R7C2_NO_DELETE'); }
            });
            if (retry) { retry = false; continue; }
            f.writes.push(...staged);
            return;
        }
    };
    return {...f, reads, invites, set server(value) { server = value; }, set afterRead(callback) { afterRead = callback; },
        set retry(value) { retry = value; }};
}

test('archive restore CAS preserves private/company identity and updates only archive state and revision', async () => {
    for (const context of ['privato', 'company']) {
        // Account archiviato DAL PROTOCOLLO: grant vuoti e ciclo ≥ 1.
        const f = restoreFixture({isArchived: true, revision: 1, sharingCycle: 1, sharedWithUids: []});
        const selected = account('same', context);
        const pending = f.context.restoreArchivedAccount('A', selected);
        selected.id = 'changed'; selected.context = 'other'; selected.revision = 99;
        await pending;
        const expected = context === 'privato' ? 'users/A/accounts/same' : 'users/A/aziende/company/accounts/same';
        assert.deepEqual(f.reads, [expected]); assert.equal(f.writes.length, 1);
        const [path, patch] = f.writes[0]; assert.equal(path, expected);
        assert.deepEqual(Object.keys(patch).sort(), ['archiveSchemaVersion', 'archivedAt', 'isArchived', 'purgeAfter', 'revision']);
        assert.equal(patch.revision, 2); assert.equal(patch.isArchived, false);
    }
});

test('archive restore refuses changed revision, already restored and missing records without writes', async () => {
    for (const record of [{isArchived: true, revision: 2}, {isArchived: false, revision: 1}, {revision: 1}, null]) {
        const f = restoreFixture(record);
        await assert.rejects(f.context.restoreArchivedAccount('A', account()), /ARCHIVE_RESTORE_CONFLICT|ARCHIVE_RESTORE_MISSING/);
        assert.equal(f.writes.length, 0); assert.equal(f.observers.size, 0);
    }
});

test('archive restore rejects malformed, unsafe and exhausted revisions in selection and current snapshot', async () => {
    for (const revision of [null, '1', -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 1]) {
        const selection = restoreFixture();
        await assert.rejects(selection.context.restoreArchivedAccount('A', {...account(), revision}), /ARCHIVE_RESTORE_REVISION_INVALID/);
        assert.equal(selection.reads.length, 0); assert.equal(selection.writes.length, 0);
        const current = restoreFixture({isArchived: true, revision});
        await assert.rejects(current.context.restoreArchivedAccount('A', account()), /ARCHIVE_RESTORE_REVISION_INVALID/);
        assert.equal(current.writes.length, 0);
    }
});

test('archive restore recognizes only absent legacy revision as zero and still checks its current version', async () => {
    const selected = account(); delete selected.revision;
    const f = restoreFixture({isArchived: true});
    await f.context.restoreArchivedAccount('A', selected);
    assert.equal(f.writes[0][1].revision, 1);
    const changed = restoreFixture({isArchived: true, revision: 1});
    await assert.rejects(changed.context.restoreArchivedAccount('A', selected), /ARCHIVE_RESTORE_CONFLICT/);
    assert.equal(changed.writes.length, 0);
});

test('archive restore rechecks current state on transaction retry and never commits first attempt', async () => {
    const f = restoreFixture();
    f.retry = true;
    f.afterRead = async () => { f.server = {isArchived: true, revision: 2}; };
    await assert.rejects(f.context.restoreArchivedAccount('A', account()), /ARCHIVE_RESTORE_CONFLICT/);
    assert.equal(f.reads.length, 2); assert.equal(f.writes.length, 0);
});

test('archive restore lock or identity change during transaction read prevents all staged updates', async () => {
    for (const event of ['lock', 'changeUid']) {
        const f = restoreFixture();
        f.afterRead = async () => f[event]('B');
        await assert.rejects(f.context.restoreArchivedAccount('A', account()), /ARCHIVE_SESSION_INVALIDATED/);
        assert.equal(f.writes.length, 0); assert.equal(f.observers.size, 0);
    }
});

// M7-R7C-2 — il ripristino non riapre alcun accesso.

test('ripristino: Account archiviato dal protocollo non tocca condivisione né inviti', async () => {
    const f = restoreFixture({isArchived: true, revision: 4, sharingCycle: 2, sharedWithUids: [],
        sharedWith: {k: {email: 'g@example.invalid', status: 'suspended', suspendedAt: '2026-01-01T00:00:00.000Z'}}});
    const result = await f.context.restoreArchivedAccount('A', {...account(), revision: 4});
    assert.equal(result.status, 'restored');
    assert.equal(result.neutralized, false);
    assert.equal(result.sharingCycle, 2);
    assert.equal(result.neutralizedInvites, 0);
    assert.equal(f.writes.length, 1);
    const patch = f.writes[0][1];
    assert.equal(patch.isArchived, false);
    assert.equal(Object.hasOwn(patch, 'sharedWithUids'), false, 'nessun grant toccato');
    assert.equal(Object.hasOwn(patch, 'sharingCycle'), false, 'il ciclo resta quello del protocollo');
    assert.equal(f.reads.length, 1, 'nessuna lettura di inviti quando lo stato è coerente');
});

test('ripristino: Account legacy viene neutralizzato nella stessa transazione e il ciclo avanza', async () => {
    const f = restoreFixture({isArchived: true, revision: 3, sharedWithUids: ['guest-1', 'guest-2'],
        sharedWith: {
            accepted_key: {email: 'accepted@example.invalid', status: 'accepted', uid: 'guest-1'},
            pending_key: {email: 'pending@example.invalid', status: 'pending', uid: null},
            rejected_key: {email: 'rejected@example.invalid', status: 'rejected', uid: null}
        }});
    f.invites.set('invites/same_accepted_key', {status: 'accepted'});
    f.invites.set('invites/same_pending_key', {status: 'pending'});
    const result = await f.context.restoreArchivedAccount('A', {...account(), revision: 3});
    assert.equal(result.neutralized, true, 'grant residui ⇒ neutralizzazione');
    assert.equal(result.sharingCycle, 1, 'il ciclo parte da zero e avanza');
    assert.equal(result.neutralizedInvites, 2);
    const patch = f.writes.find(write => write[0] === 'users/A/accounts/same')[1];
    assert.equal(patch.isArchived, false);
    assert.equal(patch.sharedWithUids.length, 0, 'nessun accesso riaperto');
    assert.equal(patch.acceptedCount, 0);
    assert.equal(patch.sharingCycle, 1);
    assert.equal(patch.sharedWith.accepted_key.status, 'suspended');
    assert.equal(patch.sharedWith.pending_key.status, 'suspended');
    assert.equal(patch.sharedWith.rejected_key.status, 'rejected');
    const inviteWrites = f.writes.filter(write => String(write[0]).startsWith('invites/'));
    assert.deepEqual(inviteWrites.map(write => write[0]).sort(), ['invites/same_accepted_key', 'invites/same_pending_key']);
    assert.ok(inviteWrites.every(write => write[1].sharingState === 'suspended'));
});

test('ripristino: Account legacy senza ospiti avanza comunque il ciclo', async () => {
    const f = restoreFixture({isArchived: true, revision: 1, sharedWith: {}});
    const result = await f.context.restoreArchivedAccount('A', account());
    assert.equal(result.neutralized, true, 'ciclo assente ⇒ protocollo non applicato');
    assert.equal(result.sharingCycle, 1);
    assert.equal(result.neutralizedInvites, 0);
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0][1].sharedWithUids.length, 0);
});

test('ripristino: stato autorizzativo incoerente viene neutralizzato, mai interpretato come vuoto', async () => {
    const cases = [
        ['uids malformati (stringa)', {isArchived: true, revision: 1, sharingCycle: 1, sharedWithUids: 'guest-uid', sharedWith: {}}],
        ['uids malformati (mappa)', {isArchived: true, revision: 1, sharingCycle: 1, sharedWithUids: {a: 'guest'}, sharedWith: {}}],
        ['voce accettata con lista vuota', {isArchived: true, revision: 1, sharingCycle: 1, sharedWithUids: [], sharedWith: {k: {email: 'g@example.invalid', status: 'accepted', uid: 'guest-uid'}}}],
        ['voce pendente con lista vuota', {isArchived: true, revision: 1, sharingCycle: 1, sharedWithUids: [], sharedWith: {k: {email: 'g@example.invalid', status: 'pending', uid: null}}}],
        ['contatore residuo', {isArchived: true, revision: 1, sharingCycle: 1, sharedWithUids: [], acceptedCount: 1, sharedWith: {}}]
    ];
    for (const [name, record] of cases) {
        const f = restoreFixture(record);
        const result = await f.context.restoreArchivedAccount('A', account());
        assert.equal(result.neutralized, true, name);
        assert.equal(result.sharingCycle, 2, `${name}: il ciclo avanza`);
        const patch = f.writes.find(write => write[0] === 'users/A/accounts/same')[1];
        assert.equal(patch.isArchived, false, name);
        assert.equal(patch.sharedWithUids.length, 0, `${name}: nessun grant`);
        assert.equal(patch.acceptedCount, 0, name);
        assert.equal(patch.sharingCycle, 2, name);
        for (const guest of Object.values(patch.sharedWith || {})) {
            assert.equal(['accepted', 'pending'].includes(guest.status), false, `${name}: nessuna voce attiva o pendente`);
        }
    }
});

test('ripristino: uno stato che non si può neutralizzare fallisce chiuso', async () => {
    for (const sharedWith of ['stringa', 42, [], null]) {
        const f = restoreFixture({isArchived: true, revision: 1, sharingCycle: 1, sharedWithUids: [], sharedWith});
        await assert.rejects(f.context.restoreArchivedAccount('A', account()), /ARCHIVE_RESTORE_INCOHERENT/);
        assert.equal(f.writes.length, 0, `nessuna scrittura con sharedWith ${JSON.stringify(sharedWith)}`);
    }
});

test('ripristino: ciclo malformato o oltre il tetto fallisce senza scritture', async () => {
    for (const sharingCycle of [-1, '1', 1.5, Number.MAX_SAFE_INTEGER + 2, Number.MAX_SAFE_INTEGER]) {
        const f = restoreFixture({isArchived: true, revision: 1, sharingCycle, sharedWithUids: []});
        await assert.rejects(f.context.restoreArchivedAccount('A', account()), /ARCHIVE_RESTORE_CYCLE_INVALID/);
        assert.equal(f.writes.length, 0, `nessuna scrittura con sharingCycle ${sharingCycle}`);
    }
    const sharedWith = {};
    for (let index = 0; index <= 100; index++) sharedWith[`guest_${index}`] = {email: `g${index}@example.invalid`, status: 'accepted', uid: `u${index}`};
    const over = restoreFixture({isArchived: true, revision: 1, sharedWithUids: ['u0'], sharedWith});
    await assert.rejects(over.context.restoreArchivedAccount('A', account()), /ARCHIVE_RECIPIENTS_LIMIT/);
    assert.equal(over.writes.length, 0);
});

test('late archive read from previous mount cannot replace the next owner list', async () => {
    const f = fixture(true), gate = deferred(); f.context.listArchivedPrivateAccounts = () => gate.promise;
    const first = f.init(); await tick(); f.changeUid('B');
    f.context.listArchivedPrivateAccounts = async () => [account('B')]; const next = await f.init();
    gate.resolve([account('A')]); await first;
    const rows = f.nodes['accounts-container'].children;
    assert.equal(rows.length, 1); assert.equal(rows[0].dataset.key, '["privato","B"]');
    next.destroy(); assert.equal(f.observers.size, 0);
});

test('owned delete confirmation is cancelled on same UID remount, lock and pagehide', async () => {
    for (const event of ['remount', 'lock', 'pagehide']) {
        const f = fixture(true); await f.init();
        const oldSwipe = f.swipes.at(-1), row = f.nodes['accounts-container'].children[0];
        const pending = oldSwipe.options.onSwipeLeft(row);
        const oldOverlay = f.body.children.at(-1), oldConfirm = oldOverlay.querySelectorAll('button')[1].onclick;
        oldOverlay.querySelector('input').value = 'SI';
        if (event === 'remount') await f.init(); else f[event]();
        oldConfirm(); await pending;
        assert.equal(f.calls.length, 0); assert.equal(f.body.children.length, 0);
        assert.equal(oldOverlay.querySelector('input').value, '');
        assert.equal(oldSwipe.destroyed, true);
    }
});

test('same ID in private and two company archives selects and removes only the complete identity', async () => {
    const f = fixture(true);
    f.context.listCompanies = async () => [{id: 'one'}, {id: 'two'}];
    f.context.listCompanyAccounts = async () => [account()];
    await f.init();
    assert.equal(f.nodes['accounts-container'].children.length, 3);
    const row = f.nodes['accounts-container'].children.find(item => item.dataset.key === '["two","same"]');
    const pending = f.swipes.at(-1).options.onSwipeLeft(row); f.confirm(); await pending;
    assert.equal(f.calls.length, 1); assert.equal(f.calls[0].companyId, 'two');
    assert.deepEqual(f.nodes['accounts-container'].children.map(item => item.dataset.key), ['["privato","same"]', '["one","same"]']);
});

test('stale context read cannot replace latest filter result', async () => {
    const f = fixture(true); await f.init();
    const gate = deferred(); f.context.listArchivedPrivateAccounts = () => gate.promise;
    const menu = f.nodes['archive-context-menu'];
    const click = value => menu.onclick({target: {closest: () => new Element('div', {dataset: {value}})}});
    const first = click('privato'); await tick();
    f.context.listCompanyAccounts = async () => [account('new')]; await click('company');
    gate.resolve([account('old')]); await first;
    assert.equal(f.nodes['accounts-container'].children[0].dataset.key, '["company","new"]');
});

test('empty confirmation retains its original list and cannot report success after partial interruption', async () => {
    const f = fixture(true); f.context.listArchivedPrivateAccounts = async () => [account('one'), account('two')];
    await f.init(); const pending = f.nodes['btn-empty-trash'].onclick();
    const gate = deferred(); f.context.respond = () => gate.promise;
    f.confirm('SVUOTA'); await tick(); f.lock(); gate.resolve({data: {status: 'purged'}}); await pending;
    assert.equal(f.calls.length, 1); assert.equal(f.toasts.length, 0);
    assert.equal(f.nodes['accounts-container'].children.length, 0);
});

test('restore timer and retained swipe actions cannot modify a new mount', async () => {
    const f = fixture(true); await f.init(); const swipe = f.swipes.at(-1), row = f.nodes['accounts-container'].children[0];
    await swipe.options.onSwipeRight(row); assert.equal(f.timers.size, 1);
    f.context.listArchivedPrivateAccounts = async () => [account('new')]; await f.init();
    assert.equal(f.timers.size, 0); await swipe.options.onSwipeRight(row);
    assert.equal(f.writes.length, 1); assert.equal(f.nodes['accounts-container'].children[0].dataset.key, '["privato","new"]');
});

test('restore conflicts explain the next step and preserve the archived row without success', async () => {
    for (const [record, expected] of [[{isArchived: true, revision: 2}, /modificato.*Aggiorna l’Archivio/],
        [null, /non è più disponibile.*Aggiorna l’Archivio/],
        [{isArchived: true, revision: null}, /richiedono una verifica/]]) {
        const f = fixture(true);
        f.context.runTransaction = async (_db, callback) => callback({
            get: async () => ({exists: () => record !== null, data: () => record}),
            update: () => assert.fail('conflicting restore must not update')
        });
        await f.init();
        const row = f.nodes['accounts-container'].children[0];
        await f.swipes.at(-1).options.onSwipeRight(row);
        assert.match(f.toasts.at(-1)[0], expected);
        assert.equal(f.toasts.at(-1)[1], 'error');
        assert.equal(f.toasts.some(([, level]) => level === 'success'), false);
        assert.equal(f.nodes['accounts-container'].children[0], row);
        assert.equal(row.classList.contains('is-removing'), false);
        assert.equal(f.timers.size, 0); assert.equal(f.writes.length, 0);
    }
});

test('repeated delete gestures keep a single owned confirmation and a single submitted purge', async () => {
    const f = fixture(true); await f.init(); const swipe = f.swipes.at(-1), row = f.nodes['accounts-container'].children[0];
    const first = swipe.options.onSwipeLeft(row), second = swipe.options.onSwipeLeft(row);
    assert.equal(f.body.children.length, 1);
    const input = f.body.children[0].querySelector('input');
    assert.equal(input.autocapitalize, 'off'); assert.equal(input.spellcheck, 'false'); assert.ok(input['aria-label']);
    f.confirm(); await Promise.all([first, second]);
    assert.equal(f.calls.length, 1); assert.equal(f.body.children.length, 0);
});

test('explicit purge retry reuses the exact command after response loss before or after server deletion', async () => {
    for (const deletedBeforeFailure of [false, true]) {
        const f = fixture(), receipts = new Set(); let deletions = 0, attempts = 0;
        f.context.respond = async command => {
            attempts++;
            if (attempts === 1 && !deletedBeforeFailure) throw Object.assign(new Error('synthetic'), {code: 'functions/unavailable'});
            if (!receipts.has(command.operationId)) { receipts.add(command.operationId); deletions++; }
            if (attempts === 1) throw Object.assign(new Error('synthetic'), {code: 'functions/deadline-exceeded'});
            return {data: {status: 'purged', duplicate: true}};
        };
        const target = account('original'), targets = [target];
        const plan = f.context.prepareArchiveDeletion('A', targets);
        target.id = 'changed'; target.context = 'company'; target.revision = 999; targets.push(account('extra'));
        await assert.rejects(f.context.executeArchiveDeletion(plan), error => error.code === 'ARCHIVE_PURGE_UNCERTAIN' && error.retryable);
        await assert.rejects(f.context.executeArchiveDeletion(plan), error => error.code === 'ARCHIVE_RETRY_REQUIRED');
        assert.equal(f.calls.length, 1);
        assert.equal((await f.context.executeArchiveDeletion(plan, {retry: true})).confirmedCount, 1);
        assert.equal(f.calls.length, 2); assert.equal(f.calls[0], f.calls[1]);
        assert.equal(f.calls[1].accountId, 'original'); assert.equal(f.calls[1].context, 'private'); assert.equal(f.calls[1].expectedRevision, 1);
        assert.equal(Object.isFrozen(f.calls[1]), true); assert.equal(deletions, 1);
        await f.context.executeArchiveDeletion(plan); assert.equal(f.calls.length, 2);
        f.context.releaseArchiveDeletion(plan); assert.equal(f.observers.size, 0);
    }
});

test('empty retry skips confirmed accounts and keeps separate operation IDs for remaining targets', async () => {
    const f = fixture(); let fail = true;
    f.context.respond = async command => {
        if (command.accountId === 'two' && fail) { fail = false; throw new Error('synthetic response loss'); }
        return {data: {status: 'purged'}};
    };
    const plan = f.context.prepareArchiveDeletion('A', [account('one'), account('two'), account('three')]);
    await assert.rejects(f.context.executeArchiveDeletion(plan), error => error.progress.confirmedCount === 1 && error.progress.totalCount === 3);
    assert.equal((await f.context.executeArchiveDeletion(plan, {retry: true})).confirmedCount, 3);
    assert.deepEqual(f.calls.map(command => command.accountId), ['one', 'two', 'two', 'three']);
    assert.equal(f.calls[1], f.calls[2]);
    assert.equal(new Set(f.calls.map(command => command.operationId)).size, 3);
    f.context.releaseArchiveDeletion(plan);
});

test('single flight prevents duplicate calls and session invalidation permanently removes the plan', async () => {
    const f = fixture(), gate = deferred(); f.context.respond = () => gate.promise;
    const plan = f.context.prepareArchiveDeletion('A', [account()]);
    const pending = f.context.executeArchiveDeletion(plan);
    await assert.rejects(f.context.executeArchiveDeletion(plan, {retry: true}), /ARCHIVE_DELETION_IN_PROGRESS/);
    assert.equal(f.calls.length, 1);
    f.lock(); gate.resolve({data: {status: 'purged'}});
    await assert.rejects(pending, /ARCHIVE_SESSION_INVALIDATED/);
    await assert.rejects(f.context.executeArchiveDeletion(plan, {retry: true}), /ARCHIVE_PLAN_INVALID/);
    assert.equal(f.calls.length, 1); assert.equal(f.observers.size, 0);
});

test('definitive rejection blocks retries and sanitizes provider messages', async () => {
    for (const code of ['functions/failed-precondition', 'functions/permission-denied', 'functions/invalid-argument']) {
        const f = fixture();
        f.context.respond = async () => { throw Object.assign(new Error('synthetic private provider details'), {code}); };
        const plan = f.context.prepareArchiveDeletion('A', [account()]);
        await assert.rejects(f.context.executeArchiveDeletion(plan), error => error.retryable === false && !error.message.includes('private'));
        await assert.rejects(f.context.executeArchiveDeletion(plan, {retry: true}), /ARCHIVE_DELETION_BLOCKED/);
        assert.equal(f.calls.length, 1); f.context.releaseArchiveDeletion(plan);
    }
});

test('UI waits for explicit retry and prevents competing mutations while its choice is open', async () => {
    const f = fixture(true); let attempts = 0;
    f.context.respond = async () => { if (++attempts === 1) throw new Error('response lost'); return {data: {status: 'purged', duplicate: true}}; };
    await f.init(); const swipe = f.swipes.at(-1), row = f.nodes['accounts-container'].children[0];
    const pending = swipe.options.onSwipeLeft(row); f.confirm(); await tick();
    assert.equal(f.calls.length, 1); assert.equal(f.body.children.length, 1);
    await swipe.options.onSwipeLeft(row); await swipe.options.onSwipeRight(row); await f.nodes['btn-empty-trash'].onclick();
    assert.equal(f.body.children.length, 1); assert.equal(f.writes.length, 0); assert.equal(f.calls.length, 1);
    const resume = f.body.querySelectorAll('button').find(button => button.textContent === 'Verifica e riprendi');
    resume.onclick(); await pending;
    assert.equal(f.calls.length, 2); assert.equal(f.calls[0], f.calls[1]);
    assert.equal(f.body.children.length, 0); assert.equal(f.toasts.at(-1)[1], 'success');
});

test('lock and stopping retry release the owned dialog and cannot resubmit a retained callback', async () => {
    for (const action of ['lock', 'stop']) {
        const f = fixture(true); f.context.respond = async () => { throw new Error('response lost'); };
        await f.init(); const row = f.nodes['accounts-container'].children[0];
        const pending = f.swipes.at(-1).options.onSwipeLeft(row); f.confirm(); await tick();
        const buttons = f.body.querySelectorAll('button');
        const resume = buttons.find(button => button.textContent === 'Verifica e riprendi');
        if (action === 'lock') f.lock(); else buttons.find(button => button.textContent === 'Interrompi').onclick();
        await pending; resume.onclick(); await tick();
        assert.equal(f.calls.length, 1); assert.equal(f.body.children.length, 0);
        assert.equal(f.toasts.length, action === 'lock' ? 0 : 1);
        if (action === 'stop') assert.equal(f.toasts[0][1], 'warning');
    }
});

test('empty UI removes confirmed targets after interrupted second account without claiming completion', async () => {
    const f = fixture(true);
    f.context.listArchivedPrivateAccounts = async () => [account('one'), account('two')];
    f.context.respond = async command => {
        if (command.accountId === 'two') throw new Error('response lost');
        return {data: {status: 'purged'}};
    };
    await f.init(); const pending = f.nodes['btn-empty-trash'].onclick(); f.confirm('SVUOTA'); await tick();
    assert.equal(f.calls.length, 2);
    f.body.querySelectorAll('button').find(button => button.textContent === 'Interrompi').onclick(); await pending;
    assert.deepEqual(f.nodes['accounts-container'].children.map(row => row.dataset.key), ['["privato","two"]']);
    assert.equal(f.toasts.at(-1)[1], 'warning');
});

// M7-R6 — archiviazione canonica: il pulsante «Elimina» sposta nell'Archivio.
// Questi test coprono il percorso condiviso da liste e form.

test('archiviazione: scrive i metadati canonici con revisione incrementata', async () => {
    for (const [context, prefix] of [['privato', 'users/A/accounts/x'], ['company-1', 'users/A/aziende/company-1/accounts/x']]) {
        const f = fixture(); f.stored = {isArchived: false, revision: 4};
        const result = await f.context.archiveAccount('A', {id: 'x', context, revision: 4});
        assert.deepEqual({...result}, {status: 'archived', id: 'x', context, revision: 5, sharingCycle: 1, suspendedInvites: 0});
        assert.equal(f.writes.length, 1);
        const [path, patch] = f.writes[0];
        assert.equal(path, prefix);
        assert.equal(patch.isArchived, true);
        assert.equal(patch.revision, 5);
        assert.equal(patch.archiveSchemaVersion, 2);
        assert.equal(typeof patch.archivedAt, 'string');
    }
});

test('archiviazione: un Account già in Archivio non viene incrementato due volte', async () => {
    const f = fixture(); f.stored = {isArchived: true, revision: 7};
    const result = await f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 7});
    assert.deepEqual({...result}, {status: 'already-archived', id: 'x', context: 'privato', revision: 7, sharingCycle: 0, suspendedInvites: 0});
    assert.equal(f.writes.length, 0, 'nessuna seconda scrittura');
});

test('archiviazione: revisione cambiata non sovrascrive e chiede di aggiornare', async () => {
    const f = fixture(); f.stored = {isArchived: false, revision: 9};
    await assert.rejects(f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 4}), /ARCHIVE_CONFLICT/);
    assert.equal(f.writes.length, 0);
});

// Correzione M7-R6 (revisione Codex del 21/09/2026): il marker osservato deve
// essere quello letto all'apertura della vista. Prima di questa correzione il
// form aziendale rileggeva il documento al momento del clic, quindi una modifica
// concorrente fra apertura e clic spariva senza conflitto. Ora valgono due
// marker osservati: `revision` e, per i writer legacy che non la incrementano,
// `updatedAt`. Se non arriva nessuno dei due si fallisce chiusi.
test('archiviazione: updatedAt osservato consente di archiviare i writer legacy senza revisione', async () => {
    const f = fixture(); f.stored = {isArchived: false, revision: 3, updatedAt: '2026-01-01T00:00:00.000Z'};
    const result = await f.context.archiveAccount('A', {id: 'x', context: 'privato', updatedAt: '2026-01-01T00:00:00.000Z'});
    assert.deepEqual({...result}, {status: 'archived', id: 'x', context: 'privato', revision: 4, sharingCycle: 1, suspendedInvites: 0});
    assert.equal(f.writes.length, 1);
    assert.equal(f.writes[0][1].isArchived, true);
    assert.equal(f.writes[0][1].revision, 4);
});

test('archiviazione: updatedAt cambiato con la stessa revisione non sovrascrive', async () => {
    const f = fixture(); f.stored = {isArchived: false, revision: 3, updatedAt: '2026-02-02T00:00:00.000Z'};
    await assert.rejects(f.context.archiveAccount('A', {id: 'x', context: 'privato',
        revision: 3, updatedAt: '2026-01-01T00:00:00.000Z'}), /ARCHIVE_UPDATED_AT_CONFLICT/);
    assert.equal(f.writes.length, 0, 'nessuna scrittura quando il documento è cambiato dopo l\'apertura');
});

test('archiviazione: senza alcun marker osservato si fallisce chiusi', async () => {
    const f = fixture(); f.stored = {isArchived: false, revision: 2, updatedAt: '2026-01-01T00:00:00.000Z'};
    await assert.rejects(f.context.archiveAccount('A', {id: 'x', context: 'privato'}), /ARCHIVE_MARKER_MISSING/);
    await assert.rejects(f.context.archiveAccount('A', {id: 'x', context: 'privato', updatedAt: ''}), /ARCHIVE_MARKER_MISSING/);
    assert.equal(f.writes.length, 0, 'non si archivia uno stato che l\'utente non ha visto');
});

test('archiviazione: documento assente, revisione non valida e identità incompleta falliscono senza scritture', async () => {
    const f = fixture(); f.stored = null;
    await assert.rejects(f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 1}), /ARCHIVE_ACCOUNT_MISSING/);
    f.stored = {isArchived: false, revision: 1};
    for (const revision of [-1, 1.5, '1', Number.MAX_SAFE_INTEGER]) {
        await assert.rejects(f.context.archiveAccount('A', {id: 'x', context: 'privato', revision}), /ARCHIVE_REVISION_INVALID/);
    }
    await assert.rejects(f.context.archiveAccount('A', {id: '', context: 'privato', revision: 0}), /Account archiviato non valido/);
    assert.equal(f.writes.length, 0);
});

test('archiviazione: blocco del Vault e cambio utente impediscono la scrittura', async () => {
    const f = fixture(); f.stored = {isArchived: false, revision: 2};
    const controller = new AbortController();
    const aborted = f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 2}, {signal: controller.signal});
    controller.abort();
    await assert.rejects(aborted, /ARCHIVE_SESSION_INVALIDATED/);
    const changed = f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 2});
    f.changeUid('B');
    await assert.rejects(changed, /ARCHIVE_SESSION_INVALIDATED/);
    assert.equal(f.writes.length, 0);
});

// M7-R7C-1 — la revoca persistente dei grant e il ciclo sono atomici con
// l'archiviazione, nella stessa transazione che verifica i marker osservati.

const MARKER_7C = '2026-01-01T00:00:00.000Z';

test('archiviazione: revoca persistente, stato sospeso e ciclo nella stessa transazione', async () => {
    const f = fixture();
    f.stored = {isArchived: false, revision: 4, updatedAt: MARKER_7C, sharedWith: {
        accepted_key: {email: 'accepted@example.invalid', status: 'accepted', uid: 'guest-1'},
        pending_key: {email: 'pending@example.invalid', status: 'pending', uid: null},
        rejected_key: {email: 'rejected@example.invalid', status: 'rejected', uid: null}
    }};
    f.invites.set('invites/x_accepted_key', {status: 'accepted', guestUid: 'guest-1'});
    f.invites.set('invites/x_pending_key', {status: 'pending'});
    const result = await f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 4, updatedAt: MARKER_7C});
    assert.equal(f.transactionRuns, 1, 'archiviazione e revoca in una sola transazione');
    assert.equal(result.status, 'archived');
    assert.equal(result.sharingCycle, 1);
    assert.equal(result.suspendedInvites, 2, 'solo gli inviti esistenti vengono marcati');
    const accountWrite = f.writes.find(write => write[0] === 'users/A/accounts/x');
    assert.equal(accountWrite[1].isArchived, true);
    assert.equal(accountWrite[1].sharingCycle, 1);
    assert.equal(accountWrite[1].sharedWithUids.length, 0, 'nessun grant residuo');
    assert.equal(accountWrite[1].acceptedCount, 0);
    assert.equal(accountWrite[1].sharedWith.accepted_key.status, 'suspended');
    assert.equal(typeof accountWrite[1].sharedWith.accepted_key.suspendedAt, 'string');
    assert.equal(accountWrite[1].sharedWith.pending_key.status, 'suspended');
    assert.equal(accountWrite[1].sharedWith.rejected_key.status, 'rejected', 'chi ha rifiutato conserva lo stato');
    const inviteWrites = f.writes.filter(write => write[0].startsWith('invites/'));
    assert.deepEqual(inviteWrites.map(write => write[0]).sort(), ['invites/x_accepted_key', 'invites/x_pending_key']);
    assert.ok(inviteWrites.every(write => write[1].sharingState === 'suspended' && typeof write[1].suspendedAt === 'string'));
});

test('archiviazione: senza ospiti il ciclo avanza comunque e non si scrivono inviti', async () => {
    const f = fixture();
    f.stored = {isArchived: false, revision: 2, updatedAt: MARKER_7C, sharedWith: {}};
    const result = await f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 2, updatedAt: MARKER_7C});
    assert.equal(result.sharingCycle, 1);
    assert.equal(result.suspendedInvites, 0);
    assert.equal(f.writes.length, 1);
});

test('archiviazione: un ciclo già avanzato usa e marca l\'invito del ciclo corrente', async () => {
    const f = fixture();
    f.stored = {isArchived: false, revision: 1, updatedAt: MARKER_7C, sharingCycle: 2,
        sharedWith: {k: {email: 'g@example.invalid', status: 'accepted', uid: 'u'}}};
    f.invites.set('invites/x_k_c2', {status: 'accepted'});
    const result = await f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 1, updatedAt: MARKER_7C});
    assert.equal(result.sharingCycle, 3);
    assert.deepEqual(f.writes.filter(write => write[0].startsWith('invites/')).map(write => write[0]), ['invites/x_k_c2']);
});

test('archiviazione: ciclo malformato o al massimo chiude l\'operazione senza scritture', async () => {
    for (const sharingCycle of [-1, 1.5, '1', Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER + 2]) {
        const f = fixture();
        f.stored = {isArchived: false, revision: 1, updatedAt: MARKER_7C, sharingCycle,
            sharedWith: {k: {email: 'g@example.invalid', status: 'accepted', uid: 'u'}}};
        await assert.rejects(f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 1, updatedAt: MARKER_7C}),
            /ARCHIVE_CYCLE_INVALID/);
        assert.equal(f.writes.length, 0, `nessuna scrittura con sharingCycle ${sharingCycle}`);
    }
});

test('archiviazione: oltre il tetto di destinatari non si scrive nulla', async () => {
    const f = fixture();
    const sharedWith = {};
    for (let index = 0; index <= 100; index++) sharedWith[`guest_${index}`] = {email: `g${index}@example.invalid`, status: 'accepted', uid: `u${index}`};
    f.stored = {isArchived: false, revision: 1, updatedAt: MARKER_7C, sharedWith};
    await assert.rejects(f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 1, updatedAt: MARKER_7C}),
        /ARCHIVE_RECIPIENTS_LIMIT/);
    assert.equal(f.writes.length, 0);
    assert.equal(f.transactionRuns, 1);
});

test('archiviazione: già in Archivio riporta il ciclo senza scrivere', async () => {
    const f = fixture();
    f.stored = {isArchived: true, revision: 7, updatedAt: MARKER_7C, sharingCycle: 3,
        sharedWith: {k: {email: 'g@example.invalid', status: 'suspended'}}};
    const result = await f.context.archiveAccount('A', {id: 'x', context: 'privato', revision: 7, updatedAt: MARKER_7C});
    assert.equal(result.status, 'already-archived');
    assert.equal(result.sharingCycle, 3);
    assert.equal(f.writes.length, 0);
});
