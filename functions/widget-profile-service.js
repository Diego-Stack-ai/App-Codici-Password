"use strict";

const {revisionDecision, validateFields} = require("./shared-vault-service");
const {normalizeStructuralFields, structuralTitleCase} = require("./widget-text-policy");

const ID = /^[A-Za-z0-9._:-]{1,160}$/;
const CATEGORIES = new Set(["account", "bank"]);
const ACTIONS = new Set(["create", "update", "delete"]);

function identifier(value, code) {
  const normalized = String(value || "").trim();
  if (!ID.test(normalized)) throw new Error(code);
  return normalized;
}

function text(value, maximum, code, required = false) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum) throw new Error(code);
  return normalized;
}

function profileData(input = {}) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) throw new Error("WIDGET_PROFILE_DATA_INVALID");
  const category = String(input.category || "");
  if (!CATEGORIES.has(category)) throw new Error("WIDGET_PROFILE_CATEGORY_INVALID");
  if (!Array.isArray(input.fields) || !input.fields.length) throw new Error("WIDGET_PROFILE_FIELDS_REQUIRED");
  const definitions = input.fields.map(field => {
    if (!field || Object.getPrototypeOf(field) !== Object.prototype) return field;
    const definition = {...field};
    delete definition.value;
    delete definition.valueEnc;
    if (definition.encrypted === true) definition.valueEnc = "";
    else definition.value = "";
    return definition;
  });
  const fields = normalizeStructuralFields(validateFields(definitions)).map(field => {
    const definition = {...field};
    delete definition.value;
    delete definition.valueEnc;
    return definition;
  });
  return {
    kind: "widget-profile",
    category,
    title: structuralTitleCase(text(input.title, 120, "WIDGET_PROFILE_TITLE_INVALID", true)),
    description: text(input.description ?? "", 500, "WIDGET_PROFILE_DESCRIPTION_INVALID"),
    icon: text(input.icon ?? "widgets", 80, "WIDGET_PROFILE_ICON_INVALID") || "widgets",
    color: /^#[0-9a-fA-F]{6}$/.test(input.color || "") ? input.color : "#3b82f6",
    fields,
    schemaVersion: 1
  };
}

function validateWidgetProfileCommand(input = {}) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) throw new Error("WIDGET_PROFILE_COMMAND_INVALID");
  const action = String(input.action || "");
  if (!ACTIONS.has(action)) throw new Error("WIDGET_PROFILE_ACTION_INVALID");
  const command = {
    action,
    operationId: identifier(input.operationId, "WIDGET_PROFILE_OPERATION_INVALID"),
    profileId: identifier(input.profileId, "WIDGET_PROFILE_ID_INVALID")
  };
  if (action !== "create") {
    if (!Number.isSafeInteger(input.expectedRevision) || input.expectedRevision < 1) {
      throw new Error("WIDGET_PROFILE_REVISION_INVALID");
    }
    command.expectedRevision = input.expectedRevision;
  }
  if (action !== "delete") command.data = profileData(input.data);
  return command;
}

function widgetProfilePaths(uid, command) {
  const owner = identifier(uid, "WIDGET_PROFILE_OWNER_INVALID");
  return {
    profile: `users/${owner}/accountWidgetProfiles/${command.profileId}`,
    operation: `users/${owner}/operationResults/${command.operationId}`
  };
}

function sameWidgetTarget(widget = {}, command = {}) {
  if (widget.profileId !== command.data?.profileId || widget.context !== command.context ||
      widget.accountId !== command.accountId) return false;
  if (command.context === "company" && widget.companyId !== command.companyId) return false;
  const requestedBank = command.data?.bankId || null;
  return (widget.bankId || null) === requestedBank;
}

module.exports = {profileData, revisionDecision, sameWidgetTarget, validateWidgetProfileCommand, widgetProfilePaths};
