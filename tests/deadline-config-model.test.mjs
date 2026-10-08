import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-config-model.js', import.meta.url), 'utf8');
const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('frequenza consentita da 1 a 30 senza migrare i dati storici', () => {
    for (const value of [1, 7, 30, '30']) assert.equal(model.validateDeadlineFrequency(value), Number(value));
    for (const value of [0, 31, 90, -1, 1.5, '7x', '', null, Infinity]) {
        assert.throws(() => model.validateDeadlineFrequency(value), /1 a 30/);
        assert.throws(() => model.appendDeadlineType({}, {name: 'Prova', freq: value}), /1 a 30/);
        assert.throws(() => model.updateDeadlineType({deadlineTypes: [{name: 'Prova'}]}, 0, {name: 'Prova', freq: value}), /1 a 30/);
    }
    assert.equal(model.normalizeDeadlineConfig({deadlineTypes: [{name: 'Storica', freq: 90}]}).deadlineTypes[0].freq, 90);
});

test('salvataggio reale rifiuta la frequenza prima di upload e scritture', async () => {
    const saveSource = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-save-service.js', import.meta.url), 'utf8');
    const stripped = saveSource.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
    const save = new Function('validateDeadlineFrequency', `${stripped}\nreturn saveDeadline;`)(model.validateDeadlineFrequency);
    // Nessuna dipendenza SDK fornita: qualunque accesso prima del rifiuto fallirebbe.
    await assert.rejects(save({user: {uid: 'synthetic'}, data: {notif_frequency: 31}, selectedFiles: [{}]}), /1 a 30/);
});

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
