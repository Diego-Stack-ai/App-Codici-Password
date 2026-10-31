import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCurrentPageExplanation,
    completeWithinBudget,
    createA2IntentRequest,
    createDeterministicA2Intent,
    isCurrentPageExplanationRequest,
    normalizeA2IntentCandidate,
    parseA2IntentContent,
    stabilizeA2Intent
} from '../Frontend/public/assets/js/modules/assistant/local-ai-assistant-service.js';
import { VaultConversationEngine } from '../Frontend/public/assets/js/modules/assistant/conversation-engine.js';

const guide = Object.freeze({
    pageId:'impostazioni',
    purpose:'Configura preferenze, sicurezza, notifiche, backup e assistente locale.',
    steps:Object.freeze([
        Object.freeze({ body:'Scegli tema e lingua.' }),
        Object.freeze({ body:'Gestisci sicurezza e notifiche.' })
    ])
});
const envelope = Object.freeze({
    schemaVersion:1,
    level:'A2',
    locale:'it-IT',
    page:Object.freeze({ pageId:'impostazioni', purpose:guide.purpose }),
    question:'Spiegami questa pagina',
    turns:Object.freeze([]),
    shortlist:Object.freeze([])
});
const semanticIntent = Object.freeze({
    schemaVersion:1,
    type:'semantic_search',
    query:'questa pagina',
    pageId:null,
    resultOrdinal:null,
    confidence:0.6,
    requiresConfirmation:false
});

test('il prompt AI.2 non suggerisce semantic_search come intento predefinito', () => {
    const request = createA2IntentRequest({ question:envelope.question, envelope, guide });
    assert.match(request.messages[0].content, /non usare semantic_search come valore predefinito/i);
    assert.match(request.messages[0].content, /“Spiegami questa pagina” => explain_page/);
    assert.match(request.messages[0].content, /“Quali sono le prossime scadenze\?” => semantic_search con query “scadenze”/);
    assert.equal(request.options.temperature, 0);
});

test('la richiesta esplicita sulla pagina viene stabilizzata anche se il modello sceglie ricerca', () => {
    assert.equal(isCurrentPageExplanationRequest('Spiegami questa pagina e dimmi a cosa serve.'), true);
    const intent = stabilizeA2Intent({ intent:semanticIntent, question:'Spiegami questa pagina e dimmi a cosa serve.', guide });
    assert.equal(intent.type, 'explain_page');
    assert.equal(intent.pageId, 'impostazioni');
    assert.match(intent.query, /Configura preferenze/);
    assert.match(intent.query, /• Scegli tema e lingua/);
});

test('un saluto non viene trasformato in una ricerca vuota', () => {
    const intent = stabilizeA2Intent({ intent:semanticIntent, question:'Ciao', guide });
    assert.equal(intent.type, 'clarify');
    assert.match(intent.query, /Posso spiegarti questa pagina/);
});

test('una selezione inventata dal modello viene bloccata senza un comando ordinale', () => {
    const inventedSelection = {
        ...semanticIntent,
        type:'select_result',
        resultOrdinal:2,
        confidence:0.95
    };
    const intent = stabilizeA2Intent({ intent:inventedSelection, question:'Che cosa posso chiederti?', guide });
    assert.equal(intent.type, 'clarify');
    assert.equal(intent.resultOrdinal, null);
    assert.match(intent.query, /Non hai indicato un risultato da aprire/);
});

test('una selezione esplicita resta consentita', () => {
    const selection = {
        ...semanticIntent,
        type:'select_result',
        resultOrdinal:2,
        confidence:0.95
    };
    const intent = stabilizeA2Intent({ intent:selection, question:'Apri il secondo', guide });
    assert.equal(intent.type, 'select_result');
    assert.equal(intent.resultOrdinal, 2);
});

test('la ricerca naturale delle prossime scadenze ignora i modificatori temporali', () => {
    const conversation = new VaultConversationEngine([
        { id:'deadline:1', kind:'scadenza', title:'Assicurazione', subtitle:'Peugeot · Scadenza 31/03/2027', scope:'privato', href:'/deadline-1' },
        { id:'account:1', kind:'account', title:'Microsoft', subtitle:'Account privato', scope:'privato', href:'/account-1' }
    ]);
    const answer = conversation.ask('Quali sono le prossime scadenze?');
    assert.equal(answer.items.length, 1);
    assert.equal(answer.items[0].id, 'deadline:1');
});

test('la spiegazione verificata usa solo scopo e passaggi della guida', () => {
    assert.equal(buildCurrentPageExplanation(guide), [
        guide.purpose,
        '• Scegli tema e lingua.',
        '• Gestisci sicurezza e notifiche.'
    ].join('\n'));
});

test('la spiegazione verificata rispetta la richiesta di una sola frase', () => {
    assert.equal(buildCurrentPageExplanation(guide, 'Rispondi in una sola frase.'), guide.purpose);
    assert.doesNotMatch(buildCurrentPageExplanation(guide, 'Rispondi in una sola frase.'), /•/);
});

test('una generazione bloccata viene interrotta entro il budget', async () => {
    let interrupted = false;
    const runtime = {
        complete:() => new Promise(() => {}),
        interrupt:async () => { interrupted = true; }
    };
    await assert.rejects(
        completeWithinBudget(runtime, [], {}, 5),
        error => error.code === 'LOCAL_AI_GENERATION_TIMEOUT' && error.stage === 'generation'
    );
    assert.equal(interrupted, true);
});

test('il JSON AI.2 viene estratto e poi validato senza GrammarMatcher WebLLM', () => {
    const parsed = parseA2IntentContent('```json\n{"type":"clarify"}\n```');
    assert.deepEqual(parsed, { type:'clarify' });
    assert.throws(() => parseA2IntentContent('nessun oggetto'), /LOCAL_AI_RESPONSE_INVALID/);
});

test('i campi tecnici omessi dal modello vengono completati prima della validazione', () => {
    assert.deepEqual(normalizeA2IntentCandidate({ type:'semantic_search', query:'assicurazione' }), {
        schemaVersion:1,
        type:'semantic_search',
        query:'assicurazione',
        pageId:null,
        resultOrdinal:null,
        confidence:0.5,
        requiresConfirmation:false
    });
});

test('un intento italianizzato dal modello viene ricondotto al contratto locale', () => {
    assert.equal(normalizeA2IntentCandidate({ intento:'explain_page', query:'Guida.' }).type, 'explain_page');
});

test('le operazioni affidabili vengono risolte senza avviare il modello generativo', () => {
    assert.equal(createDeterministicA2Intent('Trova le scadnze dell assicurazione', guide).type, 'semantic_search');
    assert.equal(createDeterministicA2Intent('Apri il secondo', guide).resultOrdinal, 2);
    assert.equal(createDeterministicA2Intent('A cosa serve questa pagina?', guide).type, 'explain_page');
    assert.equal(createDeterministicA2Intent('Ciao', guide).type, 'clarify');
    assert.equal(createDeterministicA2Intent('Qual è la differenza tra backup e archivio?', guide), null);
});

test('ricerca con refusi e selezione ordinale non dipendono dal JSON del modello', () => {
    const search = stabilizeA2Intent({
        intent:{ intento:'clarify', query:'scadenze' },
        question:'Trova le scadnze dell assicuraizone e dimmi quante sono.',
        guide
    });
    assert.equal(search.type, 'semantic_search');
    assert.match(search.query, /scadnze/);
    assert.match(search.query, /assicuraizone/);
    const selection = stabilizeA2Intent({
        intent:{ intento:'clarify' },
        question:'Apri il secondo',
        guide
    });
    assert.equal(selection.type, 'select_result');
    assert.equal(selection.resultOrdinal, 2);
});
