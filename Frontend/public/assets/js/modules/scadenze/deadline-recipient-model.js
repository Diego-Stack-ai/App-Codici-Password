export function normalizeRecipientEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function isValidRecipientEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeRecipientEmail(value));
}

export function normalizeDeadlineCompanyContext(value = {}) {
    value = value && typeof value === 'object' ? value : {};
    const kind = value?.kind === 'external' ? 'external' : value?.kind === 'company' ? 'company' : '';
    const companyId = kind === 'company' ? String(value.companyId || '').trim() : '';
    const companyName = String(value.companyName || value.name || '').trim();
    if (!kind || !companyName || (kind === 'company' && !companyId)) return null;
    return {kind, companyId, companyName};
}

export function deadlineCompanyContextFromRecord(record = {}) {
    return normalizeDeadlineCompanyContext(record.companyContext || {
        kind: record.companyContextKind,
        companyId: record.companyId,
        companyName: record.companyName
    });
}

export function deadlineDomainNeedsCompany(domain) {
    return domain === 'company' || domain === 'user-company';
}

export function contactCompanyAssociations(contact = {}) {
    const stored = Array.isArray(contact.companyAssociations) ? contact.companyAssociations : [];
    return stored.map(normalizeDeadlineCompanyContext).filter(Boolean);
}

export function contactHasCompanyAssociation(contact, context) {
    const normalized = normalizeDeadlineCompanyContext(context);
    if (!normalized) return false;
    return contactCompanyAssociations(contact).some(item => item.kind === normalized.kind
        && (item.kind === 'company' ? item.companyId === normalized.companyId : item.companyName === normalized.companyName));
}

export function mergeContactCompanyAssociation(contact = {}, context) {
    const normalized = normalizeDeadlineCompanyContext(context);
    if (!normalized || contactHasCompanyAssociation(contact, normalized)) return {...contact};
    return {...contact, companyAssociations: [...contactCompanyAssociations(contact), normalized]};
}

export function deadlineRecipientDisplayName(contact = {}, context = null) {
    const person = [contact.nome, contact.cognome].filter(Boolean).join(' ').trim()
        || String(contact.displayName || contact.name || '').trim()
        || normalizeRecipientEmail(contact.email);
    const normalized = normalizeDeadlineCompanyContext(context);
    return normalized?.companyName ? `${person} · ${normalized.companyName}` : person;
}

export function normalizeDeadlineRecipient(recipient = {}, { defaultSendEmail = false } = {}) {
    const email = normalizeRecipientEmail(recipient.email || recipient.address);
    if (!isValidRecipientEmail(email)) return null;
    const companyContext = normalizeDeadlineCompanyContext(recipient.companyContext || recipient);
    return {
        email,
        displayName: String(recipient.displayName || recipient.name || '').trim(),
        contactId: String(recipient.contactId || '').trim(),
        sendEmail: recipient.sendEmail === undefined ? defaultSendEmail : recipient.sendEmail === true,
        sendPush: recipient.sendPush === true,
        canManage: recipient.canManage === true,
        ...(companyContext ? {companyContext} : {})
    };
}

export function deadlineRecipientsFromRecord(record = {}) {
    const stored = Array.isArray(record.recipients) ? record.recipients : [];
    const legacy = Array.isArray(record.emails)
        ? record.emails.map(item => typeof item === 'object' && item !== null ? item.address : item)
        : [record.email1, record.email2];
    const source = stored.length
        ? stored
        : legacy.filter(Boolean).map(email => ({ email, sendEmail: true, sendPush: false }));

    return source
        .map(recipient => normalizeDeadlineRecipient(recipient, { defaultSendEmail: true }))
        .filter(Boolean);
}

export function deadlineRecipientFields(recipients = []) {
    const normalized = recipients.map(recipient => normalizeDeadlineRecipient(recipient)).filter(Boolean);
    const legacyEmails = normalized.filter(recipient => recipient.sendEmail).map(recipient => recipient.email);
    return {
        recipients: normalized,
        email1: legacyEmails[0] || '',
        email2: legacyEmails[1] || ''
    };
}

export function mergeDeadlineRecipient(recipients, candidate) {
    const normalized = normalizeDeadlineRecipient(candidate);
    if (!normalized) return {recipients, added: false};
    const index = recipients.findIndex(item => normalizeRecipientEmail(item.email) === normalized.email);
    if (index < 0) return {recipients: [...recipients, normalized], added: true};

    const existing = recipients[index];
    const merged = {
        ...existing,
        email: normalized.email,
        displayName: existing.displayName || normalized.displayName,
        contactId: existing.contactId || normalized.contactId,
        sendEmail: existing.sendEmail === true || normalized.sendEmail,
        sendPush: existing.sendPush === true || normalized.sendPush,
        canManage: existing.canManage === true || normalized.canManage,
        ...(existing.companyContext || normalized.companyContext
            ? {companyContext: existing.companyContext || normalized.companyContext}
            : {})
    };
    const next = [...recipients];
    next[index] = merged;
    return {recipients: next, added: true};
}
