"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {planLegacyWidgetMigration} = require("../widget-profile-migration-service");

const field = (id, label, value) => ({id, label, type: "text", encrypted: false, value, order: 0});

test("sei istanze legacy equivalenti al censimento producono cinque profili", () => {
  const widgets = [
    {id: "a", kind: "embedded", title: "Codici & PASSWORD", fields: [field("a1", "password MASTER", "uno")]},
    {id: "b", kind: "embedded", title: "Domande sicurezza Apple", fields: [field("b1", "risposta 1", "due")]},
    {id: "c", kind: "embedded", title: "PIN E PUK SIM", fields: [field("c1", "pin sim", "1111")]},
    {id: "d", kind: "embedded", title: "Pin e Puk Sim", fields: [field("d9", "PIN SIM", "2222")]},
    {id: "e", kind: "embedded", bankId: "bank", title: "numero verde", fields: [field("e1", "numero verde", "800")]},
    {id: "f", kind: "embedded", bankId: "bank", title: "REFERENTE BANCA 2", fields: [field("f1", "NOMINATIVO", "Mario")]}
  ];
  const plan = planLegacyWidgetMigration(widgets);
  assert.equal(plan.updates.length, 6);
  assert.equal(plan.profiles.length, 5);
  assert.equal(plan.updates[2].profileId, plan.updates[3].profileId);
  assert.equal(plan.updates[5].title, "Referente Banca 2");
  assert.equal(plan.profiles.some(profile => JSON.stringify(profile.data).includes("Mario")), false);
  assert.equal(plan.updates[2].fields[0].value, "1111");
});

test("la pianificazione è ripetibile e salta istanze già collegate", () => {
  const legacy = {id: "legacy", kind: "embedded", title: "iban conto", fields: [field("x", "codice", "A") ]};
  const first = planLegacyWidgetMigration([legacy, {...legacy, id: "done", profileId: "existing"}]);
  const second = planLegacyWidgetMigration([legacy]);
  assert.deepEqual(first, second);
  assert.equal(first.profiles[0].data.title, "Iban Conto");
});
