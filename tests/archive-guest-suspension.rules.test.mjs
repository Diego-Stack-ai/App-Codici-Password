import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {collection, doc, getDoc, getDocs, query, runTransaction, setDoc, updateDoc, where} from 'firebase/firestore';

// M7-R7B1a — blocco autorevole della lettura ospite quando l'Account del
// proprietario è nell'Archivio (firestore.rules:164-176). Prove su Firestore
// Rules Emulator con dati sintetici e le Rules di PRODUZIONE del ramo candidato.
// Limite dichiarato: le Rules valgono per le letture di rete; una copia già
// presente nella cache offline non viene revocata da questa condizione.
const PROJECT_ID = 'demo-codici-password-archive-suspension-test';
const OWNER = 'owner', GUEST = 'guest', PENDING = 'pending-guest', STRANGER = 'stranger';
const ACCOUNT = 'account-1', ARCHIVED = 'archived-1', COMPANY = 'company-1';
const EMAIL_KEY = 'guest_example_invalid';
const activePath = ['users', OWNER, 'accounts', ACCOUNT];
const archivedPath = ['users', OWNER, 'accounts', ARCHIVED];
const restoredPath = ['users', OWNER, 'accounts', 'restored-1'];
const legacyPath = ['users', OWNER, 'accounts', 'legacy-1'];
const legacyInvitePath = ['invites', `legacy-1_${EMAIL_KEY}`];
const guestInvitePath = ['invites', `${ACCOUNT}_${EMAIL_KEY}`];
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
        // M7-R7C-1: Account ripristinato dopo l'archiviazione: la revoca è
        // persistente, quindi la lista dei grant è vuota e resterà vuota.
        await setDoc(doc(db, ...restoredPath), {...account(false), sharingCycle: 1,
            sharedWithUids: [], acceptedCount: 0,
            sharedWith: {[EMAIL_KEY]: {email: 'guest@example.invalid', status: 'suspended', suspendedAt: '2026-01-01T00:00:00.000Z'}}});
        await setDoc(doc(db, ...guestInvitePath), {inviteId: `${ACCOUNT}_${EMAIL_KEY}`, ownerId: OWNER, senderId: OWNER,
            accountId: ACCOUNT, recipientEmail: 'guest@example.invalid', status: 'accepted',
            sharingState: 'suspended', suspendedAt: '2026-01-01T00:00:00.000Z'});
        // M7-R7C-2: Account archiviato PRIMA del protocollo, con grant ancora attivi.
        await setDoc(doc(db, ...legacyPath), {nomeAccount: 'Account legacy', type: 'account', revision: 1,
            isArchived: true, acceptedCount: 1, sharedWithUids: [GUEST],
            sharedWith: {[EMAIL_KEY]: {email: 'guest@example.invalid', status: 'accepted', uid: GUEST}}});
        await setDoc(doc(db, ...legacyInvitePath), {inviteId: `legacy-1_${EMAIL_KEY}`, ownerId: OWNER, senderId: OWNER,
            accountId: 'legacy-1', recipientEmail: 'guest@example.invalid', status: 'accepted'});
        await setDoc(doc(db, ...activeCompanyPath), account(false));
        await setDoc(doc(db, ...archivedCompanyPath), account(true));
        await setDoc(doc(db, ...archivedPath, 'attachments', 'attachment-1'), {name: 'allegato sintetico'});
        await setDoc(doc(db, 'users', OWNER, 'accountWidgets', 'widget-1'), {title: 'Widget sintetico'});
        await setDoc(doc(db, 'users', OWNER, 'sharedVaultData', 'shared-1'), {title: 'Credenziale sintetica'});
        await setDoc(doc(db, 'users', OWNER, 'contacts', 'contact-1'), {email: 'contatto@example.invalid'});
    });
});
after(async () => testEnv?.cleanup());

const asGuest = () => testEnv.authenticatedContext(GUEST, {email: 'guest@example.invalid'}).firestore();
const asPending = () => testEnv.authenticatedContext(PENDING).firestore();
const asStranger = () => testEnv.authenticatedContext(STRANGER).firestore();
const asOwner = () => testEnv.authenticatedContext(OWNER).firestore();
const asOwnerWithEmail = () => testEnv.authenticatedContext(OWNER, {email: 'owner@example.invalid'}).firestore();
const asStrangerWithEmail = () => testEnv.authenticatedContext(STRANGER, {email: 'stranger@example.invalid'}).firestore();
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

// M7-R7C-1 — la revoca è persistente: dopo il ripristino non basta `isArchived`
// falso, perché la lista dei grant è vuota e resta vuota.
test('Account ripristinato: l\'ospite precedente non rilegge', async () => {
    await assertFails(getDoc(doc(asGuest(), ...restoredPath)));
});

// M7-R7C-5: l'accesso torna solo dopo l'accettazione del NUOVO invito, cioè
// quando l'handler ricostruisce i grant sul ciclo corrente.
test('dopo l\'accettazione del nuovo invito l\'accesso torna', async () => {
    await assertFails(getDoc(doc(asGuest(), ...restoredPath)), 'prima dell\'accettazione nessun accesso');
    await testEnv.withSecurityRulesDisabled(async context => {
        await updateDoc(doc(context.firestore(), ...restoredPath), {sharedWithUids: [GUEST]});
    });
    await assertSucceeds(getDoc(doc(asGuest(), ...restoredPath)), 'con il grant accettato l\'ospite rilegge');
});

test('invito del ciclo precedente: leggibile dal destinatario ma senza accesso all\'Account', async () => {
    const snapshot = await assertSucceeds(getDoc(doc(asGuest(), ...guestInvitePath)));
    assert.equal(snapshot.data().sharingState, 'suspended');
    assert.equal(snapshot.data().accountName, undefined, 'l\'invito non contiene dati dell\'Account');
    assert.equal(snapshot.data().password, undefined);
    await assertFails(getDoc(doc(asGuest(), ...restoredPath)));
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

// M7-R7C-1 correzione (revisione Codex 21/09/2026): il campo `cycle` aggiunto dai
// tre scrittori deve essere ammesso dall'allowlist di creazione degli inviti,
// altrimenti Firebase rifiuterebbe OGNI nuovo invito, anche nel ciclo legacy.
const invitePayload = (overrides = {}) => ({
    inviteId: 'invito-sintetico', accountId: ACCOUNT, ownerId: OWNER, senderId: OWNER,
    senderEmail: 'owner@example.invalid', recipientEmail: 'guest@example.invalid',
    accountName: 'Account sintetico', type: 'account', status: 'pending',
    createdAt: '2026-01-01T00:00:00.000Z', notifyPush: false, notifyEmail: false, ...overrides
});

test('creazione invito: ciclo legacy (assente o 0) e ciclo avanzato sono ammessi al proprietario', async () => {
    const db = asOwnerWithEmail();
    await assertSucceeds(setDoc(doc(db, 'invites', 'invito-senza-ciclo'), invitePayload()));
    await assertSucceeds(setDoc(doc(db, 'invites', 'invito-ciclo-0'), invitePayload({inviteId: 'invito-ciclo-0', cycle: 0})));
    await assertSucceeds(setDoc(doc(db, 'invites', 'invito-ciclo-3'), invitePayload({inviteId: 'invito-ciclo-3', cycle: 3})));
});

test('creazione invito: ciclo malformato o fuori intervallo viene negato', async () => {
    const db = asOwnerWithEmail();
    const invalid = [['stringa', '1'], ['negativo', -1], ['decimale', 1.5], ['oltre-il-massimo', 9007199254740992]];
    for (const [nome, cycle] of invalid) {
        await assertFails(setDoc(doc(db, 'invites', `invito-${nome}`), invitePayload({inviteId: `invito-${nome}`, cycle})));
    }
});

test('creazione invito: un estraneo non può creare inviti per il proprietario', async () => {
    await assertFails(setDoc(doc(asStrangerWithEmail(), 'invites', 'invito-estraneo'), invitePayload({inviteId: 'invito-estraneo'})));
});

test('inviti del ciclo corrente e del ciclo precedente restano leggibili dal destinatario', async () => {
    await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'invites', 'invito-ciclo-1'), invitePayload({inviteId: 'invito-ciclo-1', cycle: 1}));
    });
    await assertSucceeds(getDoc(doc(asGuest(), 'invites', 'invito-ciclo-1')));
    await assertSucceeds(getDoc(doc(asGuest(), ...guestInvitePath)));
});

// M7-R7C-2 — il ripristino di un Account legacy neutralizza la condivisione nella
// stessa transazione: dopo il ripristino l'ospite precedente NON rilegge.
test('ripristino legacy: la transazione del proprietario revoca i grant e l\'ospite non rilegge', async () => {
    const db = asOwnerWithEmail();
    await assertSucceeds(runTransaction(db, async transaction => {
        const accountRef = doc(db, ...legacyPath);
        const snapshot = await transaction.get(accountRef);
        const current = snapshot.data();
        const inviteRef = doc(db, ...legacyInvitePath);
        const inviteSnapshot = await transaction.get(inviteRef);
        const sharedWith = {...current.sharedWith};
        sharedWith[EMAIL_KEY] = {...sharedWith[EMAIL_KEY], status: 'suspended', suspendedAt: '2026-01-01T00:00:00.000Z'};
        transaction.update(accountRef, {
            isArchived: false,
            sharedWith,
            sharedWithUids: [],
            acceptedCount: 0,
            sharingCycle: 1,
            revision: 2
        });
        if (inviteSnapshot.exists()) {
            transaction.update(inviteRef, {sharingState: 'suspended', suspendedAt: '2026-01-01T00:00:00.000Z'});
        }
    }));
    const stored = await readAsAdmin(...legacyPath);
    assert.equal(stored.data().isArchived, false);
    assert.deepEqual([...stored.data().sharedWithUids], []);
    assert.equal(stored.data().sharingCycle, 1);
    assert.equal(stored.data().sharedWith[EMAIL_KEY].status, 'suspended');
    const invite = await readAsAdmin(...legacyInvitePath);
    assert.equal(invite.data().sharingState, 'suspended');
    await assertSucceeds(getDoc(doc(asOwner(), ...legacyPath)), 'il proprietario rilegge il proprio Account');
    await assertFails(getDoc(doc(asGuest(), ...legacyPath)), 'l\'ospite precedente non rilegge dopo il ripristino');
});
