export const ACCOUNT_MODES = Object.freeze({
    PRIVATE: 'account-private',
    SHARED: 'account-shared',
    MEMO_PRIVATE: 'memo-private',
    MEMO_SHARED: 'memo-shared'
});

export const ACCOUNT_MODE_VIEWS = Object.freeze({
    STANDARD: 'standard',
    SHARED: 'shared',
    MEMO: 'memo',
    SHARED_MEMO: 'shared_memo'
});

const ACCOUNT_VIEW_VALUES = new Set(Object.values(ACCOUNT_MODE_VIEWS));

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

export function normalizeAccountModeView(value = '') {
    const normalized = String(value || '').trim().toLowerCase();
    return ACCOUNT_VIEW_VALUES.has(normalized) ? normalized : '';
}

export function accountModeViewFromRecord(account = {}) {
    const mode = accountModeFromRecord(account);
    if (mode === ACCOUNT_MODES.SHARED) return ACCOUNT_MODE_VIEWS.SHARED;
    if (mode === ACCOUNT_MODES.MEMO_PRIVATE) return ACCOUNT_MODE_VIEWS.MEMO;
    if (mode === ACCOUNT_MODES.MEMO_SHARED) return ACCOUNT_MODE_VIEWS.SHARED_MEMO;
    return ACCOUNT_MODE_VIEWS.STANDARD;
}

export function summarizeAccountModes(accounts = []) {
    const summary = {
        [ACCOUNT_MODE_VIEWS.STANDARD]: 0,
        [ACCOUNT_MODE_VIEWS.SHARED]: 0,
        [ACCOUNT_MODE_VIEWS.MEMO]: 0,
        [ACCOUNT_MODE_VIEWS.SHARED_MEMO]: 0
    };
    for (const account of accounts) {
        if (account?.isArchived) continue;
        summary[accountModeViewFromRecord(account)] += 1;
    }
    return summary;
}

export function accountMatchesModeView(account = {}, view = '') {
    const normalized = normalizeAccountModeView(view);
    return !normalized || accountModeViewFromRecord(account) === normalized;
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
    return { valid: true, reason: null };
}

export function sharedModeTransitionRevokesRecipients(previousMode, nextMode) {
    return previousMode?.endsWith('-shared') === true && previousMode !== nextMode;
}

export const normalizeRecipientEmail = email => String(email || '').trim().toLowerCase();

export function normalizeRecipientPreference(value = {}) {
    return {notifyPush: value?.notifyPush !== false, notifyEmail: value?.notifyEmail === true};
}

export function recipientPreferencesFromSharedWith(sharedWith = {}) {
    const guests = Array.isArray(sharedWith) ? sharedWith : Object.values(sharedWith || {});
    return new Map(guests
        .filter(guest => guest?.status !== 'suspended' && guest?.status !== 'rejected')
        .map(guest => [normalizeRecipientEmail(guest?.email), normalizeRecipientPreference(guest)])
        .filter(([email]) => email));
}

export function preferenceForRecipient(preferences, email) {
    const normalized = normalizeRecipientEmail(email);
    const value = preferences instanceof Map ? preferences.get(normalized) : preferences?.[normalized];
    return normalizeRecipientPreference(value);
}

export function serializeRecipientPreferences(preferences, emails = []) {
    return Object.fromEntries(emails.map(email => {
        const normalized = normalizeRecipientEmail(email);
        return [normalized, preferenceForRecipient(preferences, normalized)];
    }).filter(([email]) => email));
}

export function filterRecipientContacts(contacts = [], {ownerUid = '', ownerEmail = ''} = {}) {
    const normalizedOwnerEmail = normalizeRecipientEmail(ownerEmail);
    return contacts.filter(contact => contact?.active !== false)
        .filter(contact => contact?.uid !== ownerUid && contact?.id !== ownerUid)
        .filter(contact => normalizeRecipientEmail(contact?.email) !== normalizedOwnerEmail);
}

export function isOwnerRecipientEmail(email, ownerEmail = '') {
    const normalized = normalizeRecipientEmail(email);
    return Boolean(normalized && normalized === normalizeRecipientEmail(ownerEmail));
}
