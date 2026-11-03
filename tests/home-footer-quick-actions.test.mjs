import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeSource = readFileSync(new URL('../Frontend/public/assets/js/modules/home/home.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../Frontend/public/assets/css/core_ui.css', import.meta.url), 'utf8');
const guide = JSON.parse(readFileSync(new URL('../Frontend/public/assets/js/modules/assistant/documentation-catalog.json', import.meta.url), 'utf8'));

test('il footer apre direttamente il nuovo Account privato con un nome esplicito', () => {
    assert.match(homeSource, /title:\s*'Nuovo account privato'/);
    assert.match(homeSource, /aria-label':\s*'Nuovo account privato'/);
    assert.match(homeSource, /form_account_privato\.html/);
    assert.doesNotMatch(homeSource, /title:\s*'Nuovo Privato'/);
});

test('il nuovo Account aziendale usa un menu accessibile senza passare dalla lista aziende', () => {
    assert.match(homeSource, /id:\s*'home-company-quick-menu'/);
    assert.match(homeSource, /aria-haspopup':\s*'menu'/);
    assert.match(homeSource, /role:\s*'menuitem'/);
    assert.match(homeSource, /form_account_azienda\.html\?aziendaId=\$\{encodeURIComponent\(company\.id\)\}/);
    assert.match(homeSource, /textContent:\s*'Crea nuova azienda'/);
    assert.doesNotMatch(homeSource, /lista_aziende\.html\?select=1/);
});

test('il menu azienda resta visibile sopra il footer ed è descritto nella guida', () => {
    assert.match(cssSource, /\.home-company-quick-menu\s*\{[\s\S]*position:\s*fixed;[\s\S]*z-index:\s*var\(--z-dropdown\)/);
    assert.match(cssSource, /\.home-company-quick-menu-item:hover,[\s\S]*\.home-company-quick-menu-item:focus-visible/);
    assert.match(guide.messages.it['guide.pages.home_page.step-4'], /scegli prima l’azienda dal menu rapido/i);
});
