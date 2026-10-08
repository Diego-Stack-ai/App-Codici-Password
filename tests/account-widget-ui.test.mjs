import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const widgetSource = await readFile(
  new URL('../Frontend/public/assets/js/modules/shared/account-embedded-widgets.js', import.meta.url),
  'utf8'
);
const sharedCredentialSource = await readFile(
  new URL('../Frontend/public/assets/js/modules/shared/account-shared-credentials.js', import.meta.url),
  'utf8'
);
const privateFormSource = await readFile(
  new URL('../Frontend/public/assets/js/modules/privato/form_account_privato.js', import.meta.url),
  'utf8'
);
const companyFormSource = await readFile(
  new URL('../Frontend/public/assets/js/modules/azienda/form_account_azienda.js', import.meta.url),
  'utf8'
);

test('i widget espongono un comando accessibile per aprire e chiudere i campi', () => {
  assert.match(widgetSource, /className: 'account-widget-toggle'/);
  assert.match(widgetSource, /'aria-expanded': String\(!collapsed\)/);
  assert.match(widgetSource, /fields\.hidden = collapsed/);
  assert.match(widgetSource, /fields\.classList\.toggle\('hidden', collapsed\)/);
});

test('in modifica account i valori sono campi inline e mantengono il tipo originale', () => {
  assert.match(widgetSource, /className: 'account-widget-inline-input'/);
  assert.match(widgetSource, /className: 'account-widget-inline-control'/);
  assert.match(widgetSource, /fieldReaders\.push\(\(\) => \(\{\.\.\.field, value: input\.value\}\)\)/);
  assert.match(widgetSource, /field\.type && field\.type !== 'sensitive' \? field\.type : 'text'/);
});

test('il salvataggio principale attende i widget sia nel form privato sia aziendale', () => {
  for (const source of [privateFormSource, companyFormSource]) {
    assert.match(source, /accountWidgetController = await initAccountEmbeddedWidgets/);
    assert.match(source, /await accountWidgetController\?\.savePendingChanges\(\)/);
  }
});

test('entrambi i form montano anche i widget comuni in modalita modifica', async () => {
  for (const [source, page] of [[privateFormSource, 'form_account_privato.html'], [companyFormSource, 'form_account_azienda.html']]) {
    assert.match(source, /await initAccountSharedCredentials\(\{[\s\S]*?editable: true[\s\S]*?\}\)/);
    const html = await readFile(new URL(`../Frontend/public/${page}`, import.meta.url), 'utf8');
    for (const id of ['shared-credentials-section', 'shared-credentials-list', 'btn-link-shared-credential']) {
      assert.equal(html.split(`id="${id}"`).length - 1, 1, `${page}: contenitore ${id} presente una sola volta`);
    }
  }
});

test('widget esistenti, nuovo widget e credenziali comuni hanno comandi separati', async () => {
  assert.doesNotMatch(widgetSource, /Collega credenziale comune|listSharedVaultDataConfirmed|linkSharedCredential/);
  assert.match(widgetSource, /Widget bancario:/);
  for (const page of ['form_account_privato.html', 'form_account_azienda.html']) {
    const html = await readFile(new URL(`../Frontend/public/${page}`, import.meta.url), 'utf8');
    for (const id of ['account-widget-template-select', 'btn-attach-account-widget', 'btn-add-account-widget', 'btn-link-shared-credential']) {
      assert.equal(html.split(`id="${id}"`).length - 1, 1, `${page}: comando ${id} presente una sola volta`);
    }
    assert.match(html, /Crea nuovo widget/);
    assert.match(html, />Credenziali comuni</);
  }
});

test('il collegamento di una credenziale comune spiega effetti e rimozione prima di procedere', () => {
  assert.match(sharedCredentialSource, /Non ne crea una copia/);
  assert.match(sharedCredentialSource, /tutti gli Account collegati/);
  assert.match(sharedCredentialSource, /non elimina la Credenziale comune/);
  assert.match(sharedCredentialSource, /Salva e continua/);
});
