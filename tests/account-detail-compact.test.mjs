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
    test(`${label} compact detail recomputes empty, single and full grids`, async () => {
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
        realm[renderName]({username: 'new', account: 'new-code', note: 'new-note'}, () => true);
        assert.equal(grid.classList.contains('hidden'), false);
        assert.equal(grid.classList.contains('detail-grid-single'), false);
        assert.equal(containers[1].classList.contains('hidden'), false);
        assert.equal(nodes['section-notes'].classList.contains('hidden'), false);
    });
}

function modeRealm(text, contacts) {
    const nodes = Object.fromEntries(['account-mode-section','account-mode-options','account-mode-contacts','account-mode-contact-list','btn-save-account-mode'].map(id => [id, node({onclick: () => {throw Error('retained editing');}})]));
    let reads = 0;
    const realm = vm.createContext({document: {getElementById: id => nodes[id]}, showConfirmModal() {},
        clearElement: item => {item.children = [];}, listContacts: async owner => {reads++; assert.equal(owner, 'owner'); return contacts();},
        accountModeFromRecord: () => 'account-private', console: {warn() {}}});
    vm.runInContext(text, realm);
    return {realm, nodes, reads: () => reads};
}
test('compact mode keeps address book names without installing editing controls', async () => {
    const f = modeRealm(await source('shared/detail-account-mode.js'), async () => [{email: 'USER@example.invalid', nome: 'Synthetic', cognome: 'Contact'}]);
    const names = await f.realm.initDetailAccountMode({account: {}, ownerId: 'owner', compactView: true});
    assert.equal(names.get('user@example.invalid'), 'Synthetic Contact');
    assert.equal(f.nodes['account-mode-section'].classList.contains('hidden'), true);
    assert.equal(f.nodes['btn-save-account-mode'].onclick, null);
    assert.equal(f.nodes['account-mode-options'].children.length, 0);
});
test('readonly compact mode never reads a received owner address book', async () => {
    const f = modeRealm(await source('shared/detail-account-mode.js'), async () => {throw Error('unauthorized address book read');});
    await f.realm.initDetailAccountMode({account: {}, ownerId: 'foreign-owner', compactView: true, readOnly: true});
    assert.equal(f.reads(), 0);
    assert.equal(f.nodes['account-mode-section'].classList.contains('hidden'), true);
    assert.equal(f.nodes['btn-save-account-mode'].onclick, null);
});
test('canonical detail HTML has one ambient glow and notes precede attachments', async () => {
    for (const type of ['privato', 'azienda']) {
        const html = await readFile(new URL(`../Frontend/public/dettaglio_account_${type}.html`, import.meta.url), 'utf8');
        assert.equal((html.match(/class="base-glow(?:\s[^"]*)?"/g) || []).length, 1);
        assert.equal((html.match(/id="section-notes"/g) || []).length, 1);
        assert.ok(html.indexOf('id="section-notes"') < html.indexOf('id="section-attachments"'));
    }
});