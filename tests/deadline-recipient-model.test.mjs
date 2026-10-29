import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/scadenze/deadline-recipient-model.js', import.meta.url), 'utf8');
const {
    contactHasCompanyAssociation, deadlineCompanyContextFromRecord, deadlineDomainNeedsCompany,
    deadlineRecipientDisplayName, deadlineRecipientFields, deadlineRecipientsFromRecord,
    isValidRecipientEmail, mergeContactCompanyAssociation, mergeDeadlineRecipient,
    normalizeDeadlineCompanyContext, normalizeDeadlineRecipient, normalizeRecipientEmail,
    replaceContactCompanyAssociations, sortDeadlineContacts
} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('normalizza e valida l’email senza esporre identificatori tecnici', () => {
    assert.equal(normalizeRecipientEmail('  Maria@Example.IT '), 'maria@example.it');
    assert.equal(isValidRecipientEmail('maria@example.it'), true);
    assert.equal(isValidRecipientEmail('maria.example.it'), false);
});

test('mantiene tutte le quattro combinazioni Email e Push', () => {
    for (const [sendEmail, sendPush] of [[false, false], [true, false], [false, true], [true, true]]) {
        assert.deepEqual(normalizeDeadlineRecipient({email: 'maria@example.it', sendEmail, sendPush}), {
            email: 'maria@example.it', displayName: '', contactId: '', sendEmail, sendPush, canManage: false
        });
    }
});

test('deduplica per email normalizzata e unisce i canali richiesti', () => {
    const initial = [{
        email: 'maria@example.it', displayName: '', contactId: '',
        sendEmail: true, sendPush: false, canManage: false
    }];
    const result = mergeDeadlineRecipient(initial, {
        email: ' MARIA@example.it ', displayName: 'Maria Rossi', contactId: 'c1',
        sendEmail: false, sendPush: true, canManage: true
    });
    assert.equal(result.recipients.length, 1);
    assert.deepEqual(result.recipients[0], {
        email: 'maria@example.it', displayName: 'Maria Rossi', contactId: 'c1',
        sendEmail: true, sendPush: true, canManage: true
    });
    assert.notEqual(result.recipients, initial);
});

test('legge i destinatari legacy come Email attiva e Push disattiva', () => {
    assert.deepEqual(deadlineRecipientsFromRecord({ email1: ' A@Example.it ', email2: '' }), [{
        email: 'a@example.it', displayName: '', contactId: '',
        sendEmail: true, sendPush: false, canManage: false
    }]);
});

test('i destinatari moderni prevalgono sui campi legacy', () => {
    assert.deepEqual(deadlineRecipientsFromRecord({
        recipients: [{ email: 'push@example.it', sendEmail: false, sendPush: true }],
        email1: 'legacy@example.it'
    }), [{
        email: 'push@example.it', displayName: '', contactId: '',
        sendEmail: false, sendPush: true, canManage: false
    }]);
});

test('scrive i campi email retrocompatibili senza perdere Push only', () => {
    assert.deepEqual(deadlineRecipientFields([
        { email: 'email@example.it', sendEmail: true, sendPush: false },
        { email: 'push@example.it', sendEmail: false, sendPush: true }
    ]), {
        recipients: [
            {
                email: 'email@example.it', displayName: '', contactId: '',
                sendEmail: true, sendPush: false, canManage: false
            },
            {
                email: 'push@example.it', displayName: '', contactId: '',
                sendEmail: false, sendPush: true, canManage: false
            }
        ],
        email1: 'email@example.it',
        email2: ''
    });
});

test('normalizza il permesso di gestione senza abilitarlo implicitamente', () => {
    assert.equal(normalizeDeadlineRecipient({email: 'view@example.it'}).canManage, false);
    assert.equal(normalizeDeadlineRecipient({email: 'manage@example.it', canManage: true}).canManage, true);
});

test('collega esplicitamente un solo contatto a più aziende senza interpretare etichette', () => {
    const pax = normalizeDeadlineCompanyContext({kind: 'company', companyId: 'pax', companyName: 'Pax Tibi srl'});
    const external = normalizeDeadlineCompanyContext({kind: 'external', companyName: 'Fornitore esterno'});
    let contact = {id: 'c1', nome: 'Diego', cognome: 'Boschetto', email: 'diego@example.it'};
    contact = mergeContactCompanyAssociation(contact, pax);
    contact = mergeContactCompanyAssociation(contact, external);
    contact = mergeContactCompanyAssociation(contact, pax);
    assert.equal(contact.companyAssociations.length, 2);
    assert.equal(contactHasCompanyAssociation(contact, pax), true);
    assert.equal(deadlineRecipientDisplayName(contact, pax), 'Diego Boschetto');
    assert.equal(deadlineRecipientDisplayName({...contact, cognome: 'Boschetto-Pax'}, null), 'Diego Boschetto-Pax');
});

test('mostra nome ed email senza attribuire l’azienda corrente a tutti i contatti', () => {
    const bm = normalizeDeadlineCompanyContext({kind: 'company', companyId: 'bm', companyName: 'BM Service'});
    const linked = mergeContactCompanyAssociation({id: 'linked', nome: 'Diego', email: 'bm@example.it'}, bm);
    const privateContact = {id: 'private', nome: 'Diego', email: 'privato@example.it'};
    assert.deepEqual(sortDeadlineContacts([privateContact, linked], bm).map(item => item.id), ['linked', 'private']);
    assert.equal(deadlineRecipientDisplayName(privateContact, bm), 'Diego');
});

test('sostituisce esplicitamente i collegamenti senza duplicati o associazioni implicite', () => {
    const bm = {kind: 'company', companyId: 'bm', companyName: 'BM Service'};
    const pax = {kind: 'company', companyId: 'pax', companyName: 'Pax Tibi'};
    const contact = replaceContactCompanyAssociations({id: 'c1', companyAssociations: [bm]}, [pax, pax]);
    assert.deepEqual(contact.companyAssociations, [pax]);
});

test('richiede il contesto azienda solo negli ambiti aziendali e legge i record esistenti', () => {
    assert.equal(deadlineDomainNeedsCompany('company'), true);
    assert.equal(deadlineDomainNeedsCompany('user-company'), true);
    assert.equal(deadlineDomainNeedsCompany('vehicles'), false);
    assert.deepEqual(deadlineCompanyContextFromRecord({
        companyContextKind: 'company', companyId: 'a1', companyName: 'Azienda Uno'
    }), {kind: 'company', companyId: 'a1', companyName: 'Azienda Uno'});
    assert.equal(normalizeDeadlineCompanyContext({kind: 'company', companyName: 'Manca id'}), null);
});
