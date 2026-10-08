import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createProfileLinkEditorSource} from './profile-link-editor-source.mjs';
const models = {};
for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js']) {
    Object.assign(models, await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
}
function fixture(company = false) {
    const abort = new AbortController(), reads = [];
    const state = {uid: 'owner', online: true, hook: null, profile: company
        ? {ownerId: 'owner', id: 'firm', emails: {pec: {email: 'cipher', password: 'secret', linkedAccountId: 'old'}}}
        : {ownerId: 'owner', contactPhones: [{id: 'mobile', number: 'cipher', linkedAccountId: 'old'}]}};
    const source = company ? {domain: 'company', companyId: 'firm', type: 'email', id: 'pec'} : {domain: 'private', type: 'phone', id: 'mobile'};
    const editor = createProfileLinkEditorSource({context: {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {}, read() {throw Error('UNEXPECTED_DECRYPT');}},
        getUser: () => ({uid: state.uid}), source, models, isOnline: () => state.online,
        hash: value => createHash('sha256').update(value).digest('hex'),
        readProfile: async query => {reads.push(query); await state.hook?.(); return structuredClone(state.profile);}});
    return {editor, state, abort, reads, source};
}
for (const company of [false, true]) test(`link source ${company ? 'company' : 'private'} captures immutable request without plaintext`, async () => {
    const f = fixture(company), loaded = await f.editor.load();
    assert.deepEqual(loaded.account, {domain: 'private', id: 'old'});
    const target = {domain: 'company', companyId: 'other', id: 'next'};
    const request = await f.editor.prepare(target, 'op'); target.id = 'changed';
    assert.equal(request.account.id, 'next'); assert.equal(request.expectedRevision, 0);
    assert.ok(Object.isFrozen(request) && Object.isFrozen(request.account));
    assert.ok(!JSON.stringify(request).includes('secret') && !JSON.stringify(request).includes('cipher'));
    assert.ok(f.reads.every(query => query.uid === 'owner' && query.confirmed));
    assert.equal((await f.editor.prepare(null, 'unlink')).account, null);
    f.editor.dispose(); await assert.rejects(f.editor.load(), /VIEW_DISPOSED/);
});
test('offline can inspect relationship but cannot prepare a write', async () => {
    const f = fixture(); f.state.online = false;
    assert.equal((await f.editor.load()).canSave, false);
    assert.ok(f.reads.every(query => !query.confirmed));
    await assert.rejects(f.editor.prepare(null, 'op'), /SAVE_UNAVAILABLE/);
    f.state.online = true; await f.editor.load();
    f.state.hook = () => {f.state.online = false;};
    await assert.rejects(f.editor.prepare(null, 'op'), /SAVE_UNAVAILABLE/);
});
test('legacy edits without revision and changed revisions invalidate preparation', async () => {
    for (const mutate of [p => {p.contactPhones[0].number = 'new';}, p => {p._profileLinkRevision = 1;}, p => {p.contactPhones[0].linkedAccountId = 'new';}]) {
        const f = fixture(); await f.editor.load(); mutate(f.state.profile);
        await assert.rejects(f.editor.prepare(null, 'op'), /PROFILE_LINK_CHANGED/);
    }
});
test('owner alias, authentication change and abort fail closed', async () => {
    const f = fixture(true); f.state.profile.id = 'wrong';
    await assert.rejects(f.editor.load(), /OWNER_MISMATCH/);
    for (const revoke of [f => {f.state.uid = 'other';}, f => f.abort.abort()]) {
        const g = fixture(); await g.editor.load(); g.state.hook = () => revoke(g);
        await assert.rejects(g.editor.prepare(null, 'op'), /VIEW_DISPOSED/);
    }
});
test('overlapping loads invalidate previous work; incomplete load cannot prepare', async () => {
    const f = fixture(); let release;
    f.state.hook = () => new Promise(resolve => {release = resolve;});
    const first = f.editor.load(); await Promise.resolve();
    await assert.rejects(f.editor.prepare(null, 'op'), /SAVE_UNAVAILABLE/);
    f.state.hook = null; await f.editor.load(); release();
    await assert.rejects(first, /PROFILE_LINK_CHANGED/);
    assert.equal((await f.editor.prepare(null, 'op')).operationId, 'op');
});

// Provider boundaries: no pending Account mutation may be bypassed by linking.
const {mountProfileLinkEditor} = await import('./profile-link-editor-provider.mjs');
class Element extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.textContent = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute() {}
    all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Element(tag)};
const tick = () => new Promise(resolve => setImmediate(resolve));
async function provider(overrides = {}) {
    const f = fixture(), root = new Element('root'), sent = [], checked = [];
    const context = {user: {uid: 'owner'}, signal: f.abort.signal, assertUnlocked() {}};
    const options = {source: f.source, models, getUser: () => ({uid: f.state.uid}), mode: 'unlink',
        readProfile: async () => structuredClone(f.state.profile), hash: value => createHash('sha256').update(value).digest('hex'),
        isOnline: () => f.state.online, assertNoPendingAccount: async account => {checked.push(account); return true;},
        submit: async request => {sent.push(request); return {status: 'confirmed', revision: 1};}, onSaved() {}, onCancel() {}, ...overrides};
    await mountProfileLinkEditor(root, context, options);
    return {...f, root, sent, checked, button: label => root.all('button').find(node => node.textContent === label)};
}
test('link provider checks old and new queues and clears selected labels on success', async () => {
    let picker;
    const f = await provider({mode: 'change', mountPicker: async (root, context, options) => {picker = options; return () => {};}});
    picker.onSelect({domain: 'company', companyId: 'firm', id: 'new'}, {name: 'Selected', companyName: 'Firm'});
    const labels = f.root.all('p');
    f.button('Salva collegamento').dispatchEvent(new Event('click')); await tick();
    assert.deepEqual(f.checked, [{domain: 'private', id: 'old'}, {domain: 'company', companyId: 'firm', id: 'new'}]);
    assert.equal(f.sent.length, 1); assert.equal(f.root.children.length, 0);
    assert.ok(labels.every(node => node.textContent === ''));
});
test('link provider blocks pending old/new queues before submitting', async () => {
    for (const blocked of ['old', 'new']) {
        let picker, sent = false;
        const f = await provider({mode: 'change', mountPicker: async (root, context, options) => {picker = options; return () => {};},
            assertNoPendingAccount: async account => account.id !== blocked, submit: async () => {sent = true;}});
        picker.onSelect({domain: 'private', id: 'new'}, {name: 'New', companyName: ''});
        f.button('Salva collegamento').dispatchEvent(new Event('click')); await tick();
        assert.equal(sent, false); assert.equal(f.button('Salva collegamento').disabled, true); f.abort.abort();
    }
});
test('link provider retries identical request after uncertain result and abort clears view', async () => {
    const requests = [];
    const f = await provider({submit: async request => {requests.push(request); if (requests.length === 1) throw Error('network'); return {status: 'confirmed', revision: 1};}});
    f.button('Conferma scollegamento').dispatchEvent(new Event('click')); await tick();
    assert.equal(f.button('Riprova collegamento').hidden, false);
    f.button('Riprova collegamento').dispatchEvent(new Event('click')); await tick();
    assert.equal(requests[0], requests[1]); assert.equal(f.root.children.length, 0);
    const g = await provider(); g.abort.abort(); assert.equal(g.root.children.length, 0);
});
test('offline link provider never opens picker or submits', async () => {
    let picked = false;
    const f = await provider({isOnline: () => false, mode: 'change', mountPicker: async () => {picked = true;}});
    assert.equal(picked, false); assert.equal(f.button('Salva collegamento').disabled, true);
    f.button('Salva collegamento').dispatchEvent(new Event('click')); await tick(); assert.equal(f.sent.length, 0); f.abort.abort();
});
