import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProfileTextEditorSource} from './profile-text-editor-source.mjs';
import {mountProfileTextEditor} from './profile-text-editor-view.mjs';
const hash = value => createHash('sha256').update(value).digest('hex');
const tick = () => new Promise(setImmediate);
function fixture(company = false) {
    const state = {uid: 'owner', online: true, locked: false, reads: [], decoded: [],
        record: {ownerId: 'owner', nome: 'ENC:Nome', ragioneSociale: 'ENC:Ditta', note: 'ENC:Nota', contactEmails: [{password: 'ENC:SECRET'}]}};
    const abort = new AbortController(), context = {user: {uid: 'owner'}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');}, async read({ciphertext}) {state.decoded.push(ciphertext); return ciphertext.slice(4);},
        encrypt: async () => Buffer.alloc(48, 42).toString('base64')};
    const read = async (uid, confirmed) => {assert.equal(uid, 'owner'); state.reads.push(confirmed); return structuredClone(state.record);};
    const options = {context, getUser: () => ({uid: state.uid}), isOnline: () => state.online, isEncryptedValue: value => value.startsWith('ENC:'), hash,
        repository: {getUserProfile: uid => read(uid, false), getUserProfileConfirmed: uid => read(uid, true)},
        source: company ? {domain: 'company', companyId: 'company', read} : undefined};
    return {state, abort, context, options, source: createProfileTextEditorSource(options)};
}
for (const company of [false, true]) test(`editor source projects only ${company ? 'company' : 'private'} anagraphic text`, async () => {
    const f = fixture(company), model = await f.source.load();
    assert.equal(model.fields.length, company ? 10 : 5); assert.ok(model.canSave);
    assert.ok(model.fields.some(field => field.key === 'note' && field.value === 'Nota'));
    assert.ok(!f.state.decoded.includes('ENC:SECRET'));
    const request = await f.source.prepare({note: ''}, 'clear');
    assert.equal(request.changes.note, ''); assert.equal(request.target.domain, company ? 'company' : 'private');
    assert.deepEqual(Object.keys(request.changes), ['note']); f.source.dispose();
});
test('offline editor reads cached values but cannot prepare a mutation', async () => {
    const f = fixture(); f.state.online = false;
    assert.equal((await f.source.load()).canSave, false); assert.ok(f.state.reads.every(value => !value));
    await assert.rejects(f.source.prepare({note: 'new'}, 'op')); f.source.dispose();
});
test('changed values during loading or after opening cannot silently become the save basis', async () => {
    const f = fixture(); f.context.read = async ({ciphertext}) => {f.state.record.note = 'changed'; return ciphertext.slice(4);};
    await assert.rejects(f.source.load(), /PROFILE_CHANGED/); f.source.dispose();
    const g = fixture(); await g.source.load(); g.state.record.nome = 'different';
    await assert.rejects(g.source.prepare({note: 'new'}, 'op'), /PROFILE_CHANGED/); g.source.dispose();
});
for (const boundary of ['uid', 'locked', 'abort']) test(`late anagraphic decryption is revoked after ${boundary}`, async () => {
    const f = fixture(); let release; f.context.read = () => new Promise(resolve => {release = resolve;});
    const pending = f.source.load(); await tick();
    if (boundary === 'abort') f.abort.abort(); else f.state[boundary] = boundary === 'uid' ? 'other' : true;
    release('Nome'); await assert.rejects(pending); f.source.dispose();
});

class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.value = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute(key, value) {this.attributes[key] = value;}
    all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const model = canSave => ({canSave, fields: [{key: 'nome', label: 'Nome', value: 'Nome', maxLength: 1000},
    {key: 'note', label: 'Note', value: 'Nota', multiline: true, maxLength: 20000}]});
test('editor sends only changed fields, supports clearing and wipes retained text controls', async () => {
    const root = new Node('root'), abort = new AbortController(); let sent, refreshed = 0;
    const cleanup = await mountProfileTextEditor(root, {signal: abort.signal, assertUnlocked() {}}, {load: async () => model(true),
        onSaved() {refreshed++;}, onCancel() {}, createController: () => ({dispose() {}, save: async value => {sent = value; return {status: 'saved'};}})});
    const input = root.all('input')[0], note = root.all('textarea')[0];
    assert.equal(input.type, 'text'); assert.equal(input.attributes.autocomplete, 'off'); note.value = '';
    root.all('button')[0].dispatchEvent(new Event('click')); await tick();
    assert.deepEqual(sent, {note: ''}); assert.equal(refreshed, 1);
    cleanup(); assert.equal(input.value, ''); assert.equal(note.value, ''); assert.equal(input.defaultValue, ''); assert.equal(root.children.length, 0);
});
test('offline controls remain readable but neither unchanged nor offline clicks send a request', async () => {
    for (const canSave of [true, false]) {
        const root = new Node('root'); let sent = false;
        const cleanup = await mountProfileTextEditor(root, {signal: new AbortController().signal, assertUnlocked() {}}, {load: async () => model(canSave),
            onSaved() {}, onCancel() {}, createController: () => ({dispose() {}, save: async () => {sent = true;}})});
        assert.equal(root.all('input')[0].readOnly, !canSave); root.all('button')[0].dispatchEvent(new Event('click')); await tick();
        assert.equal(sent, false); cleanup();
    }
});
test('late editor load after abort never places anagraphic values in the DOM', async () => {
    const root = new Node('root'), abort = new AbortController(); let release;
    const pending = mountProfileTextEditor(root, {signal: abort.signal, assertUnlocked() {}}, {load: () => new Promise(resolve => {release = resolve;}),
        createController() {throw Error('must not create');}});
    const rejected = assert.rejects(pending); abort.abort(); release(model(true)); await rejected;
    assert.equal(root.children.length, 0);
});
