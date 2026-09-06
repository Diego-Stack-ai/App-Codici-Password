export function normalizeRecipientEmail(value) {
    return String(value || '').trim().toLowerCase();
}

export function isValidRecipientEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeRecipientEmail(value));
}

export function normalizeDeadlineRecipient(recipient = {}) {
    const email = normalizeRecipientEmail(recipient.email || recipient.address);
    if (!isValidRecipientEmail(email)) return null;
    return {
        email,
        displayName: String(recipient.displayName || recipient.name || '').trim(),
        contactId: String(recipient.contactId || '').trim(),
        sendEmail: recipient.sendEmail === true,
        sendPush: recipient.sendPush === true
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
