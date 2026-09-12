export function classifyPrivateAccountOfflineWrite({
    type,
    visibility,
    isBanking = false,
    hasProfileLink = false
} = {}) {
    if (visibility === 'shared') {
        return {eligible: false, reason: type === 'memo' ? 'shared-memo' : 'shared-account'};
    }
    if (isBanking) return {eligible: false, reason: 'banking'};
    if (hasProfileLink) return {eligible: false, reason: 'profile-link'};
    if (visibility === 'private' && (type === 'account' || type === 'memo')) {
        return {eligible: true, reason: null};
    }
    return {eligible: false, reason: 'unsupported'};
}

export function canRecoverPrivateAccount(record, uid) {
    return Boolean(record && (record.ownerId === undefined || record.ownerId === uid) &&
        classifyPrivateAccountOfflineWrite({type:record.type,visibility:record.visibility,isBanking:record.isBanking,
            hasProfileLink:Boolean(record.linkedProfileField || record.linkedCompanyProfileField)}).eligible &&
        !record.isArchived && !record.archivedAt && !record.deletedAt &&
        !record.shared && !record.isMemoShared && !record._isGuest && !record.recipientEmail && !record.acceptedCount &&
        !record.iban && !record.passwordDispositiva && !(record.cards || []).length &&
        !Object.keys(record.linkedProfileFields || {}).length && !Object.keys(record.linkedCompanyProfileFields || {}).length &&
        !(record.sharedWithEmails || []).length &&
        (!record.banking || (Array.isArray(record.banking) && record.banking.length === 0)) &&
        !Object.keys(record.sharedWith || {}).length && !(record.sharedWithUids || []).length &&
        !Object.keys(record.pendingInvites || {}).length);
}
