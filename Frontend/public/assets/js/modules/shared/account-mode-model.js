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
    if (mode.startsWith('account-') && !hasCredentials) return { valid: false, reason: 'account-without-credentials' };
    return { valid: true, reason: null };
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
