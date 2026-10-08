import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../Frontend/public/', import.meta.url);
const [init, core, settings, settingsScript] = await Promise.all([
  readFile(new URL('assets/js/theme-init.js', root), 'utf8'),
  readFile(new URL('assets/css/core.css', root), 'utf8'),
  readFile(new URL('impostazioni.html', root), 'utf8'),
  readFile(new URL('assets/js/modules/settings/impostazioni.js', root), 'utf8')
]);

test('theme init applies a validated color before rendering and defaults to blue', () => {
  for (const [stored, expected] of [['green','green'],['red','red'],['sand','sand'],['blue','blue'],['invalid','blue'],[null,'blue']]) {
    const document = {documentElement:{classList:{contains:()=>false,add(){},remove(){}},dataset:{}}};
    const sandbox = {document, localStorage:{getItem:key=>key === 'color_theme' ? stored : 'light'}, Intl, Date, window:{matchMedia:()=>({matches:false})}, console};
    vm.runInNewContext(init, sandbox);
    assert.equal(document.documentElement.dataset.colorTheme, expected);
  }
});

test('four palettes define light and dark identity tokens without overriding status colors', () => {
  for (const theme of ['green','red','sand']) {
    assert.match(core, new RegExp(`:root\\[data-color-theme="${theme}"\\]`));
    assert.match(core, new RegExp(`\\.dark\\[data-color-theme="${theme}"\\]`));
  }
  assert.match(core, /--accent-rgb: 19, 127, 236/);
  const paletteBlocks = [...core.matchAll(/(?:root|dark)\[data-color-theme="[^"]+"\]\s*\{([^}]+)\}/g)].map(match=>match[1]).join('\n');
  assert.doesNotMatch(paletteBlocks, /--status-(?:success|warning|error)/);
});

test('settings exposes four independent color choices and persists only allowed values', () => {
  for (const theme of ['blue','green','red','sand']) assert.match(settings, new RegExp(`data-color-theme="${theme}"`));
  assert.match(settingsScript, /localStorage\.setItem\('color_theme', selected\)/);
  assert.match(settingsScript, /\['blue', 'green', 'red', 'sand'\]\.includes\(selected\)/);
});
