import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import * as policy from '../Frontend/public/assets/js/modules/core/vault-frame-policy.mjs';
import {createFrameSession} from '../Frontend/public/assets/js/modules/core/vault-frame-session.mjs';
import {frameLockCode} from '../Frontend/public/assets/js/modules/core/vault-frame-diagnostics.mjs';

const source = await readFile(new URL('../Frontend/public/assets/js/modules/core/vault-frame-owner.mjs', import.meta.url), 'utf8');
const createVaultFrameOwner = vm.runInNewContext(source.replace(/^import .*;\r?\n/gm, '').replace('export function ', 'function ') + '\ncreateVaultFrameOwner;',
  {...policy, createFrameSession, frameLockCode, Date, URL, beginFrameModalFocus() {throw Error('UNEXPECTED_MODAL');}});

// Lifecycle stress, not a reproduction of an iOS engine: removing the caller
// during synchronous delegation aborts its stack. The real owner must take over.
function fixture() {
  const calls = [], timers = new Map(); let serial = 0, delegating = false, rejectNavigation = false;
  const origin = 'https://fixture.invalid';
  const document = Object.assign(new EventTarget(), {hidden: false, querySelector: () => null});
  const childDocument = {};
  const child = Object.assign(new EventTarget(), {location: {href: origin + '/home_page.html'}, postMessage() {}});
  const iframe = Object.assign(new EventTarget(), {contentWindow: child, contentDocument: childDocument, style: {},
    remove() {calls.push('remove'); if (delegating) throw new Error('SYNTHETIC_CALLER_DETACHED');}});
  const navigate = (method, href) => {
    calls.push([method, href]);
    if (rejectNavigation) throw new Error('SYNTHETIC_NAVIGATION_REJECTED');
  };
  const window = Object.assign(new EventTarget(), {document, crypto: webcrypto, Event,
    location: {origin, replace: href => navigate('replace', href), assign: href => navigate('assign', href)},
    history: {replaceState() {}, pushState() {}},
    setTimeout: (fn, ms) => {timers.set(++serial, {fn, ms}); return serial;},
    clearTimeout: id => timers.delete(id), setInterval: () => 0, clearInterval() {}});
  const owner = createVaultFrameOwner({window, iframe, release: 'fixture', getIdentity: () => ({uid: 'synthetic', epoch: 'fixture'}),
    clearMaterial: () => calls.push('clear'), onState: state => calls.push(state.locked ? 'locked' : 'visible')});
  const nav = window.vaultFrameNavigation;
  return {calls, timers, window, iframe, owner, nav, child, childDocument,
    failNavigation(value) {rejectNavigation = value;},
    delegate(target, replace = true) {
      delegating = true;
      try {return nav.navigateFromChild(child, childDocument, target, replace);}
      finally {delegating = false;}
    },
    run(ms) {
      const entry = [...timers].find(([, value]) => value.ms === ms);
      assert.ok(entry, `missing parent task ${ms}`); timers.delete(entry[0]); entry[1].fn();
    }};
}

for (const held of [false, true]) test(`parent owns exit before caller teardown (logout hold ${held})`, () => {
  const f = fixture();
  if (held) {
    const token = f.nav.beginLogoutFromChild(f.child, f.childDocument);
    f.nav.revokeFromChild(f.child, f.childDocument);
    f.nav.finishLogoutFromChild(f.child, f.childDocument, token);
  }
  const target = held ? '/login.html?reauth=sessions-revoked' : '/privacy.html';
  assert.doesNotThrow(() => assert.equal(f.delegate(target), true));
  assert.ok(f.calls.includes('clear'), 'RAM cleanup is synchronous');
  assert.equal(f.iframe.style.visibility, 'hidden'); assert.equal(f.iframe.inert, true);
  assert.ok(!f.calls.some(value => value === 'remove' || Array.isArray(value)), 'no caller teardown or navigation on its stack');
  f.run(0);
  assert.deepEqual(f.calls.find(Array.isArray), ['replace', 'https://fixture.invalid' + target]);
});

test('failed parent navigation stays protected and the watchdog can retry', () => {
  const f = fixture();
  const token = f.nav.beginLogoutFromChild(f.child, f.childDocument);
  f.nav.revokeFromChild(f.child, f.childDocument);
  f.nav.finishLogoutFromChild(f.child, f.childDocument, token);
  f.delegate('/login.html'); f.failNavigation(true);
  assert.doesNotThrow(() => f.run(0));
  assert.equal(f.iframe.inert, true); assert.ok(f.timers.size > 0);
  f.failNavigation(false); f.run(20000);
  assert.equal(f.calls.filter(Array.isArray).length, 2);
});

test('incomplete cleanup watchdog hands off to a parent exit with its own retry', () => {
  const f = fixture();
  f.nav.beginLogoutFromChild(f.child, f.childDocument);
  f.nav.revokeFromChild(f.child, f.childDocument);
  f.run(20000); // Neither cleanup nor SDK completion arrived.
  f.failNavigation(true); f.run(0);
  f.failNavigation(false); f.run(20000);
  assert.equal(f.calls.filter(Array.isArray).length, 2);
  assert.equal(f.iframe.inert, true);
});

test('queued exit preserves assign and cannot navigate a successor document', () => {
  const f = fixture(); f.delegate('/termini.html', false);
  f.window.document = {};
  f.run(0);
  assert.ok(!f.calls.some(Array.isArray));
  const next = fixture(); next.delegate('/termini.html', false); next.run(0);
  assert.deepEqual(next.calls.find(Array.isArray), ['assign', 'https://fixture.invalid/termini.html']);
});

test('dispose cancels pending exit tasks', () => {
  const f = fixture(); f.delegate('/privacy.html'); f.owner.dispose();
  for (const {fn} of f.timers.values()) fn();
  assert.ok(!f.calls.some(Array.isArray));
});
