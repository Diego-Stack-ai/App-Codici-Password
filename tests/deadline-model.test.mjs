import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-model.js', import.meta.url), 'utf8');
const model = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('calendar boundaries remain correct in Rome and New York, including DST', () => {
    for (const TZ of ['Europe/Rome', 'America/New_York']) {
        const script = `
            import assert from 'node:assert/strict';
            const model = await import(${JSON.stringify(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)});
            for (const [month, day] of [[2, 8], [2, 29], [9, 25], [10, 1]]) {
                const now = new Date(2026, month, day, 23, 59, 59);
                const iso = '2026-' + String(month + 1).padStart(2, '0') + '-' + String(day).padStart(2, '0');
                assert.equal(model.currentDiffDays(iso, now), 0);
                assert.equal(model.deadlineBucket({dueDate: iso}, now), 'upcoming');
                assert.equal(model.deadlineBucket({dueDate: iso}, new Date(2026, month, day + 1)), 'urgent');
                assert.equal(model.currentDiffDays(new Date(2026, month, day + 2), now), 2);
            }
        `;
        const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
            env: {...process.env, TZ}, encoding: 'utf8'
        });
        assert.equal(result.status, 0, `${TZ}: ${result.stderr}`);
    }
});

test('calendar days: today remains upcoming until the next local date', () => {
    for (const hour of [0, 12, 23]) {
        assert.equal(model.deadlineBucket({dueDate: '2026-09-26'}, new Date(2026, 8, 26, hour, 59)), 'upcoming');
    }
    assert.equal(model.deadlineBucket({dueDate: '2026-09-26'}, new Date(2026, 8, 27)), 'urgent');
    assert.equal(model.deadlineBucket({date: '26/09/2026'}, new Date(2026, 8, 27)), 'urgent');
    assert.equal(model.currentDiffDays('2026-03-30', new Date(2026, 2, 28, 12)), 2);
    assert.equal(model.currentDiffDays('2026-10-26', new Date(2026, 9, 24, 12)), 2);
    assert.equal(model.deadlineDate({dueDate: '2026-10-01'}).getHours(), 0);
    assert.equal(model.currentDiffDays('2026-02-31'), null);
});

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
