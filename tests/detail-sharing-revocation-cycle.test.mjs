import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// M7-R7C-5 — la revoca esplicita dell'ospite deve colpire l'invito del CICLO
// CORRENTE. Con l'ID storico la cancellazione non troverebbe nulla dopo un
// ripristino e l'invito resterebbe vivo. Prove sui due moduli reali di condivisione.
const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const strip = text => text.replace(/^export \{[^}]*\} from ['"][^'"]*['"];\r?\n/gm, '')
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const utilsSource = await readFile(new URL('../utils.js', modules), 'utf8');
const {inviteIdForGuest, sanitizeEmail, sharingCycleOf} =
    await import('data:text/javascript;base64,' + Buffer.from(utilsSource).toString('base64'));
const sources = {
    privato: strip(await readFile(new URL('privato/dettaglio-privato-sharing.js', modules), 'utf8')),
    azienda: strip(await readFile(new URL('azienda/dettaglio-azienda-sharing.js', modules), 'utf8'))
};

const EMAIL = 'guest@example.invalid';
const KEY = 'guest_example_invalid';

function fixture(area, {cycle = 1, accepted = true} = {}) {
    const writes = [];
    const account = {nomeAccount: 'Sintetico', type: 'account', visibility: 'shared',
        acceptedCount: accepted ? 1 : 0, sharingCycle: cycle,
        sharedWith: {[KEY]: {email: EMAIL, status: accepted ? 'accepted' : 'pending', uid: accepted ? 'guest-uid' : null}}};
    const context = vm.createContext({
        inviteIdForGuest, sanitizeEmail, sharingCycleOf, structuredClone,
        db: {}, auth: {currentUser: {uid: 'owner', email: 'owner@example.invalid'}},
        doc: (_db, ...path) => ({path: path.join('/')}),
        collection: (_db, ...path) => ({path: path.join('/')}),
        runTransaction: async (_db, callback) => {
            const staged = [];
            await callback({
                get: async () => ({exists: () => true, data: () => structuredClone(account)}),
                update: (reference, patch) => staged.push(['update', reference.path, patch]),
                delete: reference => staged.push(['delete', reference.path]),
                set: (reference, patch) => staged.push(['set', reference.path, patch])
            });
            writes.push(...staged);
        },
        showToast: () => {}, showConfirmModal: async () => true, t: key => key,
        createElement: (tag, props, children) => ({tag, ...props, children}), clearElement: () => {},
        document: {getElementById: () => null, querySelector: () => null},
        console: {warn: () => {}, error: () => {}}, getInvite: async () => null
    });
    vm.runInContext(sources[area], context);
    if (area === 'privato') {
        context.initPrivateSharingModule({currentUid: 'owner', ownerId: 'owner', accountId: 'account-1',
            readOnly: false, onReload: async () => {}, isActive: () => true, confirm: async () => true});
        return {writes, revoke: () => context.revokeRecipient(EMAIL)};
    }
    context.initSharingModule({currentUid: 'owner', currentAziendaId: 'company-1', currentId: 'account-1',
        isReadOnly: false, onReload: async () => {}, isActive: () => true, confirm: async () => true, sharingCycle: cycle});
    return {writes, revoke: () => context.revokeRecipientV3(EMAIL)};
}

test('privato: la revoca colpisce l\'invito del ciclo corrente, non l\'ID storico', async () => {
    const f = fixture('privato', {cycle: 1});
    await f.revoke();
    assert.deepEqual(f.writes.filter(write => write[0] === 'delete').map(write => write[1]),
        ['invites/account-1_guest_example_invalid_c1']);
    const account = f.writes.find(write => write[0] === 'update' && write[1].endsWith('/accounts/account-1'));
    assert.equal(account[2].sharedWith[KEY], undefined, 'la voce viene rimossa');
    assert.equal(account[2].sharedWithUids.length, 0, 'nessun grant residuo');
});

test('privato: al ciclo legacy resta l\'ID storico', async () => {
    const f = fixture('privato', {cycle: 0});
    await f.revoke();
    assert.deepEqual(f.writes.filter(write => write[0] === 'delete').map(write => write[1]),
        ['invites/account-1_guest_example_invalid']);
});

test('azienda: la revoca colpisce l\'invito del ciclo corrente', async () => {
    const f = fixture('azienda', {cycle: 3});
    await f.revoke();
    assert.deepEqual(f.writes.filter(write => write[0] === 'delete').map(write => write[1]),
        ['invites/account-1_guest_example_invalid_c3']);
    assert.equal(f.writes.some(write => write[0] === 'update' && write[1].includes('/accounts/account-1')), true);
});

test('azienda: al ciclo legacy resta l\'ID storico', async () => {
    const f = fixture('azienda', {cycle: 0});
    await f.revoke();
    assert.deepEqual(f.writes.filter(write => write[0] === 'delete').map(write => write[1]),
        ['invites/account-1_guest_example_invalid']);
});

test('un ciclo malformato non cancella nulla e segnala l\'errore', async () => {
    for (const area of ['privato', 'azienda']) {
        const f = fixture(area, {cycle: -1});
        await f.revoke();
        assert.equal(f.writes.some(write => write[0] === 'delete'), false, `${area}: nessuna cancellazione`);
        assert.equal(f.writes.some(write => write[0] === 'update'), false, `${area}: nessun aggiornamento`);
    }
});

test('i due moduli costruiscono l\'ID con l\'helper condiviso', async () => {
    for (const [area, source] of Object.entries(sources)) {
        assert.match(source, /inviteIdForGuest\(/, `${area}: helper condiviso`);
        assert.equal(/\$\{[A-Za-z_$][\w$]*\}_\$\{[A-Za-z_$][\w$]*\}/.test(source), false, `${area}: nessun ID costruito a mano`);
    }
});
