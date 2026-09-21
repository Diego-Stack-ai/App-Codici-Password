const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const vm = require('node:vm');
const {HttpsError} = require('firebase-functions/v2/https');

// M7-R7B3 — risposta a un invito quando l'Account del proprietario è
// nell'Archivio. Il banco esegue il gestore REALE (`respondToInvitation`)
// estratto da `functions/index.js` e una transazione con la stessa semantica di
// Firestore: le letture fissano una versione, se un documento letto cambia prima
// del commit la transazione viene ritentata e il controllo viene rieseguito.
const source = readFileSync(require.resolve('../index'), 'utf8');
const emailGuard = source.slice(source.indexOf('function sanitizeEmail('), source.indexOf('function normalizeEmail('));
const handler = source.slice(source.indexOf('exports.respondToInvitation'), source.indexOf('exports.deleteContactIfUnused'));

const EMAIL = 'guest@example.invalid';
// `sanitizeEmail` sostituisce ogni carattere non alfanumerico con `_`.
const KEY = 'guest_example_invalid';
const UID = 'guest-uid';
const INVITE_PATH = `invites/account_${KEY}`;
const ACCOUNT_PATH = 'users/A/accounts/account';

function fixture({archived = false, status = 'accepted', hook = null, accountCycle, inviteCycle} = {}) {
    const account = {isArchived: archived, sharedWith: {[KEY]: {email: EMAIL, status: 'pending', uid: null}}};
    if (accountCycle !== undefined) account.sharingCycle = accountCycle;
    const invite = {inviteId: `account_${KEY}`, ownerId: 'A', senderId: 'A', accountId: 'account',
        recipientEmail: EMAIL, status: 'pending'};
    if (inviteCycle !== undefined) invite.cycle = inviteCycle;
    const documents = new Map([
        [ACCOUNT_PATH, account],
        [INVITE_PATH, invite]
    ]);
    const versions = new Map();
    const reads = [], writes = [];
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
                        const data = documents.get(target.path);
                        readVersions.set(target.path, versions.get(target.path) || 0);
                        const snapshot = {exists: data !== undefined, data: () => (data ? structuredClone(data) : undefined)};
                        hook?.({path: target.path, attempt, documents, versions});
                        return snapshot;
                    },
                    update: (target, patch) => staged.push([target.path, patch]),
                    set: (target, patch) => staged.push([target.path, patch])
                };
                const result = await callback(transaction);
                const superseded = [...readVersions].some(([path, version]) => (versions.get(path) || 0) !== version);
                if (superseded) continue;
                for (const [path, patch] of staged) {
                    documents.set(path, {...documents.get(path), ...patch});
                    versions.set(path, (versions.get(path) || 0) + 1);
                    writes.push([path, patch]);
                }
                return result;
            }
            throw new Error('TRANSACTION_RETRY_EXHAUSTED');
        }
    };
    const context = vm.createContext({exports: {}, HttpsError, onCall: (_options, run) => run,
        admin: {firestore: () => store}, structuredClone});
    vm.runInContext(emailGuard + handler, context);
    return {documents, writes, reads, get attempts() { return attempts; },
        archive: () => { documents.set(ACCOUNT_PATH, {...documents.get(ACCOUNT_PATH), isArchived: true});
            versions.set(ACCOUNT_PATH, (versions.get(ACCOUNT_PATH) || 0) + 1); },
        bumpCycle: value => { documents.set(ACCOUNT_PATH, {...documents.get(ACCOUNT_PATH), sharingCycle: value});
            versions.set(ACCOUNT_PATH, (versions.get(ACCOUNT_PATH) || 0) + 1); },
        respond: (requested = status) => context.exports.respondToInvitation({
            auth: {uid: UID, token: {email: EMAIL}},
            data: {inviteId: `account_${KEY}`, status: requested}
        })};
}

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
    assert.deepEqual(accepted.writes.map(write => write[0]), [ACCOUNT_PATH, INVITE_PATH]);
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
