import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createProfileContactsEditorSource} from './profile-contacts-editor-source.mjs';
import {mountProfileContactsEditor} from './profile-contacts-editor-view.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => `${Buffer.alloc(48, 42).toString('base64')}${Buffer.from(String(value)).toString('base64')}`;
const tick = () => new Promise(setImmediate);
const record = () => ({ownerId: 'owner', _profileContactsRevision: 3,
    contactEmails: [
        {id: 'email-home', label: 'Casa', address: 'ENC:a@example.invalid', note: 'ENC:nota', password: 'ENC:segreta', legacyFlag: 'keep'},
        {label: 'Senza id', address: 'ENC:no-id@example.invalid'}],
    contactPhones: [
        {id: 'phone-mobile', label: 'Cellulare', number: 'ENC:3330000000', linkedAccountId: 'account'},
        {id: 'phone-other', label: '', number: 'ENC:3331111111'}]});
function fixture({selection = {emails: ['email-home'], phones: [0]}, failSelection = false} = {}) {
    const abort = new AbortController(), state = {uid: 'owner', online: true, locked: false, reads: [], decoded: [], record: record()};
    const context = {user: {uid: 'owner'}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');},
        async read({ciphertext}) {state.decoded.push(ciphertext); return ciphertext.slice(4);},
        async encrypt(value) {return cipher(value);}};
    const read = async (uid, confirmed) => {assert.equal(uid, 'owner'); state.reads.push(confirmed); return structuredClone(state.record);};
    const options = {context, getUser: () => ({uid: state.uid}), isEncryptedValue: value => value.startsWith('ENC:'), hash,
        createId: prefix => `${prefix}-generato`, isOnline: () => state.online,
        repository: {getUserProfile: uid => read(uid, false), getUserProfileConfirmed: uid => read(uid, true),
            getUserSetting: async () => {if (failSelection) throw Error('SETTING_UNAVAILABLE'); return selection;}}};
    return {state, abort, context, options, source: createProfileContactsEditorSource(options)};
}
test('the source projects labels, id presence, links and the QR selection', async () => {
    const f = fixture(), model = await f.source.load();
    assert.equal(model.canSave, true); assert.equal(model.revision, 3);
    assert.equal(model.rows.length, 4);
    const [home, without, mobile, other] = model.rows;
    assert.equal(home.id, 'email-home'); assert.equal(home.editable, true); assert.equal(home.blocked, null);
    assert.equal(home.fields.find(field => field.key === 'address').value, 'a@example.invalid');
    assert.equal(home.fields.find(field => field.key === 'password').secret, true);
    assert.equal(without.editable, false); assert.equal(without.blocked, 'CONTACT_ID_MISSING'); assert.equal(without.id, null);
    assert.equal(mobile.linked, true); assert.equal(mobile.qr, true);
    assert.equal(other.qr, false, 'a legacy position resolves to its own row, not to every row');
    assert.equal(home.qr, true);
    assert.equal(model.templates.contactPhones.length, 2);
    assert.ok(!f.state.decoded.includes('nota'), 'secrets are never read raw');
    assert.equal(f.source.createId('contactEmails'), 'email-generato');
    assert.equal(f.source.createId('contactPhones'), 'phone-generato');
    assert.throws(() => f.source.createId('userAddresses'), /PROFILE_CONTACTS_INVALID/);
    f.source.dispose();
});
test('an absent QR document allows deletion while an unverifiable protection never does', async () => {
    const absent = fixture({selection: null}), absentModel = await absent.source.load();
    assert.ok(absentModel.rows.every(row => row.qr === false));
    absent.source.dispose();
    for (const [name, selection] of [
        ['emails with the wrong type', {emails: 'email-home', phones: []}],
        ['phones with the wrong type', {emails: [], phones: {}}],
        ['a reference to a non-existent id', {emails: ['email-missing'], phones: []}],
        ['duplicate references', {emails: ['email-home', 'email-home'], phones: []}],
        ['an unresolvable legacy index', {emails: [], phones: [7]}],
        ['a negative legacy index', {emails: [], phones: [-1]}],
        ['an unsupported schema version', {emails: [], phones: [], _qrSchemaVersion: 2}],
        ['a foreign transport id', {emails: [], phones: [], id: 'otherSetting'}],
        ['a configuration that is not an object', 'not-an-object']]) {
        const f = fixture({selection}), model = await f.source.load();
        assert.ok(model.rows.every(row => row.qr === 'unverified'), name);
        assert.equal(model.canSave, true, `${name}: consultation and editing stay available`);
        f.source.dispose();
    }
    const failing = fixture({failSelection: true}), failingModel = await failing.source.load();
    assert.ok(failingModel.rows.every(row => row.qr === 'unverified'), 'a read failure never allows deletion');
    assert.equal(failingModel.canSave, true);
    failing.source.dispose();
});
test('offline contacts stay readable but cannot be prepared', async () => {
    const f = fixture(); f.state.online = false;
    const model = await f.source.load();
    assert.equal(model.canSave, false);
    assert.ok(f.state.reads.every(confirmed => confirmed === false));
    await assert.rejects(f.source.prepare({deletes: [{collection: 'contactPhones', id: 'phone-other'}]}, 'op'), /PROFILE_SAVE_UNAVAILABLE/);
    f.source.dispose();
});
test('changes during or after loading invalidate the save basis', async () => {
    const f = fixture();
    f.context.read = async ({ciphertext}) => {f.state.record.contactEmails[0].label = 'cambiata'; return ciphertext.slice(4);};
    await assert.rejects(f.source.load(), /PROFILE_CHANGED/);
    const g = fixture(); await g.source.load();
    g.state.record.contactPhones[1].number = 'ENC:cambiato';
    await assert.rejects(g.source.prepare({deletes: [{collection: 'contactPhones', id: 'phone-other'}]}, 'op'), /PROFILE_CHANGED/);
    g.source.dispose();
});
for (const boundary of ['uid', 'locked', 'abort']) test(`late decryption is revoked after ${boundary}`, async () => {
    const f = fixture();
    let release;
    f.context.read = () => new Promise(resolve => {release = resolve;});
    const pending = f.source.load();
    await tick();
    if (boundary === 'abort') f.abort.abort(); else f.state[boundary] = boundary === 'uid' ? 'other' : true;
    release('Nome');
    await assert.rejects(pending);
    f.source.dispose();
});
test('prepare encrypts only the stored cipher fields and keeps the row basis', async () => {
    const f = fixture();
    await f.source.load();
    const request = await f.source.prepare({
        creates: [{collection: 'contactEmails', id: 'email-nuovo', fields: {label: 'Nuova', address: 'n@example.invalid', note: 'nota nuova'}}],
        updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Ufficio', number: '3330000000'}}],
        deletes: [{collection: 'contactPhones', id: 'phone-other'}]}, 'operazione');
    assert.equal(request.operations.length, 3);
    const [create, update, remove] = request.operations;
    assert.equal(create.fields.note, cipher('nota nuova'));
    assert.equal(create.fields.address, 'n@example.invalid');
    assert.deepEqual(Object.keys(update.fields), ['label'], 'an unchanged number is never re-encrypted');
    assert.equal(remove.kind, 'delete'); assert.equal(remove.basis.length, 64);
    const g = fixture(); await g.source.load();
    await assert.rejects(g.source.prepare({updates: [{collection: 'contactPhones', id: 'phone-mobile', fields: {label: 'Cellulare'}}]}, 'op'),
        /PROFILE_CONTACTS_UNCHANGED/);
    g.source.dispose();
    f.source.dispose();
});
test('a disposed source cannot prepare or load again', async () => {
    const f = fixture();
    await f.source.load();
    f.source.dispose();
    await assert.rejects(f.source.load(), /VIEW_DISPOSED/);
});

class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = '';
        this.value = ''; this.defaultValue = ''; this.hidden = false; this.disabled = false; this.readOnly = false; this.type = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute(key, value) {this.attributes[key] = value;}
}
globalThis.document = {createElement: tag => new Node(tag)};
const walk = node => [node, ...node.children.flatMap(child => walk(child))];
const byAction = (root, action) => walk(root).filter(node => node.dataset?.contactAction === action);
const byField = (root, key) => walk(root).find(node => node.dataset?.contactField === key);
const byAdd = (root, collection) => walk(root).find(node => node.dataset?.contactAdd === collection);
const rows = root => walk(root).filter(node => node.dataset?.contactRow === 'true');
const status = root => walk(root).find(node => node.dataset?.contactStatus === 'true');
const model = canSave => ({canSave, rows: [
    {collection: 'contactEmails', id: 'email-home', editable: true, blocked: null, linked: false, qr: false, fields: [
        {key: 'label', label: 'Etichetta', value: 'Casa', maxLength: 120},
        {key: 'address', label: 'Indirizzo email', value: 'a@example.invalid', maxLength: 320},
        {key: 'note', label: 'Note', value: '', maxLength: 20000, multiline: true},
        {key: 'password', label: 'Password', value: '', maxLength: 1000, secret: true}]},
    {collection: 'contactPhones', id: null, editable: false, blocked: 'CONTACT_ID_MISSING', linked: false, qr: null, fields: [
        {key: 'label', label: 'Etichetta', value: '', maxLength: 120},
        {key: 'number', label: 'Numero', value: '3330000000', maxLength: 120}]},
    {collection: 'contactPhones', id: 'phone-linked', editable: true, blocked: null, linked: true, qr: false, fields: [
        {key: 'label', label: 'Etichetta', value: 'Ufficio', maxLength: 120},
        {key: 'number', label: 'Numero', value: '3339999999', maxLength: 120}]}],
    templates: {contactEmails: [{key: 'label', label: 'Etichetta', maxLength: 120},
        {key: 'address', label: 'Indirizzo email', maxLength: 320},
        {key: 'note', label: 'Note', maxLength: 20000, multiline: true},
        {key: 'password', label: 'Password', maxLength: 1000, secret: true}],
    contactPhones: [{key: 'label', label: 'Etichetta', maxLength: 120}, {key: 'number', label: 'Numero', maxLength: 120}]}});
const mount = (root, options = {}) => mountProfileContactsEditor(root, {signal: options.signal ?? new AbortController().signal, assertUnlocked() {}}, {
    load: options.load ?? (async () => options.model ?? model(options.canSave ?? true)), createId: () => 'email-fixed',
    onSaved: options.onSaved ?? (() => {}), onCancel: options.onCancel ?? (() => {}),
    createController: options.createController ?? (() => ({dispose() {}, save: async draft => {options.sent = draft; return {status: 'saved'};}}))});
test('an unverifiable QR protection disables every deletion but keeps the fields editable', async () => {
    const unverified = model(true);
    unverified.rows = unverified.rows.map(row => ({...row, qr: 'unverified'}));
    const root = new Node('root'), options = {model: unverified};
    await mount(root, options);
    const removeButtons = byAction(root, 'delete');
    assert.equal(removeButtons.length, 3);
    assert.ok(removeButtons.every(node => node.disabled), 'no deletion survives an unverifiable protection');
    for (const row of rows(root)) {
        const message = row.children.find(node => node.dataset.contactMessage === 'true');
        assert.ok(message.textContent.length > 0, 'every row explains its blocked deletion');
        if (row.dataset.contactId !== '') assert.match(message.textContent, /Selezione QR non verificabile/);
        else assert.match(message.textContent, /senza ID persistito/);
    }
    assert.equal(byField(rows(root)[0], 'address').readOnly, false, 'editing stays available');
    assert.equal(byAction(root, 'save')[0].disabled, false);
    byAdd(root, 'contactPhones').dispatchEvent(new Event('click'));
    const created = rows(root).at(-1);
    assert.equal(created.children.find(node => node.dataset.contactAction === 'delete').disabled, false,
        'a new row can still be removed before it is saved');
    assert.equal(byField(created, 'number').readOnly, false);
});
test('the editor shows every row, blocks the ones it cannot write and sends only the changes', async () => {
    const root = new Node('root'), options = {};
    const cleanup = await mount(root, options);
    assert.equal(rows(root).length, 3);
    const withoutId = rows(root).find(row => row.dataset.contactCollection === 'contactPhones' && row.dataset.contactId === '');
    assert.ok(withoutId);
    const message = withoutId.children.find(node => node.dataset.contactMessage === 'true');
    assert.match(message.textContent, /senza ID persistito/);
    const removeButtons = byAction(root, 'delete');
    assert.equal(removeButtons[1].disabled, true, 'a row without an ID cannot be deleted');
    assert.equal(removeButtons[2].disabled, true, 'a linked row cannot be deleted');
    assert.match(message.textContent, /migrazione separata/);
    assert.match(rows(root)[2].children.find(node => node.dataset.contactMessage === 'true').textContent, /Collegato a un Account/);
    byField(rows(root)[0], 'address').value = 'nuova@example.invalid';
    byAction(root, 'save')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.deepEqual(options.sent, {creates: [], updates: [{collection: 'contactEmails', id: 'email-home', fields: {address: 'nuova@example.invalid'}}], deletes: []});
    cleanup();
});
test('a new row takes a generated prefixed ID and an unfilled row is refused', async () => {
    const root = new Node('root'), options = {};
    await mount(root, options);
    byAdd(root, 'contactEmails').dispatchEvent(new Event('click'));
    const created = rows(root).at(-1);
    assert.equal(created.dataset.contactNew, 'true'); assert.equal(created.dataset.contactId, 'email-fixed');
    byAction(root, 'save')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.equal(options.sent, undefined);
    assert.match(status(root).textContent, /Compila almeno un campo/);
    byField(created, 'address').value = 'n@example.invalid';
    byField(created, 'note').value = 'nota';
    byAction(root, 'save')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.deepEqual(options.sent.creates, [{collection: 'contactEmails', id: 'email-fixed', fields: {address: 'n@example.invalid', note: 'nota'}}]);
});
test('deletion needs a second confirmation and disappears from the visible rows', async () => {
    const root = new Node('root'), options = {};
    await mount(root, options);
    const home = rows(root)[0], remove = byAction(root, 'delete')[0];
    remove.dispatchEvent(new Event('click'));
    assert.equal(home.hidden, false); assert.equal(remove.textContent, 'Conferma eliminazione');
    remove.dispatchEvent(new Event('click'));
    assert.equal(home.hidden, true);
    assert.match(home.children.find(node => node.dataset.contactMessage === 'true').textContent, /salva per confermare/);
    byAction(root, 'save')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.deepEqual(options.sent.deletes, [{collection: 'contactEmails', id: 'email-home'}]);
    assert.deepEqual(options.sent.updates, []);
});
test('offline contacts are readable but nothing is sent and the status explains why', async () => {
    const root = new Node('root'), options = {canSave: false};
    await mount(root, options);
    assert.equal(byField(rows(root)[0], 'address').readOnly, true);
    assert.equal(byAction(root, 'save')[0].disabled, true);
    assert.equal(byAdd(root, 'contactEmails').disabled, true);
    assert.match(status(root).textContent, /sola consultazione/);
    byAction(root, 'save')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.equal(options.sent, undefined);
});
test('a failed confirmed refresh is reported without repeating the write', async () => {
    const root = new Node('root'), options = {onSaved: () => {throw Error('refresh');}};
    await mount(root, options);
    byField(rows(root)[0], 'address').value = 'nuova@example.invalid';
    byAction(root, 'save')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.ok(options.sent);
    assert.match(status(root).textContent, /vista non si è aggiornata/);
});
test('cancel and lock clear every retained control and detach the editor', async () => {
    const root = new Node('root'), abort = new AbortController();
    let cancelled = 0;
    const cleanup = await mount(root, {signal: abort.signal, onCancel: () => {cancelled++;}});
    const input = byField(rows(root)[0], 'address');
    input.value = 'segreto in RAM';
    byAction(root, 'cancel')[0].dispatchEvent(new Event('click'));
    assert.equal(cancelled, 1); assert.equal(input.value, ''); assert.equal(input.defaultValue, '');
    assert.equal(root.children.length, 0);
    const locked = new Node('root'); let controllerDisposed = 0;
    await mount(locked, {signal: abort.signal, createController: () => ({dispose() {controllerDisposed++;}, save: async () => ({status: 'saved'})})});
    abort.abort();
    assert.equal(controllerDisposed, 1);
    assert.equal(locked.children.length, 0);
    cleanup();
});
test('an aborted mount never places contact values in the DOM', async () => {
    const root = new Node('root'), abort = new AbortController();
    let release;
    const pending = mount(root, {signal: abort.signal, load: () => new Promise(resolve => {release = resolve;})});
    const rejected = assert.rejects(pending);
    abort.abort();
    release(model(true));
    await rejected;
    assert.equal(root.children.length, 0);
});
