const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {
    auditWriteDecision, buildAuditEvent, inviteTransition, invitedEventId, removedEventId
} = require('../audit-event-service');

// M7-AUDIT-5I — trigger `onInviteWritten` su `invites/{inviteId}`. Il banco
// esegue il gestore REALE estratto da `functions/index.js` su una transazione
// finta con la semantica di Firestore (create-if-absent) e verifica:
// classificazione, idempotenza della riconsegna, risposta che non produce un
// nuovo evento di creazione, consegna in ordine invertito, creazione e rimozione
// legacy, marcatore corrotto (anche con `responseAuditRef` valido), assenza di
// dati personali ed errori controllabili che non producono falsi eventi.
const source = readFileSync(require.resolve('../index'), 'utf8');
const start = source.indexOf('exports.onInviteWritten');
// Il gestore finisce dove comincia la sezione Account (M7-AUDIT-5A): il confine
// è un altro export, non un commento, come nel banco di `respondToInvitation`.
const end = source.indexOf('exports.onPrivateAccountWritten', start);
const handler = source.slice(start, end);

const OWNER = 'owner';
const ACCOUNT = 'account-1';
const EMAIL = 'guest@example.invalid';
// `sanitizeEmail` sostituisce ogni carattere non alfanumerico con `_`.
const KEY = 'guest_example_invalid';
const INVITE_ID = `account-1_${KEY}`;
const REF_A = '11111111-1111-4111-8111-111111111111';
const REF_B = '22222222-2222-4222-8222-222222222222';
const CORRUPT_REF = 'non-uuid';
const CREATED_AT = '2026-09-21T10:00:00.000Z';
const GUEST_UID = 'guest-uid';
const eventPath = id => `users/${OWNER}/auditEvents/${id}`;

// Le 14 chiavi scritte dai client di creazione/reinvito (M7-AUDIT-5C) più il
// marcatore: nessun campo derivato dall'email o dall'id del documento.
const invite = (overrides = {}) => ({
    inviteId: INVITE_ID, accountId: ACCOUNT, ownerId: OWNER, senderId: OWNER,
    senderEmail: 'owner@example.invalid', recipientEmail: EMAIL, accountName: 'Account sintetico',
    type: 'account', status: 'pending', createdAt: CREATED_AT, notifyPush: false, notifyEmail: false,
    cycle: 0, ...overrides
});

function fixture() {
    const documents = new Map();
    const writes = [];
    const logs = [];
    let atCount = 0;
    const store = {
        doc: path => ({path}),
        runTransaction: async callback => {
            const staged = [];
            await callback({
                get: async target => ({exists: documents.has(target.path)}),
                set: (target, patch) => staged.push([target.path, patch])
            });
            for (const [path, patch] of staged) {
                documents.set(path, {...patch});
                writes.push([path, patch]);
            }
        }
    };
    const context = vm.createContext({
        exports: {},
        onDocumentWritten: (_options, run) => run,
        inviteTransition, invitedEventId, removedEventId, buildAuditEvent, auditWriteDecision,
        firestore: () => store,
        FieldValue: {serverTimestamp: () => ({__at: ++atCount})},
        console: {warn: (...args) => logs.push(args), error: (...args) => logs.push(args)}
    });
    vm.runInContext(handler, context);
    return {documents, writes, logs,
        deliver: (before, after) => context.exports.onInviteWritten({
            data: {before: {data: () => before}, after: {data: () => after}},
            params: {inviteId: INVITE_ID}
        })};
}

test('creazione: evento nel registro del proprietario, id e payload opachi', async () => {
    const f = fixture();
    await f.deliver(null, invite({auditRef: REF_A}));
    assert.deepEqual(f.writes.map(write => write[0]), [eventPath(`${REF_A}__invited`)]);
    assert.deepEqual({...f.writes[0][1]}, {schemaVersion: 1, action: 'invite-created', actorUid: OWNER,
        accountId: ACCOUNT, context: 'privato', cycle: 0, inviteCreatedAt: CREATED_AT, at: {__at: 1}});
    assert.equal(f.logs.length, 0, 'nessun log su un evento scritto');
});

test('creazione legacy senza base valida: nessuna riga e nessun log', async () => {
    const f = fixture();
    await f.deliver(null, invite());
    await f.deliver(null, invite({auditRef: null}));
    assert.equal(f.writes.length, 0, 'nessun id inventato per un invito legacy (D-5)');
    assert.equal(f.logs.length, 0, 'la finestra legacy non è un difetto da loggare');
});

test('reinvito: base nuova, evento distinto dalla prima istanza', async () => {
    const f = fixture();
    await f.deliver(invite({auditRef: REF_A}), invite({auditRef: REF_B}));
    assert.deepEqual(f.writes.map(write => write[0]), [eventPath(`${REF_B}__invited`)]);
    assert.equal(f.writes[0][1].action, 'invite-created');
});

test('update ordinario, risposta e sospensione non producono un nuovo invito', async () => {
    const f = fixture();
    await f.deliver(invite({auditRef: REF_A}), invite({auditRef: REF_A, senderNotified: true}));
    await f.deliver(invite({auditRef: REF_A}), invite({auditRef: REF_A, status: 'accepted',
        guestUid: GUEST_UID, respondedAt: CREATED_AT, responseAuditRef: REF_B}));
    await f.deliver(invite({auditRef: REF_A, status: 'accepted'}),
        invite({auditRef: REF_A, status: 'accepted', sharingState: 'suspended', suspendedAt: CREATED_AT}));
    assert.equal(f.writes.length, 0, 'solo un cambio di base è una nuova istanza');
    assert.equal(f.logs.length, 0);
});

test('cancellazione: id opaco e correlatore del destinatario solo se già noto', async () => {
    const f = fixture();
    await f.deliver(invite({auditRef: REF_A, status: 'accepted', guestUid: GUEST_UID}), null);
    await f.deliver(invite({auditRef: REF_B, status: 'rejected', guestUid: null}), null);
    assert.deepEqual(f.writes.map(write => write[0]),
        [eventPath(`${REF_A}__removed`), eventPath(`${REF_B}__removed`)]);
    assert.deepEqual({...f.writes[0][1]}, {schemaVersion: 1, action: 'invite-removed', actorUid: OWNER,
        accountId: ACCOUNT, context: 'privato', cycle: 0, guestKnown: true, guestUid: GUEST_UID, at: {__at: 1}});
    assert.equal(f.writes[1][1].guestKnown, false);
    assert.equal('guestUid' in f.writes[1][1], false, 'su un rifiuto il destinatario resta anonimo');
});

test('cancellazione legacy risposta: la base è responseAuditRef', async () => {
    const f = fixture();
    await f.deliver(invite({status: 'accepted', guestUid: null, responseAuditRef: REF_B}), null);
    assert.deepEqual(f.writes.map(write => write[0]), [eventPath(`${REF_B}__removed`)]);
});

test('cancellazione senza alcuna base: nessuna riga e nessun log (D-5)', async () => {
    const f = fixture();
    await f.deliver(invite({status: 'rejected'}), null);
    assert.equal(f.writes.length, 0, 'un id casuale per consegna genererebbe duplicati: non si scrive');
    assert.equal(f.logs.length, 0);
});

test('marcatore corrotto con responseAuditRef valido: la rimozione usa la base valida', async () => {
    const f = fixture();
    await f.deliver(invite({auditRef: CORRUPT_REF, status: 'accepted', guestUid: null,
        responseAuditRef: REF_B}), null);
    assert.deepEqual(f.writes.map(write => write[0]), [eventPath(`${REF_B}__removed`)],
        'la correzione M7-AUDIT-5I: il marcatore corrotto non fa perdere la riga');
    assert.equal(f.logs.length, 0);
});

test('marcatore corrotto: nessuna eccezione, nessuna riga, un solo log per consegna', async () => {
    const f = fixture();
    await f.deliver(null, invite({auditRef: CORRUPT_REF}));
    await f.deliver(invite({auditRef: CORRUPT_REF}), invite({auditRef: CORRUPT_REF, status: 'pending'}));
    await f.deliver(invite({auditRef: CORRUPT_REF}), null);
    assert.equal(f.writes.length, 0, 'un documento malformato non produce eventi');
    assert.equal(f.logs.length, 3, 'una sola riga per ciascuna consegna, senza eccezioni');
    for (const [message, detail] of f.logs) {
        assert.equal(message, '[AUDIT] invito ignorato: base opaca non valida');
        assert.equal(detail.code, 'AUDIT_REF_INVALID');
    }
});

test('payload non valido: nessun falso evento, un solo log con codice stabile', async () => {
    const cases = [
        ['ciclo malformato', invite({auditRef: REF_A, cycle: '1.5'})],
        ['contesto non opaco', invite({auditRef: REF_A, aziendaId: 'A@B'})],
        ['ownerId assente', {...invite({auditRef: REF_A}), ownerId: undefined}],
        ['createdAt non ISO', invite({auditRef: REF_A, createdAt: 'ieri'})]
    ];
    for (const [nome, document] of cases) {
        const f = fixture();
        await f.deliver(null, document);
        assert.equal(f.writes.length, 0, `${nome}: nessun evento`);
        assert.equal(f.logs.length, 1, `${nome}: una sola riga`);
        assert.equal(f.logs[0][0], '[AUDIT] evento invito saltato');
        assert.equal(f.logs[0][1].code, 'AUDIT_FIELD_INVALID', `${nome}: codice stabile`);
    }
});

test('idempotenza: la riconsegna non duplica e non riscrive `at`', async () => {
    const f = fixture();
    const delivery = invite({auditRef: REF_A});
    await f.deliver(null, delivery);
    await f.deliver(null, delivery);
    assert.equal(f.writes.length, 1, 'create-if-absent: una sola scrittura');
    assert.deepEqual(f.writes[0][1].at, {__at: 1}, 'l\'`at` resta quello della prima scrittura');
});

test('consegna in ordine invertito: l\'evento di risposta non viene sovrascritto', async () => {
    const f = fixture();
    // La callable di risposta ha già scritto il proprio evento per la stessa
    // istanza (`functions/index.js`, M7-AUDIT-4): la creazione arriva dopo.
    f.documents.set(eventPath(`${REF_A}__accepted`), {schemaVersion: 1, action: 'invite-accepted',
        at: 'SEEDED'});
    await f.deliver(null, invite({auditRef: REF_A}));
    assert.deepEqual(f.writes.map(write => write[0]), [eventPath(`${REF_A}__invited`)]);
    assert.deepEqual(f.documents.get(eventPath(`${REF_A}__accepted`)), {schemaVersion: 1,
        action: 'invite-accepted', at: 'SEEDED'}, 'l\'evento di risposta resta intatto');
});

test('nessun dato personale in id, payload e log', async () => {
    const f = fixture();
    await f.deliver(null, invite({auditRef: REF_A}));
    await f.deliver(invite({auditRef: REF_A}), invite({auditRef: REF_B}));
    await f.deliver(invite({auditRef: REF_B, status: 'accepted', guestUid: GUEST_UID}), null);
    await f.deliver(null, invite({auditRef: CORRUPT_REF}));
    await f.deliver(null, invite({auditRef: REF_A, cycle: 'x'}));
    const serialized = JSON.stringify({writes: f.writes, logs: f.logs});
    for (const secret of [EMAIL, KEY, INVITE_ID]) {
        assert.equal(serialized.includes(secret), false, `nessun ${secret} in eventi o log`);
    }
    assert.equal(/@/.test(serialized), false, 'nessuna email in eventi o log');
});
