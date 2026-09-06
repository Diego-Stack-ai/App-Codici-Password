import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-recipient-model.js', import.meta.url), 'utf8');
const {
    isValidRecipientEmail, mergeDeadlineRecipient, normalizeDeadlineRecipient, normalizeRecipientEmail
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('normalizza e valida l’email senza esporre identificatori tecnici', () => {
    assert.equal(normalizeRecipientEmail('  Maria@Example.IT '), 'maria@example.it');
    assert.equal(isValidRecipientEmail('maria@example.it'), true);
    assert.equal(isValidRecipientEmail('maria.example.it'), false);
});

test('mantiene tutte le quattro combinazioni Email e Push', () => {
    for (const [sendEmail, sendPush] of [[false, false], [true, false], [false, true], [true, true]]) {
        assert.deepEqual(normalizeDeadlineRecipient({email: 'maria@example.it', sendEmail, sendPush}), {
            email: 'maria@example.it', displayName: '', contactId: '', sendEmail, sendPush
        });
    }
});

test('deduplica per email normalizzata e unisce i canali richiesti', () => {
    const initial = [{email: 'maria@example.it', displayName: '', contactId: '', sendEmail: true, sendPush: false}];
    const result = mergeDeadlineRecipient(initial, {
        email: ' MARIA@example.it ', displayName: 'Maria Rossi', contactId: 'c1', sendEmail: false, sendPush: true
    });
    assert.equal(result.recipients.length, 1);
    assert.deepEqual(result.recipients[0], {
        email: 'maria@example.it', displayName: 'Maria Rossi', contactId: 'c1', sendEmail: true, sendPush: true
    });
    assert.notEqual(result.recipients, initial);
});
