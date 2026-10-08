"use strict";

// M7-AUDIT-3 — Prove mirate degli helper del registro tecnico.
// Nessun produttore è attivo: qui si verifica solo il contratto (payload in
// allowlist, id opachi, classificazione delle transizioni, create-if-absent).

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  ACCOUNT_TYPES, AUDIT_EVENT_ACTIONS, AUDIT_PAYLOAD_KEYS, MAX_EVENT_ID_LENGTH, SCHEMA_VERSION,
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
    ["account-archived", {...INVITE, revision: 4, sharingCycle: 1, suspendedSharingEntries: 2},
      ["accountId", "action", "actorUid", "context", "cycle", "revision", "schemaVersion", "sharingCycle",
        "suspendedSharingEntries"]],
    ["account-restored", {...INVITE, revision: 5, sharingCycle: 2, neutralizedSharingEntries: 3, neutralized: true},
      ["accountId", "action", "actorUid", "context", "cycle", "neutralized", "neutralizedSharingEntries", "revision",
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
    neutralizedSharingEntries: 0, neutralized: "true"})), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-accepted", {...INVITE, guestKnown: true})),
    "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => buildAuditEvent("invite-accepted", {...INVITE, guestKnown: false,
    guestUid: "guest-1"})), "AUDIT_FIELD_INVALID");
});

test("AUDIT_PAYLOAD_KEYS è esattamente l'unione dei campi ammessi", () => {
  // M7-AUDIT-5A correzione: i campi Account contano **voci** di condivisione
  // portate in stato sospeso, non documenti invito: i nomi lo dichiarano.
  assert.deepEqual([...AUDIT_PAYLOAD_KEYS], ["accountId", "action", "actorUid", "context", "cycle", "guestKnown",
    "guestUid", "inviteCreatedAt", "neutralized", "neutralizedSharingEntries", "revision", "schemaVersion",
    "sharingCycle", "suspendedSharingEntries"]);
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

test("il tipo dell'Account è esplicito: un'azienda chiamata 'privato' non è il profilo privato", () => {
  // M7-AUDIT-3-R2 — il caso decisivo: stesso accountId, stessa revisione, tipo
  // diverso. Con il tipo dedotto da `context === 'privato'` questi due id
  // coincidevano, e create-if-absent avrebbe perso un evento.
  const privato = {type: "privato", accountId: "x"};
  const azienda = {type: "azienda", companyId: "privato", accountId: "x"};
  assert.equal(accountEventKey(privato), "privato:x");
  assert.equal(accountEventKey(azienda), "azienda:privato:x");
  assert.notEqual(accountEventKey(privato), accountEventKey(azienda));
  assert.notEqual(accountEventId(privato, 1), accountEventId(azienda, 1));
  // Il caso di Codex in M7-AUDIT-3-R1, ora non più ambiguo.
  assert.notEqual(accountEventKey({type: "azienda", companyId: "a_b", accountId: "c"}),
    accountEventKey({type: "azienda", companyId: "a", accountId: "b_c"}));
  assert.notEqual(accountEventId({type: "azienda", companyId: "a_b", accountId: "c"}, 7),
    accountEventId({type: "azienda", companyId: "a", accountId: "b_c"}, 7));
});

test("il descrittore dell'Account è validato: tipo, companyId e campi non pertinenti", () => {
  assert.deepEqual([...ACCOUNT_TYPES], ["privato", "azienda"]);
  const invalids = [
    () => accountEventKey(null),
    () => accountEventKey("privato"),
    () => accountEventKey({accountId: "x"}),
    () => accountEventKey({type: "company", accountId: "x"}),
    () => accountEventKey({type: "privato"}),
    () => accountEventKey({type: "privato", accountId: EMAIL}),
    // companyId presente sul profilo privato: errore, non campo ignorato.
    () => accountEventKey({type: "privato", accountId: "x", companyId: "company-1"}),
    () => accountEventKey({type: "azienda", accountId: "x"}),
    () => accountEventKey({type: "azienda", companyId: EMAIL, accountId: "x"}),
    () => accountEventKey({type: "azienda", companyId: "company-1", accountId: EMAIL})
  ];
  for (const attempt of invalids) assert.equal(codeOf(attempt), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventId({type: "privato", accountId: "x"}, -1)), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventId({type: "azienda", companyId: "c", accountId: "x"}, 1.5)),
    "AUDIT_FIELD_INVALID");
});

test("la chiave dell'Account è iniettiva su un insieme di descrittori", () => {
  const companyIds = ["a", "b", "a_b", "a-b", "a__b", "privato", "privato_x", "x", "x__1", "account-1"];
  const accountIds = ["a", "b", "a_b", "a-b", "a__b", "privato", "privato_x", "x", "x__1", "account-1"];
  const descriptors = [
    ...accountIds.map(accountId => ({type: "privato", accountId})),
    ...companyIds.flatMap(companyId => accountIds.map(accountId => ({type: "azienda", companyId, accountId})))
  ];
  const keys = descriptors.map(accountEventKey);
  const ids = descriptors.map(descriptor => accountEventId(descriptor, 3));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.equal(isAuditEventId(id), true, id);
  // Il ':' resta vietato dentro i componenti: è ciò che rende univoco lo split.
  assert.equal(codeOf(() => accountEventKey({type: "azienda", companyId: "a:b", accountId: "c"})),
    "AUDIT_FIELD_INVALID");
});

test("ogni id rispetta charset e limite dei validatori del progetto", () => {
  // Lo stesso pattern più stretto già in uso in functions/ e nel candidato di
  // retention: 160 caratteri di [A-Za-z0-9:_-], quindi dentro i 1500 byte di
  // Firestore e senza '/'.
  const strictest = /^[A-Za-z0-9:_-]{1,160}$/;
  const ids = [invitedEventId(REF_A), responseEventId(REF_A, "accepted"), responseEventId(REF_A, "rejected"),
    removedEventId(REF_A), accountEventId({type: "privato", accountId: "account-1"}, 4),
    accountEventId({type: "azienda", companyId: "company-1", accountId: "account-1"}, 0),
    accountEventId({type: "azienda", companyId: "a_b", accountId: "c"}, 1)];
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

test("oltre il limite si fallisce chiusi, senza troncare: entrambi i rami", () => {
  const max = "a".repeat(120); // massimo ammesso dall'identificatore
  // Ramo privato: 'privato:' (8) + accountId (max 120) + ':' + revisione (max 16)
  // = 145, quindi il limite di 160 non è raggiungibile e non serve un rifiuto.
  const privatoMax = accountEventId({type: "privato", accountId: max}, Number.MAX_SAFE_INTEGER);
  assert.equal(privatoMax.length, 145);
  assert.equal(isAuditEventId(privatoMax), true);
  assert.equal(accountEventId({type: "privato", accountId: max}, 1).length, 130);
  // Oltre il massimo dell'identificatore non si arriva nemmeno al controllo di
  // lunghezza: il valore è già invalido.
  assert.equal(codeOf(() => accountEventKey({type: "privato", accountId: "a".repeat(121)})),
    "AUDIT_FIELD_INVALID");
  // Ramo aziendale: 'azienda:' (8) + companyId + ':' + accountId + ':' + revisione.
  const aziendaBreve = accountEventId({type: "azienda", companyId: "company-1", accountId: max}, 1);
  assert.equal(aziendaBreve.length <= MAX_EVENT_ID_LENGTH, true);
  assert.equal(isAuditEventId(aziendaBreve), true);
  // Il confine esatto cade qui: companyId di 29 caratteri, accountId di 120 e
  // revisione di 1 cifra danno esattamente 160.
  const aziendaConfine = accountEventId({type: "azienda", companyId: "c".repeat(29), accountId: max}, 1);
  assert.equal(aziendaConfine.length, MAX_EVENT_ID_LENGTH);
  assert.equal(isAuditEventId(aziendaConfine), true);
  assert.equal(codeOf(() => accountEventId({type: "azienda", companyId: "c".repeat(30), accountId: max}, 1)),
    "AUDIT_ID_TOO_LONG");
  // Due componenti al massimo (120+120) darebbero 251: errore, mai troncamento.
  assert.equal(codeOf(() => accountEventId({type: "azienda", companyId: max, accountId: max}, 1)),
    "AUDIT_ID_TOO_LONG");
  assert.equal(codeOf(() => accountEventKey({type: "azienda", companyId: max, accountId: max})),
    "AUDIT_ID_TOO_LONG");
  assert.equal(codeOf(() => accountEventKey({type: "azienda", companyId: max, accountId: max + max})),
    "AUDIT_FIELD_INVALID");
});

test("il contratto delle revisioni resta: interi non negativi, id distinti", () => {
  const privato = {type: "privato", accountId: "account-1"};
  const azienda = {type: "azienda", companyId: "company-1", accountId: "account-1"};
  assert.equal(accountEventId(privato, 0), "privato:account-1:0");
  assert.equal(accountEventId(azienda, 0), "azienda:company-1:account-1:0");
  assert.notEqual(accountEventId(privato, 4), accountEventId(privato, 5));
  assert.notEqual(accountEventId(privato, 4), accountEventId(azienda, 4));
  assert.equal(codeOf(() => accountEventId(privato, -1)), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventId(privato, 1.5)), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventId(privato, "4")), "AUDIT_FIELD_INVALID");
  assert.equal(codeOf(() => accountEventKey({type: "privato", accountId: EMAIL})), "AUDIT_FIELD_INVALID");
  const max = accountEventId(privato, Number.MAX_SAFE_INTEGER);
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
  // M7-AUDIT-5I: il classificatore non lancia più su un marcatore malformato — il
  // trigger degli inviti deve poterlo ignorare senza far fallire la consegna — e
  // in cancellazione ripiega su `responseAuditRef` quando quello è valido.
  assert.deepEqual(inviteTransition({auditRef: INVITE_ID}, null),
    {kind: "none", reason: "AUDIT_REF_INVALID"});
  assert.deepEqual(inviteTransition(null, {auditRef: INVITE_ID}),
    {kind: "none", reason: "AUDIT_REF_INVALID"});
  assert.deepEqual(inviteTransition({auditRef: INVITE_ID}, {auditRef: INVITE_ID}),
    {kind: "none", reason: "AUDIT_REF_INVALID"});
  assert.deepEqual(inviteTransition({auditRef: INVITE_ID}, {auditRef: REF_A}),
    {kind: "invite-reinvited", ref: REF_A});
  assert.deepEqual(inviteTransition({auditRef: REF_A}, {auditRef: INVITE_ID}),
    {kind: "none", reason: "AUDIT_REF_INVALID"});
  assert.deepEqual(inviteTransition({auditRef: INVITE_ID, responseAuditRef: REF_B}, null),
    {kind: "invite-removed", ref: REF_B});
  assert.deepEqual(inviteTransition({auditRef: INVITE_ID, responseAuditRef: "x"}, null),
    {kind: "none", reason: "AUDIT_REF_INVALID"});
  assert.deepEqual(inviteTransition({responseAuditRef: REF_B}, null),
    {kind: "invite-removed", ref: REF_B});
  // Le letture severe restano severe per chi vuole distinguere i casi.
  assert.equal(codeOf(() => inviteRefOf({auditRef: INVITE_ID})), "AUDIT_REF_INVALID");
  assert.equal(codeOf(() => removalRefOf({auditRef: INVITE_ID})), "AUDIT_REF_INVALID");
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
