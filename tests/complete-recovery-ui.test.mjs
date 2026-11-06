import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root = new URL('../Frontend/public/assets/js/', import.meta.url);
const original = await readFile(new URL('modules/settings/complete-recovery-ui.js', root), 'utf8');
const source = original.replace(/^import[^;]+;\r?\n/gm, '').replace(/^export /gm, '');
const catalogSource = await readFile(new URL('translations/recovery.js', root), 'utf8');
const {recoveryCatalogs} = await import(`data:text/javascript;base64,${Buffer.from(catalogSource).toString('base64')}`);
const locatorSource = await readFile(new URL('modules/settings/complete-recovery-locator.js', root), 'utf8');
const {createCompleteRecoveryLocatorStore} = await import(`data:text/javascript;base64,${Buffer.from(locatorSource).toString('base64')}`);
const policySource = await readFile(new URL('modules/core/password-policy.js', root), 'utf8');
const {evaluatePassword} = await import(`data:text/javascript;base64,${Buffer.from(policySource).toString('base64')}`);
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
const tick = () => new Promise(setImmediate);
function fixture({enabled = true} = {}) {
    const events = new EventTarget(), nodes = [], observers = new Set(), released = [], requests = [], executions = [];
    const storage = new Map(); let owner = 'owner', activeElement, body;
    class Node {
        constructor(tag, props = {}, children = []) { this.tag = tag; this.children = []; this.events = new Map(); this.value = ''; this.disabled = false; this.style = {}; Object.assign(this, props); children.forEach(child => this.appendChild(child)); nodes.push(this); }
        get isConnected() { return this === body || !!this.parent?.isConnected; }
        appendChild(child) { child.parent = this; this.children.push(child); return child; }
        replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; children.forEach(child => this.appendChild(child)); }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
        addEventListener(name, fn) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(fn); }
        removeEventListener(name, fn) { this.events.get(name)?.delete(fn); }
        trigger(name, event = {}) { return Promise.all([...(this.events.get(name) || [])].map(fn => fn({preventDefault() {}, ...event}))); }
        click() { this.onclick?.({preventDefault() {}}); return this.trigger('click'); }
        focus() { activeElement = this; }
        querySelectorAll(selector) { const tags = selector.split(',').map(value => value.trim()); return this.children.flatMap(child => [...(tags.includes(child.tag) ? [child] : []), ...child.querySelectorAll(selector)]); }
    }
    const createElement = (...args) => new Node(...args);
    body = createElement('body'); const container = body.appendChild(createElement('main'));
    const translate = key => recoveryCatalogs.en[key] || ({cancel: 'Cancel', confirm: 'Confirm'}[key]) || key;
    const format = (key, values) => translate(key).replace(/\{([^}]+)\}/g, (_all, name) => String(values[name]));
    const context = vm.createContext({createElement, setChildren: (node, children) => node.replaceChildren(...children),
        document: {body, get activeElement() { return activeElement; }}, AbortController,
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        evaluatePassword, t: translate, tf: format, COMPLETE_RECOVERY_ENABLED: false,
        COMPLETE_RECOVERY_REAUTH_PATH: '/login.html?recovery=complete&reauth=complete-recovery',
        prepareCompleteRecovery() { throw new Error('unexpected default service'); }, executeCompleteRecovery() { throw new Error('unexpected default client'); }, releaseCompleteRecovery: value => released.push(value)});
    vm.runInContext(source, context);
    const plan = {ownerUid: owner, backupId: 'backup-one', contentDigest: 'a'.repeat(64), counts: {records: 2, assets: 1}, descriptions: ['PRIVATE-NAME-MUST-NOT-RENDER']};
    const locator = createCompleteRecoveryLocatorStore({uid: owner, storage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)}});
    const service = {prepare: async () => plan,
        execute: async (plan, password, options) => {
            executions.push({plan, password, options});
            try {
                await options.rememberOperation({uid: owner, operationId: options.operationId || 'operation-one', backupId: plan.backupId, contentDigest: plan.contentDigest});
                await options.invoke({action: 'prepare', operationId: options.operationId || 'operation-one'});
                await options.clearRememberedOperation({uid: owner, operationId: options.operationId || 'operation-one', contentDigest: plan.contentDigest});
                return {status: 'complete'};
            } finally { released.push(plan); }
        }};
    const mount = overrides => context.mountCompleteRecoveryUi({root: container, uid: 'owner', enabled,
        invoke: async data => { requests.push(data); return {}; }, getCurrentUid: () => owner,
        subscribeToAuth: callback => { observers.add(callback); return () => observers.delete(callback); }, locator,
        prepare: (...args) => service.prepare(...args), execute: (...args) => service.execute(...args), release: value => released.push(value),
        translate, format, ...overrides});
    const mounted = mount();
    const input = id => nodes.find(node => node.id === id && node.isConnected);
    const form = () => container.children[0];
    const dialog = () => nodes.find(node => node.role === 'dialog' && node.isConnected);
    const button = (parent, label) => parent.querySelectorAll('button').find(node => node.textContent === label);
    const fill = () => {
        input('complete-recovery-file').files = [{name: 'synthetic.cpbackup'}];
        input('complete-recovery-key').value = 'synthetic-key';
        input('complete-recovery-password').value = ['Synthetic', 'Master', Date.now(), 'aA!'].join('-');
        input('complete-recovery-repeat').value = input('complete-recovery-password').value;
    };
    const accept = async () => {
        const modal = dialog(); assert.ok(modal);
        const checkbox = modal.querySelectorAll('input').find(node => node.type === 'checkbox');
        if (checkbox) { checkbox.checked = true; await checkbox.trigger('change'); }
        await button(modal, checkbox ? translate('recovery_start') : translate('recovery_expired_accept')).click();
    };
    return {nodes, body, container, context, mounted, mount, plan, service, requests, executions, storage, locator, released, observers,
        input, form, dialog, button, fill, accept, translate, text: () => nodes.filter(node => node.isConnected).map(node => node.textContent || '').join(' '),
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
        changeUid: value => { owner = value; for (const observer of [...observers]) observer({uid: value}); }};
}

test('default flag false leaves ordinary content untouched and cannot invoke either service', () => {
    const f = fixture({enabled: false});
    assert.equal(f.container.children.length, 0); assert.equal(f.requests.length, 0); assert.equal(f.observers.size, 0);
    f.mounted.dispose();
});

test('weak/mismatched passwords, missing file and bad file/key never reach server preparation', async () => {
    const f = fixture();
    await f.form().trigger('submit'); assert.match(f.text(), /Select a complete backup/);
    f.fill(); f.input('complete-recovery-password').value = 'weak'; await f.form().trigger('submit'); assert.match(f.text(), /At least 16/);
    f.fill(); f.input('complete-recovery-repeat').value += 'x'; await f.form().trigger('submit'); assert.match(f.text(), /do not match/);
    f.fill(); f.service.prepare = async () => { throw new Error('RECOVERY_FILE_INVALID'); };
    await f.form().trigger('submit'); assert.match(f.text(), /could not be verified/); assert.equal(f.requests.length, 0);
    for (const node of f.nodes.filter(node => node.type === 'password')) assert.equal(node.value, '');
    f.mounted.dispose();
});

test('capacity refusals show the transfer restriction rather than claiming a bad file or key', async () => {
    for (const catalog of Object.values(recoveryCatalogs)) for (const code of ['RECOVERY_TRANSPORT_CAPACITY_EXCEEDED', 'FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED']) {
        const f = fixture(); f.mounted.dispose();
        const mounted = f.mount({translate: key => catalog[key] || key}); f.fill();
        f.service.prepare = async () => { throw Object.assign(new Error(code), {code}); };
        await f.form().trigger('submit');
        assert.ok(f.text().includes(catalog.recovery_transport_capacity));
        assert.equal(f.text().includes(catalog.recovery_invalid_backup), false);
        assert.doesNotMatch(f.text(), /RECOVERY_/);
        assert.equal(f.requests.length, 0); assert.equal(f.storage.size, 0); mounted.dispose();
    }
    const f = fixture(); f.fill();
    f.service.execute = async () => { throw Object.assign(new Error('FULL_RECOVERY_TRANSPORT_CAPACITY_EXCEEDED'), {canResume: true}); };
    const pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
    assert.ok(f.text().includes(f.translate('recovery_transport_capacity')));
    assert.doesNotMatch(f.text(), /could not be verified/); f.mounted.dispose();
});

test('preview contains counts only and requires explicit acknowledgement; cancel releases it before any RPC', async () => {
    const f = fixture(); f.fill(); const pending = f.form().trigger('submit'); await tick();
    assert.ok(f.dialog()); assert.match(f.text(), /2 items · 1 files/); assert.doesNotMatch(f.text(), /PRIVATE-NAME|synthetic-key|aaaaa/);
    assert.equal(f.button(f.dialog(), f.translate('recovery_start')).disabled, true);
    await f.button(f.dialog(), 'Cancel').click(); await pending;
    assert.equal(f.requests.length, 0); assert.ok(f.released.includes(f.plan)); assert.match(f.text(), /Cancelled before/);
    f.mounted.dispose();
});

test('preview discloses external reference counts and missing external bytes without rendering URLs', async () => {
    for (const count of [0,3]) {
        const f=fixture();f.plan.counts.externalReferences=count;f.plan.externalReferences=['https://PRIVATE-URL.invalid/file'];
        f.fill();const pending=f.form().trigger('submit');await tick();
        assert.equal(f.text().includes(`External references: ${count}`),count>0);
        if(count)assert.match(f.text(),/External files are not copied into the backup/);
        assert.doesNotMatch(f.text(),/PRIVATE-URL|https:/);await f.button(f.dialog(),'Cancel').click();await pending;f.mounted.dispose();
    }
});

test('actual nonempty-target codes explain the restriction without claiming a corrupt file or unchanged fence', async () => {
    for(const code of ['FULL_RECOVERY_TARGET_NONEMPTY','FULL_RECOVERY_STORAGE_NONEMPTY']){
        const f=fixture();f.service.execute=async(plan,_password,options)=>{
            await options.rememberOperation({uid:'owner',operationId:'nonempty',backupId:plan.backupId,contentDigest:plan.contentDigest});
            await options.invoke({action:'prepare'});throw Object.assign(new Error(code),{canResume:true});
        };
        f.fill();const pending=f.form().trigger('submit');await tick();await f.accept();await pending;
        assert.match(f.text(),/requires an empty Vault/);assert.doesNotMatch(f.text(),/could not be verified|no changes|unchanged fence/);
        assert.equal(f.storage.size,1);f.mounted.dispose();
    }
});

test('successful recovery calls coordinator once with explicit confirmation, then removes credentials', async () => {
    const f = fixture(); f.fill(); const master = f.input('complete-recovery-password').value;
    const pending = f.form().trigger('submit'); await tick();
    const duplicate = f.form().trigger('submit'); await duplicate;
    await f.accept(); await pending;
    assert.equal(f.executions.length, 1); assert.equal(f.executions[0].password, master);
    assert.equal(f.executions[0].options.confirmation, 'RECOVER_EMPTY_VAULT');
    assert.equal(f.storage.size, 0); assert.match(f.text(), /Vault recovered/);
    assert.equal(JSON.stringify(f.requests).includes(master), false);
    assert.equal(f.nodes.filter(node => node.type === 'password').every(node => node.value === ''), true);
    assert.ok(f.nodes.some(node => node.href === '/home_page.html' && node.isConnected)); f.mounted.dispose();
});

test('uncertain outcomes retain only locator metadata and reuse the same operation after file reselection', async () => {
    const f = fixture(); let attempt = 0;
    f.service.execute = async (plan, _password, options) => {
        attempt++;
        await options.rememberOperation({uid: 'owner', operationId: 'uncertain-one', backupId: plan.backupId, contentDigest: plan.contentDigest});
        await options.invoke({action: 'prepare'});
        if (attempt === 1) throw Object.assign(new Error('RECOVERY_OPERATION_UNCONFIRMED'), {canResume: true});
        assert.equal(options.operationId, 'uncertain-one'); return {status: 'complete', cleanupPending: true};
    };
    f.fill(); let pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
    assert.match(f.text(), /server may already have started/);
    const stored = JSON.parse([...f.storage.values()][0]);
    assert.deepEqual(Object.keys(stored).sort(), ['uid', 'operationId', 'backupId', 'contentDigest'].sort());
    f.fill(); pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
    assert.match(f.text(), /Vault recovered.*temporary files/); assert.equal(f.storage.size, 1); f.mounted.dispose();
});

test('server-proved not-started outcome clears uncertainty and requires a fresh preview without completion', async () => {
    for (const reason of ['FULL_RECOVERY_TARGET_NONEMPTY', 'FULL_RECOVERY_STORAGE_NONEMPTY', 'FULL_RECOVERY_SOURCE_CHANGED']) {
        const f = fixture(); let attempts = 0;
        f.service.execute = async (plan, _password, options) => {
            attempts++;
            const operation = {uid: 'owner', operationId: 'aborted-one', backupId: plan.backupId, contentDigest: plan.contentDigest};
            await options.rememberOperation(operation); await options.invoke({action: 'prepare'});
            await options.clearRememberedOperation(operation);
            return {status: 'not-started', operationId: operation.operationId, reason};
        };
        f.fill(); const pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
        assert.match(f.text(), /Recovery did not start\. No recovery data was written, and this operation has not left the Vault locked\. Verify the backup again/);
        assert.equal(f.text().includes(f.translate('recovery_target_not_empty')), /NONEMPTY/.test(reason));
        assert.doesNotMatch(f.text(), /Vault recovered|server may already have started|could not be verified|FULL_RECOVERY_/);
        assert.equal(f.nodes.some(node => node.href === '/home_page.html' && node.isConnected), false);
        assert.equal(f.storage.size, 0); assert.equal(attempts, 1);
        assert.equal(f.nodes.filter(node => node.type === 'password').every(node => node.value === ''), true);
        await f.button(f.form(), 'Cancel').click(); assert.match(f.text(), /Cancelled before/);
        f.fill(); const next = f.form().trigger('submit'); await tick();
        assert.ok(f.dialog()); assert.equal(attempts, 1); assert.equal(f.button(f.dialog(), f.translate('recovery_start')).disabled, true);
        await f.button(f.dialog(), 'Cancel').click(); await next; assert.equal(attempts, 1); f.mounted.dispose();
    }
});

test('only a fresh confirmed preview can omit the exact server-proved aborted discovered operation', async () => {
    for (const discoveredId of ['aborted-one', 'different-server-operation']) {
        const f = fixture(); f.mounted.dispose(); let discovered = 'aborted-one', attempts = 0; const operationIds = [];
        const mounted = f.mount({discoverOperation: async () => ({operationId: discovered})});
        f.service.execute = async (plan, _password, options) => {
            attempts++; operationIds.push(options.operationId);
            if (attempts === 1) {
                await options.rememberOperation({uid: 'owner', operationId: 'aborted-one', backupId: plan.backupId, contentDigest: plan.contentDigest});
                await options.invoke({action: 'prepare'});
                await options.clearRememberedOperation({uid: 'owner', operationId: 'aborted-one', contentDigest: plan.contentDigest});
                return {status: 'not-started', operationId: 'aborted-one', reason: 'FULL_RECOVERY_TARGET_NONEMPTY'};
            }
            await options.rememberOperation({uid: 'owner', operationId: options.operationId || 'new-operation', backupId: plan.backupId, contentDigest: plan.contentDigest});
            return {status: 'complete', cleanupPending: true};
        };
        f.fill(); let pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
        assert.equal(attempts, 1); discovered = discoveredId;
        f.fill(); pending = f.form().trigger('submit'); await tick(); assert.equal(attempts, 1);
        await f.button(f.dialog(), 'Cancel').click(); await pending; assert.equal(attempts, 1);
        f.fill(); pending = f.form().trigger('submit'); await tick(); assert.equal(attempts, 1);
        await f.accept(); await pending; assert.equal(attempts, 2);
        assert.deepEqual(operationIds, ['aborted-one', discoveredId === 'aborted-one' ? undefined : discoveredId]); mounted.dispose();
    }
});

test('failed and unconfirmed outcomes never make a discovered operation eligible to be ignored', async () => {
    for (const outcome of ['failed', 'unconfirmed']) {
        const f = fixture(); f.mounted.dispose(); let attempts = 0; const operationIds = [];
        const mounted = f.mount({discoverOperation: async () => ({operationId: 'still-uncertain'})});
        f.service.execute = async (plan, _password, options) => {
            attempts++; operationIds.push(options.operationId);
            await options.rememberOperation({uid: 'owner', operationId: 'still-uncertain', backupId: plan.backupId, contentDigest: plan.contentDigest});
            await options.invoke({action: 'prepare'});
            if (attempts === 1) {
                if (outcome === 'failed') throw Object.assign(new Error('RECOVERY_OPERATION_UNCONFIRMED'), {canResume: true});
                return {status: 'unconfirmed', operationId: 'still-uncertain'};
            }
            return {status: 'complete', cleanupPending: true};
        };
        f.fill(); let pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
        assert.match(f.text(), /server may already have started/); f.storage.clear();
        f.fill(); pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
        assert.equal(attempts, 2); assert.deepEqual(operationIds, ['still-uncertain', 'still-uncertain']); mounted.dispose();
    }
});

test('expired recovery needs a second explicit consent and completed-password mismatch is not a corrupt-file claim', async () => {
    for (const accepted of [false, true]) {
        const f = fixture(); let repreviewed = false;
        f.service.execute = async (plan, _password, options) => {
            await options.rememberOperation({uid: 'owner', operationId: 'expired-one', backupId: plan.backupId, contentDigest: plan.contentDigest});
            await options.invoke({action: 'prepare'});
            if (!await options.confirmExpiredPlan({recordCount: 2, assetCount: 1})) throw Object.assign(new Error('RECOVERY_PLAN_REPREVIEW_REQUIRED'), {canResume: true});
            repreviewed = true;
            throw Object.assign(new Error('RECOVERY_COMPLETED_PASSWORD_MISMATCH'), {canResume: true});
        };
        f.fill(); const pending = f.form().trigger('submit'); await tick(); await f.accept(); await tick();
        assert.match(f.text(), /30-day window/); assert.equal(repreviewed, false);
        if (accepted) await f.accept(); else await f.button(f.dialog(), 'Cancel').click();
        await pending;
        assert.equal(repreviewed, accepted); assert.equal(f.storage.size, 1);
        assert.match(f.text(), accepted ? /Recovery is already complete, but this password/ : /resume reference is retained/);
        assert.doesNotMatch(f.text(), /file could not be verified/); f.mounted.dispose();
    }
});

test('server-discovered operation can resume without a local locator; local write failure stops before RPC', async () => {
    const f = fixture(); f.mounted.dispose();
    const mounted = f.mount({discoverOperation: async () => ({operationId: 'server-discovered'})});
    f.service.execute = async (plan, _password, options) => {
        assert.equal(options.operationId, 'server-discovered');
        await options.rememberOperation({uid: 'owner', operationId: options.operationId, backupId: plan.backupId, contentDigest: plan.contentDigest});
        return {status: 'complete', cleanupPending: true};
    };
    f.fill(); let pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
    assert.equal(f.storage.size, 1); mounted.dispose();
    const blocked = f.mount({locator: {load: () => null, remember() { throw new Error('RECOVERY_LOCATOR_UNAVAILABLE'); }}});
    f.service.execute = async (plan, _password, options) => {
        await options.rememberOperation({uid: 'owner', operationId: 'not-started', backupId: plan.backupId, contentDigest: plan.contentDigest});
        await options.invoke({action: 'prepare'});
    };
    f.fill(); pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
    assert.equal(f.requests.length, 0); assert.match(f.text(), /Allow local storage/); blocked.dispose();
});

for (const phase of ['prepare', 'execute']) for (const stop of ['lock', 'uid', 'cancel']) test(`${stop} during ${phase} clears secrets and rejects a late UI result`, async () => {
    const f = fixture(), wait = deferred(); f.fill();
    if (phase === 'prepare') f.service.prepare = () => wait.promise;
    else f.service.execute = async (_plan, _master, options) => { await options.rememberOperation({uid: 'owner', operationId: 'late-one', backupId: f.plan.backupId, contentDigest: f.plan.contentDigest}); await options.invoke({action: 'prepare'}); return wait.promise; };
    const pending = f.form().trigger('submit'); await tick();
    if (phase === 'execute') { await f.accept(); await tick(); }
    if (stop === 'lock') f.lock();
    if (stop === 'uid') f.changeUid('other-owner');
    if (stop === 'cancel') await f.button(f.form(), 'Cancel').click();
    wait.resolve(phase === 'prepare' ? f.plan : {status: 'complete'}); await pending;
    assert.equal(f.nodes.filter(node => node.type === 'password').every(node => node.value === ''), true);
    assert.equal(f.dialog(), undefined); assert.doesNotMatch(f.text(), /Vault recovered/);
    if (phase === 'execute') assert.equal(f.storage.size, 1);
    if (stop !== 'cancel') assert.equal(f.observers.size, 0);
    f.mounted.dispose();
});

test('recent-auth failures preserve locator and offer only the fixed reauthentication route', async () => {
    const f = fixture(); f.service.execute = async (plan, _password, options) => {
        await options.rememberOperation({uid: 'owner', operationId: 'reauth-one', backupId: plan.backupId, contentDigest: plan.contentDigest});
        await options.invoke({action: 'prepare'}); throw Object.assign(new Error('FULL_RECOVERY_RECENT_AUTH_REQUIRED'), {canResume: true});
    };
    f.fill(); const pending = f.form().trigger('submit'); await tick(); await f.accept(); await pending;
    assert.match(f.text(), /Sign in again to continue/); assert.equal(f.storage.size, 1);
    assert.ok(f.nodes.some(node => node.href === '/login.html?recovery=complete&reauth=complete-recovery' && node.isConnected)); f.mounted.dispose();
});

test('locator rejects extra fields and cannot clear another operation', () => {
    const storage = new Map(), store = createCompleteRecoveryLocatorStore({uid: 'owner', storage: {getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)}});
    const locator = {uid: 'owner', operationId: 'op', backupId: 'backup', contentDigest: 'a'.repeat(64)};
    assert.throws(() => store.remember({...locator, masterPassword: 'not-allowed'}));
    store.remember(locator); assert.throws(() => store.clear({...locator, operationId: 'other'})); assert.equal(storage.size, 1);
    store.clear(locator); assert.equal(storage.size, 0);
});

test('all recovery strings are nonempty and have matching placeholders in all eight languages', async () => {
    assert.deepEqual(Object.keys(recoveryCatalogs).sort(), ['it','en','es','fr','de','zh','hi','pt'].sort());
    const keys = Object.keys(recoveryCatalogs.it).sort(), placeholders = value => [...value.matchAll(/\{([^}]+)\}/g)].map(match => match[1]).sort();
    for (const catalog of Object.values(recoveryCatalogs)) {
        assert.deepEqual(Object.keys(catalog).sort(), keys);
        for (const key of keys) { assert.ok(typeof catalog[key] === 'string' && catalog[key].trim()); assert.deepEqual(placeholders(catalog[key]), placeholders(recoveryCatalogs.it[key])); }
    }
    for (const [, key] of original.matchAll(/['"](recovery_[a-z_]+)['"]/g)) assert.ok(keys.includes(key), key);
    assert.doesNotMatch(original, /innerHTML|console\.|localStorage|sessionStorage/);
    const distinct={it:'diversa da quella di accesso',en:'different from your account login password',es:'distinta de la de acceso',fr:'différent du mot de passe de connexion',de:'anderes Passwort als für die Kontoanmeldung',zh:'与账户登录密码不同',hi:'लॉगिन पासवर्ड से अलग',pt:'diferente da utilizada para iniciar sessão'};
    for(const[language,fragment]of Object.entries(distinct))assert.ok(recoveryCatalogs[language].recovery_password_rules.includes(fragment),language);
    assert.match(original,/evaluatePassword\(password.value, 'master'\)/);
    assert.doesNotMatch(original,/signInWithEmailAndPassword|reauthenticateWithCredential/);
});

test('fresh export password prompt owns a password form and clears it on lock or completion', async () => {
    const f = fixture({enabled:false});
    let pending = f.context.promptCompleteRecoveryMasterPassword({isActive:()=>true});
    let modal = f.dialog(), input = modal.querySelectorAll('input')[0];
    assert.equal(input.type, 'password'); assert.equal(input.autocomplete, 'current-password'); assert.equal(input.parent.tag, 'form');
    input.value = 'synthetic fresh password'; f.lock(); assert.equal(await pending, null); assert.equal(input.value, '');
    pending = f.context.promptCompleteRecoveryMasterPassword({isActive:()=>true}); modal = f.dialog(); input = modal.querySelectorAll('input')[0];
    input.value='synthetic cancelled password';await modal.querySelectorAll('button').find(node=>node.textContent==='Cancel').click();assert.equal(await pending,null);assert.equal(input.value,'');
    pending = f.context.promptCompleteRecoveryMasterPassword({isActive:()=>true}); modal = f.dialog(); input = modal.querySelectorAll('input')[0];
    input.value = 'synthetic fresh password'; modal.onsubmit({preventDefault(){}});
    assert.equal(await pending, 'synthetic fresh password'); assert.equal(input.value, ''); assert.equal(modal.isConnected, false);
});

test('future complete export options require the code gate and use the fresh prompt plus dedicated asset reader', async () => {
    const entry = await readFile(new URL('modules/settings/complete-recovery-entry.js', root), 'utf8');
    const source = entry.slice(entry.indexOf('export function createCompleteRecoveryExportOptions')).replace('export ', '');
    for (const enabled of [false,true]) {
        const calls = [];
        const context = vm.createContext({COMPLETE_RECOVERY_ENABLED:enabled, auth:{currentUser:{uid:'owner'}},
            transport:(name,uid)=>{calls.push([name,uid]);return async()=>{};},
            createRecoveryAssetReader:options=>{assert.equal(options.uid,'owner');const read=async()=>({});read.release=()=>calls.push('release');return read;},
            promptCompleteRecoveryMasterPassword:async()=>{calls.push('fresh-password');return 'synthetic fresh password';}});
        vm.runInContext(source,context);
        const options=context.createCompleteRecoveryExportOptions({uid:'owner',isActive:()=>true});
        if(!enabled){assert.equal(options,null);assert.equal(calls.length,0);continue;}
        assert.equal(options.profile,'complete-recovery');assert.equal(await options.promptMasterPassword(),'synthetic fresh password');
        assert.deepEqual(calls[0],['readRecoveryBackupAsset','owner']);assert.ok(calls.includes('fresh-password'));
        options.dispose();assert.ok(calls.includes('release'));
    }
});
