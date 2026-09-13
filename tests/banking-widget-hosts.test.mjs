import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = async name => (await readFile(new URL('../Frontend/public/assets/js/modules/shared/' + name, import.meta.url),'utf8')).replace(/^import[\s\S]*?;\r?\n/gm,'').replace(/^export /gm,'');
function node(tag = 'div', props = {}, children = []) {
    const n = {tag, ...props, children: children.filter(Boolean), appendChild(child) {
        if (child.parent) child.parent.children = child.parent.children.filter(item => item !== child);
        this.children.push(child); child.parent = this;
    }};
    for (const child of n.children) child.parent = n;
    return n;
}
const descendants = n => [n, ...n.children.flatMap(descendants)];

test('bank identities survive reorder and collapse, and each plus targets its own bank', async () => {
    const container = node(), calls = [], draft = node('input', {value: 'unsaved draft'});
    let sequence = 0, mounts = 0;
    const realm = vm.createContext({crypto: {randomUUID: () => `bank-${++sequence}`},
        document: {getElementById: () => container}, createElement: node, clearElement: n => {n.children = [];},
        showConfirmModal: async () => false, t: () => ''});
    vm.runInContext(await source('banking-model.js'), realm);
    vm.runInContext(await source('banking-renderer.js'), realm);
    const banks = [{iban: 'first'}, {bankId: 'saved-bank', iban: 'second'}];
    const render = () => realm.renderBankAccounts(banks, render, {
        onAddWidget: id => calls.push(id), onWidgetsMount: () => {
            mounts++;
            const host = descendants(container).find(n => n.dataset?.bankWidgetId === 'saved-bank');
            assert.ok(host); host.appendChild(draft);
        }
    });
    render();
    assert.equal(banks[0].bankId, 'bank-1');
    const order = descendants(container.children[0]);
    assert.ok(order.findIndex(n => n.dataset?.bankWidgetId) < order.findIndex(n => n.className === 'bank-cards-section'));
    const plus = descendants(container).filter(n => n['aria-label'] === 'Aggiungi Widget');
    plus.forEach(button => button.onclick());
    assert.deepEqual(calls, ['bank-1', 'saved-bank']);
    banks.reverse(); banks[0]._isOpen = false; render();
    const collapsedHost = descendants(container).find(n => n.dataset?.bankWidgetId === 'saved-bank');
    assert.match(collapsedHost.className, /hidden/);
    assert.equal(collapsedHost.children[0], draft);
    assert.equal(draft.value, 'unsaved draft');
    banks[0]._isOpen = true; render();
    assert.equal(sequence, 1); assert.equal(mounts, 3);
    assert.equal(descendants(container).find(n => n.dataset?.bankWidgetId === 'saved-bank').children[0], draft);
});

test('detail creates widget-only bank hosts without treating a bank identity as financial data', async () => {
    const content = node(), visibility = new Map();
    const section = {classList: {toggle: (name, value) => visibility.set(name,value)}};
    const realm = vm.createContext({crypto: {randomUUID: () => 'field'}, createElement: node,
        document: {getElementById: id => id === 'banking-content' ? content : id === 'section-banking' ? section : null},
        clearElement: n => {n.children = [];}, setChildren: (n, children) => {n.children = children;}, t: () => ''});
    vm.runInContext(await source('banking-model.js'), realm);
    vm.runInContext(await source('account-banking-view.js'), realm);
    const account = {banking: [{bankId: 'saved-only'}]};
    assert.equal(realm.hasRealBankingData(account), false);
    realm.renderAccountBanking(account);
    assert.equal(visibility.get('hidden'), true);
    assert.ok(descendants(content).some(n => n.dataset?.bankWidgetId === 'saved-only'));
    realm.renderAccountBanking({banking: [{bankId: 'bank', iban: 'synthetic', cards: [{cardType: 'synthetic'}]}]});
    const order = descendants(content);
    assert.ok(order.findIndex(n => n.dataset?.bankWidgetId) < order.findIndex(n => n.className === 'bank-cards-section'));
});

test('deleting a bank blocks only its own widgets and rechecks after confirmation', async () => {
    const container = node(), notices = []; let confirmations = 0, duringConfirmation = () => {};
    const realm = vm.createContext({crypto: {randomUUID: () => 'unused'}, document: {getElementById: () => container},
        createElement: node, clearElement: n => {n.children = [];}, t: () => '', showToast: message => notices.push(message),
        showConfirmModal: async () => {confirmations++; duringConfirmation(); return true;}});
    vm.runInContext(await source('banking-model.js'), realm);
    vm.runInContext(await source('banking-renderer.js'), realm);
    const banks = [{bankId: 'occupied'}, {bankId: 'empty'}];
    const render = () => realm.renderBankAccounts(banks, render, {onWidgetsMount: () => {
        const host = descendants(container).find(n => n.dataset?.bankWidgetId === 'occupied');
        host?.appendChild(node('article'));
    }});
    render();
    const buttons = () => descendants(container).filter(n => n.className === 'btn-delete-bank');
    await buttons()[0].onclick({stopPropagation() {}});
    assert.equal(confirmations, 0); assert.equal(banks.length, 2); assert.equal(notices.length, 1);
    duringConfirmation = () => descendants(container).find(n => n.dataset?.bankWidgetId === 'empty').appendChild(node('article'));
    await buttons()[1].onclick({stopPropagation() {}});
    assert.equal(banks.length, 2); assert.equal(notices.length, 2);
    descendants(container).find(n => n.dataset?.bankWidgetId === 'empty').children = [];
    duringConfirmation = () => {};
    await buttons()[1].onclick({stopPropagation() {}});
    assert.equal(banks.length, 1); assert.equal(banks[0].bankId, 'occupied');
});

for (const area of ['privato', 'azienda']) test(`${area} bank plus explains saving first without a widget controller`, async () => {
    const text = await readFile(new URL(`../Frontend/public/assets/js/modules/${area}/form_account_${area}.js`, import.meta.url), 'utf8');
    const start = text.indexOf('onAddWidget: bankId => {') + 'onAddWidget: '.length;
    const end = text.indexOf('onWidgetsMount:', start);
    assert.ok(start >= 'onAddWidget: '.length && end > start);
    const callback = text.slice(start, end).trim().replace(/,$/, '');
    const messages = [], ids = [];
    const realm = vm.createContext({accountWidgetController: null, active: () => true, showToast: message => messages.push(message)});
    const options = {onAddWidget: vm.runInContext('(' + callback + ')', realm)};
    options.onAddWidget('bank'); assert.match(messages[0], /Salva prima/);
    realm.accountWidgetController = {openNewWidget: id => ids.push(id)};
    options.onAddWidget('bank'); assert.deepEqual(ids, ['bank']);
});
