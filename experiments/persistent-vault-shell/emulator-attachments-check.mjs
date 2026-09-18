// Synthetic browser scenario for the document attachments surface (DS-002C).
// It runs inside the laboratory page served by emulator-browser.mjs, mounts the
// real provider, source, view and capability of DS-002B with fixtures and a real
// WebCrypto seal, drives the interface with DOM events and reports the outcome to
// the harness. No real attachment, account or production resource is involved.
import {createProfileDocumentAttachmentsProvider} from '/modules/profile-document-attachments-provider.mjs';
import {openDocumentImageBytes, sealDocumentImageBytes} from '/modules/profile-document-attachment-seal.mjs';

const checks = [];
const errors = [];
const record = (name, value, detail = '') => checks.push({name, ok: Boolean(value), detail});
globalThis.addEventListener('error', event => errors.push(`error: ${event.message}`));
globalThis.addEventListener('unhandledrejection', event => errors.push(`rejection: ${event.reason?.message ?? event.reason}`));
const originalError = console.error;
console.error = (...args) => {errors.push(`console.error: ${args.join(' ')}`); originalError(...args);};
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
const truthy = (value, detail) => {if (!value) throw Error(detail ?? 'expected a truthy value'); return value;};

const vaultKey = globalThis.crypto.getRandomValues(new Uint8Array(32));
const documents = [{id: 'document', type: 'Patente'}, {id: null, type: 'Documento senza id'}];
const records = [];
const revoked = [];
const created = [];
const originalCreate = URL.createObjectURL.bind(URL), originalRevoke = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = blob => {const url = originalCreate(blob); created.push(url); return url;};
URL.revokeObjectURL = url => {revoked.push(url); return originalRevoke(url);};
const abort = new AbortController();
const context = {user: {uid: 'browser-owner'}, signal: abort.signal, assertUnlocked() {},
    sealImage({bytes, aad}) {return sealDocumentImageBytes(vaultKey, {bytes, aad});},
    openImage({payload, envelope, aad}) {return openDocumentImageBytes(vaultKey, {payload, envelope, aad});}};
const repository = {
    async readProfile() {return {ownerId: 'browser-owner', documenti: documents};},
    async readDocuments() {return documents;},
    async listAttachments() {return records.map(entry => ({...entry, id: entry.storagePath.split('/').pop()}));},
    async readAttachment(uid, attachmentId) {const found = records.find(entry => entry.storagePath.endsWith(`/${attachmentId}`));
        return found ? {...found, id: attachmentId} : null;},
    async download(uid, {storagePath}) {return objects.get(storagePath);}};
const objects = new Map();
// Fixture service: the state machine itself is proved by the unit and emulator
// suites; here the interface is what is exercised, in a real browser.
const service = {
    async upload({command, payload}) {objects.set(command.storagePath, payload);
        records.push({ownerId: 'browser-owner', documentId: command.documentId, storagePath: command.storagePath,
            mimeType: command.mimeType, size: command.size, digest: command.digest, envelope: command.envelope,
            status: 'ready', schemaVersion: 1});
        return {status: 'confirmed', state: 'ready', attachmentId: command.attachmentId};},
    async remove({command}) {objects.delete(command.storagePath);
        records.splice(0, records.length, ...records.filter(entry => !entry.storagePath.endsWith(`/${command.attachmentId}`)));
        return {status: 'confirmed', state: 'removed', attachmentId: command.attachmentId};}
};
const hash = async value => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))]
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
let online = true;
let attachmentCounter = 0;
const mount = createProfileDocumentAttachmentsProvider({context, getUser: () => ({uid: 'browser-owner'}), repository, service,
    hash, isOnline: () => online, objectUrl: {create: (bytes, type) => URL.createObjectURL(new Blob([bytes], {type})),
        revoke: url => URL.revokeObjectURL(url)},
    trusted: {auth: {uid: 'browser-owner'}, app: {appId: 'synthetic-not-http-attestation'}},
    createAttachmentId: () => `attachment-${++attachmentCounter}`, createOperationId: () => `operation-${++attachmentCounter}`});

const files = size => [0, 1].map(index => new File([new Uint8Array(size).fill(index + 1)], `foto-${index}.jpg`, {type: 'image/jpeg'}));
try {
    const host = document.createElement('section');
    host.id = 'attachments-scenario';
    document.body.append(host);
    const dispose = await mount(host, {signal: abort.signal});
    await tick();
    const queries = selector => [...host.querySelectorAll(selector)];
    const rows = queries('[data-document-attachment-row]');
    record('documents: due righe con azioni', rows.length === 2, `righe=${rows.length}`);
    const actions = name => queries(`[data-document-attachment-action="${name}"]`);
    const labels = row => [...row.querySelectorAll('button')].map(button => button.textContent);
    record('azioni: Modifica, Cestino e Allegato sulla prima riga',
        labels(rows[0]).join(',') === 'Modifica,Cestino,Allegato', labels(rows[0]).join(','));
    record('documento legacy: Allegato disabilitato e messaggio', actions('attach')[1].disabled === true
        && queries('[data-document-attachment-legacy]').length === 1
        && /senza ID persistito/.test(queries('[data-document-attachment-legacy]')[0].textContent));
    const attach = actions('attach')[0];
    attach.focus();
    record('tastiera: il pulsante Allegato riceve il focus', document.activeElement === attach);
    attach.click();
    await tick();
    const input = actions('input')[0];
    record('selezione multipla disponibile', input.multiple === true && input.disabled === false);
    const selection = files(256);
    Object.defineProperty(input, 'files', {value: selection, configurable: true});
    input.dispatchEvent(new Event('change'));
    await tick(); await tick();
    const items = () => queries('[data-document-attachment-item]');
    record('caricamento: due allegati in galleria', items().length === 2, `voci=${items().length}`);
    record('caricamento: oggetti cifrati di dimensione maggiore', [...objects.values()].every(bytes => bytes.byteLength === 256 + 16));
    const open = items()[0].querySelector('[data-document-attachment-action="open"]');
    open.click();
    await tick();
    const preview = queries('[data-document-attachment-preview]')[0];
    record('apertura: anteprima con Object URL', Boolean(preview) && preview.querySelector('img').src.startsWith('blob:'));
    preview.querySelector('[data-document-attachment-action="close"]').click();
    record('chiusura: Object URL revocato', revoked.length === 1 && created.length === 1, `revocati=${revoked.length}`);
    online = false;
    actions('attach')[0].click();
    await tick();
    record('offline: sola consultazione', actions('input')[0].disabled === true
        && items()[0].querySelector('[data-document-attachment-action="open"]').disabled === true
        && /Offline/.test(queries('[data-document-attachment-status]')[0].textContent));
    online = true;
    actions('attach')[0].click();
    await tick();
    items()[0].querySelector('[data-document-attachment-action="delete"]').click();
    await tick(); await tick();
    record('cancellazione: galleria aggiornata', items().length === 1, `voci=${items().length}`);
    items()[0].querySelector('[data-document-attachment-action="open"]').click();
    await tick();
    const beforeLock = created.length;
    abort.abort();
    await tick();
    record('blocco/cambio vista: anteprima revocata', revoked.length === beforeLock && created.length === beforeLock,
        `create=${created.length} revoke=${revoked.length}`);
    dispose();
    record('nessun errore di console', errors.length === 0, errors.join(' | '));
} catch (error) {
    record('scenario completato', false, error?.message ?? String(error));
}
await fetch('/entry-result', {method: 'POST', headers: {'content-type': 'application/json'},
    body: JSON.stringify({ok: checks.every(check => check.ok), scenario: 'profile-document-attachments',
        viewport: {width: innerWidth, height: innerHeight}, checks, errors})});
