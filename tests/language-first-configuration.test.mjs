import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

async function loadFunctions(path, names, globals = {}) {
    let source = await readFile(path, 'utf8');
    source = source.replace(/^import .*$/gm, '').replace(/export\s+(?=(?:async\s+)?(?:const|function|class))/g, '');
    const context = vm.createContext({ console, Date, ...globals });
    return vm.runInContext(`(() => { ${source}; return {${names.join(',')}}; })()`, context);
}

test('preferenza lingua normalizza codici, distingue scelta esplicita e ricorda ogni UID', async () => {
    const values = new Map();
    const localStorage = {
        getItem: key => values.has(key) ? values.get(key) : null,
        setItem: (key, value) => values.set(key, String(value)),
        removeItem: key => values.delete(key)
    };
    const document = { documentElement: { lang: '', dir: '' } };
    const api = await loadFunctions(
        'Frontend/public/assets/js/modules/settings/first-configuration.js',
        ['normalizeLanguage', 'hasExplicitLanguageChoice', 'setLanguagePreference', 'resolveLanguage', 'rememberUserLanguage'],
        { window: { localStorage }, localStorage, navigator: { languages: ['fr-FR'], language: 'fr-FR' }, document }
    );
    assert.equal(api.normalizeLanguage('EN-us'), 'en');
    assert.equal(api.resolveLanguage(), 'fr');
    assert.equal(api.hasExplicitLanguageChoice(), false);
    api.setLanguagePreference('es', { explicit: true, uid: 'u1' });
    assert.equal(api.hasExplicitLanguageChoice(), true);
    assert.equal(api.resolveLanguage({ uid: 'u1' }), 'es');
    assert.equal(document.documentElement.lang, 'es');
    assert.equal(api.rememberUserLanguage('u2', { settings: { language: 'de' } }), 'de');
    assert.equal(api.resolveLanguage({ uid: 'u2' }), 'de');
});

test('prima configurazione separa un solo requisito obbligatorio dalle opzioni facoltative', async () => {
    const api = await loadFunctions(
        'Frontend/public/assets/js/modules/settings/first-configuration.js',
        ['readFirstConfiguration', 'isFirstConfigurationComplete', 'firstConfigurationPatch', 'pageRequiresFirstConfiguration'],
        { normalizeLanguage: value => ['it', 'en'].includes(value) ? value : '' }
    );
    const missing = api.readFirstConfiguration({ settings: {} });
    assert.deepEqual([...missing.missingRequired], ['language']);
    assert.equal(missing.complete, false);
    assert.ok([...missing.optional].includes('mfa'));
    const patch = api.firstConfigurationPatch('en', '2026-10-14T00:00:00.000Z');
    assert.equal(patch['settings.language'], 'en');
    assert.equal(patch['settings.firstConfiguration'].completed, true);
    const complete = { settings: { language: 'en', firstConfiguration: { version: 1, completed: true } } };
    assert.equal(api.isFirstConfigurationComplete(complete), true);
    assert.equal(api.pageRequiresFirstConfiguration('form_account_privato'), true);
    assert.equal(api.pageRequiresFirstConfiguration('home'), false);
});

test('Agente base usa il locale vocale derivato dalla lingua dell’app', async () => {
    const source = await readFile('Frontend/public/assets/js/modules/assistant/assistant-ui.js', 'utf8');
    const match = source.match(/const SPEECH_LOCALES = Object\.freeze\((\{[\s\S]*?\})\);/);
    assert.ok(match);
    const locales = vm.runInNewContext(`(${match[1]})`);
    assert.equal(locales.it, 'it-IT');
    assert.equal(locales.en, 'en-US');
    assert.equal(locales.zh, 'zh-CN');
    assert.match(source, /recognition\.lang = speechLocale/);
    assert.match(source, /langs: \[speechLocale\]/);
});

test('registrazione e Impostazioni persistono lingua e completamento senza tradurre dati utente', async () => {
    const auth = await readFile('Frontend/public/assets/js/auth.js', 'utf8');
    const settings = await readFile('Frontend/public/assets/js/modules/settings/impostazioni.js', 'utf8');
    assert.match(auth, /settings:\s*\{[\s\S]*language: selectedLanguage/);
    assert.match(auth, /firstConfiguration:\s*\{[\s\S]*completed: false/);
    assert.match(settings, /firstConfigurationPatch\(code\)/);
    assert.doesNotMatch(settings, /translateUserData|translateVaultData/);
});
