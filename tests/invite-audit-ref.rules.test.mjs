import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assertFails, assertSucceeds, initializeTestEnvironment} from '@firebase/rules-unit-testing';
import {deleteDoc, deleteField, doc, getDoc, runTransaction, setDoc, updateDoc} from 'firebase/firestore';

// M7-AUDIT-5R — Rules di `invites`: marcatore opaco `auditRef`, protezione di
// `responseAuditRef` e campi aggiornabili ristretti (decisione D-6 di Codex del
// 21/09/2026, allowlist verificata in M7-AUDIT-5P-R1 §3).
//
// Il banco carica le Rules di PRODUZIONE del ramo (`firestore.rules`) e usa
// Firestore Rules Emulator con dati sintetici. I documenti che la callable Admin
// scriverebbe (guestUid, respondedAt, responseAuditRef, sharingState,
// suspendedAt) sono seminati con le Rules disattivate, perché l'Admin SDK le
// ignora: il banco prova **il comportamento dei client** su quei documenti.
const PROJECT_ID = 'codici-password-invite-audit-ref-test';
const OWNER = 'owner', GUEST = 'guest', STRANGER = 'stranger';
const ACCOUNT = 'account-1';
const EMAIL = 'guest@example.invalid';
const OWNER_EMAIL = 'owner@example.invalid';
const GUEST_UID = 'guest-uid';
const REF_A = '11111111-1111-4111-8111-111111111111';
const REF_B = '22222222-2222-4222-8222-222222222222';
const INVITE_ID = `${ACCOUNT}_guest_example_invalid`;
let testEnv;

const asOwner = () => testEnv.authenticatedContext(OWNER, {email: OWNER_EMAIL}).firestore();
const asGuest = () => testEnv.authenticatedContext(GUEST, {email: EMAIL}).firestore();
const asStranger = () => testEnv.authenticatedContext(STRANGER, {email: 'stranger@example.invalid'}).firestore();

// Le 14 chiavi che i tre writer reali di creazione/reinvito scrivono
// (`form-privato-save.js:341`, `form-azienda-save.js:248`,
// `detail-account-mode.js:174`), più `auditRef` dove la prova lo richiede.
const invitePayload = (overrides = {}) => ({
    inviteId: INVITE_ID, accountId: ACCOUNT, ownerId: OWNER, senderId: OWNER,
    senderEmail: OWNER_EMAIL, recipientEmail: EMAIL, accountName: 'Account sintetico',
    type: 'account', status: 'pending', createdAt: '2026-01-01T00:00:00.000Z',
    notifyPush: false, notifyEmail: false, cycle: 0, ...overrides
});

// `withSecurityRulesDisabled` non restituisce il valore del callback: le due
// utilità lo assegnano a una variabile esterna (stesso pattern di
// `tests/sharing-revocation.rules.test.mjs:51-56`).
async function seed(id, data) {
    await testEnv.withSecurityRulesDisabled(async context => {
        await setDoc(doc(context.firestore(), 'invites', id), data);
    });
}

async function readAsAdmin(id) {
    let snapshot;
    await testEnv.withSecurityRulesDisabled(async context => {
        snapshot = await getDoc(doc(context.firestore(), 'invites', id));
    });
    return snapshot;
}

// Documento di un invito legacy già risposto: la callable ha aggiunto
// `guestUid`, `respondedAt` e (solo per i legacy) `responseAuditRef`.
const answeredLegacy = (overrides = {}) => ({
    ...invitePayload({status: 'rejected'}), guestUid: null,
    respondedAt: '2026-01-02T00:00:00.000Z', responseAuditRef: REF_A, ...overrides
});

before(async () => {
    testEnv = await initializeTestEnvironment({
        projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')}
    });
});
beforeEach(async () => {
    await testEnv.clearFirestore();
});
after(async () => {
    await testEnv.cleanup();
});

// ─────────────────────────────────────────────────────────────
// Creazione: `auditRef` facoltativo con forma validata
// ─────────────────────────────────────────────────────────────

test('creazione: auditRef valido (anche maiuscolo) e assenza legacy sono ammessi', async () => {
    const db = asOwner();
    await assertSucceeds(setDoc(doc(db, 'invites', 'nuovo-con-ref'), invitePayload({auditRef: REF_A})));
    await assertSucceeds(setDoc(doc(db, 'invites', 'nuovo-ref-maiuscolo'), invitePayload({auditRef: REF_A.toUpperCase()})));
    await assertSucceeds(setDoc(doc(db, 'invites', 'nuovo-senza-ref'), invitePayload()));
});

test('creazione: auditRef di forma non valida viene negato', async () => {
    const db = asOwner();
    const invalid = [['numero', 42], ['stringa-non-uuid', 'non-uuid'], ['corta', REF_A.slice(0, 35)],
        ['lunga', `${REF_A}a`], ['vuota', ''], ['booleano', true]];
    for (const [nome, auditRef] of invalid) {
        await assertFails(setDoc(doc(db, 'invites', `nuovo-${nome}`), invitePayload({auditRef})),
            `auditRef ${nome} doveva essere negato`);
    }
});

test('creazione: responseAuditRef e chiavi fuori allowlist sono negati', async () => {
    const db = asOwner();
    await assertFails(setDoc(doc(db, 'invites', 'nuovo-con-response-ref'),
        invitePayload({responseAuditRef: REF_A})));
    await assertFails(setDoc(doc(db, 'invites', 'nuovo-con-guest-uid'),
        invitePayload({guestUid: GUEST_UID})));
});

// ─────────────────────────────────────────────────────────────
// Aggiornamenti leciti su inviti già risposti (merge: il campo resta)
// ─────────────────────────────────────────────────────────────

test('rifiutato legacy → «Archivia»: senderNotified ammesso e responseAuditRef conservato', async () => {
    await seed('rifiutato', answeredLegacy());
    await assertSucceeds(updateDoc(doc(asOwner(), 'invites', 'rifiutato'), {senderNotified: true}));
    const stored = await readAsAdmin('rifiutato');
    assert.equal(stored.data().senderNotified, true);
    assert.equal(stored.data().responseAuditRef, REF_A, 'il marcatore della callable resta');
    assert.equal(stored.data().guestUid, null);
    assert.equal(stored.data().respondedAt, '2026-01-02T00:00:00.000Z');
});

test('archiviazione Account su invito risposto: sharingState/suspendedAt ammessi, marcatore intatto', async () => {
    await seed('accettato', answeredLegacy({status: 'accepted', guestUid: GUEST_UID}));
    const db = asOwner();
    await assertSucceeds(runTransaction(db, async transaction => {
        const ref = doc(db, 'invites', 'accettato');
        await transaction.get(ref);
        transaction.update(ref, {sharingState: 'suspended', suspendedAt: '2026-01-03T00:00:00.000Z'});
    }));
    const stored = await readAsAdmin('accettato');
    assert.equal(stored.data().sharingState, 'suspended');
    assert.equal(stored.data().responseAuditRef, REF_A, 'il marcatore della callable resta');
    assert.equal(stored.data().status, 'accepted');
});

test('ripristino neutralizzato su invito risposto: come l\'archiviazione', async () => {
    await seed('ripristinato', answeredLegacy({status: 'accepted', guestUid: GUEST_UID}));
    const db = asOwner();
    await assertSucceeds(runTransaction(db, async transaction => {
        const ref = doc(db, 'invites', 'ripristinato');
        await transaction.get(ref);
        transaction.update(ref, {sharingState: 'suspended', suspendedAt: '2026-01-04T00:00:00.000Z'});
    }));
    const stored = await readAsAdmin('ripristinato');
    assert.equal(stored.data().sharingState, 'suspended');
    assert.equal(stored.data().responseAuditRef, REF_A);
});

// ─────────────────────────────────────────────────────────────
// Reinvito full-replace: rimuove i campi che non riscrive
// ─────────────────────────────────────────────────────────────

test('reinvito di un rifiutato legacy: rimuove guestUid, respondedAt e responseAuditRef', async () => {
    await seed('reinvito-rifiutato', answeredLegacy());
    await assertSucceeds(setDoc(doc(asOwner(), 'invites', 'reinvito-rifiutato'),
        invitePayload({auditRef: REF_B, createdAt: '2026-01-05T00:00:00.000Z'})));
    const stored = await readAsAdmin('reinvito-rifiutato').then(snapshot => snapshot.data());
    assert.equal(stored.status, 'pending');
    assert.equal(stored.auditRef, REF_B);
    assert.equal('responseAuditRef' in stored, false, 'il marcatore della callable sparisce col rimpiazzo');
    assert.equal('guestUid' in stored, false);
    assert.equal('respondedAt' in stored, false);
});

test('reinvito di un invito sospeso: rimuove sharingState e suspendedAt', async () => {
    await seed('reinvito-sospeso', answeredLegacy({status: 'accepted', guestUid: GUEST_UID,
        sharingState: 'suspended', suspendedAt: '2026-01-03T00:00:00.000Z', senderNotified: true}));
    await assertSucceeds(setDoc(doc(asOwner(), 'invites', 'reinvito-sospeso'),
        invitePayload({auditRef: REF_B, createdAt: '2026-01-06T00:00:00.000Z'})));
    const stored = await readAsAdmin('reinvito-sospeso').then(snapshot => snapshot.data());
    assert.equal('sharingState' in stored, false);
    assert.equal('suspendedAt' in stored, false);
    assert.equal('senderNotified' in stored, false);
    assert.equal(stored.status, 'pending');
});

test('primo update di un invito legacy senza ciclo: l\'aggiunta di cycle è ammessa', async () => {
    // Un invito legacy non ha `cycle`: il primo update che lo aggiunge (valore 0)
    // produce una chiave **aggiunta** in `affectedKeys()`, quindi `cycle` deve
    // restare nella allowlist anche se nessun writer lo cambia su un documento
    // esistente.
    const senzaCiclo = invitePayload({status: 'rejected', guestUid: null,
        respondedAt: '2026-01-02T00:00:00.000Z'});
    delete senzaCiclo.cycle;
    await seed('legacy-senza-ciclo', senzaCiclo);
    await assertSucceeds(updateDoc(doc(asOwner(), 'invites', 'legacy-senza-ciclo'), {cycle: 0}));
    const stored = await readAsAdmin('legacy-senza-ciclo');
    assert.equal(stored.data().cycle, 0);
});

// ─────────────────────────────────────────────────────────────
// Marcatore opaco: forma in update e limiti dichiarati
// ─────────────────────────────────────────────────────────────

test('update: auditRef nuovo e valido è ammesso (limite D-8 dichiarato), malformato negato', async () => {
    await seed('cambio-ref', invitePayload({auditRef: REF_A}));
    // D-8: il reinvito resta un update sullo stesso documento, quindi il
    // proprietario può cambiare `auditRef` in un UUID nuovo. È il limite
    // dichiarato (registro best-effort), non una svista delle Rules.
    await assertSucceeds(updateDoc(doc(asOwner(), 'invites', 'cambio-ref'), {auditRef: REF_B}));
    for (const valore of ['non-uuid', REF_A.slice(0, 35), `${REF_A}a`, 42, '', true]) {
        await assertFails(updateDoc(doc(asOwner(), 'invites', 'cambio-ref'), {auditRef: valore}),
            `auditRef ${String(valore)} doveva essere negato in update`);
    }
    const stored = await readAsAdmin('cambio-ref');
    assert.equal(stored.data().auditRef, REF_B, 'il marcatore resta quello valido');
});

// ─────────────────────────────────────────────────────────────
// responseAuditRef: inserimento e modifica negati, rimozione consentita
// ─────────────────────────────────────────────────────────────

test('responseAuditRef: inserimento, inserimento nullo e modifica sono negati', async () => {
    await seed('senza-response-ref', invitePayload({auditRef: REF_A}));
    const db = asOwner();
    await assertFails(updateDoc(doc(db, 'invites', 'senza-response-ref'), {responseAuditRef: REF_B}));
    await assertFails(updateDoc(doc(db, 'invites', 'senza-response-ref'), {responseAuditRef: null}));

    await seed('con-response-ref', answeredLegacy({auditRef: REF_A}));
    await assertFails(updateDoc(doc(db, 'invites', 'con-response-ref'), {responseAuditRef: REF_B}));
    const stored = await readAsAdmin('con-response-ref');
    assert.equal(stored.data().responseAuditRef, REF_A, 'il valore della callable non è alterabile');
});

test('responseAuditRef: la conservazione invariata è ammessa e la rimozione è il limite dichiarato', async () => {
    await seed('conserva', answeredLegacy({auditRef: REF_A}));
    await assertSucceeds(updateDoc(doc(asOwner(), 'invites', 'conserva'), {accountName: 'Nome nuovo'}));
    const conservato = await readAsAdmin('conserva');
    assert.equal(conservato.data().responseAuditRef, REF_A);
    assert.equal(conservato.data().accountName, 'Nome nuovo');

    // D-8 (decisione di Diego del 21/09/2026): il reinvito è una `set` senza merge
    // e deve poter rimuovere il campo. La Rule non distingue quella rimozione da
    // una isolata: il limite è dichiarato nel piano e tocca solo il registro
    // best-effort di chi lo esegue.
    await assertSucceeds(updateDoc(doc(asOwner(), 'invites', 'conserva'), {responseAuditRef: deleteField()}));
    const rimosso = await readAsAdmin('conserva');
    assert.equal('responseAuditRef' in rimosso.data(), false);
});

// ─────────────────────────────────────────────────────────────
// Campi fuori allowlist e proprietario
// ─────────────────────────────────────────────────────────────

test('update: i campi fuori allowlist sono negati (identità, destinatario, riferimenti)', async () => {
    await seed('protetto', invitePayload({auditRef: REF_A}));
    const db = asOwner();
    const fuoriAllowlist = [['ownerId', 'altro-uid'], ['senderId', 'altro-uid'],
        ['senderEmail', 'altro@example.invalid'], ['recipientEmail', 'altro@example.invalid'],
        ['inviteId', 'altro-id'], ['accountId', 'altro-account'], ['aziendaId', 'altra-azienda']];
    for (const [campo, valore] of fuoriAllowlist) {
        await assertFails(updateDoc(doc(db, 'invites', 'protetto'), {[campo]: valore}),
            `${campo} doveva essere negato`);
    }
    const stored = await readAsAdmin('protetto');
    assert.equal(stored.data().ownerId, OWNER);
    assert.equal(stored.data().recipientEmail, EMAIL);
});

test('update: la semantica di affectedKeys() comprende le rimozioni', async () => {
    // Prova della prova (§5, caso 23 del piano): una rimozione **non** in
    // allowlist è negata, una rimozione **in** allowlist è consentita. Se questo
    // non valesse, la allowlist non coprirebbe i campi che il reinvito fa sparire.
    await seed('rimozioni', answeredLegacy({auditRef: REF_A}));
    const db = asOwner();
    await assertFails(updateDoc(doc(db, 'invites', 'rimozioni'), {inviteId: deleteField()}));
    await assertSucceeds(updateDoc(doc(db, 'invites', 'rimozioni'), {guestUid: deleteField()}));
    const stored = await readAsAdmin('rimozioni');
    assert.equal('guestUid' in stored.data(), false);
    assert.equal(stored.data().inviteId, INVITE_ID, 'la rimozione negata non ha modificato nulla');
});

test('cancellazione e aggiornamento restano del proprietario', async () => {
    await seed('del-owner', invitePayload({auditRef: REF_A}));
    await assertFails(deleteDoc(doc(asGuest(), 'invites', 'del-owner')));
    await assertFails(deleteDoc(doc(asStranger(), 'invites', 'del-owner')));
    await assertFails(updateDoc(doc(asGuest(), 'invites', 'del-owner'), {senderNotified: true}));
    await assertFails(updateDoc(doc(asStranger(), 'invites', 'del-owner'), {senderNotified: true}));
    await assertSucceeds(deleteDoc(doc(asOwner(), 'invites', 'del-owner')));
    const stored = await readAsAdmin('del-owner');
    assert.equal(stored.exists(), false, 'la revoca del proprietario resta possibile');
});

test('update ordinario dei campi del reinvito: ammesso quando i valori cambiano', async () => {
    await seed('ordinario', invitePayload({auditRef: REF_A}));
    await assertSucceeds(updateDoc(doc(asOwner(), 'invites', 'ordinario'),
        {accountName: 'Nome aggiornato', notifyPush: true, status: 'pending'}));
    const stored = await readAsAdmin('ordinario');
    assert.equal(stored.data().accountName, 'Nome aggiornato');
    assert.equal(stored.data().notifyPush, true);
});

test('lettura: proprietario e destinatario leggono, l\'estraneo no', async () => {
    await seed('leggibile', invitePayload({auditRef: REF_A}));
    await assertSucceeds(getDoc(doc(asOwner(), 'invites', 'leggibile')));
    await assertSucceeds(getDoc(doc(asGuest(), 'invites', 'leggibile')));
    await assertFails(getDoc(doc(asStranger(), 'invites', 'leggibile')));
});
