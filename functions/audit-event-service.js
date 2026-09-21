// M7-AUDIT-3 — Helper puri del registro tecnico `users/{uid}/auditEvents`.
//
// Questo modulo NON scrive, NON legge e NON importa Firebase: prepara soltanto
// payload e identificatori che i produttori (callable e trigger, M7-AUDIT-4/5)
// useranno. Regole codificate qui, decise in M7-AUDIT-1/3P/3P-R1:
//
// - nessun dato personale: ogni campo ammesso è un identificatore opaco, un
//   intero, un booleano o un timestamp tecnico validato; un'email non può
//   attraversare nessuno di questi tipi, quindi non può finire nel registro;
// - nessun campo fuori allowlist: `buildAuditEvent` rifiuta le chiavi
//   impreviste invece di ignorarle;
// - identificatori derivati solo da valori già presenti nella scrittura
//   originaria (`auditRef`, `responseAuditRef`, `revision` dell'Account), mai
//   dall'id del documento invito, che contiene la chiave sanificata dell'email;
// - id **iniettivi**: la chiave dell'Account usa un prefisso di tipo e il
//   separatore ':', che nessun identificatore può contenere, quindi coppie
//   diverse non possono produrre lo stesso id (M7-AUDIT-3-R1);
// - create-if-absent espresso come contratto: `auditWriteDecision` decide se
//   scrivere, e per un evento già presente non restituisce alcun effetto, così
//   un `at` esistente non viene mai sovrascritto.
//
// Il timestamp autorevole `at` NON è prodotto qui: lo aggiunge lo scrittore con
// `FieldValue.serverTimestamp()`. Il registro è tracciamento best-effort di
// transizioni Firestore, non prova forense dell'intenzione dell'utente (il
// proprietario può riscrivere i campi dell'invito: `firestore.rules:225`), e
// non è un controllo di sicurezza.

const SCHEMA_VERSION = 1;

// Identificatori opachi: uid, accountId, aziendaId, 'privato'. Nessun '@',
// nessuno spazio e nessun ':' (che è il separatore degli id: vedi sotto).
const IDENTIFIER = /^[A-Za-z0-9_-]{1,120}$/;
// `auditRef` e `responseAuditRef` sono UUID generati dai writer (crypto.randomUUID).
const AUDIT_REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Timestamp tecnico nella stessa forma di `new Date().toISOString()`.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
// Vincoli sull'id dell'evento: charset e lunghezza sono quelli del validatore
// più stretto già in uso nel progetto, così l'id è accettato da tutti quelli
// esistenti, retention compresa (`functions/archive-purge-receipt.js:2`,
// `functions/archive-purge-reference-plan.js:3`, `functions/history-recovery-service.js:1`,
// `experiments/history-recovery/audit-retention.mjs:27`). Firestore ammette id
// fino a 1500 byte senza '/': 160 caratteri ASCII restano dentro il limite.
const EVENT_ID = /^[A-Za-z0-9:_-]{1,160}$/;
const MAX_EVENT_ID_LENGTH = 160;

const AUDIT_EVENT_ACTIONS = Object.freeze([
    'invite-created',
    'invite-accepted',
    'invite-rejected',
    'invite-removed',
    'account-archived',
    'account-restored'
]);
const ACTION_SET = new Set(AUDIT_EVENT_ACTIONS);

const INVITE_REQUIRED = ['actorUid', 'accountId', 'context', 'cycle'];
const GUEST_REQUIRED = [...INVITE_REQUIRED, 'guestKnown'];
const ACTION_FIELDS = Object.freeze({
    'invite-created': Object.freeze({required: INVITE_REQUIRED, optional: ['inviteCreatedAt']}),
    'invite-accepted': Object.freeze({required: GUEST_REQUIRED, optional: ['guestUid']}),
    'invite-rejected': Object.freeze({required: GUEST_REQUIRED, optional: ['guestUid']}),
    'invite-removed': Object.freeze({required: GUEST_REQUIRED, optional: ['guestUid']}),
    'account-archived': Object.freeze({
        required: [...INVITE_REQUIRED, 'revision', 'sharingCycle', 'suspendedInvites'], optional: []
    }),
    'account-restored': Object.freeze({
        required: [...INVITE_REQUIRED, 'revision', 'sharingCycle', 'neutralizedInvites', 'neutralized'],
        optional: []
    })
});
const AUDIT_PAYLOAD_KEYS = Object.freeze(['schemaVersion', 'action',
    ...[...new Set(Object.values(ACTION_FIELDS)
        .flatMap(fields => [...fields.required, ...fields.optional]))]].sort());

function fail(code) {
    return Object.assign(new Error(code), {code});
}

function identifier(value) {
    if (typeof value !== 'string' || !IDENTIFIER.test(value)) throw fail('AUDIT_FIELD_INVALID');
    return value;
}

function auditRef(value, code = 'AUDIT_REF_INVALID') {
    if (typeof value !== 'string' || !AUDIT_REF.test(value)) throw fail(code);
    return value;
}

function count(value) {
    if (!Number.isSafeInteger(value) || value < 0) throw fail('AUDIT_FIELD_INVALID');
    return value;
}

function boolean(value) {
    if (typeof value !== 'boolean') throw fail('AUDIT_FIELD_INVALID');
    return value;
}

function responseStatus(value) {
    if (value !== 'accepted' && value !== 'rejected') throw fail('AUDIT_FIELD_INVALID');
    return value;
}

function createdAt(value) {
    if (typeof value !== 'string' || !ISO_TIMESTAMP.test(value)) throw fail('AUDIT_FIELD_INVALID');
    return value;
}

// Ogni id del registro passa di qui: oltre il limite si fallisce con un codice
// distinto (mai un id troncato, mai un id fuori charset).
function ensureEventId(value) {
    if (typeof value !== 'string' || value.length > MAX_EVENT_ID_LENGTH) throw fail('AUDIT_ID_TOO_LONG');
    if (!EVENT_ID.test(value)) throw fail('AUDIT_ID_INVALID');
    return value;
}

function isAuditEventId(value) {
    return typeof value === 'string' && EVENT_ID.test(value);
}

const FIELD_VALIDATORS = Object.freeze({
    actorUid: identifier,
    accountId: identifier,
    context: identifier,
    cycle: count,
    revision: count,
    sharingCycle: count,
    suspendedInvites: count,
    neutralizedInvites: count,
    neutralized: boolean,
    guestKnown: boolean,
    guestUid: identifier,
    inviteCreatedAt: createdAt
});

// Payload in allowlist: campi previsti e validati per tipo, nessun campo extra,
// nessun testo libero e quindi nessun contenuto del Vault. `guestUid` è
// ammesso solo quando `guestKnown` è vero, così l'indicatore anonimo non può
// convivere con un identificatore.
function buildAuditEvent(action, fields = {}) {
    if (!ACTION_SET.has(action)) throw fail('AUDIT_EVENT_INVALID');
    const {required, optional} = ACTION_FIELDS[action];
    const allowed = [...required, ...optional];
    const payload = {schemaVersion: SCHEMA_VERSION, action};
    for (const [name, value] of Object.entries(fields)) {
        if (!allowed.includes(name)) throw fail('AUDIT_FIELD_INVALID');
        payload[name] = FIELD_VALIDATORS[name](value);
    }
    for (const name of required) {
        if (!(name in payload)) throw fail('AUDIT_FIELD_INVALID');
    }
    if ('guestKnown' in payload && payload.guestKnown !== ('guestUid' in payload)) {
        throw fail('AUDIT_FIELD_INVALID');
    }
    return Object.freeze(payload);
}

// Base opaca dell'istanza di invito: `auditRef` scritto dal writer di creazione
// o reinvito. Assente => null (invito legacy: decide il chiamante), presente ma
// malformato => errore, perché un valore invalido non è un valore assente.
function inviteRefOf(invite) {
    if (!invite || typeof invite !== 'object') return null;
    if (invite.auditRef === undefined || invite.auditRef === null) return null;
    return auditRef(invite.auditRef);
}

// Base opaca utilizzabile per la rimozione: `auditRef`, altrimenti
// `responseAuditRef` scritto dalla callable di risposta sugli inviti legacy.
function removalRefOf(invite) {
    if (!invite || typeof invite !== 'object') return null;
    if (invite.auditRef !== undefined && invite.auditRef !== null) return auditRef(invite.auditRef);
    if (invite.responseAuditRef !== undefined && invite.responseAuditRef !== null) {
        return auditRef(invite.responseAuditRef);
    }
    return null;
}

function invitedEventId(ref) {
    return ensureEventId(`${auditRef(ref)}__invited`);
}

function responseEventId(ref, status) {
    return ensureEventId(`${auditRef(ref)}__${responseStatus(status)}`);
}

function removedEventId(ref) {
    return ensureEventId(`${auditRef(ref)}__removed`);
}

// Chiave dell'Account, **iniettiva** sulla coppia (context, accountId): un
// prefisso di tipo esplicito e il separatore ':' che nessun identificatore può
// contenere (IDENTIFIER). Senza queste due proprietà `(context='a_b',
// accountId='c')` e `(context='a', accountId='b_c')` produrrebbero la stessa
// stringa, e con la stessa revisione uno dei due eventi andrebbe perso nel
// create-if-absent. Per i privati `context` è 'privato'; per le aziende `context`
// È l'aziendaId (`Frontend/public/assets/js/modules/settings/archive-account-service.js:68-69`),
// quindi la chiave lo include. Nessun troncamento: oltre il limite si fallisce
// chiusi, perché un id troncato tornerebbe a collidere.
function accountEventKey(context, accountId) {
    const owner = identifier(accountId);
    if (context === 'privato') return ensureEventId(`privato:${owner}`);
    return ensureEventId(`azienda:${identifier(context)}:${owner}`);
}

// `revision` è scritta dalla stessa transazione della transizione e resta
// l'ultimo campo della tupla: la revisione è decimale canonica, quindi lo split
// sul separatore è univoco.
function accountEventId(context, accountId, revision) {
    return ensureEventId(`${accountEventKey(context, accountId)}:${count(revision)}`);
}

// Classificatore puro della scrittura su `invites/{inviteId}` (onDocumentWritten,
// M7-AUDIT-5). `before`/`after` sono i dati del documento, o null se assente.
// Solo un cambio di `auditRef` è una nuova istanza: la risposta della callable
// (che aggiunge `responseAuditRef` e cambia `status`) e gli aggiornamenti
// accessori restano `none`.
function inviteTransition(before, after) {
    const had = before !== null && before !== undefined;
    const has = after !== null && after !== undefined;
    if (!had && has) {
        const ref = inviteRefOf(after);
        return ref ? {kind: 'invite-created', ref} : {kind: 'none', reason: 'AUDIT_REF_MISSING'};
    }
    if (had && has) {
        const previous = inviteRefOf(before);
        const next = inviteRefOf(after);
        if (next === null) return {kind: 'none', reason: 'AUDIT_REF_MISSING'};
        if (previous === next) return {kind: 'none', reason: 'AUDIT_REF_UNCHANGED'};
        return {kind: 'invite-reinvited', ref: next};
    }
    if (had && !has) {
        const ref = removalRefOf(before);
        return ref ? {kind: 'invite-removed', ref} : {kind: 'none', reason: 'AUDIT_REF_MISSING'};
    }
    return {kind: 'none', reason: 'AUDIT_TRANSITION_INVALID'};
}

// Classificatore puro della scrittura su un Account. Il trigger è
// `onDocumentUpdated`, quindi la creazione e la cancellazione del documento non
// sono transizioni di archiviazione: vengono distinte e non producono eventi.
function accountTransition(before, after) {
    const had = before !== null && before !== undefined;
    const has = after !== null && after !== undefined;
    if (!had && has) return {kind: 'none', reason: 'AUDIT_TRANSITION_CREATED'};
    if (had && !has) return {kind: 'none', reason: 'AUDIT_TRANSITION_DELETED'};
    if (!had && !has) return {kind: 'none', reason: 'AUDIT_TRANSITION_INVALID'};
    const archived = value => value.isArchived === true;
    if (!archived(before) && archived(after)) return {kind: 'account-archived'};
    if (archived(before) && !archived(after)) return {kind: 'account-restored'};
    return {kind: 'none', reason: 'AUDIT_TRANSITION_UNCHANGED'};
}

// Contratto create-if-absent: se l'evento esiste già non si scrive nulla e non
// si restituisce alcun effetto, quindi `at` (e ogni altro campo) resta quello
// scritto la prima volta; in quel caso l'effetto proposto non viene esaminato.
// Un valore non booleano è un errore, non un'ipotesi.
function auditWriteDecision(exists, effect) {
    if (typeof exists !== 'boolean') throw fail('AUDIT_DECISION_INVALID');
    if (exists) return Object.freeze({write: false, reason: 'AUDIT_EVENT_PRESENT'});
    if (!effect || typeof effect !== 'object' || typeof effect.id !== 'string' || !effect.id) {
        throw fail('AUDIT_DECISION_INVALID');
    }
    if (!effect.payload || typeof effect.payload !== 'object') throw fail('AUDIT_DECISION_INVALID');
    return Object.freeze({write: true, reason: 'AUDIT_EVENT_ABSENT',
        id: effect.id, payload: effect.payload});
}

module.exports = {
    AUDIT_EVENT_ACTIONS,
    AUDIT_PAYLOAD_KEYS,
    MAX_EVENT_ID_LENGTH,
    SCHEMA_VERSION,
    accountEventId,
    accountEventKey,
    accountTransition,
    auditWriteDecision,
    buildAuditEvent,
    inviteRefOf,
    inviteTransition,
    invitedEventId,
    isAuditEventId,
    removalRefOf,
    removedEventId,
    responseEventId
};
