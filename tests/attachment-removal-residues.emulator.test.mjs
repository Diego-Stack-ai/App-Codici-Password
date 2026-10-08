import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {Timestamp, addDoc, arrayUnion, collection, deleteDoc, doc, getDoc, runTransaction, setDoc,
    updateDoc, writeBatch} from 'firebase/firestore';
import {getBytes, getDownloadURL, listAll, ref, uploadBytes} from 'firebase/storage';

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
function deleteScadenza(userId, scadenzaId, sourceRef, active) {
    const db = client().firestore();
    const factory = new Function('db', 'deleteDoc', 'doc', 'runTransaction', 'console',
        `${sliceFunction(detailSource, 'deleteScadenza')}\nreturn deleteScadenza;`);
    return factory(db, deleteDoc, doc, runTransaction, {warn() {}})(userId, scadenzaId, sourceRef, active);
}

// `saveDeadline` reale: compone `attachments: [...existingAttachments, ...nuovi]`
// e scrive con `updateDoc` (modifica) o batch (Scadenza collegata a un documento
// del profilo). Gli helper di cifratura sono quelli **reali** del modulo di
// sicurezza, concatenato allo stesso script.
function saveDeadlineFixture() {
    const db = client().firestore(), storage = client().storage();
    const factory = new Function('db', 'storage', 'addDoc', 'arrayUnion', 'collection', 'doc',
        'getDownloadURL', 'ref', 'setDoc', 'Timestamp', 'updateDoc', 'uploadBytes', 'writeBatch',
        'LOG', 'ensureVaultKeyMaterial', 'getUserProfile', 'deadlineRecipientFields', 'console',
        `${configSource}\n${securitySource}\n${saveSource}\nreturn {saveDeadline};`);
    const module = factory(db, storage, addDoc, arrayUnion, collection, doc, getDownloadURL, ref, setDoc,
        Timestamp, updateDoc, uploadBytes, writeBatch, () => {}, async () => 'synthetic-vault-key',
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

test('T-26 su emulatore: cancellare la Scadenza elimina il documento e lascia i byte', async () => {
    const storage = client().storage(), db = client().firestore();
    const deadlineId = 'deadline-cancellata';
    const objectPath = `users/${OWNER}/scadenze/${deadlineId}/allegato.pdf`;
    await seedDeadline(storage, deadlineId, objectPath);
    assert.deepEqual((await listAll(ref(storage, `users/${OWNER}/scadenze/${deadlineId}`))).items.map(item => item.name),
        ['allegato.pdf'], 'prima della cancellazione l’oggetto esiste');

    await deleteScadenza(OWNER, deadlineId, null, () => true);

    assert.equal((await getDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId))).exists(), false,
        'la Scadenza è eliminata');
    assert.deepEqual((await listAll(ref(storage, `users/${OWNER}/scadenze/${deadlineId}`))).items.map(item => item.name),
        ['allegato.pdf'], 'l’oggetto resta nello Storage');
    assert.deepEqual(new Uint8Array(await getBytes(ref(storage, objectPath))), BYTES,
        'i byte restano leggibili dopo la cancellazione della Scadenza');
});

test('T-26 su emulatore: rimuovere la riga dall’array e salvare lascia l’oggetto orfano', async () => {
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
    assert.deepEqual((await listAll(ref(storage, `users/${OWNER}/scadenze/${deadlineId}`))).items.map(item => item.name),
        ['allegato.pdf'], 'l’oggetto resta nello Storage senza alcun riferimento');
    assert.deepEqual(new Uint8Array(await getBytes(ref(storage, objectPath))), BYTES, 'i byte restano leggibili');
});

test('T-26 su emulatore: errore parziale, l’upload precede la scrittura e resta orfano', async () => {
    const {db, storage, saveDeadline} = saveDeadlineFixture();
    // Scrittura destinata a fallire: il documento della Scadenza non esiste e il
    // percorso collegato al documento del profilo usa un batch che non può
    // aggiornare un documento assente.
    const deadlineId = 'scadenza-assente';
    const file = new File([BYTES], 'nuovo.pdf', {type: 'application/pdf'});
    await assert.rejects(saveDeadline({user: {uid: OWNER}, editingDeadlineId: deadlineId,
        linkedSourceRef: {type: 'profileDocument', id: 'doc-1'}, mode: 'documenti',
        data: {name: 'Sintetica', dueDate: '2026-10-01'}, recipients: [],
        selectedFiles: [file], existingAttachments: []}));

    assert.equal((await getDoc(doc(db, 'users', OWNER, 'scadenze', deadlineId))).exists(), false,
        'nessun documento è stato scritto');
    const uploaded = await listAll(ref(storage, `users/${OWNER}/scadenze/${deadlineId}`));
    assert.equal(uploaded.items.length, 1, 'l’oggetto caricato prima della scrittura fallita resta nello Storage');
    const bytes = new Uint8Array(await getBytes(uploaded.items[0]));
    assert.ok(bytes.length > BYTES.length, 'l’oggetto conserva il payload cifrato');
});
