import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const guardSource = await readFile(new URL('../Frontend/public/assets/js/modules/shared/credential-decrypt-guard.js', import.meta.url), 'utf8');
const {DECRYPT_FAILURE_MESSAGE, assertAccountSaveAllowed, createAccountLoadContext, isAccountSaveAllowed} = await import(`data:text/javascript;base64,${Buffer.from(guardSource).toString('base64')}`);
const strip = source => source.replace(/^import[\s\S]*?;\r?\n/gm, '').replaceAll('export async function', 'async function');
const snapshot = () => ({exists: () => true, data: () => ({sharedWith: {}, revision: 1, visibility: 'private', updatedAt: ''})});
const readyContext = () => { const context = createAccountLoadContext({mode: 'edit'}); context.markLoaded(context.beginLoad()); return context; };
function control() {
    let markEntered, releaseFirstRead;
    const entered = new Promise(resolve => { markEntered = resolve; });
    const firstRead = new Promise(resolve => { releaseFirstRead = resolve; });
    const state = {entered, firstRead, markEntered, release: () => releaseFirstRead(),
        invocations: [], stagedPerAttempt: [], commits: [], failures: [], betweenRetries: null, attempts: 0};
    state.invocationsForAttempt = attempt => state.invocations.filter(entry => entry.attempt === attempt);
    return state;
}
function makeRunTransaction(ctl, {retries = 0} = {}) {
    return async (_db, callback) => {
        const committed = [];
        let firstReadSignalled = false;
        for (let attempt = 0; attempt <= retries; attempt += 1) {
            ctl.attempts += 1;
            const staged = [];
            const transaction = {
                get: () => {
                    if (!firstReadSignalled) {
                        firstReadSignalled = true; ctl.markEntered();
                        return ctl.firstRead.then(snapshot);
                    }
                    return Promise.resolve(snapshot());
                },
                set: (ref, value) => { ctl.invocations.push({attempt, op: 'set', path: ref?.path}); staged.push({op: 'set', path: ref?.path, value}); },
                update: (ref, value) => { ctl.invocations.push({attempt, op: 'update', path: ref?.path}); staged.push({op: 'update', path: ref?.path, value}); },
                delete: ref => { ctl.invocations.push({attempt, op: 'delete', path: ref?.path}); staged.push({op: 'delete', path: ref?.path}); }
            };
            try { await callback(transaction); }
            catch (error) {
                ctl.stagedPerAttempt.push({attempt, staged: staged.length, committed: false});
                ctl.failures.push(error); throw error;
            }
            ctl.stagedPerAttempt.push({attempt, staged: staged.length, committed: attempt === retries});
            committed.push(...staged);
            if (attempt < retries) ctl.betweenRetries?.();
        }
        ctl.commits.push(...committed);
    };
}
async function privateFixture({retries = 0} = {}) {
    const source = strip(await readFile(new URL('../Frontend/public/assets/js/modules/privato/form-privato-save.js', import.meta.url), 'utf8'))
        .replace("await import('../data/private-account-offline-pilot.js')", 'pilotFixture');
    const ctl = control();
    const nodes = {'btn-save-footer': {disabled: false, dataset: {}, setAttribute() {}}, 'account-name': {value: 'Fixture'},
        'account-username': {value: 'u'}, 'account-code': {value: 'a'}, 'account-password': {value: 'p'}, 'account-note': {value: 'n'}};
    const sandbox = {
        document: {getElementById: id => nodes[id], querySelector: () => null},
        auth: {currentUser: {uid: 'owner', email: 'owner@example.test'}}, db: {},
        doc: (_db, ...parts) => ({path: parts.join('/'), id: parts.at(-1)}),
        collection: (_db, ...parts) => ({path: parts.join('/'), id: 'new-record'}),
        increment: amount => ({__increment: amount}), deleteField: () => ({__delete: true}),
        runTransaction: makeRunTransaction(ctl, {retries}),
        sharingCycleOf: () => 0, inviteIdForGuest: (id, key, cycle) => `${id}_${key}_${cycle}`,
        sanitizeEmail: value => String(value).trim().toLowerCase(), crypto: {randomUUID: () => 'marker'}, structuredClone,
        showToast: () => {}, showAlertModal: async () => true, t: key => key, LOG: () => {}, logError: () => {},
        encrypt: async value => (value ? `cipher:${value}` : ''), ensureVaultKeyMaterial: async () => 'key',
        accountModeFromFlags: () => 'account-private', validateAccountMode: () => ({}),
        recordFieldsFromAccountMode: () => ({type: 'account', visibility: 'private'}),
        classifyPrivateAccountOfflineWrite: () => ({eligible: false}),
        hasInvalidCardExpiry: () => false, formatCardExpiry: value => value,
        navigator: {onLine: true}, setTimeout: () => {}, console: {error() {}}, window: {location: {replace: () => {}}},
        sessionStorage: {removeItem: () => {}}, findProfileAccountItem: () => null, patchProfileAccountItem: profile => profile,
        profileAccountReferences: () => [], linkProfileEmailToAccount: () => ({}), isProfileEmailPasswordTransferred: () => false,
        prepareCompanyProfileLink: () => null, decodeProfileContactValue: async value => value, pilotFixture: {},
        isAccountSaveAllowed, assertAccountSaveAllowed, DECRYPT_FAILURE_MESSAGE
    };
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    const save = loadContext => sandbox.savePrivateAccount({bankAccounts: [], invitedEmails: [], isExplicitMemo: false,
        currentUid: 'owner', currentDocId: 'record', isEditing: true, baseRevision: 1, profileContactLinkDraft: null,
        loadContext, isActive: () => true});
    return {ctl, sandbox, save};
}
async function companyFixture({retries = 0} = {}) {
    const source = strip(await readFile(new URL('../Frontend/public/assets/js/modules/azienda/form-azienda-save.js', import.meta.url), 'utf8'));
    const ctl = control();
    const nodes = {'save-btn-footer': {disabled: false, dataset: {}, setAttribute() {}}, 'account-name': {value: 'Fixture'},
        'account-username': {value: 'u'}, 'account-code': {value: 'a'}, 'account-password': {value: 'p'}, 'account-note': {value: 'n'}};
    const sandbox = {
        document: {getElementById: id => nodes[id], querySelector: () => null},
        auth: {currentUser: {uid: 'owner', email: 'owner@example.test'}}, db: {},
        doc: (_db, ...parts) => ({path: parts.join('/'), id: parts.at(-1)}),
        collection: (_db, ...parts) => ({path: parts.join('/'), id: 'new-record'}),
        increment: amount => ({__increment: amount}), deleteField: () => ({__delete: true}),
        runTransaction: makeRunTransaction(ctl, {retries}),
        sharingCycleOf: () => 0, inviteIdForGuest: (id, key, cycle) => `${id}_${key}_${cycle}`,
        sanitizeEmail: value => String(value).trim().toLowerCase(), crypto: {randomUUID: () => 'marker'}, structuredClone,
        showToast: () => {}, showConfirmModal: async () => true, t: key => key, LOG: () => {}, logError: () => {},
        encrypt: async value => (value ? `cipher:${value}` : ''), ensureVaultKeyMaterial: async () => 'key',
        accountModeFromFlags: () => 'account-private', validateAccountMode: () => ({}),
        recordFieldsFromAccountMode: () => ({type: 'account', visibility: 'private'}),
        hasInvalidCardExpiry: () => false, formatCardExpiry: value => value, console: {error() {}},
        findProfileAccountItem: () => null, patchProfileAccountItem: profile => profile, profileAccountReferences: () => [],
        linkProfileEmailToAccount: () => ({}), isProfileEmailPasswordTransferred: () => false,
        prepareCompanyProfileLink: () => null, decryptRequiredValue: async value => value,
        isAccountSaveAllowed, assertAccountSaveAllowed, DECRYPT_FAILURE_MESSAGE
    };
    vm.createContext(sandbox); vm.runInContext(source, sandbox);
    const save = loadContext => sandbox.saveAccount({bankAccounts: [], invitedEmails: [], isExplicitMemo: false,
        currentUid: 'owner', currentDocId: 'record', currentAziendaId: 'azienda', isEditing: true,
        profileContactLinkDraft: null, baseUpdatedAt: '', loadContext});
    return {ctl, sandbox, save};
}
for (const [domain, build] of [['privato', privateFixture], ['azienda', companyFixture]]) {
    test(`${domain}: lock durante le letture = zero chiamate di scrittura e zero commit`, async () => {
        const f = await build(); const context = readyContext(); const first = f.save(context);
        await f.ctl.entered; context.invalidate(); f.ctl.release(); await first.catch(() => {});
        assert.deepEqual(f.ctl.invocations, []); assert.deepEqual(f.ctl.commits, []);
        assert.ok(f.ctl.failures.length >= 1);
        const second = f.save(context); await second.catch(() => {});
        assert.deepEqual(f.ctl.invocations, []); assert.deepEqual(f.ctl.commits, []);
    });
    test(`${domain}: cambio UID durante le letture = zero chiamate di scrittura`, async () => {
        const f = await build(); const pending = f.save(readyContext());
        await f.ctl.entered; f.sandbox.auth.currentUser.uid = 'other'; f.ctl.release(); await pending.catch(() => {});
        assert.deepEqual(f.ctl.invocations, []); assert.deepEqual(f.ctl.commits, []);
    });
    test(`${domain}: retry con contesto invalidato: primo tentativo solo in staging, secondo zero chiamate`, async () => {
        const f = await build({retries: 1}); const context = readyContext();
        f.ctl.betweenRetries = () => context.invalidate();
        const pending = f.save(context); await f.ctl.entered; f.ctl.release(); await pending.catch(() => {});
        assert.equal(f.ctl.attempts, 2);
        assert.ok(f.ctl.invocationsForAttempt(0).length >= 1); assert.deepEqual(f.ctl.invocationsForAttempt(1), []);
        assert.deepEqual(f.ctl.commits, []);
        assert.ok(f.ctl.stagedPerAttempt.some(entry => entry.attempt === 0 && entry.staged >= 1));
        assert.equal(f.ctl.stagedPerAttempt.every(entry => entry.committed === false), true);
        assert.ok(f.ctl.failures.length >= 1);
    });
    test(`${domain}: contesto valido = chiamate presenti e commit eseguito`, async () => {
        const f = await build(); const pending = f.save(readyContext());
        await f.ctl.entered; f.ctl.release(); await pending.catch(() => {});
        const accountPath = domain === 'privato' ? 'users/owner/accounts/record' : 'users/owner/aziende/azienda/accounts/record';
        assert.ok(f.ctl.invocations.length >= 1);
        assert.equal(f.ctl.commits.some(op => op.op === 'update' && op.path === accountPath), true,
            'atteso update del documento Account esistente');
        assert.equal(f.ctl.commits.some(op => op.op === 'set'), false,
            'con isEditing:true il documento Account non viene ricreato con set');
    });
}
