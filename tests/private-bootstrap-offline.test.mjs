import {withStandaloneFrame} from './lib/standalone-frame-context.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

// Execute the real private-page gate, before Firestore/Vault/page initialization.
const source = await readFile(new URL('../Frontend/public/assets/js/main-v129.js', import.meta.url), 'utf8');
const configSource = (await readFile(new URL('../Frontend/public/assets/js/app-env.js', import.meta.url), 'utf8'))
    .replace(/^export const APP_ENV =.*\r?\n/m, '');
const recoveryRoutes = await import(`data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`);
const start = source.indexOf('const publicPages =');
const end = source.indexOf('if (isPrivatePage && navigator.onLine) firebaseRuntime.enableAppCheck', start);
assert.ok(start >= 0 && end > start);
function fixture({online = false, verified = true, tokenVerified = true, refresh, fenceCurrent = true, page = 'account_privati'} = {}) {
    const redirects = [];
    const state = {reloads: 0, initialized: 0};
    const user = {uid: 'fixture', emailVerified: verified, async getIdTokenResult() {
        return {claims: {email_verified: tokenVerified}};
    }, async getIdToken(force) {
        if (force) state.tokenRefreshes = (state.tokenRefreshes || 0) + 1;
        tokenVerified = true;
        return 'synthetic-token';
    }, async reload() {
        state.reloads++;
        if (refresh) return refresh(auth, user);
        if (!online) throw new Error('auth/network-request-failed');
    }};
    const auth = {currentUser: user};
    const context = vm.createContext(withStandaloneFrame({navigateDocument: target => redirects.push(target), ...recoveryRoutes, gate: {block() {}, reject:()=>redirects.push('/login.html'), acceptIdentity: () => true},
        authSessionFence: {isCurrent:async()=>fenceCurrent}, fenceTicket: {}, authAttempt: 1, user, auth, navigator: {onLine: online}, currentPage: page, state,
        window: {location: {pathname: `/${page}.html`, search: '', replace: url => redirects.push(url)}}}));
    const run = vm.runInContext(`(async () => { ${source.slice(start, end)} state.initialized++; })`, context);
    return {run, state, redirects, auth};
}
test('Home to private list offline uses the already verified Firebase identity without a network refresh', async () => {
    const f = fixture(); await f.run();
    assert.equal(f.state.reloads, 0); assert.equal(f.state.initialized, 1); assert.deepEqual(f.redirects, []);
});
test('offline does not accept an unverified identity', async () => {
    const f = fixture({verified: false}); await f.run();
    assert.equal(f.state.reloads, 0); assert.equal(f.state.initialized, 0);
    assert.deepEqual(f.redirects, ['/login.html?verifyEmail=1']);
});
test('online still refreshes verification before opening a private page', async () => {
    const f = fixture({online: true, refresh: async (_auth, user) => { user.emailVerified = false; }}); await f.run();
    assert.equal(f.state.reloads, 1); assert.equal(f.state.initialized, 0);
    assert.deepEqual(f.redirects, ['/login.html?verifyEmail=1']);
});
test('online refresh errors never fall back to cached verification', async () => {
    const f = fixture({online: true, refresh: async () => { throw new Error('auth/network-request-failed'); }});
    await assert.rejects(f.run(), /network-request-failed/); assert.equal(f.state.initialized, 0);
});
for (const current of [null, {uid: 'other', emailVerified: true}]) test(`identity ${current ? 'change' : 'logout'} during refresh stops stale initialization`, async () => {
    const f = fixture({online: true, refresh: async auth => { auth.currentUser = current; }}); await f.run();
    assert.equal(f.state.initialized, 0); assert.deepEqual(f.redirects, []);
});
test('verified online identity can initialize the private page', async () => {
    const f = fixture({online: true}); await f.run(); assert.equal(f.state.reloads, 1); assert.equal(f.state.initialized, 1);
});
test('verified profile with stale ID token refreshes the claim before private initialization', async () => {
    const f = fixture({online: true, tokenVerified: false}); await f.run();
    assert.equal(f.state.tokenRefreshes, 1); assert.equal(f.state.initialized, 1);
});

test('a newer cross-tab logout refuses private admission after identity refresh', async () => {
    const f = fixture({online:true, fenceCurrent:false}); await f.run();
    assert.equal(f.state.initialized,0);
    assert.deepEqual(f.redirects,['/login.html']);
});
