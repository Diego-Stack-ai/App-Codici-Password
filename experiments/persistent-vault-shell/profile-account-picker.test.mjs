import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createProfileAccountPickerReader} from './profile-account-picker-reader.mjs';
import {mountProfileAccountPicker} from './profile-account-picker-view.mjs';
const {filterProfileAccounts} = await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/privato/profile-model.js', import.meta.url))).toString('base64'));
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture() {
    const abort = new AbortController(), calls = [], decoded = [];
    const state = {online: true, uid: 'owner', locked: false,
        personal: [{id: 'same', nomeAccount: 'enc:Telefono', password: 'enc:SECRET', linkedProfileFields: [{type: 'phone', id: 'used'}]}],
        companies: [{id: 'firm', ragioneSociale: 'enc:Società'}],
        accounts: [{id: 'same', nomeAccount: 'enc:Legalmail', password: 'enc:SECRET'}]};
    const repository = {};
    for (const [method, key] of [['listPrivateAccounts', 'personal'], ['listCompanies', 'companies'], ['listCompanyAccounts', 'accounts']]) {
        for (const suffix of ['', 'Confirmed']) repository[method + suffix] = async (...args) => {calls.push([method + suffix, ...args]); return structuredClone(state[key]);};
    }
    const context = {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {if (state.locked) throw Error('LOCKED');},
        async read({ownerId, ciphertext}) {assert.equal(ownerId, 'owner'); assert.notEqual(ciphertext, 'enc:SECRET'); decoded.push(ciphertext); return ciphertext.slice(4);}};
    const read = createProfileAccountPickerReader({context, getUser: () => ({uid: state.uid}), repository, isOnline: () => state.online, isEncryptedValue: value => value.startsWith('enc:')});
    return {state, repository, calls, decoded, context, abort, read};
}
for (const online of [true, false]) test(`picker projects private/company names with ${online ? 'confirmed' : 'cached'} reads and composite identity`, async () => {
    const f = fixture(); f.state.online = online; const rows = await f.read();
    assert.equal(rows.length, 2); assert.equal(new Set(rows.map(row => row.selection.id)).size, 1);
    assert.deepEqual(new Set(rows.map(row => row.name)), new Set(['Telefono', 'Legalmail']));
    assert.ok(rows.every(row => Object.isFrozen(row) && Object.isFrozen(row.selection)));
    assert.ok(f.calls.every(([method, uid]) => method.endsWith('Confirmed') === online && uid === 'owner'));
    assert.ok(!JSON.stringify(rows).includes('SECRET') && !JSON.stringify(rows).includes('linkedProfileFields'));
    assert.equal(filterProfileAccounts(rows, 'societa legalmail').length, 1);
    assert.equal(filterProfileAccounts(rows, '', 'personal').length, 1);
    assert.equal(filterProfileAccounts(rows, '', 'company:firm').length, 1);
});
test('picker omits archived, shared and explicit memo destinations, but keeps linked/banking Accounts', async () => {
    const f = fixture();
    for (const [id, flags] of [['archive', {isArchived: true}], ['shared', {sharedWithUids: ['other']}], ['memo', {isExplicitMemo: true}]]) f.state.personal.push({id, ...flags, nomeAccount: 'enc:SECRET'});
    f.state.personal.push({id: 'bank', isBanking: true, nomeAccount: 'Banca'});
    f.state.companies.push({id: 'old', isArchived: true, ragioneSociale: 'enc:SECRET'});
    assert.equal((await f.read()).length, 3);
    assert.ok(!f.calls.some(call => call[2] === 'old'));
});
test('foreign owner, duplicate scoped IDs and unsupported IDs fail closed', async () => {
    for (const bad of [{id: 'same'}, {id: 'foreign', ownerId: 'other'}, {id: '../bad'}]) {
        const f = fixture(); f.state.personal.push(bad); await assert.rejects(f.read());
    }
    const f = fixture(); f.state.companies[0].ownerId = 'other'; await assert.rejects(f.read(), /OWNER_MISMATCH/);
});
test('changed names and eligibility during decryption invalidate the picker', async () => {
    for (const change of [f => {f.state.accounts[0].nomeAccount = 'new';}, f => {f.state.accounts[0].isArchived = true;}]) {
        const f = fixture(); f.context.read = async ({ciphertext}) => {change(f); return ciphertext.slice(4);};
        await assert.rejects(f.read(), /PICKER_CHANGED/);
    }
});
for (const boundary of ['abort', 'uid', 'lock']) test(`picker discards late decrypted names after ${boundary}`, async () => {
    const f = fixture(); let release; f.context.read = () => new Promise(resolve => {release = resolve;});
    const pending = f.read(); while (!release) await tick();
    if (boundary === 'abort') f.abort.abort(); else if (boundary === 'uid') f.state.uid = 'other'; else f.state.locked = true;
    release('late'); await assert.rejects(pending, /VIEW_DISPOSED|AUTH_CHANGED|LOCKED/);
});
test('failed confirmed read or decrypt cannot expose ciphertext or silently use cache', async () => {
    const f = fixture(); f.repository.listPrivateAccountsConfirmed = async () => {throw Error('network');};
    await assert.rejects(f.read(), /network/); assert.equal(f.calls.length, 0);
    const g = fixture(); g.context.read = async ({ciphertext}) => ciphertext; await assert.rejects(g.read(), /PICKER_INVALID/);
});
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.value = '';}
    setAttribute(key, value) {this.attributes[key] = value;}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    replaceChildren(...nodes) {this.children = []; this.append(...nodes);}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    querySelectorAll(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.querySelectorAll(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const buttons = root => root.querySelectorAll('button').filter(node => node.textContent.includes(' — '));
test('picker search and company filter keep scopes distinct and selection clears retained names', async () => {
    const f = fixture(), root = new Node('root'); let selected;
    await mountProfileAccountPicker(root, f.context, {load: f.read, filterAccounts: filterProfileAccounts, onSelect: value => {selected = value;}, onCancel() {}});
    const original = buttons(root), search = root.querySelectorAll('input')[0], scope = root.querySelectorAll('select')[0];
    assert.equal(search.type, 'search'); search.value = 'societa'; search.dispatchEvent(new Event('input'));
    assert.equal(buttons(root).length, 1); assert.ok(original.every(node => node.textContent === ''));
    original[0].dispatchEvent(new Event('click')); assert.equal(selected, undefined);
    search.value = ''; scope.value = 'personal'; scope.dispatchEvent(new Event('change'));
    assert.equal(buttons(root).length, 1); const retained = buttons(root)[0]; retained.dispatchEvent(new Event('click'));
    assert.deepEqual(selected, {domain: 'private', id: 'same'}); assert.equal(root.children.length, 0);
    assert.equal(retained.textContent, ''); assert.equal(search.value, '');
});
test('picker paginates locally without excluding later matches', async () => {
    const f = fixture(), root = new Node('root');
    const rows = Array.from({length: 75}, (_, i) => ({selection: {domain: 'private', id: 'id' + i}, name: 'Account ' + i, companyId: '', companyName: ''}));
    const cleanup = await mountProfileAccountPicker(root, f.context, {load: async () => rows, filterAccounts: filterProfileAccounts, onSelect() {}, onCancel() {}});
    assert.equal(buttons(root).length, 50);
    root.querySelectorAll('button').find(node => node.textContent === 'Mostra altri').dispatchEvent(new Event('click'));
    assert.equal(buttons(root).length, 75);
    const search = root.querySelectorAll('input')[0]; search.value = '74'; search.dispatchEvent(new Event('input'));
    assert.equal(buttons(root).length, 1); cleanup();
});
test('picker exposes new Account creation with canonical company choices', async () => {
    const f = fixture(), root = new Node('root'); let choices;
    await mountProfileAccountPicker(root, f.context, {load: f.read, filterAccounts: filterProfileAccounts,
        onSelect() {}, onCancel() {}, onCreate: value => { choices = value; }});
    const create = root.querySelectorAll('button').find(node => node.textContent === 'Crea un nuovo Account');
    assert.equal(create.hidden, false); create.dispatchEvent(new Event('click'));
    assert.deepEqual(choices, [{companyId: 'firm', companyName: 'Società'}]); assert.equal(root.children.length, 0);
});
test('late picker load after cancel/abort never renders or replaces the next view', async () => {
    for (const abort of [true, false]) {
        const f = fixture(), root = new Node('root'); let release;
        const pending = mountProfileAccountPicker(root, f.context, {load: () => new Promise(resolve => {release = resolve;}), filterAccounts: filterProfileAccounts, onSelect() {}, onCancel() {}});
        if (abort) f.abort.abort(); else root.querySelectorAll('button').find(node => node.textContent === 'Annulla').dispatchEvent(new Event('click'));
        const next = new Node('next'); root.append(next); release([]); await assert.rejects(pending, /VIEW_DISPOSED/);
        assert.deepEqual(root.children, [next]);
    }
});
