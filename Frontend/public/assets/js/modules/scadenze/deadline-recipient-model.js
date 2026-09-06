export function normalizeRecipientEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function isValidRecipientEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeRecipientEmail(value));
}

export function normalizeDeadlineRecipient(recipient = {}, { defaultSendEmail = false } = {}) {
    const email = normalizeRecipientEmail(recipient.email || recipient.address);
    if (!isValidRecipientEmail(email)) return null;
    return {
        email,
        displayName: String(recipient.displayName || recipient.name || '').trim(),
        contactId: String(recipient.contactId || '').trim(),
        sendEmail: recipient.sendEmail === undefined ? defaultSendEmail : recipient.sendEmail === true,
        sendPush: recipient.sendPush === true
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
        sendPush: existing.sendPush === true || normalized.sendPush
    };
    const next = [...recipients];
    next[index] = merged;
    return {recipients: next, added: true};
}
