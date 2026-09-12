import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const root = new URL('../Frontend/public/assets/js/', import.meta.url);
const sources = await Promise.all(['offline-firestore.js', 'modules/data/request-coordinator.js',
    'modules/data/vault-repository.js', 'modules/azienda/dati_azienda.js'].map(path => readFile(new URL(path, root), 'utf8')));
const strip = source => source.replace(/^import[\s\S]*?;\r?$/gm, '').replace(/^export /gm, '');
function fixture({afterWrite = true, online = true, phone = '', failure = false, missing = false} = {}) {
    const reads = [], rendered = [], toasts = [], replaced = [], errors = [];
    const cached = {ragioneSociale: 'Synthetic company', telefonoAzienda: 'OLD'};
    const remote = {ragioneSociale: 'Synthetic company', telefonoAzienda: phone};
    const navigator = {onLine: online};
    const location = {search: '?id=company&tab=contatti' + (afterWrite ? '&afterWrite=1' : ''), pathname: '/dati_azienda.html', hash: '#contatti'};
    const phoneNode = {tagName: 'DIV', textContent: '-'}, callNode = {href: '#'};
    const document = {getElementById: id => id === 'telefono-azienda' ? phoneNode : id === 'btn-call-tel' ? callNode : null,
        querySelector: () => null};
    const snapshot = (data, exists = true) => ({id: 'company', exists: () => exists, data: () => structuredClone(data)});
    const realm = vm.createContext({URLSearchParams, structuredClone, navigator, document,
        window: {location, history: {replaceState(_, __, path) { replaced.push(path); const url = new URL(path, 'https://example.invalid'); location.search = url.search; }}},
        db: {}, auth: {currentUser: {uid: 'owner'}}, doc: (_, ...path) => ({path: path.join('/')}),
        getDocFromCache: async reference => { reads.push(['cache', reference.path]); return snapshot(cached); },
        getDocFromServer: async reference => { reads.push(['server', reference.path]); if (failure) throw new Error('SERVER_UNAVAILABLE'); return snapshot(remote, !missing); },
        ensureQRCodeLib: async () => {}, buildVCard: () => '', renderQRCode() {}, renderCompanyEmbeddedAttachments() {},
        initCompanyProfile: (data, id, options) => rendered.push({data, id, options}),
        showToast: (...args) => toasts.push(args), t: value => value, logError: (...args) => errors.push(args)
    });
    for (const source of sources) vm.runInContext(strip(source), realm);
    return {reads, rendered, toasts, replaced, errors, location, navigator, remote, phoneNode, callNode,
        failServer: value => { failure = value; },
        init: (uid = 'owner') => realm.initDatiAzienda({uid})};
}

for (const phone of ['', 'NEW']) {
    test(`after-write navigation renders confirmed phone ${phone || '(deleted)'} without an old cache read`, async () => {
        const f = fixture({phone}); await f.init();
        assert.deepEqual(f.reads, [['server', 'users/owner/aziende/company']]);
        assert.equal(f.rendered[0].data.telefonoAzienda, phone);
        assert.equal(f.phoneNode.textContent, phone || '-'); assert.equal(f.callNode.href, phone ? `tel:${phone}` : '#');
        assert.deepEqual(f.replaced, ['/dati_azienda.html?id=company&tab=contatti#contatti']);
        assert.equal(new URLSearchParams(f.location.search).has('afterWrite'), false);
    });
}

test('normal navigation keeps cache-first behavior', async () => {
    const f = fixture({afterWrite: false, phone: 'NEW'}); await f.init();
    assert.equal(f.reads[0][0], 'cache'); assert.equal(f.rendered[0].data.telefonoAzienda, 'OLD');
    assert.deepEqual(f.replaced, []);
});

test('failed after-write refresh never falls back to old cache and retains its URL flag', async () => {
    const f = fixture({failure: true}); await f.init();
    assert.deepEqual(f.reads, [['server', 'users/owner/aziende/company']]);
    assert.equal(f.rendered.length, 0); assert.equal(f.phoneNode.textContent, '-');
    assert.deepEqual(f.replaced, []); assert.equal(new URLSearchParams(f.location.search).get('afterWrite'), '1');
    assert.equal(f.errors.length, 1); assert.equal(f.toasts[0][1], 'warning');
});

test('missing server company retains the flag and does not resurrect cached data', async () => {
    const f = fixture({missing: true}); await f.init();
    assert.deepEqual(f.reads, [['server', 'users/owner/aziende/company']]);
    assert.equal(f.rendered.length, 0); assert.deepEqual(f.replaced, []);
    assert.equal(new URLSearchParams(f.location.search).get('afterWrite'), '1');
});

test('profile reload after a link mutation bypasses cache even without a URL flag', async () => {
    const f = fixture({afterWrite: false, phone: 'NEW'}); await f.init();
    const offset = f.reads.length; await f.rendered[0].options.reload();
    assert.deepEqual(f.reads.slice(offset), [['server', 'users/owner/aziende/company']]);
    assert.equal(f.rendered.at(-1).data.telefonoAzienda, 'NEW'); assert.equal(f.phoneNode.textContent, 'NEW');
});

test('offline after-write navigation labels cached data as possibly stale and preserves refresh for reconnection', async () => {
    const f = fixture({online: false, phone: 'NEW'}); await f.init();
    assert.deepEqual(f.reads, [['cache', 'users/owner/aziende/company']]);
    assert.equal(f.phoneNode.textContent, 'OLD'); assert.equal(f.toasts[0][1], 'warning');
    assert.deepEqual(f.replaced, []); assert.equal(new URLSearchParams(f.location.search).get('afterWrite'), '1');
    f.navigator.onLine = true; await f.rendered[0].options.reload();
    assert.equal(f.phoneNode.textContent, 'NEW'); assert.equal(f.replaced.length, 1);
});

test('a retained profile reload cannot mix the previous owner with a newly initialized company', async () => {
    const f = fixture({afterWrite: false}); await f.init();
    const oldReload = f.rendered[0].options.reload;
    f.location.search = '?id=next-company'; await f.init('next-owner');
    const offset = f.reads.length;
    await oldReload(); assert.equal(f.reads.length, offset);
    await f.rendered.at(-1).options.reload();
    assert.deepEqual(f.reads.slice(offset), [['server', 'users/next-owner/aziende/next-company']]);
    assert.equal(f.rendered.at(-1).id, 'next-company');
});

test('a failed post-link refresh can retry from the still-visible profile callback', async () => {
    const f = fixture({afterWrite: false, phone: 'NEW'}); await f.init();
    const reload = f.rendered[0].options.reload;
    f.failServer(true); await reload();
    assert.equal(f.phoneNode.textContent, 'OLD'); assert.equal(f.rendered.length, 1);
    f.failServer(false); const offset = f.reads.length; await reload();
    assert.deepEqual(f.reads.slice(offset), [['server', 'users/owner/aziende/company']]);
    assert.equal(f.phoneNode.textContent, 'NEW'); assert.equal(f.rendered.length, 2);
});
