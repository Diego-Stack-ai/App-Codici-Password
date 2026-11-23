import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import vm from 'node:vm';

const root = new URL('../Frontend/public/', import.meta.url);
const gateSource = await readFile(new URL('assets/js/private-auth-gate.js', root), 'utf8');
const main = await readFile(new URL('assets/js/main-v129.js', root), 'utf8');
const logoutSource = (await readFile(new URL('assets/js/logout-session.js', root), 'utf8')).replace(/^import .*;\r?\n/gm, '').replace('export ', '');
const vaultSource = (await readFile(new URL('assets/js/modules/core/vault-session.js', root), 'utf8')).replace(/^export /gm, '');
const verifiedUser = {uid: 'synthetic', emailVerified: true};

function fixture({page = '/fixture.html', search = '', initialStorage = {}, bodyPresent = true, storageReadable = true} = {}) {
    const redirects = [], events = [], timers = new Map(), handlers = new Map(), storage = new Map(Object.entries(initialStorage));
    let serial = 0;
    const body = {hidden: true, inert: true};
    const documentElement = {dataset: {}};
    const document = {body: bodyPresent ? body : null, documentElement};
    const window = {document, location: {pathname: page, search, replace: url => redirects.push(url), reload: () => redirects.push('reload')},
        dispatchEvent: event => events.push(event.type), addEventListener: (name, fn) => handlers.set(name, fn)};
    window.parent = window;
    const context = vm.createContext({beginFrameLogout: () => null, window, navigateDocument: target => window.location.replace(target), document, Event, Promise, URLSearchParams,
        setTimeout: (fn, ms) => { timers.set(++serial, {fn, ms}); return serial; },
        clearTimeout: id => timers.delete(id),
        sessionStorage: {getItem: key => {if (!storageReadable) throw Error('STORAGE_UNAVAILABLE'); return storage.get(key) ?? null;}, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)}});
    vm.runInContext(gateSource, context);
    return {context, gate: window.privateAuthGate, body, documentElement, redirects, events, storage, timers, handlers};
}

test('all 22 private HTML entries are hidden and inert before JavaScript; public exceptions stay public', async () => {
    const publicPages = new Set(['app.html','index.html','login.html','registrati.html','reset_password.html','imposta_nuova_password.html','privacy.html','termini.html','contatto_condiviso.html']);
    let count = 0;
    for (const name of (await readdir(root)).filter(name => name.endsWith('.html'))) {
        const html = await readFile(new URL(name, root), 'utf8');
        if (name === 'app.html') {
            assert.match(html, /vault-frame-entry\.js/); assert.match(html, /<iframe[^>]*hidden[^>]*inert/); continue;
        }
        if (publicPages.has(name)) { assert.doesNotMatch(html, /data-private-auth/, name); continue; }
        count++;
        assert.match(html, /<body\b[^>]*data-private-auth[^>]*\bhidden\b[^>]*\binert\b/, name);
        assert.ok(html.indexOf('private-auth-gate.js') < html.indexOf('<body'), name);
        assert.match(html, /main-v129\.js/, name);
    }
    assert.equal(count, 22);
    const css = await readFile(new URL('assets/css/core.css', root), 'utf8');
    assert.match(css, /body\[data-private-auth\]\[hidden\]\s*\{\s*display: none !important;/);
    assert.match(css, /html\[data-private-auth-state="pending"\]::before/);
});

test('direct unauthenticated access stays hidden and redirects to absolute login', () => {
    const f = fixture();
    assert.equal(f.body.hidden, true);
    f.gate.begin(null); f.gate.reject();
    assert.equal(f.body.hidden, true); assert.equal(f.body.inert, true);
    assert.deepEqual(f.redirects, ['/login.html']);
});

test('verified Firebase identity reveals the page only after the pending check', () => {
    const f = fixture(); const ticket = f.gate.begin(verifiedUser.uid);
    assert.equal(f.body.hidden, true);
    assert.equal(f.documentElement.dataset.privateAuthState, 'pending');
    assert.equal(f.gate.acceptIdentity(ticket, verifiedUser), true);
    assert.equal(f.documentElement.dataset.privateAuthState, undefined);
    assert.equal(f.body.hidden, false); assert.equal(f.body.inert, false); assert.equal(f.timers.size, 0);
});

test('unverified identity cannot reveal private HTML', () => {
    const f = fixture(); const ticket = f.gate.begin('synthetic');
    assert.equal(f.gate.acceptIdentity(ticket, {...verifiedUser, emailVerified: false}), false);
    assert.equal(f.body.hidden, true);
});

test('Home keeps first presentation pending after identity and only the current ready ticket reveals it', () => {
    const f = fixture({page: '/home_page.html'}), ticket = f.gate.begin(verifiedUser.uid);
    assert.equal(f.documentElement.dataset.privatePageState, 'pending');
    assert.equal(f.gate.reveal(ticket), false, 'identity is still unverified');
    assert.equal(f.gate.acceptIdentity(ticket, verifiedUser), true);
    assert.equal(f.body.inert, false, 'real body-level Vault modal can be used');
    assert.equal(f.documentElement.dataset.privatePageState, 'pending', 'Home remains held');
    assert.equal(f.gate.reveal(ticket - 1), false);
    assert.equal(f.gate.reveal(ticket), true);
    assert.equal(f.documentElement.dataset.privatePageState, undefined);
});

test('a late Home reveal cannot override logout, another identity, a blocked fence or document replacement', () => {
    for (const boundary of ['logout', 'identity', 'fence', 'document']) {
        const f = fixture({page: '/home_page.html'}), ticket = f.gate.begin(verifiedUser.uid);
        f.gate.acceptIdentity(ticket, verifiedUser);
        if (boundary === 'logout') f.gate.block();
        if (boundary === 'identity') f.gate.begin('other-user');
        if (boundary === 'fence') f.context.window.authSessionFence = {isLocallyAllowed: () => false};
        if (boundary === 'document') f.context.window.document = {};
        assert.equal(f.gate.reveal(ticket), false, boundary);
        assert.equal(f.documentElement.dataset.privatePageState, 'pending', boundary);
    }
});

for (const kind of ['error', 'timeout']) test(kind + ' keeps the page hidden and rejects a late Auth success', () => {
    const f = fixture(); const ticket = f.gate.begin(verifiedUser.uid);
    if (kind === 'error') f.gate.reject('error');
    else [...f.timers.values()][0].fn();
    assert.equal(f.gate.acceptIdentity(ticket, verifiedUser), false);
    assert.equal(f.body.hidden, true);
    assert.deepEqual(f.redirects, ['/login.html?authCheck=' + kind]);
});

test('missing bootstrap also times out closed', () => {
    const f = fixture();
    assert.equal([...f.timers.values()][0].ms, 45000);
    [...f.timers.values()][0].fn();
    assert.equal(f.body.hidden, true); assert.equal(f.redirects.length, 1);
    const marker = JSON.parse(f.storage.get('codex_auth_gate_last_failure_v1'));
    assert.equal(marker.reason, 'timeout');
    assert.equal(marker.page, 'fixture.html');
});

test('stale identity callbacks cannot reveal the page after logout or UID change', () => {
    const f = fixture(); const ticket = f.gate.begin('synthetic');
    f.gate.acceptIdentity(ticket, verifiedUser);
    assert.equal(f.gate.begin('other'), null);
    assert.equal(f.body.hidden, true); assert.equal(f.gate.acceptIdentity(ticket, verifiedUser), false);
});

test('back-forward restoration remains hidden and reloads the authentication check', () => {
    const f = fixture(); f.gate.acceptIdentity(f.gate.begin('synthetic'), verifiedUser);
    f.handlers.get('pagehide')(); assert.equal(f.body.hidden, true);
    f.handlers.get('pageshow')({persisted: true}); assert.deepEqual(f.redirects, ['reload']);
});

for (const bodyPresent of [true, false]) test('logout marker denies startup before Auth even before body exists: ' + bodyPresent, () => {
    const f = fixture({page: '/app.html', bodyPresent, initialStorage: {codex_explicit_logout: '1'}});
    assert.deepEqual(f.redirects, ['/login.html']);
    assert.equal(f.documentElement.dataset.privateAuthState, 'pending');
    assert.equal(f.timers.size, 0);
    assert.equal(f.gate.isReady(), false);
    const ticket = f.gate.begin(verifiedUser.uid);
    assert.equal(ticket, null);
    assert.equal(f.gate.acceptIdentity(ticket, verifiedUser), false);
    assert.equal(f.gate.reveal(ticket), false);
    assert.equal(f.body.hidden, true); assert.equal(f.body.inert, true);
});

for (const persisted of [true, false]) test('logout marker on repeated pageshow bypasses stale top-level exit: ' + persisted, () => {
    const f = fixture({page: '/app.html'}), ticket = f.gate.begin(verifiedUser.uid);
    f.gate.acceptIdentity(ticket, verifiedUser);
    let deferred = 0;
    f.context.window.vaultFrameNavigation = {deferExit() {deferred++; return true;}};
    // Simulate the old document's pending exit and its redirecting sentinel.
    f.gate.reject();
    assert.equal(deferred, 1); assert.deepEqual(f.redirects, []);
    f.storage.set('codex_explicit_logout', '1');
    for (let i = 0; i < 4; i++) {
        f.handlers.get('pagehide')();
        f.handlers.get('pageshow')({persisted});
        assert.equal(f.body.hidden, true); assert.equal(f.body.inert, true);
        assert.equal(f.gate.acceptIdentity(ticket, verifiedUser), false);
        assert.equal(f.gate.reveal(ticket), false);
    }
    assert.deepEqual(f.redirects, Array(4).fill('/login.html'));
    assert.equal(deferred, 1, 'restored top-level document must not reuse its old queued exit');
    assert.equal(f.timers.size, 0);
});

test('first ordinary pageshow during pending logout waits for cleanup before top-level exit', async () => {
    const f = fixture(); f.gate.acceptIdentity(f.gate.begin(verifiedUser.uid), verifiedUser);
    let finishDeny, signOutCalls = 0, queued = 0;
    const denied = new Promise(resolve => {finishDeny = resolve;});
    f.context.window.authSessionFence = {deny: () => denied, isLocallyAllowed: () => false};
    f.context.window.vaultFrameNavigation = {deferExit() {queued++; return true;}};
    vm.runInContext(vaultSource + '\n' + logoutSource, f.context);
    const logout = f.context.logoutWithCleanup(async () => {signOutCalls++;});
    f.handlers.get('pageshow')({persisted: false});
    assert.equal(signOutCalls, 0);
    assert.deepEqual(f.redirects, [], 'initial load event must preserve the current logout hold');
    assert.equal(queued, 1);
    assert.equal(f.body.hidden, true); assert.equal(f.body.inert, true);
    finishDeny(); await logout;
    assert.equal(signOutCalls, 1);
    assert.deepEqual(f.redirects, ['/login.html']);
});

test('unreadable logout storage at startup fails closed before Auth', () => {
    const f = fixture({storageReadable: false});
    assert.deepEqual(f.redirects, ['/login.html']);
    assert.equal(f.body.hidden, true); assert.equal(f.body.inert, true);
    assert.equal(f.timers.size, 0);
});

test('unreadable logout storage on restore cannot reveal a previously accepted document', () => {
    const f = fixture(), ticket = f.gate.begin(verifiedUser.uid);
    f.gate.acceptIdentity(ticket, verifiedUser);
    f.context.sessionStorage.getItem = () => {throw Error('STORAGE_UNAVAILABLE');};
    f.handlers.get('pagehide')(); f.handlers.get('pageshow')({persisted: true});
    assert.deepEqual(f.redirects, ['/login.html']);
    assert.equal(f.gate.reveal(ticket), false);
    assert.equal(f.body.hidden, true); assert.equal(f.body.inert, true);
});

test('a logged-out restored child keeps cleanup and navigation owned by its parent', () => {
    const f = fixture(), ticket = f.gate.begin(verifiedUser.uid);
    f.gate.acceptIdentity(ticket, verifiedUser);
    const calls = [];
    f.context.window.parent = {vaultFrameNavigation: {
        revokeFromChild: () => {},
        navigateFromChild(source, doc, target, replace) {calls.push({source, doc, target, replace}); return true;}
    }};
    f.storage.set('codex_explicit_logout', '1');
    for (let i = 0; i < 2; i++) f.handlers.get('pageshow')({persisted: true});
    assert.equal(calls.length, 2);
    assert.ok(calls.every(call => call.source === f.context.window && call.doc === f.context.document && call.target === '/login.html' && call.replace));
    assert.deepEqual(f.redirects, [], 'child must not navigate its own frame to a public page');
    assert.equal(f.body.hidden, true); assert.equal(f.body.inert, true);
});

test('ordinary pageshow stays usable; a new explicit login removes logout-only routing', () => {
    const f = fixture(), ticket = f.gate.begin(verifiedUser.uid);
    f.gate.acceptIdentity(ticket, verifiedUser);
    f.handlers.get('pageshow')({persisted: false});
    assert.equal(f.body.hidden, false); assert.deepEqual(f.redirects, []);
    f.storage.set('codex_explicit_logout', '1');
    f.handlers.get('pageshow')({persisted: true});
    assert.deepEqual(f.redirects, ['/login.html']);
    f.storage.delete('codex_explicit_logout');
    f.handlers.get('pageshow')({persisted: true});
    assert.deepEqual(f.redirects, ['/login.html', 'reload']);
});

test('obsolete pageshow cannot navigate or hide a replacement document', () => {
    const f = fixture(); f.gate.acceptIdentity(f.gate.begin(verifiedUser.uid), verifiedUser);
    f.context.window.document = {};
    f.storage.set('codex_explicit_logout', '1');
    f.handlers.get('pageshow')({persisted: true});
    assert.deepEqual(f.redirects, []);
    assert.equal(f.body.hidden, false);
});

for (const [page, search, target] of [
    ['/impostazioni.html', '?recovery=complete', '/login.html?recovery=complete'],
    ['/impostazioni.html', '?recovery=complete&recovery=complete', '/login.html'],
    ['/app.html', '?recovery=complete&route=%2Fimpostazioni.html', '/login.html']
]) test('logout startup keeps recovery intent bounded to allowed page/query: ' + page + search, () => {
    const f = fixture({page, search, initialStorage: {codex_explicit_logout: '1'}});
    assert.deepEqual(f.redirects, [target]);
});

for (const outcome of ['success','failure','timeout']) test('logout ' + outcome + ': locks and clears local Vault before signOut, then redirects', async () => {
    const f = fixture(); f.gate.acceptIdentity(f.gate.begin('synthetic'), verifiedUser);
    for (const key of ['vault_session_v1','codex_vault_session_wrapping_key_v1','vault_s_key','vault_s_expiry']) f.storage.set(key, 'synthetic');
    f.storage.set('unrelated-preference', 'retain');
    vm.runInContext(vaultSource + '\n' + logoutSource, f.context);
    const operation = async () => {
        assert.equal(f.body.hidden, true);
        assert.ok(f.events.includes('private-auth-blocked'));
        assert.equal(f.storage.has('vault_session_v1'), false);
        if (outcome === 'failure') throw new Error('synthetic');
        if (outcome === 'timeout') return new Promise(() => {});
    };
    const pending = f.context.logoutWithCleanup(operation);
    if (outcome === 'timeout') { await Promise.resolve(); [...f.timers.values()][0].fn(); }
    await pending;
    assert.equal(f.storage.get('codex_explicit_logout'), '1');
    assert.equal(f.storage.get('unrelated-preference'), 'retain');
    assert.deepEqual(f.redirects, ['/login.html']);
});

test('real bootstrap wires observer error, confirms before data reads and rejects null users', () => {
    assert.match(main, /onAuthStateChanged\(auth, async \(user\) => \{[\s\S]*?gate\?\.begin\(user\?\.uid\)/);
    assert.ok(main.indexOf('gate?.acceptIdentity(authAttempt, auth.currentUser)') < main.indexOf('const userDoc ='));
    assert.match(main, /\}, \(\) => \{ window\.privateAuthGate\?\.reject\('error'\); \}\);/);
    assert.match(main, /else \{[\s\S]*?gate\?\.reject\(\);/);
});

test('logout lock reaches the real RAM cleanup and explicit login clears the deny marker', async () => {
    const security = await readFile(new URL('assets/js/modules/core/security-manager.js', root), 'utf8');
    const auth = await readFile(new URL('assets/js/auth.js', root), 'utf8');
    const header = await readFile(new URL('assets/js/components-v129.js', root), 'utf8');
    assert.match(security, /addEventListener\('private-auth-blocked', \(\) => clearSession\(\)\)/);
    assert.match(security, /export function clearSession\(\{notifyFrame = true\} = \{\}\) \{[\s\S]*?invalidatePendingUnlock\(\);\s*_vaultKeyMaterial = null;[\s\S]*?_clearSessionStorage\(\)/);
    assert.match(auth, /sessionStorage\.removeItem\('codex_explicit_logout'\)/);
    assert.match(auth, /sessionStorage\.getItem\('codex_explicit_logout'\) === '1'/);
    for (const source of [auth, header]) assert.match(source, /privateAuthGate\?\.block\(\);[\s\S]*?logoutWithCleanup\(\(\) => signOut\(auth\)\)/);
});
