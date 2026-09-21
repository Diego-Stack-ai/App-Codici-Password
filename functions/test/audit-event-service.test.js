"use strict";

// M7-AUDIT-3 — Prove mirate degli helper del registro tecnico.
// Nessun produttore è attivo: qui si verifica solo il contratto (payload in
// allowlist, id opachi, classificazione delle transizioni, create-if-absent).

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  AUDIT_EVENT_ACTIONS, AUDIT_PAYLOAD_KEYS, MAX_EVENT_ID_LENGTH, SCHEMA_VERSION,
  accountEventId, accountEventKey, accountTransition, auditWriteDecision,
  buildAuditEvent, inviteRefOf, inviteTransition, invitedEventId, isAuditEventId,
  removalRefOf, removedEventId, responseEventId
} = require("../audit-event-service");

const REF_A = "11111111-1111-4111-8111-111111111111";
const REF_B = "22222222-2222-4222-8222-222222222222";
const EMAIL = "mario.rossi@example.invalid";
const EMAIL_KEY = "mario_rossi_example_invalid";
const INVITE_ID = `account-1_${EMAIL_KEY}`;
const INVITE = {actorUid: "owner-1", accountId: "account-1", context: "privato", cycle: 0};

function codeOf(run) {
  try {
    run();
    return null;
  } catch (error) {
    return error.code || error.message;
  }
}

test("buildAuditEvent produce payload in allowlist per ogni azione", () => {
  const cases = [
    ["invite-created", {...INVITE, inviteCreatedAt: "2026-09-21T10:00:00.000Z"},
      ["accountId", "action", "actorUid", "context", "cycle", "inviteCreatedAt", "schemaVersion"]],
    ["invite-accepted", {...INVITE, guestKnown: true, guestUid: "guest-1"},
      ["accountId", "action", "actorUid", "context", "cycle", "guestKnown", "guestUid", "schemaVersion"]],
    ["invite-rejected", {...INVITE, guestKnown: false},
      ["accountId", "action", "actorUid", "context", "cycle", "guestKnown", "schemaVersion"]],
    ["invite-removed", {...INVITE, guestKnown: true, guestUid: "guest-1"},
      ["accountId", "action", "actorUid", "context", "cycle", "guestKnown", "guestUid", "schemaVersion"]],
    ["account-archived", {...INVITE, revision: 4, sharingCycle: 1, suspendedInvites: 2},
      ["accountId", "action", "actorUid", "context", "cycle", "revision", "schemaVersion", "sharingCycle",
        "suspendedInvites"]],
    ["account-restored", {...INVITE, revision: 5, sharingCycle: 2, neutralizedInvites: 3, neutralized: true},
      ["accountId", "action", "actorUid", "context", "cycle", "neutralized", "neutralizedInvites", "revision",
        "schemaVersion", "sharingCycle"]]
  ];
  for (const [action, fields, expected] of cases) {
    const payload = buildAuditEvent(action, fields);
    assert.equal(payload.schemaVersion, SCHEMA_VERSION, action);
    assert.equal(payload.action, action);
    assert.deepEqual(Object.keys(payload).sort(), expected, action);
    assert.equal(Object.isFrozen(payload), true, action);
  }
});

test("buildAuditEvent rifiuta azione, campo imprevisto e campo mancante", () => {
  assert.equal(codeOf(() => buildAuditEvent("invite-deleted", INVITE)), "AUDIT_EVENT_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-created", {...INVITE, nomeAccount: "Banca"})),
    "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-created", {...INVITE, at: "2026-09-21T10:00:00.000Z"})),
    "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-created", {actorUid: "owner-1", accountId: "account-1",
    context: "privato"})), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("account-archived", {...INVITE, revision: 1, sharingCycle: 0})),
    "AUDIT_FIELD_INVALID");
});

test("nessuna email e nessun testo libero possono attraversare i campi ammessi", () => {
  const attempts = [
    () => buildAuditEvent("invite-created", {...INVITE, actorUid: EMAIL}),
    () => buildAuditEvent("invite-created", {...INVITE, accountId: EMAIL}),
    () => buildAuditEvent("invite-created", {...INVITE, context: EMAIL}),
    () => buildAuditEvent("invite-created", {...INVITE, cycle: EMAIL}),
    () => buildAuditEvent("invite-created", {...INVITE, inviteCreatedAt: EMAIL}),
    () => buildAuditEvent("invite-created", {...INVITE, inviteCreatedAt: INVITE_ID}),
    () => buildAuditEvent("invite-accepted", {...INVITE, guestKnown: true, guestUid: EMAIL}),
    () => buildAuditEvent("invite-removed", {...INVITE, guestKnown: true, guestUid: `${EMAIL} `})
  ];
  for (const attempt of attempts) assert.equal(codeOf(attempt), "AUDIT_FIELD_INVALID");
  // Il payload costruito con soli valori validi non contiene alcuna delle stringhe
  // personali: non esistono campi di testo libero in cui possano passare.
  const payload = buildAuditEvent("invite-accepted", {...INVITE, guestKnown: true, guestUid: "guest-1"});
  const serialized = JSON.stringify(payload);
  for (const secret of [EMAIL, EMAIL_KEY, INVITE_ID]) assert.equal(serialized.includes(secret), false);
});

test("il limite dichiarato: un id opaco ben formato non è distinguibile dal validatore", () => {
  // La chiave sanificata e l'id invito sono stringhe `[A-Za-z0-9_-]`: il
  // validatore non può riconoscerle come personali. Il registro le tiene fuori
  // perché i chiamanti leggono `accountId`, `ownerId` e `cycle` dal documento e
  // non usano mai l'id dell'invito come campo o come id dell'evento: qui lo
  // dichiaro come limite verificato, non lo nascondo.
  assert.equal(buildAuditEvent("invite-created", {...INVITE, accountId: INVITE_ID}).accountId, INVITE_ID);
  assert.equal(buildAuditEvent("invite-created", {...INVITE, context: EMAIL_KEY}).context, EMAIL_KEY);
  assert.equal(buildAuditEvent("invite-accepted", {...INVITE, guestKnown: true, guestUid: EMAIL_KEY})
    .guestUid, EMAIL_KEY);
  assert.equal(invitedEventId(REF_A).includes(INVITE_ID), false);
  assert.equal(JSON.stringify(buildAuditEvent("invite-created", INVITE)).includes(INVITE_ID), false);
  assert.equal(JSON.stringify(buildAuditEvent("invite-created", INVITE)).includes(EMAIL), false);
});

test("buildAuditEvent rifiuta tipi e valori incoerenti", () => {
  assert.equal(codeOf(() => buildAuditEvent("invite-created", {...INVITE, cycle: -1})), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-created", {...INVITE, cycle: 1.5})), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-created", {...INVITE, cycle: "0"})), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-created", {...INVITE,
    inviteCreatedAt: "2026-09-21T10:00:00Z"})), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("account-restored", {...INVITE, revision: 1, sharingCycle: 0,
    neutralizedInvites: 0, neutralized: "true"})), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-accepted", {...INVITE, guestKnown: true})),
    "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-accepted", {...INVITE, guestKnown: false,
    guestUid: "guest-1"})), "AUDIT_FIELD_INVALID");
});

test("AUDIT_PAYLOAD_KEYS è esattamente l'unione dei campi ammessi", () => {
  assert.deepEqual([...AUDIT_PAYLOAD_KEYS], ["accountId", "action", "actorUid", "context", "cycle", "guestKnown",
    "guestUid", "inviteCreatedAt", "neutralized", "neutralizedInvites", "revision", "schemaVersion",
    "sharingCycle", "suspendedInvites"]);
  assert.equal(AUDIT_EVENT_ACTIONS.length, 6);
});

test("le basi opache dell'invito si leggono solo da auditRef e responseAuditRef", () => {
  assert.equal(inviteRefOf({auditRef: REF_A, responseAuditRef: REF_B}), REF_A);
  assert.equal(inviteRefOf({responseAuditRef: REF_B}), null);
  assert.equal(inviteRefOf({}), null);
  assert.equal(inviteRefOf(null), null);
  assert.equal(removalRefOf({auditRef: REF_A, responseAuditRef: REF_B}), REF_A);
  assert.equal(removalRefOf({responseAuditRef: REF_B}), REF_B);
  assert.equal(removalRefOf({auditRef: null, responseAuditRef: REF_B}), REF_B);
  assert.equal(removalRefOf({}), null);
  assert.equal(codeOf(() => inviteRefOf({auditRef: INVITE_ID})), "AUDIT_REF_INVALID");
  assert.equal(codeOf(() => removalRefOf({responseAuditRef: "x"})), "AUDIT_REF_INVALID");
});

test("gli id degli eventi derivano dalla base opaca e non dall'id invito", () => {
  assert.equal(invitedEventId(REF_A), `${REF_A}__invited`);
  assert.equal(responseEventId(REF_A, "accepted"), `${REF_A}__accepted`);
  assert.equal(responseEventId(REF_A, "rejected"), `${REF_A}__rejected`);
  assert.equal(removedEventId(REF_A), `${REF_A}__removed`);
  assert.notEqual(invitedEventId(REF_A), invitedEventId(REF_B));
  assert.notEqual(responseEventId(REF_A, "accepted"), responseEventId(REF_A, "rejected"));
  assert.equal(invitedEventId(REF_A).includes(INVITE_ID), false);
  assert.equal(codeOf(() => invitedEventId(INVITE_ID)), "AUDIT_REF_INVALID");
  assert.equal(codeOf(() => responseEventId(REF_A, "pending")), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => removedEventId("")), "AUDIT_REF_INVALID");
});

test("la chiave dell'Account è iniettiva: prefisso di tipo e separatore non ambiguo", () => {
  // M7-AUDIT-3-R1 — le due collisioni segnalate da Codex.
  assert.notEqual(accountEventKey("a_b", "c"), accountEventKey("a", "b_c"));
  assert.notEqual(accountEventId("a_b", "c", 7), accountEventId("a", "b_c", 7));
  // Un Account privato non collide con un'azienda il cui id è 'privato'.
  assert.notEqual(accountEventId("privato", "privato_x", 1), accountEventId("privato", "x", 1));
  assert.notEqual(accountEventId("privato", "x", 1), accountEventId("privato", "x__1", 1));
  // La tupla si ricostruisce dall'id: nessuna informazione è ambigua.
  assert.equal(accountEventKey("privato", "account-1"), "privato:account-1");
  assert.equal(accountEventKey("company-1", "account-1"), "azienda:company-1:account-1");
  assert.equal(accountEventId("privato", "account-1", 4), "privato:account-1:4");
  assert.equal(accountEventId("company-1", "account-1", 0), "azienda:company-1:account-1:0");
  const pairs = [["privato", "a"], ["privato", "a_b"], ["a_b", "c"], ["a", "b_c"],
    ["company-1", "account-1"], ["privato", "privato_x"], ["privato", "x"], ["privato", "x__1"]];
  const ids = pairs.map(([context, accountId]) => accountEventId(context, accountId, 3));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(new Set(pairs.map(([context, accountId]) => accountEventKey(context, accountId))).size, pairs.length);
  assert.equal(codeOf(() => accountEventKey("a:b", "c")), "AUDIT_FIELD_INVALID");
});

test("ogni id rispetta charset e limite dei validatori del progetto", () => {
  // Lo stesso pattern più stretto già in uso in functions/ e nel candidato di
  // retention: 160 caratteri di [A-Za-z0-9:_-], quindi dentro i 1500 byte di
  // Firestore e senza '/'.
  const strictest = /^[A-Za-z0-9:_-]{1,160}$/;
  const ids = [invitedEventId(REF_A), responseEventId(REF_A, "accepted"), responseEventId(REF_A, "rejected"),
    removedEventId(REF_A), accountEventId("privato", "account-1", 4),
    accountEventId("company-1", "account-1", 0), accountEventId("a_b", "c", 1)];
  for (const id of ids) {
    assert.equal(strictest.test(id), true, id);
    assert.equal(isAuditEventId(id), true, id);
    assert.equal(id.includes("/"), false, id);
    assert.equal(id.length <= 1500, true, id);
  }
  assert.equal(MAX_EVENT_ID_LENGTH, 160);
  assert.equal(isAuditEventId("a".repeat(161)), false);
  assert.equal(isAuditEventId("id con spazio"), false);
});

test("oltre il limite si fallisce chiusi, senza troncare", () => {
  const max = "a".repeat(120); // massimo ammesso dall'identificatore
  const privato = accountEventId("privato", max, 1);
  assert.equal(privato.length <= MAX_EVENT_ID_LENGTH, true);
  assert.equal(isAuditEventId(privato), true);
  // Un accountId al massimo con un'azienda breve entra ancora nel limite.
  const conAziendaBreve = accountEventId("company-1", max, 1);
  assert.equal(conAziendaBreve.length <= MAX_EVENT_ID_LENGTH, true);
  assert.equal(isAuditEventId(conAziendaBreve), true);
  // Due componenti al massimo non entrano nel limite: nessun troncamento, errore.
  assert.equal(codeOf(() => accountEventKey("company-1", max + max)), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventKey("privato", "a".repeat(151))), "AUDIT_FIELD_INVALID");
  // Il confine esatto: con contesto di 29 caratteri e accountId di 120 l'id
  // arriva a 160; un carattere in più sullo stesso prefisso lo supera.
  const exact = accountEventId("c".repeat(29), max, 1);
  assert.equal(exact.length, MAX_EVENT_ID_LENGTH);
  assert.equal(isAuditEventId(exact), true);
  assert.equal(codeOf(() => accountEventId("c".repeat(30), max, 1)), "AUDIT_ID_TOO_LONG");
  // La revisione massima resta dentro il limite su componenti brevi.
  assert.equal(isAuditEventId(accountEventId("privato", "account-1", Number.MAX_SAFE_INTEGER)), true);
});

test("il contratto delle revisioni resta: interi non negativi, id distinti", () => {
  assert.equal(accountEventId("privato", "account-1", 0), "privato:account-1:0");
  assert.notEqual(accountEventId("privato", "account-1", 4), accountEventId("privato", "account-1", 5));
  assert.notEqual(accountEventId("privato", "account-1", 4), accountEventId("company-1", "account-1", 4));
  assert.equal(codeOf(() => accountEventId("privato", "account-1", -1)), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventId("privato", "account-1", 1.5)), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventId("privato", "account-1", "4")), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventKey("privato", EMAIL)), "AUDIT_FIELD_INVALID");
  const max = accountEventId("privato", "account-1", Number.MAX_SAFE_INTEGER);
  assert.equal(max, "privato:account-1:9007199254740991");
  assert.equal(isAuditEventId(max), true);
});

test("inviteTransition riconosce solo le nuove istanze", () => {
  assert.deepEqual(inviteTransition(null, {auditRef: REF_A}), {kind: "invite-created", ref: REF_A});
  assert.deepEqual(inviteTransition(undefined, {auditRef: REF_A}), {kind: "invite-created", ref: REF_A});
  assert.deepEqual(inviteTransition(null, {recipientEmail: EMAIL}),
    {kind: "none", reason: "AUDIT_REF_MISSING"});
  // Reinvito: set sullo stesso documento con un auditRef nuovo.
  assert.deepEqual(inviteTransition({auditRef: REF_A}, {auditRef: REF_B}),
    {kind: "invite-reinvited", ref: REF_B});
  // Aggiornamento ordinario: auditRef invariato (senderNotified, suspended, status).
  assert.deepEqual(inviteTransition({auditRef: REF_A, status: "pending"},
    {auditRef: REF_A, status: "pending", senderNotified: true}),
  {kind: "none", reason: "AUDIT_REF_UNCHANGED"});
  // Risposta della callable su invito legacy: aggiunge responseAuditRef e cambia
  // status, ma NON è una nuova istanza e non deve produrre un invito.
  assert.deepEqual(inviteTransition({status: "pending"},
    {status: "accepted", guestUid: "guest-1", responseAuditRef: REF_B}),
  {kind: "none", reason: "AUDIT_REF_MISSING"});
  // Reinvito da un client che non scrive auditRef: nessuna istanza riconoscibile.
  assert.deepEqual(inviteTransition({auditRef: REF_A}, {status: "pending"}),
    {kind: "none", reason: "AUDIT_REF_MISSING"});
  assert.deepEqual(inviteTransition({auditRef: REF_A}, null), {kind: "invite-removed", ref: REF_A});
  assert.deepEqual(inviteTransition({responseAuditRef: REF_B}, null),
    {kind: "invite-removed", ref: REF_B});
  assert.deepEqual(inviteTransition({recipientEmail: EMAIL}, null),
    {kind: "none", reason: "AUDIT_REF_MISSING"});
  assert.deepEqual(inviteTransition({auditRef: REF_A, responseAuditRef: REF_B}, null),
    {kind: "invite-removed", ref: REF_A});
  assert.deepEqual(inviteTransition(null, null), {kind: "none", reason: "AUDIT_TRANSITION_INVALID"});
  assert.equal(codeOf(() => inviteTransition({auditRef: INVITE_ID}, null)), "AUDIT_REF_INVALID");
});

test("accountTransition distingue archiviazione, ripristino e scritture invariate", () => {
  assert.deepEqual(accountTransition({isArchived: false}, {isArchived: true}), {kind: "account-archived"});
  assert.deepEqual(accountTransition({isArchived: true}, {isArchived: false}), {kind: "account-restored"});
  assert.deepEqual(accountTransition({isArchived: true}, {isArchived: true}),
    {kind: "none", reason: "AUDIT_TRANSITION_UNCHANGED"});
  assert.deepEqual(accountTransition({isArchived: false}, {isArchived: false}),
    {kind: "none", reason: "AUDIT_TRANSITION_UNCHANGED"});
  // Il trigger è onDocumentUpdated: creazione e cancellazione non sono transizioni.
  assert.deepEqual(accountTransition(null, {isArchived: true}),
    {kind: "none", reason: "AUDIT_TRANSITION_CREATED"});
  assert.deepEqual(accountTransition({isArchived: true}, null),
    {kind: "none", reason: "AUDIT_TRANSITION_DELETED"});
  assert.deepEqual(accountTransition(null, null), {kind: "none", reason: "AUDIT_TRANSITION_INVALID"});
});

test("auditWriteDecision esprime il create-if-absent senza sovrascrivere at", () => {
  const effect = {id: `${REF_A}__invited`, payload: buildAuditEvent("invite-created",
    {...INVITE, inviteCreatedAt: "2026-09-21T10:00:00.000Z"})};
  const absent = auditWriteDecision(false, effect);
  assert.deepEqual([...Object.keys(absent)].sort(), ["id", "payload", "reason", "write"]);
  assert.equal(absent.write, true);
  assert.equal(absent.reason, "AUDIT_EVENT_ABSENT");
  assert.equal(absent.id, effect.id);
  assert.equal(absent.payload, effect.payload);

  const present = auditWriteDecision(true, effect);
  assert.equal(present.write, false);
  assert.equal(present.reason, "AUDIT_EVENT_PRESENT");
  // Nessun effetto restituito: l'evento esistente, `at` compreso, non si tocca.
  assert.equal("id" in present, false);
  assert.equal("payload" in present, false);
  assert.equal(Object.isFrozen(present), true);

  // Se l'evento esiste già, l'effetto non serve e non viene esaminato: la
  // decisione è di non scrivere, comunque sia costruito il chiamante.
  assert.deepEqual({...auditWriteDecision(true)}, {write: false, reason: "AUDIT_EVENT_PRESENT"});
  assert.equal(codeOf(() => auditWriteDecision("true", effect)), "AUDIT_DECISION_INVALID");
  assert.equal(codeOf(() => auditWriteDecision(false, null)), "AUDIT_DECISION_INVALID");
  assert.equal(codeOf(() => auditWriteDecision(false, {id: "", payload: {}})), "AUDIT_DECISION_INVALID");
  assert.equal(codeOf(() => auditWriteDecision(false, {id: effect.id})), "AUDIT_DECISION_INVALID");
});
