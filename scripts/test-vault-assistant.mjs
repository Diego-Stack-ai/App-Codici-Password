import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
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
const companyRecords = [
    { id: 'company:bm-service', kind: 'azienda', title: 'BM Service', subtitle: 'Azienda', scope: 'azienda', companyName: 'BM Service', href: '/company-bm' },
    ...Array.from({ length: 11 }, (_, index) => ({
        id: `account:bm-${index + 1}`, kind: 'account aziendale', title: `Servizio ${index + 1}`,
        subtitle: 'Azienda: BM Service', scope: 'azienda', companyName: 'BM Service', keywords: ['BM Service'], href: `/bm-${index + 1}`
    }))
];
const contextual = new VaultConversationEngine(companyRecords);
const bmResults = contextual.ask('cerca BM Service');
assert.equal(bmResults.items.length, 12);
assert.doesNotMatch(bmResults.message, /indicare l’azienda/);
assert.match(bmResults.message, /apri il due/);
assert.equal(contextual.ask('apri il due').navigateTo, bmResults.items[1].href);
assert.equal(contextual.ask('apri BM Service').navigateTo, '/company-bm');
assert.equal(contextual.ask("apri l'azienda BM Service").navigateTo, '/company-bm');
conversation.removeRecord('account:company-1');
assert.equal(conversation.ask('banca PaxTibi').items.length, 0);
conversation.clear();
const [loaderSource, uiSource, controllerSource] = await Promise.all([
    readFile(new URL('../Frontend/public/assets/js/modules/assistant/vault-data-loader.js', import.meta.url), 'utf8'),
    readFile(new URL('../Frontend/public/assets/js/modules/assistant/assistant-ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../Frontend/public/assets/js/modules/assistant/assistant-controller.js', import.meta.url), 'utf8')
]);
assert.match(loaderSource, /iconSource: data\.logo \|\| data\.avatar/);
assert.match(loaderSource, /archiveAction:/);
assert.match(loaderSource, /deadlinePresentation\(data\)/);
assert.match(loaderSource, /deadlineDateInputFields\(data\)\.displayValue/);
const loaderContext = vm.createContext({ deadlinePresentation: data => ({
    category: data.type || data.category || data.title || 'Scadenza Generale',
    owner: data.name || 'Intestatario non specificato'
}), deadlineDateInputFields: data => ({ displayValue: data.dueDate === '2027-02-14' ? '14\/02\/2027' : '' }) });
const loaderPreamble = loaderSource.slice(loaderSource.indexOf('const text ='), loaderSource.indexOf('\nfunction profileRecords'));
const deadlineFunction = loaderSource.slice(loaderSource.indexOf('function deadlineRecord'), loaderSource.indexOf('\nexport async function'));
const loaderFunctions = `${loaderPreamble}\n${deadlineFunction}`;
vm.runInContext(`${loaderFunctions}\nglobalThis.deadlineRecord = deadlineRecord;`, loaderContext);
const deadlineResult = loaderContext.deadlineRecord('deadline-fl790', {
    type: 'Revisione', name: 'Diego', veicolo_modello: 'Moto Guzzi', targa: 'FL790', dueDate: '2027-02-14'
});
assert.equal(deadlineResult.title, 'Revisione');
assert.equal(deadlineResult.subtitle, 'Diego · Moto Guzzi FL790 · Scadenza 14/02/2027');
assert.ok(deadlineResult.keywords.includes('FL790'));
assert.match(uiSource, /new SwipeList\(selector/);
assert.match(uiSource, /onSwipeLeft: card => \{ void run\(card, true\); \}/);
assert.match(uiSource, /onSwipeRight: card => \{ void run\(card, false\); \}/);
assert.match(uiSource, /probeMicrophoneAccess\(/);
assert.match(uiSource, /!remoteConsentPending && !submittedFinal/);
assert.match(uiSource, /pendingSpokenAnswer = ask\(transcriptState\.final\)\?\.message \|\| ''/);
assert.match(uiSource, /microphone\.addEventListener\('click', async \(\) => \{[\s\S]*speechSynthesis\?\.prime\(\);[\s\S]*await probeMicrophoneAccess/);
assert.match(uiSource, /recognition\.addEventListener\('end',[\s\S]*speechSynthesis\?\.speakAfterAudioRelease\(message\)/);
assert.doesNotMatch(uiSource, /speechSynthesis\.cancel\(\);[\s\S]{0,200}speechSynthesis\.speak\(/);
assert.doesNotMatch(uiSource, /ask\(transcriptState\.final, true\)/);
assert.match(controllerSource, /archiveAccount\(user\.uid, target\)/);
assert.match(controllerSource, /archiveRecipients\(target\)\.length > 0/);
console.log('Vault assistant search tests: OK');
