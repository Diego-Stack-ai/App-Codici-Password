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
