export const WIDGET_PROFILE_CATEGORIES = Object.freeze({ACCOUNT: 'account', BANK: 'bank'});

export function structuralTitleCase(value) {
    return String(value ?? '').trim().replace(/\s+/gu, ' ').toLocaleLowerCase('it-IT')
        .replace(/\p{L}[\p{L}\p{M}]*/gu,
            word => word.charAt(0).toLocaleUpperCase('it-IT') + word.slice(1));
}

export function profilesForCategory(profiles = [], category) {
    return profiles.filter(profile => profile?.kind === 'widget-profile' && profile.category === category &&
        Array.isArray(profile.fields) && profile.fields.length > 0);
}

export function profileFieldSummary(profile) {
    return (profile?.fields || []).map(field => structuralTitleCase(field?.label)).filter(Boolean).join(', ');
}

export function isProfileAlreadyInserted(widgets = [], profileId, bankId = null) {
    return widgets.some(widget => widget?.profileId === profileId && (widget.bankId || null) === (bankId || null));
}
