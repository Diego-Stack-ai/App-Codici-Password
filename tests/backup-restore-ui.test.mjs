import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../Frontend/public/assets/js/modules/settings/impostazioni.js', import.meta.url), 'utf8');
const ui = source.slice(source.indexOf('let disposeRestoreSetup'), source.indexOf('function showRecoveryKeyOnce'))
    .replace("import('./backup-import-service.js')", 'loadImport()');
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };
const tick = () => new Promise(setImmediate);

function fixture({health = false} = {}) {
    const observers = new Set(), events = new EventTarget(), nodes = [], toasts = [], executions = [], timers = new Map();
    let body, activeElement, timerId = 0;
    class Node {
        constructor(tag, props = {}, children = []) {
            this.tag = tag; this.children = []; this.events = new Map(); this.value = ''; this.disabled = false;
            Object.assign(this, props);
            const classes = new Set((this.className || '').split(' '));
            this.classList = {add: value => classes.add(value), remove: value => classes.delete(value), contains: value => classes.has(value)};
            children.filter(Boolean).forEach(child => this.appendChild(child)); nodes.push(this);
        }
        get isConnected() { return this === body || Boolean(this.parent?.isConnected); }
        appendChild(child) { child.parent = this; this.children.push(child); return child; }
        remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
        replaceChildren() { for (const child of this.children) child.parent = null; this.children = []; }
        addEventListener(name, callback) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(callback); }
        removeEventListener(name, callback) { this.events.get(name)?.delete(callback); }
        trigger(name, event = {}) { return Promise.all([...(this.events.get(name) || [])].map(callback => callback(event))); }
        focus() { activeElement = this; }
        querySelectorAll(selector) { return this.children.flatMap(child => [...(selector.split(',').map(value => value.trim()).includes(child.tag) ? [child] : []), ...child.querySelectorAll(selector)]); }
        querySelector(selector) { return this.querySelectorAll(selector)[0]; }
        setAttribute(name, value) { this[name] = value; }
        getAttribute(name) { return this[name]; }
        get firstElementChild() { return this.children[0]; }
        get lastElementChild() { return this.children.at(-1); }
        click() { this.onclick?.({}); return this.trigger('click'); }
    }
    const createElement = (...args) => new Node(...args);
    body = createElement('body');
    const button = body.appendChild(createElement('button', {id: health ? 'btn-credential-health' : 'btn-restore-encrypted-backup'}));
    const auth = {currentUser: {uid: 'A'}};
    const plan = {recoveryKey: 'private-recovery', records: [{}], counts: {records: 1, attachments: 0}, collisionCount: 0, comparison: {entries: [], counts: {}}};
    const service = {
        prepareBackupRestore: async () => plan,
        executeBackupRestore: async (...args) => { executions.push(args); throw Object.assign(new Error('synthetic failure'), {progress: {mayHaveApplied: true}}); },
        releaseBackupRestore: value => { value.recoveryKey = ''; value.records = []; },
    };
    const context = vm.createContext({
        auth, AbortController, createElement,
        document: {body, getElementById: id => nodes.find(node => node.id === id && node.isConnected), get activeElement() { return activeElement; }},
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        showToast: (...args) => toasts.push(args), loadImport: async () => service,
        requestAnimationFrame: callback => callback(),
        setTimeout: callback => { const id = ++timerId; timers.set(id, callback); return id; }, clearTimeout: id => timers.delete(id),
        window: {location: {reload: () => { throw new Error('unexpected reload'); }}},
    });
    vm.runInContext(ui, context);
    if (health) vm.runInContext(source.slice(source.indexOf('function showCredentialHealthResults'), source.indexOf('function usageReportText'))
        .replace(/import\('\.\/credential-health-service\.js\?v=[^']+'\)/, 'loadImport()'), context);
    const confirm = value => {
        const form = body.querySelector('form'); assert.ok(form, 'owned input dialog exists');
        form.querySelector('input').value = value;
        form.onsubmit({preventDefault() {}});
    };
    return {context, body, button, nodes, observers, toasts, executions, service, plan, confirm,
        setup: uid => health ? context.setupCredentialHealth({uid}) : context.setupEncryptedRestore({uid}),
        select: () => { const input = body.children.find(node => node.type === 'file'); input.files = [{}]; return input.trigger('change'); },
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
        hide: () => events.dispatchEvent(new Event('pagehide')),
        changeUid: uid => { auth.currentUser = {uid}; for (const callback of [...observers]) callback(auth.currentUser); },
    };
}

test('same-UID lock immediately clears the owned Recovery Key input and resolves its prompt', async () => {
    const f = fixture(); f.setup('A'); const pending = f.select();
    const input = f.body.querySelector('form').querySelector('input'); input.value = 'private key';
    assert.equal(input.classList.contains('vault-secret-input'), true);
    const css = await readFile(new URL('../Frontend/public/assets/css/core_ui.css', import.meta.url), 'utf8');
    assert.equal(/\.vault-secret-input[^{}]*\{[^}]*-webkit-text-security:\s*disc/s.test(css), true);
    f.lock(); await pending;
    assert.equal(input.value, ''); assert.equal(f.body.querySelector('form'), undefined);
    assert.equal(f.observers.size, 0); assert.equal(f.executions.length, 0); assert.equal(f.toasts.length, 0);
});

test('late preview after identity change is released and cannot touch a new setup on the same DOM', async () => {
    const f = fixture(), gate = deferred(); f.service.prepareBackupRestore = () => gate.promise;
    f.setup('A'); const pending = f.select(); f.confirm('synthetic recovery'); await tick();
    f.changeUid('B'); f.setup('B'); assert.equal(f.button.disabled, false);
    gate.resolve(f.plan); await pending;
    assert.equal(f.plan.recoveryKey, ''); assert.equal(f.button.disabled, false);
    assert.equal(f.body.querySelector('form'), undefined); assert.equal(f.executions.length, 0); assert.equal(f.toasts.length, 0);
});

test('a late file picker from a disposed setup cannot reopen the workflow under the same UID', async () => {
    const f = fixture(); f.setup('A');
    const oldInput = f.body.children.find(node => node.type === 'file');
    f.setup('A'); oldInput.files = [{}]; await oldInput.trigger('change');
    assert.equal(f.body.querySelector('form'), undefined);
    assert.equal(f.button.disabled, false); assert.equal(f.observers.size, 0);
    const current = f.select(); assert.ok(f.body.querySelector('form'));
    f.lock(); await current;
});

test('partial apply shows a warning instead of success or an invalid-backup claim', async () => {
    const f = fixture(); f.setup('A'); const pending = f.select();
    f.confirm('synthetic recovery'); await tick(); f.confirm('RIPRISTINA'); await pending;
    assert.equal(f.executions.length, 1); assert.equal(f.toasts.length, 1);
    assert.equal(f.toasts[0][1], 'warning'); assert.match(f.toasts[0][0], /già stati applicati/);
    assert.equal(f.plan.recoveryKey, ''); assert.equal(f.observers.size, 0);
});

test('pagehide during confirmation clears the dialog and prevents execution', async () => {
    const f = fixture(); f.setup('A'); const pending = f.select();
    f.confirm('synthetic recovery'); await tick();
    const input = f.body.querySelector('form').querySelector('input'); input.value = 'RIPRISTINA';
    f.hide(); await pending;
    assert.equal(input.value, ''); assert.equal(f.plan.recoveryKey, ''); assert.equal(f.executions.length, 0);
});

test('same-UID lock closes the selective preview without accepting its retained restore button', async () => {
    const f = fixture();
    f.plan.collisionCount = 1;
    f.plan.comparison = {counts: {missing: 1, changed: 0, unchanged: 0}, entries: [{index: 0, scope: 'private-account', status: 'missing', description: 'Synthetic account'}]};
    f.setup('A'); const pending = f.select(); f.confirm('synthetic recovery'); await tick();
    const restore = f.nodes.find(node => node.textContent === 'Ripristina selezionati (1)'); assert.ok(restore);
    f.lock(); await pending; await restore.click();
    assert.equal(restore.isConnected, false); assert.equal(f.executions.length, 0); assert.equal(f.plan.recoveryKey, '');
});


test('stale preview without applied chunks asks for a new comparison', async () => {
    const f = fixture();
    f.service.executeBackupRestore = async () => { const error = new Error('BACKUP_PREVIEW_STALE'); error.code = 'BACKUP_PREVIEW_STALE'; throw error; };
    f.setup('A'); const pending = f.select();
    f.confirm('synthetic recovery'); await tick(); f.confirm('RIPRISTINA'); await pending;
    assert.equal(f.toasts.length, 1); assert.equal(f.toasts[0][1], 'warning');
    assert.match(f.toasts[0][0], /cambiati dopo l’anteprima/);
    assert.equal(f.plan.recoveryKey, '');
});


test('uncertain Firestore waits for explicit resume and reuses the plan with retry permission', async () => {
    const f = fixture(), calls = [];
    f.service.executeBackupRestore = async (...args) => {
        calls.push(args);
        throw Object.assign(new Error('synthetic uncertain'), {code: calls.length === 1 ? 'BACKUP_FIRESTORE_UNCERTAIN' : 'BACKUP_STORAGE_RETRY_BLOCKED', retryable: calls.length === 1, progress: {mayHaveApplied: true}});
    };
    f.setup('A'); const pending = f.select();
    f.confirm('synthetic recovery'); await tick(); f.confirm('RIPRISTINA'); await tick();
    assert.equal(calls.length, 1); assert.equal(f.plan.recoveryKey, 'private-recovery');
    const resume = f.nodes.find(node => node.textContent === 'Verifica e riprendi' && node.isConnected);
    assert.ok(resume); await resume.click(); await pending;
    assert.equal(calls.length, 2); assert.equal(calls[0][0], calls[1][0]);
    assert.equal(calls[0][2].retry, false); assert.equal(calls[1][2].retry, true);
    assert.equal(f.nodes.some(node => node.textContent === 'Verifica e riprendi' && node.isConnected), false);
    assert.equal(f.plan.recoveryKey, '');
});

test('stopping an uncertain restore does not retry and releases the retained plan', async () => {
    const f = fixture(); let calls = 0;
    f.service.executeBackupRestore = async () => { calls++; throw Object.assign(new Error('uncertain'), {code: 'BACKUP_FIRESTORE_UNCERTAIN', retryable: true, progress: {mayHaveApplied: true}}); };
    f.setup('A'); const pending = f.select();
    f.confirm('synthetic recovery'); await tick(); f.confirm('RIPRISTINA'); await tick();
    await f.nodes.find(node => node.textContent === 'Interrompi' && node.isConnected).click(); await pending;
    assert.equal(calls, 1); assert.equal(f.plan.recoveryKey, '');
    assert.equal(f.toasts[0][1], 'warning');
});

test('Vault lock closes retry choice and a retained resume callback cannot execute again', async () => {
    const f = fixture(); let calls = 0;
    f.service.executeBackupRestore = async () => { calls++; throw Object.assign(new Error('uncertain'), {code: 'BACKUP_FIRESTORE_UNCERTAIN', retryable: true, progress: {mayHaveApplied: true}}); };
    f.setup('A'); const pending = f.select();
    f.confirm('synthetic recovery'); await tick(); f.confirm('RIPRISTINA'); await tick();
    const resume = f.nodes.find(node => node.textContent === 'Verifica e riprendi' && node.isConnected);
    f.lock(); await pending; await resume.click();
    assert.equal(calls, 1); assert.equal(f.plan.recoveryKey, ''); assert.equal(f.toasts.length, 0);
});

test('capacity failure explains that backup is retained and no restore has run', async () => {
    const f = fixture();
    f.service.prepareBackupRestore = async () => { throw new Error('BACKUP_PREVIEW_CAPACITY_EXCEEDED'); };
    f.setup('A'); const pending = f.select(); f.confirm('synthetic recovery'); await pending;
    assert.equal(f.executions.length, 0); assert.equal(f.toasts.length, 1);
    assert.equal(f.toasts[0][1], 'warning'); assert.match(f.toasts[0][0], /capacità.*Nessun dato.*conserva il file/);
    assert.equal(f.button.disabled, false);
});

test('credential report is removed immediately on lock and late reports cannot reopen it', async () => {
    const report = () => ({scanned: 1, atRisk: 1, results: [{title: 'Synthetic', area: 'privato', strength: 'weak', flags: ['weak']}]});
    const f = fixture({health: true}), first = report(); f.service.inspectOwnerCredentialHealth = async () => first;
    f.setup('A'); await f.button.click();
    assert.ok(f.body.children.some(node => node.role === 'dialog'));
    f.lock(); assert.equal(f.body.children.some(node => node.role === 'dialog'), false);
    assert.equal(first.results.length, 0); assert.equal(f.observers.size, 0);
    const late = deferred(); f.service.inspectOwnerCredentialHealth = () => late.promise;
    const pending = f.button.click(); await tick(); f.changeUid('B'); late.resolve(report()); await pending;
    assert.equal(f.body.children.some(node => node.role === 'dialog'), false); assert.equal(f.toasts.length, 0);
});

test('credential setup replacement removes old listeners and prevents duplicate analysis', async () => {
    const f = fixture({health: true}); let calls = 0; const gate = deferred();
    f.service.inspectOwnerCredentialHealth = () => { calls++; return gate.promise; };
    f.setup('A'); f.setup('A');
    const first = f.button.click(); await tick(); await f.button.click(); assert.equal(calls, 1);
    f.lock(); gate.resolve({scanned: 0, atRisk: 0, results: []}); await first;
    assert.equal(f.observers.size, 0);
});
