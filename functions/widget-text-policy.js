"use strict";

function structuralTitleCase(value) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("it-IT")
    .replace(/\p{L}[\p{L}\p{M}]*/gu, word =>
      word.charAt(0).toLocaleUpperCase("it-IT") + word.slice(1));
}

function normalizeStructuralFields(fields = []) {
  return fields.map(field => ({...field, label: structuralTitleCase(field?.label)}));
}

module.exports = {normalizeStructuralFields, structuralTitleCase};
