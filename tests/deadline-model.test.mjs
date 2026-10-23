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

test('mostra una sola volta il testo completo delle nuove regole e conserva il fallback legacy', () => {
    const complete = 'Promemoria: Olio motore da controllare sulla Hyundai I10 con targa FL790AX.';
    assert.equal(model.deadlineTemplateMessage({
        templateText: complete,
        mode: 'automezzi',
        veicolo_modello: 'Hyundai I10 - FL790AX',
        ruleDomain: 'vehicles',
        ruleId: 'deadlineConfig:legacy-5'
    }), complete);
    assert.equal(model.deadlineTemplateMessage({
        templateText: 'Olio motore da controllare',
        mode: 'automezzi',
        veicolo_modello: 'Hyundai I10 - FL790AX'
    }), "E' in scadenza Olio motore da controllare Hyundai I10 - FL790AX");
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

test('una Scadenza collegata accetta la data scelta e la persistenza la sincronizza col Documento', () => {
    const draft = {
        profileDocumentId: 'passport-1',
        dueDate: '2034-10-30',
        sourceValueAtLink: '2034-10-30'
    };
    assert.equal(model.deadlineDateForSave(draft, '2027-10-30', '30/10/2027'), '2027-10-30');
    assert.equal(model.deadlineDateForSave(null, '2027-10-30', '30/10/2027'), '2027-10-30');
});

test('prepara data ISO e visuale senza duplicare la logica del form', () => {
    assert.deepEqual(model.deadlineDateInputFields({ dueDate: '30/09/2026' }), {
        isoValue: '2026-09-30', displayValue: '30/09/2026'
    });
    assert.deepEqual(model.deadlineDateInputFields({ dueDate: 'dato storico non valido' }), {
        isoValue: '', displayValue: 'dato storico non valido'
    });
});

test('presenta la data secondo la lingua senza cambiare il valore ISO salvato', () => {
    assert.equal(model.deadlineDateDisplay('2034-10-30', 'it'), '30/10/2034');
    assert.equal(model.deadlineDateDisplay('2034-10-30', 'en'), '30/10/2034');
    assert.equal(model.deadlineDateInputFields({dueDate: '2034-10-30'}, 'it').isoValue, '2034-10-30');
});

test('compone il messaggio documento da catalogo, configurazione, numero ed ente', () => {
    const catalog = {
        profile_document_message_expiry: 'È in scadenza {document}.',
        profile_document_message_number: 'Numero {number}.',
        profile_document_message_issuer: 'Rilasciato da {issuer}.',
        profile_document_name_driving_licence: 'la patente',
        profile_document_name_identity_card: 'la carta d’identità',
        profile_document_name_tax_code: 'il codice fiscale',
        profile_document_name_passport: 'il passaporto',
        document: 'Documento'
    };
    const translate = key => catalog[key] || key;
    assert.equal(model.profileDocumentDeadlineMessage({
        documentType: 'Passaporto', documentNumber: 'AA123', documentIssuer: 'Questura'
    }, translate), 'È in scadenza il passaporto. Numero AA123. Rilasciato da Questura.');
    assert.equal(model.profileDocumentDeadlineMessage({
        templateText: 'il passaporto', documentType: 'Passaporto', documentNumber: 'AA123'
    }, translate), 'È in scadenza il passaporto. Numero AA123.');
    assert.equal(model.profileDocumentDeadlineMessage({
        templateText: 'Il tuo passaporto', documentType: 'Passaporto'
    }, translate), 'È in scadenza il passaporto.');
    assert.equal(model.profileDocumentDeadlineMessage({
        templateText: 'il passaporto diplomatico', documentType: 'Passaporto'
    }, translate), 'È in scadenza il passaporto diplomatico.');
    assert.equal(model.profileDocumentDeadlineMessage({documentType: 'Patente'}, translate), 'È in scadenza la patente.');
    assert.equal(model.profileDocumentDeadlineMessage({documentType: "Carta d'identità"}, translate), 'È in scadenza la carta d’identità.');
    assert.equal(model.profileDocumentDeadlineMessage({documentType: 'Codice fiscale'}, translate), 'È in scadenza il codice fiscale.');
});
