import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {Timestamp, addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, runTransaction, setDoc,
    updateDoc, writeBatch} from 'firebase/firestore';
import {deleteObject, getBytes, getDownloadURL, listAll, ref, uploadBytes} from 'firebase/storage';

// M7-T26 — Prove su **Emulator reali** (Firestore + Storage, Rules di produzione)
// dei percorsi di rimozione: cancellazione di una Scadenza con allegato e
// rimozione di una riga dall'array `attachments` con salvataggio reale.
//
// Il banco esegue il codice di produzione — `deleteScadenza` estratta da
// `dettaglio_scadenza.js` e `saveDeadline` di `deadline-save-service.js` — con i
// **veri SDK web**; le verifiche finali leggono l'emulatore (documento assente o
// aggiornato, oggetto ancora elencato e leggibile).
const read = async path => (await readFile(new URL(path, import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const sliceFunction = (source, name) => {
    const asyncStart = source.indexOf(`async function ${name}(`);
    const start = asyncStart >= 0 ? asyncStart : source.indexOf(`function ${name}(`);
    const end = source.indexOf('\n}\n', start);
    assert.ok(start > 0 && end > start, `funzione ${name} non estraibile`);
    return source.slice(start, end + 3);
};

const detailSource = await read('../Frontend/public/assets/js/modules/scadenze/dettaglio_scadenza.js');
const saveSource = strip(await read('../Frontend/public/assets/js/modules/scadenze/deadline-save-service.js'));
const securitySource = strip(await read('../Frontend/public/assets/js/modules/shared/attachment-security.js'));
const configSource = strip(await read('../Frontend/public/assets/js/modules/scadenze/deadline-config-model.js'));

const PROJECT_ID = 'codici-password-attachment-removal';
const OWNER = 'owner-removal';
const BYTES = Uint8Array.from([4, 5, 6]);
let testEnv;

const client = () => testEnv.authenticatedContext(OWNER);

// `deleteScadenza` reale, montata nello stesso realm degli SDK. La transazione
// usata è quella vera del client: il modulo chiama `get`/`delete`/`update`.
async function deleteScadenza(userId, scadenzaId, sourceRef, active) {
    const db = client().firestore(), storage = client().storage();
    const snapshot = await getDoc(doc(db, 'users', userId, 'scadenze', scadenzaId));
    const attachments = snapshot.exists() ? snapshot.data().attachments || [] : [];
    const factory = new Function('db', 'storage', 'deleteDoc', 'deleteObject', 'doc', 'ref', 'runTransaction', 'console',
        `${sliceFunction(detailSource, 'deleteScadenza')}\nreturn deleteScadenza;`);
    return factory(db, storage, deleteDoc, deleteObject, doc, ref, runTransaction, {warn() {}})(userId, scadenzaId, sourceRef, attachments, active);
}

// `saveDeadline` reale: compone `attachments: [...existingAttachments, ...nuovi]`
// e scrive con `updateDoc` (modifica) o batch (Scadenza collegata a un documento
// del profilo). Gli helper di cifratura sono quelli **reali** del modulo di
// sicurezza, concatenato allo stesso script.
function saveDeadlineFixture() {
    const db = client().firestore(), storage = client().storage();
    const factory = new Function('db', 'storage', 'addDoc', 'arrayUnion', 'collection', 'doc',
        'deleteObject', 'getDownloadURL', 'ref', 'setDoc', 'Timestamp', 'updateDoc', 'uploadBytes', 'writeBatch',
        'LOG', 'ensureVaultKeyMaterial', 'getDeadline', 'getUserProfile', 'deadlineRecipientFields', 'console',
        `${configSource}\n${securitySource}\n${saveSource}\nreturn {saveDeadline};`);
    const module = factory(db, storage, addDoc, arrayUnion, collection, doc, deleteObject, getDownloadURL, ref, setDoc,
        Timestamp, updateDoc, uploadBytes, writeBatch, () => {}, async () => 'synthetic-vault-key',
        async (_uid, deadlineId) => {
            const snapshot = await getDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId));
            return snapshot.exists() ? {id: snapshot.id, ...snapshot.data()} : null;
        },
        async () => ({documenti: []}), () => ({recipients: []}), {warn() {}});
    return {db, storage, saveDeadline: module.saveDeadline};
}

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')},
        storage: {rules: await readFile(new URL('../storage.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => { await testEnv.clearFirestore(); await testEnv.clearStorage(); });
after(async () => testEnv?.cleanup());

// Ogni caso usa una Scadenza diversa: i residui di un caso non entrano nelle
// asserzioni dell'altro.
async function seedDeadline(storage, deadlineId, objectPath) {
    const db = client().firestore();
    await uploadBytes(ref(storage, objectPath), BYTES, {contentType: 'application/pdf'});
    await setDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId), {
        uid: OWNER, name: 'Scadenza sintetica', dueDate: '2026-10-01',
        attachments: [{name: 'Allegato.pdf', storagePath: objectPath, type: 'application/pdf', size: BYTES.length}]
    });
}

test('T-26 su emulatore: cancellare la Scadenza elimina documento e byte', async () => {
    const storage = client().storage(), db = client().firestore();
    const deadlineId = 'deadline-cancellata';
    const objectPath = `users/${OWNER}/scadenze/${deadlineId}/allegato.pdf`;
    await seedDeadline(storage, deadlineId, objectPath);
    assert.deepEqual((await listAll(ref(storage, `users/${OWNER}/scadenze/${deadlineId}`))).items.map(item => item.name),
        ['allegato.pdf'], 'prima della cancellazione l’oggetto esiste');

    await deleteScadenza(OWNER, deadlineId, null, () => true);

    assert.equal((await getDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId))).exists(), false,
        'la Scadenza è eliminata');
    assert.deepEqual((await listAll(ref(storage, `users/${OWNER}/scadenze/${deadlineId}`))).items, [],
        'nessun oggetto resta nello Storage');
});

test('T-26 su emulatore: rimuovere la riga dall’array elimina l’oggetto', async () => {
    const {db, storage, saveDeadline} = saveDeadlineFixture();
    const deadlineId = 'deadline-modificata';
    const objectPath = `users/${OWNER}/scadenze/${deadlineId}/allegato.pdf`;
    await seedDeadline(storage, deadlineId, objectPath);
    assert.equal((await getDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId))).data().attachments.length, 1,
        'il documento referenzia l’allegato');

    // L'utente ha rimosso la riga nel form e salva: la funzione reale compone
    // `attachments: [...esistenti, ...nuovi]` con l'elenco esistente vuoto.
    await saveDeadline({user: {uid: OWNER}, editingDeadlineId: deadlineId, mode: 'generali',
        data: {name: 'Scadenza sintetica', dueDate: '2026-10-01'}, recipients: [],
        selectedFiles: [], existingAttachments: []});

    const after = (await getDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId))).data();
    assert.deepEqual(after.attachments, [], 'il riferimento all’allegato è sparito dall’array');
    assert.deepEqual((await listAll(ref(storage, `users/${OWNER}/scadenze/${deadlineId}`))).items, [],
        'l’oggetto rimosso non resta nello Storage');
});

test('T-26 su emulatore: errore parziale compensa l’upload', async () => {
    const {db, storage, saveDeadline} = saveDeadlineFixture();
    // Scrittura destinata a fallire dopo l'upload: la Scadenza esiste, mentre il
    // profilo collegato manca e il batch non può aggiornarlo.
    const deadlineId = 'scadenza-assente';
    await setDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId), {
        uid: OWNER, name: 'Preesistente', attachments: []
    });
    const file = new File([BYTES], 'nuovo.pdf', {type: 'application/pdf'});
    await assert.rejects(saveDeadline({user: {uid: OWNER}, editingDeadlineId: deadlineId,
        linkedSourceRef: {type: 'profileDocument', id: 'doc-1'}, mode: 'documenti',
        data: {name: 'Sintetica', dueDate: '2026-10-01'}, recipients: [],
        selectedFiles: [file], existingAttachments: []}));

    assert.equal((await getDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId))).data().name, 'Preesistente',
        'il documento preesistente non viene modificato dal batch fallito');
    const uploaded = await listAll(ref(storage, `users/${OWNER}/scadenze/${deadlineId}`));
    assert.equal(uploaded.items.length, 0, 'l’oggetto caricato viene rimosso dopo la scrittura fallita');
});
