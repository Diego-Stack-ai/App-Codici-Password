import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/privato/profilo-widgets.js', import.meta.url), 'utf8');

test('le zone widget create dopo il caricamento rispettano la linguetta attiva', () => {
    assert.match(source, /data-profile-tab-target.*is-active/);
    assert.match(source, /tab === activeTab \? '' : ' hidden'/);
});

test('ogni linguetta espone un solo comando più senza limite al numero di widget', () => {
    assert.match(source, /aria-label': 'Aggiungi widget'/);
    assert.match(source, /textContent: 'add'/);
    assert.doesNotMatch(source, /WIDGET_(COUNT|LIMIT)|widgets\.length\s*>=/);
});
