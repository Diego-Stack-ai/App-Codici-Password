import { getCurrentLanguage } from '../../translations.js';
import { onboardingText } from '../../translations/onboarding.js';

const LANGUAGE_KEY = 'app_language';
const EXPLICIT_KEY = 'app_language_explicit_v1';
const USER_KEY_PREFIX = 'app_language_user_v1:';
const CODES = ['it', 'en', 'es', 'fr', 'de', 'zh', 'hi', 'pt'];
const storage = () => { try { return window.localStorage; } catch { return null; } };
export function normalizeLanguage(value, fallback = 'it') { const code = String(value || '').trim().toLowerCase().split('-')[0]; return CODES.includes(code) ? code : fallback; }
export const hasExplicitLanguageChoice = () => storage()?.getItem(EXPLICIT_KEY) === '1';
export const getDeviceLanguage = () => normalizeLanguage(navigator.languages?.[0] || navigator.language);
export function setLanguagePreference(language, { explicit = true, uid = null } = {}) { const code = normalizeLanguage(language); const target = storage(); target?.setItem(LANGUAGE_KEY, code); if (explicit) target?.setItem(EXPLICIT_KEY, '1'); if (uid) target?.setItem(`${USER_KEY_PREFIX}${uid}`, code); document.documentElement.lang = code; document.documentElement.dir = 'ltr'; return code; }
export function resolveLanguage({ uid = null, userData = null } = {}) { const remote = userData?.settings?.language || userData?.settings_language; if (remote) return normalizeLanguage(remote); const remembered = uid && storage()?.getItem(`${USER_KEY_PREFIX}${uid}`); if (remembered) return normalizeLanguage(remembered); return normalizeLanguage(storage()?.getItem(LANGUAGE_KEY) || navigator.languages?.[0] || navigator.language); }
export function rememberUserLanguage(uid, data) { const language = data?.settings?.language || data?.settings_language; return language ? setLanguagePreference(language, { uid }) : null; }

export const FIRST_CONFIGURATION_VERSION = 1;
export const FIRST_CONFIGURATION_OPTIONAL = Object.freeze(['theme', 'companyArea', 'assistantBase', 'notifications', 'mfa', 'biometricUnlock', 'backup']);
const RESTRICTED = new Set(['form_account_privato', 'form_account_azienda', 'aggiungi_scadenza', 'modifica_azienda', 'automezzi', 'documenti', 'regole_generali']);
const LANGUAGES = [['it','🇮🇹 Italiano'],['en','🇺🇸 English'],['es','🇪🇸 Español'],['fr','🇫🇷 Français'],['de','🇩🇪 Deutsch'],['zh','🇨🇳 简体中文'],['hi','🇮🇳 हिन्दी'],['pt','🇵🇹 Português']];
const text = key => onboardingText(getCurrentLanguage(), key);
export const configurationText = text;
function ensureStyles() {
    if (document.getElementById('first-configuration-styles')) return;
    const link = document.createElement('link');
    link.id = 'first-configuration-styles'; link.rel = 'stylesheet'; link.href = '/assets/css/first-configuration.css';
    document.head.append(link);
}

export function readFirstConfiguration(data = {}) {
    const settings = data.settings || {};
    const language = settings.language || data.settings_language || null;
    const first = settings.firstConfiguration || data.settings_first_configuration || {};
    const valid = Boolean(language && normalizeLanguage(language, '') === language);
    return { version: 1, language: valid ? language : null, complete: valid && first.version >= 1 && first.completed === true, missingRequired: valid ? [] : ['language'], optional: FIRST_CONFIGURATION_OPTIONAL };
}
export const isFirstConfigurationComplete = data => readFirstConfiguration(data).complete;
export const pageRequiresFirstConfiguration = page => RESTRICTED.has(page);
export function firstConfigurationPatch(language, now = new Date().toISOString()) {
    const code = normalizeLanguage(language, '');
    if (!code) throw new TypeError('Lingua non supportata.');
    return { 'settings.language': code, 'settings.firstConfiguration': { version: 1, completed: true, completedAt: now } };
}
function el(tag, props = {}) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) key === 'className' || key === 'textContent' || key === 'id' ? node[key] = value : node.setAttribute(key, value);
    return node;
}
export function openInitialLanguageDialog({ required = false, onConfirm = null } = {}) {
    ensureStyles();
    if (hasExplicitLanguageChoice()) return null;
    document.getElementById('initial-language-dialog')?.remove();
    let selected = getDeviceLanguage();
    const overlay = el('div', { className: 'first-configuration-overlay', id: 'initial-language-dialog' });
    const dialog = el('section', { className: 'first-configuration-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'initial-language-title' });
    const grid = el('div', { className: 'language-welcome-grid' });
    const buttons = LANGUAGES.map(([code, label]) => {
        const button = el('button', { type: 'button', textContent: label, 'aria-pressed': String(code === selected) });
        button.dataset.code = code;
        button.onclick = () => { selected = code; buttons.forEach(item => item.setAttribute('aria-pressed', String(item.dataset.code === code))); };
        grid.append(button);
        return button;
    });
    const actions = el('div', { className: 'first-configuration-actions' });
    const confirm = el('button', { type: 'button', className: 'first-configuration-primary', textContent: text('initial_language_confirm') });
    confirm.onclick = async () => { const code = setLanguagePreference(selected); overlay.remove(); if (onConfirm) await onConfirm(code); else location.reload(); };
    actions.append(confirm);
    if (!required) { const login = el('button', { type: 'button', className: 'first-configuration-secondary', textContent: text('initial_language_existing_action') }); login.onclick = () => overlay.remove(); actions.append(login); }
    dialog.append(el('h2', { id: 'initial-language-title', textContent: text('initial_language_title') }), el('p', { textContent: text(required ? 'initial_language_required' : 'initial_language_existing') }), grid, actions);
    overlay.append(dialog); document.body.append(overlay); buttons.find(button => button.dataset.code === selected)?.focus();
    return overlay;
}
export function openFirstConfigurationDialog({ blocking = false, onSettings = null } = {}) {
    ensureStyles();
    document.getElementById('first-configuration-dialog')?.remove();
    const overlay = el('div', { className: 'first-configuration-overlay', id: 'first-configuration-dialog' });
    const dialog = el('section', { className: 'first-configuration-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'first-configuration-title' });
    const list = el('ul', { className: 'first-configuration-list' }); list.append(el('li', { textContent: text('first_config_required') }), el('li', { textContent: text('first_config_optional') }));
    const actions = el('div', { className: 'first-configuration-actions' });
    const settings = el('button', { type: 'button', className: 'first-configuration-primary', textContent: text('first_config_open_settings') });
    settings.onclick = () => { overlay.remove(); if (onSettings) onSettings(); else location.href = 'impostazioni.html?firstConfiguration=1'; };
    const alternate = el('button', { type: 'button', className: 'first-configuration-secondary', textContent: text(blocking ? 'first_config_home' : 'first_config_explore') });
    alternate.onclick = () => { if (blocking) location.href = 'home_page.html'; else overlay.remove(); };
    actions.append(settings, alternate);
    dialog.append(el('h2', { id: 'first-configuration-title', textContent: text('first_config_title') }), el('p', { textContent: text(blocking ? 'first_config_blocked' : 'first_config_intro') }), list, actions);
    overlay.append(dialog); document.body.append(overlay); settings.focus();
    return overlay;
}
