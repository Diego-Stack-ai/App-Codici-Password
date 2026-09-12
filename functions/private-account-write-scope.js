function deny() { throw new Error('PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'); }
const own = (value, key) => Object.hasOwn(value, key);
const emptyList = value => value == null || (Array.isArray(value) && value.length === 0);
const emptyMap = value => value == null || (typeof value === 'object' && !Array.isArray(value) &&
  [Object.prototype, null].includes(Object.getPrototypeOf(value)) && Object.keys(value).length === 0);
const emptyText = value => value == null || value === '';

// Guard the actual document read inside the mutation transaction. This does not
// establish the absence of reverse links or related subcollections on its own.
// Profile references are checked separately below; other domains remain outside
// this bounded policy.
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

// Read-only scan of the actual profile documents, including hidden/archived
// contacts. A stored legacy alias requires a separate identity resolution path.
function assertPrivateAccountReferenceScope({recordId, record, profile, companies}) {
  const map = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) deny();
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype.constructor?.name !== 'Object') deny();
    return value;
  };
  const list = value => {
    if (value === undefined) return [];
    if (!Array.isArray(value)) deny();
    return value;
  };
  const contact = value => {
    map(value);
    for (const field of ['linkedAccountId', 'linkedAccountCompanyId']) {
      if (own(value, field) && typeof value[field] !== 'string') deny();
    }
    if (value.linkedAccountId === recordId && !value.linkedAccountCompanyId) deny();
  };
  if (typeof recordId !== 'string' || !recordId) deny();
  if (record && own(record, 'id') && record.id !== recordId) deny();
  map(profile);
  for (const field of ['contactEmails', 'contactPhones', 'documenti']) list(profile[field]).forEach(contact);
  for (const address of list(profile.userAddresses)) {
    map(address); list(address.utilities).forEach(contact);
  }
  for (const company of list(companies)) {
    map(company);
    if (company.emails !== undefined) {
      map(company.emails);
      for (const slot of ['pec', 'amministrazione', 'personale']) {
        if (company.emails[slot] !== undefined) contact(company.emails[slot]);
      }
      list(company.emails.extra).forEach(contact);
    }
    if (company.phoneAccountLinks !== undefined) {
      map(company.phoneAccountLinks);
      for (const slot of ['telefonoAzienda', 'faxAzienda', 'referenteCellulare']) {
        if (company.phoneAccountLinks[slot] !== undefined) contact(company.phoneAccountLinks[slot]);
      }
    }
  }
}

module.exports = {assertPrivateAccountWriteScope, assertPrivateAccountReferenceScope};
