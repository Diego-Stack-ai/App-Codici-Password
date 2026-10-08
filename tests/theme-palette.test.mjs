import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../Frontend/public/', import.meta.url);
const [init, core, settings, settingsScript, privateAccounts, companyAccounts, coreUi, accountAvatar, accountList, privateArea] = await Promise.all([
  readFile(new URL('assets/js/theme-init.js', root), 'utf8'),
  readFile(new URL('assets/css/core.css', root), 'utf8'),
  readFile(new URL('impostazioni.html', root), 'utf8'),
  readFile(new URL('assets/js/modules/settings/impostazioni.js', root), 'utf8'),
  readFile(new URL('assets/css/account_privati.css', root), 'utf8'),
  readFile(new URL('assets/css/account_azienda.css', root), 'utf8'),
  readFile(new URL('assets/css/core_ui.css', root), 'utf8'),
  readFile(new URL('assets/js/modules/shared/account-avatar.js', root), 'utf8'),
  readFile(new URL('assets/js/modules/shared/account-list-view.js', root), 'utf8'),
  readFile(new URL('assets/js/modules/privato/area_privata.js', root), 'utf8')
]);

function luminance(hex) {
  const channels = hex.match(/[\da-f]{2}/gi).map(value => parseInt(value, 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(first, second) {
  const values = [luminance(first), luminance(second)].sort((a, b) => b - a);
  return (values[0] + 0.05) / (values[1] + 0.05);
}

test('theme init applies a validated color before rendering and defaults to blue', () => {
  for (const [stored, expected] of [['green','green'],['red','red'],['sand','sand'],['petrol','petrol'],['lavender','lavender'],['dusty-rose','dusty-rose'],['blue','blue'],['invalid','blue'],[null,'blue']]) {
    const document = {documentElement:{classList:{contains:()=>false,add(){},remove(){}},dataset:{}}};
    const sandbox = {document, localStorage:{getItem:key=>key === 'color_theme' ? stored : 'light'}, Intl, Date, window:{matchMedia:()=>({matches:false})}, console};
    vm.runInNewContext(init, sandbox);
    assert.equal(document.documentElement.dataset.colorTheme, expected);
  }
});

test('seven palettes define light and dark identity tokens without overriding status colors', () => {
  for (const theme of ['green','red','sand','petrol','lavender','dusty-rose']) {
    assert.match(core, new RegExp(`:root\\[data-color-theme="${theme}"\\]`));
    assert.match(core, new RegExp(`\\.dark\\[data-color-theme="${theme}"\\]`));
  }
  assert.match(core, /--accent-rgb: 19, 127, 236/);
  const paletteBlocks = [...core.matchAll(/(?:root|dark)\[data-color-theme="[^"]+"\]\s*\{([^}]+)\}/g)].map(match=>match[1]).join('\n');
  assert.doesNotMatch(paletteBlocks, /--status-(?:success|warning|error)/);
});

test('settings exposes seven independent color choices and persists only allowed values', () => {
  for (const theme of ['blue','green','red','sand','petrol','lavender','dusty-rose']) assert.match(settings, new RegExp(`data-color-theme="${theme}"`));
  assert.match(settingsScript, /localStorage\.setItem\('color_theme', selected\)/);
  assert.match(settingsScript, /\['blue', 'green', 'red', 'sand', 'petrol', 'lavender', 'dusty-rose'\]\.includes\(selected\)/);
});

test('private, company and shared Account cards consume palette tokens', () => {
  for (const css of [privateAccounts, companyAccounts]) {
    assert.match(css, /\.account-card \.swipe-content\s*\{[^}]*background: var\(--account-card-bg\)/s);
    assert.match(css, /border: 1px solid var\(--account-card-border\)/);
    assert.doesNotMatch(css, /background: rgba\(20, 53, 126, 0\.5\)/);
    assert.doesNotMatch(css, /background: rgba\(219, 234, 254, 0\.75\)/);
  }
  assert.match(coreUi, /\.shared-account-card\s*\{[^}]*background: var\(--account-card-bg\)/s);
  assert.match(coreUi, /\.shared-account-field\s*\{[^}]*background: var\(--account-card-field-bg\)/s);
  for (const token of ['account-card-bg', 'account-card-border', 'account-card-field-bg', 'account-card-control-bg']) {
    assert.match(core, new RegExp(`--${token}:`));
  }
});

test('new calming accents retain readable contrast in light and dark modes', () => {
  const palettes = [
    {light: '0f766e', dark: '5eead4', darkBg: '081a1a'},
    {light: '6750a4', dark: 'c4b5fd', darkBg: '17131f'},
    {light: '855466', dark: 'd9a7b8', darkBg: '211419'}
  ];
  for (const palette of palettes) {
    assert.ok(contrast(palette.light, 'ffffff') >= 4.5);
    assert.ok(contrast(palette.dark, palette.darkBg) >= 4.5);
  }
});

test('Accounts without a custom image use the palette-aware Codex logo everywhere', () => {
  assert.match(accountAvatar, /account\.logo \|\| account\.avatar/);
  assert.match(accountAvatar, /textContent: 'shield_lock'/);
  assert.doesNotMatch(accountAvatar + accountList + privateArea, /google-avatar\.png/);
  for (const css of [privateAccounts, companyAccounts]) {
    assert.match(css, /\.account-default-logo\s*\{[^}]*var\(--accent\)/s);
  }
  assert.match(accountList, /createAccountAvatar\(account\)/);
  assert.match(privateArea, /createAccountAvatar\(data\)/);
});
