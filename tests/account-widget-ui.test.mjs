import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const widgetSource = await readFile(
  new URL('../Frontend/public/assets/js/modules/shared/account-embedded-widgets.js', import.meta.url),
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
});

test('in modifica account i valori sono campi inline e mantengono il tipo originale', () => {
  assert.match(widgetSource, /className: 'account-widget-inline-input'/);
  assert.match(widgetSource, /fieldReaders\.push\(\(\) => \(\{\.\.\.field, value: input\.value\}\)\)/);
  assert.match(widgetSource, /field\.type && field\.type !== 'sensitive' \? field\.type : 'text'/);
});

test('il salvataggio principale attende i widget sia nel form privato sia aziendale', () => {
  for (const source of [privateFormSource, companyFormSource]) {
    assert.match(source, /accountWidgetController = await initAccountEmbeddedWidgets/);
    assert.match(source, /await accountWidgetController\?\.savePendingChanges\(\)/);
  }
});
