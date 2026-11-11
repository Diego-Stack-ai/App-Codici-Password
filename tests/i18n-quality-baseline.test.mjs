import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildI18nInventory, evaluateI18nBaseline } from '../scripts/audit-i18n-quality.mjs';

test('l’inventario i18n non peggiora rispetto alla baseline integrata 1.2.190', () => {
  const inventory = buildI18nInventory();
  const { regressions } = evaluateI18nBaseline(inventory);
  assert.deepEqual(regressions, []);
});

test('l’inventario copre markup, attributi, chiamate t e sink UI dinamici', () => {
  const inventory = buildI18nInventory();
  assert.ok(inventory.usedKeys.count > 0);
  assert.ok(Object.keys(inventory.html.pages).length >= 30);
  assert.ok(inventory.html.literals.every(item => item.kind !== 'aria-label'));
  assert.ok(inventory.javascript.literalSinks.some(item => item.kind === 'toast'));
  assert.deepEqual(inventory.declaredLanguages, ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt']);
});

test('una lingua potrà essere dichiarata completa soltanto con parità delle chiavi', () => {
  const inventory = buildI18nInventory();
  for (const language of inventory.completeLanguages) {
    assert.deepEqual(inventory.missingKeysByLanguage[language], []);
  }
});

test('il catalogo italiano è completo e non può tornare a mostrare chiavi tecniche', () => {
  const inventory = buildI18nInventory();
  assert.ok(inventory.completeLanguages.includes('it'));
  assert.deepEqual(inventory.missingKeysByLanguage.it, []);
});

test('il catalogo inglese è completo e non può ricadere su testi italiani', () => {
    const inventory = buildI18nInventory();
  assert.ok(inventory.completeLanguages.includes('en'));
  assert.deepEqual(inventory.missingKeysByLanguage.en, []);
});

test('i pannelli Supporto delle Impostazioni non mescolano diagnostica, notifiche o lingue', async () => {
  const languages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
  const catalogSource = await readFile(new URL('../Frontend/public/assets/js/translations/settings.js', import.meta.url), 'utf8');
  const { settingsCatalogs } = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
  const expectedKeys = ['settings_app_version_label', 'settings_privacy_summary', 'settings_terms_summary'];
  for (const language of languages) {
    for (const key of expectedKeys) {
      assert.ok(settingsCatalogs[language][key]?.trim(), `${language}.${key} mancante`);
    }
  }

  const settingsSource = await readFile(new URL('../Frontend/public/assets/js/modules/settings/impostazioni.js', import.meta.url), 'utf8');
  for (const key of expectedKeys) assert.match(settingsSource, new RegExp(`t\\('${key}'\\)`));
  assert.match(settingsSource, /Codex Security System/);
  assert.match(settingsSource, /APP_VERSION/);
  assert.doesNotMatch(settingsSource, /RESET NOTIFICHE COMPLETATO/);
  assert.doesNotMatch(settingsSource, /Notifiche Push e Email sospese/);
  assert.doesNotMatch(settingsSource, /Termini e Condizioni invariati/);
});

test('le etichette condivise dal Profilo non restano confinate al catalogo Impostazioni', async () => {
  const languages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
  for (const language of languages) {
    const source = await readFile(new URL(`../Frontend/public/assets/js/translations/${language}.js`, import.meta.url), 'utf8');
    assert.match(source, /["']?click_to_enlarge["']?\s*:/, `click_to_enlarge assente dal catalogo base ${language}`);
  }
  const settings = await readFile(new URL('../Frontend/public/assets/js/translations/settings.js', import.meta.url), 'utf8');
  assert.doesNotMatch(settings, /["']?click_to_enlarge["']?\s*:/);
});

test('i contenuti dinamici dei Profili hanno un catalogo completo in tutte le lingue', async () => {
  const languages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
  const profileSource = await readFile(new URL('../Frontend/public/assets/js/translations/profile.js', import.meta.url), 'utf8');
  const { profileCatalogs } = await import(`data:text/javascript;base64,${Buffer.from(profileSource).toString('base64')}`);
  const expectedKeys = Object.keys(profileCatalogs.it).sort();
  assert.equal(expectedKeys.length, 51);
  for (const language of languages) {
    assert.deepEqual(Object.keys(profileCatalogs[language]).sort(), expectedKeys, `catalogo Profilo incompleto: ${language}`);
    for (const key of ['common_show_hide_field', 'company_open_named_account', 'company_attachments_open',
      'digital_card_capacity_warning', 'digital_card_capacity_used']) {
      assert.match(profileCatalogs[language][key], /\{(?:label|name|count|bytes)\}/);
    }
  }
  const loader = await readFile(new URL('../Frontend/public/assets/js/translations.js', import.meta.url), 'utf8');
  assert.match(loader, /profilo_privato\|dati_azienda/);
  assert.match(loader, /translations\/profile\.js/);
});

test('la Gestione destinatari ha un catalogo completo e mantiene i segnaposto in tutte le lingue', async () => {
  const languages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
  const recipientSource = await readFile(new URL('../Frontend/public/assets/js/translations/recipients.js', import.meta.url), 'utf8');
  const { recipientCatalogs } = await import(`data:text/javascript;base64,${Buffer.from(recipientSource).toString('base64')}`);
  const expectedKeys = Object.keys(recipientCatalogs.it).sort();
  assert.equal(expectedKeys.length, 44);
  for (const language of languages) {
    assert.deepEqual(Object.keys(recipientCatalogs[language]).sort(), expectedKeys, `catalogo Destinatari incompleto: ${language}`);
    const placeholders = {
      recipient_usage_deadlines: '{count}',
      recipient_usage_account_shares: '{count}',
      recipient_usage_invites: '{count}',
      recipient_delete_message: '{name}',
      recipient_delete_blocked: '{usage}',
      recipient_companies: '{companies}',
      recipient_remove_links_message: '{companies}'
    };
    for (const [key, placeholder] of Object.entries(placeholders)) {
      assert.ok(recipientCatalogs[language][key].includes(placeholder), `${language}.${key} non conserva ${placeholder}`);
    }
  }
  const loader = await readFile(new URL('../Frontend/public/assets/js/translations.js', import.meta.url), 'utf8');
  assert.match(loader, /gestione_destinatari/);
  assert.match(loader, /translations\/recipients\.js/);
});

test('assistenza 2FA usa il registro formale tedesco e portoghese nelle otto lingue complete', async () => {
  const load = async name => import(`data:text/javascript;base64,${Buffer.from(await readFile(new URL(`../Frontend/public/assets/js/translations/${name}.js`, import.meta.url), 'utf8')).toString('base64')}`);
  const {accessCatalogs} = await load('access');
  const {settingsCatalogs} = await load('settings');
  for (const lang of ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt']) {
    assert.ok(settingsCatalogs[lang].settings_recovery_codes_help?.trim(), lang);
    assert.ok(settingsCatalogs[lang].settings_recovery_codes_desc?.trim(), lang);
  }
  assert.match(accessCatalogs.de.auth_recovery_help, /Wenn Sie/);
  assert.doesNotMatch(accessCatalogs.de.auth_recovery_help, /\b(?:du|deine|hast|kontaktiere|sende)\b/);
  assert.match(settingsCatalogs.de.settings_recovery_codes_help, /Sie/);
  assert.doesNotMatch(accessCatalogs.pt.auth_recovery_help, /\b(?:consegues|contacta|envies)\b/);
});

test('le pagine di accesso e il contatto condiviso hanno un catalogo completo in tutte le lingue', async () => {
  const languages = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
  const accessSource = await readFile(new URL('../Frontend/public/assets/js/translations/access.js', import.meta.url), 'utf8');
  const { accessCatalogs } = await import(`data:text/javascript;base64,${Buffer.from(accessSource).toString('base64')}`);
  const expectedKeys = Object.keys(accessCatalogs.it).sort();
  // The obsolete recovery-code label and automatic-success promise were retired.
  assert.equal(expectedKeys.length, 57);
  assert.ok(!expectedKeys.includes('auth_recovery_success'));
  assert.ok(!expectedKeys.includes('auth_recovery_label'));
  assert.ok(expectedKeys.includes('auth_recovery_help'));
  for (const language of languages) {
    assert.deepEqual(Object.keys(accessCatalogs[language]).sort(), expectedKeys, `catalogo Accesso incompleto: ${language}`);
    assert.ok(accessCatalogs[language].auth_wait_seconds.includes('{seconds}'));
  }
  const loader = await readFile(new URL('../Frontend/public/assets/js/translations.js', import.meta.url), 'utf8');
  assert.match(loader, /login\|registrati\|reset_password\|imposta_nuova_password\|contatto_condiviso/);
  assert.match(loader, /translations\/access\.js/);
});

test('la baseline conserva lo storico del delta Archivio senza nasconderlo', () => {
  const { baseline } = evaluateI18nBaseline(buildI18nInventory());
  assert.equal(baseline.sourceVersion, '1.2.197');
  assert.equal(
    baseline.previousBaseline.htmlLiteralSegments + baseline.acceptedBaseDelta.htmlLiteralSegments,
    baseline.debt.htmlLiteralSegments
  );
  assert.equal(
    baseline.previousBaseline.jsLiteralSinks + baseline.acceptedBaseDelta.jsLiteralSinks,
    baseline.debt.jsLiteralSinks
  );
});
