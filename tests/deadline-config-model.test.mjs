import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-config-model.js', import.meta.url), 'utf8');
const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('clona le configurazioni senza condividere riferimenti', () => {
    const original = { deadlineTypes: [{ name: 'Bollo' }] };
    const copy = model.cloneDeadlineConfig(original);
    copy.deadlineTypes[0].name = 'Revisione';
    assert.equal(original.deadlineTypes[0].name, 'Bollo');
});

test('normalizza i vecchi tipi stringa e i valori numerici', () => {
    assert.deepEqual(model.normalizeDeadlineConfig({
        deadlineTypes: ['Bollo', { name: 'Revisione', period: '30', freq: '5' }]
    }, ['deadlineTypes', 'models']), {
        deadlineTypes: [
            { name: 'Bollo', period: 14, freq: 7 },
            { name: 'Revisione', period: 30, freq: 5 }
        ],
        models: []
    });
});

test('scarta tipi vuoti e ripara liste con formato errato', () => {
    assert.deepEqual(model.normalizeDeadlineConfig({ deadlineTypes: ['', null], emailTemplates: 'errato' }, [
        'deadlineTypes', 'emailTemplates'
    ]), { deadlineTypes: [], emailTemplates: [] });
});

test('aggiorna liste e tipi senza mutare la configurazione corrente', () => {
    const original = { deadlineTypes: [{ name: 'Bollo', period: 14, freq: 7 }], models: ['Auto'] };
    const withType = model.updateDeadlineType(original, 0, { name: 'Revisione', period: '30', freq: '5' });
    const withModel = model.appendDeadlineListItem(withType, 'models', ' Moto ');
    const renamed = model.updateDeadlineListItem(withModel, 'models', 0, 'Automobile');
    const removed = model.removeDeadlineListItem(renamed, 'models', 1);
    assert.equal(original.deadlineTypes[0].name, 'Bollo');
    assert.deepEqual(removed, {
        deadlineTypes: [{ name: 'Revisione', period: 30, freq: 5 }],
        models: ['Automobile']
    });
});
