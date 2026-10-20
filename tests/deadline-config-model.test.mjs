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

test('preavviso consentito da 0 a 3650 giorni', () => {
    for (const value of [0, 14, 3650, '56']) assert.equal(model.validateDeadlineNotice(value), Number(value));
    for (const value of [-1, 3651, 1.5, '14x', '', null, Infinity]) {
        assert.throws(() => model.validateDeadlineNotice(value), /0 a 3650/);
    }
});

test('salvataggio reale rifiuta la frequenza prima di upload e scritture', async () => {
    const saveSource = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-save-service.js', import.meta.url), 'utf8');
    const stripped = saveSource.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
    const save = new Function('validateDeadlineFrequency', 'validateDeadlineNotice', `${stripped}\nreturn saveDeadline;`)(
        model.validateDeadlineFrequency,
        model.validateDeadlineNotice
    );
    // Nessuna dipendenza SDK fornita: qualunque accesso prima del rifiuto fallirebbe.
    await assert.rejects(save({user: {uid: 'synthetic'}, data: {notif_frequency: 31}, selectedFiles: [{}]}), /1 a 30/);
    await assert.rejects(save({
        user: {uid: 'synthetic'}, data: {notif_days_before: -1, notif_frequency: 7}, selectedFiles: [{}]
    }), /0 a 3650/);
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

test('associa il testo al tipo documento per contenuto e mai per posizione', () => {
    const config = {
        deadlineTypes: [
            {name: 'Passaporto', period: 28, freq: 14},
            {name: 'Carta Identità', period: 56, freq: 14},
            {name: 'IMU', period: 30, freq: 7}
        ],
        emailTemplates: [
            'Pagamento IMU abitazione principale',
            'Il tuo documento di Identità',
            'Il tuo passaporto'
        ]
    };
    assert.equal(model.resolveDocumentDeadlineTemplate(config, 'Passaporto'), 'Il tuo passaporto');
    assert.equal(model.resolveDocumentDeadlineTemplate(config, 'Carta d’identità'), 'Il tuo documento di Identità');
    assert.equal(model.resolveDocumentDeadlineTemplate(config, 'IMU'), '');
    assert.equal(model.resolveDocumentDeadlineTemplate({
        deadlineTypes: [{name: 'Passaporto', templateText: 'Testo personalizzato'}],
        emailTemplates: ['Il tuo passaporto']
    }, 'Passaporto'), 'Testo personalizzato');
});

test('la configurazione automezzi annida oggetti, modelli, targhe e testo senza mutare i dati legacy', () => {
    const legacy = {
        deadlineTypes: [{name: 'Assicurazione', period: 14, freq: 7}],
        models: ['Moto Guzzi Nevada 750 - CJ14146'],
        emailTemplates: ["l'assicurazione del motociclo"]
    };
    const objects = model.deadlineRuleEmailObjects(legacy.deadlineTypes[0], legacy, {
        beforeObject: 'È in scadenza ', betweenObjectModel: ' ', betweenModelPlate: ', con targa ', afterPlate: '.'
    });
    assert.equal(objects[0].vehicles[0].model, 'Moto Guzzi Nevada 750');
    assert.equal(objects[0].vehicles[0].plate, 'CJ14146');
    assert.equal(model.compileDeadlineMessage({
        objectText: objects[0].objectText,
        model: objects[0].vehicles[0].model,
        plate: objects[0].vehicles[0].plate,
        message: objects[0].vehicles[0].message
    }), "È in scadenza l'assicurazione del motociclo Moto Guzzi Nevada 750, con targa CJ14146.");
    assert.equal(legacy.deadlineTypes[0].emailObjects, undefined);
});

test('le nuove referenze conservano modello e targa come campi distinti', () => {
    assert.deepEqual(model.splitLegacyVehicleReference({model: 'Peugeot e-208', plate: 'GM277DC'}), {
        id: '', model: 'Peugeot e-208', plate: 'GM277DC', message: null
    });
    assert.equal(model.vehicleReferenceLabel({model: 'Peugeot e-208', plate: 'GM277DC'}), 'Peugeot e-208 - GM277DC');
    const config = {deadlineTypes: [{name: 'Bollo', period: 14, freq: 7}]};
    const updated = model.updateDeadlineRuleEmailObjects(config, 0, [{
        id: 'object-1', name: 'Bollo auto', objectText: 'il bollo', period: 28, freq: 7,
        vehicles: [{id: 'vehicle-1', model: 'Peugeot e-208', plate: 'GM277DC', message: {beforeObject: 'Sta per scadere '}}]
    }]);
    assert.equal(updated.deadlineTypes[0].emailObjects[0].vehicles[0].plate, 'GM277DC');
    assert.equal(config.deadlineTypes[0].emailObjects, undefined);
});
