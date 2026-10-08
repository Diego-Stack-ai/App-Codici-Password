import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

// M7-R7B4 — modello puro dell'avviso prima dell'archiviazione condivisa:
// solo email e stato, forme legacy unite e deduplicate, nessun segreto.
const source = await readFile(new URL('../Frontend/public/assets/js/modules/settings/archive-account-model.js', import.meta.url), 'utf8');
const {archiveRecipients, archiveConfirmMessage} = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const translate = key => `[${key}]`;

test('archivio: Account senza condivisioni non produce elenco né testo aggiuntivo', () => {
    for (const account of [null, undefined, {}, {sharedWith: {}}, {sharedWith: []}, {sharedWithEmails: []}, {recipientEmail: ''}]) {
        assert.deepEqual(archiveRecipients(account), []);
        assert.equal(archiveConfirmMessage(account, translate), '[confirm_archive_msg]');
    }
});

test('archivio: un destinatario accettato entra nell\'avviso con il suo stato', () => {
    const recipients = archiveRecipients({sharedWith: {key: {email: 'Guest@Example.invalid', status: 'accepted'}}});
    assert.deepEqual(recipients, [{email: 'guest@example.invalid', status: 'accepted'}]);
    const message = archiveConfirmMessage({sharedWith: {key: {email: 'Guest@Example.invalid', status: 'accepted'}}}, translate);
    assert.match(message, /\[confirm_archive_msg\] \[confirm_archive_recipients_label\] guest@example\.invalid\./);
    assert.match(message, /\[confirm_archive_suspend_msg\] \[confirm_archive_recipients_caveat\]$/);
});

test('archivio: più destinatari pendenti e accettati mantengono l\'ordine del documento', () => {
    const account = {sharedWith: {
        first: {email: 'one@example.invalid', status: 'pending'},
        second: {email: 'two@example.invalid', status: 'accepted'},
        third: {email: 'three@example.invalid', status: 'pending'}
    }};
    assert.deepEqual(archiveRecipients(account).map(recipient => recipient.email),
        ['one@example.invalid', 'two@example.invalid', 'three@example.invalid']);
    assert.match(archiveConfirmMessage(account, translate), /one@example\.invalid, two@example\.invalid, three@example\.invalid\./);
});

test('archivio: un destinatario rifiutato non compare e da solo non cambia il testo base', () => {
    const account = {sharedWith: {key: {email: 'rejected@example.invalid', status: 'rejected'}}};
    assert.deepEqual(archiveRecipients(account), []);
    assert.equal(archiveConfirmMessage(account, translate), '[confirm_archive_msg]');
});

test('archivio: forme legacy unite e deduplicate senza duplicati', () => {
    const account = {
        sharedWith: {key: {email: 'Accepted@Example.invalid', status: 'accepted'}},
        sharedWithEmails: ['accepted@example.invalid', 'legacy@example.invalid', {email: 'Object@Example.invalid'}],
        recipientEmail: 'legacy@example.invalid'
    };
    assert.deepEqual(archiveRecipients(account), [
        {email: 'accepted@example.invalid', status: 'accepted'},
        {email: 'legacy@example.invalid', status: 'legacy'},
        {email: 'object@example.invalid', status: 'legacy'}
    ]);
    const message = archiveConfirmMessage(account, translate);
    assert.equal(message.match(/accepted@example\.invalid/g).length, 1);
    assert.equal(message.match(/legacy@example\.invalid/g).length, 1);
});

test('archivio: voci vuote o non riconoscibili come email vengono ignorate', () => {
    const account = {
        sharedWith: {
            empty: {email: '', status: 'accepted'},
            shape: {email: 'not-an-email', status: 'accepted'},
            missing: {status: 'accepted'},
            number: {email: 42, status: 'accepted'},
            text: 'plain-text',
            valid: {email: 'valid@example.invalid', status: 'pending'}
        },
        sharedWithEmails: [null, undefined, 7, {}, {email: '   '}, 'valid@example.invalid']
    };
    assert.deepEqual(archiveRecipients(account), [{email: 'valid@example.invalid', status: 'pending'}]);
});

test('archivio: l\'avviso non contiene credenziali, note, codici o allegati', () => {
    const account = {
        nomeAccount: 'Banca Sintetica',
        username: 'SYNTH-USERNAME',
        account: 'SYNTH-CODICE',
        password: 'SYNTH-PASSWORD',
        note: 'SYNTH-NOTE',
        banking: [{iban: 'SYNTH-IBAN', cards: [{cardNumber: 'SYNTH-CARD'}]}],
        attachments: [{name: 'SYNTH-ALLEGATO'}],
        sharedWith: {key: {email: 'guest@example.invalid', status: 'accepted'}}
    };
    const message = archiveConfirmMessage(account, translate);
    assert.match(message, /guest@example\.invalid/);
    for (const secret of ['SYNTH-USERNAME', 'SYNTH-CODICE', 'SYNTH-PASSWORD', 'SYNTH-NOTE', 'SYNTH-IBAN', 'SYNTH-CARD', 'SYNTH-ALLEGATO']) {
        assert.equal(message.includes(secret), false, `il messaggio non deve contenere ${secret}`);
    }
});

test('archivio: il traduttore fornito è l\'unica fonte dei testi', () => {
    const calls = [];
    const message = archiveConfirmMessage({sharedWith: {key: {email: 'guest@example.invalid', status: 'accepted'}}},
        key => { calls.push(key); return `<${key}>`; });
    assert.deepEqual(calls, ['confirm_archive_msg', 'confirm_archive_recipients_label',
        'confirm_archive_suspend_msg', 'confirm_archive_recipients_caveat']);
    assert.equal(message, '<confirm_archive_msg> <confirm_archive_recipients_label> guest@example.invalid. '
        + '<confirm_archive_suspend_msg> <confirm_archive_recipients_caveat>');
});
