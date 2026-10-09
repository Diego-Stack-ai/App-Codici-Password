import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const guardSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/credential-decrypt-guard.js', import.meta.url), 'utf8');
const {DECRYPT_FAILURE_MESSAGE, assertAccountSaveAllowed, createAccountLoadContext, isAccountSaveAllowed} =
    await import(`data:text/javascript;base64,${Buffer.from(guardSource).toString('base64')}`);

// M7-R7C-2 correzione (revisione Codex 21/09/2026) — il percorso REALE di
// scrittura della condivisione ricalcola `sharedWithUids` dalle voci di
// `sharedWith`: dopo un ripristino che ha sospeso le voci, un salvataggio non
// deve poter ricreare accessi senza un nuovo invito accettato.
const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const strip = text => text.replace(/^export \{[^}]*\} from ['"][^'"]*['"];\r?\n/gm, '')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const source = strip(await readFile(new URL('privato/form-privato-save.js', modules), 'utf8'));
const companySource = strip(await readFile(new URL('azienda/form-azienda-save.js', modules), 'utf8'));
// M7-R7C-1: il writer usa gli helper di ciclo/invito di `utils.js`; il banco li
// inietta nel contesto perché gli `import` vengono rimossi dai sorgenti.
const utilsSource = await readFile(new URL('../utils.js', modules), 'utf8');
const {inviteIdForGuest, sanitizeEmail, sharingCycleOf} =
    await import('data:text/javascript;base64,' + Buffer.from(utilsSource).toString('base64'));
const recipientSource = await readFile(new URL('shared/account-mode-model.js', modules), 'utf8');
const {isOwnerRecipientEmail, preferenceForRecipient} =
    await import('data:text/javascript;base64,' + Buffer.from(recipientSource).toString('base64'));

const GUEST_KEY = 'guest_example_invalid';
const OTHER_KEY = 'other_example_invalid';
const GUEST_EMAIL = 'guest@example.invalid';
const ACCOUNT_PATH = 'users/owner/accounts/account-1';
const COMPANY_PATH = 'users/owner/aziende/company-1/accounts/account-1';

// M7-AUDIT-5C — ogni creazione/reinvito dichiara una base opaca dell'istanza di
// invito. Il banco inietta `crypto` (come già fa per gli altri globali del
// browser) e produce UUID validi e distinti a ogni chiamata, così la freschezza
// del marcatore è verificabile.
const AUDIT_REF = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Le sole chiavi ammesse dalla creazione degli inviti nelle Rules di produzione
// (`firestore.rules`, `match /invites/{inviteId}`): il payload dei writer deve
// restare dentro questo insieme, altrimenti la creazione verrebbe negata.
const RULES_INVITE_CREATE_KEYS = ['inviteId', 'recipientEmail', 'accountId', 'accountName', 'ownerId',
    'senderId', 'senderEmail', 'aziendaId', 'type', 'status', 'createdAt', 'notifyPush', 'notifyEmail',
    'cycle', 'auditRef'];
let markerCount = 0;
const newMarker = () => `00000000-0000-4000-8000-${String(++markerCount).padStart(12, '0')}`;
const assertInvitePayload = payload => {
    assert.match(payload.auditRef, AUDIT_REF, 'l\'invito dichiara una base opaca valida');
    assert.deepEqual(Object.keys(payload).filter(key => !RULES_INVITE_CREATE_KEYS.includes(key)), [],
        'nessuna chiave fuori dall\'allowlist di creazione delle Rules');
};

// Stato dopo il ripristino fail-closed: ciclo avanzato, nessun grant, voci sospese.
const restoredAccount = () => ({revision: 2, updatedAt: '2026-01-01T00:00:00.000Z', visibility: 'shared',
    sharingCycle: 1, sharedWithUids: [], acceptedCount: 0, nomeAccount: 'Account sintetico', type: 'account',
    sharedWith: {
        [GUEST_KEY]: {email: GUEST_EMAIL, status: 'suspended', uid: null, suspendedAt: '2026-01-01T00:00:00.000Z'},
        [OTHER_KEY]: {email: 'other@example.invalid', status: 'suspended', uid: null, suspendedAt: '2026-01-01T00:00:00.000Z'}
    }});

async function fixture(accountState = restoredAccount(), company = false) {
    const writes = [];
    const accountPath = company ? COMPANY_PATH : ACCOUNT_PATH;    const fields = {'account-name': {value: 'Account sintetico'}, 'invite-email': {value: ''},
        'flag-shared': {checked: true}, 'flag-memo': {checked: false}, 'flag-memo-shared': {checked: false}};
    const context = vm.createContext({
        auth: {currentUser: {uid: 'owner', email: 'owner@example.invalid'}}, db: {},
        inviteIdForGuest, sanitizeEmail, sharingCycleOf, isOwnerRecipientEmail, preferenceForRecipient, structuredClone,
        crypto: {randomUUID: newMarker},
        doc: (_db, ...path) => ({path: path.join('/'), id: path.at(-1)}),
        collection: (_db, ...path) => ({path: path.join('/'), id: path.at(-1)}),
        deleteField: () => ({__delete: true}), increment: value => ({__increment: value}),
        runTransaction: async (_db, callback) => {
            const staged = [];
            await callback({
                get: async reference => {
                    const data = reference.path === accountPath ? accountState : {contactEmails: []};
                    return {exists: () => true, data: () => structuredClone(data)};
                },
                update: (reference, patch) => staged.push([reference.path, patch, 'update']),
                set: (reference, patch) => staged.push([reference.path, patch, 'set']),
                delete: reference => staged.push([reference.path, {deleted: true}, 'delete'])
            });
            writes.push(...staged);
        },
        showAlertModal: async () => true, showToast: () => {}, t: key => key, LOG: () => {}, logError: () => {},
        encrypt: async value => (value ? `cipher:${value}` : ''), ensureVaultKeyMaterial: async () => 'key',
        decodeProfileContactValue: async value => value, classifyPrivateAccountOfflineWrite: () => ({eligible: false}),
        formatCardExpiry: value => value, hasInvalidCardExpiry: () => false,
        accountModeFromFlags: () => 'account-shared',
        recordFieldsFromAccountMode: () => ({visibility: 'shared', type: 'account'}),
        validateAccountMode: () => ({}),
        findProfileAccountItem: () => null, patchProfileAccountItem: profile => profile, profileAccountReferences: () => [],
        linkProfileEmailToAccount: () => ({}), isProfileEmailPasswordTransferred: () => false, prepareCompanyProfileLink: () => ({}),
        isAccountSaveAllowed, assertAccountSaveAllowed, DECRYPT_FAILURE_MESSAGE,
        document: {getElementById: id => fields[id] || null, querySelector: () => null}, navigator: {onLine: true},
        sessionStorage: {removeItem: () => {}}, setTimeout: () => {}, console: {error: () => {}, warn: () => {}}
    });
    vm.runInContext(company ? companySource : source, context);
    return {writes,
        createdInvites: () => writes.filter(write => write[0].startsWith('invites/') && write[2] === 'set'),
        save: (invitedEmails, invitePreferences = {}) => company ? context.saveAccount({
            bankAccounts: [], invitedEmails, invitePreferences, isExplicitMemo: false, currentUid: 'owner',
            currentDocId: 'account-1', currentAziendaId: 'company-1', isEditing: true,
            profileContactLinkDraft: null, baseRevision: 2, loadContext: createAccountLoadContext({mode: 'create'})
        }) : context.savePrivateAccount({
            bankAccounts: [], invitedEmails, invitePreferences, isExplicitMemo: false, currentUid: 'owner',
            currentDocId: 'account-1', currentAziendaId: '', isEditing: true,
            profileContactLinkDraft: null, baseRevision: 2, loadContext: createAccountLoadContext({mode: 'create'})
        })};
}

test('salvataggio dopo il ripristino: le voci sospese non ricreano alcun grant', async () => {
    const f = await fixture();
    await f.save(['other@example.invalid']);
    const account = f.writes.find(write => write[0] === ACCOUNT_PATH);
    assert.ok(account, 'l\'Account viene salvato');
    assert.equal(account[1].sharedWithUids.length, 0, 'nessun grant ricreato dalle voci sospese');
    assert.equal(account[1].acceptedCount, 0);
    // Solo il contatto riselezionato riceve un nuovo invito; l'altro viene rimosso.
    assert.deepEqual(f.createdInvites().map(write => write[0]), ['invites/account-1_other_example_invalid_c1']);
    assert.deepEqual(f.writes.filter(write => write[2] === 'delete').map(write => write[0]),
        ['invites/account-1_guest_example_invalid_c1']);
    assert.equal(account[1].sharedWith[GUEST_KEY], undefined, 'la voce sospesa non riselezionata viene rimossa');
});

test('salvataggio con l\'ospite riselezionato: nuovo invito del ciclo corrente e accesso solo dopo l\'accettazione', async () => {
    const f = await fixture();
    await f.save([GUEST_EMAIL]);
    const [invite] = f.createdInvites();
    assert.ok(invite, 'viene creato un nuovo invito');
    assert.equal(invite[0], 'invites/account-1_guest_example_invalid_c1', 'ID del ciclo corrente');
    assert.equal(invite[1].cycle, 1);
    assert.equal(invite[1].status, 'pending');
    // M7-AUDIT-5C: base opaca presente e payload dentro l'allowlist delle Rules.
    assertInvitePayload(invite[1]);
    const account = f.writes.find(write => write[0] === ACCOUNT_PATH);
    assert.equal(account[1].sharedWithUids.length, 0, 'l\'accesso non torna prima dell\'accettazione');
    assert.equal(account[1].sharedWith[GUEST_KEY].status, 'pending');
});

test('le preferenze per destinatario sono salvate nel record e nel nuovo invito', async () => {
    for (const company of [false, true]) {
        const f = await fixture(restoredAccount(), company);
        await f.save([GUEST_EMAIL], {[GUEST_EMAIL]: {notifyPush: false, notifyEmail: true}});
        const [invite] = f.createdInvites();
        assert.equal(invite[1].notifyPush, false);
        assert.equal(invite[1].notifyEmail, true);
        const accountPath = company ? COMPANY_PATH : ACCOUNT_PATH;
        const account = f.writes.find(write => write[0] === accountPath);
        assert.equal(account[1].sharedWith[GUEST_KEY].notifyPush, false);
        assert.equal(account[1].sharedWith[GUEST_KEY].notifyEmail, true);
    }
});

test('controprova dell\'invariante: una voce ancora accettata ricrea il grant al salvataggio', async () => {
    // questo stesso percorso ricalcolerebbe `sharedWithUids` e ridarebbe accesso
    // senza un nuovo invito: è il motivo per cui R7C-2 deve sospenderla.
    const stale = restoredAccount();
    stale.sharedWith[GUEST_KEY] = {email: GUEST_EMAIL, status: 'accepted', uid: 'guest-uid'};
    const f = await fixture(stale);
    await f.save([GUEST_EMAIL]);
    const account = f.writes.find(write => write[0] === ACCOUNT_PATH);
    assert.deepEqual([...account[1].sharedWithUids], ['guest-uid'], 'il writer ricostruisce i grant dalle voci accettate');
    assert.equal(f.createdInvites().length, 0, 'una voce accettata non richiede un nuovo invito');
});

// M7-R7C-5: stesso percorso nell'editor aziendale.

test('azienda: un salvataggio dopo il ripristino non ricrea accessi', async () => {
    const f = await fixture(restoredAccount(), true);
    await f.save(['other@example.invalid']);
    const account = f.writes.find(write => write[0] === COMPANY_PATH);
    assert.ok(account, 'l\'Account aziendale viene salvato');
    assert.equal(account[1].sharedWithUids.length, 0);
    assert.equal(account[1].acceptedCount, 0);
    assert.deepEqual(f.createdInvites().map(write => write[0]),
        ['invites/account-1_other_example_invalid_c1'], 'solo per il contatto riselezionato');
});

test('azienda: l\'ospite sospeso riselezionato riceve un invito del ciclo corrente', async () => {
    const f = await fixture(restoredAccount(), true);
    await f.save([GUEST_EMAIL]);
    const [invite] = f.createdInvites();
    assert.equal(invite[0], 'invites/account-1_guest_example_invalid_c1');
    assert.equal(invite[1].cycle, 1);
    assert.equal(invite[1].aziendaId, 'company-1');
    assert.equal(invite[1].status, 'pending');
    // M7-AUDIT-5C: base opaca presente anche nel writer aziendale.
    assertInvitePayload(invite[1]);
    const account = f.writes.find(write => write[0] === COMPANY_PATH);
    assert.equal(account[1].sharedWithUids.length, 0, 'l\'accesso non torna prima dell\'accettazione');
    assert.equal(account[1].sharedWith[GUEST_KEY].status, 'pending');
});
