import test from 'node:test';
import assert from 'node:assert/strict';
import { buildQaFinalInventory, FIXTURE_PLANS, renderQaFinalInventory } from '../scripts/audit-qa-final-inventory.mjs';

test('la matrice QA copre una volta tutte le pagine canoniche', async () => {
    const inventory = await buildQaFinalInventory();
    assert.equal(inventory.totals.pages, 31);
    assert.equal(new Set(inventory.pages.map(page => page.pageId)).size, 31);
    assert.equal(Object.keys(FIXTURE_PLANS).length, 31);
    assert.ok(inventory.totals.steps >= 100);
    assert.ok(inventory.totals.targets >= 90);
});

test('la matrice distingue inventario statico ed esecuzione browser', async () => {
    const markdown = renderQaFinalInventory(await buildQaFinalInventory());
    assert.match(markdown, /NON ESEGUITO/);
    assert.match(markdown, /BASELINE AUTOMATICA/);
    assert.match(markdown, /campi creati dinamicamente/i);
    assert.match(markdown, /domini `\.invalid`/);
});

test('le fixture coprono i domini applicativi sensibili senza recapiti reali', () => {
    const fixtureText = Object.values(FIXTURE_PLANS).join('\n');
    for (const term of ['Memorandum', 'Widget', 'credenziale comune', 'Scadenza', 'Archivio', '.invalid']) {
        assert.match(fixtureText, new RegExp(term, 'i'));
    }
});
