"use strict";

const {accountPath, revisionDecision, validateFields} = require("./shared-vault-service");

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const ACTIONS = new Set(["create", "update", "delete"]);

function identifier(value, code) {
  const normalized = String(value || "").trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) throw new Error(code);
  return normalized;
}

function text(value, maximum, code, required = false) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum) throw new Error(code);
  return normalized;
}

function widgetContext(input = {}) {
  const context = input.context === "private" ? "private" : input.context === "company" ? "company" : null;
  if (!context) throw new Error("ACCOUNT_WIDGET_CONTEXT_INVALID");
  const result = {context, accountId: identifier(input.accountId, "ACCOUNT_WIDGET_ACCOUNT_INVALID")};
  if (context === "company") result.companyId = identifier(input.companyId, "ACCOUNT_WIDGET_COMPANY_INVALID");
  return result;
}

function widgetData(input = {}) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) throw new Error("ACCOUNT_WIDGET_DATA_INVALID");
  return {
    kind: "embedded",
    title: text(input.title, 120, "ACCOUNT_WIDGET_TITLE_INVALID", true),
    description: text(input.description ?? "", 500, "ACCOUNT_WIDGET_DESCRIPTION_INVALID"),
    icon: text(input.icon ?? "widgets", 80, "ACCOUNT_WIDGET_ICON_INVALID") || "widgets",
    color: HEX_COLOR_PATTERN.test(input.color || "") ? input.color : "#3b82f6",
    order: Number.isInteger(input.order) && input.order >= 0 ? input.order : 0,
    collapsed: input.collapsed === true,
    fields: validateFields(input.fields),
    schemaVersion: 1
  };
}

function validateAccountWidgetCommand(input = {}) {
  if (!input || Object.getPrototypeOf(input) !== Object.prototype) throw new Error("ACCOUNT_WIDGET_COMMAND_INVALID");
  const action = String(input.action || "");
  if (!ACTIONS.has(action)) throw new Error("ACCOUNT_WIDGET_ACTION_INVALID");
  const command = {
    action,
    operationId: identifier(input.operationId, "ACCOUNT_WIDGET_OPERATION_INVALID"),
    widgetId: identifier(input.widgetId, "ACCOUNT_WIDGET_ID_INVALID"),
    ...widgetContext(input)
  };
  if (action !== "create") {
    if (!Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
      throw new Error("ACCOUNT_WIDGET_REVISION_INVALID");
    }
    command.expectedRevision = input.expectedRevision;
  }
  if (action !== "delete") command.data = widgetData(input.data);
  return command;
}

function accountWidgetPaths(uid, command) {
  const owner = identifier(uid, "ACCOUNT_WIDGET_OWNER_INVALID");
  return {
    account: accountPath(owner, command),
    widget: `users/${owner}/accountWidgets/${command.widgetId}`,
    operation: `users/${owner}/operationResults/${command.operationId}`
  };
}

function widgetBelongsToCommand(widget = {}, command) {
  return widget.kind === "embedded" && widget.context === command.context &&
    widget.accountId === command.accountId &&
    (command.context !== "company" || widget.companyId === command.companyId);
}

module.exports = {
  accountWidgetPaths,
  revisionDecision,
  validateAccountWidgetCommand,
  widgetBelongsToCommand
};
