"use strict";

const {createHash} = require("node:crypto");
const {profileData} = require("./widget-profile-service");
const {normalizeStructuralFields, structuralTitleCase} = require("./widget-text-policy");

function profileFingerprint(widget = {}) {
  const category = typeof widget.bankId === "string" && widget.bankId ? "bank" : "account";
  const structure = {
    category,
    title: structuralTitleCase(widget.title),
    description: String(widget.description || "").trim(),
    icon: String(widget.icon || "widgets").trim() || "widgets",
    color: widget.color || "#3b82f6",
    fields: normalizeStructuralFields(widget.fields || []).map(field => ({
      label: field.label,
      type: field.type,
      encrypted: field.encrypted === true,
      preview: field.preview !== false,
      copyable: field.encrypted === true ? false : field.copyable !== false,
      includeInQr: field.encrypted === true ? false : field.includeInQr === true,
      qrLabel: String(field.qrLabel || "").trim(),
      order: Number.isInteger(field.order) ? field.order : 0,
      qrOrder: Number.isInteger(field.qrOrder) ? field.qrOrder : 0
    }))
  };
  return JSON.stringify(structure);
}

function deterministicProfileId(fingerprint) {
  return `legacy-${createHash("sha256").update(fingerprint).digest("hex").slice(0, 32)}`;
}

function planLegacyWidgetMigration(widgets = []) {
  if (!Array.isArray(widgets) || widgets.length > 100) throw new Error("WIDGET_MIGRATION_SCOPE_INVALID");
  const profiles = new Map();
  const updates = [];
  for (const source of widgets) {
    if (!source || source.kind !== "embedded" || source.profileId) continue;
    if (!source.id) throw new Error("WIDGET_MIGRATION_ID_REQUIRED");
    const fingerprint = profileFingerprint(source);
    const profileId = deterministicProfileId(fingerprint);
    const category = source.bankId ? "bank" : "account";
    if (!profiles.has(profileId)) {
      profiles.set(profileId, {
        id: profileId,
        fingerprint,
        data: profileData({
          category,
          title: source.title,
          description: source.description || "",
          icon: source.icon || "widgets",
          color: source.color || "#3b82f6",
          fields: source.fields
        })
      });
    }
    updates.push({
      id: source.id,
      profileId,
      profileCategory: category,
      title: structuralTitleCase(source.title),
      fields: normalizeStructuralFields(source.fields || [])
    });
  }
  return {profiles: [...profiles.values()], updates};
}

module.exports = {deterministicProfileId, planLegacyWidgetMigration, profileFingerprint};
