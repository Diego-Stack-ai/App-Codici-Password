function deny() { throw new Error('PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'); }
const own = (value, key) => Object.hasOwn(value, key);
const emptyList = value => value == null || (Array.isArray(value) && value.length === 0);
const emptyMap = value => value == null || (typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Object.keys(value).length === 0);
const emptyText = value => value == null || value === '';

// Guard the actual document read inside the mutation transaction. This does not
// establish the absence of reverse links, aliases, or related subcollections.
// Those need a separate inventory/contract; never infer them from this result.
function assertPrivateAccountWriteScope({uid, record}) {
  if (typeof uid !== 'string' || !uid || !record || typeof record !== 'object' || Array.isArray(record)) deny();
  // The Firestore path is already scoped to the authenticated UID. Legacy own
  // records without ownerId remain supported; conflicting explicit values do not.
  if (own(record, 'ownerId') && record.ownerId !== uid) deny();
  if (own(record, 'visibility') && record.visibility !== 'private') deny();
  if (own(record, 'type') && !['account', 'memo', 'memorandum'].includes(record.type)) deny();
  for (const field of ['shared', 'isMemoShared', '_isGuest', 'isBanking', 'isArchived']) {
    if (own(record, field) && record[field] !== false) deny();
  }
  if (!emptyMap(record.sharedWith) || !emptyList(record.sharedWithUids) ||
      !emptyList(record.sharedWithEmails) || !emptyText(record.recipientEmail) ||
      (record.acceptedCount != null && record.acceptedCount !== 0)) deny();
  // Support the canonical banking array and detect the historical top-level
  // sensitive fields even when the newer isBanking flag is absent or false.
  if (!emptyList(record.banking) || !emptyText(record.iban) ||
      !emptyList(record.cards) || !emptyText(record.passwordDispositiva)) deny();
  if (record.linkedProfileField != null || record.linkedCompanyProfileField != null ||
      !emptyList(record.linkedProfileFields) || !emptyList(record.linkedCompanyProfileFields)) deny();
}

module.exports = {assertPrivateAccountWriteScope};
