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
