import { normalizeSearchText, queryTokens } from './search-normalizer.js';

function prepare(record) {
    return Object.freeze({
        ...record,
        _title: normalizeSearchText(record.title),
        _searchText: normalizeSearchText([record.kind, record.title, record.subtitle, ...(record.keywords || [])].join(' '))
    });
}

function scoreRecord(record, query, tokens) {
    if (!tokens.length || !tokens.every(token => record._searchText.includes(token))) return 0;
    let score = 20;
    if (record._title === query) score += 100;
    else if (record._title.startsWith(query)) score += 70;
    else if (record._title.includes(query)) score += 50;
    for (const token of tokens) score += record._title.split(' ').includes(token) ? 15 : record._title.includes(token) ? 8 : 0;
    return score;
}

export class VaultSearchIndex {
    #records = [];
    replace(records) { this.clear(); this.#records = records.map(prepare); }
    search(query, limit = 12) {
        const normalized = normalizeSearchText(query);
        const tokens = queryTokens(query);
        return this.#records.map(item => ({ item, score: scoreRecord(item, normalized, tokens) }))
            .filter(({ score }) => score > 0)
            .sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title, 'it'))
            .slice(0, limit).map(({ item }) => {
                const { _title, _searchText, ...safe } = item;
                return safe;
            });
    }
    get size() { return this.#records.length; }
    clear() { this.#records.splice(0); this.#records = []; }
}
