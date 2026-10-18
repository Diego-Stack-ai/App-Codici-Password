function text(value) {
    return String(value || '').trim();
}

function datePartsToIso(day, month, year) {
    const candidate = new Date(year, month - 1, day);
    if (candidate.getFullYear() !== year || candidate.getMonth() !== month - 1 || candidate.getDate() !== day) return '';
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const DEADLINE_LOCALES = Object.freeze({
    it: 'it-IT', en: 'en-GB', es: 'es-ES', fr: 'fr-FR', de: 'de-DE',
    zh: 'zh-CN', hi: 'hi-IN', pt: 'pt-PT'
});

function fillTemplate(template, values) {
    return Object.entries(values).reduce((result, [key, value]) =>
        result.replaceAll(`{${key}}`, String(value || '').trim()), String(template || ''));
}

function foldedDocumentType(value) {
    return text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('it').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

const DOCUMENT_LABEL_SPECS = Object.freeze([
    {key: 'profile_document_name_driving_licence', aliases: ['patente', 'patente di guida', 'driving licence', 'driving license'], defaults: ['la tua patente']},
    {key: 'profile_document_name_identity_card', aliases: ['carta identita', 'carta d identita', 'carta di identita', 'identity card'], defaults: ['il tuo documento di identita']},
    {key: 'profile_document_name_tax_code', aliases: ['codice fiscale', 'tax code', 'fiscal code'], defaults: ['il tuo codice fiscale']},
    {key: 'profile_document_name_passport', aliases: ['passaporto', 'passport', 'pasaporte', 'passeport', 'reisepass', 'passaporte', '护照', 'पासपोर्ट'], defaults: ['il tuo passaporto']}
]);

function documentLabelSpec(documentType) {
    const folded = foldedDocumentType(documentType);
    return DOCUMENT_LABEL_SPECS.find(({aliases}) => aliases.includes(folded));
}

function localizedDocumentLabel(documentType, translate) {
    const spec = documentLabelSpec(documentType);
    return spec ? translate(spec.key) : text(documentType);
}

export function deadlineInputDate(isoValue, displayValue) {
    const iso = text(isoValue);
    const isoMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
    if (isoMatch) return datePartsToIso(Number(isoMatch[3]), Number(isoMatch[2]), Number(isoMatch[1]));

    const display = text(displayValue);
    const italianMatch = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(display);
    if (italianMatch) return datePartsToIso(Number(italianMatch[1]), Number(italianMatch[2]), Number(italianMatch[3]));

    const fallbackMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(display);
    return fallbackMatch ? datePartsToIso(Number(fallbackMatch[3]), Number(fallbackMatch[2]), Number(fallbackMatch[1])) : '';
}

export function deadlineDateForSave(profileDocumentLinkDraft, isoValue, displayValue) {
    // Anche una Scadenza collegata può cambiare data dall'editor. Il servizio
    // di persistenza sincronizza poi atomicamente il Documento sorgente.
    return deadlineInputDate(isoValue, displayValue);
}

export function deadlineDateDisplay(value, language = 'it') {
    const iso = deadlineInputDate(value, value);
    if (!iso) return text(value);
    const [year, month, day] = iso.split('-').map(Number);
    return new Intl.DateTimeFormat(DEADLINE_LOCALES[language] || DEADLINE_LOCALES.it, {
        day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC'
    }).format(new Date(Date.UTC(year, month - 1, day)));
}

export function profileDocumentDeadlineMessage({templateText, documentType, documentNumber, documentIssuer} = {}, translate) {
    const tr = typeof translate === 'function' ? translate : key => key;
    const configuredLabel = text(templateText);
    const typeLabel = text(documentType);
    const spec = documentLabelSpec(typeLabel);
    const configuredIsDefault = spec && [foldedDocumentType(typeLabel), ...spec.defaults].includes(foldedDocumentType(configuredLabel));
    const documentLabel = configuredLabel && !configuredIsDefault
        ? configuredLabel
        : localizedDocumentLabel(typeLabel, tr) || tr('document');
    const sections = [fillTemplate(tr('profile_document_message_expiry'), {document: documentLabel})];
    if (text(documentNumber)) {
        sections.push(fillTemplate(tr('profile_document_message_number'), {number: documentNumber}));
    }
    if (text(documentIssuer)) {
        sections.push(fillTemplate(tr('profile_document_message_issuer'), {issuer: documentIssuer}));
    }
    return sections.filter(Boolean).join(' ');
}

export function deadlineDate(record = {}) {
    const value = record.dueDate || record.date;
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        const [year, month, day] = value.split('-').map(Number);
        const result = new Date(year, month - 1, day);
        return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
    }
    if (typeof value.toDate === 'function') {
        const result = value.toDate();
        return Number.isNaN(result?.getTime?.()) ? null : result;
    }
    if (typeof value === 'string' && /^\d{2}\/\d{2}\/\d{4}$/.test(value)) {
        const [day, month, year] = value.split('/').map(Number);
        const result = new Date(year, month - 1, day);
        return result.getFullYear() === year && result.getMonth() === month - 1 && result.getDate() === day ? result : null;
    }
    const result = new Date(value);
    return Number.isNaN(result.getTime()) ? null : result;
}

// Calendar ordinals avoid 23/25-hour DST days and preserve local date-only input.
export function currentDiffDays(value, now = new Date()) {
    const due = deadlineDate({dueDate: value});
    const today = deadlineDate({dueDate: now});
    if (!due || !today) return null;
    const ordinal = date => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000;
    return ordinal(due) - ordinal(today);
}

export function deadlineBucket(record = {}, now = new Date()) {
    const days = currentDiffDays(record.dueDate || record.date, now);
    return days === null ? null : days < 0 ? 'urgent' : days <= 30 ? 'upcoming' : 'later';
}

// Project per-stage events without deleting history or touching the deadline.
export function projectDeadlineReminders(notifications, deadlines, now = new Date()) {
    const current = new Map();
    const stamp = item => item.updatedAt?.toMillis?.() || item.createdAt?.toMillis?.() || 0;
    const rank = item => Number.isSafeInteger(item.diffDays) && item.diffDays >= 0 ? item.diffDays : Infinity;
    const priority = item => item.status === 'resolved' ? 2 : item.status === 'viewed' ? 1 : 0;
    const better = (next, previous) => rank(next) < rank(previous)
        || (rank(next) === rank(previous) && (stamp(next) > stamp(previous)
            || (stamp(next) === stamp(previous) && (priority(next) > priority(previous)
                || (priority(next) === priority(previous) && next.id < previous.id)))));
    for (const notification of notifications) {
        if (!notification || typeof notification.id !== 'string' || !notification.id
            || typeof notification.deadlineId !== 'string' || !notification.deadlineId
            || !['unread', 'viewed', 'resolved'].includes(notification.status)) continue;
        const deadline = deadlines.get(notification.deadlineId);
        if (!deadline || deadline.completed) continue;
        const due = deadlineDateInputFields(deadline).isoValue;
        const notifiedDue = deadlineDateInputFields({dueDate: notification.dueDate}).isoValue;
        if (!due || due !== notifiedDue) continue;
        const days = currentDiffDays(due, now);
        if (days === null || days < 0) continue;
        const previous = current.get(notification.deadlineId);
        if (!previous || better(notification, previous.notification)) {
            current.set(notification.deadlineId, {notification, deadline, dueDate: due, diffDays: days});
        }
    }
    return [...current.values()].filter(item => item.notification.status !== 'resolved')
        .sort((a, b) => a.diffDays - b.diffDays || a.notification.deadlineId.localeCompare(b.notification.deadlineId));
}

export function deadlinePresentation(record = {}) {
    const owner = text(record.name) || 'Intestatario non specificato';
    const category = text(record.type || record.category || record.title) || 'Scadenza Generale';
    const vehicle = text(record.veicolo_modello);
    const legacyTitle = text(record.title);
    return {
        owner,
        category,
        vehicle,
        vehicleLabel: vehicle || 'Veicolo non specificato',
        title: legacyTitle || [category, text(record.name)].filter(Boolean).join(' - ') || 'Dettaglio Scadenza'
    };
}

export function deadlineDateInputFields(record = {}, language = 'it') {
    const raw = record.dueDate || record.date;
    if (typeof raw === 'string') {
        const iso = deadlineInputDate(raw, raw);
        if (iso) {
            return { isoValue: iso, displayValue: deadlineDateDisplay(iso, language) };
        }
    }
    const value = deadlineDate(record);
    if (!value) return { isoValue: '', displayValue: text(raw) };
    const day = String(value.getDate()).padStart(2, '0');
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const year = String(value.getFullYear());
    const isoValue = `${year}-${month}-${day}`;
    return { isoValue, displayValue: deadlineDateDisplay(isoValue, language) };
}
