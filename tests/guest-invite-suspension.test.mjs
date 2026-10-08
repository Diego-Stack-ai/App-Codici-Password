import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// M7-R7C-4 correzione (revisione Codex 21/09/2026) — la sospensione già nota non
// deve poter essere nascosta (né inventata) da una copia in cache: online l'esito
// si decide sull'elenco confermato dal server, offline resta la copia locale.
const root = new URL('../Frontend/public/assets/js/modules/data/', import.meta.url);
const repositorySource = await readFile(new URL('vault-repository.js', root), 'utf8');
const coordinatorSource = await readFile(new URL('request-coordinator.js', root), 'utf8');

const EMAIL = 'guest@example.invalid';
const suspendedInvite = {id: 'invite-suspended', accountId: 'account-1', ownerId: 'owner-1', aziendaId: '',
    recipientEmail: EMAIL, status: 'accepted', sharingState: 'suspended', cycle: 1};
const activeInvite = {id: 'invite-active', accountId: 'account-1', ownerId: 'owner-1', aziendaId: '',
    recipientEmail: EMAIL, status: 'accepted', cycle: 2};

function fixture({online = true, cached = [], confirmed = []} = {}) {
    const reads = [];
    const snapshot = records => ({empty: records.length === 0,
        docs: records.map(record => ({id: record.id, exists: () => true, data: () => structuredClone(record)}))});
    const context = vm.createContext({db: {}, navigator: {onLine: online},
        collection: (_db, ...path) => ({path: path.join('/')}),
        query: (target, ...constraints) => ({...target, constraints}),
        where: (field, operator, value) => ({field, operator, value}),
        doc: (_db, ...path) => ({path: path.join('/')}),
        getDocsSmart: async () => { reads.push('cache-first'); return snapshot(cached); },
        getDocsServerConfirmed: async () => { reads.push('server-confirmed'); return snapshot(confirmed); },
        getDocSmart: async () => ({exists: () => false, data: () => undefined}),
        getDocServerConfirmed: async () => ({exists: () => false, data: () => undefined})
    });
    vm.runInContext(coordinatorSource.replace(/^export /gm, ''), context);
    vm.runInContext(repositorySource.replace(/^import[\s\S]*?;\r?$/gm, '').replace(/^export /gm, '') +
        '\nglobalThis.repository = {listAcceptedInvites, listAcceptedInvitesConfirmed, findSuspendedGuestInvite};', context);
    return {repository: context.repository, reads,
        find: (companyId = '') => context.repository.findSuspendedGuestInvite('owner-1', 'account-1', EMAIL, companyId)};
}

test('online: la sospensione si decide sull\'elenco confermato dal server', async () => {
    const f = fixture({online: true, cached: [activeInvite], confirmed: [suspendedInvite]});
    const found = await f.find();
    assert.equal(found?.id, 'invite-suspended', 'la cache non può nascondere una sospensione nota');
    assert.deepEqual(f.reads, ['server-confirmed'], 'nessuna lettura dalla cache quando si è online');
});

test('online: la cache non può introdurre una sospensione che il server non ha', async () => {
    const f = fixture({online: true, cached: [suspendedInvite], confirmed: [activeInvite]});
    assert.equal(await f.find(), null);
    assert.deepEqual(f.reads, ['server-confirmed']);
});

test('offline: si usa la copia locale e una sospensione in cache ferma l\'accesso', async () => {
    const f = fixture({online: false, cached: [suspendedInvite], confirmed: [activeInvite]});
    const found = await f.find();
    assert.equal(found?.id, 'invite-suspended');
    assert.deepEqual(f.reads, ['cache-first'], 'offline non si tenta il server');
});

test('offline con invito vecchio: il limite è dichiarato, non mascherato', async () => {
    // Invito in cache ancora attivo (il dispositivo non ha visto la sospensione):
    // il client non può saperlo. È il limite dichiarato del dispositivo offline.
    const f = fixture({online: false, cached: [activeInvite], confirmed: [suspendedInvite]});
    assert.equal(await f.find(), null);
    assert.deepEqual(f.reads, ['cache-first']);
});

test('la ricerca considera Account, proprietario, contesto aziendale e stato sospeso', async () => {
    const other = {...suspendedInvite, accountId: 'other-account'};
    const otherOwner = {...suspendedInvite, ownerId: 'other-owner'};
    const acceptedOnly = {...suspendedInvite, sharingState: undefined};
    for (const invites of [[other], [otherOwner], [acceptedOnly], []]) {
        const f = fixture({online: true, confirmed: invites});
        assert.equal(await f.find(), null);
    }
    const company = {...suspendedInvite, aziendaId: 'company-1'};
    const wrongContext = fixture({online: true, confirmed: [company]});
    assert.equal(await wrongContext.find(''), null, 'contesto diverso');
    const matching = fixture({online: true, confirmed: [company]});
    assert.equal((await matching.find('company-1')).id, 'invite-suspended');
});
