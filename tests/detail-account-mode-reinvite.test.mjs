import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// M7-R7C-5 correzione (revisione Codex 21/09/2026) — banco comportamentale sul
// terzo editor reale: `shared/detail-account-mode.js`. Dopo un ripristino una voce
// `suspended` non è preselezionata, non riceve inviti né grant dal solo
// salvataggio, e solo una selezione espressa crea l'invito del ciclo corrente
// lasciando intatto quello storico.
const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const strip = text => text.replace(/^export \{[^}]*\} from ['"][^'"]*['"];\r?\n/gm, '')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const source = strip(await readFile(new URL('shared/detail-account-mode.js', modules), 'utf8'));
const utilsSource = await readFile(new URL('../utils.js', modules), 'utf8');
const {inviteIdForGuest, sanitizeEmail, sharingCycleOf} =
    await import('data:text/javascript;base64,' + Buffer.from(utilsSource).toString('base64'));

const EMAIL = 'guest@example.invalid';
const KEY = 'guest_example_invalid';
const ACCOUNT_ID = 'account-1';

class Node {
    constructor(tag, props = {}, children = []) {
        this.tag = tag; this.children = []; this.dataset = {}; this.listeners = new Map();
        const values = new Set((props.className || '').split(' ').filter(Boolean));
        this.classList = {values,
            add: name => values.add(name), remove: name => values.delete(name), contains: name => values.has(name),
            toggle(name, force) { if (force ?? !values.has(name)) values.add(name); else values.delete(name); }};
        Object.assign(this, props);
        children.filter(Boolean).forEach(child => this.appendChild(child));
    }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    addEventListener(type, handler) { this.listeners.set(type, handler); }
    dispatch(type) { this.listeners.get(type)?.(); }
    descendants() { return this.children.flatMap(child => [child, ...(child.descendants ? child.descendants() : [])]); }
}

function fixture({sharingCycle = 1, status = 'suspended'} = {}) {
    const writes = [], toasts = [];
    const nodes = Object.fromEntries(['account-mode-section', 'account-mode-options', 'account-mode-contacts',
        'account-mode-contact-list', 'btn-save-account-mode'].map(id => [id, new Node('div', {id})]));
    const account = {id: ACCOUNT_ID, nomeAccount: 'Sintetico', visibility: 'shared', type: 'account',
        acceptedCount: 0, sharingCycle, sharedWithUids: [],
        sharedWith: {[KEY]: {email: EMAIL, status, uid: null}}};
    const context = vm.createContext({
        inviteIdForGuest, sanitizeEmail, sharingCycleOf, structuredClone, console: {warn: () => {}, error: () => {}},
        db: {}, auth: {currentUser: {uid: 'owner', email: 'owner@example.invalid'}},
        doc: (_db, ...path) => ({path: path.join('/')}),
        collection: (_db, ...path) => ({path: path.join('/')}),
        increment: () => ({__increment: 1}),
        runTransaction: async (_db, callback) => {
            const staged = [];
            await callback({
                get: async () => ({exists: () => true, data: () => structuredClone(account)}),
                update: (reference, patch) => staged.push([reference.path, patch, 'update']),
                set: (reference, patch) => staged.push([reference.path, patch, 'set']),
                delete: reference => staged.push([reference.path, {deleted: true}, 'delete'])
            });
            writes.push(...staged);
        },
        listContacts: async () => [{id: 'contact-1', nome: 'Ospite', cognome: 'Sintetico', email: EMAIL, active: true}],
        accountModeFromRecord: () => 'account-shared', accountModeFromFlags: () => 'account-shared',
        validateAccountMode: () => ({}), hasAccountCredentials: () => true,
        showToast: (...args) => toasts.push(args), showConfirmModal: async () => true, t: key => key,
        createElement: (tag, props, children) => new Node(tag, props, children), clearElement: node => { node.children = []; },
        document: {getElementById: id => nodes[id] || null, querySelector: () => null}
    });
    vm.runInContext(source, context);
    return {writes, toasts, nodes, account,
        init: () => context.initDetailAccountMode({account, ownerId: 'owner', accountId: ACCOUNT_ID,
            aziendaId: null, readOnly: false, compactView: false, onReload: async () => {},
            isActive: () => true, confirm: async () => true}),
        checkbox: () => nodes['account-mode-contact-list'].descendants().find(node => node.tag === 'input'),
        save: () => nodes['btn-save-account-mode'].onclick()};
}

test('editor dettaglio: una voce sospesa non è preselezionata', async () => {
    const f = fixture();
    await f.init();
    const checkbox = f.checkbox();
    assert.ok(checkbox, 'il contatto è elencato fra i destinatari');
    assert.equal(checkbox.checked, false, 'nessuna preselezione per un accesso sospeso');
});

test('editor dettaglio: salvare senza selezionare non crea inviti né grant', async () => {
    const f = fixture();
    await f.init();
    await f.save();
    assert.equal(f.writes.length, 0, 'nessuna scrittura');
    assert.deepEqual(f.toasts.at(-1), ['Seleziona almeno un destinatario per la condivisione.', 'warning']);
});

test('editor dettaglio: la selezione espressa crea l\'invito del ciclo corrente e lascia intatto lo storico', async () => {
    const f = fixture({sharingCycle: 1});
    await f.init();
    const checkbox = f.checkbox();
    checkbox.checked = true;
    checkbox.dispatch('change');
    await f.save();
    const created = f.writes.filter(write => write[0].startsWith('invites/') && write[2] === 'set');
    assert.deepEqual(created.map(write => write[0]), ['invites/account-1_guest_example_invalid_c1']);
    assert.equal(created[0][1].cycle, 1, 'l\'invito dichiara il ciclo corrente');
    assert.equal(created[0][1].status, 'pending');
    assert.equal(f.writes.some(write => write[0] === 'invites/account-1_guest_example_invalid'), false,
        'l\'invito storico (ciclo 0) non viene toccato');
    const account = f.writes.find(write => write[0] === 'users/owner/accounts/account-1');
    assert.equal(account[1].sharedWith[KEY].status, 'pending');
    assert.equal(account[1].sharedWithUids.length, 0, 'l\'accesso non torna prima dell\'accettazione');
    assert.equal(account[1].acceptedCount, 0);
});

test('editor dettaglio: ciclo malformato non produce scritture', async () => {
    const f = fixture({sharingCycle: -1, status: 'accepted'});
    await f.init();
    const checkbox = f.checkbox();
    checkbox.checked = true;
    checkbox.dispatch('change');
    await f.save();
    assert.equal(f.writes.length, 0, 'nessuna scrittura con ciclo malformato');
    assert.deepEqual(f.toasts.at(-1), ['Impossibile salvare la modifica.', 'error']);
});

test('editor dettaglio: una voce pendente già selezionata non richiede un nuovo invito', async () => {
    const f = fixture({sharingCycle: 1, status: 'pending'});
    await f.init();
    const checkbox = f.checkbox();
    assert.equal(checkbox.checked, true, 'una voce pendente resta selezionata');
    await f.save();
    assert.equal(f.writes.some(write => write[0].startsWith('invites/') && write[2] === 'set'), false,
        'nessun nuovo invito per una voce già pendente');
});
