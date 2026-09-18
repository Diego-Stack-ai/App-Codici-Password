import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createAccountStandardEditorSource} from './account-standard-editor-source.mjs';
import {mountAccountStandardEditor} from './account-standard-editor-view.mjs';
const hash = value => createHash('sha256').update(value).digest('hex'), cipher = value => Buffer.alloc(48, value.charCodeAt(0) || 42).toString('base64');
function fixture(company = false) {
    const abort = new AbortController(), state = {uid: 'owner', online: true, locked: false, record: {id: 'account', ownerId: 'owner', schemaVersion: 1, revision: 2,
        nomeAccount: cipher('Title'), username: cipher('User'), account: cipher('Code'), password: cipher('Secret'), url: 'https://example.invalid', note: cipher('Keep'),
        linkedProfileFields: [{type: 'phone', id: 'mobile'}], banking: [{id: 'bank'}]}, company: {id: 'firm', ownerId: 'owner'}};
    const account = company ? {domain: 'company', companyId: 'firm', id: 'account'} : {domain: 'private', id: 'account'};
    const repository = {};
    for (const method of ['getPrivateAccount','getCompanyAccount','getCompany']) for (const suffix of ['', 'Confirmed']) repository[method + suffix] = async () => structuredClone(method === 'getCompany' ? state.company : state.record);
    const context = {user: {uid: 'owner'}, signal: abort.signal, assertUnlocked() {if (state.locked) throw Error('LOCKED');},
        read: async ({ciphertext}) => ({[cipher('Title')]:'Title',[cipher('User')]:'User',[cipher('Code')]:'Code',[cipher('Secret')]:'Secret'}[ciphertext]), encrypt: async value => cipher(value)};
    const options = {context, getUser: () => ({uid: state.uid}), repository, account, hash, isEncryptedValue: value => value.length >= 30, isOnline: () => state.online};
    return {abort, state, context, source: createAccountStandardEditorSource(options)};
}
for (const company of [false, true]) test(`source reads and prepares ${company ? 'company' : 'private'} standard fields only`, async () => {
    const f = fixture(company), model = await f.source.load(); assert.equal(model.values.password, 'Secret'); assert.equal(model.values.url, 'https://example.invalid');
    const request = await f.source.prepare({password: '', url: ''}, 'op'); assert.deepEqual(request.patch, {password: '', url: ''});
    assert.doesNotMatch(JSON.stringify(request), /Keep|linkedProfileFields|banking/);
});
test('offline is read-only and lifecycle or confirmed changes revoke preparation', async () => {
    const f = fixture(); f.state.online = false; assert.equal((await f.source.load()).canSave, false); await assert.rejects(f.source.prepare({url: ''}, 'op'));
    f.state.online = true; await f.source.load(); f.state.record.revision++; await assert.rejects(f.source.prepare({url: ''}, 'op'), /CHANGED/);
    const g = fixture(); await g.source.load(); g.abort.abort(); await assert.rejects(g.source.prepare({url: ''}, 'op'), /VIEW_DISPOSED/);
});
class Node extends EventTarget {constructor(tag){super();this.tag=tag;this.children=[];this.dataset={};this.attributes={};this.value='';this.defaultValue='';this.textContent='';this.disabled=false;this.readOnly=false;}
append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}} remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);} setAttribute(k,v){this.attributes[k]=v;} all(tag){return this.children.flatMap(n=>[...(n.tag===tag?[n]:[]),...n.all(tag)]);}}
globalThis.document = {createElement: tag => new Node(tag)};
test('view uses password semantics only for Account password and clears every plaintext on cancel', async () => {
    const root = new Node('root'), abort = new AbortController(); let cancelled = false;
    await mountAccountStandardEditor(root, {signal: abort.signal}, {load: async () => ({canSave: true, values: {nomeAccount:'N',username:'U',account:'C',password:'P',url:'https://e.invalid'}}), save(){}, onSaved(){}, onCancel(){cancelled=true;}});
    const inputs = root.all('input'), password = inputs.find(i=>i.dataset.field==='password'); assert.equal(password.type,'password'); assert.equal(password.attributes.autocomplete,'current-password');
    for (const input of inputs.filter(i=>i!==password)) assert.notEqual(input.type,'password');
    root.all('button').find(b=>b.textContent==='Annulla').dispatchEvent(new Event('click')); assert.equal(cancelled,true); assert.ok(inputs.every(i=>i.value===''&&i.defaultValue===''));
});
