import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root = new URL('../Frontend/public/assets/js/', import.meta.url);
const gateSource = await readFile(new URL('private-auth-gate.js', root), 'utf8');
const main = await readFile(new URL('main-v129.js', root), 'utf8');
const timerSource = (await readFile(new URL('inactivity-timer.js', root), 'utf8')).replace(/^import[^;]+;\r?\n/gm, '')
    .replace(/^export /gm, '').replace("import('./modules/core/security-manager.js')", 'loadSecurity()');
const configSource = (await readFile(new URL('app-env.js', root), 'utf8')).replace(/^export const APP_ENV =.*\r?\n/m, '');
const routes = await import(`data:text/javascript;base64,${Buffer.from(configSource).toString('base64')}`);
function gateFixture(location) {
    const redirects = [], timers = new Map(); let serial = 0;
    const context = vm.createContext({URLSearchParams, Event, window: {location: {...location, replace: target => redirects.push(target)},
        dispatchEvent() {}, addEventListener() {}}, document: {body: {hidden: true, inert: true}, documentElement: {dataset: {}}},
        setTimeout: fn => { timers.set(++serial, fn); return serial; }, clearTimeout: id => timers.delete(id),
        sessionStorage: {getItem: () => null, setItem() {}, removeItem() {}}});
    vm.runInContext(gateSource, context);
    return {gate: context.window.privateAuthGate, redirects, timeout: () => [...timers.values()][0]()};
}
test('recovery error and timeout preserve fixed recovery intent through the actual classic gate', () => {
    for (const reason of ['error','timeout']) {
        const fixture = gateFixture({pathname:'/impostazioni.html',search:'?recovery=complete'});
        fixture.gate.begin('owner');
        if (reason === 'timeout') fixture.timeout(); else fixture.gate.reject(reason);
        assert.equal(fixture.redirects[0], `/login.html?recovery=complete&authCheck=${reason}`);
    }
});
test('classic predicate matches configuration, rejects aliases/duplicates and safely encodes rejection reasons', () => {
    const locations = [
        {pathname:'/impostazioni.html',search:'?recovery=complete&next=https://example.invalid'},
        {pathname:'/login.html',search:'?recovery=complete&verifyEmail=1'},
        {pathname:'/impostazioni.html',search:'?recovery=complete&recovery=complete'},
        {pathname:'/impostazioni.html',search:'?recovery=other'},
        {pathname:'/impostazioni.html',search:'?recovery=%63omplete'},
        {pathname:'/impostazioni.html/',search:'?recovery=complete'},
        {pathname:'/home_page.html',search:'?recovery=complete'},
        {pathname:'/LOGIN.html',search:'?recovery=complete'},
        {pathname:'/impostazioni.html',search:''}
    ];
    const reason = 'error&next=https://example.invalid/#fragment';
    for (const location of locations) {
        const f = gateFixture(location); f.gate.reject(reason);
        const target = new URL(f.redirects[0], 'https://app.invalid');
        assert.equal(target.pathname,'/login.html'); assert.equal(target.searchParams.get('authCheck'),reason);
        assert.equal(target.searchParams.get('recovery'),routes.hasCompleteRecoveryIntent(location)?'complete':null);
        assert.equal(target.searchParams.has('next'),false); assert.equal(target.hash,'');
    }
    const f = gateFixture(locations[0]); f.gate.reject(); assert.equal(f.redirects[0],routes.COMPLETE_RECOVERY_LOGIN_PATH);
});

function timerFixture(location, expired = false) {
    const observers = [], listeners = [], reads = [], touches = [], locks = [];
    const context = vm.createContext({window: {location, addEventListener: (...args) => listeners.push(args)},
        document: {visibilityState:'visible',addEventListener:(...args)=>listeners.push(args),removeEventListener(){}},
        auth: {}, db: {}, doc: (...args) => args,
        onAuthStateChanged: (_auth, fn) => { observers.push(fn); },
        getDoc: async ref => { reads.push(ref); return {exists:()=>true,data:()=>({lock_timeout:3})}; },
        getVaultSessionExpiry: () => expired ? Date.now()-1 : 0, touchVaultSession: value => touches.push(value),
        LOG() {}, console: {error(){}}, setTimeout: () => 1, clearTimeout() {},
        loadSecurity: async () => ({softLock:()=>locks.push('softLock')}),
        hasCompleteRecoveryIntent: routes.hasCompleteRecoveryIntent, isCompleteRecoveryRoute: routes.isCompleteRecoveryRoute});
    location.reload = () => locks.push('reload');
    vm.runInContext(timerSource, context);
    const initialization = main.slice(main.indexOf('let _v7Bootstrapped'), main.indexOf('function getCurrentPage'));
    vm.runInContext(initialization, context);
    return {observers,listeners,reads,touches,locks};
}
test('actual top-level initialization never starts inactivity services for explicit recovery, even while unavailable', async () => {
    assert.equal(routes.COMPLETE_RECOVERY_ENABLED,false);
    for (const pathname of ['/impostazioni.html','/login.html']) {
        const f = timerFixture({pathname,search:'?recovery=complete'});
        for (const observer of f.observers) await observer({uid:'owner'});
        assert.deepEqual([f.observers.length,f.listeners.length,f.reads.length,f.touches.length,f.locks.length],[0,0,0,0,0]);
    }
});
test('ordinary pages still initialize profile timeout, activity and soft-lock behavior', async () => {
    const f = timerFixture({pathname:'/home_page.html',search:''});
    for (const observer of f.observers) await observer({uid:'owner'});
    assert.equal(f.observers.length,1); assert.equal(f.reads.length,1); assert.equal(f.touches.length,1); assert.ok(f.listeners.length>=9);
    const expired = timerFixture({pathname:'/home_page.html',search:''},true);
    for (const observer of expired.observers) await observer({uid:'owner'});
    await new Promise(setImmediate); assert.deepEqual(expired.locks,['softLock','reload']);
});
