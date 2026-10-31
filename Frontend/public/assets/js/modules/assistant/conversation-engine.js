import { normalizeSearchText } from './search-normalizer.js';

const STOP_WORDS = new Set([
    'a', 'al', 'alla', 'alle', 'che', 'cerca', 'cercando', 'cerco', 'codex', 'dei', 'del', 'dell', 'della', 'di',
    'fammi', 'gli', 'ho', 'il', 'in', 'la', 'le', 'mi', 'mostra', 'mostrami', 'nell', 'per', 'puoi',
    'avevo', 'breve', 'cera', 'come', 'cosa', 'dimmi', 'dove', 'ero', 'fare', 'ma', 'non', 'pagina', 'quando',
    'quale', 'quali', 'quanta', 'quante', 'quanti', 'quanto', 'quella', 'quelle', 'quelli', 'quello', 'questa', 'queste', 'questi', 'questo',
    'ricordo', 'ricordavo', 'scade', 'scadera',
    'scadere', 'sezione', 'serve', 'sicuro', 'solo', 'sono', 'spiega', 'spiegami', 'stavo', 'sto', 'su',
    'prossima', 'prossime', 'prossimi', 'prossimo',
    'trovami', 'trova', 'trovare', 'trovo', 'tutta', 'tutte', 'tutti', 'tutto', 'un', 'una', 'uno', 'vorrei'
]);
const OPEN_WORDS = new Set(['apre', 'apri', 'aprimi', 'aprire', 'portami', 'vai', 'visualizza']);
const CONTEXT_WORDS = new Set(['quella', 'quelle', 'quelli', 'quello', 'questa', 'queste', 'questi', 'questo']);
const SEARCH_RESULT_LIMIT = 12;
const ORDINALS = new Map([
    ['primo', 0], ['prima', 0], ['uno', 0], ['1', 0], ['secondo', 1], ['seconda', 1], ['due', 1], ['2', 1],
    ['terzo', 2], ['terza', 2], ['tre', 2], ['3', 2], ['quarto', 3], ['quarta', 3], ['quattro', 3], ['4', 3],
    ['quinto', 4], ['quinta', 4], ['cinque', 4], ['5', 4], ['sesto', 5], ['sesta', 5], ['sei', 5], ['6', 5],
    ['settimo', 6], ['settima', 6], ['sette', 6], ['7', 6], ['ottavo', 7], ['ottava', 7], ['otto', 7], ['8', 7],
    ['nono', 8], ['nona', 8], ['nove', 8], ['9', 8], ['decimo', 9], ['decima', 9], ['dieci', 9], ['10', 9],
    ['undicesimo', 10], ['undicesima', 10], ['undici', 10], ['11', 10],
    ['dodicesimo', 11], ['dodicesima', 11], ['dodici', 11], ['12', 11],
    ['ultimo', -1], ['ultima', -1]
]);
const SYNONYMS = new Map([
    ['banca', 'bancario', 'conto', 'iban'], ['documento', 'documenti', 'identita', 'patente', 'passaporto'],
    ['societa', 'azienda', 'impresa', 'ditta'], ['scadenza', 'scadenze', 'promemoria', 'rinnovo'],
    ['account', 'accesso', 'login', 'credenziale', 'credenziali'],
    ['assicurazione', 'polizza', 'rca'], ['auto', 'automobile', 'macchina', 'veicolo'],
    ['moto', 'motociclo', 'motocicletta'], ['bollo', 'tassa', 'automobilistica'],
    ['casa', 'abitazione', 'immobile'], ['utenza', 'utenze', 'bolletta'],
    ['salute', 'sanitario', 'medico'], ['sport', 'sportivo', 'associazione'],
    ['contratto', 'contratti', 'accordo'], ['email', 'mail', 'posta']
].flatMap(group => group.map(word => [word, group])));
const CATEGORY_WORDS = new Set([
    'account', 'accesso', 'azienda', 'banca', 'conto', 'credenziale', 'documento', 'identita',
    'scadenza', 'scadenze', 'societa', 'utenza'
]);

const safeText = record => normalizeSearchText([
    record.kind, record.title, record.subtitle, record.scope, record.companyName, ...(record.keywords || [])
].join(' '));

function meaningfulTokens(query) {
    return normalizeSearchText(query).split(' ').filter(token => token.length > 1 && !STOP_WORDS.has(token) && !OPEN_WORDS.has(token));
}

function editDistance(left, right) {
    const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
        const current = [row];
        for (let column = 1; column <= right.length; column += 1) {
            current[column] = Math.min(
                current[column - 1] + 1,
                previous[column] + 1,
                previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1)
            );
        }
        previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
}

function fuzzyWordMatch(recordText, token) {
    if (token.length < 5) return false;
    const maximum = token.length >= 9 ? 2 : 1;
    return recordText.split(' ').some(word => Math.abs(word.length - token.length) <= maximum
        && editDistance(word, token) <= maximum);
}

function matchesToken(recordText, token) {
    return (SYNONYMS.get(token) || [token]).some(candidate => recordText.includes(candidate)
        || fuzzyWordMatch(recordText, candidate));
}

function resemblesCompany(record, queryTokens) {
    const company = normalizeSearchText(record.companyName).replaceAll(' ', '');
    const spoken = queryTokens.filter(token => !CATEGORY_WORDS.has(token)).join('');
    if (!company || company.length < 5 || spoken.length < 5) return false;
    return editDistance(company, spoken) <= Math.max(2, Math.floor(company.length * 0.25));
}

function rankRecords(records, query) {
    const tokens = meaningfulTokens(query);
    if (!tokens.length) return [];
    return records.map(record => {
        const text = safeText(record);
        const unmatched = tokens.filter(token => !matchesToken(text, token));
        if (unmatched.length && !resemblesCompany(record, tokens)) return null;
        const title = normalizeSearchText(record.title);
        const kind = normalizeSearchText(record.kind);
        const score = tokens.reduce((total, token) => {
            const alternatives = SYNONYMS.get(token) || [token];
            if (alternatives.some(candidate => title === candidate)) return total + 35;
            if (alternatives.some(candidate => title.includes(candidate))) return total + 24;
            if (alternatives.some(candidate => kind.includes(candidate))) return total + 14;
            return total + 6;
        }, 0) + (unmatched.length ? 8 : 0);
        return { record, score };
    }).filter(Boolean).sort((a, b) => b.score - a.score || a.record.title.localeCompare(b.record.title, 'it'))
        .map(match => match.record);
}

function pageResults(matches, offset = 0) {
    const safeOffset = Math.max(0, Math.min(offset, Math.max(0, matches.length - 1)));
    return {
        items: matches.slice(safeOffset, safeOffset + SEARCH_RESULT_LIMIT),
        total: matches.length,
        offset: safeOffset,
        hasMore: safeOffset + SEARCH_RESULT_LIMIT < matches.length
    };
}

function groupLabel(item) {
    return item.scope === 'azienda' ? (item.companyName || item.subtitle.replace(/^Azienda:\s*/i, '') || 'Azienda') : 'Privato';
}

function describe(items, total = items.length, offset = 0, hasMore = false) {
    if (!items.length) return 'Non ho trovato una corrispondenza. Prova a indicare il tipo di dato oppure il nome dell’azienda.';
    if (items.length === 1 && total === 1) return `Ho trovato ${items[0].title}, nella sezione ${groupLabel(items[0])}. Vuoi che lo apra?`;
    const groups = new Map();
    items.forEach(item => groups.set(groupLabel(item), (groups.get(groupLabel(item)) || 0) + 1));
    const summary = [...groups].map(([name, count]) => `${count} per ${name}`).join(', ');
    const hint = groups.size === 1
        ? 'Puoi dirmi “apri il secondo” oppure “apri il due”.'
        : 'Puoi dirmi “apri il secondo” oppure indicare l’azienda.';
    const last = offset + items.length;
    const count = total > items.length
        ? `Ho trovato ${total} risultati e mostro ${offset + 1}–${last}`
        : `Ho trovato ${items.length} risultati`;
    const pageHint = hasMore ? ' Puoi dire “mostra altri”.' : '';
    return `${count}: ${summary}. ${hint}${pageHint}`;
}

function requestedIndex(query, length, offset = 0) {
    const tokens = normalizeSearchText(query).split(' ');
    const numeric = tokens.find(token => /^\d+$/.test(token));
    if (numeric) {
        const number = Number(numeric);
        if (number >= offset + 1 && number <= offset + length) return number - offset - 1;
        if (number >= 1 && number <= length) return number - 1;
    }
    for (const token of tokens) {
        if (!ORDINALS.has(token)) continue;
        const index = ORDINALS.get(token);
        return index < 0 ? length - 1 : index;
    }
    return length === 1 ? 0 : null;
}

function requestedPageOffset(query, total, currentOffset) {
    const lastPageOffset = Math.floor(Math.max(0, total - 1) / SEARCH_RESULT_LIMIT) * SEARCH_RESULT_LIMIT;
    const pageMatch = query.match(/\bpagina\s+(\d+)\b/);
    if (pageMatch) return Math.min(Math.max(0, Number(pageMatch[1]) - 1) * SEARCH_RESULT_LIMIT, lastPageOffset);
    if (/\b(altri|altre|avanti|successiv[ioe]|prossim[ioe])\b/.test(query)) {
        return Math.min(currentOffset + SEARCH_RESULT_LIMIT, lastPageOffset);
    }
    if (/\b(indietro|precedent[ei])\b/.test(query)) return Math.max(0, currentOffset - SEARCH_RESULT_LIMIT);
    return null;
}

function exactNamedTarget(records, query, { companyOnly = false } = {}) {
    const target = meaningfulTokens(query)
        .filter(token => !['azienda', 'societa', 'impresa'].includes(token))
        .join(' ');
    if (!target) return null;
    const matches = records.filter(record => {
        if (companyOnly && record.kind !== 'azienda') return false;
        return [record.title, record.companyName]
            .map(normalizeSearchText)
            .some(value => value === target);
    });
    return matches.length === 1 ? matches[0] : null;
}

export class VaultConversationEngine {
    #records;
    #lastResults = [];
    #lastMatches = [];
    #lastOffset = 0;

    constructor(records) { this.#records = [...records]; }

    ask(query) {
        const normalized = normalizeSearchText(query);
        if (!normalized) return { message: 'Dimmi cosa stai cercando.', items: [] };
        const normalizedTokens = normalized.split(' ');
        const wantsOpen = normalizedTokens.some(token => OPEN_WORDS.has(token));
        const contextual = normalizedTokens.some(token => CONTEXT_WORDS.has(token));
        const pageOffset = this.#lastMatches.length
            ? requestedPageOffset(normalized, this.#lastMatches.length, this.#lastOffset)
            : null;
        if (pageOffset !== null) {
            const page = pageResults(this.#lastMatches, pageOffset);
            this.#lastResults = page.items;
            this.#lastOffset = page.offset;
            return { ...page, message:describe(page.items, page.total, page.offset, page.hasMore) };
        }
        if (wantsOpen && this.#lastResults.length) {
            const index = requestedIndex(normalized, this.#lastResults.length, this.#lastOffset);
            if (index !== null && this.#lastResults[index]) {
                const item = this.#lastResults[index];
                return { message: `Apro ${item.title}.`, items: [item], navigateTo: item.href };
            }
            const company = exactNamedTarget(this.#records, normalized, { companyOnly: true });
            if (company) {
                return { message: `Apro l’azienda ${company.title}.`, items: [company], navigateTo: company.href };
            }
            const item = exactNamedTarget(this.#lastResults, normalized);
            if (item) return { message: `Apro ${item.title}.`, items: [item], navigateTo: item.href };
            if (contextual) {
                const narrowed = rankRecords(this.#lastMatches, query);
                if (narrowed.length === 1) {
                    const [contextItem] = narrowed;
                    return { message:`Apro ${contextItem.title}.`, items:[contextItem], navigateTo:contextItem.href };
                }
            }
            return {
                message: 'Non ho riconosciuto quale risultato vuoi aprire. Puoi dire, per esempio, “apri il secondo” oppure “apri il due”.',
                items: []
            };
        }

        let matches = contextual && this.#lastMatches.length
            ? rankRecords(this.#lastMatches, query)
            : rankRecords(this.#records, query);
        if (!matches.length && this.#lastMatches.length) matches = rankRecords(this.#lastMatches, query);
        const page = pageResults(matches);
        if (page.items.length) {
            this.#lastMatches = matches;
            this.#lastResults = page.items;
            this.#lastOffset = page.offset;
        }
        return { ...page, message:describe(page.items, page.total, page.offset, page.hasMore) };
    }

    executeIntent(intent, fallbackQuery = '') {
        if (!intent || typeof intent !== 'object') {
            return { message: 'Non ho compreso la richiesta. Prova a indicare cosa vuoi cercare.', items: [] };
        }
        if (intent.type === 'semantic_search') return this.ask(intent.query || fallbackQuery);
        if (intent.type === 'select_result') {
            const item = this.#lastResults[Number(intent.resultOrdinal) - 1];
            return item
                ? { message: `Apro ${item.title}.`, items: [item], navigateTo: item.href }
                : { message: 'Risultato non disponibile.', items: [] };
        }
        if (intent.type === 'explain_page' || intent.type === 'clarify') {
            return {
                message: intent.query || 'Non ho ancora informazioni sufficienti per rispondere.',
                items: []
            };
        }
        return {
            message: 'Richiesta non disponibile.',
            items: []
        };
    }

    removeRecord(id) {
        this.#records = this.#records.filter(record => record.id !== id);
        this.#lastResults = this.#lastResults.filter(record => record.id !== id);
        this.#lastMatches = this.#lastMatches.filter(record => record.id !== id);
    }

    clear() { this.#records = []; this.#lastResults = []; this.#lastMatches = []; this.#lastOffset = 0; }
}
