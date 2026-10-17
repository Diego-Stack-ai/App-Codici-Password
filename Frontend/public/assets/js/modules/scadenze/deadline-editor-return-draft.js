export const DEADLINE_EDITOR_RETURN_DRAFT_KEY = 'deadline-editor-return-draft';

const MAX_RETURN_DRAFT_AGE_MS = 30 * 60 * 1000;

function text(value) {
    return String(value ?? '').trim();
}

export function deadlineEditorReturnTarget(locationLike = {}) {
    const page = text(locationLike.pathname).split('/').pop();
    if (page !== 'aggiungi_scadenza.html') return '';
    const search = text(locationLike.search);
    return `${page}${search.startsWith('?') ? search : ''}`;
}

export function createDeadlineEditorReturnDraft({
    ownerUid,
    returnTarget,
    mode,
    fields = {},
    recipients = [],
    savedAt = Date.now()
} = {}) {
    if (!text(ownerUid) || !/^aggiungi_scadenza\.html(?:\?[^#]*)?$/.test(text(returnTarget))) return null;
    return {
        version: 1,
        ownerUid: text(ownerUid),
        returnTarget: text(returnTarget),
        savedAt: Number(savedAt),
        mode: ['automezzi', 'documenti', 'generali'].includes(mode) ? mode : 'automezzi',
        fields: Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, text(value)])),
        recipients: Array.isArray(recipients) ? recipients.map(recipient => ({ ...recipient })) : []
    };
}

export function consumeDeadlineEditorReturnDraft(storage, {ownerUid, returnTarget, now = Date.now()} = {}) {
    let draft = null;
    try {
        draft = JSON.parse(storage?.getItem?.(DEADLINE_EDITOR_RETURN_DRAFT_KEY) || 'null');
    } catch {
        draft = null;
    }
    storage?.removeItem?.(DEADLINE_EDITOR_RETURN_DRAFT_KEY);
    const age = Number(now) - Number(draft?.savedAt);
    if (draft?.version !== 1
        || draft.ownerUid !== text(ownerUid)
        || draft.returnTarget !== text(returnTarget)
        || !Number.isFinite(age)
        || age < 0
        || age > MAX_RETURN_DRAFT_AGE_MS) return null;
    return draft;
}
