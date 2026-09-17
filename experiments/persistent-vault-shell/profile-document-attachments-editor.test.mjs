import test from 'node:test';
import assert from 'node:assert/strict';
import {createProfileDocumentAttachmentsSource} from './profile-document-attachments-source.mjs';
import {mountProfileDocumentAttachments} from './profile-document-attachments-view.mjs';

const tick = () => new Promise(setImmediate);
const uid = 'owner', documentId = 'document-1', attachmentId = 'attachment-1';
const envelope = {type: 'profile-document-attachment-envelope', version: 1, cipher: 'AES-GCM-256',
    keyWrap: 'HKDF-SHA256+A256GCM', contentIv: 'AAAAAAAAAAAAAAAA', wrapSalt: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
    wrapIv: 'AAAAAAAAAAAAAAAA', wrappedFileKey: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'};
const plaintext = () => Uint8Array.from([1, 2, 3, 4]);
function sourceFixture({online = true, locked = false, attachmentStatus = 'ready', available = true,
    uploadStatuses = ['confirmed'], removeStatus = 'confirmed', refused = false} = {}) {
    const abort = new AbortController(), state = {uid, online, locked, revoked: [], created: 0, clears: 0, downloads: 0};
    const context = {user: {uid}, signal: abort.signal, assertUnlocked() {if (state.locked) throw Error('VAULT_LOCKED');}};
    const bytes = plaintext();
    const objectUrl = {create(value, type) {state.created++; state.lastType = type; state.lastBytes = value; return `blob:${state.created}`;},
        revoke(url) {state.revoked.push(url);}};
    const collaborators = {
        reader: {async read() {return {documentId, allowed: true, refusal: null, online: state.online,
            attachments: [{attachmentId, mimeType: 'image/jpeg', size: 4, digest: 'a'.repeat(64), status: attachmentStatus,
                schemaVersion: 1, available}], invalid: []};}},
        repository: {
            async read(owner, id) {assert.equal(owner, uid); assert.equal(id, attachmentId);
                return {ownerId: uid, documentId, attachmentId: id, storagePath: `users/${uid}/profile-documents/${documentId}/attachments/${id}`,
                    mimeType: 'image/jpeg', size: 4, digest: 'a'.repeat(64), envelope, status: attachmentStatus,
                    schemaVersion: 1};},
            async download() {state.downloads++; return Uint8Array.from([9, 9, 9]);}},
        planner: {
            async upload() {if (refused) return {status: 'refused', code: 'ATTACHMENT_LIMIT_REACHED'};
                return {status: 'prepared', command: {attachmentId, documentId, storagePath: 'users/owner/x'},
                    digest: 'b'.repeat(64), payload: Uint8Array.from([7])};},
            async remove() {return {status: 'prepared', command: {attachmentId, documentId}, digest: 'c'.repeat(64)};}},
        service: {
            async upload() {const status = uploadStatuses.shift() ?? 'confirmed';
                return {status, code: status === 'confirmed' ? undefined : 'OBJECT_CONFLICT', attachmentId};},
            async remove() {return {status: removeStatus, code: removeStatus === 'confirmed' ? undefined : 'FINALIZE_CONFLICT',
                attachmentId};}},
        capability: {async openImage({payload}) {assert.deepEqual([...payload], [9, 9, 9]); return bytes;}},
        trusted: {auth: {uid}, app: {appId: 'synthetic-not-http-attestation'}},
        objectUrl, isOnline: () => state.online, createOperationId: () => `operation-${state.created}`
    };
    const source = createProfileDocumentAttachmentsSource({context, getUser: () => ({uid: state.uid}),
        ...collaborators});
    return {state, abort, context, source, bytes};
}
test('the source projects the reader and refuses to write while offline', async () => {
    const f = sourceFixture({online: false});
    const model = await f.source.load(documentId);
    assert.equal(model.documentId, documentId);
    assert.equal(model.allowed, true);
    assert.equal(model.canWrite, false);
    assert.equal(model.maxPerDocument, 10);
    assert.deepEqual(model.attachments.map(entry => entry.attachmentId), [attachmentId]);
    await assert.rejects(f.source.upload([{name: 'foto.jpg', arrayBuffer: async () => plaintext()}]),
        /OFFLINE_NOT_ALLOWED/);
    await assert.rejects(f.source.open(attachmentId), /OFFLINE_NOT_ALLOWED/);
    await assert.rejects(f.source.remove(attachmentId), /OFFLINE_NOT_ALLOWED/);
    f.source.dispose();
});
test('the source uploads one file at a time and reports every outcome', async () => {
    const f = sourceFixture({uploadStatuses: ['confirmed', 'incomplete', 'failed']});
    await f.source.load(documentId);
    const files = [0, 1, 2].map(index => ({name: `foto-${index}.jpg`, type: 'image/jpeg',
        arrayBuffer: async () => Uint8Array.from([index + 1])}));
    const outcome = await f.source.upload(files);
    assert.equal(outcome.status, 'completed');
    assert.deepEqual(outcome.results.map(result => result.status), ['confirmed', 'incomplete', 'failed']);
    assert.deepEqual(outcome.results.map(result => result.name), ['foto-0.jpg', 'foto-1.jpg', 'foto-2.jpg']);
    assert.equal(outcome.results[1].code, 'OBJECT_CONFLICT');
    assert.deepEqual(await f.source.upload([]), {status: 'empty', results: []});
    f.source.dispose();
});
test('the source refuses a plan refusal without calling the service', async () => {
    const f = sourceFixture({refused: true});
    await f.source.load(documentId);
    let called = false;
    const source = f.source;
    const outcome = await source.upload([{name: 'foto.jpg', type: 'image/jpeg', arrayBuffer: async () => plaintext()}]);
    assert.equal(outcome.results[0].status, 'refused');
    assert.equal(outcome.results[0].code, 'ATTACHMENT_LIMIT_REACHED');
    assert.equal(called, false);
    f.source.dispose();
});
test('a single preview exists at a time, and every URL is revoked exactly once', async () => {
    const f = sourceFixture();
    await f.source.load(documentId);
    const first = await f.source.open(attachmentId);
    const buffer = f.state.lastBytes;
    assert.equal(first.url, 'blob:1');
    assert.equal(f.state.lastType, 'image/jpeg');
    // Opening the same attachment again revokes the previous URL and clears its buffer.
    const second = await f.source.open(attachmentId);
    assert.equal(second.url, 'blob:2');
    assert.deepEqual(f.state.revoked, ['blob:1']);
    assert.equal(buffer.every(byte => byte === 0), true, 'the plaintext of the revoked preview is cleared');
    assert.equal(f.source.close(), true);
    assert.deepEqual(f.state.revoked, ['blob:1', 'blob:2']);
    assert.equal(f.source.preview(), null);
    assert.equal(f.source.close(), false);
    f.source.dispose();
});
test('lock, logout, UID change and dispose revoke the preview and block the boundary', async () => {
    const locked = sourceFixture();
    await locked.source.load(documentId);
    await locked.source.open(attachmentId);
    locked.state.locked = true;
    await assert.rejects(locked.source.load(documentId), /VAULT_LOCKED/);
    assert.deepEqual(locked.state.revoked, [], 'a locked Vault revokes through the view, not behind its back');
    locked.source.dispose();
    assert.deepEqual(locked.state.revoked, ['blob:1']);

    const changed = sourceFixture();
    await changed.source.load(documentId);
    await changed.source.open(attachmentId);
    changed.state.uid = 'someone-else';
    await assert.rejects(changed.source.load(documentId), /VIEW_DISPOSED/);
    assert.deepEqual(changed.state.revoked, ['blob:1'], 'a UID change revokes the preview immediately');
    await assert.rejects(changed.source.open(attachmentId), /VIEW_DISPOSED/);

    const aborted = sourceFixture();
    await aborted.source.load(documentId);
    await aborted.source.open(attachmentId);
    aborted.abort.abort();
    assert.deepEqual(aborted.state.revoked, ['blob:1'], 'an aborted view revokes the preview');
    await assert.rejects(aborted.source.remove(attachmentId), /VIEW_DISPOSED/);
});
test('the source refuses to open a record that is not ready, and revokes on removal', async () => {
    for (const status of ['reserved', 'deleting']) {
        const f = sourceFixture({attachmentStatus: status});
        await f.source.load(documentId);
        await assert.rejects(f.source.open(attachmentId), /ATTACHMENT_NOT_READY/);
        f.source.dispose();
    }
    const removed = sourceFixture();
    await removed.source.load(documentId);
    await removed.source.open(attachmentId);
    const outcome = await removed.source.remove(attachmentId);
    assert.deepEqual(outcome, {status: 'confirmed', code: null, attachmentId});
    assert.deepEqual(removed.state.revoked, ['blob:1'], 'removing the previewed attachment revokes its URL');
    removed.source.dispose();
});

class Node extends EventTarget {
    constructor(tag) {super(); this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.textContent = '';
        this.value = ''; this.files = null; this.hidden = false; this.disabled = false; this.type = ''; this.src = ''; this.alt = '';
        this.multiple = false;}
    append(...nodes) {for (const node of nodes) {node.parent = this; this.children.push(node);}}
    replaceChildren(...nodes) {for (const child of this.children) child.parent = null; this.children = [];
        if (nodes.length) this.append(...nodes);}
    remove() {if (this.parent) this.parent.children = this.parent.children.filter(node => node !== this);}
    setAttribute(key, value) {this.attributes[key] = value;}
}
globalThis.document = {createElement: tag => new Node(tag)};
const walk = node => [node, ...node.children.flatMap(child => walk(child))];
const action = (root, name) => walk(root).filter(node => node.dataset?.documentAttachmentAction === name);
const rows = root => walk(root).filter(node => node.dataset?.documentAttachmentRow === 'true');
const items = root => walk(root).filter(node => node.dataset?.documentAttachmentItem === 'true');
const statusOf = root => walk(root).find(node => node.dataset?.documentAttachmentStatus === 'true');
function viewFixture({attachments = [], canWrite = true, online = true, confirm = async () => true, documents} = {}) {
    const calls = {load: [], upload: [], open: [], remove: [], close: 0, revoke: 0};
    const source = {
        async load(id) {calls.load.push(id); return {documentId: id, allowed: true, refusal: null, online,
            canWrite: canWrite && online, busy: false, maxPerDocument: 10, attachments, invalid: [], preview: null};},
        async upload(files) {calls.upload.push(files);
            return {status: 'completed', results: files.map((unused, index) => ({index, name: 'foto.jpg',
                status: index ? 'incomplete' : 'confirmed', code: index ? 'OBJECT_CONFLICT' : null, attachmentId}))};},
        async open(id) {calls.open.push(id); return {attachmentId: id, url: `blob:${id}`, mimeType: 'image/jpeg'};},
        async remove(id) {calls.remove.push(id); return {status: 'confirmed', code: null, attachmentId: id};},
        close() {calls.close++;},
        revoke() {calls.revoke++;}
    };
    const root = new Node('root');
    const view = mountProfileDocumentAttachments(root, {source, documents: documents ?? [{id: documentId, type: 'Patente'}, {id: null, type: 'Documento senza id'}],
        isOnline: () => online, confirm});
    return {root, view, calls, source};
}
const attachment = overrides => ({attachmentId, mimeType: 'image/jpeg', size: 4, digest: 'a'.repeat(64), status: 'ready',
    schemaVersion: 1, available: true, ...overrides});
test('the Allegato action sits next to Modifica and Cestino, and legacy documents explain themselves', async () => {
    const f = viewFixture();
    await tick();
    const [allowed, legacy] = rows(f.root);
    assert.deepEqual(walk(allowed).filter(node => node.dataset?.documentAttachmentAction).map(node => node.dataset.documentAttachmentAction),
        ['edit', 'trash', 'attach']);
    assert.equal(action(allowed, 'attach')[0].disabled, false);
    assert.equal(action(legacy, 'attach')[0].disabled, true);
    assert.match(walk(legacy).find(node => node.dataset?.documentAttachmentLegacy === 'true').textContent, /senza ID persistito/);
    assert.equal(action(legacy, 'edit')[0].disabled, true);
    f.view.dispose();
});
test('the gallery lists the attachments and opening shows a revocable preview', async () => {
    const f = viewFixture({attachments: [attachment({}), attachment({attachmentId: 'attachment-2', status: 'reserved', available: false})]});
    await tick();
    action(rows(f.root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.deepEqual(f.calls.load, [documentId]);
    const gallery = items(f.root);
    assert.equal(gallery.length, 2);
    assert.equal(action(gallery[0], 'open')[0].disabled, false);
    assert.equal(action(gallery[0], 'delete')[0].disabled, false);
    assert.equal(action(gallery[1], 'open')[0].disabled, true, 'a reserved attachment is not available');
    assert.equal(action(gallery[1], 'delete')[0].disabled, true);
    action(gallery[0], 'open')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.deepEqual(f.calls.open, [attachmentId]);
    const preview = walk(f.root).find(node => node.dataset?.documentAttachmentPreview === 'true');
    assert.equal(walk(preview).find(node => node.tag === 'img').src, `blob:${attachmentId}`);
    action(preview, 'close')[0].dispatchEvent(new Event('click'));
    assert.equal(f.calls.close, 1);
    assert.equal(walk(f.root).some(node => node.dataset?.documentAttachmentPreview === 'true'), false);
    f.view.dispose();
    assert.equal(f.calls.revoke, 1, 'disposing the view revokes whatever the source still holds');
});
test('deleting asks for confirmation and reports the outcome', async () => {
    const denied = viewFixture({attachments: [attachment({})], confirm: async () => false});
    await tick();
    action(rows(denied.root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    action(items(denied.root)[0], 'delete')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.deepEqual(denied.calls.remove, []);

    const confirmed = viewFixture({attachments: [attachment({})]});
    await tick();
    action(rows(confirmed.root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    action(items(confirmed.root)[0], 'delete')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.deepEqual(confirmed.calls.remove, [attachmentId]);
    assert.match(statusOf(confirmed.root).textContent, /Allegato cancellato/);
    confirmed.view.dispose();
});
test('offline and read-only sessions consult the attachments but never modify them', async () => {
    const offline = viewFixture({attachments: [attachment({})], online: false});
    await tick();
    action(rows(offline.root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.equal(action(offline.root, 'input')[0].disabled, true);
    assert.equal(action(items(offline.root)[0], 'open')[0].disabled, true);
    assert.equal(action(items(offline.root)[0], 'delete')[0].disabled, true);
    assert.match(statusOf(offline.root).textContent, /Offline/);
    offline.view.dispose();

    const readOnly = viewFixture({attachments: [attachment({})], canWrite: false});
    await tick();
    action(rows(readOnly.root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    assert.equal(action(readOnly.root, 'input')[0].disabled, true);
    assert.match(statusOf(readOnly.root).textContent, /Consultazione/);
    readOnly.view.dispose();
});
test('a multi-file selection is uploaded file by file and the failures are named', async () => {
    const f = viewFixture({attachments: []});
    await tick();
    action(rows(f.root)[0], 'attach')[0].dispatchEvent(new Event('click'));
    await tick();
    const input = action(f.root, 'input')[0];
    input.files = [{name: 'a.jpg'}, {name: 'b.jpg'}];
    input.dispatchEvent(new Event('change'));
    await tick(); await tick();
    assert.equal(f.calls.upload.length, 1);
    assert.equal(f.calls.upload[0].length, 2);
    assert.match(statusOf(f.root).textContent, /1 allegati non caricati \(OBJECT_CONFLICT\)/);
    f.view.dispose();
});
