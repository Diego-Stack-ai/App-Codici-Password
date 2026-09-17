import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mountCompanyContactsEditorProvider} from './company-contacts-editor-provider.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const cipher = value => `${Buffer.alloc(48, 42).toString('base64')}${Buffer.from(String(value)).toString('base64')}`;
const tick = () => new Promise(setImmediate);
const record = () => ({ownerId: 'owner', id: 'company', _companyContactsRevision: 3,
    aziendaEmail: 'legacy@example.invalid', note: 'ENC:nota',
    emails: {pec: {email: 'ENC:pec@example.invalid', tipo: 'PEC', password: 'ENC:segreta', linkedAccountId: 'account'},
        amministrazione: {email: 'ENC:amm@example.invalid', tipo: 'Amministrazione'},
        personale: {tipo: ''},
        extra: [{id: 'company-email-1', email: 'ENC:a@example.invalid', tipo: 'Ufficio', qr: false},
            {id: 'company-email-2', email: 'ENC:b@example.invalid', tipo: 'Magazzino', qr: true},
            {email: 'ENC:senza@example.invalid', tipo: 'Senza id'}]},
    telefonoAzienda: '0110000000', faxAzienda: '', referenteCellulare: '3330000000'});
function fixture({online = true, qrConfig} = {}) {
    const abort = new AbortController();
    const state = {uid: 'owner', online, locked: false, record: {...record(), ...(qrConfig === undefined ? {} : {qrConfig})},
        submitted: [], decoded: [], response: null, failNext: false, hold: false, release: null};
    const context = {user: {uid: 'owner'}, signal: abort.signal,
        assertUnlocked() {if (state.locked) throw Error('LOCKED');},
        async read({ciphertext}) {state.decoded.push(ciphertext); return ciphertext.startsWith('ENC:') ? ciphertext.slice(4) : ciphertext;},
        async encrypt(value) {return cipher(value);}};
    const company = {domain: 'company', companyId: 'company', async read() {return structuredClone(state.record);}};
    const options = {context, getUser: () => ({uid: state.uid}), source: company, isEncryptedValue: value => String(value).startsWith('ENC:'),
        hash, createId: prefix => `${prefix}-generato`, isOnline: () => state.online,
        submit: async request => {
            state.submitted.push(request);
            if (state.hold) await new Promise(resolve => {state.release = resolve;});
            if (state.failNext) {state.failNext = false; throw Error('NETWORK');}
            return state.response ?? {status: 'confirmed', revision: request.expectedRevision + 1};
        }};
    return {state, abort, context, options};
}
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = '';
        this.value = ''; this.defaultValue = ''; this.checked = false; this.defaultChecked = false; this.hidden = false;
        this.disabled = false; this.readOnly = false; this.type = ''; this.maxLength = 0;}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute(key, value) {this.attributes[key] = value;}
}
globalThis.document = {createElement: tag => new Node(tag)};
const walk = node => [node, ...node.children.flatMap(child => walk(child))];
const byAction = (root, action) => walk(root).filter(node => node.dataset?.companyAction === action);
const rows = root => walk(root).filter(node => node.dataset?.companyRow === 'true');
const rowOf = (root, id) => rows(root).find(row => row.dataset.companyId === id);
const byField = (root, id, key) => {
    const row = rowOf(root, id);
    return row ? walk(row).find(node => node.dataset?.companyField === key) : undefined;
};
const removeOf = (root, id) => rowOf(root, id) && walk(rowOf(root, id)).find(node => node.dataset?.companyAction === 'delete');
const messageOf = (root, id) => rowOf(root, id) && walk(rowOf(root, id)).find(node => node.dataset?.companyMessage === 'true').textContent;
const status = root => walk(root).find(node => node.dataset?.companyStatus === 'true');
const click = async node => {node.dispatchEvent(new Event('click')); await tick();};
async function mount(f = fixture()) {
    const container = new Node('div');
    const cleanup = await mountCompanyContactsEditorProvider(container, f.context,
        {...f.options, onSaved: () => {f.saved = (f.saved ?? 0) + 1;}, onCancel: () => {f.cancelled = true;}});
    return {f, container, cleanup};
}
test('the company editor renders slots, repeatable rows and telephones without converting them', async () => {
    const {container, cleanup} = await mount();
    assert.deepEqual(rows(container).map(row => [row.dataset.companyKind, row.dataset.companyId]),
        [['email-slot', 'pec'], ['email-slot', 'amministrazione'], ['email-slot', 'personale'],
            ['email-extra', 'company-email-1'], ['email-extra', 'company-email-2'], ['email-extra', ''],
            ['phone-slot', 'telefonoAzienda'], ['phone-slot', 'faxAzienda'], ['phone-slot', 'referenteCellulare']]);
    assert.equal(byField(container, 'pec', 'email').value, 'pec@example.invalid');
    assert.equal(byField(container, 'pec', 'password').type, 'password', 'the stored cipher field is a secret input');
    // The label of the row is what tells the fixed slots apart: the schema label
    // wins when the record carries one, otherwise the company label is used.
    assert.deepEqual(rows(container).map(row => walk(row).find(node => node.dataset?.companyLabel === 'true').textContent),
        ['PEC', 'Amministrazione', 'Email personale', 'Ufficio', 'Magazzino', 'Senza id',
            'Telefono azienda', 'Fax', 'Cellulare referente']);
    assert.equal(byField(container, 'pec', 'password').value, 'segreta');
    assert.equal(byField(container, 'telefonoAzienda', 'number').value, '0110000000');
    assert.equal(byField(container, 'company-email-2', 'qr').type, 'checkbox');
    assert.equal(byField(container, 'company-email-2', 'qr').checked, true, 'the published row keeps its own flag');
    assert.equal(byField(container, 'company-email-1', 'qr').checked, false);
    assert.equal(walk(container).some(node => node.value === 'nota'), false, 'the company note is never decrypted by this editor');
    // A fixed slot cannot be deleted: only emptied through its own field.
    assert.equal(removeOf(container, 'pec').disabled, true);
    assert.equal(removeOf(container, 'telefonoAzienda').disabled, true);
    assert.equal(removeOf(container, 'company-email-1').disabled, false);
    assert.equal(removeOf(container, 'company-email-2').disabled, true, 'a row published on the digital card cannot be deleted');
    assert.equal(removeOf(container, '').disabled, true, 'a row without a stable id cannot be deleted');
    assert.match(messageOf(container, ''), /ID persistito/);
    assert.match(messageOf(container, 'pec'), /Collegato a un Account/);
    cleanup();
    assert.equal(container.children.length, 0, 'dispose detaches the editor');
});
test('a changed slot and a changed telephone are saved through one confirmed request', async () => {
    const {f, container, cleanup} = await mount();
    byField(container, 'amministrazione', 'email').value = 'nuova@example.invalid';
    byField(container, 'telefonoAzienda', 'number').value = '0111111111';
    await click(byAction(container, 'save')[0]);
    const [request] = f.state.submitted;
    assert.deepEqual(request.target, {domain: 'company', companyId: 'company'});
    assert.equal(request.expectedRevision, 3);
    assert.deepEqual(request.operations.map(operation => [operation.kind, operation.id]),
        [['email-slot', 'amministrazione'], ['phone-slot', 'telefonoAzienda']]);
    assert.deepEqual(request.operations[0].fields, {email: cipher('nuova@example.invalid')},
        'a field stored in a legacy cipher form keeps that form when it changes');
    assert.equal(request.operations[1].value, '0111111111');
    assert.equal(f.saved, 1);
    assert.equal(status(container).textContent, 'Contatti aziendali salvati.');
    assert.equal(byAction(container, 'retry')[0].hidden, true);
    cleanup();
});
test('a new repeatable row is created with a generated identity and can be discarded locally', async () => {
    const {f, container, cleanup} = await mount();
    await click(byAction(container, 'add')[0]);
    const created = rows(container).at(-1);
    assert.equal(created.dataset.companyId, 'company-email-generato');
    assert.equal(created.dataset.companyNew, 'true');
    // An unsaved row is discarded on the first click: no confirmation, no request.
    await click(removeOf(container, 'company-email-generato'));
    assert.equal(walk(container).includes(created), false, 'the row left the draft');
    assert.equal(byField(container, 'company-email-generato', 'email'), undefined);
    await click(byAction(container, 'save')[0]);
    assert.equal(f.state.submitted.length, 0, 'discarding never reaches the backend');
    assert.equal(status(container).textContent, 'Nessuna modifica da salvare.');
    // An untouched new row is not an operation.
    await click(byAction(container, 'add')[0]);
    await click(byAction(container, 'save')[0]);
    assert.equal(status(container).textContent, 'Compila almeno un campo della nuova riga.');
    assert.equal(f.state.submitted.length, 0);
    byField(container, 'company-email-generato', 'email').value = 'n@example.invalid';
    byField(container, 'company-email-generato', 'tipo').value = 'Nuova';
    byField(container, 'company-email-generato', 'password').value = 'segreta';
    await click(byAction(container, 'save')[0]);
    const [request] = f.state.submitted;
    assert.deepEqual(request.operations.map(operation => operation.kind), ['email-extra-create']);
    assert.equal(request.operations[0].id, 'company-email-generato');
    assert.equal(request.operations[0].fields.password, cipher('segreta'));
    assert.equal(request.operations[0].fields.qr, false, 'a new row starts unpublished');
    cleanup();
});
test('a persisted repeatable row needs a second confirmation before it disappears from the draft', async () => {
    const {f, container, cleanup} = await mount();
    const remove = removeOf(container, 'company-email-1');
    await click(remove);
    assert.equal(remove.textContent, 'Conferma eliminazione');
    await click(remove);
    assert.equal(rowOf(container, 'company-email-1').hidden, true, 'the row is hidden until the draft is saved');
    assert.equal(messageOf(container, 'company-email-1'), 'Riga rimossa: salva per confermare.');
    await click(byAction(container, 'save')[0]);
    const [request] = f.state.submitted;
    assert.deepEqual(request.operations.map(operation => [operation.kind, operation.id]), [['email-extra-delete', 'company-email-1']]);
    assert.equal(request.operations[0].basis.length, 64);
    cleanup();
});
test('emptying a protected slot is refused with the same reason the service uses', async () => {
    const {f, container, cleanup} = await mount();
    byField(container, 'pec', 'email').value = '';
    await click(byAction(container, 'save')[0]);
    assert.equal(f.state.submitted.length, 0, 'no request is built for a refused emptying');
    assert.match(status(container).textContent, /Collegato a un Account/);
    cleanup();
    // Unlinking the slot and unpublishing it makes the same emptying acceptable.
    const g = fixture({qrConfig: {aziendaEmail: false}});
    delete g.state.record.emails.pec.linkedAccountId;
    const second = await mount(g);
    byField(second.container, 'pec', 'email').value = '';
    await click(byAction(second.container, 'save')[0]);
    const [operation] = g.state.submitted[0].operations;
    assert.equal(operation.kind, 'email-slot');
    assert.equal(operation.id, 'pec');
    assert.deepEqual(operation.fields, {email: ''});
    second.cleanup();
});
test('the legacy fallback and an unverifiable card selection block emptying without any request', async () => {
    const legacy = fixture({qrConfig: {aziendaEmail: false}});
    legacy.state.record.emails = {pec: {tipo: 'PEC'}, amministrazione: {}, personale: {}, extra: []};
    const first = await mount(legacy);
    byField(first.container, 'pec', 'email').value = '';
    await click(byAction(first.container, 'save')[0]);
    assert.equal(legacy.state.submitted.length, 0);
    assert.match(status(first.container).textContent, /aziendaEmail/);
    first.cleanup();
    const broken = fixture({qrConfig: {aziendaEmail: 'si'}});
    const second = await mount(broken);
    byField(second.container, 'amministrazione', 'email').value = '';
    await click(byAction(second.container, 'save')[0]);
    assert.equal(broken.state.submitted.length, 0);
    assert.match(status(second.container).textContent, /non verificabile/);
    assert.equal(removeOf(second.container, 'company-email-1').disabled, true, 'an unverifiable selection disables every deletion');
    second.cleanup();
});
test('offline the company editor is consultative only', async () => {
    const {container, cleanup} = await mount(fixture({online: false}));
    assert.equal(byAction(container, 'save')[0].disabled, true);
    assert.equal(byAction(container, 'add')[0].disabled, true);
    assert.equal(byField(container, 'pec', 'email').readOnly, true);
    assert.equal(byField(container, 'pec', 'email').disabled, true);
    assert.equal(status(container).textContent, 'Contatti aziendali disponibili offline in sola consultazione.');
    cleanup();
});
test('a lost confirmation keeps the exact request and retries it identically', async () => {
    const {f, container, cleanup} = await mount();
    f.state.failNext = true;
    byField(container, 'faxAzienda', 'number').value = '0119999999';
    await click(byAction(container, 'save')[0]);
    assert.match(status(container).textContent, /Conferma non ricevuta/);
    assert.equal(byAction(container, 'retry')[0].hidden, false);
    assert.equal(byAction(container, 'save')[0].disabled, true);
    await click(byAction(container, 'retry')[0]);
    assert.equal(f.state.submitted.length, 2);
    assert.deepEqual(f.state.submitted[0], f.state.submitted[1], 'the retry sends the identical immutable request');
    assert.equal(status(container).textContent, 'Contatti aziendali salvati.');
    cleanup();
});
test('revocation disposes the editor, clears every retained value and ignores late answers', async () => {
    const {f, container, cleanup} = await mount();
    const address = byField(container, 'amministrazione', 'email');
    address.value = 'tardiva@example.invalid';
    f.state.hold = true;
    byAction(container, 'save')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.equal(f.state.submitted.length, 1);
    f.abort.abort();
    f.state.release();
    await tick(); await tick();
    assert.equal(container.children.length, 0, 'the host is detached on abort');
    assert.equal(address.value, '', 'no typed value survives the revocation');
    assert.equal(f.saved, undefined, 'a late answer is never reported as saved');
    cleanup();
});
