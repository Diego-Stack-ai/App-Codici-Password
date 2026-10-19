const DOMAIN_KEYS = Object.freeze([
    'vehicles', 'home', 'health', 'sport', 'contracts', 'generic'
]);

export const DEADLINE_CONFIG_SOURCES = Object.freeze({
    deadlineConfig: Object.freeze({mode: 'automezzi', href: 'configurazione_automezzi.html'}),
    deadlineConfigDocuments: Object.freeze({mode: 'documenti', href: 'configurazione_documenti.html'}),
    generalConfig: Object.freeze({mode: 'generali', href: 'configurazione_generali.html'})
});

const PERSONAL_DOCUMENT_TYPES = Object.freeze([
    'patente', 'patente di guida', 'carta identita', 'carta di identita',
    'codice fiscale', 'passaporto'
]);

export function normalizeDeadlineDomainValue(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[’`´]/g, "'")
        .toLocaleLowerCase('it-IT')
        .replace(/'/g, ' ')
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim()
        .replace(/\s+/g, ' ');
}

function includesAny(value, candidates) {
    return candidates.some(candidate => value.includes(candidate));
}

export function isPersonalDocumentDeadlineType(value) {
    const normalized = normalizeDeadlineDomainValue(value);
    return PERSONAL_DOCUMENT_TYPES.some(type => normalized === type || normalized.startsWith(`${type} `));
}

export function classifyDeadlineDomain({name, sourceId, domain, detail} = {}) {
    if (DOMAIN_KEYS.includes(domain)) return domain;
    const normalized = normalizeDeadlineDomainValue([name, detail].filter(Boolean).join(' '));
    if (!normalized) return 'generic';
    if (isPersonalDocumentDeadlineType(name)) return 'personal';
    if (sourceId === 'deadlineConfig') return 'vehicles';
    if (includesAny(normalized, ['assicurazione', 'revisione auto', 'revisione moto', 'bollo',
        'tagliando', 'olio motore', 'motociclo', 'rimorchio'])) return 'vehicles';
    if (includesAny(normalized, ['imu', 'imposta municipale', 'tari', 'immobile', 'garage', 'capannone', 'casa',
        'condominio', 'affitto', 'caldaia', 'addolcitore', 'isola ecologica'])) return 'home';
    if (includesAny(normalized, ['visita medica', 'certificato medico', 'salute', 'vaccin'])) return 'health';
    if (includesAny(normalized, ['federazione italiana vela', 'tessera fiv', 'sport', 'associazion'])) return 'sport';
    if (normalized === 'comodato d uso'
        || includesAny(normalized, ['comodato auto', 'comodato d uso auto', 'auto targat'])) return 'vehicles';
    if (includesAny(normalized, ['contratto', 'comodato', 'disdetta', 'rinnovo'])) return 'contracts';
    return 'generic';
}

function itemName(item) {
    return typeof item === 'object' ? item?.name : item;
}

function listItemValue(item) {
    if (typeof item !== 'object' || item === null) return item;
    return item.name ?? item.label ?? item.title ?? item.text ?? item.templateText ?? item.value;
}

function deadlineType(deadline) {
    return deadline?.type || deadline?.category || deadline?.title || '';
}

function configEntries(configs = {}) {
    return Object.entries(DEADLINE_CONFIG_SOURCES).flatMap(([sourceId, source]) => {
        const config = configs[sourceId] || {};
        return (Array.isArray(config.deadlineTypes) ? config.deadlineTypes : []).map((item, index) => {
            const name = String(itemName(item) || '').trim();
            return {
                id: `${sourceId}:${index}`,
                name,
                normalizedName: normalizeDeadlineDomainValue(name),
                sourceId,
                sourceMode: source.mode,
                href: source.href,
                sourceIndex: index,
                period: typeof item === 'object' ? item?.period : undefined,
                frequency: typeof item === 'object' ? item?.freq : undefined,
                templateText: typeof item === 'object' && String(item?.templateText || '').trim()
                    ? String(item.templateText).trim() : '',
                domain: classifyDeadlineDomain({name, sourceId, domain: item?.domain})
            };
        }).filter(entry => entry.name);
    });
}

function configListEntries(configs = {}, field, kind) {
    return Object.entries(DEADLINE_CONFIG_SOURCES).flatMap(([sourceId, source]) => {
        const items = Array.isArray(configs[sourceId]?.[field]) ? configs[sourceId][field] : [];
        return items.map((item, index) => {
            const value = String(listItemValue(item) || '').trim();
            return {
                id: `${sourceId}:${kind}:${index}`,
                value,
                sourceId,
                sourceMode: source.mode,
                href: source.href,
                sourceIndex: index,
                domain: classifyDeadlineDomain({
                    name: value,
                    sourceId,
                    domain: typeof item === 'object' ? item?.domain : undefined
                })
            };
        }).filter(entry => entry.value && entry.domain !== 'personal');
    });
}

function actualDeadlineSchedule(deadline) {
    return {
        period: deadline?.notif_days_before ?? deadline?.period,
        frequency: deadline?.notif_frequency ?? deadline?.freq
    };
}

function scheduleValueDiffers(actual, configured) {
    if (actual === undefined || actual === null || actual === ''
        || configured === undefined || configured === null || configured === '') return false;
    return Number(actual) !== Number(configured);
}

function deadlineWithAudit(deadline, matching) {
    const configuration = matching[0];
    const actual = actualDeadlineSchedule(deadline);
    const scheduleMismatch = Boolean(configuration) && (
        scheduleValueDiffers(actual.period, configuration.period)
        || scheduleValueDiffers(actual.frequency, configuration.frequency)
    );
    return {
        ...deadline,
        domainAudit: {
            matchedConfigurationIds: matching.map(entry => entry.id),
            configuredPeriod: configuration?.period,
            configuredFrequency: configuration?.frequency,
            scheduleMismatch
        }
    };
}

function isProfileDocumentDeadline(deadline) {
    return deadline?.linkKind === 'profile-document-deadline-v1'
        || deadline?.sourceRef?.type === 'profileDocument'
        || Boolean(deadline?.sourceDocumentId);
}

export function buildDeadlineDomainInventory({configs = {}, deadlines = []} = {}) {
    const entries = configEntries(configs);
    const references = configListEntries(configs, 'models', 'reference');
    const templates = configListEntries(configs, 'emailTemplates', 'template');
    const entriesByName = new Map();
    for (const entry of entries) {
        const group = entriesByName.get(entry.normalizedName) || [];
        group.push(entry);
        entriesByName.set(entry.normalizedName, group);
    }

    const result = Object.fromEntries(DOMAIN_KEYS.map(domain => [domain, {
        domain,
        configurations: [],
        references: [],
        templates: [],
        deadlines: [],
        unmatchedDeadlines: [],
        duplicateConfigurations: []
    }]));

    for (const entry of entries) {
        if (entry.domain === 'personal') continue;
        result[entry.domain].configurations.push({...entry, linkedDeadlineIds: []});
    }
    for (const entry of references) result[entry.domain].references.push(entry);
    for (const entry of templates) result[entry.domain].templates.push(entry);

    const renderedConfigurations = new Map(Object.values(result).flatMap(group =>
        group.configurations.map(entry => [entry.id, entry])));

    for (const deadline of Array.isArray(deadlines) ? deadlines : []) {
        const type = deadlineType(deadline);
        if (isProfileDocumentDeadline(deadline) || isPersonalDocumentDeadlineType(type)) continue;
        const normalizedType = normalizeDeadlineDomainValue(type);
        const matching = entriesByName.get(normalizedType) || [];
        const domains = [...new Set(matching.map(entry => entry.domain).filter(domain => domain !== 'personal'))];
        const domain = domains.length === 1 ? domains[0] : classifyDeadlineDomain({
            name: type,
            sourceId: matching[0]?.sourceId,
            detail: deadline?.veicolo_modello
        });
        const safeDomain = DOMAIN_KEYS.includes(domain) ? domain : 'generic';
        const auditedDeadline = deadlineWithAudit(deadline, matching);
        result[safeDomain].deadlines.push(auditedDeadline);
        if (!matching.length) result[safeDomain].unmatchedDeadlines.push(auditedDeadline);
        for (const entry of matching) renderedConfigurations.get(entry.id)?.linkedDeadlineIds.push(deadline.id);
    }

    for (const sameNameEntries of entriesByName.values()) {
        const nonPersonal = sameNameEntries.filter(entry => entry.domain !== 'personal');
        if (nonPersonal.length < 2) continue;
        const domains = [...new Set(nonPersonal.map(entry => entry.domain))];
        for (const domain of domains) result[domain].duplicateConfigurations.push(nonPersonal);
    }

    for (const group of Object.values(result)) {
        group.configurations.sort((left, right) => left.name.localeCompare(right.name, 'it'));
        group.references.sort((left, right) => left.value.localeCompare(right.value, 'it'));
        group.templates.sort((left, right) => left.value.localeCompare(right.value, 'it'));
        group.deadlines.sort((left, right) => String(left.dueDate || left.date || '').localeCompare(String(right.dueDate || right.date || '')));
    }
    return result;
}
