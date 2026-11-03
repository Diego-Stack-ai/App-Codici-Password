// D0 only: static documentation. No identity, Vault, DOM, storage or network.
const ID = /^[a-z][a-z0-9_-]*$/;
const KEY = /^guide\.[a-zA-Z0-9_.-]+$/;
const TARGET = /^#[a-zA-Z][a-zA-Z0-9_-]*$/;
const FAMILIES = new Set(['access', 'internal', 'public-contact']);
const KNOWLEDGE_STOP_WORDS = new Set([
    'a', 'al', 'alla', 'che', 'come', 'con', 'cosa', 'da', 'dei', 'del', 'della', 'di', 'dove', 'e', 'gli',
    'il', 'in', 'la', 'le', 'mi', 'nel', 'nella', 'o', 'per', 'posso', 'puoi', 'questa', 'questo', 'serve',
    'si', 'su', 'un', 'una', 'bottone', 'campo', 'comando', 'controllo', 'menu', 'pagina', 'pulsante',
    'schermata', 'selettore', 'sezione', 'tasto'
]);
const KNOWLEDGE_EQUIVALENTS = new Map([
    ['crea', 'creare', 'creo', 'aggiungi', 'aggiungere', 'nuova', 'nuovo'],
    ['modifica', 'modificare', 'aggiorna', 'aggiornare'],
    ['scadenza', 'scadenze', 'promemoria', 'rinnovo'],
    ['account', 'accesso', 'credenziale', 'credenziali'],
    ['azienda', 'aziendale', 'impresa', 'societa', 'ditta'],
    ['privato', 'personale'],
    ['profilo', 'anagrafica', 'identita'],
    ['archivio', 'archiviare', 'archiviato'],
    ['backup', 'salvataggio'],
    ['esporta', 'esportare', 'esportazione'],
    ['impostazioni', 'preferenze'],
    ['configura', 'configurare', 'configurazione', 'imposta', 'impostare'],
    ['collega', 'collegare', 'associa', 'associare', 'abbina', 'abbinare'],
    ['condividi', 'condividere', 'condivisione', 'condiviso', 'condivisa'],
    ['destinatario', 'destinatari', 'rubrica', 'contatto', 'contatti'],
    ['allegato', 'allegati', 'documento', 'documenti', 'file'],
    ['memorandum', 'memo', 'annotazione'],
    ['widget', 'campi', 'personalizzato', 'personalizzati'],
    ['notifica', 'notifiche', 'push', 'avviso', 'avvisi'],
    ['password', 'credenziale', 'credenziali', 'segreto', 'segreti']
].flatMap(group => group.map(word => [word, group])));
const TARGET_WORDS = new Map([
    ['btn', 'pulsante'], ['button', 'pulsante'], ['toggle', 'interruttore'], ['select', 'selettore'],
    ['selector', 'selettore'], ['search', 'ricerca'], ['list', 'elenco'], ['container', 'area'],
    ['section', 'sezione'], ['form', 'modulo'], ['save', 'salva'], ['add', 'aggiungi'],
    ['edit', 'modifica'], ['delete', 'elimina'], ['remove', 'rimuovi'], ['archive', 'archivio'],
    ['manage', 'gestisci'], ['contacts', 'destinatari'],
    ['account', 'account'], ['deadline', 'scadenza'], ['profile', 'profilo'], ['company', 'azienda']
]);

function requireCondition(condition, code) {
    if (!condition) throw new TypeError(`GUIDE_${code}`);
}

function exactKeys(object, keys, code) {
    requireCondition(object && typeof object === 'object' && !Array.isArray(object), code);
    requireCondition(Object.keys(object).length === keys.length && keys.every(key => Object.hasOwn(object, key)), code);
}

function freezeTree(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freezeTree);
        Object.freeze(value);
    }
    return value;
}

function normalizeKnowledgeText(value) {
    return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ').trim();
}

function knowledgeTokens(value) {
    return normalizeKnowledgeText(value).split(' ')
        .filter(token => token.length > 1 && !KNOWLEDGE_STOP_WORDS.has(token));
}

function editDistance(left, right) {
    const previous = Array.from({ length:right.length + 1 }, (_, index) => index);
    for (let row = 1; row <= left.length; row += 1) {
        const current = [row];
        for (let column = 1; column <= right.length; column += 1) {
            current[column] = Math.min(current[column - 1] + 1, previous[column] + 1,
                previous[column - 1] + (left[row - 1] === right[column - 1] ? 0 : 1));
        }
        previous.splice(0, previous.length, ...current);
    }
    return previous[right.length];
}

function textMatches(text, candidate) {
    if (text.includes(candidate)) return true;
    if (candidate.length < 5) return false;
    const maximum = candidate.length >= 9 ? 2 : 1;
    return text.split(' ').some(word => Math.abs(word.length - candidate.length) <= maximum
        && editDistance(word, candidate) <= maximum);
}

function targetText(target) {
    if (!target) return '';
    return normalizeKnowledgeText(target.slice(1)).split(' ')
        .map(token => TARGET_WORDS.get(token) || token).join(' ');
}

function knowledgeScore(guide, queryTokens, { route = '', relatedText = '' } = {}) {
    if (!queryTokens.length) return { score:0, matchedStep:null };
    const title = normalizeKnowledgeText(guide.title);
    const purpose = normalizeKnowledgeText(guide.purpose);
    const routeText = normalizeKnowledgeText(route);
    const related = normalizeKnowledgeText(relatedText);
    const steps = guide.steps.map(step => ({
        step,
        body:normalizeKnowledgeText(step.body),
        target:targetText(step.target),
        score:0,
        targetHits:new Set()
    }));
    let matched = 0;
    const score = queryTokens.reduce((total, token) => {
        const alternatives = KNOWLEDGE_EQUIVALENTS.get(token) || [token];
        let best = 0;
        if (alternatives.some(candidate => title === candidate)) best = 36;
        else if (alternatives.some(candidate => textMatches(title, candidate))) best = 28;
        if (alternatives.some(candidate => textMatches(purpose, candidate))) best = Math.max(best, 18);
        if (alternatives.some(candidate => textMatches(routeText, candidate))) best = Math.max(best, 12);
        if (alternatives.some(candidate => textMatches(related, candidate))) best = Math.max(best, 7);
        steps.forEach(item => {
            let stepScore = 0;
            if (alternatives.some(candidate => textMatches(item.target, candidate))) {
                stepScore = 26;
                item.targetHits.add(alternatives[0]);
            } else if (alternatives.some(candidate => textMatches(item.body, candidate))) stepScore = 16;
            item.score += stepScore;
            best = Math.max(best, stepScore);
        });
        if (best > 0) { matched += 1; return total + best; }
        return total;
    }, 0);
    const matchedStep = steps.sort((left, right) => right.score - left.score)[0];
    const controlConnectionBonus = matchedStep?.targetHits.size > 1 ? matchedStep.score : 0;
    return {
        score:matched ? score - ((queryTokens.length - matched) * 12)
            + (matched === queryTokens.length ? 24 : 0) + controlConnectionBonus : 0,
        matchedStep:matchedStep?.score > 0 ? matchedStep.step : null
    };
}

export function validateGuideCatalog(catalog) {
    exactKeys(catalog, ['schemaVersion', 'contentVersion', 'reviewedAppVersion', 'fallbackLocale', 'pages', 'journeys', 'messages'], 'CATALOG_SHAPE');
    requireCondition(catalog.schemaVersion === 1 && Number.isSafeInteger(catalog.contentVersion) && catalog.contentVersion > 0, 'VERSION');
    requireCondition(/^\d+\.\d+\.\d+$/.test(catalog.reviewedAppVersion), 'APP_VERSION');
    requireCondition(typeof catalog.fallbackLocale === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(catalog.fallbackLocale), 'LOCALE');
    requireCondition(catalog.messages && typeof catalog.messages === 'object' && !Array.isArray(catalog.messages), 'MESSAGES');
    requireCondition(Object.hasOwn(catalog.messages, catalog.fallbackLocale), 'FALLBACK');
    for (const [locale, messages] of Object.entries(catalog.messages)) {
        requireCondition(/^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale) && messages && typeof messages === 'object' && !Array.isArray(messages), 'LOCALE');
        for (const [key, text] of Object.entries(messages)) {
            requireCondition(KEY.test(key) && typeof text === 'string' && text.trim().length > 0, 'MESSAGE');
        }
    }
    const base = catalog.messages[catalog.fallbackLocale];
    const referencedKeys = new Set();
    const messageKey = key => {
        requireCondition(typeof key === 'string' && KEY.test(key) && Object.hasOwn(base, key), 'MESSAGE_MISSING');
        referencedKeys.add(key);
    };
    requireCondition(Array.isArray(catalog.pages) && catalog.pages.length > 0, 'PAGES');
    const pages = new Set();
    for (const page of catalog.pages) {
        exactKeys(page, ['pageId', 'route', 'family', 'titleKey', 'purposeKey', 'steps', 'relatedPageIds', 'tutorialId'], 'PAGE_SHAPE');
        requireCondition(typeof page.pageId === 'string' && ID.test(page.pageId) && !pages.has(page.pageId), 'PAGE_ID');
        pages.add(page.pageId);
        requireCondition(page.route === `/${page.pageId}.html` && FAMILIES.has(page.family), 'ROUTE');
        requireCondition(page.tutorialId === null, 'VIDEO_NOT_CONNECTED');
        messageKey(page.titleKey);
        messageKey(page.purposeKey);
        requireCondition(Array.isArray(page.steps) && page.steps.length > 0, 'STEPS');
        const steps = new Set();
        for (const step of page.steps) {
            exactKeys(step, ['stepId', 'bodyKey', 'target'], 'STEP_SHAPE');
            requireCondition(typeof step.stepId === 'string' && ID.test(step.stepId) && !steps.has(step.stepId), 'STEP_ID');
            steps.add(step.stepId);
            requireCondition(step.target === null || (typeof step.target === 'string' && TARGET.test(step.target)), 'TARGET');
            messageKey(step.bodyKey);
        }
        requireCondition(Array.isArray(page.relatedPageIds) && new Set(page.relatedPageIds).size === page.relatedPageIds.length, 'RELATED_PAGES');
    }
    for (const page of catalog.pages) {
        requireCondition(page.relatedPageIds.every(id => pages.has(id)), 'RELATED_PAGE_MISSING');
    }
    requireCondition(Array.isArray(catalog.journeys), 'JOURNEYS');
    const journeys = new Set();
    for (const journey of catalog.journeys) {
        exactKeys(journey, ['journeyId', 'titleKey', 'pageIds'], 'JOURNEY_SHAPE');
        requireCondition(typeof journey.journeyId === 'string' && ID.test(journey.journeyId) && !journeys.has(journey.journeyId), 'JOURNEY_ID');
        journeys.add(journey.journeyId);
        messageKey(journey.titleKey);
        requireCondition(Array.isArray(journey.pageIds) && journey.pageIds.length > 0 && journey.pageIds.every(id => pages.has(id)), 'JOURNEY_PAGES');
    }
    for (const messages of Object.values(catalog.messages)) {
        requireCondition(Object.keys(messages).every(key => referencedKeys.has(key)), 'UNUSED_MESSAGE');
    }
    return true;
}

export function createDocumentationGuide(input) {
    // Snapshot first: changes to the caller's object cannot change this guide.
    const catalog = JSON.parse(JSON.stringify(input));
    validateGuideCatalog(catalog);
    freezeTree(catalog);
    const pages = new Map(catalog.pages.map(page => [page.pageId, page]));
    const translate = (key, locale) => {
        const dictionary = Object.hasOwn(catalog.messages, locale) ? catalog.messages[locale] : null;
        return dictionary?.[key] || catalog.messages[catalog.fallbackLocale][key];
    };
    const hasFallback = (keys, locale) => keys.some(key => !Object.hasOwn(catalog.messages, locale) || !Object.hasOwn(catalog.messages[locale], key));
    const resolvePageId = input => {
        if (typeof input !== 'string') return null;
        if (pages.has(input)) return input;
        // Only canonical local paths, never arbitrary URLs or record parameters.
        const route = input.split(/[?#]/, 1)[0];
        const match = /^\/?([a-z][a-z0-9_-]*)\.html$/.exec(route);
        return match && pages.has(match[1]) ? match[1] : null;
    };
    const adjacency = new Map(catalog.pages.map(page => [page.pageId, new Set()]));
    catalog.pages.forEach(page => page.relatedPageIds.forEach(relatedPageId => {
        adjacency.get(page.pageId).add(relatedPageId);
        adjacency.get(relatedPageId).add(page.pageId);
    }));
    const shortestPagePath = (from, to) => {
        const fromId = resolvePageId(from);
        const toId = resolvePageId(to);
        if (!fromId || !toId) return [];
        if (fromId === toId) return [fromId];
        const queue = [[fromId]];
        const visited = new Set([fromId]);
        while (queue.length) {
            const path = queue.shift();
            for (const next of adjacency.get(path.at(-1)) || []) {
                if (visited.has(next)) continue;
                const candidate = [...path, next];
                if (next === toId) return candidate;
                visited.add(next);
                queue.push(candidate);
            }
        }
        return [];
    };
    const getPageGuide = (input, { locale = catalog.fallbackLocale } = {}) => {
        requireCondition(typeof locale === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale), 'LOCALE_REQUEST');
        const page = pages.get(resolvePageId(input));
        if (!page) return null;
        const keys = [page.titleKey, page.purposeKey, ...page.steps.map(step => step.bodyKey)];
        return freezeTree({
            pageId: page.pageId, route: page.route, family: page.family,
            contentVersion: catalog.contentVersion, reviewedAppVersion: catalog.reviewedAppVersion,
            requestedLocale: locale, fallbackLocale: catalog.fallbackLocale,
            usesFallback: hasFallback(keys, locale),
            title: translate(page.titleKey, locale), purpose: translate(page.purposeKey, locale),
            steps: page.steps.map(step => ({ stepId: step.stepId, target: step.target, body: translate(step.bodyKey, locale) })),
            relatedPageIds: [...page.relatedPageIds], tutorialId: null
        });
    };
    const listJourneys = ({ locale = catalog.fallbackLocale } = {}) => {
        requireCondition(typeof locale === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale), 'LOCALE_REQUEST');
        return freezeTree(catalog.journeys.map(journey => ({
            journeyId: journey.journeyId, title: translate(journey.titleKey, locale),
            usesFallback: hasFallback([journey.titleKey], locale), pageIds: [...journey.pageIds]
        })));
    };
    const getKnowledgeGraph = ({ locale = catalog.fallbackLocale } = {}) => {
        requireCondition(typeof locale === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale), 'LOCALE_REQUEST');
        const nodes = catalog.pages.map(page => {
            const guide = getPageGuide(page.pageId, { locale });
            return {
                id:`page:${page.pageId}`, pageId:page.pageId, route:page.route, family:page.family,
                title:guide.title, purpose:guide.purpose, steps:guide.steps.map(step => step.body)
            };
        });
        const controlNodes = catalog.pages.flatMap(page => {
            const guide = getPageGuide(page.pageId, { locale });
            return guide.steps.filter(step => step.target).map(step => ({
                id:`control:${page.pageId}:${step.stepId}`, pageId:page.pageId, stepId:step.stepId,
                target:step.target, title:step.body
            }));
        });
        const controlEdges = catalog.pages.flatMap(page => {
            const guide = getPageGuide(page.pageId, { locale });
            return guide.steps.filter(step => step.target).map(step => ({
                from:`page:${page.pageId}`, to:`control:${page.pageId}:${step.stepId}`, type:'control'
            }));
        });
        const relatedEdges = catalog.pages.flatMap(page => page.relatedPageIds.map(relatedPageId => ({
            from:`page:${page.pageId}`, to:`page:${relatedPageId}`, type:'related'
        })));
        const journeyNodes = listJourneys({ locale }).map(journey => ({
            id:`journey:${journey.journeyId}`, journeyId:journey.journeyId, title:journey.title
        }));
        const journeyEdges = listJourneys({ locale }).flatMap(journey => journey.pageIds.map((pageId, index) => ({
            from:`journey:${journey.journeyId}`, to:`page:${pageId}`, type:'journey', order:index
        })));
        return freezeTree({
            contentVersion:catalog.contentVersion,
            reviewedAppVersion:catalog.reviewedAppVersion,
            nodes:[...nodes, ...controlNodes, ...journeyNodes],
            edges:[...relatedEdges, ...controlEdges, ...journeyEdges]
        });
    };
    const searchKnowledge = (query, { locale = catalog.fallbackLocale, limit = 5, fromPage = '' } = {}) => {
        requireCondition(typeof locale === 'string' && /^[a-z]{2}(?:-[A-Z]{2})?$/.test(locale), 'LOCALE_REQUEST');
        requireCondition(Number.isSafeInteger(limit) && limit > 0 && limit <= 12, 'KNOWLEDGE_LIMIT');
        const tokens = knowledgeTokens(query);
        if (!tokens.length) return freezeTree([]);
        const matches = catalog.pages.map(page => {
            const guide = getPageGuide(page.pageId, { locale });
            const relatedText = page.relatedPageIds.map(pageId => {
                const related = getPageGuide(pageId, { locale });
                return `${related.title} ${related.purpose}`;
            }).join(' ');
            return { guide, ...knowledgeScore(guide, tokens, { route:page.route, relatedText }) };
        }).filter(match => match.score > 0)
            .sort((left, right) => right.score - left.score || left.guide.title.localeCompare(right.guide.title, locale))
            .slice(0, limit)
            .map(({ guide, score, matchedStep }) => {
                const path = shortestPagePath(fromPage, guide.pageId).map(pageId => {
                    const page = getPageGuide(pageId, { locale });
                    return { pageId, route:page.route, title:page.title };
                });
                return {
                pageId:guide.pageId, route:guide.route, family:guide.family, title:guide.title,
                    purpose:guide.purpose, steps:guide.steps.map(step => step.body), matchedStep, path, score
                };
            });
        return freezeTree(matches);
    };
    const getPageKnowledge = (input, { locale = catalog.fallbackLocale, query = '', limit = 4 } = {}) => {
        const page = getPageGuide(input, { locale });
        if (!page) return null;
        requireCondition(Number.isSafeInteger(limit) && limit > 0 && limit <= 8, 'KNOWLEDGE_LIMIT');
        const candidates = [
            ...searchKnowledge(query, { locale, limit }),
            ...page.relatedPageIds.map(pageId => {
                const guide = getPageGuide(pageId, { locale });
                return {
                    pageId:guide.pageId, route:guide.route, family:guide.family, title:guide.title,
                    purpose:guide.purpose, steps:guide.steps.map(step => step.body), score:0
                };
            })
        ];
        const seen = new Set([page.pageId]);
        const related = candidates.filter(candidate => {
            if (seen.has(candidate.pageId)) return false;
            seen.add(candidate.pageId);
            return true;
        }).slice(0, limit);
        return freezeTree({ page, related });
    };
    return Object.freeze({
        resolvePageId, shortestPagePath, getPageGuide, listJourneys, getKnowledgeGraph, searchKnowledge, getPageKnowledge
    });
}

// The future view supplies non-sensitive state, without passing DOM values.
// Missing/ambiguous/hidden controls retain the complete text alternative.
export function presentGuideStep(guide, stepId, state = {}) {
    const step = guide?.steps?.find(candidate => candidate.stepId === stepId);
    if (!step) return null;
    const highlight = step.target !== null && state.matches === 1 && state.visible === true
        && state.enabled === true && state.connected === true;
    return Object.freeze({ stepId: step.stepId, body: step.body, target: highlight ? step.target : null,
        presentation: highlight ? 'highlight' : 'text-only' });
}
