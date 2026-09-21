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
// nessuno spazio: un'email non è un identificatore valido.
const IDENTIFIER = /^[A-Za-z0-9_-]{1,120}$/;
// `auditRef` e `responseAuditRef` sono UUID generati dai writer (crypto.randomUUID).
const AUDIT_REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Timestamp tecnico nella stessa forma di `new Date().toISOString()`.
const ISO_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

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
    return `${auditRef(ref)}__invited`;
}

function responseEventId(ref, status) {
    return `${auditRef(ref)}__${responseStatus(status)}`;
}

function removedEventId(ref) {
    return `${auditRef(ref)}__removed`;
}

// Chiave dell'Account: per i privati `context` è 'privato' e la chiave è
// l'accountId; per le aziende `context` È l'aziendaId (archive-account-service.js
// usa `users/{uid}/aziende/{context}/accounts/{id}`), quindi la chiave la
// include. `revision` è scritta dalla stessa transazione della transizione.
function accountEventKey(context, accountId) {
    const owner = identifier(accountId);
    if (context === 'privato') return owner;
    return `${identifier(context)}_${owner}`;
}

function accountEventId(context, accountId, revision) {
    return `${accountEventKey(context, accountId)}__${count(revision)}`;
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
    SCHEMA_VERSION,
    accountEventId,
    accountEventKey,
    accountTransition,
    auditWriteDecision,
    buildAuditEvent,
    inviteRefOf,
    inviteTransition,
    invitedEventId,
    removalRefOf,
    removedEventId,
    responseEventId
};
