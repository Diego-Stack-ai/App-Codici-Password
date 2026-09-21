import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc} from 'firebase/firestore';

// M7-AUDIT-2 — Registro tecnico di audit sotto le Rules di PRODUZIONE.
// Prova che `users/{uid}/auditEvents` è leggibile dal solo proprietario e non è
// scrivibile da alcun client. Servono due mosse, provate entrambe qui: il match
// dedicato (firestore.rules:119-122) E l'esclusione dal catch-all proprietario
// (firestore.rules:126), perché in Firestore le regole sovrapposte si combinano
// in OR: un diniego specifico non annullerebbe una concessione più ampia.
//
// Perimetro dichiarato: `trash` e `recordHistory` restano fuori da questa fetta
// (non sono esclusi dal catch-all e la loro decisione è separata); nessuna
// asserzione li riguarda. Le Rules valgono per le letture di rete: una copia già
// presente nella cache offline non viene revocata da questo blocco.
const PROJECT_ID = 'codici-password-audit-events-rules-test';
const OWNER = 'owner';
const OTHER = 'other';
const EVENT_ID = 'event-1';
const eventPath = ['users', OWNER, 'auditEvents', EVENT_ID];
let testEnv;

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => {
    await testEnv.clearFirestore();
    await testEnv.withSecurityRulesDisabled(async context => {
        const db = context.firestore();
        await setDoc(doc(db, ...eventPath), {action: 'account-archived', schemaVersion: 1});
        // Esiti storici: già protetti prima di questa fetta, usati come controllo
        // di non-regressione (stessa forma: lettura sì, scrittura no).
        await setDoc(doc(db, 'users', OWNER, 'operationResults', 'op-1'), {status: 'applied'});
    });
});
after(async () => testEnv?.cleanup());

test('il proprietario legge gli eventi ma non può crearli, modificarli o cancellarli', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();

    await assertSucceeds(getDoc(doc(db, ...eventPath)));
    await assertSucceeds(getDocs(collection(db, 'users', OWNER, 'auditEvents')));

    // Un evento nuovo non è scrivibile nemmeno dal proprietario.
    await assertFails(setDoc(doc(db, 'users', OWNER, 'auditEvents', 'forged'), {
        action: 'account-archived', schemaVersion: 1
    }));
    await assertFails(updateDoc(doc(db, ...eventPath), {action: 'account-restored'}));
    // Né con `set` in merge: è l'overlap che il catch-all concedeva prima.
    await assertFails(setDoc(doc(db, ...eventPath), {schemaVersion: 2}, {merge: true}));
    await assertFails(deleteDoc(doc(db, ...eventPath)));

    // Il documento è rimasto quello seminato: nessuna scrittura è passata.
    const stored = (await getDoc(doc(db, ...eventPath))).data();
    assert.equal(stored.action, 'account-archived');
    assert.equal(stored.schemaVersion, 1);
});

test('un altro utente e un client anonimo non leggono né scrivono il registro', async () => {
    const other = testEnv.authenticatedContext(OTHER).firestore();
    const anonymous = testEnv.unauthenticatedContext().firestore();

    for (const db of [other, anonymous]) {
        await assertFails(getDoc(doc(db, ...eventPath)));
        await assertFails(getDocs(collection(db, 'users', OWNER, 'auditEvents')));
        await assertFails(setDoc(doc(db, 'users', OWNER, 'auditEvents', 'forged'), {action: 'x'}));
        await assertFails(updateDoc(doc(db, ...eventPath), {action: 'x'}));
        await assertFails(deleteDoc(doc(db, ...eventPath)));
    }

    // Il registro non è nemmeno «scrivibile nel proprio spazio» da un estraneo.
    await assertFails(setDoc(doc(other, 'users', OTHER, 'auditEvents', 'mine'), {action: 'x'}));
});

test('l\'esclusione non tocca le altre collezioni del proprietario', async () => {
    const db = testEnv.authenticatedContext(OWNER).firestore();

    // Collezione ancora coperta dal catch-all: il proprietario continua a scrivere.
    await assertSucceeds(setDoc(doc(db, 'users', OWNER, 'notes', 'note-1'), {text: 'sintetico'}));
    await assertSucceeds(updateDoc(doc(db, 'users', OWNER, 'notes', 'note-1'), {text: 'aggiornato'}));

    // Esiti storici: comportamento invariato (lettura sì, scrittura no).
    await assertSucceeds(getDoc(doc(db, 'users', OWNER, 'operationResults', 'op-1')));
    await assertFails(setDoc(doc(db, 'users', OWNER, 'operationResults', 'op-2'), {status: 'applied'}));
    await assertFails(updateDoc(doc(db, 'users', OWNER, 'operationResults', 'op-1'), {status: 'purged'}));

    // Per lo stesso proprietario il registro resta in sola lettura: è la coppia
    // esclusione + match dedicato a produrre l'esito, non una delle due da sola.
    await assertFails(setDoc(doc(db, 'users', OWNER, 'auditEvents', 'note-like'), {action: 'x'}));
});
