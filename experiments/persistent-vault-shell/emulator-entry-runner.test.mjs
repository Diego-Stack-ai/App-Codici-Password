import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createShellCommands} from './shell-commands.mjs';
import {seedEmulatorAdmission} from './emulator-admission-seed.mjs';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';

test('actual entry does not activate private gate when lock cancels pending login', async () => {
    const source = await readFile(new URL('./emulator-entry.mjs', import.meta.url), 'utf8');
    const match = source.match(/signIn: (async \(\) => \{[\s\S]*?\r?\n    \}),?\r?\n    getSelectedRoute:/);
    assert.ok(match, 'exercise the actual entry signIn callback');
    let finish, activations = 0;
    const scope = {activationEpoch: 0, usePrivateGate: true, auth: {}, byId: () => ({value: 'a'}),
        signInWithEmailAndPassword: () => new Promise(resolve => {finish = resolve;}),
        activatePrivateGate: async () => {activations++;}};
    const login = runInNewContext(`(${match[1]})`, scope);
    const pending = login();
    scope.activationEpoch++; // commandSession.lock and pagehide both revoke this epoch.
    finish();
    await assert.rejects(pending, /AUTH_CHANGED/);
    assert.equal(activations, 0);
});

for (const cancelled of [false, true]) {
    test(`actual entry private gate script completion ${cancelled ? 'rejects revoked activation' : 'creates session and admits initial route'}`, async () => {
        const source = await readFile(new URL('./emulator-entry.mjs', import.meta.url), 'utf8');
        const start = source.indexOf('async function activatePrivateGate()');
        const end = source.indexOf("window.addEventListener('pagehide'", start);
        assert.ok(start >= 0 && end > start);
        const calls = [];
        let script;
        const gate = {reject: () => calls.push('reject')};
        const scope = {gateAttempted: false, activationEpoch: 0, auth: {currentUser: {uid: 'a'}},
            selectedRoute: 'private', window: {privateAuthGate: gate},
            session: {dispose: () => calls.push('old.dispose')},
            document: {createElement: () => ({}), head: {append(value) {script = value; calls.push('append');}}},
            createPrivateGatePresentation(options) {assert.equal(options.gate, gate); calls.push('presentation'); return {};},
            createSession() {calls.push('session'); return {dispose: () => calls.push('new.dispose'), navigate: async route => calls.push(route)};}};
        const activate = runInNewContext(`${source.slice(start, end)}\nactivatePrivateGate;`, scope);
        const pending = activate();
        assert.deepEqual(calls, ['old.dispose', 'append']);
        assert.equal(script.src, '/assets/js/private-auth-gate.js');
        if (cancelled) scope.activationEpoch++;
        script.onload();
        if (cancelled) {
            await assert.rejects(pending, /AUTH_CHANGED/);
            assert.deepEqual(calls, ['old.dispose', 'append', 'old.dispose', 'reject']);
        } else {
            await pending;
            assert.deepEqual(calls, ['old.dispose', 'append', 'presentation', 'session', 'private']);
        }
        await assert.rejects(activate(), /GATE_RELOAD_REQUIRED/);
    });
}

test('emulator admission reuses initialized App Check and rejects missing instance or wrong origin', async () => {
    // Execute the actual module body with synthetic SDK dependencies, no network.
    const source = (await readFile(new URL('./emulator-firebase.mjs', import.meta.url), 'utf8'))
        .replace(/^import .*;\r?\n/gm, '').replace(/export /g, '') + '\nrequireEmulatorAppCheck;';
    function fixture(instance, origin = 'http://127.0.0.1:4188') {
        const location = {origin};
        let initializations = 0;
        const sdk = Object.fromEntries(['getFunctions', 'connectFunctionsEmulator', 'initializeAuth',
            'connectAuthEmulator', 'getFirestore', 'initializeFirestore', 'persistentLocalCache',
            'persistentMultipleTabManager', 'connectFirestoreEmulator', 'getStorage',
            'connectStorageEmulator'].map(name => [name, () => ({})]));
        const requireInstance = runInNewContext(source, {...sdk, location,
            initializeApp: () => ({}), inMemoryPersistence: {}, indexedDBLocalPersistence: {},
            CustomProvider: class {}, initializeAppCheck() {initializations++; return instance;}});
        return {requireInstance, location, count: () => initializations};
    }
    const instance = {}, ready = fixture(instance);
    assert.equal(ready.requireInstance(), instance);
    assert.equal(ready.requireInstance(), instance);
    assert.equal(ready.count(), 1);
    ready.location.origin = 'https://example.invalid';
    assert.throws(ready.requireInstance, /LOCAL_EMULATOR_ONLY/);
    assert.throws(() => fixture(undefined).requireInstance(), /EMULATOR_APPCHECK_NOT_INITIALIZED/);
    assert.throws(() => fixture(instance, 'http://localhost:4188'), /LOCAL_EMULATOR_ONLY/);
});

test('admission seed is restricted to exact demo loopback and known synthetic owners', async () => {
    const calls = [];
    const options = {projectId: 'demo-vault-shell', authHost: '127.0.0.1:9099', firestoreHost: '127.0.0.1:8085',
        uid: 'synthetic-a', email: 'a@example.invalid',
        getUser: async uid => ({uid, email: 'a@example.invalid'}),
        updateUser: async (...args) => calls.push(['auth', ...args]),
        writePolicy: async (...args) => calls.push(['policy', ...args])};
    for (const change of [{projectId: 'production'}, {authHost: 'localhost:9099'},
        {firestoreHost: 'remote:8085'}, {email: 'real@example.com'}, {uid: 'a/b'},
        {getUser: async () => ({uid: 'other', email: options.email})}]) {
        await assert.rejects(seedEmulatorAdmission({...options, ...change}));
        assert.deepEqual(calls, []);
    }
    await seedEmulatorAdmission(options);
    assert.deepEqual(calls, [['auth', 'synthetic-a', {emailVerified: true}],
        ['policy', 'synthetic-a', {passwordPolicyVersion: 1}]]);
});
import {assertEveryBrowserReported, awaitDevToolsEndpoint} from './emulator-network-control.mjs';

// Deterministic regression for the endpoint/exit race of the entry runner: a
// browser that closes after the endpoint has been received is a normal close, and
// a missing browser outcome must never be silently accepted.
const fakeBrowser = () => {
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.exitCode = null;
    child.exit = code => {child.exitCode = code; child.emit('exit', code);};
    return child;
};
const endpointLine = 'DevTools listening on ws://127.0.0.1:9333/devtools/browser/fixture\n';

const commandTick = () => new Promise(resolve => setImmediate(resolve));
function commandFixture(overrides = {}) {
    const controls = Object.fromEntries(['login', 'unlock', 'lock', 'logout', 'private', 'profile', 'companies'].map(name => [name, new EventTarget()]));
    const events = [], busy = [], errors = [];
    const session = {lock: () => events.push('lock'), unlock: async () => {},
        logout: async () => events.push('logout'), navigate: async route => events.push(route)};
    const deps = {session, controls, signIn: async () => {}, getSelectedRoute: () => 'overview',
        navigateList: route => events.push(route), setBusy: value => busy.push(value),
        clearMessage() {}, refreshControls() {}, showError: error => errors.push(error), ...overrides};
    return {deps, controls, events, busy, errors, click: name => controls[name].dispatchEvent(new Event('click'))};
}
for (const operation of ['login', 'unlock']) {
    test(`${operation} completion after lock cannot navigate or overlap a second operation`, async () => {
        let resolve, calls = 0;
        const pending = new Promise(yes => {resolve = yes;});
        const fixture = commandFixture();
        const action = () => {calls++; return pending;};
        if (operation === 'login') fixture.deps.signIn = action;
        else fixture.deps.session.unlock = action;
        const commands = createShellCommands(fixture.deps);
        fixture.click(operation); fixture.click('lock'); fixture.click(operation);
        assert.equal(calls, 1); assert.deepEqual(fixture.busy, [true]);
        resolve(); await commandTick();
        assert.deepEqual(fixture.events, ['lock']);
        assert.deepEqual(fixture.busy, [true, false]);
        fixture.click(operation); await commandTick();
        assert.equal(calls, 2); assert.deepEqual(fixture.events, ['lock', 'overview']);
        commands.dispose();
    });
}
test('disposed commands detach every control and suppress pending completion UI', async () => {
    let resolve;
    const fixture = commandFixture({signIn: () => new Promise(yes => {resolve = yes;})});
    const commands = createShellCommands(fixture.deps);
    fixture.click('login'); commands.dispose(); commands.dispose();
    for (const name of Object.keys(fixture.controls)) fixture.click(name);
    resolve(); await commandTick();
    assert.deepEqual(fixture.events, []); assert.deepEqual(fixture.busy, [true]);
});
test('failed partial command binding removes prior listeners', async () => {
    const fixture = commandFixture();
    delete fixture.controls.profile;
    assert.throws(() => createShellCommands(fixture.deps), /profile/);
    fixture.click('login'); fixture.click('private'); await commandTick();
    assert.deepEqual(fixture.events, []); assert.deepEqual(fixture.busy, []);
});
test('route commands remain independent while authentication is pending', async () => {
    let resolve;
    const fixture = commandFixture({signIn: () => new Promise(yes => {resolve = yes;})});
    const commands = createShellCommands(fixture.deps);
    fixture.click('login');
    for (const name of ['private', 'profile', 'companies']) fixture.click(name);
    assert.deepEqual(fixture.events, ['private', 'profile', 'companies']);
    resolve(); await commandTick(); commands.dispose();
});
test('obsolete rejection stays silent and UI startup failure releases command busy', async () => {
    let reject;
    const fixture = commandFixture({signIn: () => new Promise((yes, no) => {reject = no;})});
    const commands = createShellCommands(fixture.deps);
    fixture.click('login'); fixture.click('lock'); reject(Error('synthetic late rejection'));
    await commandTick();
    assert.deepEqual(fixture.errors, []); assert.deepEqual(fixture.busy, [true, false]);
    commands.dispose();
    let starts = 0;
    const broken = commandFixture({clearMessage() {throw Error('synthetic UI failure');}, signIn() {starts++;}});
    const binding = createShellCommands(broken.deps);
    broken.click('login'); broken.click('login'); await commandTick();
    assert.equal(starts, 0); assert.equal(broken.errors.length, 2);
    assert.deepEqual(broken.busy, [true, false, true, false]); binding.dispose();
});
test('the endpoint is awaited once and reported', async () => {
    const child = fakeBrowser();
    const pending = awaitDevToolsEndpoint(child, {timeoutMs: 200});
    child.stderr.emit('data', Buffer.from(endpointLine));
    assert.equal(await pending, 'ws://127.0.0.1:9333/devtools/browser/fixture');
});
test('a close after the endpoint is not an early exit and never rejects the wait', async () => {
    const child = fakeBrowser();
    const pending = awaitDevToolsEndpoint(child, {timeoutMs: 200});
    child.stderr.emit('data', Buffer.from('not the endpoint yet\n'));
    child.stderr.emit('data', Buffer.from(endpointLine));
    assert.match(await pending, /^ws:\/\//);
    // The listeners are detached: the later normal close stays silent, and no
    // second settlement or unhandled rejection can come out of it.
    child.exit(0);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(child.listenerCount('exit'), 0);
    assert.equal(child.stderr.listenerCount('data'), 0);
});
test('a browser that exits before the endpoint reports the browser identity and the sanitized stderr', async () => {
    const child = fakeBrowser();
    const pending = awaitDevToolsEndpoint(child, {timeoutMs: 200,
        describe: () => ({browser: 'edge', path: 'C:/Edge/msedge.exe', args: ['--headless=new'], exitCode: child.exitCode})});
    child.stderr.emit('data', Buffer.from('profile C:/Temp/codex-entry-browser-Ab12Cd is corrupt\n'));
    child.exit(0);
    await assert.rejects(pending, error => {
        assert.match(error.message, /DEVTOOLS_BROWSER_EXITED_BEFORE_ENDPOINT:0/);
        const detail = JSON.parse(error.message.slice(error.message.indexOf('{')));
        assert.equal(detail.browser, 'edge');
        assert.equal(detail.path, 'C:/Edge/msedge.exe');
        assert.equal(detail.exitCode, 0);
        assert.match(detail.stderr, /codex-entry-browser-<profile>/, 'the disposable profile token is redacted');
        assert.doesNotMatch(detail.stderr, /Ab12Cd/);
        return true;
    });
    assert.equal(child.listenerCount('exit'), 0, 'the failing wait detaches its listeners too');
});
test('a browser that never reports the endpoint times out', async () => {
    const child = fakeBrowser();
    await assert.rejects(awaitDevToolsEndpoint(child, {timeoutMs: 20}), /DEVTOOLS_ENDPOINT_TIMEOUT/);
    assert.equal(child.listenerCount('exit'), 0);
});
test('the matrix needs one identified result per browser and never counts one twice', () => {
    const browsers = [{name: 'chrome', path: 'chrome.exe'}, {name: 'edge', path: 'msedge.exe'}];
    const results = [{browser: 'chrome'}, {browser: 'edge'}];
    assert.deepEqual(assertEveryBrowserReported({browsers, results}), results);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [{browser: 'chrome'}]}),
        /ENTRY_BROWSER_RESULTS_MISSING:1\/2/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: []}), /ENTRY_BROWSER_RESULTS_MISSING:0\/2/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [{browser: 'chrome'}, {browser: 'chrome'}]}),
        /ENTRY_BROWSER_RESULT_DUPLICATED/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [undefined, {browser: 'edge'}]}),
        /ENTRY_BROWSER_RESULT_UNIDENTIFIED/);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [{browser: 'firefox'}, {browser: 'edge'}]}),
        /ENTRY_BROWSER_RESULT_UNIDENTIFIED/);
});
// A2-R2: the identity of a result is the (browser, device profile) pair. The same
// pair must never be counted twice, and a result that does not say which device
// profile it came from is not accepted while profiles are in play.
test('the matrix counts each (browser, device profile) pair once', () => {
    const desktop = {name: 'desktop'}, mobile = {name: 'mobile'};
    const browsers = [{name: 'chrome', path: 'chrome.exe', profile: desktop}, {name: 'chrome', path: 'chrome.exe', profile: mobile},
        {name: 'edge', path: 'msedge.exe', profile: desktop}, {name: 'edge', path: 'msedge.exe', profile: mobile}];
    const results = [{browser: 'chrome', profile: 'desktop'}, {browser: 'chrome', profile: 'mobile'},
        {browser: 'edge', profile: 'desktop'}, {browser: 'edge', profile: 'mobile'}];
    assert.deepEqual(assertEveryBrowserReported({browsers, results}), results);
    assert.throws(() => assertEveryBrowserReported({browsers, results: results.slice(1)}), /ENTRY_BROWSER_RESULTS_MISSING:3\/4/);
    assert.equal(assertEveryBrowserReported({browsers: [{name: 'chrome', profile: desktop}], results: [{browser: 'chrome', profile: 'desktop'}]}).length, 1);
    assert.throws(() => assertEveryBrowserReported({browsers, results: [results[0], results[1], results[2], results[0]]}),
        /ENTRY_BROWSER_RESULT_DUPLICATED/, 'the same browser with the same profile is never counted twice');
    assert.throws(() => assertEveryBrowserReported({browsers,
        results: [{browser: 'chrome', profile: 'tablet'}, results[1], results[2], results[3]]}),
        /ENTRY_BROWSER_RESULT_UNIDENTIFIED/, 'an unexpected device profile is not accepted');
    assert.throws(() => assertEveryBrowserReported({browsers, results: [{browser: 'chrome'}, results[1], results[2], results[3]]}),
        /ENTRY_BROWSER_RESULT_UNIDENTIFIED/, 'a result without the device profile identity is not accepted');
});
