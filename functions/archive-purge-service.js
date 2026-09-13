const IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,160}$/;

function requireIdentifier(value) {
  const normalized = String(value || "").trim();
  if (!IDENTIFIER_PATTERN.test(normalized)) throw new Error("INVALID_IDENTIFIER");
  return normalized;
}

function validatePurgeCommand(input = {}) {
  const context = input.context === "private" ? "private" : input.context === "company" ? "company" : null;
  if (!context) throw new Error("INVALID_CONTEXT");
  const command = {
    accountId: requireIdentifier(input.accountId),
    operationId: requireIdentifier(input.operationId),
    context,
    companyId: context === "company" ? requireIdentifier(input.companyId) : null,
    expectedRevision: Number(input.expectedRevision),
    confirmation: input.confirmation === "DELETE_FOREVER"
  };
  if (!Number.isInteger(command.expectedRevision) || command.expectedRevision < 0) {
    throw new Error("INVALID_REVISION");
  }
  return command;
}

function accountPath(uid, command) {
  const owner = requireIdentifier(uid);
  if (command.context === "private") return `users/${owner}/accounts/${command.accountId}`;
  return `users/${owner}/aziende/${command.companyId}/accounts/${command.accountId}`;
}

function allowedAttachmentPrefix(uid, command) {
  return `${accountPath(uid, command)}/attachments/`;
}

function isSafeAttachmentPath(uid, command, storagePath) {
  return typeof storagePath === "string" &&
    storagePath.startsWith(allowedAttachmentPrefix(uid, command)) &&
    !storagePath.includes("..") && storagePath.length <= 1024;
}

function purgeDecision({record, expectedRevision, confirmed, previous}) {
  if (previous?.status === "purged") return {status: "purged", duplicate: true};
  if (previous?.status === "processing" && !record) return {status: "resume", duplicate: false};
  if (!record) return {status: "not-found", duplicate: false};
  if (record.isArchived !== true) return {status: "not-archived", duplicate: false};
  const currentRevision = Number.isInteger(record.revision) ? record.revision : 0;
  if (currentRevision !== expectedRevision) return {status: "conflict", duplicate: false, revision: currentRevision};
  if (!confirmed) return {status: "confirmation-required", duplicate: false};
  return {status: "ready", duplicate: false, revision: currentRevision};
}

function planProfileReferenceCleanup(source, command, {company = false} = {}) {
  const invalid = () => { throw new Error('PROFILE_REFERENCE_SHAPE_UNSUPPORTED'); };
  const object = value => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) invalid();
    return value;
  };
  object(source);
  const targetCompany = command.context === 'private' ? '' : requireIdentifier(command.companyId);
  if (!['private', 'company'].includes(command.context)) invalid();
  const accountId = requireIdentifier(command.accountId);
  const contact = value => {
    object(value);
    // Historical null means no link. Do not rewrite unrelated legacy contacts.
    for (const field of ['linkedAccountId', 'linkedAccountCompanyId']) {
      if (value[field] != null && typeof value[field] !== 'string') invalid();
    }
    return value.linkedAccountId === accountId && (value.linkedAccountCompanyId || '') === targetCompany ?
      {...value, linkedAccountId: '', linkedAccountCompanyId: ''} : value;
  };
  const array = (values, transform) => {
    if (!Array.isArray(values)) invalid();
    const next = values.map(transform);
    return next.some((value, index) => value !== values[index]) ? next : values;
  };
  const patch = {};
  if (!company) {
    for (const field of ['contactEmails', 'contactPhones', 'documenti']) {
      if (source[field] === undefined) continue;
      const next = array(source[field], contact);
      if (next !== source[field]) patch[field] = next;
    }
    if (source.userAddresses !== undefined) {
      const next = array(source.userAddresses, address => {
        object(address);
        if (address.utilities === undefined) return address;
        const utilities = array(address.utilities, contact);
        return utilities === address.utilities ? address : {...address, utilities};
      });
      if (next !== source.userAddresses) patch.userAddresses = next;
    }
  } else {
    if (source.emails !== undefined) {
      const emails = object(source.emails), next = {...emails};
      for (const slot of ['pec', 'amministrazione', 'personale']) {
        if (emails[slot] !== undefined) next[slot] = contact(emails[slot]);
      }
      if (emails.extra !== undefined) next.extra = array(emails.extra, contact);
      if (Object.keys(next).some(key => next[key] !== emails[key])) patch.emails = next;
    }
    if (source.phoneAccountLinks !== undefined) {
      const links = object(source.phoneAccountLinks), next = {...links};
      for (const slot of ['telefonoAzienda', 'faxAzienda', 'referenteCellulare']) {
        if (links[slot] !== undefined) next[slot] = contact(links[slot]);
      }
      if (Object.keys(next).some(key => next[key] !== links[key])) patch.phoneAccountLinks = next;
    }
  }
  return patch;
}

module.exports = {
  accountPath,
  isSafeAttachmentPath,
  purgeDecision,
  planProfileReferenceCleanup,
  validatePurgeCommand
};
