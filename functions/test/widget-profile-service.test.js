"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {profileData, sameWidgetTarget, validateWidgetProfileCommand, widgetProfilePaths} = require("../widget-profile-service");

const fields = [{id: "f-1", label: "Campo libero", type: "text", encrypted: false, order: 0}];

test("profili Account e Banca conservano solo la definizione dei campi", () => {
  for (const category of ["account", "bank"]) {
    const data = profileData({category, title: "Profilo libero", fields: [{...fields[0], value: "segreto"}]});
    assert.equal(data.category, category);
    assert.equal(data.fields[0].value, undefined);
    assert.equal(data.fields[0].valueEnc, undefined);
  }
});

test("titoli ed etichette strutturali sono uniformati senza valori", () => {
  const data = profileData({category: "bank", title: "  REFERENTE banca 2 ", fields: [{
    id: "f", label: "numero VERDE", type: "text", encrypted: false, value: "NON MODIFICARE"
  }]});
  assert.equal(data.title, "Referente Banca 2");
  assert.equal(data.fields[0].label, "Numero Verde");
  assert.equal(data.fields[0].value, undefined);
});

test("un campo sensibile del profilo non conserva mai valori", () => {
  const data = profileData({category: "bank", title: "Sicuro", fields: [{
    id: "secret", label: "PIN aggiuntivo", type: "sensitive", encrypted: true, value: "1234", order: 0
  }]});
  assert.equal(data.fields[0].encrypted, true);
  assert.equal(data.fields[0].value, undefined);
  assert.equal(data.fields[0].valueEnc, undefined);
});

test("un profilo richiede titolo, categoria e almeno un campo liberamente definito", () => {
  assert.throws(() => profileData({category: "other", title: "X", fields}), /CATEGORY/);
  assert.throws(() => profileData({category: "account", title: "", fields}), /TITLE/);
  assert.throws(() => profileData({category: "bank", title: "X", fields: []}), /FIELDS_REQUIRED/);
});

test("comandi e percorsi profilo restano confinati al proprietario", () => {
  const command = validateWidgetProfileCommand({action: "create", operationId: "op-1", profileId: "p-1",
    data: {category: "account", title: "Libero", fields}});
  assert.deepEqual(widgetProfilePaths("owner", command), {
    profile: "users/owner/accountWidgetProfiles/p-1",
    operation: "users/owner/operationResults/op-1"
  });
});

test("duplicato significa stesso profilo nella stessa destinazione", () => {
  const base = {profileId: "p-1", context: "private", accountId: "a-1"};
  assert.equal(sameWidgetTarget(base, {...base, data: {profileId: "p-1"}}), true);
  assert.equal(sameWidgetTarget({...base, bankId: "b-1"}, {...base, data: {profileId: "p-1", bankId: "b-1"}}), true);
  assert.equal(sameWidgetTarget({...base, bankId: "b-2"}, {...base, data: {profileId: "p-1", bankId: "b-1"}}), false);
  assert.equal(sameWidgetTarget({...base, accountId: "a-2"}, {...base, data: {profileId: "p-1"}}), false);
});
