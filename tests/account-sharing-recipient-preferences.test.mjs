import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const helperSource = await readFile(new URL('shared/account-mode-model.js', modules), 'utf8');
const helpers = await import(`data:text/javascript;base64,${Buffer.from(helperSource).toString('base64')}`);

test('la rubrica destinatari esclude il proprietario per UID, ID ed email', () => {
    const contacts = [
        {uid: 'owner', email: 'alias@example.invalid'},
        {id: 'owner', email: 'other@example.invalid'},
        {uid: 'other', email: 'OWNER@example.invalid'},
        {uid: 'guest', email: 'guest@example.invalid'},
        {uid: 'inactive', email: 'inactive@example.invalid', active: false}
    ];
    assert.deepEqual(helpers.filterRecipientContacts(contacts, {ownerUid: 'owner', ownerEmail: 'owner@example.invalid'}),
        [contacts[3]]);
});

test('le preferenze Push ed Email sopravvivono a caricamento e serializzazione', () => {
    const preferences = helpers.recipientPreferencesFromSharedWith({
        guest: {email: 'Guest@example.invalid', status: 'pending', notifyPush: false, notifyEmail: true}
    });
    assert.deepEqual(helpers.serializeRecipientPreferences(preferences, ['guest@example.invalid']), {
        'guest@example.invalid': {notifyPush: false, notifyEmail: true}
    });
    assert.deepEqual(helpers.preferenceForRecipient(null, 'new@example.invalid'), {notifyPush: true, notifyEmail: false});
});

test('i form usano controlli per destinatario e non checkbox globali', async () => {
    for (const file of ['privato/form_account_privato.js', 'azienda/form_account_azienda.js']) {
        const source = await readFile(new URL(file, modules), 'utf8');
        assert.match(source, /account-guest-channels/);
        assert.match(source, /serializeRecipientPreferences\(recipientPreferences, invitedEmails\)/);
        assert.match(source, /filterRecipientContacts\(/);
    }
    for (const file of ['../../../form_account_privato.html', '../../../form_account_azienda.html']) {
        const html = await readFile(new URL(file, modules), 'utf8');
        assert.doesNotMatch(html, /invite-notify-push|invite-notify-email/);
    }
});

test('i writer persistono le preferenze nel record e nel nuovo invito', async () => {
    for (const file of ['privato/form-privato-save.js', 'azienda/form-azienda-save.js']) {
        const source = await readFile(new URL(file, modules), 'utf8');
        assert.match(source, /const notificationPreference = preferenceForRecipient\(invitePreferences, email\)/);
        assert.match(source, /finalData\.sharedWith\[sKey\] = \{\.\.\.existingGuest, \.\.\.notificationPreference\}/);
        assert.match(source, /notifyPush: notificationPreference\.notifyPush/);
        assert.match(source, /notifyEmail: notificationPreference\.notifyEmail/);
        assert.match(source, /isOwnerRecipientEmail\(email, auth\.currentUser\?\.email\)/);
    }
});
