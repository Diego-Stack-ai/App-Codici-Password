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

function fixture() {
    const redirects = [], events = [], timers = new Map(), handlers = new Map(), storage = new Map();
    let serial = 0;
    const body = {hidden: true, inert: true};
    const window = {location: {replace: url => redirects.push(url), reload: () => redirects.push('reload')},
        dispatchEvent: event => events.push(event.type), addEventListener: (name, fn) => handlers.set(name, fn)};
    const context = vm.createContext({window, document: {body}, Event, Promise,
        setTimeout: (fn, ms) => { timers.set(++serial, {fn, ms}); return serial; },
        clearTimeout: id => timers.delete(id),
        sessionStorage: {getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key)}});
    vm.runInContext(gateSource, context);
    return {context, gate: window.privateAuthGate, body, redirects, events, storage, timers, handlers};
}

test('all 22 private HTML entries are hidden and inert before JavaScript; public exceptions stay public', async () => {
    const publicPages = new Set(['index.html','login-v115.html','registrati.html','reset_password.html','imposta_nuova_password.html','privacy.html','termini.html','contatto_condiviso.html','prova.html']);
    let count = 0;
    for (const name of (await readdir(root)).filter(name => name.endsWith('.html'))) {
        const html = await readFile(new URL(name, root), 'utf8');
        if (publicPages.has(name)) { assert.doesNotMatch(html, /data-private-auth/, name); continue; }
        count++;
        assert.match(html, /<body\b[^>]*data-private-auth[^>]*\bhidden\b[^>]*\binert\b/, name);
        assert.ok(html.indexOf('private-auth-gate.js') < html.indexOf('<body'), name);
        assert.match(html, /main-v129\.js/, name);
    }
    assert.equal(count, 22);
    const css = await readFile(new URL('assets/css/core.css', root), 'utf8');
    assert.match(css, /body\[data-private-auth\]\[hidden\]\s*\{\s*display: none !important;/);
});

test('direct unauthenticated access stays hidden and redirects to absolute login', () => {
    const f = fixture();
    assert.equal(f.body.hidden, true);
    f.gate.begin(null); f.gate.reject();
    assert.equal(f.body.hidden, true); assert.equal(f.body.inert, true);
    assert.deepEqual(f.redirects, ['/login-v115.html']);
});

test('verified Firebase identity reveals the page only after the pending check', () => {
    const f = fixture(); const ticket = f.gate.begin(verifiedUser.uid);
    assert.equal(f.body.hidden, true);
    assert.equal(f.gate.acceptIdentity(ticket, verifiedUser), true);
    assert.equal(f.body.hidden, false); assert.equal(f.body.inert, false); assert.equal(f.timers.size, 0);
});

test('unverified identity cannot reveal private HTML', () => {
    const f = fixture(); const ticket = f.gate.begin('synthetic');
    assert.equal(f.gate.acceptIdentity(ticket, {...verifiedUser, emailVerified: false}), false);
    assert.equal(f.body.hidden, true);
});

for (const kind of ['error', 'timeout']) test(kind + ' keeps the page hidden and rejects a late Auth success', () => {
    const f = fixture(); const ticket = f.gate.begin(verifiedUser.uid);
    if (kind === 'error') f.gate.reject('error');
    else [...f.timers.values()][0].fn();
    assert.equal(f.gate.acceptIdentity(ticket, verifiedUser), false);
    assert.equal(f.body.hidden, true);
    assert.deepEqual(f.redirects, ['/login-v115.html?authCheck=' + kind]);
});

test('missing bootstrap also times out closed', () => {
    const f = fixture(); [...f.timers.values()][0].fn();
    assert.equal(f.body.hidden, true); assert.equal(f.redirects.length, 1);
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
    assert.deepEqual(f.redirects, ['/login-v115.html']);
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
    assert.match(security, /export function clearSession\(\) \{\s*_vaultKeyMaterial = null;[\s\S]*?_clearSessionStorage\(\)/);
    assert.match(auth, /sessionStorage\.removeItem\('codex_explicit_logout'\)/);
    assert.match(auth, /sessionStorage\.getItem\('codex_explicit_logout'\) === '1'/);
    for (const source of [auth, header]) assert.match(source, /privateAuthGate\?\.block\(\);[\s\S]*?logoutWithCleanup\(\(\) => signOut\(auth\)\)/);
});
