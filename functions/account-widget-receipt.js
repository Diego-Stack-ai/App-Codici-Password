"use strict";
const {createHash} = require('node:crypto');
const {canonicalJson} = require('./shared-vault-receipt');
const ID = /^[A-Za-z0-9._:-]{1,160}$/;
function invalid() { throw new Error('ACCOUNT_WIDGET_RESULT_UNVERIFIED'); }

// Bind the whole validated command, including omitted versus explicit null bankId.
function createAccountWidgetBinding(command, uid) {
  let encoded;
  try { encoded = canonicalJson(command); } catch { return invalid(); }
  const safe = JSON.parse(encoded);
  if (!safe || typeof safe !== 'object' || Array.isArray(safe) ||
      ![uid, safe.operationId, safe.widgetId, safe.accountId].every(v => typeof v === 'string' && ID.test(v)) ||
      !['create', 'update', 'delete'].includes(safe.action) ||
      !['private', 'company'].includes(safe.context) ||
      (safe.context === 'company' && !(typeof safe.companyId === 'string' && ID.test(safe.companyId)))) return invalid();
  const expectedRevision = safe.action === 'create' ? null : safe.expectedRevision;
  if (safe.action !== 'create' && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1 ||
      expectedRevision >= Number.MAX_SAFE_INTEGER)) return invalid();
  const fields = {bindingVersion: 1, domain: 'account-widget', ownerUid: uid,
    operationId: safe.operationId, action: safe.action, widgetId: safe.widgetId,
    expectedRevision, resultingRevision: safe.action === 'create' ? 1 : expectedRevision + 1};
  return Object.freeze({...fields, commandDigest: createHash('sha256')
    .update(canonicalJson(fields)).update('\n').update(encoded).digest('hex')});
}

function verifyAccountWidgetReceipt(previous, binding) {
  if (!previous || Object.entries(binding).some(([key, value]) => previous[key] !== value) ||
      previous.status !== 'applied' || previous.duplicate !== false ||
      previous.revision !== binding.resultingRevision) return invalid();
  return {status: 'applied', duplicate: true, revision: binding.resultingRevision};
}
module.exports = {createAccountWidgetBinding, verifyAccountWidgetReceipt};
