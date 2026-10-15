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
