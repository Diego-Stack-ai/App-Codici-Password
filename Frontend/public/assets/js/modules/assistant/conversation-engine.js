import { normalizeSearchText } from './search-normalizer.js';

const STOP_WORDS = new Set([
    'a', 'al', 'alla', 'alle', 'che', 'cerca', 'cercando', 'cerco', 'codex', 'dei', 'del', 'dell', 'della', 'di',
    'fammi', 'gli', 'ho', 'il', 'in', 'la', 'le', 'mi', 'mostra', 'mostrami', 'nell', 'per', 'puoi',
    'quale', 'quali', 'solo', 'sto', 'su', 'trovami', 'trova', 'un', 'una', 'uno', 'vorrei'
]);
const OPEN_WORDS = new Set(['apri', 'aprimi', 'vai', 'visualizza']);
const ORDINALS = new Map([
    ['primo', 0], ['prima', 0], ['1', 0], ['secondo', 1], ['seconda', 1], ['2', 1],
    ['terzo', 2], ['terza', 2], ['3', 2], ['quarto', 3], ['quarta', 3], ['4', 3],
    ['ultimo', -1], ['ultima', -1]
]);
const SYNONYMS = new Map([
    ['banca', ['banca', 'bancario', 'conto']], ['conto', ['conto', 'banca', 'bancario']],
    ['documento', ['documento', 'identita', 'patente', 'passaporto']],
    ['identita', ['identita', 'documento']], ['societa', ['societa', 'azienda', 'impresa']],
    ['azienda', ['azienda', 'societa', 'impresa']], ['scadenze', ['scadenza']], ['account', ['account']]
]);

const safeText = record => normalizeSearchText([
    record.kind, record.title, record.subtitle, record.scope, record.companyName, ...(record.keywords || [])
].join(' '));

function meaningfulTokens(query) {
    return normalizeSearchText(query).split(' ').filter(token => token.length > 1 && !STOP_WORDS.has(token) && !OPEN_WORDS.has(token));
}

function matchesToken(recordText, token) {
    return (SYNONYMS.get(token) || [token]).some(candidate => recordText.includes(candidate));
}

function searchRecords(records, query) {
    const tokens = meaningfulTokens(query);
    if (!tokens.length) return [];
    return records.map(record => {
        const text = safeText(record);
        if (!tokens.every(token => matchesToken(text, token))) return null;
        const title = normalizeSearchText(record.title);
        const score = tokens.reduce((total, token) => total + (title.includes(token) ? 20 : 5), 0);
        return { record, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title, 'it'))
        .slice(0, 12).map(match => match.record);
}

function groupLabel(item) {
    return item.scope === 'azienda' ? (item.companyName || item.subtitle.replace(/^Azienda:\s*/i, '') || 'Azienda') : 'Privato';
}

function describe(items) {
    if (!items.length) return 'Non ho trovato una corrispondenza. Prova a indicare il tipo di dato oppure il nome dell’azienda.';
    if (items.length === 1) return `Ho trovato ${items[0].title}, nella sezione ${groupLabel(items[0])}. Vuoi che lo apra?`;
    const groups = new Map();
    items.forEach(item => groups.set(groupLabel(item), (groups.get(groupLabel(item)) || 0) + 1));
    const summary = [...groups].map(([name, count]) => `${count} per ${name}`).join(', ');
    return `Ho trovato ${items.length} risultati: ${summary}. Puoi dirmi “apri il secondo” oppure indicare l’azienda.`;
}

function requestedIndex(query, length) {
    const tokens = normalizeSearchText(query).split(' ');
    for (const token of tokens) {
        if (!ORDINALS.has(token)) continue;
        const index = ORDINALS.get(token);
        return index < 0 ? length - 1 : index;
    }
    return length === 1 ? 0 : null;
}

export class VaultConversationEngine {
    #records;
    #lastResults = [];

    constructor(records) { this.#records = [...records]; }

    ask(query) {
        const normalized = normalizeSearchText(query);
        if (!normalized) return { message: 'Dimmi cosa stai cercando.', items: [] };
        const wantsOpen = normalized.split(' ').some(token => OPEN_WORDS.has(token));
        if (wantsOpen && this.#lastResults.length) {
            const index = requestedIndex(normalized, this.#lastResults.length);
            if (index !== null && this.#lastResults[index]) {
                const item = this.#lastResults[index];
                return { message: `Apro ${item.title}.`, items: [item], navigateTo: item.href };
            }
        }

        let items = searchRecords(this.#records, query);
        if (!items.length && this.#lastResults.length) items = searchRecords(this.#lastResults, query);
        this.#lastResults = items;
        return { message: describe(items), items };
    }

    clear() { this.#records = []; this.#lastResults = []; }
}
