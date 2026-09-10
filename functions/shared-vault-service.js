"use strict";

const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;
const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const FIELD_TYPES = new Set([
  "text", "textarea", "number", "date", "phone", "email", "address", "url",
  "select", "boolean", "identifier", "sensitive", "expiry", "account-link", "address-link"
]);
const ACTIONS = new Set(["create", "update", "link", "unlink", "delete"]);
const MAX_FIELDS = 30;

function plainObject(value, code) {
  if (!value || Object.getPrototypeOf(value) !== Object.prototype) throw new Error(code);
  return value;
}

function identifier(value, code = "SHARED_VAULT_IDENTIFIER_INVALID") {
  const normalized = String(value || "").trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) throw new Error(code);
  return normalized;
}

function shortText(value, maximum, code, {required = false} = {}) {
  if (typeof value !== "string") throw new Error(code);
  const normalized = value.trim();
  if ((required && !normalized) || normalized.length > maximum) throw new Error(code);
  return normalized;
}

function optionalText(value, maximum, code) {
  if (value === undefined) return "";
  return shortText(value, maximum, code);
}

function fieldValue(field) {
  if (field.encrypted === true) {
    // Un campo sensibile può essere opzionale e quindi ancora vuoto. In quel
    // caso il client lo rappresenta con valueEnc=""; resta comunque vietata
    // qualsiasi proprietà `value`, così il testo in chiaro non può transitare.
    if (typeof field.valueEnc !== "string" || field.valueEnc.length > 20000 || "value" in field) {
      throw new Error("SHARED_VAULT_FIELD_ENCRYPTION_INVALID");
    }
    return {valueEnc: field.valueEnc};
  }
  if ("valueEnc" in field) throw new Error("SHARED_VAULT_FIELD_ENCRYPTION_INVALID");
  const value = field.value ?? "";
  if (!["string", "number", "boolean"].includes(typeof value) ||
      typeof value === "string" && value.length > 10000) {
    throw new Error("SHARED_VAULT_FIELD_VALUE_INVALID");
  }
  return {value};
}

function validateField(input, index) {
  const field = plainObject(input, "SHARED_VAULT_FIELD_INVALID");
  const type = String(field.type || "").trim().toLowerCase();
  if (!FIELD_TYPES.has(type)) throw new Error("SHARED_VAULT_FIELD_TYPE_INVALID");
  const encrypted = field.encrypted === true;
  if (type === "sensitive" && !encrypted) throw new Error("SHARED_VAULT_FIELD_ENCRYPTION_REQUIRED");
  if (encrypted && (field.includeInQr === true || field.copyable === true)) {
    throw new Error("SHARED_VAULT_FIELD_EXPOSURE_INVALID");
  }
  return {
    id: identifier(field.id, "SHARED_VAULT_FIELD_ID_INVALID"),
    label: shortText(field.label, 120, "SHARED_VAULT_FIELD_LABEL_INVALID", {required: true}),
    type,
    order: Number.isInteger(field.order) && field.order >= 0 ? field.order : index,
    sensitivity: encrypted ? "secret" : "normal",
    encrypted,
    preview: encrypted ? false : field.preview !== false,
    copyable: encrypted ? false : field.copyable !== false,
    includeInQr: encrypted ? false : field.includeInQr === true,
    qrLabel: optionalText(field.qrLabel, 120, "SHARED_VAULT_FIELD_QR_LABEL_INVALID"),
    qrOrder: Number.isInteger(field.qrOrder) && field.qrOrder >= 0 ? field.qrOrder : index,
    ...fieldValue(field)
  };
}

function validateFields(fields) {
  if (!Array.isArray(fields) || fields.length < 1 || fields.length > MAX_FIELDS) {
    throw new Error("SHARED_VAULT_FIELDS_INVALID");
  }
  const normalized = fields.map(validateField);
  if (new Set(normalized.map(field => field.id)).size !== normalized.length) {
    throw new Error("SHARED_VAULT_FIELD_DUPLICATE");
  }
  return normalized;
}

function validateSharedData(input) {
  const data = plainObject(input, "SHARED_VAULT_DATA_INVALID");
  return {
    title: shortText(data.title, 120, "SHARED_VAULT_TITLE_INVALID", {required: true}),
    description: optionalText(data.description, 500, "SHARED_VAULT_DESCRIPTION_INVALID"),
    icon: optionalText(data.icon ?? "key", 80, "SHARED_VAULT_ICON_INVALID") || "key",
    color: HEX_COLOR_PATTERN.test(data.color || "") ? data.color : "#3b82f6",
    fields: validateFields(data.fields),
    schemaVersion: 1
  };
}

function validateLink(input) {
  const link = plainObject(input, "SHARED_VAULT_LINK_INVALID");
  const context = link.context === "private" ? "private" : link.context === "company" ? "company" : null;
  if (!context) throw new Error("SHARED_VAULT_CONTEXT_INVALID");
  const normalized = {
    context,
    accountId: identifier(link.accountId, "SHARED_VAULT_ACCOUNT_ID_INVALID"),
    order: Number.isInteger(link.order) && link.order >= 0 ? link.order : 0,
    collapsed: link.collapsed === true
  };
  if (context === "company") {
    normalized.companyId = identifier(link.companyId, "SHARED_VAULT_COMPANY_ID_INVALID");
  }
  return normalized;
}

function validateSharedVaultCommand(input = {}) {
  const command = plainObject(input, "SHARED_VAULT_COMMAND_INVALID");
  const action = String(command.action || "");
  if (!ACTIONS.has(action)) throw new Error("SHARED_VAULT_ACTION_INVALID");
  const normalized = {
    operationId: identifier(command.operationId, "SHARED_VAULT_OPERATION_ID_INVALID"),
    action,
    sharedDataId: identifier(command.sharedDataId, "SHARED_VAULT_DATA_ID_INVALID")
  };
  if (["update", "link", "unlink", "delete"].includes(action)) {
    if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 1) {
      throw new Error("SHARED_VAULT_REVISION_INVALID");
    }
    normalized.expectedRevision = command.expectedRevision;
  }
  if (["create", "update"].includes(action)) normalized.data = validateSharedData(command.data);
  if (["link", "unlink"].includes(action)) {
    normalized.linkId = identifier(command.linkId, "SHARED_VAULT_LINK_ID_INVALID");
    normalized.widgetId = identifier(command.widgetId, "SHARED_VAULT_WIDGET_ID_INVALID");
    normalized.link = validateLink(command.link);
  }
  return normalized;
}

function accountPath(uid, link) {
  const owner = identifier(uid, "SHARED_VAULT_OWNER_INVALID");
  return link.context === "company"
    ? `users/${owner}/aziende/${link.companyId}/accounts/${link.accountId}`
    : `users/${owner}/accounts/${link.accountId}`;
}

function sharedVaultPaths(uid, command) {
  const owner = identifier(uid, "SHARED_VAULT_OWNER_INVALID");
  const root = `users/${owner}`;
  const paths = {
    data: `${root}/sharedVaultData/${command.sharedDataId}`,
    operation: `${root}/operationResults/${command.operationId}`
  };
  if (command.linkId) paths.link = `${root}/sharedVaultLinks/${command.linkId}`;
  if (command.widgetId) paths.widget = `${root}/accountWidgets/${command.widgetId}`;
  if (command.link) paths.account = accountPath(owner, command.link);
  return paths;
}

function revisionDecision({exists, currentRevision = 0, expectedRevision, previous, action}) {
  if (previous) return {status: previous.status, duplicate: true, revision: previous.revision};
  if (action === "create") {
    return exists ? {status: "conflict", duplicate: false, revision: currentRevision} :
      {status: "applied", duplicate: false, revision: 1};
  }
  if (!exists) return {status: "missing", duplicate: false, revision: 0};
  if (currentRevision !== expectedRevision) {
    return {status: "conflict", duplicate: false, revision: currentRevision};
  }
  return {status: "applied", duplicate: false, revision: currentRevision + 1};
}

module.exports = {
  MAX_FIELDS,
  accountPath,
  revisionDecision,
  sharedVaultPaths,
  validateFields,
  validateSharedData,
  validateSharedVaultCommand
};
