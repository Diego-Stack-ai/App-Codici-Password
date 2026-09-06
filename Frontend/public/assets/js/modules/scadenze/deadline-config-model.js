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

export function updateDeadlineType(config, index, values) {
    const item = normalizeDeadlineType(values);
    if (!item || !Array.isArray(config.deadlineTypes) || !config.deadlineTypes[index]) return config;
    const deadlineTypes = [...config.deadlineTypes];
    deadlineTypes[index] = item;
    return { ...config, deadlineTypes };
}

export function appendDeadlineType(config, values) {
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
