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

function orderedTemplateFields(fields = []) {
    return [...fields].sort((left, right) => Number(left?.order || 0) - Number(right?.order || 0));
}

export function widgetTemplateSignature(widget = {}) {
    const fields = orderedTemplateFields(Array.isArray(widget?.fields) ? widget.fields : []).map(field => ({
        label: structuralTitleCase(field?.label),
        type: String(field?.type || 'text'),
        encrypted: field?.encrypted === true,
        deadlineEnabled: field?.deadlineEnabled === true
    }));
    return JSON.stringify({
        title: structuralTitleCase(widget?.title),
        description: String(widget?.description || '').trim(),
        icon: String(widget?.icon || 'widgets'),
        color: String(widget?.color || '#3b82f6').toLocaleLowerCase('it-IT'),
        fields
    });
}

export function legacyAccountWidgetTemplates(widgets = [], profiles = []) {
    const knownSignatures = new Set(profilesForCategory(profiles, 'account').map(widgetTemplateSignature));
    const templates = [];
    for (const widget of widgets) {
        if (widget?.kind !== 'embedded' || widget.profileId || widget.bankId ||
            !Array.isArray(widget.fields) || widget.fields.length === 0) continue;
        const templateSignature = widgetTemplateSignature(widget);
        if (knownSignatures.has(templateSignature)) continue;
        knownSignatures.add(templateSignature);
        templates.push({
            id: `legacy:${widget.id}`,
            kind: 'legacy-widget-template',
            category: 'account',
            title: structuralTitleCase(widget.title),
            description: String(widget.description || '').trim(),
            icon: widget.icon || 'widgets',
            color: widget.color || '#3b82f6',
            templateSignature,
            fields: orderedTemplateFields(widget.fields).map((field, order) => ({
                label: structuralTitleCase(field.label),
                type: field.type || 'text',
                encrypted: field.encrypted === true,
                deadlineEnabled: field.deadlineEnabled === true,
                order
            }))
        });
    }
    return templates;
}

export function profileFieldSummary(profile) {
    return (profile?.fields || []).map(field => structuralTitleCase(field?.label)).filter(Boolean).join(', ');
}

export function isProfileAlreadyInserted(widgets = [], profileId, bankId = null) {
    return widgets.some(widget => widget?.profileId === profileId && (widget.bankId || null) === (bankId || null));
}

export function isWidgetTemplateAlreadyInserted(widgets = [], template = {}, bankId = null) {
    if (template?.kind === 'widget-profile') return isProfileAlreadyInserted(widgets, template.id, bankId);
    if (template?.kind !== 'legacy-widget-template' || !template.templateSignature) return false;
    return widgets.some(widget => (widget?.bankId || null) === (bankId || null) &&
        widgetTemplateSignature(widget) === template.templateSignature);
}
