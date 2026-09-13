import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/shared/account-note-editor.js', import.meta.url), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const gate = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
function fixture() {
    const nodes = [], writes = [], toasts = [], events = new EventTarget();
    class Node {
        constructor(tag, props = {}, children = []) {
            Object.assign(this, props); this.tag = tag; this.children = children; this.events = {};
            const classes = new Set((props.className || '').split(' '));
            this.classList = {add: v => classes.add(v), remove: v => classes.delete(v), contains: v => classes.has(v),
                toggle: (v, on) => on ? classes.add(v) : classes.delete(v)};
            nodes.push(this);
        }
        addEventListener(name, fn) { this.events[name] = fn; }
        remove() { this.removed = true; }
        appendChild(child) { this.children.push(child); }
        focus() { context.document.activeElement = this; }
    }
    const button = new Node('button', {id: 'btn-edit-account-note'});
    const section = new Node('section', {id: 'section-notes'}), text = new Node('p', {id: 'detail-note'});
    const stored = {_encrypted: true, revision: 2, note: '', password: 'preserved'};
    const context = vm.createContext({auth: {currentUser: {uid: 'owner'}}, db: {},
        document: {getElementById: id => nodes.find(n => n.id === id), body: new Node('body')},
        createElement: (...args) => new Node(...args), showToast: (...args) => toasts.push(args),
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        ensureVaultKeyMaterial: async () => 'key', encrypt: async value => value ? `sealed:${value}` : '',
        decrypt: async value => value.replace(/^sealed:/, ''), doc: (_db, ...parts) => parts.join('/'),
        runTransaction: async (_db, callback) => {
            const pending = [];
            await callback({get: async () => ({exists: () => true, data: () => ({...stored})}),
                update: (ref, patch) => pending.push({ref, patch})});
            for (const item of pending) { writes.push(item); Object.assign(stored, item.patch); }
        }
    });
    vm.runInContext(source, context);
    const options = {ownerId: 'owner', accountId: 'account', expectedRevision: 2, expectedNote: '', note: 'new note'};
    const init = (extra = {}) => context.initAccountNoteEditor({account: {...stored, note: ''}, storedNote: stored.note,
        ownerId: 'owner', accountId: 'account', ...extra});
    return {context, nodes, stored, writes, toasts, options, init, button, section, text,
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
        latest: label => nodes.filter(n => n.textContent === label).at(-1),
        input: () => nodes.filter(n => n.tag === 'textarea').at(-1)};
}

test('private and company note patches preserve all other fields and encrypt before write', async () => {
    for (const companyId of [null, 'company']) {
        const f = fixture(), result = await f.context.saveAccountNote({...f.options, companyId});
        assert.equal(f.stored.note, 'sealed:new note'); assert.equal(f.stored.password, 'preserved');
        assert.deepEqual(Object.keys(f.writes[0].patch).sort(), ['note', 'revision', 'updatedAt']);
        assert.equal(f.writes[0].ref, companyId ? 'users/owner/aziende/company/accounts/account' : 'users/owner/accounts/account');
        assert.equal(result.note, 'new note'); assert.equal(result.revision, 3);
    }
});

test('changed revisions or note, archived and legacy accounts cannot be overwritten', async () => {
    for (const change of [{revision: 3}, {note: 'other'}, {isArchived: true}, {_encrypted: false}, {revision: null}]) {
        const f = fixture(); Object.assign(f.stored, change);
        await assert.rejects(f.context.saveAccountNote(f.options)); assert.equal(f.writes.length, 0);
    }
    const f = fixture(); f.context.auth.currentUser.uid = 'other';
    await assert.rejects(f.context.saveAccountNote(f.options), /SESSION_CHANGED/); assert.equal(f.writes.length, 0);
});

test('add edit and erase update the visible note immediately without a page reload', async () => {
    const f = fixture(); f.init();
    assert.equal(f.button.textContent, 'Aggiungi nota'); assert.equal(f.section.classList.contains('hidden'), true);
    for (const value of ['First note', 'Changed note', '']) {
        await f.button.onclick(); f.input().value = value; await f.latest('Salva').onclick();
        assert.equal(f.text.textContent, value); assert.equal(f.section.classList.contains('hidden'), !value);
        assert.equal(f.button.textContent, value ? 'Modifica nota' : 'Aggiungi nota');
        assert.equal(f.input().value, '');
    }
    assert.equal(f.stored.revision, 5); assert.equal(f.toasts.length, 3);
});

test('conflict preserves draft and readonly recipient has no editor action', async () => {
    const f = fixture(); f.init(); await f.button.onclick(); f.input().value = 'Draft'; f.stored.revision++;
    await f.latest('Salva').onclick(); assert.equal(f.input().value, 'Draft');
    assert.equal(f.writes.length, 0); assert.equal(f.toasts.length, 0);
    assert.ok(f.nodes.some(n => n.role === 'status' && /cambiato/.test(n.textContent)));
    f.init({readOnly: true}); assert.equal(f.button.onclick, null); assert.equal(f.input().value, '');
});

test('lock during encryption closes and clears editor and prevents late writes', async () => {
    const f = fixture(); f.init(); await f.button.onclick(); f.input().value = 'Draft';
    const pendingEncryption = gate(); f.context.encrypt = () => pendingEncryption.promise;
    const save = f.latest('Salva').onclick(); await new Promise(setImmediate); f.lock();
    assert.equal(f.input().value, ''); assert.equal(f.button.onclick, null);
    pendingEncryption.resolve('sealed:Draft'); await save;
    assert.equal(f.writes.length, 0); assert.equal(f.toasts.length, 0);
});
