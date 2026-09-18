import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAccountNoteEditorSource} from './account-note-editor-source.mjs';
import {mountAccountNoteEditorProvider} from './account-note-editor-provider.mjs';
const hash = value => createHash('sha256').update(value).digest('hex'), cipher = Buffer.alloc(48, 42).toString('base64');
const tick = () => new Promise(resolve => setImmediate(resolve));
function fixture(company = false) {
    const abort = new AbortController(), calls = [], decoded = [];
    const state = {uid: 'owner', online: true, locked: false, pending: false, record: {id: 'account', ownerId: 'owner', note: 'enc:Nota',
        revision: 3, schemaVersion: 1, password: 'enc:SECRET', linkedProfileFields: [{type: 'phone', id: 'mobile'}], _profileLinkRevision: 2}, parent: {id: 'firm', ownerId: 'owner'}};
    const account = company ? {domain: 'company', companyId: 'firm', id: 'account'} : {domain: 'private', id: 'account'};
    const repository = {};
    for (const method of ['getPrivateAccount', 'getCompanyAccount', 'getCompany']) for (const suffix of ['', 'Confirmed']) {
        repository[method + suffix] = async (...args) => {calls.push([method + suffix, ...args]); return structuredClone(method === 'getCompany' ? state.parent : state.record);};
    }
    const context = {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {if (state.locked) throw Error('LOCKED');},
        async read({ciphertext}) {assert.equal(ciphertext, 'enc:Nota'); decoded.push(ciphertext); return 'Nota';}, encrypt: async () => cipher};
    const options = {context, getUser: () => ({uid: state.uid}), repository, account, hash, isEncryptedValue: value => value.startsWith('enc:'), isOnline: () => state.online,
        submit: async request => ({status: 'confirmed', revision: request.expectedRevision + 1}), assertNoPendingMutation: async scope => {
            assert.equal(scope.uid, 'owner'); assert.deepEqual(scope.account, account); return !state.pending;}, onSaved() {}, onCancel() {}};
    return {context, options, calls, decoded, state, abort, source: createAccountNoteEditorSource(options)};
}
for (const company of [false, true]) test(`note editor ${company ? 'company' : 'private'} reads only note and prepares clearing with references intact`, async () => {
    const f = fixture(company), before = structuredClone(f.state.record), model = await f.source.load();
    assert.equal(model.fields[0].value, 'Nota'); assert.ok(f.calls.every(call => call[0].endsWith('Confirmed') && call[1] === 'owner'));
    const request = await f.source.prepare('', 'op'); assert.equal(request.note, ''); assert.equal(request.expectedOwnerUid, 'owner');
    assert.deepEqual(f.state.record, before); assert.doesNotMatch(JSON.stringify(request), /SECRET|linkedProfileFields|_profileLinkRevision/);
    f.source.dispose(); await assert.rejects(f.source.load(), /VIEW_DISPOSED/);
});
test('offline note is readable, never prepared; disconnect during encryption also rejects', async () => {
    const f = fixture(); f.state.online = false;
    assert.equal((await f.source.load()).canSave, false); assert.ok(f.calls.every(call => !call[0].endsWith('Confirmed')));
    await assert.rejects(f.source.prepare('new', 'op'), /SAVE_UNAVAILABLE/);
    f.state.online = true; await f.source.load(); f.context.encrypt = async () => {f.state.online = false; return cipher;};
    await assert.rejects(f.source.prepare('new', 'op'), /SAVE_UNAVAILABLE/);
});
test('changed note/revision or archived company fails before preparing', async () => {
    for (const mutate of [f => {f.state.record.note = 'changed';}, f => {f.state.record.revision++;}, f => {f.state.parent.isArchived = true;}]) {
        const f = fixture(true); await f.source.load(); mutate(f); await assert.rejects(f.source.prepare('new', 'op'));
    }
    const f = fixture(); f.context.read = async () => {f.state.record.note = 'changed'; return 'Nota';};
    await assert.rejects(f.source.load(), /NOTE_CHANGED/);
});
test('late decrypted notes cannot survive UID change, lock or abort', async () => {
    for (const revoke of [f => f.abort.abort(), f => {f.state.uid = 'other';}, f => {f.state.locked = true;}]) {
        const f = fixture(); f.context.read = async () => {revoke(f); return 'late';}; await assert.rejects(f.source.load());
    }
});
test('a new load while encryption is pending invalidates the earlier preparation', async () => {
    const f = fixture(); await f.source.load(); let release;
    f.context.encrypt = () => new Promise(resolve => {release = resolve;});
    const pending = f.source.prepare('new', 'op'); while (!release) await tick();
    await f.source.load(); release(cipher); await assert.rejects(pending, /NOTE_CHANGED/);
});
test('provider requires explicit queue clearance on open and again before saving', async () => {
    for (const evidence of [false, undefined]) {
        const f = fixture(); let mounted = false;
        await assert.rejects(mountAccountNoteEditorProvider({}, f.context, {...f.options, assertNoPendingMutation: async () => evidence, mountEditor() {mounted = true;}}), /PENDING_MUTATION/);
        assert.equal(mounted, false);
    }
    const f = fixture(); let controller, sent = false;
    const cleanup = await mountAccountNoteEditorProvider({}, f.context, {...f.options, submit: async () => {sent = true;},
        mountEditor: async (root, context, options) => {await options.load(); controller = options.createController({onState() {}}); return () => controller.dispose();}});
    f.state.pending = true; assert.equal((await controller.save({note: 'new'})).status, 'invalid'); assert.equal(sent, false); cleanup();
});
test('unknown outcome retries the same note request; success callback clears provider', async () => {
    const f = fixture(); let controller, callbacks, disposed = false, refreshed = 0; const requests = [];
    const cleanup = await mountAccountNoteEditorProvider({}, f.context, {...f.options, onSaved() {refreshed++;},
        submit: async request => {requests.push(request); if (requests.length === 1) throw Error('lost response'); return {status: 'confirmed', revision: 4};},
        mountEditor: async (root, context, options) => {callbacks = options; await options.load(); controller = options.createController({onState() {}}); return () => {disposed = true; controller.dispose();};}});
    assert.equal((await controller.save({note: 'new'})).status, 'unknown');
    assert.equal((await controller.retry()).status, 'saved'); assert.equal(requests[0], requests[1]);
    await callbacks.onSaved(); assert.equal(refreshed, 1); assert.equal(disposed, true); cleanup();
});
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = ''; this.value = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute(key, value) {this.attributes[key] = value;}
    all(tag) {return this.children.flatMap(node => [...(node.tag === tag ? [node] : []), ...node.all(tag)]);}
}
globalThis.document = {createElement: tag => new Node(tag)};
test('note provider uses text area and note labels, clears text before confirmed refresh', async () => {
    const f = fixture(), root = new Node('root'); let refresh = false, sent;
    const cleanup = await mountAccountNoteEditorProvider(root, f.context, {...f.options, onSaved() {assert.equal(root.children.length, 0); refresh = true;},
        submit: async request => {sent = request; return {status: 'confirmed', revision: 4};}});
    const area = root.all('textarea')[0]; assert.equal(area.attributes.autocomplete, 'off'); area.value = '';
    root.all('button').find(node => node.textContent === 'Salva nota').dispatchEvent(new Event('click')); await tick();
    assert.equal(sent.note, ''); assert.equal(refresh, true); assert.equal(area.value, ''); assert.equal(area.defaultValue, ''); cleanup();
});
test('offline note editor is read-only and cancel clears retained text', async () => {
    const f = fixture(), root = new Node('root'); f.state.online = false; let cancelled = false, sent = false;
    await mountAccountNoteEditorProvider(root, f.context, {...f.options, onCancel() {cancelled = true;}, submit: async () => {sent = true;}});
    const area = root.all('textarea')[0], save = root.all('button').find(node => node.textContent === 'Salva nota');
    assert.equal(area.readOnly, true); assert.equal(save.disabled, true);
    save.dispatchEvent(new Event('click')); await tick(); assert.equal(sent, false);
    root.all('button').find(node => node.textContent === 'Annulla').dispatchEvent(new Event('click'));
    assert.equal(cancelled, true); assert.equal(area.value, ''); assert.equal(root.children.length, 0);
});
