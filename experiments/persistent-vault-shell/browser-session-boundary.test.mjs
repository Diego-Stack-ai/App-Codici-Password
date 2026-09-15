import test from 'node:test';
import assert from 'node:assert/strict';
import {bindBrowserSession, clearLegacyUnlock} from './browser-session-boundary.mjs';
import {createProtectedSession} from './protected-session.mjs';
import {createMemoryVault} from './memory-vault.mjs';

test('cutover removes only legacy unlock material without reading or writing stored values', () => {
    const values = new Map(['vault_session_v1', 'codex_vault_session_wrapping_key_v1', 'vault_s_key', 'vault_s_expiry', 'preference', 'codex_explicit_logout'].map(name => [name, 'synthetic']));
    clearLegacyUnlock({removeItem: name => values.delete(name), getItem() { assert.fail('must not recover legacy key'); }, setItem() { assert.fail('must not persist key'); }});
    assert.deepEqual([...values.keys()], ['preference', 'codex_explicit_logout']);
});

test('inaccessible storage aborts cutover rather than silently retaining a recoverable key', () => {
    assert.throws(() => clearLegacyUnlock({removeItem() { throw new Error('storage denied'); }}), /storage denied/);
    clearLegacyUnlock(undefined); // Node emulator has no browser storage.
});

for (const type of ['pagehide', 'freeze', 'pageshow', 'private-auth-blocked']) {
    test(`${type} clears a real memory session and prevents late plaintext from reaching its view`, async () => {
        let release, context;
        const events = new EventTarget();
        const session = createProtectedSession({getUser: () => ({uid: 'synthetic-owner'}), subscribeUser: () => () => {},
            routes: {home: current => { context = current; }},
            createVault: options => createMemoryVault({...options, unlockKey: async () => 'synthetic-key',
                decryptRecord: () => new Promise(resolve => { release = resolve; })})});
        const detach = bindBrowserSession(session, events);
        await session.unlock(); await session.navigate('home');
        const pending = context.read({});
        const denied = assert.rejects(pending, /VAULT_LOCKED|AUTH_CHANGED|VIEW_DISPOSED/);
        const event = new Event(type); if (type === 'pageshow') Object.defineProperty(event, 'persisted', {value: true});
        events.dispatchEvent(event);
        assert.equal(session.check(), false);
        release('synthetic-plaintext'); await denied;
        if (type === 'private-auth-blocked') await assert.rejects(session.unlock(), /SESSION_DISPOSED/);
        detach(); session.dispose();
    });
}

test('ordinary pageshow does not lock and disposal removes event listeners', () => {
    const events = new EventTarget(); let calls = 0;
    const detach = bindBrowserSession({lock() { calls++; }, dispose() { calls++; }}, events);
    events.dispatchEvent(new Event('pageshow')); assert.equal(calls, 0);
    detach(); events.dispatchEvent(new Event('pagehide')); events.dispatchEvent(new Event('private-auth-blocked'));
    assert.equal(calls, 0);
});
