import test from 'node:test';
import assert from 'node:assert/strict';
import {
    buildCurrentPageExplanation,
    createA2IntentRequest,
    isCurrentPageExplanationRequest,
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
