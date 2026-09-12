import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../Frontend/public/assets/js/', import.meta.url);
const sources = await Promise.all(['offline-firestore.js', 'modules/data/request-coordinator.js',
    'modules/data/vault-repository.js', 'modules/azienda/modifica_azienda.js'].map(path => readFile(new URL(path, root), 'utf8')));
const stripModule = source => source.replace(/^import[\s\S]*?;\r?$/gm, '').replace(/^export /gm, '');
function fixture({online = true, failure = false, missing = false, search = '?id=company'} = {}) {
    const cached = {id: 'old-payload-id', ragioneSociale: 'Synthetic company', telefonoAzienda: 'OLD', emails: {pec: {email: 'old@example.invalid'}}};
    const remote = {id: 'payload-alias', ragioneSociale: 'Synthetic company', telefonoAzienda: 'NEW', emails: {pec: {email: 'new@example.invalid'}}};
    const reads = [], populated = [], errors = [], toasts = [], elements = new Map();
    const state = {formLoaded: true, originalCompany: {previous: true}};
    elements.set('footer-center-actions', {children: []}); elements.set('footer-right-actions', {children: []});
    const snapshot = (data, exists = true) => ({id: 'company', exists: () => exists, data: () => structuredClone(data)});
    const context = vm.createContext({URLSearchParams, navigator: {onLine: online}, window: {location: {search}}, state,
        db: {}, doc: (_, ...path) => ({path: path.join('/')}),
        getDocFromCache: async reference => { reads.push(['cache', reference.path]); return snapshot(cached); },
        getDocFromServer: async reference => { reads.push(['server', reference.path]); if (failure) throw new Error('SERVER_UNAVAILABLE'); return snapshot(remote, !missing); },
        document: {getElementById: id => elements.get(id) || null},
        createElement: (tag, props, children) => { const node = {tag, ...props, children}; if (props.id) elements.set(props.id, node); return node; },
        clearElement: node => { node.children = []; }, setChildren: (node, child) => { node.children = [child]; },
        showToast: (...args) => toasts.push(args), t: value => value, logError: (...args) => errors.push(args),
        populateForm: async company => { populated.push(company); state.originalCompany = structuredClone(company); },
        updateTitlesForCreation() {}, initFormEvents() {}, saveAzienda() {}, deleteAzienda() {}
    });
    for (const source of sources) vm.runInContext(stripModule(source), context);
    return {cached, remote, reads, populated, state, errors, toasts, save: () => elements.get('btn-save'),
        init: () => context.initModificaAzienda({uid: 'owner'})};
}

test('online company form loads the server snapshot through the canonical repository, ignoring stale cache', async () => {
    const f = fixture(); await f.init();
    assert.deepEqual(f.reads, [['server', 'users/owner/aziende/company']]);
    assert.equal(f.populated.length, 1); assert.equal(f.state.originalCompany.telefonoAzienda, 'NEW');
    assert.equal(f.state.originalCompany.emails.pec.email, 'new@example.invalid');
    assert.equal(f.state.originalCompany.id, f.remote.id);
    assert.equal(f.state.currentAziendaId, 'company');
    assert.equal(f.remote.id, 'payload-alias'); assert.equal(f.cached.telefonoAzienda, 'OLD');
    assert.equal(f.state.formLoaded, true); assert.equal(f.save().disabled, false); assert.deepEqual(f.errors, []);
});

test('server failure never falls back to stale cache or enables saving', async () => {
    const f = fixture({failure: true}); await f.init();
    assert.deepEqual(f.reads, [['server', 'users/owner/aziende/company']]);
    assert.equal(f.populated.length, 0); assert.equal(f.state.originalCompany, null);
    assert.equal(f.state.formLoaded, false); assert.equal(f.save().disabled, true);
    assert.equal(f.errors.length, 1); assert.equal(f.toasts[0][0], 'error_generic');
});

test('missing server record is not replaced by an old cached company', async () => {
    const f = fixture({missing: true}); await f.init();
    assert.deepEqual(f.reads, [['server', 'users/owner/aziende/company']]);
    assert.equal(f.populated.length, 0); assert.equal(f.state.formLoaded, false); assert.equal(f.save().disabled, true);
    assert.equal(f.toasts[0][0], 'error_not_found');
});

test('offline company form retains its existing cache-backed loading behavior', async () => {
    const f = fixture({online: false}); await f.init();
    assert.deepEqual(f.reads, [['cache', 'users/owner/aziende/company']]);
    assert.equal(f.state.originalCompany.telefonoAzienda, 'OLD');
    assert.equal(f.state.formLoaded, true); assert.equal(f.save().disabled, false); assert.deepEqual(f.errors, []);
});

test('new company form requires no repository read and keeps its save action enabled', async () => {
    const f = fixture({search: ''}); await f.init();
    assert.deepEqual(f.reads, []); assert.equal(f.populated.length, 0); assert.equal(f.save().disabled, false);
});
