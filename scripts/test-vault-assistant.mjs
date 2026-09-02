import assert from 'node:assert/strict';
import { normalizeSearchText, queryTokens } from '../Frontend/public/assets/js/modules/assistant/search-normalizer.js';
import { VaultSearchIndex } from '../Frontend/public/assets/js/modules/assistant/vault-search-index.js';
import { VaultConversationEngine } from '../Frontend/public/assets/js/modules/assistant/conversation-engine.js';

assert.equal(normalizeSearchText(' Moto Guzzi — Califòrnia '), 'moto guzzi california');
assert.ok(queryTokens('CI Diego').includes('identita'));
const index = new VaultSearchIndex();
index.replace([
    { id: 'documento:1', kind: 'documento', title: "Carta d'identità", subtitle: 'Diego Rossi', keywords: ['documento'], href: '/profilo_privato.html' },
    { id: 'azienda:1', kind: 'azienda', title: 'Immobiliare PaxTB', subtitle: 'Azienda', keywords: ['societa'], href: '/dettaglio_azienda.html?id=1' },
    { id: 'account:1', kind: 'account', title: 'Poste Business', subtitle: 'Account privato', keywords: ['banca'], href: '/dettaglio_account_privato.html?id=1' }
]);
assert.equal(index.search('carta identita Diego')[0]?.id, 'documento:1');
assert.equal(index.search('immobiliare pax')[0]?.id, 'azienda:1');
assert.equal(index.search('banca business poste')[0]?.id, 'account:1');
assert.equal(index.search('inesistente').length, 0);
assert.equal(index.search('password segreta').length, 0);
assert.equal(index.size, 3);
index.clear();
assert.equal(index.size, 0);
assert.equal(index.search('Diego').length, 0);
const conversation = new VaultConversationEngine([
    { id: 'account:company-1', kind: 'account aziendale', title: 'Banca Impresa', subtitle: 'Azienda: PaxTibi', scope: 'azienda', companyName: 'PaxTibi', keywords: ['banca'], href: '/company-bank' },
    { id: 'account:private-1', kind: 'account', title: 'Banca personale', subtitle: 'Account privato', scope: 'privato', keywords: ['banca'], href: '/private-bank' }
]);
const bankAnswer = conversation.ask("Sto cercando una banca dell'azienda PaxTibi");
assert.equal(bankAnswer.items.length, 1);
assert.equal(bankAnswer.items[0].href, '/company-bank');
assert.match(bankAnswer.message, /PaxTibi/);
const spokenBankAnswer = conversation.ask('Sto cercando una banca di Pack Tibi');
assert.equal(spokenBankAnswer.items.length, 1);
assert.equal(spokenBankAnswer.items[0].href, '/company-bank');
const openAnswer = conversation.ask('aprimi il primo');
assert.equal(openAnswer.navigateTo, '/company-bank');
conversation.clear();
console.log('Vault assistant search tests: OK');
