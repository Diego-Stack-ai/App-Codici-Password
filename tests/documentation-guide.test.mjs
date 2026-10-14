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
    for (const route of ['prova', '/prova.html', '../home_page.html', '//home_page.html', 'https://example.test/home_page.html', 'javascript:home_page.html', '/unknown.html']) {
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
    assert.throws(() => { result.relatedPageIds.push('prova'); }, TypeError);
    assert.throws(() => { service.listJourneys()[0].pageIds.push('prova'); }, TypeError);
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
        value => { value.pages[0].relatedPageIds = ['prova']; },
        value => { value.pages[0].steps[0].target = 'body input'; },
        value => { value.pages[0].steps[0].bodyKey = 'guide.not.present'; },
        value => { value.pages[0].tutorialId = 'remote-video'; },
        value => { value.pages[0].userRecord = { title: 'Synthetic user title' }; },
        value => { value.journeys[0].pageIds.push('prova'); },
        value => { value.messages.it['guide.unused'] = 'Unused'; }
    ];
    for (const change of changes) {
        const input = freshCatalog();
        change(input);
        assert.throws(() => validateGuideCatalog(input), /^TypeError: GUIDE_/);
    }
});
