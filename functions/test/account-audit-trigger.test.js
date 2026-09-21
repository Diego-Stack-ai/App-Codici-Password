const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {
    accountEventId, accountTransition, auditWriteDecision, buildAuditEvent
} = require('../audit-event-service');

// M7-AUDIT-5A — trigger Account (`onDocumentUpdated`) su percorso privato e
// aziendale. Il banco esegue il gestore REALE e le due registrazioni estratte da
// `functions/index.js`, quindi prova anche che il **tipo** dell'Account sia
// legato alla registrazione e non dedotto dal documento.
//
// Correzione M7-AUDIT-5A: il payload conta le **voci di condivisione** che
// passano da `pending`/`accepted` a `suspended` (confronto `before`/`after`), mai
// i documenti invito — che il trigger non può conoscere. Il banco non contiene
// alcun documento invito: i conteggi provano quindi di essere una metrica delle
// voci.
const source = readFileSync(require.resolve('../index'), 'utf8');
const start = source.indexOf('async function recordAccountTransitionAudit(');
const end = source.indexOf('// UTILITY — Componi e invia una email per una scadenza', start);
const handler = source.slice(start, end);

const OWNER = 'owner';
const ACCOUNT = 'account-1';
const COMPANY = 'company-1';
const EMAIL = 'mario.rossi@example.invalid';
// `sanitizeEmail` sostituisce ogni carattere non alfanumerico con `_`: sono le
// chiavi di `sharedWith`, e non devono mai finire in un payload o in un log.
const KEY = 'mario_rossi_example_invalid';
const ALT_EMAIL = 'altro.ospite@example.invalid';
const ALT_KEY = 'altro_ospite_example_invalid';
const GUEST_UID = 'guest-uid';
const SENTINEL = '2026-09-21T10:00:00.000Z';
const eventPath = id => `users/${OWNER}/auditEvents/${id}`;

const entry = (status, uid = null) => ({email: EMAIL, status, uid});
const account = (overrides = {}) => ({
    revision: 3, isArchived: false, sharingCycle: 1, acceptedCount: 1, sharedWithUids: [GUEST_UID],
    sharedWith: {[KEY]: entry('accepted', GUEST_UID)}, ...overrides
});
const archived = (overrides = {}) => account({revision: 4, isArchived: true, sharingCycle: 2,
    acceptedCount: 0, sharedWithUids: [],
    sharedWith: {[KEY]: {...entry('suspended'), suspendedAt: SENTINEL}}, ...overrides});

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
        onDocumentUpdated: (_options, run) => run,
        accountEventId, accountTransition, buildAuditEvent, auditWriteDecision,
        firestore: () => store,
        FieldValue: {serverTimestamp: () => ({__at: ++atCount})},
        console: {warn: (...args) => logs.push(args), error: (...args) => logs.push(args)}
    });
    vm.runInContext(handler, context);
    const deliver = (kind, before, after, params = {}) => context.exports[kind]({
        data: {before: {data: () => before}, after: {data: () => after}},
        params: {uid: OWNER, accountId: ACCOUNT, ...params}
    });
    return {documents, writes, logs,
        private: (before, after) => deliver('onPrivateAccountWritten', before, after),
        company: (before, after, params = {aziendaId: COMPANY}) => deliver('onCompanyAccountWritten', before, after, params)};
}

test('profilo privato: archiviazione con id opaco e conteggio delle voci sospese', async () => {
    const f = fixture();
    await f.private(account(), archived());
    assert.deepEqual(f.writes.map(write => write[0]), [eventPath(`privato:${ACCOUNT}:4`)]);
    assert.deepEqual({...f.writes[0][1]}, {schemaVersion: 1, action: 'account-archived', actorUid: OWNER,
        accountId: ACCOUNT, context: 'privato', cycle: 2, revision: 4, sharingCycle: 2,
        suspendedSharingEntries: 1, at: {__at: 1}});
    assert.equal(f.logs.length, 0);
});

test('account aziendale: identità dal percorso e contesto aziendale', async () => {
    const f = fixture();
    await f.company(account(), archived());
    assert.deepEqual(f.writes.map(write => write[0]), [eventPath(`azienda:${COMPANY}:${ACCOUNT}:4`)]);
    assert.equal(f.writes[0][1].context, COMPANY);
    assert.equal(f.writes[0][1].suspendedSharingEntries, 1);
});

test('collisione di identità: un\'azienda chiamata «privato» non è il profilo privato', async () => {
    const f = fixture();
    await f.company(account(), archived(), {aziendaId: 'privato'});
    await f.private(account(), archived());
    assert.deepEqual(f.writes.map(write => write[0]).sort(),
        [eventPath(`azienda:privato:${ACCOUNT}:4`), eventPath(`privato:${ACCOUNT}:4`)].sort());
    assert.notEqual(f.writes[0][0], f.writes[1][0]);
});

test('una voce già sospesa prima non viene ricontata', async () => {
    const f = fixture();
    await f.private(account({sharedWith: {[KEY]: entry('accepted', GUEST_UID), [ALT_KEY]: entry('suspended')}}),
        archived({sharedWith: {[KEY]: {...entry('suspended'), suspendedAt: SENTINEL},
            [ALT_KEY]: {...entry('suspended'), suspendedAt: SENTINEL}}}));
    assert.equal(f.writes[0][1].suspendedSharingEntries, 1,
        'solo la voce passata da accepted a suspended conta');
});

test('la metrica è di voci, non di documenti invito', async () => {
    const f = fixture();
    await f.private(account(), archived());
    assert.equal(f.writes[0][1].suspendedSharingEntries, 1);
    // Il banco non contiene alcun documento invito: il conteggio non dipende da
    // quanti inviti esistano o siano stati toccati dal client, che il trigger non
    // può sapere (i contatori del client non sono persistiti).
    assert.equal([...f.documents.keys()].filter(path => path.startsWith('invites/')).length, 0);
});

test('ripristino neutralizzato dopo l\'archiviazione: nessuna voce cambia stato', async () => {
    const f = fixture();
    await f.private(archived(), archived({revision: 5, isArchived: false, sharingCycle: 3}));
    assert.deepEqual({...f.writes[0][1]}, {schemaVersion: 1, action: 'account-restored', actorUid: OWNER,
        accountId: ACCOUNT, context: 'privato', cycle: 3, revision: 5, sharingCycle: 3,
        neutralized: true, neutralizedSharingEntries: 0, at: {__at: 1}});
});

test('ripristino neutralizzato su dati legacy: la voce ancora attiva passa a sospesa', async () => {
    const f = fixture();
    // Account archiviato prima del protocollo: la voce è ancora `accepted`, e il
    // ripristino la sospende. Qui la metrica delle voci vale 1.
    await f.private(account({revision: 4, isArchived: true, sharingCycle: 2,
        sharedWith: {[KEY]: entry('accepted', GUEST_UID)}}),
    archived({revision: 5, isArchived: false, sharingCycle: 3}));
    assert.equal(f.writes[0][1].neutralized, true);
    assert.equal(f.writes[0][1].neutralizedSharingEntries, 1);
});

test('ripristino non neutralizzato: 0 anche se resta una voce sospesa', async () => {
    const f = fixture();
    const suspended = {...entry('suspended'), suspendedAt: SENTINEL};
    const active = {email: ALT_EMAIL, status: 'accepted', uid: GUEST_UID};
    await f.company(archived({revision: 6, sharingCycle: 2, sharedWith: {[KEY]: suspended, [ALT_KEY]: active}}),
        account({revision: 7, isArchived: false, sharingCycle: 2, sharedWithUids: [GUEST_UID], acceptedCount: 1,
            sharedWith: {[KEY]: suspended, [ALT_KEY]: active}}));
    assert.deepEqual(f.writes.map(write => write[0]), [eventPath(`azienda:${COMPANY}:${ACCOUNT}:7`)]);
    assert.equal(f.writes[0][1].neutralized, false);
    assert.equal(f.writes[0][1].neutralizedSharingEntries, 0,
        'nessuna voce cambia stato: una voce già sospesa non viene ricontata');
});

test('update ordinari, creazione e cancellazione del documento non producono eventi', async () => {
    const f = fixture();
    await f.private(account(), account({revision: 4, sharedWith: {[KEY]: entry('pending')}}));
    await f.company(archived(), archived({senderNotified: true}));
    await f.private(null, account());
    await f.private(account(), null);
    assert.equal(f.writes.length, 0);
    assert.equal(f.logs.length, 0);
});

test('replay: la riconsegna non duplica e non riscrive `at`', async () => {
    const f = fixture();
    await f.private(account(), archived());
    await f.private(account(), archived());
    assert.equal(f.writes.length, 1, 'create-if-absent sull\'id `${chiave}:${revision}`');
    assert.deepEqual(f.writes[0][1].at, {__at: 1});
});

test('ciclo archivia → ripristina → archivia: tre eventi con i conteggi delle voci', async () => {
    const f = fixture();
    await f.private(account({revision: 3}), archived({revision: 4}));
    await f.private(archived({revision: 4}), archived({revision: 5, isArchived: false, sharingCycle: 3}));
    await f.private(archived({revision: 5, isArchived: false, sharingCycle: 3}), archived({revision: 6, sharingCycle: 4}));
    assert.deepEqual(f.writes.map(write => write[0]),
        [eventPath(`privato:${ACCOUNT}:4`), eventPath(`privato:${ACCOUNT}:5`), eventPath(`privato:${ACCOUNT}:6`)]);
    assert.deepEqual(f.writes.map(write => write[1].action),
        ['account-archived', 'account-restored', 'account-archived']);
    assert.deepEqual(f.writes.map(write => write[1].suspendedSharingEntries ?? write[1].neutralizedSharingEntries),
        [1, 0, 0], 'conta le voci che cambiano stato in quella scrittura, non lo stato del documento');
});

test('dati invalidi: nessun evento, una sola riga con codice stabile, nessuna eccezione', async () => {
    const cases = [
        ['revisione assente', account({revision: undefined}), archived({revision: undefined})],
        ['revisione negativa', account({revision: -1}), archived({revision: -1})],
        ['revisione non intera', account({revision: 1.5}), archived({revision: 1.5})],
        ['after.sharedWith non mappa', account(), archived({sharedWith: []})],
        ['before.sharedWith non mappa', account({sharedWith: 'x'}), archived()],
        ['ciclo non intero', account(), archived({sharingCycle: 1.5})]
    ];
    for (const [nome, before, after] of cases) {
        const f = fixture();
        await f.private(before, after);
        assert.equal(f.writes.length, 0, `${nome}: nessun evento`);
        assert.equal(f.logs.length, 1, `${nome}: una sola riga`);
        assert.equal(f.logs[0][0], '[AUDIT] evento Account saltato');
        assert.equal(f.logs[0][1].code, 'AUDIT_FIELD_INVALID', `${nome}: codice stabile`);
    }
});

test('account aziendale senza aziendaId nel percorso: evento saltato, non inventato', async () => {
    const f = fixture();
    await f.company(account(), archived(), {aziendaId: undefined});
    assert.equal(f.writes.length, 0);
    assert.equal(f.logs.length, 1);
    assert.equal(f.logs[0][1].code, 'AUDIT_FIELD_INVALID');
});

test('nessun dato personale in id, payload e log', async () => {
    const f = fixture();
    await f.private(account(), archived());
    await f.company(archived(), archived({revision: 5, isArchived: false, sharingCycle: 3}));
    await f.private(account({revision: undefined}), archived({revision: undefined}));
    const serialized = JSON.stringify({writes: f.writes, logs: f.logs});
    for (const secret of [EMAIL, KEY, ALT_EMAIL, ALT_KEY, 'mario.rossi', 'altro.ospite']) {
        assert.equal(serialized.includes(secret), false, `nessun ${secret} in eventi o log`);
    }
    assert.equal(/@/.test(serialized), false, 'nessuna email in eventi o log');
});
