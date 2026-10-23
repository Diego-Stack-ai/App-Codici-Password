import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { normalizeSearchText } from '../Frontend/public/assets/js/modules/assistant/search-normalizer.js';
import { VaultConversationEngine } from '../Frontend/public/assets/js/modules/assistant/conversation-engine.js';

assert.equal(normalizeSearchText(' Moto Guzzi — Califòrnia '), 'moto guzzi california');
const conversation = new VaultConversationEngine([
    { id: 'account:company-1', kind: 'account aziendale', title: 'Banca Impresa', subtitle: 'Azienda: Demo Nord', scope: 'azienda', companyName: 'Demo Nord', keywords: ['banca'], href: '/company-bank' },
    { id: 'account:private-1', kind: 'account', title: 'Banca personale', subtitle: 'Account privato', scope: 'privato', keywords: ['banca'], href: '/private-bank' }
]);
const bankAnswer = conversation.ask("Sto cercando una banca dell'azienda Demo Nord");
assert.equal(bankAnswer.items.length, 1);
assert.equal(bankAnswer.items[0].href, '/company-bank');
assert.match(bankAnswer.message, /Demo Nord/);
const spokenBankAnswer = conversation.ask('Sto cercando una banca di Deno Nord');
assert.equal(spokenBankAnswer.items.length, 1);
assert.equal(spokenBankAnswer.items[0].href, '/company-bank');
const openAnswer = conversation.ask('aprimi il primo');
assert.equal(openAnswer.navigateTo, '/company-bank');
const companyRecords = [
    { id: 'company:demo-nord', kind: 'azienda', title: 'Demo Nord', subtitle: 'Azienda', scope: 'azienda', companyName: 'Demo Nord', href: '/company-demo' },
    ...Array.from({ length: 11 }, (_, index) => ({
        id: `account:bm-${index + 1}`, kind: 'account aziendale', title: `Servizio ${index + 1}`,
        subtitle: 'Azienda: Demo Nord', scope: 'azienda', companyName: 'Demo Nord', keywords: ['Demo Nord'], href: `/demo-${index + 1}`
    }))
];
const contextual = new VaultConversationEngine(companyRecords);
const companyResults = contextual.ask('cerca Demo Nord');
assert.equal(companyResults.items.length, 12);
assert.doesNotMatch(companyResults.message, /indicare l’azienda/);
assert.match(companyResults.message, /apri il due/);
assert.equal(contextual.ask('apri il due').navigateTo, companyResults.items[1].href);
assert.equal(contextual.ask('apre undicesimo').navigateTo, companyResults.items[10].href);
const misunderstood = contextual.ask('apri quello giusto');
assert.match(misunderstood.message, /Non ho riconosciuto/);
assert.equal(contextual.ask('apri il secondo').navigateTo, companyResults.items[1].href);
assert.equal(contextual.ask('apri Demo Nord').navigateTo, '/company-demo');
assert.equal(contextual.ask("apri l'azienda Demo Nord").navigateTo, '/company-demo');
conversation.removeRecord('account:company-1');
assert.equal(conversation.ask('banca Demo Nord').items.length, 0);
conversation.clear();
const natural = new VaultConversationEngine([
    { id:'deadline:insurance', kind:'scadenza', title:'Assicurazione', subtitle:'Peugeot e-208 · Scadenza 31/03/2027',
        keywords:['polizza', 'auto', 'GM277DC'], href:'/deadline-insurance' },
    { id:'deadline:tax', kind:'scadenza', title:'Bollo', subtitle:'Peugeot e-208 · Scadenza 31/12/2027',
        keywords:['auto', 'GM277DC'], href:'/deadline-tax' }
]);
const naturalDeadline = natural.ask('quando scade la polizza della macchina Peugeut');
assert.equal(naturalDeadline.items.length, 1);
assert.equal(naturalDeadline.items[0].href, '/deadline-insurance');
assert.equal(natural.executeIntent({type:'semantic_search', query:'bollo Peugeot'}, '').items[0].href, '/deadline-tax');
assert.equal(natural.executeIntent({type:'select_result', resultOrdinal:1}, '').navigateTo, '/deadline-tax');
assert.match(natural.executeIntent({type:'clarify', query:'Quale veicolo intendi?'}, '').message, /Quale veicolo/);
assert.doesNotMatch(natural.executeIntent({type:'delete_record', query:'elimina tutto'}, '').message, /elimina tutto/);
const [loaderSource, uiSource, controllerSource, guideSource, localAiSource] = await Promise.all([
    readFile(new URL('../Frontend/public/assets/js/modules/assistant/vault-data-loader.js', import.meta.url), 'utf8'),
    readFile(new URL('../Frontend/public/assets/js/modules/assistant/assistant-ui.js', import.meta.url), 'utf8'),
    readFile(new URL('../Frontend/public/assets/js/modules/assistant/assistant-controller.js', import.meta.url), 'utf8'),
    readFile(new URL('../Frontend/public/assets/js/guide.js', import.meta.url), 'utf8'),
    readFile(new URL('../Frontend/public/assets/js/modules/assistant/local-ai-assistant-service.js', import.meta.url), 'utf8')
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
const deadlineResult = loaderContext.deadlineRecord('deadline-zz000zz', {
    type: 'Revisione', name: 'Utente Demo', veicolo_modello: 'Veicolo demo', targa: 'ZZ000ZZ', dueDate: '2027-02-14'
});
assert.equal(deadlineResult.title, 'Revisione');
assert.equal(deadlineResult.subtitle, 'Utente Demo · Veicolo demo ZZ000ZZ · Scadenza 14/02/2027');
assert.ok(deadlineResult.keywords.includes('ZZ000ZZ'));
assert.ok(deadlineResult.keywords.includes('14/02/2027'));
assert.match(uiSource, /new SwipeList\(selector/);
assert.match(uiSource, /onSwipeLeft: card => \{ void run\(card\); \}/);
assert.match(uiSource, /onSwipeRight: card => \{ void run\(card\); \}/);
assert.match(uiSource, /probeMicrophoneAccess\(/);
assert.match(uiSource, /!remoteConsentPending && !submittedFinal/);
assert.match(uiSource, /pendingSpokenAnswer = Promise\.resolve\(ask\(transcriptState\.final\)\)/);
assert.match(uiSource, /microphone\.disabled = !usable \|\| !SpeechRecognition/);
assert.match(uiSource, /const vaultAnswer = onAsk\(value\);[\s\S]*vaultAnswer\?\.items\?\.length/);
assert.doesNotMatch(uiSource, /Ciao\. Dimmi cosa stai cercando/);
assert.match(uiSource, /vault-assistant-mode[^\n]*Cerca/);
assert.match(uiSource, /vault-assistant-help/);
assert.match(uiSource, /Account, aziende, documenti e scadenze/);
assert.match(uiSource, /if \(!supportsLocalRecognition\) \{ beginRecognition\(false\); return; \}/);
assert.match(uiSource, /microphone\.addEventListener\('click', async \(\) => \{[\s\S]*speechSynthesis\?\.prime\(\);[\s\S]*await probeMicrophoneAccess/);
assert.match(uiSource, /recognition\.addEventListener\('end',[\s\S]*speechSynthesis\?\.speakAfterAudioRelease\(message\)/);
assert.doesNotMatch(uiSource, /speechSynthesis\.cancel\(\);[\s\S]{0,200}speechSynthesis\.speak\(/);
assert.doesNotMatch(uiSource, /ask\(transcriptState\.final, true\)/);
assert.match(controllerSource, /archiveAccount\(user\.uid, target\)/);
assert.match(controllerSource, /if \(!await showConfirmModal\(t\('confirm_archive_title'\), archiveConfirmMessage\(target, t\)\)\) return false/);
assert.doesNotMatch(controllerSource, /mustConfirm|requireConfirmation/);
assert.match(controllerSource, /conversation\.executeIntent\(intent, query\)/);
assert.match(localAiSource, /Vietate scritture, modifiche, eliminazioni/);
assert.match(localAiSource, /return intent;/);
assert.match(guideSource, /getElementById\('footer-center-actions'\)/);
assert.match(guideSource, /documentation-button-footer/);
console.log('Vault assistant search tests: OK');
