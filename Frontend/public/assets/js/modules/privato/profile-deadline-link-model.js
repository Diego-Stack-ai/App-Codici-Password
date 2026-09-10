function normalizedText(value) {
    return String(value || '').trim().toLocaleLowerCase('it');
}

function deadlineIsoDate(deadline = {}) {
    const value = deadline.dueDate || deadline.date || '';
    if (typeof value === 'string') return value.slice(0, 10);
    if (typeof value?.toDate === 'function') return value.toDate().toISOString().slice(0, 10);
    return '';
}

export function findCompatibleDocumentDeadlines(documentItem = {}, deadlines = []) {
    return deadlines.filter(deadline =>
        normalizedText(deadline.type || deadline.category) === normalizedText(documentItem.type) &&
        deadlineIsoDate(deadline) === String(documentItem.expiry_date || '').slice(0, 10)
    );
}

export function buildProfileDocumentDeadlineDraft(documentItem = {}, profile = {}) {
    const documentType = String(documentItem.type || 'Documento').trim();
    return {
        profileDocumentId: documentItem.id,
        documentType,
        name: [profile.nome, profile.cognome].filter(Boolean).join(' ').trim(),
        detail: [documentType, documentItem.num_serie || documentItem.id_number || documentItem.cf_value]
            .filter(Boolean).join(' - '),
        dueDate: documentItem.expiry_date
    };
}

export function resolveProfileDocumentDeadlineState(documents = [], deadlines = []) {
    return documents.map(documentItem => {
        if (documentItem?.expiryReference?.deadlineId) return documentItem;
        const explicit = deadlines.find(deadline =>
            deadline?.sourceRef?.type === 'profileDocument' && deadline.sourceRef.id === documentItem?.id
        );
        if (explicit) return {...documentItem, expiryReference: {deadlineId: explicit.id}};
        const compatible = findCompatibleDocumentDeadlines(documentItem, deadlines);
        return compatible.length === 1
            ? {...documentItem, compatibleDeadlineId: compatible[0].id}
            : documentItem;
    });
}
