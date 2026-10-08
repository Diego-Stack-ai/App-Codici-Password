const {accountPath, validatePurgeCommand} = require('./archive-purge-service');

const IDENTIFIER = /^[A-Za-z0-9._:-]{1,160}$/;
const COLLECTIONS = ['widgets', 'links', 'invites', 'sharedData'];
const isObject = value => value && Object.getPrototypeOf(value) === Object.prototype;
const isId = value => typeof value === 'string' && IDENTIFIER.test(value);

function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

// Pure proposal only: never imported by a callable or a Firestore writer.
// inventory.complete is the caller's assertion that its snapshot covers the
// full target scope, NOT evidence that a database query was actually complete.
// writeBudget is the REMAINING budget after every other planned transaction
// write (profile cleanup, receipt, audit, etc.), not a transaction-wide promise.
// Inventory entries contain metadata only: {path, context, accountId,
// companyId?, kind?, linkId?, widgetId?, sharedDataId?, ownerId?, aziendaId?,
// revision?}. Record bodies/ciphertexts are neither needed nor returned.
// The returned paths are INTERNAL: legacy invitation IDs can contain email
// addresses. Never copy this plan into logs, audit records or user messages.
function planArchivePurgeReferences({uid, command, inventory, writeBudget} = {}) {
  const anomalies = [], deletes = new Set(), touchIds = new Set(), touches = [];
  let target = null;
  const flag = (code, collection, index) => anomalies.push({code,
    ...(collection ? {collection} : {}), ...(Number.isInteger(index) ? {index} : {})});
  const result = () => freeze({schemaVersion: 1, target, valid: anomalies.length === 0,
    applicable: false, activation: {integrated: false, requiredGate: 'GLOBAL_PURGE_LOCK', grantCleanup: 'EXCLUDED_UNRESOLVED'},
    deletePaths: anomalies.length ? [] : [...deletes].sort(),
    revisionTouches: anomalies.length ? [] : touches.sort((left, right) => left.path.localeCompare(right.path)),
    plannedWriteCount: anomalies.length ? 0 : deletes.size + touches.length, anomalies});

  try {
    if (!isId(uid)) throw new Error();
    const normalized = validatePurgeCommand(command);
    if (!normalized.confirmation || !Number.isSafeInteger(normalized.expectedRevision)) throw new Error();
    target = {ownerUid: uid, context: normalized.context, accountId: normalized.accountId,
      companyId: normalized.companyId, accountPath: accountPath(uid, normalized)};
  } catch { flag('TARGET_INVALID'); return result(); }
  if (!Number.isSafeInteger(writeBudget) || writeBudget < 0 || writeBudget > 450) flag('WRITE_BUDGET_INVALID');
  const expectedScope = {ownerUid: uid, context: target.context, accountId: target.accountId, companyId: target.companyId};
  const scope = inventory?.scope;
  if (!isObject(scope) || Object.keys(scope).length !== 4 ||
      Object.entries(expectedScope).some(([key, value]) => scope[key] !== value)) flag('INVENTORY_SCOPE_MISMATCH');
  if (!isObject(inventory?.complete) || COLLECTIONS.some(key => inventory.complete[key] !== true)) flag('INVENTORY_INCOMPLETE');
  if (COLLECTIONS.some(key => !Array.isArray(inventory?.[key]))) flag('INVENTORY_SHAPE_INVALID');
  if (anomalies.length) return result();

  const paths = {widgets: `users/${uid}/accountWidgets/`, links: `users/${uid}/sharedVaultLinks/`,
    sharedData: `users/${uid}/sharedVaultData/`, invites: 'invites/'};
  const maps = {};
  for (const collection of COLLECTIONS) {
    const map = new Map(); maps[collection] = map;
    inventory[collection].forEach((entry, index) => {
      const path = entry?.path, prefix = paths[collection];
      const id = typeof path === 'string' && path.startsWith(prefix) ? path.slice(prefix.length) : '';
      const validId = collection === 'invites' ? id.length > 0 && id.length <= 1500 && !id.includes('/') && !['.', '..'].includes(id) : isId(id);
      if (!isObject(entry) || !validId) { flag('METADATA_PATH_INVALID', collection, index); return; }
      if (map.has(path)) { flag('DUPLICATE_METADATA_PATH', collection, index); return; }
      map.set(path, {entry, id, index});
    });
  }
  const belongs = (meta, collection) => {
    const {entry, index} = meta;
    if (!isId(entry.accountId)) { flag('ACCOUNT_IDENTITY_INVALID', collection, index); return false; }
    if (entry.accountId !== target.accountId) return false;
    if (!['private', 'company'].includes(entry.context) ||
        (entry.context === 'private' && Object.hasOwn(entry, 'companyId')) ||
        (entry.context === 'company' && !isId(entry.companyId))) {
      flag('ACCOUNT_IDENTITY_INVALID', collection, index); return false;
    }
    return entry.context === target.context && (entry.context === 'private' || entry.companyId === target.companyId);
  };
  const pair = (widget, link) => {
    const w = widget.entry, l = link.entry;
    if (w.kind !== 'shared-reference' || !isId(w.sharedDataId) || !isId(w.linkId) ||
        !isId(l.sharedDataId) || !isId(l.widgetId) || w.sharedDataId !== l.sharedDataId ||
        w.linkId !== link.id || l.widgetId !== widget.id ||
        !belongs(widget, 'widgets') || !belongs(link, 'links')) return false;
    deletes.add(w.path); deletes.add(l.path); touchIds.add(w.sharedDataId);
    return true;
  };

  for (const widget of maps.widgets.values()) {
    if (!belongs(widget, 'widgets')) continue;
    const {entry, index} = widget;
    if (entry.kind === 'embedded') {
      if (Object.hasOwn(entry, 'sharedDataId') || Object.hasOwn(entry, 'linkId')) flag('EMBEDDED_REFERENCE_INVALID', 'widgets', index);
      else deletes.add(entry.path);
    } else if (entry.kind === 'shared-reference') {
      const link = isId(entry.linkId) && maps.links.get(`${paths.links}${entry.linkId}`);
      if (!link) flag('SHARED_PAIR_INCOMPLETE', 'widgets', index);
      else if (!pair(widget, link)) flag('SHARED_PAIR_MISMATCH', 'widgets', index);
    } else flag('WIDGET_KIND_UNSUPPORTED', 'widgets', index);
  }
  for (const link of maps.links.values()) {
    if (!belongs(link, 'links')) continue;
    const widget = isId(link.entry.widgetId) && maps.widgets.get(`${paths.widgets}${link.entry.widgetId}`);
    if (!widget) flag('SHARED_PAIR_INCOMPLETE', 'links', link.index);
    else if (!pair(widget, link)) flag('SHARED_PAIR_MISMATCH', 'links', link.index);
  }
  // Complete inventories must also reveal foreign incoming references. A
  // coherent target pair does not justify leaving another account dangling.
  for (const widget of maps.widgets.values()) {
    if (!deletes.has(widget.entry.path) && isId(widget.entry.linkId) &&
        deletes.has(`${paths.links}${widget.entry.linkId}`)) flag('FOREIGN_INCOMING_REFERENCE', 'widgets', widget.index);
  }
  for (const link of maps.links.values()) {
    if (!deletes.has(link.entry.path) && isId(link.entry.widgetId) &&
        deletes.has(`${paths.widgets}${link.entry.widgetId}`)) flag('FOREIGN_INCOMING_REFERENCE', 'links', link.index);
  }
  for (const sharedDataId of touchIds) {
    const path = `${paths.sharedData}${sharedDataId}`, data = maps.sharedData.get(path);
    if (!data) { flag('SHARED_DATA_MISSING', 'sharedData'); continue; }
    const revision = data.entry.revision;
    if (!Number.isSafeInteger(revision) || revision < 1 || revision === Number.MAX_SAFE_INTEGER) {
      flag('SHARED_REVISION_INVALID', 'sharedData', data.index); continue;
    }
    touches.push({path, expectedRevision: revision, nextRevision: revision + 1});
  }
  for (const invite of maps.invites.values()) {
    const {entry, index} = invite;
    if (!isId(entry.ownerId) || !isId(entry.accountId)) { flag('INVITE_IDENTITY_INVALID', 'invites', index); continue; }
    if (entry.ownerId !== uid || entry.accountId !== target.accountId) continue;
    const hasCompany = Object.hasOwn(entry, 'aziendaId');
    if (hasCompany && !isId(entry.aziendaId)) { flag('INVITE_IDENTITY_INVALID', 'invites', index); continue; }
    if (target.context === 'private' ? !hasCompany : hasCompany && entry.aziendaId === target.companyId) deletes.add(entry.path);
  }
  if (deletes.size + touches.length > writeBudget) flag('WRITE_BUDGET_EXCEEDED');
  return result();
}

module.exports = {planArchivePurgeReferences};
