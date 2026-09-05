import assert from 'node:assert/strict';
import { normalizeSearchText } from '../Frontend/public/assets/js/modules/assistant/search-normalizer.js';
import { VaultConversationEngine } from '../Frontend/public/assets/js/modules/assistant/conversation-engine.js';

assert.equal(normalizeSearchText(' Moto Guzzi — Califòrnia '), 'moto guzzi california');
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
