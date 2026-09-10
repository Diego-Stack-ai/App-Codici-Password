import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeLegacyEmailMetadata} from '../scripts/lib/legacy-email-audit-model.mjs';

test('produce solo conteggi aggregati per email personali e aziendali', () => {
    const summary = summarizeLegacyEmailMetadata([{
        profile: {contactEmails: [
            {id: 'e1', address: 'segreto@example.test', password: 'ciphertext', linkedAccountId: 'a1'},
            {id: 'e2', address: 'altro@example.test'}
        ]},
        privateAccounts: [
            {id: 'a1', nomeAccount: 'Riservato', linkedProfileField: {type: 'email', id: 'e1'}},
            {id: 'same-id'}
        ],
        companies: [{
            id: 'company-secret',
            data: {emails: {pec: {email: 'pec@example.test', password: 'ciphertext'}}, aziendaEmailPassword: 'legacy'},
            accounts: [{id: 'same-id', nomeAccount: 'Legal Mail'}]
        }]
    }]);

    assert.equal(summary.profileEmailEntries, 2);
    assert.equal(summary.profileEmailLinkedWithPasswordField, 1);
    assert.equal(summary.companyEmailPasswordFieldPresent, 1);
    assert.equal(summary.companyLegacyPasswordFieldPresent, 1);
    assert.equal(summary.crossScopeAccountIdCollisions, 1);
    assert.equal(JSON.stringify(summary).includes('segreto@example.test'), false);
    assert.equal(JSON.stringify(summary).includes('company-secret'), false);
    assert.equal(JSON.stringify(summary).includes('Legal Mail'), false);
});

test('segnala collegamenti profilo non simmetrici senza esporre gli identificativi', () => {
    const summary = summarizeLegacyEmailMetadata([{
        profile: {contactEmails: [{id: 'email-a', linkedAccountId: 'account-a'}]},
        privateAccounts: [{id: 'account-b', linkedProfileField: {type: 'email', id: 'email-b'}}],
        companies: []
    }]);
    assert.equal(summary.profileLinksMissingBacklink, 1);
    assert.equal(summary.profileBacklinksMissingEmailLink, 1);
});
