import { LOG } from './logger.js';

const APP_LANGUAGE_CODES = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
const normalizeAppLanguage = (value, fallback = 'it') => {
    const code = String(value || '').trim().toLowerCase().split('-')[0];
    return APP_LANGUAGE_CODES.includes(code) ? code : fallback;
};
const LOCAL_QA_LANGUAGE_KEY = 'codex_qa_language_override_v1';
const LOCAL_QA_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function getLocalQaLanguageOverride() {
    try {
        if (!LOCAL_QA_HOSTS.has(window.location.hostname)) return null;
        return normalizeAppLanguage(window.sessionStorage.getItem(LOCAL_QA_LANGUAGE_KEY), '') || null;
    } catch {
        return null;
    }
}

let _dict = {};
async function loadPageCatalog(language) {
    if (/(?:^|\/)(?:login|registrati|reset_password|imposta_nuova_password|contatto_condiviso)(?:\.html)?$/i.test(location.pathname)) {
        const { accessCatalogs } = await import('./translations/access.js');
        return accessCatalogs[language] || {};
    }
    if (/(?:^|\/)gestione_destinatari(?:\.html)?$/i.test(location.pathname)) {
        const { recipientCatalogs } = await import('./translations/recipients.js');
        return recipientCatalogs[language] || {};
    }
    if (/(?:^|\/)(?:profilo_privato|dati_azienda)(?:\.html)?$/i.test(location.pathname)) {
        const { profileCatalogs } = await import('./translations/profile.js');
        return profileCatalogs[language] || {};
    }
    if (/(?:^|\/)impostazioni(?:\.html)?$/i.test(location.pathname)) {
        const { settingsCatalogs } = await import('./translations/settings.js');
        return settingsCatalogs[language] || {};
    }
    if (/(?:^|\/)(?:regole_scadenze|configurazione_automezzi|aggiungi_scadenza)(?:\.html)?$/i.test(location.pathname)) {
        const { deadlineRulesCatalogs } = await import('./translations/deadline-rules.js');
        return deadlineRulesCatalogs[language] || {};
    }
    return {};
}
let _activeLanguage = 'it';
const _missingKeys = new Set();
const _sourceText = new WeakMap();
const _sourceAttributes = new WeakMap();

const _it = {};

// ─── Metadati lingue ─────────────────────────────────────────────────────────
export const supportedLanguages = [
    { code: 'it', name: 'Italiano',        flag: '\u{1F1EE}\u{1F1F9}' },
    { code: 'en', name: 'English',         flag: '\u{1F1FA}\u{1F1F8}' },
    { code: 'es', name: 'Español',         flag: '\u{1F1EA}\u{1F1F8}' },
    { code: 'fr', name: 'Français',        flag: '\u{1F1EB}\u{1F1F7}' },
    { code: 'de', name: 'Deutsch',         flag: '\u{1F1E9}\u{1F1EA}' },
    { code: 'zh', name: '简体中文',           flag: '\u{1F1E8}\u{1F1F3}' },
    { code: 'hi', name: 'हिन्दी',            flag: '\u{1F1EE}\u{1F1F3}' },
    { code: 'pt', name: 'Português',       flag: '\u{1F1F5}\u{1F1F9}' }
];

export function getCurrentLanguage() {
    try { return getLocalQaLanguageOverride() || normalizeAppLanguage(localStorage.getItem('app_language')); } catch { return 'it'; }
}

let _italianCatalogPromise;
async function loadItalianCatalog() {
    _italianCatalogPromise ||= Promise.all([
        import('./translations/it.js'),
        import('./translations/dynamic-ui.js')
    ]).then(([base, dynamic]) => Object.assign(_it, base.default, dynamic.dynamicUiCatalogs.it));
    await _italianCatalogPromise;
}

export async function loadLanguage(lang = 'it') {
    lang = normalizeAppLanguage(lang || 'it');
    await loadItalianCatalog();
    _activeLanguage = lang;
    _missingKeys.clear();
    document.documentElement.lang = lang;
    document.documentElement.dir = 'ltr';
    if (lang === 'it') {
        _dict = { ..._it, ...(await loadPageCatalog('it')) };
        LOG('[i18n] Lingua attiva: it (inline)');
        return;
    }
    try {
        const baseUrl = import.meta.url.replace(/[^/]+$/, '');
        const [module, dynamic] = await Promise.all([
            import(`${baseUrl}translations/${lang}.js`),
            import('./translations/dynamic-ui.js')
        ]);
        _dict = { ...module.default, ...(dynamic.dynamicUiCatalogs[lang] || {}), ...(await loadPageCatalog(lang)) };
        LOG(`[i18n] Lingua attiva: ${lang} (${Object.keys(_dict).length} chiavi)`);
    } catch (e) {
        console.warn(`[i18n] Lingua '${lang}' non disponibile — fallback a 'it'`);
        _dict = { ..._it, ...(await loadPageCatalog('it')) };
    }
}

export function t(key) {
    if (_dict[key]) return _dict[key];
    if (_activeLanguage !== 'it') {
        _missingKeys.add(key);
        document.documentElement.dataset.i18nFallback = 'true';
        console.warn(`[i18n] Chiave mancante per ${_activeLanguage}: ${key}`);
    }
    return _it[key] || key;
}

export function tf(key, values = {}) {
    return Object.entries(values).reduce(
        (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
        t(key)
    );
}

export function getMissingTranslationKeys() {
    return [..._missingKeys].sort();
}

const TRANSLATED_ATTRIBUTES = [
    ['placeholder', 'tPlaceholder'], ['aria-label', 'tAria'],
    ['title', 'tTitle'], ['alt', 'tAlt']
];

export function setTranslatedText(element, key) {
    if (element && key) {
        if (!_sourceText.has(element)) _sourceText.set(element, element.textContent);
        const translated = t(key);
        element.textContent = translated === key ? _sourceText.get(element) : translated;
        element.dataset.t = key;
    }
    return element;
}

function translateElement(element) {
    if (element.dataset.t) {
        if (!_sourceText.has(element)) _sourceText.set(element, element.textContent);
        const translated = t(element.dataset.t);
        element.textContent = translated === element.dataset.t ? _sourceText.get(element) : translated;
    }
    for (const [attribute, datasetKey] of TRANSLATED_ATTRIBUTES) {
        const key = element.dataset[datasetKey];
        if (!key) continue;
        let originals = _sourceAttributes.get(element);
        if (!originals) {
            originals = new Map();
            _sourceAttributes.set(element, originals);
        }
        if (!originals.has(attribute)) originals.set(attribute, element.getAttribute(attribute) || '');
        const translated = t(key);
        element.setAttribute(attribute, translated === key ? originals.get(attribute) : translated);
    }
}

export function applyGlobalTranslations(root = document) {
    const selector = '[data-t],[data-t-placeholder],[data-t-aria],[data-t-title],[data-t-alt]';
    if (root instanceof Element && root.matches(selector)) translateElement(root);
    root.querySelectorAll(selector).forEach(translateElement);
    if (root === document) {
        document.documentElement.setAttribute('data-i18n', 'ready');
        if (!_missingKeys.size) delete document.documentElement.dataset.i18nFallback;
        document.dispatchEvent(new CustomEvent('app-language-applied', {
            detail: { language: document.documentElement.lang, missingKeys: getMissingTranslationKeys() }
        }));
    }
}

export function observeTranslatedSubtrees(root = document.body) {
    const moduleUrl = new URL('./translations/', import.meta.url);
    import(`${moduleUrl.href}observer.js`).then(module => module.observeTranslatedSubtrees(root));
}

// Compatibilità con vecchi moduli
