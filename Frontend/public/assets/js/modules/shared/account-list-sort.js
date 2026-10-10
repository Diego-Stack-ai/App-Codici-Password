export const ACCOUNT_SORT_MODES = Object.freeze([
    {id: 'name-asc', label: 'A-Z', title: 'Ordina per nome, dalla A alla Z'},
    {id: 'name-desc', label: 'Z-A', title: 'Ordina per nome, dalla Z alla A'},
    {id: 'date-desc', label: 'Recenti', title: 'Ordina per data di modifica, dai più recenti'},
    {id: 'date-asc', label: 'Meno recenti', title: 'Ordina per data di modifica, dai meno recenti'}
]);

export function nextAccountSortMode(current) {
    const index = ACCOUNT_SORT_MODES.findIndex(mode => mode.id === current);
    return ACCOUNT_SORT_MODES[(index + 1 + ACCOUNT_SORT_MODES.length) % ACCOUNT_SORT_MODES.length];
}

export function accountSortMode(id) {
    return ACCOUNT_SORT_MODES.find(mode => mode.id === id) || ACCOUNT_SORT_MODES[0];
}

function timestampMillis(value) {
    if (!value) return 0;
    if (typeof value.toMillis === 'function') return value.toMillis();
    if (typeof value.toDate === 'function') return value.toDate().getTime();
    if (Number.isFinite(value.seconds)) {
        return value.seconds * 1000 + Math.floor(Number(value.nanoseconds || 0) / 1e6);
    }
    const millis = value instanceof Date ? value.getTime() : Date.parse(value);
    return Number.isFinite(millis) ? millis : 0;
}

export function compareAccounts(left, right, modeId = 'name-asc') {
    if (left.isPinned && !right.isPinned) return -1;
    if (!left.isPinned && right.isPinned) return 1;

    const mode = accountSortMode(modeId).id;
    const leftName = String(left.nomeAccount || '').trim();
    const rightName = String(right.nomeAccount || '').trim();
    if (mode.startsWith('date-')) {
        const leftDate = timestampMillis(left.updatedAt || left.createdAt);
        const rightDate = timestampMillis(right.updatedAt || right.createdAt);
        const dateResult = mode === 'date-desc' ? rightDate - leftDate : leftDate - rightDate;
        if (dateResult) return dateResult;
    }
    const nameResult = leftName.localeCompare(rightName, 'it', {sensitivity: 'base'});
    if (nameResult) return mode === 'name-desc' ? -nameResult : nameResult;
    return String(left.id || '').localeCompare(String(right.id || ''), 'it');
}
