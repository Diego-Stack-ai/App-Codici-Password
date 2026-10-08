import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

// Export legacy invocabile; nessun consumatore interno trovato per renderGuests.
const modules = new URL('../Frontend/public/assets/js/modules/', import.meta.url);
const utils = await readFile(new URL('../utils.js', modules), 'utf8');
const {inviteIdForGuest, sanitizeEmail, sharingCycleOf} = await import(`data:text/javascript;base64,${Buffer.from(utils).toString('base64')}`);
const source = (await readFile(new URL('azienda/dettaglio-azienda-sharing.js', modules), 'utf8'))
    .replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '').replace(/\bimport\(/g, 'loadModule(');
const EMAIL = 'guest@example.invalid', KEY = sanitizeEmail(EMAIL);
const ACCOUNT = 'users/owner/aziende/company/accounts/account';
const INVITE = inviteIdForGuest('account', KEY, 1);
function fixture({canonical = {}, status = 'accepted', readOnly = false} = {}) {
    const writes = [], loads = [], transactions = [];
    let active = true;
    const list = {children: [], appendChild(node) { this.children.push(node); }};
    const context = {
        inviteIdForGuest, sanitizeEmail, sharingCycleOf, structuredClone,
        auth: {currentUser: {uid: 'owner'}}, db: {},
        // Firestore doc(collectionRef) genera un documento nella raccolta.
        doc: (base, ...parts) => ({path: base?.path ? `${base.path}/${parts.length ? parts.join('/') : 'synthetic-id'}` : parts.join('/')}),
        collection: (_db, ...parts) => ({path: parts.join('/')}),
        getInvite: async () => ({status}),
        updateDoc: (...args) => writes.push(args),
        loadModule: async () => { loads.push(true); return {updateDoc: (...args) => writes.push(args)}; },
        runTransaction: async (_db, callback) => {
            const ops = []; transactions.push(ops);
            await callback({get: async () => ({exists: () => true, data: () => structuredClone(canonical)}),
                update: (ref, patch) => ops.push({op: 'update', path: ref.path, patch}),
                set: (ref, patch) => ops.push({op: 'set', path: ref.path, patch}),
                delete: ref => ops.push({op: 'delete', path: ref.path})});
        },
        createElement: (tag, props, children) => ({tag, props, children}), clearElement: node => { node.children = []; },
        showToast() {}, showConfirmModal: async () => true, t: key => key, console: {warn() {}, error() {}},
        document: {getElementById: id => id === 'guests-list' ? list : {classList: {add() {}, remove() {}}}}
    };
    vm.createContext(context); vm.runInContext(source, context);
    const init = (confirm = async () => true) => context.initSharingModule({currentUid: 'owner', currentAziendaId: 'company',
        currentId: 'account', isReadOnly: readOnly, sharingCycle: 1, isActive: () => active, confirm, onReload: async () => {}});
    init();
    return {context, list, writes, loads, transactions, init, expire: () => { active = false; }};
}
const noWrites = f => { assert.deepEqual(f.writes, []); assert.deepEqual(f.loads, []); assert.deepEqual(f.transactions, []); };
const rendered = f => JSON.stringify(f.list.children);

for (const status of ['accepted', 'rejected']) {
    test(`renderGuests invito ${status}: input immutato e zero scritture`, async () => {
        const f = fixture({status}), guests = [{email: EMAIL, status: 'pending'}], before = structuredClone(guests);
        await f.context.renderGuests(guests);
        noWrites(f); assert.deepEqual(guests, before);
        assert.equal(f.list.children.length, status === 'accepted' ? 1 : 0);
        if (status === 'accepted') assert.ok(rendered(f).includes('status_accepted'));
    });
}
test('readOnly: nessun pulsante revoca o scrittura', async () => {
    const f = fixture({readOnly: true});
    await f.context.renderGuests([{email: EMAIL, status: 'accepted'}]);
    noWrites(f); assert.equal(rendered(f).includes('sharing-revoke-button'), false);
});
test('sessione scaduta durante getInvite: nessuna scrittura o rendering tardivo', async () => {
    const f = fixture(); let release;
    f.context.getInvite = () => new Promise(resolve => { release = resolve; });
    const pending = f.context.renderGuests([{email: EMAIL, status: 'pending'}]);
    f.expire(); release({status: 'accepted'}); await pending;
    noWrites(f); assert.equal(f.list.children.length, 0);
});
for (const scenario of ['revoca', 'reinvito', 'cambio ciclo']) {
    test(`${scenario} concorrente non viene sovrascritto dal rendering`, async () => {
        const canonical = {visibility: 'shared', sharingCycle: 1, sharedWith: {[KEY]: {email: EMAIL, status: 'pending'}}};
        const f = fixture({canonical}); let release;
        f.context.getInvite = () => new Promise(resolve => { release = resolve; });
        const pending = f.context.renderGuests(Object.values(structuredClone(canonical).sharedWith));
        if (scenario === 'revoca') delete canonical.sharedWith[KEY];
        else canonical.sharedWith[KEY] = {email: EMAIL, status: 'pending', auditRef: 'new-synthetic-invite'};
        if (scenario === 'cambio ciclo') canonical.sharingCycle = 2;
        const after = structuredClone(canonical);
        release({status: 'accepted'}); await pending;
        noWrites(f); assert.deepEqual(canonical, after);
    });
}
test('array legacy e mappa canonica: sola visualizzazione senza migrazione', async () => {
    const f = fixture(), legacy = [EMAIL];
    await f.context.renderGuests(legacy); noWrites(f); assert.deepEqual(legacy, [EMAIL]);
    const account = {visibility: 'shared', sharedWith: {[KEY]: {email: EMAIL, status: 'accepted'}}};
    const before = structuredClone(account);
    f.context.renderSharingMap(account); noWrites(f); assert.deepEqual(account, before);
    assert.equal(f.list.children.length, 1);
});
test('revoca transazionale conservata, sessione scaduta non la avvia', async () => {
    const canonical = {nomeAccount: 'Sintetico', type: 'account', visibility: 'shared', acceptedCount: 1, sharingCycle: 1,
        sharedWith: {[KEY]: {email: EMAIL, status: 'accepted', uid: 'guest'}}};
    const f = fixture({canonical}); await f.context.revokeRecipientV3(EMAIL);
    assert.equal(f.transactions.length, 1);
    const ops = f.transactions[0];
    assert.ok(ops.some(op => op.op === 'update' && op.path === ACCOUNT));
    assert.ok(ops.some(op => op.op === 'delete' && op.path === `invites/${INVITE}`));
    assert.ok(ops.some(op => op.op === 'set' && op.path === 'users/owner/notifications/synthetic-id'));
    const expired = fixture({canonical}); expired.init(async () => { expired.expire(); return true; });
    await expired.context.revokeRecipientV3(EMAIL); noWrites(expired);
});
