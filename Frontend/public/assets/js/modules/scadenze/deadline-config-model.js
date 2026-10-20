export function validateDeadlineFrequency(value = 7) {
    const frequency = Number(value);
    if (!Number.isInteger(frequency) || frequency < 1 || frequency > 30) {
        throw new Error('La frequenza degli avvisi deve essere un numero intero da 1 a 30 giorni. Modifica la configurazione del tipo di scadenza.');
    }
    return frequency;
}

export function validateDeadlineNotice(value = 14) {
    if (value === null || (typeof value === 'string' && !value.trim())) {
        throw new Error('Il preavviso deve essere un numero intero da 0 a 3650 giorni.');
    }
    const notice = Number(value);
    if (!Number.isInteger(notice) || notice < 0 || notice > 3650) {
        throw new Error('Il preavviso deve essere un numero intero da 0 a 3650 giorni.');
    }
    return notice;
}

export function cloneDeadlineConfig(config = {}) {
    return structuredClone(config);
}

export function normalizeDeadlineType(item, defaultPeriod = 14, defaultFrequency = 7) {
    const source = typeof item === 'string' ? { name: item } : (item || {});
    const name = String(source.name || '').trim();
    if (!name) return null;
    const period = Number.parseInt(source.period, 10);
    const freq = Number.parseInt(source.freq, 10);
    return {
        ...source,
        name,
        period: Number.isFinite(period) && period > 0 ? period : defaultPeriod,
        freq: Number.isFinite(freq) && freq > 0 ? freq : defaultFrequency
    };
}

export function normalizeDeadlineConfig(config = {}, listKeys = []) {
    const normalized = cloneDeadlineConfig(config);
    for (const key of listKeys) {
        normalized[key] = Array.isArray(normalized[key]) ? normalized[key] : [];
    }
    normalized.deadlineTypes = (normalized.deadlineTypes || [])
        .map(item => normalizeDeadlineType(item))
        .filter(Boolean);
    return normalized;
}

function normalizedTemplateHint(value) {
    return String(value || '')
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLocaleLowerCase('it-IT')
        .replace(/[^a-z0-9]+/g, ' ')
        .trim();
}

const DOCUMENT_TEMPLATE_STEMS = Object.freeze([
    ['patente', 'patent'],
    ['passaporto', 'passaport'],
    ['identita', 'identit'],
    ['codice fiscale', 'fiscal']
]);

// Le vecchie impostazioni conservano tipi e testi in due liste separate. Non
// associarli per indice: le liste possono essere state riordinate in momenti
// diversi e un Passaporto finirebbe, per esempio, con il testo dell'IMU.
export function resolveDocumentDeadlineTemplate(config = {}, type = '') {
    const normalizedType = normalizedTemplateHint(type);
    const configuredType = (config.deadlineTypes || []).find(item =>
        normalizedTemplateHint(typeof item === 'object' ? item?.name : item) === normalizedType);
    if (typeof configuredType === 'object' && String(configuredType.templateText || '').trim()) {
        return String(configuredType.templateText).trim();
    }
    const stem = DOCUMENT_TEMPLATE_STEMS.find(([typeStem]) => normalizedType.includes(typeStem))?.[1];
    if (!stem) return '';
    return (config.emailTemplates || []).find(template => normalizedTemplateHint(template).includes(stem)) || '';
}

export function updateDeadlineType(config, index, values) {
    validateDeadlineFrequency(values?.freq);
    const item = normalizeDeadlineType(values);
    if (!item || !Array.isArray(config.deadlineTypes) || !config.deadlineTypes[index]) return config;
    const deadlineTypes = [...config.deadlineTypes];
    deadlineTypes[index] = item;
    return { ...config, deadlineTypes };
}

export function appendDeadlineType(config, values) {
    validateDeadlineFrequency(values?.freq);
    const item = normalizeDeadlineType(values);
    if (!item) return config;
    return { ...config, deadlineTypes: [...(config.deadlineTypes || []), item] };
}

export function updateDeadlineListItem(config, listKey, index, value) {
    const normalized = String(value || '').trim();
    const source = Array.isArray(config[listKey]) ? config[listKey] : [];
    if (!normalized || !source[index]) return config;
    const list = [...source];
    list[index] = normalized;
    return { ...config, [listKey]: list };
}

export function appendDeadlineListItem(config, listKey, value) {
    const normalized = String(value || '').trim();
    if (!normalized) return config;
    return { ...config, [listKey]: [...(Array.isArray(config[listKey]) ? config[listKey] : []), normalized] };
}

export function removeDeadlineListItem(config, listKey, index) {
    const source = Array.isArray(config[listKey]) ? config[listKey] : [];
    if (!source[index]) return config;
    return { ...config, [listKey]: source.filter((_, itemIndex) => itemIndex !== index) };
}

export function deadlineRuleRouteKey(item, index = 0) {
    const explicitId = String(item?.id || '').trim();
    return explicitId || `legacy-${Number(index)}`;
}

export function splitLegacyVehicleReference(value) {
    if (value && typeof value === 'object') {
        return {
            id: String(value.id || '').trim(),
            model: String(value.model || value.name || '').trim(),
            plate: String(value.plate || value.targa || '').trim(),
            message: value.message && typeof value.message === 'object' ? {...value.message} : null
        };
    }
    const text = String(value || '').trim();
    const separator = text.lastIndexOf(' - ');
    return {
        id: '',
        model: separator > 0 ? text.slice(0, separator).trim() : text,
        plate: separator > 0 ? text.slice(separator + 3).trim() : '',
        message: null
    };
}

export function vehicleReferenceLabel(value) {
    const vehicle = splitLegacyVehicleReference(value);
    return [vehicle.model, vehicle.plate].filter(Boolean).join(' - ');
}

function messagePart(value) {
    return String(value || '');
}

export function normalizeDeadlineMessage(message = {}, defaults = {}) {
    return {
        beforeObject: messagePart(message.beforeObject ?? defaults.beforeObject),
        betweenObjectModel: messagePart(message.betweenObjectModel ?? defaults.betweenObjectModel),
        betweenModelPlate: messagePart(message.betweenModelPlate ?? defaults.betweenModelPlate),
        afterPlate: messagePart(message.afterPlate ?? defaults.afterPlate)
    };
}

export function compileDeadlineMessage({message = {}, objectText = '', model = '', plate = ''} = {}) {
    const parts = normalizeDeadlineMessage(message);
    return `${parts.beforeObject}${String(objectText || '')}${parts.betweenObjectModel}${String(model || '')}`
        + `${parts.betweenModelPlate}${String(plate || '')}${parts.afterPlate}`;
}

function normalizedEmailObject(item = {}, rule = {}, index = 0, defaults = {}) {
    const vehicles = Array.isArray(item.vehicles) ? item.vehicles.map((vehicle, vehicleIndex) => {
        const normalized = splitLegacyVehicleReference(vehicle);
        return {
            ...normalized,
            id: normalized.id || `vehicle-${vehicleIndex}`,
            message: normalizeDeadlineMessage(normalized.message || item.message, defaults)
        };
    }).filter(vehicle => vehicle.model || vehicle.plate) : [];
    return {
        id: String(item.id || `object-${index}`),
        name: String(item.name || item.objectText || rule.name || '').trim(),
        objectText: String(item.objectText || item.name || rule.templateText || rule.name || '').trim(),
        period: validateDeadlineNotice(item.period ?? rule.period ?? 14),
        freq: validateDeadlineFrequency(item.freq ?? rule.freq ?? 7),
        message: normalizeDeadlineMessage(item.message, defaults),
        vehicles
    };
}

export function legacyTemplatesForRule(ruleName, templates = []) {
    const rule = normalizedTemplateHint(ruleName);
    const stems = rule.split(' ').filter(token => token.length > 3);
    const matching = (Array.isArray(templates) ? templates : []).filter(template => {
        const normalized = normalizedTemplateHint(template);
        return stems.every(stem => normalized.includes(stem));
    });
    return matching.length ? matching : [];
}

function legacyVehicleKind(value) {
    const normalized = normalizedTemplateHint(typeof value === 'object'
        ? `${value.model || value.name || ''} ${value.vehicleType || value.type || ''}`
        : value);
    if (/\bmoto\b|\b(?:motocicl|scooter)\w*/.test(normalized)) return 'motorcycle';
    if (/\b(rimorch|carrell|roulotte)\w*/.test(normalized)) return 'trailer';
    if (/\b(camion|autocarro|furgon)\w*/.test(normalized)) return 'truck';
    return 'car';
}

function legacyTemplateVehicleKind(value) {
    const normalized = normalizedTemplateHint(value);
    if (/\bmoto\b|\b(?:motocicl|scooter)\w*/.test(normalized)) return 'motorcycle';
    if (/\b(rimorch|carrell|roulotte)\w*/.test(normalized)) return 'trailer';
    if (/\b(camion|autocarro|furgon)\w*/.test(normalized)) return 'truck';
    if (/\b(auto|automobil|vettura)\w*/.test(normalized)) return 'car';
    return '';
}

function legacyVehiclesForTemplate(template, vehicles) {
    const kind = legacyTemplateVehicleKind(template);
    return kind ? vehicles.filter(vehicle => legacyVehicleKind(vehicle) === kind) : vehicles;
}

export function deadlineRuleEmailObjects(rule = {}, config = {}, defaults = {}) {
    if (Array.isArray(rule.emailObjects) && rule.emailObjects.length) {
        return rule.emailObjects.map((item, index) => normalizedEmailObject(item, rule, index, defaults));
    }
    const templates = legacyTemplatesForRule(rule.name, config.emailTemplates);
    const vehicles = (Array.isArray(config.models) ? config.models : []).map((vehicle, index) => {
        const normalized = splitLegacyVehicleReference(vehicle);
        return {
            ...normalized,
            id: normalized.id || `legacy-vehicle-${index}`,
            message: normalizeDeadlineMessage({}, defaults)
        };
    });
    const sources = templates.length ? templates : [rule.templateText || rule.name];
    return sources.filter(Boolean).map((objectText, index) => normalizedEmailObject({
        id: `legacy-object-${index}`,
        name: objectText,
        objectText,
        period: rule.period,
        freq: rule.freq,
        vehicles: legacyVehiclesForTemplate(objectText, vehicles)
    }, rule, index, defaults));
}

export function updateDeadlineRuleEmailObjects(config, ruleIndex, emailObjects) {
    const deadlineTypes = [...(config.deadlineTypes || [])];
    const rule = deadlineTypes[ruleIndex];
    if (!rule) return config;
    deadlineTypes[ruleIndex] = {
        ...rule,
        emailObjects: (Array.isArray(emailObjects) ? emailObjects : []).map((item, index) =>
            normalizedEmailObject(item, rule, index))
    };
    return {...config, deadlineTypes};
}
