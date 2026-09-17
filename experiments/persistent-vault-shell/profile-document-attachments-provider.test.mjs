import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {createProfileDocumentAttachmentsProvider} from './profile-document-attachments-provider.mjs';

// The shell view imports a Frontend module that Node resolves as CommonJS, so the
// test loads its source with the same two substitutions the shell view suite uses.
const helper = 'data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/shared/read-error-message.js', import.meta.url), 'utf8')).toString('base64');
const viewSource = (await readFile(new URL('./profile-shell-view.mjs', import.meta.url), 'utf8'))
    .replace("'./profile-section-reader.mjs'", JSON.stringify(new URL('./profile-section-reader.mjs', import.meta.url).href))
    .replace("'../../Frontend/public/assets/js/modules/shared/read-error-message.js'", JSON.stringify(helper));
const {mountProfileShell} = await import('data:text/javascript;base64,' + Buffer.from(viewSource).toString('base64'));

const hash = value => createHash('sha256').update(value).digest('hex');
const tick = () => new Promise(setImmediate);
// The mounted path crosses several awaited layers (reader, planner, capability,
// service), so the assertions wait on a real timer instead of a single turn.
const settle = () => new Promise(resolve => setTimeout(resolve, 10));
const envelope = () => ({type: 'profile-document-attachment-envelope', version: 1, cipher: 'AES-GCM-256',
    keyWrap: 'HKDF-SHA256+A256GCM', contentIv: 'AAAAAAAAAAAAAAAA', wrapSalt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    wrapIv: 'AAAAAAAAAAAAAAAA', wrappedFileKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'});
class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = '';
        this.value = ''; this.files = null; this.hidden = false; this.disabled = false; this.type = ''; this.src = ''; this.alt = '';
        this.multiple = false; this.id = '';}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    replaceChildren(...nodes) {for (const child of this.children) child.parent = null; this.children = [];
        if (nodes.length) this.append(...nodes);}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute(key, value) {this.attributes[key] = value; if (key === 'id') this.id = value;}
    querySelectorAll(tag) {return walk(this).filter(node => node !== this && node.tag === tag);}
}
globalThis.document = {createElement: tag => new Node(tag)};
const walk = node => [node, ...node.children.flatMap(child => walk(child))];
const action = (root, name) => walk(root).filter(node => node.dataset?.documentAttachmentAction === name);
const rows = root => walk(root).filter(node => node.dataset?.documentAttachmentRow === 'true');
const items = root => walk(root).filter(node => node.dataset?.documentAttachmentItem === 'true');
const statusOf = root => walk(root).find(node => node.dataset?.documentAttachmentStatus === 'true');
function fixture({online = true, documents = [{id: 'document-1', type: 'Patente'}, {id: null, type: 'Senza id'}]} = {}) {
    const abort = new AbortController(), state = {uid: 'owner', revoked: [], sealed: 0, opened: 0, uploads: [], removes: [],
        records: [], confirms: 0};
    const context = {user: {uid: state.uid}, signal: abort.signal, assertUnlocked() {},
        async sealImage({bytes}) {state.sealed++; return {payload: Uint8Array.from(bytes), envelope: envelope()};},
        async openImage({payload}) {state.opened++; return Uint8Array.from(payload);}};
    const objectUrl = {create(bytes, type) {state.lastType = type; state.lastBytes = bytes; return `blob:${state.revoked.length + 1}`;},
        revoke(url) {state.revoked.push(url);}};
    const repository = {
        async readProfile(uid, confirmed) {state.reads = [...(state.reads ?? []), confirmed]; return {ownerId: uid, documenti: documents};},
        async readDocuments() {return documents;},
        // The transport adds the document id; the record itself keeps only the
        // contract allowlist, exactly as the service writes it.
        async listAttachments() {return state.records.map(record => ({...record, id: record.storagePath.split('/').pop()}));},
        async readAttachment(uid, attachmentId) {const found = state.records.find(record =>
            record.storagePath.endsWith(`/${attachmentId}`)); return found ? {...found, id: attachmentId} : null;},
        async download() {state.downloads = (state.downloads ?? 0) + 1; return Uint8Array.from([9, 9, 9]);}
    };
    // The candidate service is replaced by a double: this suite proves the mounting,
    // not the state machine, which has its own suites.
    const service = {
        async upload({command}, trusted) {state.uploads.push(command);
            state.records.push({ownerId: state.uid, documentId: command.documentId, storagePath: command.storagePath,
                mimeType: command.mimeType, size: command.size, digest: command.digest, envelope: command.envelope,
                status: 'ready', schemaVersion: 1});
            return {status: 'confirmed', state: 'ready', attachmentId: command.attachmentId};},
        async remove({command}) {state.removes.push(command);
            state.records = state.records.filter(record => !record.storagePath.endsWith(`/${command.attachmentId}`));
            return {status: 'confirmed', state: 'removed', attachmentId: command.attachmentId};}
    };
    const mount = createProfileDocumentAttachmentsProvider({context, getUser: () => ({uid: state.uid}), repository, service,
        hash, isOnline: () => online, objectUrl, trusted: {auth: {uid: state.uid}, app: {appId: 'fixture'}},
        createAttachmentId: () => 'attachment-1', createOperationId: () => 'operation-1'});
    return {state, abort, context, mount, root: new Node('root'), documents};
}
test('the provider mounts the Allegato action inside the documents section and marks the legacy rows', async () => {
    const f = fixture();
    const root = new Node('panel');
    const dispose = await f.mount(root, {signal: f.abort.signal});
    const [allowed, legacy] = rows(root);
    assert.deepEqual(walk(allowed).filter(node => node.dataset?.documentAttachmentAction).map(node => node.dataset.documentAttachmentAction),
        ['edit', 'trash', 'attach']);
    assert.equal(action(legacy, 'attach')[0].disabled, true);
    assert.match(walk(legacy).find(node => node.dataset?.documentAttachmentLegacy === 'true').textContent, /senza ID persistito/);
    action(rows(root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.equal(f.state.reads.includes(true), true, 'the provider reads the confirmed profile');
    dispose();
    // A provider without a complete repository refuses instead of mounting half a view.
    assert.throws(() => createProfileDocumentAttachmentsProvider({context: f.context, getUser: () => ({uid: 'owner'}),
        repository: {}, service: {}, hash}), /DOCUMENT_ATTACHMENT_PROVIDER_INVALID/);
});
test('the mounted surface uploads several files, refreshes the gallery and deletes with confirmation', async () => {
    const f = fixture();
    const root = new Node('panel');
    const dispose = await f.mount(root, {signal: f.abort.signal});
    action(rows(root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    const input = action(root, 'input')[0];
    assert.equal(input.multiple, true);
    input.files = [{name: 'a.jpg', type: 'image/jpeg', arrayBuffer: async () => Uint8Array.from([1, 2, 3])}];
    input.dispatchEvent(new Event('change'));
    await settle();
    assert.equal(f.state.sealed, 1, 'the bytes are sealed through the session capability');
    assert.equal(f.state.uploads.length, 1);
    assert.equal(f.state.uploads[0].documentId, 'document-1');
    assert.equal(f.state.uploads[0].attachmentId, 'attachment-1');
    assert.equal(f.state.uploads[0].storagePath, 'users/owner/profile-documents/document-1/attachments/attachment-1');
    const gallery = items(root);
    assert.equal(gallery.length, 1, 'the gallery refreshes right after the upload');
    action(gallery[0], 'open')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.equal(f.state.opened, 1);
    assert.equal(walk(root).find(node => node.dataset?.documentAttachmentPreview === 'true') !== undefined, true);
    action(walk(root).find(node => node.dataset?.documentAttachmentPreview === 'true'), 'close')[0].dispatchEvent(new Event('click'));
    assert.deepEqual(f.state.revoked, ['blob:1']);
    action(items(root)[0], 'delete')[0].dispatchEvent(new Event('click'));
    await settle();
    assert.equal(f.state.removes.length, 1);
    assert.equal(items(root).length, 0, 'the gallery refreshes right after the deletion');
    dispose();
});
test('a tab or route change revokes the preview, clears the bytes and disposes the capability', async () => {
    const f = fixture();
    const root = new Node('panel');
    f.state.records.push({ownerId: 'owner', documentId: 'document-1',
        storagePath: 'users/owner/profile-documents/document-1/attachments/attachment-1', mimeType: 'image/jpeg', size: 3,
        digest: hash('x'), envelope: envelope(), status: 'ready', schemaVersion: 1});
    const dispose = await f.mount(root, {signal: f.abort.signal});
    action(rows(root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    action(items(root)[0], 'open')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.equal(f.state.opened, 1);
    const buffer = f.state.lastBytes;
    f.abort.abort();
    assert.deepEqual(f.state.revoked, ['blob:1'], 'the section signal revokes the Object URL');
    assert.equal(buffer.every(byte => byte === 0), true, 'the plaintext of the preview is cleared');
    await assert.rejects(f.mount(new Node('panel'), {signal: f.abort.signal}), /VIEW_DISPOSED/);
    dispose();
});
test('a late callback after the section changed writes nothing else', async () => {
    const f = fixture();
    const root = new Node('panel');
    const dispose = await f.mount(root, {signal: f.abort.signal});
    action(rows(root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    const pending = [];
    const input = action(root, 'input')[0];
    input.files = [0, 1].map(index => ({name: `foto-${index}.jpg`, type: 'image/jpeg',
        arrayBuffer: async () => {pending.push(index); f.abort.abort(); return Uint8Array.from([index + 1]);}}));
    input.dispatchEvent(new Event('change'));
    await settle();
    assert.deepEqual(pending, [0], 'the second file is never read once the section is gone');
    assert.equal(f.state.uploads.length, 0, 'nothing is written after the abort');
    assert.match(statusOf(root).textContent, /VIEW_DISPOSED|non riuscito|non caricati/i);
    dispose();
});
test('the shell mounts the attachments surface only in the documents section and disposes it on change', async () => {
    const mounted = [];
    const context = {user: {uid: 'owner'}, unlocked: true, signal: new AbortController().signal, assertUnlocked() {}};
    const root = new Node('root');
    const dispose = await mountProfileShell(root, context, {
        readSection: async section => [{group: section === 'documents' ? 'Documenti' : 'Anagrafica',
            label: 'Numero serie', value: 'DOC-1'}],
        mountDocumentAttachments: async (panel, {signal}) => {mounted.push({panel, signal}); return () => mounted.push({disposed: true});},
        profileTitle: 'Profilo utente'});
    const section = name => walk(root).find(node => node.dataset?.profileSection === name);
    assert.equal(mounted.length, 0, 'the first section is the anagraphic one and mounts nothing');
    section('documents').dispatchEvent(new Event('click'));
    await settle();
    assert.equal(mounted.length, 1, 'the documents section mounts the attachments surface');
    assert.equal(walk(root).includes(mounted[0].panel), true, 'it is mounted inside the section panel');
    section('contacts').dispatchEvent(new Event('click'));
    await settle();
    assert.equal(mounted.some(entry => entry.disposed === true), true, 'leaving the section disposes it');
    dispose();
    assert.equal(mounted.filter(entry => entry.disposed === true).length >= 1, true);
});
