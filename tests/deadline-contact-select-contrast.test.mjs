import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const cssUrl = new URL('../Frontend/public/assets/css/aggiungi_scadenza.css', import.meta.url);

test('le voci native della rubrica restano leggibili sul popup chiaro', async () => {
    const css = await readFile(cssUrl, 'utf8');
    const optionRule = css.match(/select\.deadline-contact-select option,\s*select\.deadline-contact-select optgroup\s*\{([^}]+)\}/);

    assert.ok(optionRule, 'manca una regola esplicita per option e optgroup della rubrica');
    assert.match(optionRule[1], /background-color:\s*#fff\s*;/i);
    assert.match(optionRule[1], /color:\s*#172033\s*;/i);
});
