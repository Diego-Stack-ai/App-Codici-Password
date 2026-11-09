import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root = new URL('../Frontend/public/assets/js/', import.meta.url);
const read = async path => (await readFile(new URL(path, root), 'utf8')).replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const navigation = await read('frame-navigation.js'), logout = await read('logout-session.js');
const pause = () => {let resolve;const promise = new Promise(done => {resolve = done;});return {resolve, promise};};
function fixture(framed = true) {
  const document = {}, calls = [], handlers = [], timers = [], storage = new Map();
  const window = {document, location: {origin: 'https://fixture.invalid', replace: target => calls.push(['replace', target])},
    privateAuthGate: {block: () => calls.push(['block'])}, dispatchEvent: event => calls.push([event.type])};
  Object.defineProperty(window.location, 'href', {set: target => calls.push(['assign', target])});
  window.parent = framed ? {location: {origin: window.location.origin}, vaultFrameNavigation: {
    navigateFromChild: (source, doc, target, replace) => {calls.push(['frame', target, replace, doc === document]);return true;},
    revokeFromChild: () => calls.push(['revoke']),
    beginLogoutFromChild: () => {calls.push(['begin']);return 'synthetic-token';},
    finishLogoutFromChild: (_source, _doc, token) => calls.push(['finish', token])
  }} : window;
  const context = vm.createContext({window, document, Event, Promise,
    setTimeout: (fn, delay) => {timers.push({fn, delay});return timers.length;}, clearTimeout() {},
    sessionStorage: {setItem: (key, value) => storage.set(key, value)}, clearVaultSession: () => calls.push(['clear'])});
  vm.runInContext(navigation, context);
  const logoutWithCleanup = vm.runInContext(`(() => {${logout};return logoutWithCleanup;})()`, context);
  return {window, context, document, calls, handlers, timers, storage, logoutWithCleanup};
}
for (const target of ['/login.html', '/login.html?authCheck=timeout', '/login.html?authCheck=error',
  '/login.html?verifyEmail=1', '/login.html?recovery=complete&verifyEmail=1', '/login.html?recovery=complete',
  '/imposta_nuova_password.html?policyUpdate=1', '/imposta_nuova_password.html',
  '/login.html?reauth=security-settings', '/login.html?reauth=sessions-revoked', '/privacy.html', '/termini.html',
  'https://appcodici-password.web.app/profilo_privato.html?profileTab=documents#section-email'])
  for (const framed of [false, true]) test(`${framed ? 'framed' : 'standalone'} navigation preserves ${target}`, () => {
    const f = fixture(framed); f.context.target = target;
    vm.runInContext('navigateDocument(target, true)', f.context);
    assert.deepEqual(f.calls, framed ? [['frame', target, true, true]] : [['replace', target]]);
  });
test('old helper cannot navigate a successor through the stable WindowProxy', () => {
  const f = fixture(); f.window.document = {};
  vm.runInContext("navigateDocument('/login.html', true)", f.context); assert.deepEqual(f.calls, []);
});
for (const sdkFailure of [false, true]) test(`real logout preserves the child until durable fence and SDK settle (${sdkFailure})`, async () => {
  const f = fixture(), fence = pause(), sdk = pause();
  f.window.authSessionFence = {deny: () => {f.calls.push(['deny']);return fence.promise;}};
  const completion = f.logoutWithCleanup(async () => {f.calls.push(['sdk']);await sdk.promise;if (sdkFailure) throw Error('fixture');}, null);
  assert.equal(f.calls[0][0], 'begin'); assert.ok(f.calls.some(call => call[0] === 'clear'));
  assert.ok(!f.calls.some(call => ['frame','finish','sdk'].includes(call[0])));
  fence.resolve(); await new Promise(resolve => setImmediate(resolve));
  assert.ok(f.calls.some(call => call[0] === 'sdk')); assert.ok(!f.calls.some(call => call[0] === 'finish'));
  sdk.resolve(); await completion;
  assert.deepEqual(f.calls.at(-1), ['finish', 'synthetic-token']);
  assert.ok(!f.calls.some(call => call[0] === 'frame'));
  vm.runInContext("navigateDocument('/login.html?reauth=security-settings', true)", f.context);
  assert.deepEqual(f.calls.at(-1), ['frame', '/login.html?reauth=security-settings', true, true]);
});
test('real logout SDK timeout completes coordination and redirects exactly once', async () => {
  const f = fixture(); f.window.authSessionFence = {deny: async () => {}};
  const completion = f.logoutWithCleanup(() => new Promise(() => {}));
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(f.timers[0].delay, 10000); f.timers[0].fn(); await completion;
  assert.deepEqual(f.calls.at(-2), ['finish', 'synthetic-token']);
  assert.deepEqual(f.calls.at(-1), ['frame', '/login.html', true, true]);
});
