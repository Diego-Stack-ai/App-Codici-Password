import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-model.js', import.meta.url), 'utf8');
const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('usa gli stessi campi nella lista e nel dettaglio', () => {
    assert.deepEqual(model.deadlinePresentation({ name: 'Diego', type: 'Revisione', veicolo_modello: 'Moto Guzzi' }), {
        owner: 'Diego', category: 'Revisione', vehicle: 'Moto Guzzi', vehicleLabel: 'Moto Guzzi',
        title: 'Revisione - Diego'
    });
});

test('mantiene i fallback dei record storici', () => {
    const result = model.deadlinePresentation({ title: 'Assicurazione storica' });
    assert.equal(result.category, 'Assicurazione storica');
    assert.equal(result.title, 'Assicurazione storica');
    assert.equal(result.vehicleLabel, 'Veicolo non specificato');
});

test('interpreta date ISO, italiane e Timestamp-like', () => {
    assert.equal(model.deadlineDate({ dueDate: '2026-09-30' }).getDate(), 30);
    assert.equal(model.deadlineDate({ dueDate: '30/09/2026' }).getMonth(), 8);
    assert.equal(model.deadlineDate({ dueDate: { toDate: () => new Date(2026, 8, 30) } }).getFullYear(), 2026);
    assert.equal(model.deadlineDate({ dueDate: 'non valida' }), null);
});

test('normalizza esclusivamente date di input realmente valide', () => {
    assert.equal(model.deadlineInputDate('2026-09-30', ''), '2026-09-30');
    assert.equal(model.deadlineInputDate('', '30/09/2026'), '2026-09-30');
    assert.equal(model.deadlineInputDate('', '2026-02-31'), '');
    assert.equal(model.deadlineInputDate('', 'domani'), '');
});

test('prepara data ISO e visuale senza duplicare la logica del form', () => {
    assert.deepEqual(model.deadlineDateInputFields({ dueDate: '30/09/2026' }), {
        isoValue: '2026-09-30', displayValue: '30/09/2026'
    });
    assert.deepEqual(model.deadlineDateInputFields({ dueDate: 'dato storico non valido' }), {
        isoValue: '', displayValue: 'dato storico non valido'
    });
});
