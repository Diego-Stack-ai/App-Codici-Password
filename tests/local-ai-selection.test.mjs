import test from 'node:test';
import assert from 'node:assert/strict';
import { readDesktop32RamConfirmation, readSelectedAdvancedTier, readSelectedLocalAi,
    writeDesktop32RamConfirmation, writeSelectedAdvancedTier, writeSelectedLocalAi } from '../Frontend/public/assets/js/modules/assistant/local-ai-selection.js';

const storage = values => ({
    getItem:key => values.get(key) ?? null,
    setItem:(key, value) => values.set(key, value)
});

test('AI.2 usa un solo pacchetto desktop32 e migra le vecchie taglie', () => {
    const values = new Map();
    writeSelectedAdvancedTier('desktop32', storage(values));
    assert.equal(readSelectedAdvancedTier(storage(values)), 'desktop32');
    assert.throws(() => writeSelectedAdvancedTier('extra-large', storage(values)), /ADVANCED_TIER/);
    values.set('codex.local-ai.advanced-tier.v1', 'power');
    assert.equal(readSelectedAdvancedTier(storage(values)), 'desktop32');
});

test('la conferma dei 32 GB è esplicita e separata dalla capacità tecnica', () => {
    const values = new Map();
    assert.equal(readDesktop32RamConfirmation(storage(values)), false);
    writeDesktop32RamConfirmation(true, storage(values));
    assert.equal(readDesktop32RamConfirmation(storage(values)), true);
    assert.throws(() => writeDesktop32RamConfirmation('true', storage(values)), /RAM_CONFIRMATION/);
});

test('la vecchia AI.2 semantica migra alla nuova AI.1', () => {
    const values = new Map([['codex.local-ai.selected.v1', 'A2']]);
    assert.equal(readSelectedLocalAi(storage(values)), 'A1');
    assert.equal(values.get('codex.local-ai.selected.v2'), 'A1');
});

test('la vecchia AI.3 non viene riattivata automaticamente', () => {
    const values = new Map([['codex.local-ai.selected.v1', 'A3']]);
    assert.equal(readSelectedLocalAi(storage(values)), 'A1');
});

test('la nuova selezione accetta soltanto i due livelli', () => {
    const values = new Map();
    writeSelectedLocalAi('A2', storage(values));
    assert.equal(readSelectedLocalAi(storage(values)), 'A2');
    assert.throws(() => writeSelectedLocalAi('A3', storage(values)), /SELECTED_LEVEL/);
});
