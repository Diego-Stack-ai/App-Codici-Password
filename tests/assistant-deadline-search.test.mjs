import test from 'node:test';
import assert from 'node:assert/strict';
import { VaultConversationEngine } from '../Frontend/public/assets/js/modules/assistant/conversation-engine.js';

test('una frase naturale trova una scadenza tramite il solo anno', () => {
    const engine = new VaultConversationEngine([{
        id: 'scadenza:fixture',
        kind: 'scadenza',
        title: 'Rinnovo sintetico',
        subtitle: 'Scadenza 24/10/2035',
        scope: 'privato',
        companyName: '',
        keywords: ['scadenza', '24/10/2035'],
        href: '/dettaglio_scadenza.html?id=fixture'
    }]);
    const result = engine.ask('Sto cercando una scadenza del 2035 ma non la trovo');
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0].id, 'scadenza:fixture');
});

test('una domanda di memoria successiva conserva scadenza e anno come soli criteri utili', () => {
    const engine = new VaultConversationEngine([
        {
            id: 'account:fixture', kind: 'account', title: 'Profilo sintetico', subtitle: 'Privato',
            scope: 'privato', companyName: '', keywords: ['utente'], href: '/dettaglio_account_privato.html?id=fixture'
        },
        {
            id: 'scadenza:2029', kind: 'scadenza', title: 'Documento sintetico', subtitle: 'Scadenza 28/02/2029',
            scope: 'privato', companyName: '', keywords: ['scadenza', '28/02/2029'], href: '/dettaglio_scadenza.html?id=2029'
        }
    ]);
    engine.ask('cerca profilo sintetico');
    const result = engine.ask('stavo cercando una scadenza del 2029 ma non mi ricordo cosa');
    assert.deepEqual(result.items.map(item => item.id), ['scadenza:2029']);
});

test('AI.1 spiega la pagina corrente dal catalogo pubblico senza interrogare i record', () => {
    const page = {
        title:'Home',
        purpose:'Scegli l’area in cui lavorare.',
        steps:[{ stepId:'step-1', body:'Dal footer puoi aprire Nuova Scadenza e Impostazioni.' }]
    };
    const engine = new VaultConversationEngine([], { pageKnowledge:{ page, related:[] } });
    const result = engine.ask('A cosa serve questa pagina?');
    assert.match(result.message, /Scegli l’area/);
    assert.match(result.message, /Nuova Scadenza/);
    assert.deepEqual(result.items, []);
});

test('AI.1 instrada le domande operative verso la guida senza mescolarle ai record della vault', () => {
    const engine = new VaultConversationEngine([{
        id:'scadenza:fixture', kind:'scadenza', title:'Assicurazione', subtitle:'Scadenza 31/03/2027',
        scope:'privato', companyName:'', keywords:['scadenza'], href:'/dettaglio_scadenza.html?id=fixture'
    }], {
        searchKnowledge:query => query.includes('scadenza') ? [{
            pageId:'aggiungi_scadenza', route:'/aggiungi_scadenza.html', title:'Crea o modifica scadenza',
            purpose:'Crea o modifica una scadenza.', steps:['Scegli ambito e regola.'], score:60
        }] : []
    });
    const result = engine.ask('Come creare una nuova scadenza?');
    assert.equal(result.items[0].id, 'guide:aggiungi_scadenza');
    assert.equal(result.items[0].kind, 'guida');
    assert.doesNotMatch(result.message, /Assicurazione/);
});
