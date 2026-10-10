const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {randomUUID} = require('node:crypto');
const {HttpsError} = require('firebase-functions/v2/https');
const {inviteRefOf, responseEventId, buildAuditEvent, auditWriteDecision} = require('../audit-event-service');
const {assertTransactionGlobalPurgeUnlocked} = require('../archive-purge-global-lock');

// M7-R7B3 — risposta a un invito quando l'Account del proprietario è
// nell'Archivio.
// M7-AUDIT-4 — evento `invite-accepted`/`invite-rejected` scritto nella stessa
// transazione della risposta (opzione A, decisione D-7 di Diego).
// Il banco esegue il gestore REALE (`respondToInvitation`) estratto da
// `functions/index.js` e una transazione con la stessa semantica di Firestore:
// le letture fissano una versione, se un documento letto cambia prima del commit
// la transazione viene ritentata e il controllo viene rieseguito. Il giornale
// `journal` registra l'ordine delle chiamate, così la regola «prima le letture,
// poi le scritture» diventa verificabile: nel banco una `get` dopo una `set`
// funzionerebbe, in produzione no.
const source = readFileSync(require.resolve('../index'), 'utf8');
const emailGuard = source.slice(source.indexOf('function sanitizeEmail('), source.indexOf('function normalizeEmail('));
const handler = source.slice(source.indexOf('exports.respondToInvitation'), source.indexOf('// Separate from audit trigger:'));
const {buildAcceptanceReceipt} = require('../invite-acceptance-receipt');
const DELETE_FIELD = Symbol('delete-field');

const EMAIL = 'guest@example.invalid';
// `sanitizeEmail` sostituisce ogni carattere non alfanumerico con `_`.
const KEY = 'guest_example_invalid';
const UID = 'guest-uid';
const INVITE_ID = `account_${KEY}`;
const INVITE_PATH = `invites/${INVITE_ID}`;
const ACCOUNT_PATH = 'users/A/accounts/account';
const AUDIT_REF = '11111111-1111-4111-8111-111111111111';
const CORRUPT_REF = 'non-uuid';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Sostituto del `FieldValue.serverTimestamp()` reale: distinguibile da un `at`
// seminato, così la prova «l'evento presente non viene riscritto» è visibile.
const SERVER_TIMESTAMP = {__serverTimestamp: true};
const eventPath = id => `users/A/auditEvents/${id}`;
const EVENT_PATH = eventPath(`${AUDIT_REF}__accepted`);
const REJECTED_PATH = eventPath(`${AUDIT_REF}__rejected`);

// La regola di Firestore è «prima tutte le letture, poi le scritture»: una `get`
// dopo la prima scrittura accantonata non è valida in produzione. Questa guardia
// rende il difetto visibile nel banco (e la prova della prova lo dimostra).
function readFollowsWrite(journal) {
    const firstWrite = journal.findIndex(entry => entry[0] === 'write');
    if (firstWrite === -1) return false;
    return journal.map(entry => entry[0]).lastIndexOf('read') > firstWrite;
}

function assertReadsBeforeWrites(f) {
    assert.equal(readFollowsWrite(f.journal), false, 'nessuna lettura dopo la prima scrittura');
}

function fixture({archived = false, status = 'accepted', hook = null, accountCycle, inviteCycle,
    auditRef = AUDIT_REF, commitHook = null} = {}) {
    const account = {isArchived: archived, sharedWith: {[KEY]: {email: EMAIL, status: 'pending', uid: null}}};
    if (accountCycle !== undefined) account.sharingCycle = accountCycle;
    const invite = {inviteId: INVITE_ID, ownerId: 'A', senderId: 'A', accountId: 'account',
        recipientEmail: EMAIL, status: 'pending'};
    if (inviteCycle !== undefined) invite.cycle = inviteCycle;
    if (auditRef !== null) invite.auditRef = auditRef;
    const documents = new Map([
        [ACCOUNT_PATH, account],
        [INVITE_PATH, invite]
    ]);
    const versions = new Map();
    const reads = [], writes = [], journal = [], auditLogs = [], receiptInputs = [];
    let attempts = 0;
    const reference = path => ({path});
    const store = {
        collection: name => ({doc: key => reference(`${name}/${key}`)}),
        doc: path => reference(path),
        runTransaction: async callback => {
            for (let attempt = 1; attempt <= 5; attempt++) {
                attempts = attempt;
                const readVersions = new Map();
                const staged = [];
                const transaction = {
                    get: async target => {
                        reads.push(target.path);
                        journal.push(['read', target.path]);
                        const data = documents.get(target.path);
                        readVersions.set(target.path, versions.get(target.path) || 0);
                        const snapshot = {exists: data !== undefined, data: () => (data ? structuredClone(data) : undefined)};
                        hook?.({path: target.path, attempt, documents, versions});
                        return snapshot;
                    },
                    update: (target, patch) => { staged.push([target.path, patch]); journal.push(['write', target.path]); },
                    set: (target, patch) => { staged.push([target.path, patch]); journal.push(['write', target.path]); }
                };
                const result = await callback(transaction);
                const superseded = [...readVersions].some(([path, version]) => (versions.get(path) || 0) !== version);
                if (superseded) continue;
                // M7-AUDIT-4 — errore Firestore al commit: nessuna scrittura viene
                // applicata, come in una transazione che fallisce.
                commitHook?.({attempt, staged, documents, versions});
                for (const [path, patch] of staged) {
                    const next = {...documents.get(path), ...patch};
                    for (const key of Object.keys(next)) if (next[key] === DELETE_FIELD) delete next[key];
                    documents.set(path, next);
                    versions.set(path, (versions.get(path) || 0) + 1);
                    writes.push([path, patch]);
                }
                return result;
            }
            throw new Error('TRANSACTION_RETRY_EXHAUSTED');
        }
    };
    const context = vm.createContext({exports: {}, HttpsError, onCall: (_options, run) => run,
        assertTransactionGlobalPurgeUnlocked,
        admin: {firestore: () => store}, structuredClone, crypto: {randomUUID},
        FieldValue: {serverTimestamp: () => SERVER_TIMESTAMP, delete: () => DELETE_FIELD},
        buildAcceptanceReceipt: input => {
            const copy = structuredClone(input);
            receiptInputs.push(copy);
            return buildAcceptanceReceipt(copy);
        },
        console: {warn: (...args) => auditLogs.push(args)},
        inviteRefOf, responseEventId, buildAuditEvent, auditWriteDecision});
    vm.runInContext(emailGuard + handler, context);
    return {documents, writes, reads, journal, auditLogs, receiptInputs, get attempts() { return attempts; },
        archive: () => { documents.set(ACCOUNT_PATH, {...documents.get(ACCOUNT_PATH), isArchived: true});
            versions.set(ACCOUNT_PATH, (versions.get(ACCOUNT_PATH) || 0) + 1); },
        bumpCycle: value => { documents.set(ACCOUNT_PATH, {...documents.get(ACCOUNT_PATH), sharingCycle: value});
            versions.set(ACCOUNT_PATH, (versions.get(ACCOUNT_PATH) || 0) + 1); },
        respond: (requested = status) => context.exports.respondToInvitation({
            auth: {uid: UID, token: {email: EMAIL}},
            data: {inviteId: INVITE_ID, status: requested}
        })};
}

test('N1: ricevuta server atomica distinta da auditRef, rifiuto elimina legame precedente', async () => {
    const f = fixture();
    await f.respond();
    const receipt = f.documents.get(INVITE_PATH).acceptanceReceipt;
    assert.equal(receipt.guestUid, UID);
    assert.equal(receipt.ownerUid, 'A');
    assert.equal(receipt.kind, 'private');
    assert.equal(receipt.cycle, 0);
    assert.match(receipt.nonce, UUID);
    assert.notEqual(receipt.nonce, AUDIT_REF);
    const rejected = fixture();
    rejected.documents.get(INVITE_PATH).acceptanceReceipt = receipt;
    await rejected.respond('rejected');
    assert.equal('acceptanceReceipt' in rejected.documents.get(INVITE_PATH), false);
});

test('N1: retry reale del gestore conserva il nonce e applica una sola ricevuta', async () => {
    const f = fixture({hook: ({path, attempt, versions}) => {
        if (path === ACCOUNT_PATH && attempt === 1) versions.set(path, 1);
    }});
    await f.respond();
    assert.equal(f.attempts, 2);
    assert.equal(f.receiptInputs.length, 2);
    assert.match(f.receiptInputs[0].nonce, UUID);
    assert.equal(f.receiptInputs[0].nonce, f.receiptInputs[1].nonce);
    assert.equal(f.documents.get(INVITE_PATH).acceptanceReceipt.nonce, f.receiptInputs[0].nonce);
    assert.equal(f.writes.filter(([path]) => path === INVITE_PATH).length, 1);
});

test('N1: identificatore legacy non supportato elimina ricevuta obsoleta senza negare accettazione', async () => {
    const f = fixture();
    const companyPath = 'users/A/aziende/A@B/accounts/account';
    f.documents.set(companyPath, structuredClone(f.documents.get(ACCOUNT_PATH)));
    f.documents.set(INVITE_PATH, {...f.documents.get(INVITE_PATH), aziendaId: 'A@B',
        acceptanceReceipt: {nonce: 'obsolete'}});
    assert.deepEqual({...await f.respond()}, {ok: true, status: 'accepted'});
    assert.equal(f.receiptInputs.length, 1);
    assert.equal('acceptanceReceipt' in f.documents.get(INVITE_PATH), false);
    assert.deepEqual([...f.documents.get(companyPath).sharedWithUids], [UID]);
});

test('invito su Account archiviato: errore chiaro, nessuna scrittura, invito e condivisione intatti', async () => {
    for (const status of ['accepted', 'rejected']) {
        const f = fixture({archived: true, status});
        await assert.rejects(f.respond(status), error => error.code === 'failed-precondition'
            && error.details?.reason === 'ACCOUNT_ARCHIVED');
        assert.equal(f.writes.length, 0, 'nessuna scrittura quando l\'Account è sospeso');
        assert.equal(f.documents.get(INVITE_PATH).status, 'pending', 'l\'invito resta in attesa');
        assert.deepEqual(f.documents.get(ACCOUNT_PATH), {isArchived: true,
            sharedWith: {[KEY]: {email: EMAIL, status: 'pending', uid: null}}});
        assert.equal(f.attempts, 1, 'il rifiuto non richiede ritentativi');
    }
});

test('invito su Account attivo: comportamento invariato per accettazione e rifiuto', async () => {
    const accepted = fixture();
    assert.deepEqual({...await accepted.respond('accepted')}, {ok: true, status: 'accepted'});
    assert.deepEqual(accepted.writes.map(write => write[0]), [ACCOUNT_PATH, INVITE_PATH, EVENT_PATH]);
    const account = accepted.documents.get(ACCOUNT_PATH);
    assert.deepEqual([...account.sharedWithUids], [UID]);
    assert.equal(account.sharedWith[KEY].status, 'accepted');
    assert.equal(account.acceptedCount, 1);
    assert.equal(account.visibility, 'shared');
    assert.equal(accepted.documents.get(INVITE_PATH).status, 'accepted');
    assert.equal(accepted.documents.get(INVITE_PATH).guestUid, UID);

    const rejected = fixture({status: 'rejected'});
    assert.deepEqual({...await rejected.respond('rejected')}, {ok: true, status: 'rejected'});
    assert.deepEqual([...rejected.documents.get(ACCOUNT_PATH).sharedWithUids], []);
    assert.equal(rejected.documents.get(ACCOUNT_PATH).visibility, 'private');
    assert.equal(rejected.documents.get(INVITE_PATH).status, 'rejected');
    assert.equal(rejected.documents.get(INVITE_PATH).guestUid, null);
});

test('archiviazione concorrente fra lettura e commit: la transazione ritenta e non scrive', async () => {
    // L'archiviazione avviene subito dopo la lettura dell'Account da parte del
    // gestore: il commit rileva la versione cambiata e ritenta, come Firestore.
    let armed = true;
    const f = fixture({hook: ({path}) => {
        if (armed && path === ACCOUNT_PATH) { armed = false; f.archive(); }
    }});
    await assert.rejects(f.respond('accepted'), error => error.details?.reason === 'ACCOUNT_ARCHIVED');
    assert.equal(f.attempts, 2, 'il controllo viene rieseguito sullo stato aggiornato');
    assert.equal(f.writes.length, 0);
    assert.equal(f.documents.get(INVITE_PATH).status, 'pending');
    assert.deepEqual(f.documents.get(ACCOUNT_PATH).sharedWithUids, undefined);
});

test('invito elaborato altrove fra lettura e commit: la transazione ritenta e rifiuta l\'operazione', async () => {
    let armed = true;
    const f = fixture({hook: ({path, documents, versions}) => {
        if (armed && path === INVITE_PATH) {
            armed = false;
            versions.set(INVITE_PATH, (versions.get(INVITE_PATH) || 0) + 1);
            documents.set(INVITE_PATH, {...documents.get(INVITE_PATH), status: 'accepted'});
        }
    }});
    await assert.rejects(f.respond('accepted'), error => error.code === 'failed-precondition'
        && /già elaborato/.test(error.message));
    assert.equal(f.attempts, 2);
    assert.equal(f.writes.length, 0);
});

test('il percorso dell\'Account segue il contesto aziendale e resta confinato all\'invito', async () => {
    const f = fixture({archived: true});
    f.documents.set(INVITE_PATH, {...f.documents.get(INVITE_PATH), aziendaId: 'company-1'});
    f.documents.set('users/A/aziende/company-1/accounts/account', {isArchived: true,
        sharedWith: {[KEY]: {email: EMAIL, status: 'pending', uid: null}}});
    await assert.rejects(f.respond('accepted'), error => error.details?.reason === 'ACCOUNT_ARCHIVED');
    assert.ok(f.reads.includes('users/A/aziende/company-1/accounts/account'));
    assert.equal(f.writes.length, 0);
});

// M7-R7C-1 — ciclo dell'invito contro ciclo dell'Account: il ciclo legacy è 0 e
// non è mai «corrente per definizione».

test('ciclo legacy: invito senza `cycle` su Account senza `sharingCycle` resta rispondibile', async () => {
    const f = fixture();
    assert.deepEqual({...await f.respond('accepted')}, {ok: true, status: 'accepted'});
    assert.deepEqual([...f.documents.get(ACCOUNT_PATH).sharedWithUids], [UID]);
});

test('dopo l\'archiviazione l\'invito del ciclo precedente è negato con zero scritture', async () => {
    const f = fixture({archived: false, accountCycle: 1});
    await assert.rejects(f.respond('accepted'), error => error.code === 'failed-precondition'
        && error.details?.reason === 'INVITE_CYCLE_STALE');
    assert.equal(f.writes.length, 0);
    assert.equal(f.documents.get(INVITE_PATH).status, 'pending');
    assert.equal(f.documents.get(ACCOUNT_PATH).sharedWithUids, undefined, 'nessun grant ricreato');
    assert.ok(f.documents.get(ACCOUNT_PATH).sharingCycle > (f.documents.get(INVITE_PATH).cycle ?? 0),
        'il ciclo dell\'Account supera quello dell\'invito legacy');
});

test('ciclo completo: archivio, ripristino, risposta tardiva negata, nuovo invito valido', async () => {
    const archived = fixture({archived: true, accountCycle: 1});
    await assert.rejects(archived.respond('accepted'), error => error.details?.reason === 'ACCOUNT_ARCHIVED');
    assert.equal(archived.writes.length, 0);
    const restored = fixture({archived: false, accountCycle: 1});
    await assert.rejects(restored.respond('accepted'), error => error.details?.reason === 'INVITE_CYCLE_STALE');
    assert.equal(restored.writes.length, 0);
    const fresh = fixture({archived: false, accountCycle: 1, inviteCycle: 1});
    assert.deepEqual({...await fresh.respond('accepted')}, {ok: true, status: 'accepted'});
    assert.deepEqual([...fresh.documents.get(ACCOUNT_PATH).sharedWithUids], [UID]);
});

test('cicli malformati vengono rifiutati senza scritture', async () => {
    const cases = [[0, '1'], [0, -1], [0, 1.5], [1.5, 1], [-1, 1], [Number.MAX_SAFE_INTEGER + 2, 1]];
    for (const [accountCycle, inviteCycle] of cases) {
        const f = fixture({archived: false, accountCycle, inviteCycle});
        await assert.rejects(f.respond('accepted'), error => error.details?.reason === 'INVITE_CYCLE_STALE',
            `cicli Account/invito ${accountCycle}/${inviteCycle}`);
        assert.equal(f.writes.length, 0, `nessuna scrittura con cicli ${accountCycle}/${inviteCycle}`);
    }
});

test('un invito già elaborato resta rifiutato prima del confronto di ciclo', async () => {
    const f = fixture({archived: false, accountCycle: 1});
    f.documents.set(INVITE_PATH, {...f.documents.get(INVITE_PATH), status: 'accepted'});
    await assert.rejects(f.respond('accepted'), error => /già elaborato/.test(error.message));
    assert.equal(f.writes.length, 0);
});

test('archiviazione concorrente durante la risposta: il ciclo aggiornato nega l\'operazione', async () => {
    let armed = true;
    const f = fixture({hook: ({path}) => {
        if (armed && path === ACCOUNT_PATH) { armed = false; f.bumpCycle(1); }
    }});
    await assert.rejects(f.respond('accepted'), error => error.details?.reason === 'INVITE_CYCLE_STALE');
    assert.equal(f.attempts, 2, 'la transazione viene ritentata sul ciclo aggiornato');
    assert.equal(f.writes.length, 0);
});

// ─────────────────────────────────────────────────────────────
// M7-AUDIT-4 — evento di risposta nella stessa transazione (opzione A, D-7)
// ─────────────────────────────────────────────────────────────

test('risposta accettata con `auditRef`: evento nella stessa transazione, id opaco', async () => {
    const f = fixture();
    assert.deepEqual({...await f.respond('accepted')}, {ok: true, status: 'accepted'});
    assert.deepEqual(f.writes.map(write => write[0]), [ACCOUNT_PATH, INVITE_PATH, EVENT_PATH]);
    assert.deepEqual({...f.documents.get(EVENT_PATH)}, {schemaVersion: 1, action: 'invite-accepted',
        actorUid: 'A', accountId: 'account', context: 'privato', cycle: 0, guestKnown: true,
        guestUid: UID, at: SERVER_TIMESTAMP});
    assert.equal('responseAuditRef' in f.documents.get(INVITE_PATH), false,
        'invito con `auditRef` valido: nessun ripiego persistito');
    assert.ok(f.reads.includes(EVENT_PATH), 'il documento evento viene letto nella fase di lettura');
    assertReadsBeforeWrites(f);
});

test('risposta rifiutata: id distinto e nessun `guestUid` nel registro', async () => {
    const f = fixture({status: 'rejected'});
    assert.deepEqual({...await f.respond('rejected')}, {ok: true, status: 'rejected'});
    assert.deepEqual(f.writes.map(write => write[0]), [ACCOUNT_PATH, INVITE_PATH, REJECTED_PATH]);
    const event = f.documents.get(REJECTED_PATH);
    assert.equal(event.action, 'invite-rejected');
    assert.equal(event.guestKnown, false);
    assert.equal('guestUid' in event, false, 'risposta rifiutata: indicatore anonimo, nessun uid');
    assert.equal(f.documents.get(INVITE_PATH).guestUid, null);
});

test('invito legacy: base casuale persistita e un solo evento con quella base', async () => {
    const f = fixture({auditRef: null});
    assert.deepEqual({...await f.respond('accepted')}, {ok: true, status: 'accepted'});
    const invite = f.documents.get(INVITE_PATH);
    assert.equal('auditRef' in invite, false);
    assert.match(invite.responseAuditRef, UUID);
    const legacyPath = eventPath(`${invite.responseAuditRef}__accepted`);
    assert.deepEqual(f.writes.map(write => write[0]), [ACCOUNT_PATH, INVITE_PATH, legacyPath]);
    assert.equal(f.documents.get(legacyPath).action, 'invite-accepted');
    assert.equal(f.documents.get(legacyPath).guestUid, UID);
});

test('marcatore corrotto: nessun abort, ripiego sulla base casuale, `auditRef` invariato', async () => {
    const f = fixture({auditRef: CORRUPT_REF});
    assert.deepEqual({...await f.respond('accepted')}, {ok: true, status: 'accepted'});
    const invite = f.documents.get(INVITE_PATH);
    assert.equal(invite.auditRef, CORRUPT_REF, 'il marcatore corrotto non viene toccato');
    assert.match(invite.responseAuditRef, UUID);
    const fallbackPath = eventPath(`${invite.responseAuditRef}__accepted`);
    assert.equal(f.documents.get(fallbackPath).action, 'invite-accepted');
    assert.equal(f.auditLogs.length, 0, 'un marcatore corrotto non è un payload saltato');
});

test('payload audit non valido: la risposta riesce, nessun evento, una riga di log senza segreti', async () => {
    const f = fixture();
    f.documents.set(INVITE_PATH, {...f.documents.get(INVITE_PATH), aziendaId: 'A@B'});
    const companyPath = 'users/A/aziende/A@B/accounts/account';
    f.documents.set(companyPath, {isArchived: false,
        sharedWith: {[KEY]: {email: EMAIL, status: 'pending', uid: null}}});
    assert.deepEqual({...await f.respond('accepted')}, {ok: true, status: 'accepted'});
    assert.deepEqual(f.writes.map(write => write[0]), [companyPath, INVITE_PATH]);
    assert.equal([...f.documents.keys()].some(path => path.startsWith('users/A/auditEvents/')), false,
        'nessun evento quando il payload è rifiutato');
    assert.equal(f.auditLogs.length, 1, 'una sola riga di log');
    const [message, detail] = f.auditLogs[0];
    assert.equal(message, '[AUDIT] evento saltato');
    assert.equal(detail.code, 'AUDIT_FIELD_INVALID', 'codice tecnico stabile');
    assert.equal(detail.action, 'invite-accepted');
    assert.match(detail.correlationId, UUID);
    const logged = JSON.stringify(f.auditLogs);
    for (const secret of [EMAIL, KEY, INVITE_ID]) {
        assert.equal(logged.includes(secret), false, `il log non deve contenere ${secret}`);
    }
});

test('evento già presente: nessuna riscrittura, `at` e payload seminati intatti', async () => {
    const f = fixture();
    const seeded = {schemaVersion: 1, action: 'invite-accepted', actorUid: 'seeded', accountId: 'seeded',
        context: 'privato', cycle: 0, guestKnown: false, at: 'SEEDED'};
    f.documents.set(EVENT_PATH, seeded);
    assert.deepEqual({...await f.respond('accepted')}, {ok: true, status: 'accepted'});
    assert.deepEqual(f.documents.get(EVENT_PATH), seeded, 'create-if-absent non riscrive l\'evento');
    assert.deepEqual(f.writes.map(write => write[0]), [ACCOUNT_PATH, INVITE_PATH]);
    assert.ok(f.reads.includes(EVENT_PATH), 'l\'esistenza dell\'evento viene letta nella transazione');
});

test('fallimento transazionale: nessuna risposta e nessun evento (atomicità)', async () => {
    const f = fixture({commitHook: () => { throw new Error('FIRESTORE_UNAVAILABLE'); }});
    await assert.rejects(f.respond('accepted'), /FIRESTORE_UNAVAILABLE/);
    assert.equal(f.writes.length, 0, 'nessuna scrittura applicata');
    assert.equal(f.documents.get(INVITE_PATH).status, 'pending');
    assert.equal(f.documents.get(EVENT_PATH), undefined, 'nessuna riga per un\'azione non avvenuta');
    assert.deepEqual(f.documents.get(ACCOUNT_PATH).sharedWithUids, undefined, 'nessun grant senza risposta');
});

test('seconda invocazione dopo il commit: nessuna seconda risposta e nessun secondo evento', async () => {
    const f = fixture();
    await f.respond('accepted');
    const writes = f.writes.length;
    const reads = f.reads.length;
    await assert.rejects(f.respond('accepted'), error => error.code === 'failed-precondition'
        && /già elaborato/.test(error.message));
    assert.equal(f.writes.length, writes, 'la risposta già elaborata non scrive');
    assert.deepEqual(f.reads.slice(reads), [INVITE_PATH], 'la seconda invocazione si ferma alla prima lettura');
    assert.equal(f.auditLogs.length, 0);
});

test('registro senza segreti: nessuna email, chiave sanificata o id invito in id e payload', async () => {
    for (const requested of ['accepted', 'rejected']) {
        const f = fixture({status: requested});
        await f.respond(requested);
        const [path, patch] = f.writes.at(-1);
        const serialized = JSON.stringify(patch);
        assert.equal(/@/.test(serialized), false, 'nessuna email nel payload');
        for (const secret of [EMAIL, KEY, INVITE_ID]) {
            assert.equal(serialized.includes(secret), false, `nessun ${secret} nel payload`);
            assert.equal(path.includes(secret), false, `nessun ${secret} nell'id dell'evento`);
        }
        const expected = ['accountId', 'action', 'actorUid', 'at', 'context', 'cycle', 'guestKnown', 'schemaVersion'];
        if (requested === 'accepted') expected.push('guestUid');
        assert.deepEqual(Object.keys(patch).sort(), expected.sort(), `chiavi esatte per ${requested}`);
    }
});

test('ordine letture/scritture: invito, Account ed evento si leggono prima di ogni scrittura', async () => {
    const f = fixture();
    await f.respond('accepted');
    assert.deepEqual(f.journal.filter(entry => entry[0] === 'read').map(entry => entry[1]),
        [INVITE_PATH, 'archivePurgeLocks/A', ACCOUNT_PATH, EVENT_PATH]);
    assertReadsBeforeWrites(f);
});

test('la guardia dell\'ordine riconosce una lettura dopo la prima scrittura (prova della prova)', () => {
    assert.equal(readFollowsWrite([['read', 'a'], ['read', 'b'], ['write', 'c']]), false);
    assert.equal(readFollowsWrite([['read', 'a'], ['write', 'b'], ['read', 'c']]), true);
    assert.equal(readFollowsWrite([['write', 'a']]), false);
    assert.equal(readFollowsWrite([]), false);
});

// Correzione della revisione Codex — il log deve descrivere il tentativo che arriva
// al commit: un codice di salto di un tentativo scartato non deve sopravvivere.

test('conflitto dopo un salto: il tentativo finale scrive l\'evento e non logga il salto', async () => {
    let armed = true;
    const f = fixture({hook: ({path, documents, versions}) => {
        if (armed && path === INVITE_PATH) {
            armed = false;
            documents.set(INVITE_PATH, {...documents.get(INVITE_PATH), aziendaId: 'company-1'});
            versions.set(INVITE_PATH, (versions.get(INVITE_PATH) || 0) + 1);
        }
    }});
    // Primo tentativo: contesto non opaco, quindi payload rifiutato e audit saltato.
    f.documents.set(INVITE_PATH, {...f.documents.get(INVITE_PATH), aziendaId: 'A@B'});
    const guest = () => ({isArchived: false,
        sharedWith: {[KEY]: {email: EMAIL, status: 'pending', uid: null}}});
    f.documents.set('users/A/aziende/A@B/accounts/account', guest());
    f.documents.set('users/A/aziende/company-1/accounts/account', guest());
    assert.deepEqual({...await f.respond('accepted')}, {ok: true, status: 'accepted'});
    assert.equal(f.attempts, 2, 'il primo tentativo viene scartato per conflitto');
    assert.equal(f.auditLogs.length, 0, 'il tentativo finale scrive l\'evento: nessun log di salto');
    assert.equal(f.documents.get(EVENT_PATH).context, 'company-1',
        'il payload registrato è quello del tentativo finale');
    assert.deepEqual(f.writes.map(write => write[0]),
        ['users/A/aziende/company-1/accounts/account', INVITE_PATH, EVENT_PATH]);
});

test('sequenza inversa: audit valido poi saltato, risposta confermata e un solo log', async () => {
    let armed = true;
    const f = fixture({hook: ({path, documents, versions}) => {
        if (armed && path === INVITE_PATH) {
            armed = false;
            documents.set(INVITE_PATH, {...documents.get(INVITE_PATH), aziendaId: 'A@B'});
            versions.set(INVITE_PATH, (versions.get(INVITE_PATH) || 0) + 1);
        }
    }});
    // Primo tentativo: contesto opaco, quindi payload valido ed evento pianificato.
    f.documents.set(INVITE_PATH, {...f.documents.get(INVITE_PATH), aziendaId: 'company-1'});
    const guest = () => ({isArchived: false,
        sharedWith: {[KEY]: {email: EMAIL, status: 'pending', uid: null}}});
    f.documents.set('users/A/aziende/A@B/accounts/account', guest());
    f.documents.set('users/A/aziende/company-1/accounts/account', guest());
    assert.deepEqual({...await f.respond('accepted')}, {ok: true, status: 'accepted'});
    assert.equal(f.attempts, 2);
    assert.equal([...f.documents.keys()].some(path => path.startsWith('users/A/auditEvents/')), false,
        'la scrittura del primo tentativo non viene applicata');
    assert.equal(f.auditLogs.length, 1, 'un solo log, dal tentativo finale');
    assert.equal(f.auditLogs[0][1].code, 'AUDIT_FIELD_INVALID');
    assert.deepEqual([...f.documents.get('users/A/aziende/A@B/accounts/account').sharedWithUids], [UID],
        'la risposta è confermata anche senza evento');
    assert.deepEqual(f.writes.map(write => write[0]), ['users/A/aziende/A@B/accounts/account', INVITE_PATH]);
});
