import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, doc, getDoc, getDocs, query, setDoc, updateDoc, where} from 'firebase/firestore';

// M7-R7B1a — blocco autorevole della lettura ospite quando l'Account del
// proprietario è nell'Archivio (firestore.rules:164-176). Prove su Firestore
// Rules Emulator con dati sintetici e le Rules di PRODUZIONE del ramo candidato.
// Limite dichiarato: le Rules valgono per le letture di rete; una copia già
// presente nella cache offline non viene revocata da questa condizione.
const PROJECT_ID = 'codici-password-archive-suspension-test';
const OWNER = 'owner', GUEST = 'guest', PENDING = 'pending-guest', STRANGER = 'stranger';
const ACCOUNT = 'account-1', ARCHIVED = 'archived-1', COMPANY = 'company-1';
const EMAIL_KEY = 'guest_example_invalid';
const activePath = ['users', OWNER, 'accounts', ACCOUNT];
const archivedPath = ['users', OWNER, 'accounts', ARCHIVED];
const activeCompanyPath = ['users', OWNER, 'aziende', COMPANY, 'accounts', ACCOUNT];
const archivedCompanyPath = ['users', OWNER, 'aziende', COMPANY, 'accounts', ARCHIVED];
let testEnv;

const account = isArchived => ({
    nomeAccount: 'Account sintetico', type: 'account', revision: 1, visibility: 'shared', acceptedCount: 1,
    isArchived,
    sharedWith: {[EMAIL_KEY]: {email: 'guest@example.invalid', status: 'accepted', uid: GUEST}},
    sharedWithUids: [GUEST]
});

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
        await setDoc(doc(db, ...activePath), account(false));
        await setDoc(doc(db, ...archivedPath), account(true));
        await setDoc(doc(db, ...activeCompanyPath), account(false));
        await setDoc(doc(db, ...archivedCompanyPath), account(true));
        await setDoc(doc(db, ...archivedPath, 'attachments', 'attachment-1'), {name: 'allegato sintetico'});
        await setDoc(doc(db, 'users', OWNER, 'accountWidgets', 'widget-1'), {title: 'Widget sintetico'});
        await setDoc(doc(db, 'users', OWNER, 'sharedVaultData', 'shared-1'), {title: 'Credenziale sintetica'});
        await setDoc(doc(db, 'users', OWNER, 'contacts', 'contact-1'), {email: 'contatto@example.invalid'});
    });
});
after(async () => testEnv?.cleanup());

const asGuest = () => testEnv.authenticatedContext(GUEST).firestore();
const asPending = () => testEnv.authenticatedContext(PENDING).firestore();
const asStranger = () => testEnv.authenticatedContext(STRANGER).firestore();
const asOwner = () => testEnv.authenticatedContext(OWNER).firestore();
async function readAsAdmin(...path) {
    let snapshot;
    await testEnv.withSecurityRulesDisabled(async context => { snapshot = await getDoc(doc(context.firestore(), ...path)); });
    return snapshot;
}

test('ospite accettato: legge l\'Account attivo privato e aziendale', async () => {
    await assertSucceeds(getDoc(doc(asGuest(), ...activePath)));
    await assertSucceeds(getDoc(doc(asGuest(), ...activeCompanyPath)));
});

test('ospite accettato: negato sull\'Account archiviato in tutti i percorsi', async () => {
    await assertFails(getDoc(doc(asGuest(), ...archivedPath)));
    await assertFails(getDoc(doc(asGuest(), ...archivedCompanyPath)));
    // Elenco: la raccolta del proprietario non è un percorso ospite.
    await assertFails(getDocs(collection(asGuest(), 'users', OWNER, 'accounts')));
});

test('invito pendente: resta negato su Account attivo e archiviato', async () => {
    await assertFails(getDoc(doc(asPending(), ...activePath)));
    await assertFails(getDoc(doc(asPending(), ...archivedPath)));
});

test('estraneo: nessun accesso agli Account del proprietario', async () => {
    await assertFails(getDoc(doc(asStranger(), ...activePath)));
    await assertFails(getDoc(doc(asStranger(), ...archivedPath)));
});

test('valore isArchived malformato: la lettura ospite fallisce chiusa', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), ...activePath), {...account(false), isArchived: 'true'});
    });
    await assertFails(getDoc(doc(asGuest(), ...activePath)));
});

test('il proprietario conserva l\'accesso all\'Archivio: lettura, elenco e scrittura', async () => {
    const db = asOwner();
    await assertSucceeds(getDoc(doc(db, ...archivedPath)));
    await assertSucceeds(getDoc(doc(db, ...archivedCompanyPath)));
    await assertSucceeds(getDocs(query(collection(db, 'users', OWNER, 'accounts'), where('isArchived', '==', true))));
    await assertSucceeds(updateDoc(doc(db, ...archivedPath), {revision: 2}));
});

test('la sospensione non cancella né riscrive inviti e condivisione', async () => {
    // L'ospite non può alterare l'Account archiviato…
    await assertFails(updateDoc(doc(asGuest(), ...archivedPath), {sharedWithUids: []}));
    // …e il documento conserva destinatari e condivisione: la condizione è di
    // sola lettura, non una revoca.
    const snapshot = await readAsAdmin(...archivedPath);
    assert.deepEqual([...snapshot.data().sharedWithUids], [GUEST]);
    assert.equal(snapshot.data().sharedWith[EMAIL_KEY].status, 'accepted');
    assert.equal(snapshot.data().isArchived, true);
});

test('nessun nuovo percorso concesso all\'ospite: allegati, widget, credenziali, profilo', async () => {
    const db = asGuest();
    await assertFails(getDoc(doc(db, ...archivedPath, 'attachments', 'attachment-1')));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'accountWidgets', 'widget-1')));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'sharedVaultData', 'shared-1')));
    await assertFails(getDoc(doc(db, 'users', OWNER, 'contacts', 'contact-1')));
    await assertFails(getDoc(doc(db, 'users', OWNER)));
});
