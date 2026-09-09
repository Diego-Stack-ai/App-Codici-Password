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
