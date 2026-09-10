import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

async function loadModel() {
  const source = await readFile('Frontend/public/assets/js/modules/data/shared-vault-data-model.js', 'utf8');
  const result = await build({
    stdin: {contents: source, loader: 'js'}, bundle: true, format: 'esm', platform: 'browser', write: false
  });
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

test('cifra i campi sensibili e ne disattiva ogni esposizione', async () => {
  const {prepareSharedVaultData} = await loadModel();
  const result = await prepareSharedVaultData({
    title: 'Codice app Legal Mail',
    fields: [{id: 'app-code', label: 'Codice app', type: 'sensitive', value: 'segreto', includeInQr: true}]
  }, async value => `cipher:${value}`);
  assert.equal(result.fields[0].value, undefined);
  assert.equal(result.fields[0].valueEnc, 'cipher:segreto');
  assert.equal(result.fields[0].preview, false);
  assert.equal(result.fields[0].copyable, false);
  assert.equal(result.fields[0].includeInQr, false);
});

test('conserva i campi normali senza trasformarli in segreti', async () => {
  const {prepareSharedVaultData} = await loadModel();
  const result = await prepareSharedVaultData({
    title: 'Informazioni servizio',
    fields: [{id: 'help-url', label: 'Sito assistenza', type: 'url', value: 'https://example.invalid'}]
  }, async () => assert.fail('la cifratura non deve essere invocata'));
  assert.equal(result.fields[0].value, 'https://example.invalid');
  assert.equal(result.fields[0].encrypted, false);
});

test('rifiuta schede vuote, identificativi duplicati e tipi ignoti', async () => {
  const {prepareSharedVaultData} = await loadModel();
  await assert.rejects(() => prepareSharedVaultData({title: 'Vuota', fields: []}, async value => value));
  await assert.rejects(() => prepareSharedVaultData({title: 'Duplicata', fields: [
    {id: 'x', label: 'Uno', type: 'text'}, {id: 'x', label: 'Due', type: 'text'}
  ]}, async value => value));
  await assert.rejects(() => prepareSharedVaultData({title: 'Tipo', fields: [
    {id: 'x', label: 'Uno', type: 'script'}
  ]}, async value => value));
});

test('genera riferimenti deterministici distinti per contesto', async () => {
  const {createSharedVaultLinkIdentifiers} = await loadModel();
  const privateLink = createSharedVaultLinkIdentifiers('shared-1', 'private', 'account-1');
  const companyLink = createSharedVaultLinkIdentifiers('shared-1', 'company', 'account-1', 'company-1');
  assert.equal(privateLink.linkId, 'link:private:account-1:shared-1');
  assert.equal(companyLink.widgetId, 'shared:company:company-1:account-1:shared-1');
});

test('prepara un solo formato di widget incorporato per Account privato e aziendale', async () => {
  const {prepareEmbeddedAccountWidget} = await loadModel();
  const input = {
    title: 'Domande di sicurezza', order: 2,
    fields: [
      {id: 'question-1', label: 'Domanda', type: 'text', value: 'Nome del primo animale?'},
      {id: 'answer-1', label: 'Risposta', type: 'sensitive', value: 'Lampo'}
    ]
  };
  const encryptValue = async value => `cipher:${value}`;
  const privateWidget = await prepareEmbeddedAccountWidget(
    input, {context: 'private', accountId: 'private-1'}, encryptValue
  );
  const companyWidget = await prepareEmbeddedAccountWidget(
    input, {context: 'company', companyId: 'company-1', accountId: 'company-account-1'}, encryptValue
  );
  assert.equal(privateWidget.kind, 'embedded');
  assert.equal(privateWidget.companyId, undefined);
  assert.equal(companyWidget.companyId, 'company-1');
  assert.equal(companyWidget.fields[1].valueEnc, 'cipher:Lampo');
  assert.equal(companyWidget.fields[1].includeInQr, false);
});

test('rifiuta widget incorporati senza Account o Azienda coerenti', async () => {
  const {prepareEmbeddedAccountWidget} = await loadModel();
  const input = {title: 'Dato', fields: [{id: 'x', label: 'Campo', type: 'text', value: ''}]};
  await assert.rejects(() => prepareEmbeddedAccountWidget(input, {}, async value => value));
  await assert.rejects(() => prepareEmbeddedAccountWidget(
    input, {context: 'company', accountId: 'a1'}, async value => value
  ));
});
