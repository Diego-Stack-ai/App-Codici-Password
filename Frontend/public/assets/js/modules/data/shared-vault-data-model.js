const FIELD_TYPES = new Set([
    'text', 'textarea', 'number', 'date', 'phone', 'email', 'address', 'url',
    'select', 'boolean', 'identifier', 'sensitive', 'expiry', 'account-link', 'address-link'
]);

function requiredText(value, label, maximum) {
    const normalized = String(value || '').trim();
    if (!normalized || normalized.length > maximum) throw new Error(`${label} non valido.`);
    return normalized;
}

function optionalText(value, maximum) {
    const normalized = String(value || '').trim();
    if (normalized.length > maximum) throw new Error('Testo troppo lungo.');
    return normalized;
}

export async function prepareSharedVaultData(input = {}, encryptValue) {
    if (typeof encryptValue !== 'function') throw new Error('Cifratura Vault non disponibile.');
    if (!Array.isArray(input.fields) || input.fields.length < 1 || input.fields.length > 30) {
        throw new Error('Inserisci da uno a trenta campi.');
    }
    const ids = new Set();
    const fields = [];
    for (const [index, source] of input.fields.entries()) {
        const id = requiredText(source.id, 'Identificativo campo', 160);
        if (ids.has(id)) throw new Error('Ogni campo deve avere un identificativo diverso.');
        ids.add(id);
        const type = String(source.type || 'text').trim().toLowerCase();
        if (!FIELD_TYPES.has(type)) throw new Error('Tipo di campo non valido.');
        const encrypted = source.encrypted === true || type === 'sensitive';
        const field = {
            id,
            label: requiredText(source.label, 'Etichetta campo', 120),
            type,
            order: Number.isInteger(source.order) && source.order >= 0 ? source.order : index,
            encrypted,
            sensitivity: encrypted ? 'secret' : 'normal',
            preview: encrypted ? false : source.preview !== false,
            copyable: encrypted ? false : source.copyable !== false,
            includeInQr: encrypted ? false : source.includeInQr === true,
            qrLabel: optionalText(source.qrLabel, 120),
            qrOrder: Number.isInteger(source.qrOrder) && source.qrOrder >= 0 ? source.qrOrder : index
        };
        if (encrypted) field.valueEnc = await encryptValue(String(source.value ?? ''));
        else field.value = source.value ?? '';
        fields.push(field);
    }
    return {
        title: requiredText(input.title, 'Titolo', 120),
        description: optionalText(input.description, 500),
        icon: optionalText(input.icon || 'key', 80) || 'key',
        color: /^#[0-9a-f]{6}$/i.test(input.color || '') ? input.color : '#3b82f6',
        fields,
        schemaVersion: 1
    };
}

export async function prepareEmbeddedAccountWidget(input = {}, account = {}, encryptValue) {
    const context = account.context === 'private' ? 'private' : account.context === 'company' ? 'company' : null;
    if (!context) throw new Error('Contesto Account non valido.');
    const accountId = requiredText(account.accountId, 'Identificativo Account', 160);
    const common = await prepareSharedVaultData(input, encryptValue);
    const widget = {
        ...common,
        kind: 'embedded',
        context,
        accountId,
        order: Number.isInteger(input.order) && input.order >= 0 ? input.order : 0,
        collapsed: input.collapsed === true,
        revision: Number.isInteger(input.revision) && input.revision >= 1 ? input.revision : 1
    };
    if (context === 'company') {
        widget.companyId = requiredText(account.companyId, 'Identificativo Azienda', 160);
    }
    return widget;
}

export function createEmbeddedWidgetIdentifiers(widgetId = crypto.randomUUID()) {
    return {widgetId, operationId: crypto.randomUUID()};
}

export function createSharedVaultIdentifiers(sharedDataId = crypto.randomUUID()) {
    return {
        sharedDataId,
        operationId: crypto.randomUUID()
    };
}

export function createSharedVaultLinkIdentifiers(sharedDataId, context, accountId, companyId = '') {
    const scope = context === 'company' ? `company:${companyId}` : 'private';
    const stable = `${scope}:${accountId}:${sharedDataId}`;
    return {
        linkId: `link:${stable}`,
        widgetId: `shared:${stable}`,
        operationId: crypto.randomUUID()
    };
}
