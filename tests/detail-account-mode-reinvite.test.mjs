import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const strip = text => text.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');

test('il dettaglio carica soltanto i nomi attivi della rubrica del proprietario', async () => {
    const source = strip(await readFile(new URL('shared/detail-account-mode.js', modules), 'utf8'));
    const context = vm.createContext({
        auth: {currentUser: {uid: 'owner', email: 'owner@example.invalid'}},
        listContacts: async () => [
            {uid: 'owner', email: 'owner@example.invalid', nome: 'Proprietario'},
            {email: 'guest@example.invalid', nome: 'Ospite', cognome: 'Sintetico', active: true},
            {email: 'inactive@example.invalid', nome: 'Inattivo', active: false}
        ],
        console: {warn() {}}
    });
    vm.runInContext(source, context);
    const names = await context.loadDetailSharingContactNames({ownerId: 'owner'});
    assert.equal(JSON.stringify([...names]), JSON.stringify([['guest@example.invalid', 'Ospite Sintetico']]));
});

test('il dettaglio non contiene writer, inviti o controlli di modifica condivisione', async () => {
    const sources = await Promise.all([
        'shared/detail-account-mode.js',
        'privato/dettaglio-privato-sharing.js',
        'azienda/dettaglio-azienda-sharing.js'
    ].map(file => readFile(new URL(file, modules), 'utf8')));
    for (const source of sources) {
        assert.doesNotMatch(source, /runTransaction|updateDoc|setDoc|deleteDoc|inviteIdForGuest|showConfirmModal|revokeRecipient/);
    }
});

test('tipo e destinatari restano gestiti nei form e i rifiutati non sono preselezionati', async () => {
    for (const file of ['privato/form_account_privato.js', 'azienda/form_account_azienda.js']) {
        const source = await readFile(new URL(file, modules), 'utf8');
        assert.match(source, /status !== 'suspended' && guest\?\.status !== 'rejected'/);
    }
});

test('le pagine dettaglio espongono solo la sezione Condivisione', async () => {
    for (const type of ['privato', 'azienda']) {
        const html = await readFile(new URL(`../Frontend/public/dettaglio_account_${type}.html`, import.meta.url), 'utf8');
        assert.match(html, /id="shared-management-section"[\s\S]*?>Condivisione</);
        assert.doesNotMatch(html, /id="account-mode-section"|id="btn-save-account-mode"|account-mode-contact-list/);
    }
});
