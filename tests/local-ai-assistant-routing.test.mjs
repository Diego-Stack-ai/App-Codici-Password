import test from 'node:test';
import assert from 'node:assert/strict';
import {
    completeWithinBudget,
    createA2ChatRequest,
    isFatalA2RuntimeError,
    normalizeA2Answer,
    requiresA2RuntimeRecycle
} from '../Frontend/public/assets/js/modules/assistant/local-ai-assistant-service.js';
import { VaultConversationEngine } from '../Frontend/public/assets/js/modules/assistant/conversation-engine.js';

const guide = Object.freeze({
    pageId:'impostazioni',
    title:'Impostazioni',
    purpose:'Configura preferenze, sicurezza, notifiche, backup e assistente locale.',
    steps:Object.freeze([
        Object.freeze({ body:'Scegli tema e lingua.' }),
        Object.freeze({ body:'Gestisci sicurezza e notifiche.' })
    ])
});

test('AI.2 riceve una conversazione autonoma e non un intento per la Ricerca', () => {
    const request = createA2ChatRequest({
        question:'Qual è la differenza tra backup e archivio?',
        guide,
        history:[{ role:'assistant', content:'Posso spiegarti le funzioni della pagina.' }]
    });
    assert.match(request.messages[0].content, /Sei separato dalla funzione Ricerca/i);
    assert.match(request.messages[0].content, /non affermare di avere cercato/i);
    assert.match(request.messages[0].content, /Configura preferenze/);
    assert.equal(request.messages.at(-1).content, 'Qual è la differenza tra backup e archivio?');
    assert.equal(request.options.temperature, 0.2);
    assert.doesNotMatch(request.messages[0].content, /semantic_search|select_result/);
});

test('AI.2 riceve solo un contesto D0 limitato di pagine correlate verificate', () => {
    const request = createA2ChatRequest({
        question:'Come creo una scadenza?',
        guide:{
            page:guide,
            related:[{
                pageId:'aggiungi_scadenza',
                title:'Crea o modifica scadenza',
                purpose:'Crea o modifica una scadenza partendo da una regola verificata.',
                route:'/aggiungi_scadenza.html',
                steps:['Dato non necessario nel riepilogo correlato.']
            }]
        }
    });
    const system = request.messages[0].content;
    assert.match(system, /Pagine correlate verificate/);
    assert.match(system, /Crea o modifica scadenza/);
    assert.doesNotMatch(system, /Dato non necessario|pageId|aggiungi_scadenza\.html/);
});

test('la cronologia AI.2 è limitata e non acquisisce oggetti della vault', () => {
    const history = Array.from({ length:20 }, (_, index) => ({
        role:index % 2 ? 'assistant' : 'user', content:`Messaggio ${index}`
    }));
    const request = createA2ChatRequest({ question:'Continua', guide, history });
    assert.equal(request.messages.length, 14);
    assert.equal(request.messages[1].content, 'Messaggio 8');
    assert.equal(request.messages.at(-1).content, 'Continua');
});

test('la risposta AI.2 usa il testo generato senza trasformarlo in una ricerca', () => {
    assert.equal(normalizeA2Answer({ choices:[{ message:{ content:' Risposta locale. ' } }] }), 'Risposta locale.');
    assert.throws(() => normalizeA2Answer({ choices:[] }), /LOCAL_AI_RESPONSE_EMPTY/);
});

test('una generazione bloccata viene interrotta entro il budget senza classificare il timeout come guasto fatale', async () => {
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
    assert.equal(isFatalA2RuntimeError({ code:'LOCAL_AI_GENERATION_TIMEOUT' }), false);
});

test('solo i guasti strutturali fanno rimuovere il runtime condiviso', () => {
    assert.equal(isFatalA2RuntimeError({ code:'LOCAL_AI_GPU_DEVICE_LOST' }), true);
    assert.equal(isFatalA2RuntimeError({ code:'LOCAL_AI_WASM_RUNTIME_FAILED' }), true);
    assert.equal(isFatalA2RuntimeError({ code:'LOCAL_AI_RESPONSE_EMPTY' }), false);
    assert.equal(requiresA2RuntimeRecycle({ code:'LOCAL_AI_GENERATION_TIMEOUT' }), true);
    assert.equal(requiresA2RuntimeRecycle({ code:'LOCAL_AI_RUNTIME_INTERRUPTED' }), true);
    assert.equal(requiresA2RuntimeRecycle({ code:'LOCAL_AI_RESPONSE_EMPTY' }), false);
});

test('la Ricerca deterministica resta indipendente da AI.2', () => {
    const conversation = new VaultConversationEngine([
        { id:'deadline:1', kind:'scadenza', title:'Assicurazione', subtitle:'Peugeot · Scadenza 31/03/2027', scope:'privato', href:'/deadline-1' },
        { id:'account:1', kind:'account', title:'Microsoft', subtitle:'Account privato', scope:'privato', href:'/account-1' }
    ]);
    const answer = conversation.ask('Quali sono le prossime scadenze?');
    assert.equal(answer.items.length, 1);
    assert.equal(answer.items[0].id, 'deadline:1');
});
