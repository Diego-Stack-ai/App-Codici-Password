import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { createDocumentationGuide, presentGuideStep, validateGuideCatalog } from '../Frontend/public/assets/js/modules/assistant/documentation-guide.js';

const catalog = JSON.parse(await readFile(new URL('../Frontend/public/assets/js/modules/assistant/documentation-catalog.json', import.meta.url), 'utf8'));
const freshCatalog = () => structuredClone(catalog);

test('tutte le pagine e i percorsi guidati sono consultabili senza contesto personale', () => {
    const service = createDocumentationGuide(catalog);
    for (const page of catalog.pages) {
        const result = service.getPageGuide(page.pageId);
        assert.equal(result.pageId, page.pageId);
        assert.equal(result.steps.length, page.steps.length);
        assert.equal(result.usesFallback, false);
        assert.equal(result.tutorialId, null);
        assert.ok(result.purpose.length > 0);
    }
    for (const journey of service.listJourneys()) {
        assert.ok(journey.pageIds.every(pageId => service.getPageGuide(pageId)));
    }
});

test('route locali consentite; parametri personali e link esterni non entrano nella guida', () => {
    const service = createDocumentationGuide(catalog);
    assert.equal(service.resolvePageId('/form_account_privato.html?id=synthetic-record#fragment'), 'form_account_privato');
    for (const route of ['missing-page', '/missing-page.html', '../home_page.html', '//home_page.html', 'https://example.test/home_page.html', 'javascript:home_page.html', '/unknown.html']) {
        assert.equal(service.resolvePageId(route), null);
        assert.equal(service.getPageGuide(route), null);
    }
    const result = service.getPageGuide('/form_account_privato.html?id=synthetic-record');
    assert.ok(!JSON.stringify(result).includes('synthetic-record'));
    assert.equal(result.route, '/form_account_privato.html');
});

test('traduzioni parziali mantengono fallback italiano esplicito senza tradurre dati utente', () => {
    const input = freshCatalog();
    input.messages.en = { [input.pages[0].titleKey]: 'Entry' };
    const service = createDocumentationGuide(input);
    const entry = service.getPageGuide('index', { locale: 'en' });
    assert.equal(entry.title, 'Entry');
    assert.equal(entry.purpose, input.messages.it[input.pages[0].purposeKey]);
    assert.equal(entry.usesFallback, true);
    assert.equal(entry.requestedLocale, 'en');
    assert.equal(service.getPageGuide('home_page', { locale: 'fr' }).usesFallback, true);
    for (const locale of ['__proto__', null, {}, 'Synthetic user title']) {
        assert.throws(() => service.getPageGuide('home_page', { locale }), /GUIDE_LOCALE_REQUEST/);
        assert.throws(() => service.listJourneys({ locale }), /GUIDE_LOCALE_REQUEST/);
    }
});

test('snapshot e risultati immutabili non condividono oggetti modificabili con il chiamante', () => {
    const input = freshCatalog();
    const service = createDocumentationGuide(input);
    input.messages.it[input.pages[0].titleKey] = 'Mutated';
    const result = service.getPageGuide('index');
    assert.notEqual(result.title, 'Mutated');
    assert.throws(() => { result.steps[0].body = 'Mutated'; }, TypeError);
    assert.throws(() => { result.relatedPageIds.push('missing-page'); }, TypeError);
    assert.throws(() => { service.listJourneys()[0].pageIds.push('missing-page'); }, TypeError);
});

test('il grafo di conoscenza deriva solo dal catalogo pubblico e non contiene parametri o dati della vault', () => {
    const service = createDocumentationGuide(catalog);
    const graph = service.getKnowledgeGraph();
    const pageNodes = graph.nodes.filter(node => node.id.startsWith('page:'));
    assert.equal(pageNodes.length, catalog.pages.length);
    assert.ok(graph.edges.every(edge => graph.nodes.some(node => node.id === edge.from)
        && graph.nodes.some(node => node.id === edge.to)));
    assert.ok(graph.edges.some(edge => edge.type === 'related'));
    assert.ok(graph.edges.some(edge => edge.type === 'journey'));
    assert.ok(graph.edges.some(edge => edge.type === 'control'));
    const controlNodes = graph.nodes.filter(node => node.id.startsWith('control:'));
    assert.ok(controlNodes.some(node => node.target === '#btn-change-master-password'
        && node.pageId === 'impostazioni'));
    const serialized = JSON.stringify(graph);
    assert.doesNotMatch(serialized, /synthetic-record|[?&]id=/i);
    assert.ok(pageNodes.every(node => Object.keys(node).every(key => [
        'id', 'pageId', 'route', 'family', 'title', 'purpose', 'steps'
    ].includes(key))));
    assert.throws(() => { graph.nodes[0].title = 'Mutated'; }, TypeError);
});

test('la ricerca usa collegamenti fra pagina, pulsante e destinazione', () => {
    const service = createDocumentationGuide(catalog);
    const [match] = service.searchKnowledge('dove trovo il pulsante per cambiare la master password', {
        fromPage:'/home_page.html'
    });
    assert.equal(match.pageId, 'impostazioni');
    assert.equal(match.matchedStep.target, '#btn-change-master-password');
    assert.deepEqual(match.path.map(page => page.pageId), ['home_page', 'impostazioni']);
    assert.match(match.matchedStep.body, /Master Password/);
});

test('un controllo collegato prevale sulle pagine che contengono soltanto parole simili', () => {
    const service = createDocumentationGuide(catalog);
    const [match] = service.searchKnowledge('dove gestisco i destinatari della scadenza', {
        fromPage:'home_page'
    });
    assert.equal(match.pageId, 'aggiungi_scadenza');
    assert.equal(match.matchedStep.target, '#btn-manage-deadline-contacts');
});

test('la ricerca tollera un piccolo errore di digitazione senza usare un modello AI', () => {
    const [match] = createDocumentationGuide(catalog).searchKnowledge('come creo una scadnza');
    assert.equal(match.pageId, 'aggiungi_scadenza');
});

test('la conoscenza condivisa trova le istruzioni per creare una scadenza e completa la Home', () => {
    const service = createDocumentationGuide(catalog);
    const matches = service.searchKnowledge('come creare una nuova scadenza');
    assert.equal(matches[0].pageId, 'aggiungi_scadenza');
    const home = service.getPageKnowledge('/home_page.html?record=synthetic-record', {
        query:'come creare una nuova scadenza'
    });
    assert.match(home.page.steps.map(step => step.body).join(' '), /Nuova Scadenza/);
    assert.ok(home.related.some(page => page.pageId === 'aggiungi_scadenza'));
    assert.doesNotMatch(JSON.stringify(home), /synthetic-record/);
});

test('le domande operative comuni puntano alla pagina funzionale corretta', () => {
    const service = createDocumentationGuide(catalog);
    const cases = [
        ['dove modificare un account aziendale', 'form_account_azienda'],
        ['come configurare le impostazioni', 'impostazioni'],
        ['come esportare un archivio portatile', 'impostazioni'],
        ['come aggiungere i dati del profilo', 'profilo_privato']
    ];
    for (const [query, expectedPageId] of cases) {
        assert.equal(service.searchKnowledge(query)[0]?.pageId, expectedPageId, query);
    }
});

test('target assenti, ambigui, nascosti, disabilitati o smontati conservano il testo', () => {
    const guide = createDocumentationGuide(catalog).getPageGuide('impostazioni');
    const step = guide.steps[0];
    const active = { matches: 1, visible: true, enabled: true, connected: true };
    assert.equal(presentGuideStep(guide, step.stepId, active).target, step.target);
    for (const state of [{}, { ...active, matches: 0 }, { ...active, matches: 2 }, { ...active, visible: false },
        { ...active, enabled: false }, { ...active, connected: false }, { ...active, visible: 'true' }]) {
        const result = presentGuideStep(guide, step.stepId, state);
        assert.equal(result.presentation, 'text-only');
        assert.equal(result.target, null);
        assert.equal(result.body, step.body);
    }
    assert.equal(presentGuideStep(guide, 'not-present', active), null);
    const textGuide = createDocumentationGuide(catalog).getPageGuide('index');
    assert.equal(presentGuideStep(textGuide, textGuide.steps[0].stepId, active).presentation, 'text-only');
});

test('schema, riferimenti, chiavi e selettori non validi vengono respinti', () => {
    const changes = [
        value => { value.schemaVersion = 2; },
        value => { value.pages.push(structuredClone(value.pages[0])); },
        value => { value.pages[0].route = 'https://example.test'; },
        value => { value.pages[0].relatedPageIds = ['missing-page']; },
        value => { value.pages[0].steps[0].target = 'body input'; },
        value => { value.pages[0].steps[0].bodyKey = 'guide.not.present'; },
        value => { value.pages[0].tutorialId = 'remote-video'; },
        value => { value.pages[0].userRecord = { title: 'Synthetic user title' }; },
        value => { value.journeys[0].pageIds.push('missing-page'); },
        value => { value.messages.it['guide.unused'] = 'Unused'; }
    ];
    for (const change of changes) {
        const input = freshCatalog();
        change(input);
        assert.throws(() => validateGuideCatalog(input), /^TypeError: GUIDE_/);
    }
});
