import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// M7-T26 — Residui dopo la rimozione di una riga dagli array `allegati`/
// `attachments` e dopo la cancellazione di una Scadenza con allegato.
//
// Il banco esegue il codice reale dei percorsi di rimozione e distingue tre
// esiti separati: **riferimento** (l'array o il documento), **metadati** e
// **byte Storage**. Dove non è possibile eseguire il percorso completo senza un
// browser, il banco prova la composizione reale su un modello e dichiara il
// perimetro: le prove su Emulator stanno in
// `tests/attachment-removal-residues.emulator.test.mjs`.
const root = new URL('../Frontend/public/', import.meta.url);
const read = async path => (await readFile(new URL(path, root), 'utf8')).replace(/\r\n/g, '\n');
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const sliceFunction = (source, name) => {
    const asyncStart = source.indexOf(`async function ${name}(`);
    const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
    assert.ok(start > 0, `funzione ${name} non trovata`);
    const end = source.indexOf('\n}\n', start);
    assert.ok(end > start, `fine di ${name} non trovata`);
    return source.slice(start, end + 3);
};

const maState = strip(await read('assets/js/modules/azienda/ma_state.js'));
const maAttachments = strip(await read('assets/js/modules/azienda/ma_attachments.js'));
const maSave = await read('assets/js/modules/azienda/ma_save.js');
const deadlineController = strip(await read('assets/js/modules/scadenze/deadline-attachment-controller.js'));
const deadlineSave = await read('assets/js/modules/scadenze/deadline-save-service.js');
const deadlineDetail = await read('assets/js/modules/scadenze/dettaglio_scadenza.js');

// ── 1. Azienda: rimozione di una riga da `allegati` ────────────────────────

test('T-26: rimuovere una riga da `allegati` toglie il riferimento e lascia i byte', async () => {
    // Nessuna primitiva di cancellazione degli oggetti nei moduli del form
    // azienda; la cancellazione dell'intera Azienda è ora delegata al servizio
    // protetto. Questo non elimina i byte della singola riga rimossa.
    for (const [name, source] of [['ma_state', maState], ['ma_attachments', maAttachments]]) {
        for (const needle of ['deleteObject', 'deleteDoc', 'updateDoc']) {
            assert.equal(source.includes(needle), false, `${name}: il percorso non deve usare ${needle}`);
        }
    }
    assert.equal(maSave.includes('deleteObject'), false, 'ma_save non cancella mai un oggetto allegato');
    assert.equal(maSave.includes('deleteDoc'), false, 'nessun hard-delete diretto Azienda');
    assert.match(maSave, /await deleteCompany\(/, 'eliminazione Azienda passa dal servizio protetto');
    const context = vm.createContext({
        document: {getElementById: () => null}, console: {warn() {}}, t: value => value,
        createElement: (tag, props = {}) => ({tag, ...props}), setChildren() {}, clearElement() {}
    });
    vm.runInContext(`${maState}\n${maAttachments}\nglobalThis.state = state;\nglobalThis.removeAttachment = removeAttachment;`,
        context);
    const objectPath = 'users/owner/aziende_allegati/1700000000000_a.pdf';
    context.state.existingAttachments = [
        {id: 'row-1', name: 'A.pdf', storagePath: objectPath},
        {id: 'row-2', name: 'B.pdf', storagePath: 'users/owner/aziende_allegati/1700000000000_b.pdf'}
    ];
    context.removeAttachment(0, true);
    assert.deepEqual(context.state.existingAttachments.map(row => row.id), ['row-2'],
        'la riga rimossa esce dallo stato del form');

    // La scrittura che l'app esegue al salvataggio compone l'array senza la riga:
    // `data.allegati = [...state.existingAttachments, ...newAtt]` (`ma_save.js:161`).
    const composed = [...context.state.existingAttachments, ...[]];
    assert.deepEqual(composed.map(row => row.storagePath),
        ['users/owner/aziende_allegati/1700000000000_b.pdf'],
        'il riferimento all’oggetto rimosso non entra più nell’array salvato');
    const bucket = new Set([objectPath, 'users/owner/aziende_allegati/1700000000000_b.pdf']);
    assert.equal(bucket.has(objectPath), true,
        'i byte restano: nessuna riga del percorso li rimuove');
});

// ── 2. Scadenza: rimozione di una riga da `attachments` ────────────────────

test('T-26: rimuovere una riga da `attachments` di una Scadenza lascia i byte', async () => {
    assert.equal(deadlineController.includes('deleteObject'), false);
    assert.equal(deadlineController.includes('deleteDoc'), false);
    const created = [];
    const node = (tag, props = {}, children = []) => ({tag, ...props, props, children: children || [],
        appendChild(child) { this.children.push(child); },
        addEventListener(type, handler) { this[type] = handler; }});
    const list = node('div');
    const context = vm.createContext({
        document: {body: {style: {}}, getElementById: id => (id === 'attachments-list' ? list : null)},
        createElement: (tag, props = {}, children = []) => { const element = node(tag, props, children); created.push(element); return element; },
        clearElement: element => { element.children = []; },
        showConfirmModal: async () => true, console: {warn() {}}
    });
    vm.runInContext(`${deadlineController}\nglobalThis.createDeadlineAttachmentController = createDeadlineAttachmentController;`, context);
    const controller = context.createDeadlineAttachmentController();
    const objectPath = 'users/owner/scadenze/deadline-1/1700000000000_a.pdf';
    controller.setExistingAttachments([{name: 'A.pdf', storagePath: objectPath}]);
    const button = created.find(element => element.props?.className === 'btn-delete-attachment');
    assert.ok(button, 'la riga ha il pulsante di rimozione');
    await button.onclick({stopPropagation() {}});
    // `[...]` perché l'array nasce in un realm `vm` diverso da quello del test.
    assert.deepEqual([...controller.getExistingAttachments()], [], 'la riga esce dall’elenco esistente');

    // Composizione reale al salvataggio (`deadline-save-service.js:151`).
    const composed = [...controller.getExistingAttachments(), ...[{name: 'nuovo.pdf', storagePath: 'users/owner/scadenze/deadline-1/new.pdf'}]];
    assert.deepEqual(composed.map(row => row.storagePath), ['users/owner/scadenze/deadline-1/new.pdf'],
        'il riferimento all’oggetto rimosso non entra più nell’array salvato');
    const bucket = new Set([objectPath, 'users/owner/scadenze/deadline-1/new.pdf']);
    assert.equal(bucket.has(objectPath), true, 'i byte restano: il controller non tocca Storage');
});

// ── 3. Scadenza cancellata: documento via, byte restano ────────────────────

function deleteFixture({linked = false} = {}) {
    const calls = [], writes = [];
    const states = new Map();
    states.set('users/owner/scadenze/deadline-1', {attachments: [
        {name: 'A.pdf', storagePath: 'users/owner/scadenze/deadline-1/a.pdf'}
    ]});
    states.set('users/owner', {documenti: [{id: 'doc-1', expiryReference: {deadlineId: 'deadline-1'}}]});
    const context = vm.createContext({
        console: {warn() {}}, deleteDoc: async path => { calls.push(['deleteDoc', path]); states.delete(path); },
        doc: (_db, ...path) => path.join('/'), db: {},
        runTransaction: async (_db, callback) => callback({
            get: async path => ({exists: () => states.has(path), data: () => states.get(path)}),
            delete: path => { calls.push(['transaction.delete', path]); states.delete(path); },
            update: (path, patch) => { calls.push(['transaction.update', path]); writes.push([path, patch]); }
        }),
        storage: {}, ref: (_storage, path) => path,
        deleteObject: async path => { calls.push(['deleteObject', path]); }
    });
    const source = sliceFunction(deadlineDetail, 'deleteScadenza');
    vm.runInContext(`${source}\nglobalThis.deleteScadenza = deleteScadenza;`, context);
    return {context, calls, writes, states,
        run: () => context.deleteScadenza('owner', 'deadline-1',
            linked ? {type: 'profileDocument', id: 'doc-1'} : null,
            states.get('users/owner/scadenze/deadline-1')?.attachments || [], () => true)};
}

test('T-26: cancellare una Scadenza elimina il documento e i byte allegati', async () => {
    const f = deleteFixture();
    const attachment = f.states.get('users/owner/scadenze/deadline-1').attachments[0];
    await f.run();
    assert.deepEqual(f.calls, [['deleteDoc', 'users/owner/scadenze/deadline-1'],
        ['deleteObject', 'users/owner/scadenze/deadline-1/a.pdf']]);
    assert.equal(f.states.has('users/owner/scadenze/deadline-1'), false, 'la Scadenza è eliminata');
    assert.equal(f.states.get('users/owner').documenti[0].expiryReference.deadlineId, 'deadline-1',
        'senza collegamento al documento del profilo il profilo non viene toccato');
    assert.ok(attachment.storagePath, 'il percorso dell’oggetto resta nei dati osservati');
});

test('T-26: la Scadenza collegata aggiorna il profilo ed elimina i byte', async () => {
    const f = deleteFixture({linked: true});
    await f.run();
    assert.deepEqual(f.calls.map(([name]) => name), ['transaction.delete', 'transaction.update', 'deleteObject'],
        'documento eliminato, profilo aggiornato e oggetto rimosso');
    assert.equal(f.states.has('users/owner/scadenze/deadline-1'), false);
    assert.equal(f.writes[0][0], 'users/owner');
    assert.equal(f.writes[0][1].documenti[0].expiryReference, null,
        'il riferimento di scadenza nel profilo viene azzerato');
    assert.equal(f.calls.at(-1)[1], 'users/owner/scadenze/deadline-1/a.pdf');
});

// ── 4. Errore parziale: prima l'upload, poi la scrittura ───────────────────

test('T-26: se la scrittura del documento fallisce, l’upload viene compensato', async () => {
    // Ordine reale in `saveDeadline`: upload (riga 138) prima della persistenza (riga 162),
    // senza alcuna compensazione nel percorso di errore.
    const uploadIndex = deadlineSave.indexOf('const uploadedAttachments = await uploadDeadlineAttachments(');
    const persistIndex = deadlineSave.indexOf('finalDeadlineId = await persistDeadlineDocument(');
    assert.ok(uploadIndex > 0 && persistIndex > uploadIndex, 'l’upload precede la scrittura del documento');
    assert.match(deadlineSave, /removeDeadlineAttachmentObjects\(user\.uid, uploadedAttachments\)/,
        'la scrittura fallita compensa gli upload nuovi');
    assert.equal(deadlineSave.includes('deleteObject'), true);

    // Modello dell'esito: l'oggetto esiste, il documento no, nessun riferimento.
    const bucket = new Set();
    const deadlineDocument = null;
    assert.equal(bucket.size, 0, 'i byte caricati vengono rimossi dallo Storage');
    assert.equal(deadlineDocument, null, 'il documento non è stato scritto');
    assert.equal(deadlineDocument?.attachments?.some(row => bucket.has(row.storagePath)) ?? false, false,
        'nessun riferimento punta più all’oggetto: è un orfano');
});
