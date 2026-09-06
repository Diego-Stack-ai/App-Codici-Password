export const ACCOUNT_MODES = Object.freeze({
    PRIVATE: 'account-private',
    SHARED: 'account-shared',
    MEMO_PRIVATE: 'memo-private',
    MEMO_SHARED: 'memo-shared'
});

export function hasAccountCredentials(account = {}) {
    return [account.username, account.account ?? account.codice, account.password]
        .some(value => String(value || '').trim().length > 0);
}

export function accountModeFromRecord(account = {}) {
    const isMemo = account.type === 'memo' || account.type === 'memorandum' || account.isMemo === true || account.hasMemo === true || account.isMemoShared === true;
    const isShared = account.visibility === 'shared' || account._isGuest === true || account.shared === true || account.isMemoShared === true;
    if (isMemo) return isShared ? ACCOUNT_MODES.MEMO_SHARED : ACCOUNT_MODES.MEMO_PRIVATE;
    return isShared ? ACCOUNT_MODES.SHARED : ACCOUNT_MODES.PRIVATE;
}

export function accountModeFromFlags({ shared = false, memo = false, memoShared = false } = {}) {
    if (memoShared) return ACCOUNT_MODES.MEMO_SHARED;
    if (memo) return ACCOUNT_MODES.MEMO_PRIVATE;
    if (shared) return ACCOUNT_MODES.SHARED;
    return ACCOUNT_MODES.PRIVATE;
}

export function recordFieldsFromAccountMode(mode) {
    return {
        type: mode.startsWith('memo-') ? 'memo' : 'account',
        visibility: mode.endsWith('-shared') ? 'shared' : 'private'
    };
}

export function validateAccountMode(mode, account = {}) {
    const hasCredentials = hasAccountCredentials(account);
    if (mode.startsWith('memo-') && hasCredentials) return { valid: false, reason: 'memo-has-credentials' };
    if (mode === ACCOUNT_MODES.SHARED && !hasCredentials) return { valid: false, reason: 'shared-account-without-credentials' };
    return { valid: true, reason: null };
}
