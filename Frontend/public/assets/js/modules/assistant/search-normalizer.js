const ALIASES = new Map([
    ['ci', 'carta identita documento identita'],
    ['carta identita', 'documento identita'],
    ['patente', 'documento patente guida'],
    ['azienda', 'societa impresa'],
    ['conto', 'banca bancario'],
    ['scadenza', 'assicurazione revisione bollo documento'],
]);

export function normalizeSearchText(value) {
    return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' ');
}

export function queryTokens(query) {
    const normalized = normalizeSearchText(query);
    if (!normalized) return [];
    const expanded = [normalized];
    for (const [source, aliases] of ALIASES) {
        if (normalized === source || normalized.includes(`${source} `) || normalized.includes(` ${source}`)) expanded.push(aliases);
    }
    return [...new Set(normalizeSearchText(expanded.join(' ')).split(' ').filter(Boolean))];
}
