import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const source = async path => (await readFile(new URL('../Frontend/public/assets/js/modules/' + path, import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
function node(props = {}) {
    const classes = new Set();
    return {children: [], value: '', textContent: '', classList: {
        add: name => classes.add(name), remove: name => classes.delete(name), contains: name => classes.has(name),
        toggle(name, force) { if (force ?? !classes.has(name)) classes.add(name); else classes.delete(name); }
    }, ...props};
}
for (const [label, path, renderName] of [
    ['private', 'privato/dettaglio_account_privato.js', 'renderAccount'],
    ['company', 'azienda/dettaglio_account_azienda.js', 'render']
]) {
    test(`${label} compact detail recomputes empty, single and full grids and ignores inactive rendering`, async () => {
        const nodes = Object.fromEntries(['section-notes', 'section-referente', 'detail-note'].map(id => [id, node()]));
        const grid = node(), containers = [node(), node()]; grid.children = containers;
        ['detail-username', 'detail-account'].forEach((id, index) => {
            nodes[id] = node({closest: selector => selector === '.form-grid-2' ? grid : containers[index]});
        });
        const passwordContainer = node();
        nodes['detail-password'] = node({closest: selector => selector === '.glass-field-container' ? passwordContainer : null});
        const realm = vm.createContext({document: {getElementById: id => nodes[id] || null, querySelector: () => null},
            renderAccountBanking() {}, t: () => '', window: {location: {}}, showConfirmModal() {}});
        vm.runInContext(await source(path), realm);
        realm[renderName]({username: 'first', account: 'code', note: 'note', referenteNome: 'name'}, () => true);
        assert.equal(grid.classList.contains('hidden'), false);
        assert.equal(grid.classList.contains('detail-grid-single'), false);
        assert.equal(nodes['section-notes'].classList.contains('hidden'), false);
        realm[renderName]({password: '   '}, () => true);
        assert.equal(nodes['detail-password'].value, '   ');
        assert.equal(passwordContainer.classList.contains('hidden'), false);
        realm[renderName]({username: 'only'}, () => true);
        assert.equal(grid.classList.contains('detail-grid-single'), true);
        assert.equal(containers[1].classList.contains('hidden'), true);
        assert.equal(nodes['section-notes'].classList.contains('hidden'), true);
        assert.equal(nodes['section-referente'].classList.contains('hidden'), true);
        realm[renderName]({}, () => true);
        assert.equal(grid.classList.contains('hidden'), true);
        realm[renderName]({username: 'late', note: 'late'}, () => false);
        assert.equal(grid.classList.contains('hidden'), true);
        assert.equal(nodes['detail-username'].value, '');
        realm[renderName]({username: 'new', account: 'new-code', note: 'new-note'}, () => true);
        assert.equal(grid.classList.contains('hidden'), false);
        assert.equal(grid.classList.contains('detail-grid-single'), false);
        assert.equal(containers[1].classList.contains('hidden'), false);
        assert.equal(nodes['section-notes'].classList.contains('hidden'), false);
    });
}

function modeRealm(text, contacts) {
    let reads = 0;
    const realm = vm.createContext({auth: {currentUser: {uid: 'owner', email: 'owner@example.invalid'}},
        listContacts: async owner => {reads++; assert.equal(owner, 'owner'); return contacts();}, console: {warn() {}}});
    vm.runInContext(text, realm);
    return {realm, reads: () => reads};
}
test('compact mode keeps address book names without installing editing controls', async () => {
    const f = modeRealm(await source('shared/detail-account-mode.js'), async () => [{email: 'USER@example.invalid', nome: 'Synthetic', cognome: 'Contact'}]);
    const names = await f.realm.loadDetailSharingContactNames({ownerId: 'owner'});
    assert.equal(names.get('user@example.invalid'), 'Synthetic Contact');
});
test('compact mode abandons late contacts after session abort and never reads a received owner address book', async () => {
    let resolve;
    const f = modeRealm(await source('shared/detail-account-mode.js'), () => new Promise(done => {resolve = done;}));
    const abort = new AbortController();
    const pending = f.realm.loadDetailSharingContactNames({ownerId: 'owner', signal: abort.signal});
    abort.abort(); resolve([{email: 'late@example.invalid', nome: 'Late'}]);
    assert.equal(await pending, undefined);
    await f.realm.loadDetailSharingContactNames({ownerId: 'foreign-owner', readOnly: true});
    assert.equal(f.reads(), 1);
});
test('new banking fields retain copy guards and readonly banking hides add action', async () => {
    const created = [], copies = [], nodes = {'section-banking': node(), 'banking-content': node(), 'add-banking-prompt': node()};
    let active = true;
    const realm = vm.createContext({crypto: {randomUUID: () => String(created.length)},
        createElement: (tag, props, children) => {const item = node({tag, ...props, children, prepend() {}}); created.push(item); return item;},
        document: {getElementById: id => nodes[id] || null},
        navigator: {clipboard: {writeText: async value => copies.push(value)}}, showToast() {}, t: () => '',
        hasRealBankingData: () => true, normalizeBankingAccounts: account => account.banking,
        clearElement: item => {item.children = [];}, setChildren: (item, children) => {item.children = children;}});
    vm.runInContext(await source('shared/account-banking-view.js'), realm);
    realm.renderAccountBanking({banking: [{numeroVerde: '800-synthetic', referenteNome: 'Synthetic Contact'}]}, {isReadOnly: true, isActive: () => active});
    assert.equal(nodes['add-banking-prompt'].classList.contains('hidden'), true);
    assert.ok(created.some(item => item.textContent === 'Numero verde'));
    assert.ok(created.some(item => item.textContent === 'Referente banca'));
    const buttons = created.filter(item => item.className?.includes('copy-btn'));
    for (const button of buttons) await button.onclick({stopPropagation() {}});
    assert.deepEqual(copies, ['800-synthetic', 'Synthetic Contact']);
    active = false;
    for (const button of buttons) await button.onclick({stopPropagation() {}});
    assert.equal(copies.length, 2);
});

test('banking view renders the complete IBAN in a responsive single-line value', async () => {
    const created = [], nodes = {
        'section-banking': node(),
        'banking-content': node(),
        'add-banking-prompt': node(),
        'btn-banking-info': node()
    };
    const realm = vm.createContext({
        crypto: {randomUUID: () => 'iban'},
        createElement: (tag, props, children) => { const item = node({tag, ...props, children, prepend() {}}); created.push(item); return item; },
        document: {getElementById: id => nodes[id] || null},
        navigator: {clipboard: {writeText: async () => {}}}, showToast() {}, t: () => '',
        hasRealBankingData: () => true,
        normalizeBankingAccounts: account => account.banking,
        clearElement: item => { item.children = []; }, setChildren: (item, children) => { item.children = children; }
    });
    vm.runInContext(await source('shared/account-banking-view.js'), realm);
    const iban = 'IT60X0542811101000000123456';
    realm.renderAccountBanking({banking: [{iban}]});
    const value = created.find(item => item.className?.includes('field-value-readable'));
    assert.equal(value?.tag, 'span');
    assert.equal(value?.textContent, iban);
    assert.ok(created.some(item => item.className?.includes('glass-field-readable')));
});

test('canonical detail HTML has one ambient glow and notes precede attachments', async () => {
    for (const type of ['privato', 'azienda']) {
        const html = await readFile(new URL(`../Frontend/public/dettaglio_account_${type}.html`, import.meta.url), 'utf8');
        assert.equal((html.match(/class="base-glow(?:\s[^"]*)?"/g) || []).length, 1);
        assert.equal((html.match(/id="section-notes"/g) || []).length, 1);
        assert.ok(html.indexOf('id="section-notes"') < html.indexOf('id="section-attachments"'));
    }
});
