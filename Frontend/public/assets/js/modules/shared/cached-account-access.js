/**
 * Firestore's persistent cache is shared by authentication sessions on this
 * origin. A cached document is data, never proof of the current reader's grant.
 * Mirror isBoundGuest/isGuestReadableAccount before displaying offline data.
 * Revocations not yet synchronized still require a server refresh.
 */
export function canReadCachedAccount(record, user, ownerUid) {
    if (!record || typeof record !== 'object' || !user?.uid || !ownerUid) return false;
    if (user.uid === ownerUid) return true;
    if (user.emailVerified !== true || typeof user.email !== 'string' || user.email.length <= 3) return false;
    if (record.isArchived !== undefined && record.isArchived !== false) return false;
    const recipients = record.sharedWithUids;
    const bindings = record.sharedWithEmailByUid;
    if (!Array.isArray(recipients) || !recipients.includes(user.uid) ||
        !bindings || typeof bindings !== 'object' || Array.isArray(bindings) ||
        !Object.hasOwn(bindings, user.uid)) return false;
    const email = bindings[user.uid];
    return typeof email === 'string' && email.toLowerCase() === user.email.toLowerCase();
}
