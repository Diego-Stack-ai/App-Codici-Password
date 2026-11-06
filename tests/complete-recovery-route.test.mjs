import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root = new URL('../Frontend/public/assets/js/', import.meta.url);
const configSource = (await readFile(new URL('app-env.js', root), 'utf8')).replace(/^export const APP_ENV =.*\r?\n/m, '');
const routes = await import(`data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`);
const main = await readFile(new URL('main-v129.js', root), 'utf8');
const authSource = (await readFile(new URL('auth.js', root), 'utf8')).replace(/^import[\s\S]*?;\r?\n/gm, '')
    .replace(/^export\s*\{[^}]*\};?/gm, '').replace(/^export /gm, '');

test('explicit intent selects only a safe recovery screen while action availability remains code-disabled', () => {
    assert.equal(routes.COMPLETE_RECOVERY_ENABLED, false);
    const location = {pathname: '/impostazioni.html', search: '?recovery=complete&enabled=true&next=https://example.invalid'};
    assert.equal(routes.isCompleteRecoveryRoute(location), true);
    assert.equal(routes.isCompleteRecoveryRoute(location, true), true);
    assert.equal(routes.COMPLETE_RECOVERY_PATH, '/impostazioni.html?recovery=complete');
    for (const candidate of [{pathname: '/home_page.html', search: '?recovery=complete'},
        {pathname: '/impostazioni.html', search: '?recovery=complete&recovery=other'},
        {pathname: '/impostazioni.html', search: '?recovery=other'}, {pathname: '/impostazioni.html', search: ''}]) {
        assert.equal(routes.isCompleteRecoveryRoute(candidate, true), false);
    }
    assert.doesNotMatch(configSource, /localStorage|sessionStorage|process\.env|\.hostname/);
});

test('actual early bootstrap branch terminates before profile, onboarding, Vault and sharing provisioning', async () => {
    const start = main.indexOf('if (isPrivatePage && isCompleteRecoveryRoute(window.location))');
    const end = main.indexOf('const securityModulesPromise', start);
    assert.ok(start > main.indexOf('firebaseRuntime.enableAppCheck?.()'));
    assert.ok(end < main.indexOf('const userDoc = await getDoc'));
    const branch = main.slice(start, end).replace("import('./modules/settings/complete-recovery-entry.js')", 'loadRecovery()');
    for (const enabled of [false, true]) {
        const calls = [], container = {replaceChildren: () => calls.push('placeholder')};
        const context = vm.createContext({isPrivatePage: true, user: {uid: 'owner'}, authAttempt: 1, completeRecoveryMount: null,
            auth: {currentUser: {uid: 'owner'}}, gate: {active: () => true},
            window: {location: {pathname: '/impostazioni.html', search: '?recovery=complete'}},
            isCompleteRecoveryRoute: location => routes.isCompleteRecoveryRoute(location, enabled),
            document: {querySelector: () => container, body: {classList: {add: () => calls.push('ready')}}},
            createElement: () => ({}), t: key => key, endMetric: () => {},
            loadRecovery: async () => ({startCompleteRecoveryPage: () => { calls.push(enabled ? 'recovery' : 'unavailable'); return {dispose() {}}; }}),
            ordinary: () => calls.push('onboarding', 'ensureVaultKeyMaterial', 'ensureSharingIdentity', 'offline', 'push', 'assistant')});
        await vm.runInContext(`(async()=>{${branch}\nordinary();})()`, context);
        assert.equal(calls.includes(enabled ? 'recovery' : 'unavailable'), true);
        assert.equal(calls.includes('ensureVaultKeyMaterial'), false);
    }
    assert.match(main, /if \(!isCompleteRecoveryRoute\(window\.location\)\) initComponents\(\)/);
    assert.match(main, /if \(!isCompleteRecoveryRoute\(window\.location\)\) initOfflineStatus\(\)/);
});

test('disabled explicit recovery renders only a localized unavailable view with no controls or transport', async () => {
    const source = await readFile(new URL('modules/settings/complete-recovery-entry.js', root), 'utf8');
    const begin = source.indexOf('export function startCompleteRecoveryPage');
    const end = source.indexOf('export function createCompleteRecoveryExportOptions', begin);
    let nodes;
    const context = vm.createContext({COMPLETE_RECOVERY_ENABLED: false, document: {querySelector: () => ({})},
        createElement: (tag, props) => ({tag, ...props}), setChildren: (_root, value) => { nodes = value; }, t: key => key});
    vm.runInContext(source.slice(begin, end).replace('export ', ''), context);
    context.startCompleteRecoveryPage({user: {uid: 'owner'}, isActive: () => true});
    assert.deepEqual(Array.from(nodes, node => node.tag), ['h1', 'p']);
    assert.equal(nodes[1].textContent, 'recovery_unavailable');
});

function authFixture({verified = true, enabled = false} = {}) {
    const calls = [], uid = 'owner'; let observer, mfa = false;
    const user = {uid, email: 'synthetic@example.invalid', emailVerified: verified, reload: async () => calls.push('reload'),
        getIdToken: async () => { calls.push('token'); }, getIdTokenResult: async () => ({claims: {email_verified: true}})};
    const location = {pathname: '/login.html', search: '?recovery=complete', replace: value => calls.push(['redirect', value])};
    const context = vm.createContext({URLSearchParams, auth: {currentUser: user}, LOG() {}, showToast() {}, logError() {}, db: {}, doc: () => ({}),
        getDoc: async () => { calls.push('getProfile'); return {exists: () => false}; }, setDoc: async () => calls.push('setProfile'),
        localStorage: {getItem: () => { calls.push('resetMarker'); return null; }, removeItem() {}},
        sessionStorage: {getItem: () => null, removeItem: () => calls.push('clearLogout')},
        authSessionFence: {beginExplicitLogin: async () => 'permit', completeExplicitLogin: async permit => { assert.equal(permit, 'permit'); calls.push('completeLogin'); }, readPermit: async () => 'permit', isCurrent: async () => true},
        setPersistence: async () => {}, browserLocalPersistence: {}, browserSessionPersistence: {},
        signInWithEmailAndPassword: async () => { calls.push('passwordLogin'); if (mfa) throw {code: 'auth/multi-factor-auth-required'}; return {user}; },
        getMultiFactorResolver: () => ({hints: [{factorId: 'totp', uid: 'factor'}], resolveSignIn: async () => { calls.push('mfa'); return {user}; }}),
        TotpMultiFactorGenerator: {FACTOR_ID: 'totp', assertionForSignIn: () => ({})},
        hasCompleteRecoveryIntent: location => routes.hasCompleteRecoveryIntent(location, true),
        COMPLETE_RECOVERY_PATH: routes.COMPLETE_RECOVERY_PATH, COMPLETE_RECOVERY_LOGIN_PATH: routes.COMPLETE_RECOVERY_LOGIN_PATH,
        COMPLETE_RECOVERY_ENABLED: enabled,
        onAuthStateChanged: (_auth, callback) => { observer = callback; }, navigator: {onLine: true},
        window: {location, dispatchEvent: () => {}}, CustomEvent: class CustomEvent {}});
    vm.runInContext(authSource, context);
    return {context, calls, location, user, requireMfa: () => { mfa = true; }, run: value => vm.runInContext(value, context), observe: () => observer(user)};
}

test('recovery login and real TOTP finalizer skip both reset-marker and profile writes', async () => {
    for (const mfa of [false, true]) {
        const f = authFixture(); if (mfa) f.requireMfa();
        const first = await f.run("login('synthetic@example.invalid', 'synthetic-password')");
        const result = mfa ? await f.run("completeTotpLogin('000000')") : first;
        assert.equal(result.user.uid, 'owner'); assert.equal(result.profileData, null);
        assert.ok(f.calls.includes('passwordLogin')); assert.equal(f.calls.includes('mfa'), mfa);
        assert.ok(f.calls.includes('completeLogin'));
        assert.equal(f.calls.some(call => ['resetMarker', 'getProfile', 'setProfile'].includes(call)), false);
    }
});

test('classic-gate error and timeout return through actual login without profile or key provisioning', async () => {
    const gateSource = await readFile(new URL('private-auth-gate.js',root),'utf8');
    const loginSource = await readFile(new URL('modules/auth/login.js',root),'utf8');
    const begin = loginSource.indexOf("const reauthFlow = new URLSearchParams(window.location.search).get('reauth');");
    const end = loginSource.indexOf('\n\n        } catch (err)',begin);
    const redirect = loginSource.slice(begin,end);
    for (const reason of ['error','timeout']) {
        let timer, target;
        const context = vm.createContext({URLSearchParams,Event,window:{location:{pathname:'/impostazioni.html',search:'?recovery=complete',replace:value=>{target=value;}},addEventListener(){},dispatchEvent(){}},
            document:{documentElement:{dataset:{}},body:{}},sessionStorage:{getItem:()=>null,setItem(){},removeItem(){}},setTimeout:fn=>{timer=fn;return 1;},clearTimeout(){}});
        vm.runInContext(gateSource,context);
        if(reason==='timeout')timer();else context.window.privateAuthGate.reject('error');
        const location = new URL(target,'https://app.invalid');
        const f=authFixture();f.location.pathname=location.pathname;f.location.search=location.search;
        const result=await f.run("login('synthetic@example.invalid','synthetic-password')");
        assert.equal(result.profileData,null);vm.runInContext(redirect,f.context);
        assert.deepEqual(f.calls.filter(call=>Array.isArray(call)&&call[0]==='redirect').at(-1),['redirect',routes.COMPLETE_RECOVERY_PATH]);
        assert.equal(f.calls.some(call=>['resetMarker','getProfile','setProfile'].includes(call)),false);
    }
});

test('complete export security-settings reauthentication waits for fresh login only while enabled', async () => {
    for (const enabled of [false,true]) {
        const f=authFixture({enabled});f.location.search='?reauth=security-settings';f.run('checkAuthState()');await f.observe();
        const redirects=f.calls.filter(call=>Array.isArray(call)&&call[0]==='redirect');
        assert.equal(redirects.length,enabled?0:1);
        if(!enabled)assert.equal(redirects[0][1],'impostazioni.html');
    }
});

test('verification refresh retains recovery intent and fixed reauthentication waits for a fresh login', async () => {
    const f = authFixture({verified: false});
    assert.equal((await f.run("login('synthetic@example.invalid','synthetic-password')")).emailVerificationRequired, true);
    f.user.emailVerified = true; assert.equal(await f.run('refreshEmailVerification()'), true);
    assert.equal(f.calls.includes('setProfile'), false);
    f.location.search = '?recovery=complete&reauth=complete-recovery&next=https://example.invalid';
    f.run('checkAuthState()'); await f.observe();
    assert.equal(f.calls.some(call => Array.isArray(call) && call[0] === 'redirect'), false);
    f.location.search = '?recovery=complete&next=https://example.invalid'; f.run('checkAuthState()'); await f.observe();
    assert.deepEqual(f.calls.filter(call => Array.isArray(call) && call[0] === 'redirect').at(-1), ['redirect', routes.COMPLETE_RECOVERY_PATH]);
});

test('server-confirmed discovery validates ownership and binding without provisioning', async () => {
    const entry = await readFile(new URL('modules/settings/complete-recovery-entry.js', root), 'utf8');
    const begin = entry.indexOf('export async function discoverCompleteRecoveryOperation');
    const end = entry.indexOf('export function startCompleteRecoveryPage', begin);
    const {createHash, webcrypto} = await import('node:crypto');
    const value = {schemaVersion: 1, ownerUid: 'owner', operationId: 'operation', planDigest: 'a'.repeat(64), status: 'active'};
    value.digest = createHash('sha256').update(JSON.stringify([1, value.ownerUid, value.operationId, value.planDigest])).digest('hex');
    const context = vm.createContext({crypto: webcrypto, TextEncoder, Uint8Array});
    vm.runInContext(entry.slice(begin, end).replace('export ', ''), context);
    const args = {uid: 'owner', isActive: () => true, readFence: async () => value};
    const result = await context.discoverCompleteRecoveryOperation(args); assert.equal(result.operationId, 'operation');
    await assert.rejects(context.discoverCompleteRecoveryOperation({...args, readFence: async () => ({...value, ownerUid: 'other'})}), /LOOKUP_FAILED/);
    await assert.rejects(context.discoverCompleteRecoveryOperation({...args, readFence: async () => ({...value, digest: '0'.repeat(64)})}), /LOOKUP_FAILED/);
    assert.equal(await context.discoverCompleteRecoveryOperation({...args, readFence: async () => null}), null);
    assert.doesNotMatch(entry.slice(begin, end), /setDoc|ensureVault|ensureSharing|MasterPassword/);
});
