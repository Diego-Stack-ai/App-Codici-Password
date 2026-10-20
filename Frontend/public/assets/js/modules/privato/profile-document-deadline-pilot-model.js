export const PROFILE_DOCUMENT_DEADLINE_EXPERIMENT = 'prova-scadenze';
export const PROFILE_DOCUMENT_EXPIRY_FIELD = 'document.expiry_date';

function isoDate(value) {
    const text = String(value || '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
    const parsed = new Date(`${text}T00:00:00Z`);
    return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text ? '' : text;
}

function foldedText(value) {
    return String(value || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('it').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function normalizedProfileDocumentType(value) {
    const original = String(value || '').trim();
    const folded = foldedText(original);
    if (['patente', 'patente di guida', 'driving licence', 'driving license', 'licencia de conducir',
        'permis de conduire', 'fuhrerschein', 'carteira de motorista', '驾驶证', 'ड्राइविंग लाइसेंस'].includes(folded)) return 'Patente';
    if (['carta identita', 'carta d identita', 'carta di identita', 'identity card', 'tarjeta de identidad',
        'carte d identite', 'personalausweis', 'carteira de identidade', '身份证', 'पहचान पत्र'].includes(folded)) return "Carta d'identità";
    if (['codice fiscale', 'tax code', 'fiscal code', 'codigo fiscal', 'code fiscal',
        'steueridentifikationsnummer', '税号', 'कर कोड'].includes(folded)) return 'Codice fiscale';
    if (['passaporto', 'passport', 'pasaporte', 'passeport', 'reisepass', 'passaporte', '护照', 'पासपोर्ट'].includes(folded)) return 'Passaporto';
    if (['altro', 'other', 'otro', 'autre', 'andere', 'outro', 'documento', 'document'].includes(folded) || !folded) return 'Documento';
    return original;
}

export function profileDocumentPilotTitle(documentItem = {}) {
    return `Prova scadenze · ${normalizedProfileDocumentType(documentItem.type)}`;
}

export function profileDocumentNumber(documentItem = {}) {
    if (normalizedProfileDocumentType(documentItem.type) === 'Codice fiscale') {
        return String(documentItem.id_number || documentItem.num_serie || documentItem.cf_value || '').trim();
    }
    return String(documentItem.num_serie || documentItem.id_number || documentItem.cf_value || '').trim();
}

export function hasTraditionalProfileDocumentDeadlineReference(documentItem = {}) {
    return Boolean(documentItem.expiryReference?.deadlineId
        && documentItem.expiryReference.experimentTag !== PROFILE_DOCUMENT_DEADLINE_EXPERIMENT);
}

function deadlineIsoDate(deadline = {}) {
    const value = deadline.dueDate || deadline.date || '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    return '';
}

export function compatibleTraditionalDeadlines(documentItem = {}, deadlines = []) {
    const type = foldedText(normalizedProfileDocumentType(documentItem.type));
    const date = isoDate(documentItem.expiry_date);
    if (!type || !date) return [];
    return deadlines.filter(deadline => !isProfileDocumentPilotDeadline(deadline)
        && foldedText(normalizedProfileDocumentType(deadline.type || deadline.category || deadline.title)) === type
        && deadlineIsoDate(deadline) === date);
}

export function profileDocumentDeadlineCandidate(documentItem = {}) {
    const dueDate = isoDate(documentItem.expiry_date);
    if (!dueDate || !String(documentItem.id || '').trim()) return null;
    return Object.freeze({
        sourceType: 'profileDocument',
        sourceDocumentId: String(documentItem.id),
        sourceFieldId: PROFILE_DOCUMENT_EXPIRY_FIELD,
        sourceValueAtLink: dueDate,
        dueDate
    });
}

export function isProfileDocumentPilotDeadline(deadline = {}) {
    return deadline.experimentTag === PROFILE_DOCUMENT_DEADLINE_EXPERIMENT
        && deadline.sourceType === 'profileDocument'
        && typeof deadline.sourceDocumentId === 'string'
        && typeof deadline.sourceFieldId === 'string';
}

export function matchingProfileDocumentPilotDeadlines(documentItem = {}, deadlines = []) {
    const documentId = String(documentItem.id || '');
    return deadlines.filter(deadline => isProfileDocumentPilotDeadline(deadline)
        && deadline.sourceDocumentId === documentId
        && deadline.sourceFieldId === PROFILE_DOCUMENT_EXPIRY_FIELD);
}

export function profileDocumentPilotDeadlineId(documentId, fieldId = PROFILE_DOCUMENT_EXPIRY_FIELD) {
    const source = `${String(documentId)}|${String(fieldId)}`;
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
        hash ^= source.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    const safeDocumentId = String(documentId).replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 96);
    return `pilot-profile-document-${safeDocumentId}-${(hash >>> 0).toString(36)}`;
}

export function planProfileDocumentDeadlineReconciliation(documentItem = {}, deadlines = []) {
    const candidate = profileDocumentDeadlineCandidate(documentItem);
    const matches = matchingProfileDocumentPilotDeadlines(documentItem, deadlines);
    if (matches.length > 1) return Object.freeze({action: 'duplicate', candidate, matches});
    const deadline = matches[0] || null;
    if (!candidate) return Object.freeze({action: deadline ? 'source-missing' : 'none', candidate: null, deadline});
    if (!deadline) {
        const compatible = compatibleTraditionalDeadlines(documentItem, deadlines);
        const traditionalReference = hasTraditionalProfileDocumentDeadlineReference(documentItem);
        if (traditionalReference || documentItem.compatibleDeadlineId || compatible.length) {
            return Object.freeze({action: 'offer-create-with-existing', candidate, deadline: null, compatible});
        }
        return Object.freeze({action: 'offer-create', candidate, deadline: null});
    }
    if (deadline.sourceValueAtLink !== candidate.sourceValueAtLink || String(deadline.dueDate || '').slice(0, 10) !== candidate.dueDate) {
        return Object.freeze({action: 'offer-update', candidate, deadline});
    }
    return Object.freeze({action: 'current', candidate, deadline});
}

export function buildProfileDocumentPilotDeadline(documentItem = {}, profile = {}, now = new Date(), {attachments = []} = {}) {
    const candidate = profileDocumentDeadlineCandidate(documentItem);
    if (!candidate) throw new Error('PROFILE_DOCUMENT_EXPIRY_MISSING');
    const owner = [profile.nome, profile.cognome].filter(Boolean).join(' ').trim();
    const documentType = normalizedProfileDocumentType(documentItem.type);
    const documentNumber = profileDocumentNumber(documentItem);
    const linkedAttachments = (Array.isArray(attachments) ? attachments : [])
        .filter(item => item?.linkedSource?.type === 'profileDocumentAttachment'
            && typeof item.storagePath === 'string'
            && item.storagePath.includes(`/profile-documents/${candidate.sourceDocumentId}/attachments/`))
        .map(item => Object.freeze({...item, linkedSource: Object.freeze({...item.linkedSource})}));
    return Object.freeze({
        ...candidate,
        experimentTag: PROFILE_DOCUMENT_DEADLINE_EXPERIMENT,
        sourceRef: {type: 'profileDocument', id: candidate.sourceDocumentId, fieldId: candidate.sourceFieldId},
        sourceStatus: 'active',
        sourceIssue: '',
        pilotDeliveryDisabled: true,
        notificationsEnabled: false,
        recipients: [],
        email1: '',
        email2: '',
        attachments: linkedAttachments,
        sourceAttachmentCountAtLink: linkedAttachments.length,
        name: owner || 'Utente',
        title: profileDocumentPilotTitle(documentItem),
        documentType,
        documentNumber,
        type: documentType,
        category: documentType,
        templateText: documentNumber ? `${documentType} · ${documentNumber}` : documentType,
        mode: 'documenti',
        completed: false,
        notif_days_before: 14,
        notif_frequency: 7,
        createdAtIso: now.toISOString()
    });
}
