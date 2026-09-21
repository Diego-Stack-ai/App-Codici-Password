export function createArchiveMetadata(record, now = Date.now()) {
    return {
        isArchived: true,
        archiveSchemaVersion: 2,
        archivedAt: new Date(now).toISOString(),
        revision: Number.isInteger(record?.revision) ? record.revision + 1 : 1
    };
}

// M7-R7B4 — destinatari da mostrare nel popup prima di archiviare un Account
// condiviso. Si leggono SOLO email e stato: mai password, note, codici o
// allegati. Le forme legacy (`sharedWithEmails`, `recipientEmail`) convivono con
// `sharedWith` e vanno unite e deduplicate. Il modulo resta puro: il traduttore
// arriva dal chiamante.
const RECIPIENT_STATUSES = ['pending', 'accepted'];
const EMAIL_SHAPE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const emailOf = value => String(value == null ? '' : (typeof value === 'object' ? value.email : value))
    .trim().toLowerCase();

export function archiveRecipients(account) {
    const recipients = [];
    const seen = new Set();
    const add = (value, status) => {
        const email = emailOf(value);
        if (!EMAIL_SHAPE.test(email) || seen.has(email)) return;
        // Uno stato esplicito diverso da pendente/accettato (es. `rejected`) non
        // ha accesso e non entra nell'avviso; l'assenza di stato è una forma
        // legacy e viene inclusa.
        if (status !== undefined && !RECIPIENT_STATUSES.includes(status)) return;
        seen.add(email);
        recipients.push(Object.freeze({email, status: status === undefined ? 'legacy' : status}));
    };
    const shared = account && account.sharedWith;
    if (shared && typeof shared === 'object' && !Array.isArray(shared)) {
        for (const guest of Object.values(shared)) {
            if (!guest || typeof guest !== 'object') continue;
            add(guest.email, typeof guest.status === 'string' ? guest.status : undefined);
        }
    }
    if (Array.isArray(account && account.sharedWithEmails)) {
        for (const legacy of account.sharedWithEmails) add(legacy, undefined);
    }
    add(account && account.recipientEmail, undefined);
    return recipients;
}

export function archiveConfirmMessage(account, translate) {
    const base = translate('confirm_archive_msg');
    const recipients = archiveRecipients(account);
    if (!recipients.length) return base;
    const list = recipients.map(recipient => recipient.email).join(', ');
    return `${base} ${translate('confirm_archive_recipients_label')} ${list}. `
        + `${translate('confirm_archive_suspend_msg')} ${translate('confirm_archive_recipients_caveat')}`;
}
