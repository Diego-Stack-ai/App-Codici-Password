import test from 'node:test';
import assert from 'node:assert/strict';
import {createFrameSession} from './frame-session.mjs';
import {FRAME_PROTOCOL, PRIVATE_FRAME_PATHS, SENSITIVE_ACTIONS, privateFrameUrl} from './frame-policy.mjs';

const origin = 'https://frame.example';
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => {resolve = yes; reject = no;}); return {promise, resolve, reject}; };
function fixture(options = {}) {
  const state = {now: 1000, uid: 'fixture-owner', epoch: 0, enabled: true, confirm: true,
    url: origin + PRIVATE_FRAME_PATHS[0], document: {}, unlocks: 0, confirms: 0, locks: [], posted: []};
  const frame = {postMessage: (value, targetOrigin) => state.posted.push({value, targetOrigin})};
  let sequence = 0;
  const session = createFrameSession({origin, getFrameWindow: () => frame, getFrameUrl: () => state.url,
    getFrameDocument: () => state.document,
    getIdentity: () => ({uid: state.uid, epoch: state.epoch}),
    readPermit: async () => ({version: 1, enabled: state.enabled, uid: state.uid, expiresAt: state.now + 100_000}),
    unlock: async uid => {state.unlocks++; return `synthetic-material-${uid}`;},
    confirmSensitive: async () => {state.confirms++; return state.confirm;},
    now: () => state.now, nonce: () => `nonce-${String(++sequence).padStart(16, '0')}`,
    idleMs: 1000, backgroundMs: 300, grantMs: 100, onLock: reason => state.locks.push(reason), ...options});
  let documentNonce = session.beginDocument();
  const event = (command, data = {}) => ({source: frame, origin, data: {
    protocol: FRAME_PROTOCOL, documentNonce, requestId: crypto.randomUUID(), command, ...data}});
  return {session, state, frame, event,
    send: (command, data) => session.handle(event(command, data)),
    navigate(path) {session.retireDocument(); state.document = {}; state.url = origin + path; documentNonce = session.beginDocument();},
  };
}

test('no permit provider means DENY before any unlock; permit is bound to the current UID', async () => {
  let unlocked = 0;
  for (const readPermit of [undefined, async () => null, async () => ({enabled: true, uid: 'other', version: 1, expiresAt: 99999})]) {
    const f = fixture({readPermit, unlock: async () => {unlocked++; return 'synthetic';}});
    assert.equal(await f.send('key'), null);
    assert.equal(f.session.state().unlocked, false);
  }
  assert.equal(unlocked, 0);
});

test('ten private documents keep the parent session and require one unlock', async () => {
  const f = fixture();
  for (const path of PRIVATE_FRAME_PATHS) {
    f.navigate(path);
    const reply = await f.send('key');
    assert.equal(reply.material, 'synthetic-material-fixture-owner');
    assert.equal(f.session.deliver(reply), true);
    assert.equal(f.session.deliver(reply), false);
  }
  assert.equal(f.state.unlocks, 1);
  assert.equal(f.state.posted.length, 10);
  assert.ok(f.state.posted.every(item => item.targetOrigin === origin));
  assert.equal(Object.hasOwn(f.session.state(), 'material'), false);
});

test('untrusted origins, sources and payload paths never obtain a key', async () => {
  const f = fixture();
  const valid = f.event('key');
  for (const event of [{...valid, origin: 'https://other.example'}, {...valid, source: {}},
    {...valid, data: {...valid.data, path: '/home_page.html'}}, {...valid, origin: 'null'}]) {
    assert.equal(await f.session.handle(event), null);
  }
  assert.equal(f.state.unlocks, 0);
});

test('actual frame URL allowlist rejects documents, schemes and ambiguous paths', () => {
  for (const value of ['blob:https://frame.example/id', 'about:blank', 'data:text/html,hello',
    'https://other.example/home_page.html', '/privacy.html', '/app.html', '/ui-preview/ui-prove/profilo.html',
    '/../home_page.html', '/x/../home_page.html', '/%2e%2e/home_page.html', '/%2568ome_page.html',
    '//other.example/home_page.html', '/home_page.html#fragment', '/home_page.html?password=x',
    '/home_page.html?id=a&id=b', '/home_page.html?id=%3Cscript%3E']) {
    assert.equal(privateFrameUrl(value, origin), null, value);
  }
  assert.equal(privateFrameUrl('/dettaglio_account_privato.html?id=fixture-1', origin)?.origin, origin);
});

test('same WindowProxy does not authorize the previous document nonce', async () => {
  const f = fixture(), previous = f.event('key');
  f.navigate(PRIVATE_FRAME_PATHS[1]);
  assert.equal(await f.session.handle(previous), null);
  assert.equal(f.state.unlocks, 0);
  assert.equal((await f.send('key')).kind, 'key');
});

test('delivery checks the actual URL again, including navigation before load', async () => {
  const f = fixture();
  const reply = await f.send('key');
  f.state.url = origin + PRIVATE_FRAME_PATHS[1];
  assert.equal(f.session.deliver(reply), false);
  assert.deepEqual(f.state.posted, []);
});

test('a same-route reload replaces the Document before load and rejects old messages and replies', async () => {
  const f = fixture(), request = f.event('key');
  const reply = await f.session.handle(request);
  f.state.document = {};
  assert.equal(f.session.deliver(reply), false);
  assert.equal(await f.session.handle({...request, data: {...request.data, requestId: crypto.randomUUID()}}), null);
  assert.deepEqual(f.state.posted, []);
});

test('lock cancels a pending unlock and rejects its late material', async () => {
  const wait = deferred();
  const f = fixture({unlock: () => wait.promise});
  const result = f.send('key');
  await new Promise(resolve => setImmediate(resolve));
  f.session.lock('manual'); wait.resolve('late-synthetic');
  assert.equal(await result, null);
  assert.equal(f.session.state().unlocked, false);
});

test('child lock is synchronous and never depends on a permit request', async () => {
  let broken = false;
  const f = fixture({readPermit: async () => {if (broken) return new Promise(() => {}); return {uid: 'fixture-owner', enabled: true, version: 1, expiresAt: 99999};}});
  await f.send('key'); broken = true;
  const result = f.send('lock');
  assert.equal(f.session.state().unlocked, false);
  assert.equal(await result, null);
});

test('identity change during permission loading rejects the previous identity', async () => {
  const wait = deferred();
  const f = fixture({readPermit: () => wait.promise});
  const result = f.send('key');
  f.state.uid = 'other-owner'; f.state.epoch++;
  wait.resolve({uid: 'fixture-owner', enabled: true, version: 1, expiresAt: 99999});
  assert.equal(await result, null);
  assert.equal(f.state.unlocks, 0);
});

test('concurrent identities cannot share an unlock Promise or adopt its result', async () => {
  const wait = deferred();
  const f = fixture({unlock: () => wait.promise});
  const first = f.send('key'); await new Promise(resolve => setImmediate(resolve));
  f.state.uid = 'other-owner'; f.state.epoch++;
  const second = f.send('key'); wait.resolve('first-owner-material');
  assert.equal(await first, null); assert.equal(await second, null);
  assert.equal(f.session.state().unlocked, false);
});

test('identity epoch detects logout and re-login of the same UID during unlock', async () => {
  const wait = deferred();
  const f = fixture({unlock: () => wait.promise});
  const result = f.send('key'); await new Promise(resolve => setImmediate(resolve));
  f.state.epoch++; wait.resolve('old-session-material');
  assert.equal(await result, null);
  assert.equal(f.session.state().unlocked, false);
});

test('long background expires a pending unlock even if visibility resumes first', async () => {
  const wait = deferred();
  const f = fixture({unlock: () => wait.promise});
  const result = f.send('key'); await new Promise(resolve => setImmediate(resolve));
  f.session.setVisibility(false); f.state.now += 301; f.session.setVisibility(true);
  wait.resolve('late-background-material');
  assert.equal(await result, null);
  assert.equal(f.session.state().unlocked, false);
});

test('short background prevents a late reply and long background revokes an open key', async () => {
  const f = fixture();
  const reply = await f.send('key');
  f.session.setVisibility(false);
  assert.equal(f.session.deliver(reply), false);
  assert.equal(await f.send('key'), null);
  f.state.now += 301; f.session.setVisibility(true);
  assert.equal(f.session.state().unlocked, false);
});

test('navigation does not renew inactivity; trusted parent activity does', async () => {
  const f = fixture(); await f.send('key');
  f.state.now += 800; f.navigate(PRIVATE_FRAME_PATHS[1]); await f.send('key');
  f.state.now += 201; assert.equal(f.session.state().unlocked, false);
  f.navigate(PRIVATE_FRAME_PATHS[2]); await f.send('key');
  f.state.now += 800; f.session.touch(); f.state.now += 800;
  assert.equal(f.session.state().unlocked, true);
});

test('every sensitive action asks for fresh confirmation and issues a single-use bound grant', async () => {
  const f = fixture(); await f.send('key');
  for (const purpose of SENSITIVE_ACTIONS) {
    const grant = await f.send('fresh', {purpose, target: 'record:fixture-1'});
    assert.equal(grant.kind, 'grant');
    assert.equal((await f.send('consume', {purpose, target: 'record:fixture-2', grant: grant.grant})).kind, 'error');
    assert.equal((await f.send('consume', {purpose, target: 'record:fixture-1', grant: grant.grant})).kind, 'consumed');
    assert.equal((await f.send('consume', {purpose, target: 'record:fixture-1', grant: grant.grant})).kind, 'error');
  }
  assert.equal(f.state.confirms, SENSITIVE_ACTIONS.length);
});

test('cancelled, expired and previous-document confirmations authorize no action', async () => {
  const f = fixture(); await f.send('key'); f.state.confirm = false;
  const intent = {purpose: 'backup-export', target: 'vault'};
  assert.equal((await f.send('fresh', intent)).code, 'CONFIRMATION_CANCELLED');
  f.state.confirm = true;
  const grant = await f.send('fresh', intent); f.state.now += 101;
  assert.equal((await f.send('consume', {...intent, grant: grant.grant})).code, 'GRANT_DENIED');
  const next = await f.send('fresh', intent); f.navigate(PRIVATE_FRAME_PATHS[1]);
  assert.equal((await f.send('consume', {...intent, grant: next.grant})).code, 'GRANT_DENIED');
});

test('concurrent fresh confirmations cannot exceed the eight-grant bound', async () => {
  const wait = deferred(), f = fixture({confirmSensitive: () => wait.promise});
  await f.send('key');
  const attempts = Array.from({length: 9}, (_, index) => f.send('fresh', {purpose: 'backup-export', target: `vault:${index}`}));
  await new Promise(resolve => setImmediate(resolve)); wait.resolve(true);
  const replies = await Promise.all(attempts);
  assert.equal(replies.filter(reply => reply.kind === 'grant').length, 8);
  assert.equal(replies.filter(reply => reply.code === 'FRESH_CONFIRMATION_REQUIRED').length, 1);
  assert.equal(f.session.state().grants, 8);
});

test('navigation or identity change during fresh confirmation rejects late permission', async () => {
  for (const change of [f => f.navigate(PRIVATE_FRAME_PATHS[1]), f => {f.state.epoch++;}]) {
    const wait = deferred(), f = fixture({confirmSensitive: () => wait.promise});
    await f.send('key');
    const result = f.send('fresh', {purpose: 'permanent-delete', target: 'record:fixture'});
    await new Promise(resolve => setImmediate(resolve));
    change(f); wait.resolve(true);
    assert.equal(await result, null);
    assert.equal(f.session.state().grants, 0);
  }
});

test('permit failure revokes the existing session instead of silently extending a lease', async () => {
  let broken = false;
  const f = fixture({readPermit: async () => {if (broken) throw Error('offline'); return {uid: 'fixture-owner', enabled: true, version: 1, expiresAt: 99999};}});
  await f.send('key'); broken = true;
  assert.equal(await f.send('key'), null);
  assert.equal(f.session.state().unlocked, false);
});

test('all timeout parameters must be finite and positive', () => {
  for (const option of ['idleMs', 'backgroundMs', 'grantMs']) for (const value of [Infinity, NaN, 0, -1]) {
    assert.throws(() => createFrameSession({[option]: value}), /INVALID_TIMEOUT/);
  }
});

test('a lock between admission and continuation cannot reinstall a key or a grant', async () => {
  for (const command of ['key', 'fresh']) {
    let calls = 0, arm = false, f;
    f = fixture({readPermit: async () => {
      calls++;
      if (arm && calls === 2) queueMicrotask(() => queueMicrotask(() => f.session.lock('microtask')));
      return {uid: 'fixture-owner', enabled: true, version: 1, expiresAt: 99999};
    }});
    if (command === 'fresh') await f.send('key');
    arm = true; calls = 0;
    assert.equal(await f.send(command, {purpose: 'backup-export', target: 'vault'}), null);
    assert.equal(f.session.state().unlocked, false);
    assert.equal(f.session.state().grants, 0);
  }
});

test('pending unlock age includes both key acquisition and the final permit read', async () => {
  for (const stage of ['unlock', 'readmit']) {
    const wait = deferred(); let calls = 0;
    const f = fixture({unlock: () => stage === 'unlock' ? wait.promise : Promise.resolve('synthetic'),
      readPermit: async () => {
        if (++calls === 2 && stage === 'readmit') await wait.promise;
        return {uid: 'fixture-owner', enabled: true, version: 1, expiresAt: 99999};
      }});
    const result = f.send('key'); await new Promise(resolve => setImmediate(resolve));
    f.state.now += 1001; // No tick: resolution itself must enforce the deadline.
    wait.resolve('late-synthetic');
    assert.equal(await result, null);
    assert.equal(f.session.state().unlocked, false);
  }
});
