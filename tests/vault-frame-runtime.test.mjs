import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createFrameSession} from '../Frontend/public/assets/js/modules/core/vault-frame-session.mjs';
import {FRAME_PROTOCOL, FRAME_ROUTES, privateFrameUrl, inactivityMilliseconds, safeAreaInsets, residualInsets} from '../Frontend/public/assets/js/modules/core/vault-frame-policy.mjs';
import {bankingRemovalPlan} from '../Frontend/public/assets/js/modules/core/vault-frame-removal-plan.mjs';

const origin = 'https://fixture.invalid', release = 'fixture-release';
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
function fixture(overrides = {}) {
  const state = {time: 1000, uid: 'synthetic', epoch: '1:fence-nonce', allowed: true, fence: true,
    url: origin + '/home_page.html', document: {}, unlocks: 0, confirmations: 0, locks: [], posted: []};
  const frame = {postMessage: (data, target) => state.posted.push({data, target})};
  const session = createFrameSession({origin, release, getFrameWindow: () => frame,
    getFrameDocument: () => state.document, getFrameUrl: () => state.url,
    getIdentity: () => ({uid: state.uid, epoch: state.epoch}),
    readPermit: async () => ({enabled: state.allowed, uid: state.uid, version: 1, expiresAt: state.time + 1000000}),
    validateIdentity: async () => state.fence,
    unlock: async () => {state.unlocks++; return 'SYNTHETIC-MATERIAL';},
    confirmSensitive: async () => {state.confirmations++; return true;},
    idleMs: 180000, backgroundMs: 180000, now: () => state.time,
    onLock: reason => state.locks.push(reason), ...overrides});
  let documentNonce = session.beginDocument();
  const event = (command, extra = {}) => ({source: frame, origin, data: {protocol: FRAME_PROTOCOL, release,
    documentNonce, requestId: crypto.randomUUID(), command, ...extra}});
  return {state, frame, session, event, send: (command, extra) => session.handle(event(command, extra)),
    navigate(path) {state.url = origin + path; state.document = {}; documentNonce = session.beginDocument();}};
}

test('production admission and durable fence independently default DENY', async () => {
  for (const options of [{readPermit: undefined}, {validateIdentity: undefined}, {readPermit: async () => null},
    {readPermit: async () => ({enabled: true, version: 1, uid: 'foreign', expiresAt: 999999})}]) {
    const f = fixture(options); assert.equal(await f.send('key'), null); assert.equal(f.state.unlocks, 0);
  }
});
test('all 22 real routes retain one owner unlock without renewing the deadline', async () => {
  const f = fixture(); let deadline;
  for (const route of Object.keys(FRAME_ROUTES)) {
    f.navigate(`/${route}.html`); f.state.time += 100;
    const reply = await f.send('key'); assert.equal(reply.material, 'SYNTHETIC-MATERIAL');
    deadline ??= reply.expiresAt; assert.equal(reply.expiresAt, deadline);
    assert.equal(await f.session.deliver(reply), true); assert.equal(await f.session.deliver(reply), false);
  }
  assert.equal(f.state.unlocks, 1); assert.equal(f.state.posted.length, 22);
  assert.ok(f.state.posted.every(value => value.target === origin));
  assert.equal(Object.hasOwn(f.session.state(), 'material'), false);
});
test('origin, source, release, protocol, document, unknown fields and request replay are rejected', async () => {
  const f = fixture(), valid = f.event('key');
  for (const event of [{...valid, source: {}}, {...valid, origin: 'null'}, {...valid, origin: 'https://other.invalid'},
    {...valid, data: {...valid.data, release: 'other'}}, {...valid, data: {...valid.data, protocol: 'old'}},
    {...valid, data: {...valid.data, documentNonce: 'wrong'}}, {...valid, data: {...valid.data, arbitrary: 'x'}}])
    assert.equal(await f.session.handle(event), null);
  const reply = await f.session.handle(valid); assert.ok(reply);
  assert.equal(await f.session.handle(valid), null);
});
for (const change of ['uid', 'epoch', 'document', 'url', 'fence', 'allowed']) test(`late unlock cannot survive changed ${change}`, async () => {
  const pending = deferred(), f = fixture({unlock: () => pending.promise});
  const response = f.send('key'); await new Promise(resolve => setImmediate(resolve));
  f.state[change] = {uid: 'other', epoch: '2:another-fence', document: {}, url: origin + '/privacy.html', fence: false, allowed: false}[change];
  pending.resolve('SYNTHETIC-LATE'); assert.equal(await response, null); assert.equal(f.session.state().unlocked, false);
});
test('durable fence is rechecked at the last delivery boundary, including same UID nonce changes', async () => {
  const f = fixture(), reply = await f.send('key'); f.state.fence = false;
  assert.equal(await f.session.deliver(reply), false); assert.equal(f.session.state().unlocked, false);
  assert.equal(f.state.posted.length, 0);
});
for (const reason of ['logout', 'background', 'lock', 'parent-pagehide']) test(`${reason} invalidates late key replies`, async () => {
  const f = fixture(), reply = await f.send('key'); f.session.lock(reason);
  assert.equal(await f.session.deliver(reply), false); assert.equal(f.session.state().unlocked, false);
});
test('child document retirement retains only the parent key and revokes previous replies/grants', async () => {
  const f = fixture(), reply = await f.send('key');
  const grant = await f.send('fresh', {purpose: 'backup-export', target: 'vault'});
  f.navigate('/profilo_privato.html?profileTab=documents#document');
  assert.equal(await f.session.deliver(reply), false);
  assert.equal((await f.send('consume', {purpose: 'backup-export', target: 'vault', grant: grant.grant})).kind, 'error');
  assert.equal((await f.send('key')).material, 'SYNTHETIC-MATERIAL'); assert.equal(f.state.unlocks, 1);
});
test('fresh grants bind purpose, target, document and expiry and are single-use', async () => {
  const f = fixture(); await f.send('key');
  for (const purpose of ['backup-export', 'portable-export', 'master-change', 'sharing-change', 'permanent-delete']) {
    const args = {purpose, target: 'record-id'}, grant = await f.send('fresh', args);
    assert.equal(grant.kind, 'grant');
    assert.equal((await f.send('consume', {...args, target: 'other', grant: grant.grant})).kind, 'error');
    assert.equal((await f.send('consume', {...args, grant: grant.grant})).kind, 'consumed');
    assert.equal((await f.send('consume', {...args, grant: grant.grant})).kind, 'error');
  }
  const grant = await f.send('fresh', {purpose: 'backup-export', target: 'vault'}); f.state.time += 15001;
  assert.equal((await f.send('consume', {purpose: 'backup-export', target: 'vault', grant: grant.grant})).kind, 'error');
});
test('forceReload path requires a new confirmation even with a cached owner key', async () => {
  const f = fixture(); await f.send('key'); await f.send('key'); assert.equal(f.state.confirmations, 0);
  assert.equal((await f.send('rekey')).kind, 'key'); assert.equal(f.state.confirmations, 1);
});
test('cancelled or pending confirmation cannot create grants after lock', async () => {
  const cancelled = fixture({confirmSensitive: async () => false}); await cancelled.send('key');
  assert.equal((await cancelled.send('fresh', {purpose: 'backup-export', target: 'vault'})).kind, 'error');
  const pending = deferred(); let signal;
  const f = fixture({confirmSensitive: args => {signal = args.signal; return pending.promise;}}); await f.send('key');
  const response = f.send('fresh', {purpose: 'backup-export', target: 'vault'}); await new Promise(resolve => setImmediate(resolve));
  f.session.lock('manual'); assert.equal(signal.aborted, true); pending.resolve(true);
  assert.equal(await response, null); assert.equal(f.session.state().grants, 0);
});
for (const minutes of [1, 3, 5, 720, 0, null, undefined, -1, '12', NaN, Infinity]) test(`timer preference ${String(minutes)} controls idle and background`, async () => {
  const f = fixture(); f.session.setTimeouts(inactivityMilliseconds(minutes)); await f.send('key');
  f.session.setVisibility(false); f.state.time += inactivityMilliseconds(minutes);
  f.session.setVisibility(true); assert.equal(f.session.state().unlocked, false);
});
test('shortening an already elapsed preference locks immediately; navigation never renews it', async () => {
  const f = fixture(); await f.send('key'); f.state.time += 61000; f.navigate('/area_privata.html');
  f.session.setTimeouts(60000); assert.equal(f.session.state().unlocked, false);
});
test('invalid preference fallback does not extend an earlier short deadline', async () => {
  const f = fixture(); f.session.setTimeouts(30000); await f.send('key');
  f.state.time += 10000; f.session.setTimeouts(60000, true);
  assert.equal(f.session.state().expiresAt, 31000);
  f.state.time = 31000; assert.equal(f.session.state().unlocked, false);
});
test('background aborts pending unlock and revokes old grants even after a quick resume', async () => {
  const pending = deferred(); let signal;
  const f = fixture({unlock: (_uid, options) => {signal = options.signal; return pending.promise;}});
  const response = f.send('key'); await new Promise(resolve => setImmediate(resolve));
  f.session.setVisibility(false); assert.equal(signal.aborted, true);
  f.session.setVisibility(true); pending.resolve('SYNTHETIC-LATE');
  assert.equal(await response, null); assert.equal(f.session.state().unlocked, false);
  const g = fixture(); await g.send('key'); const grant = await g.send('fresh', {purpose: 'backup-export', target: 'vault'});
  g.session.setVisibility(false); g.session.setVisibility(true);
  assert.equal((await g.send('consume', {purpose: 'backup-export', target: 'vault', grant: grant.grant})).kind, 'error');
});
test('a delayed negative delivery check for document A cannot lock successor B', async () => {
  const pending = deferred(); let pause = false;
  const f = fixture({validateIdentity: async () => pause ? pending.promise : true});
  const reply = await f.send('key'); pause = true;
  const delivery = f.session.deliver(reply); await new Promise(resolve => setImmediate(resolve));
  f.navigate('/area_privata.html'); pause = false; pending.resolve(false);
  assert.equal(await delivery, false); assert.equal(f.session.state().unlocked, true);
  assert.equal((await f.send('key')).kind, 'key'); assert.equal(f.state.unlocks, 1);
});
test('banking removal authorization uses identifiers/counts and excludes normal value edits', () => {
  const before = [{bankId: 'a', iban: 'SYNTHETIC', cards: [{number: 'fixture'}, {}]}, {bankId: 'b'}];
  assert.deepEqual(bankingRemovalPlan(before, [{...before[0], iban: 'edited'}, before[1]]), []);
  assert.deepEqual(bankingRemovalPlan(before, [{...before[0], cards: [{}]}]), [{bankId: 'a', cardsRemoved: 1}, {bankId: 'b'}]);
  assert.equal(JSON.stringify(bankingRemovalPlan(before, [])).includes('SYNTHETIC'), false);
});
for (const url of ['blob:https://fixture.invalid/x', 'data:text/html,x', 'about:blank', '/privacy.html', '/app.html',
  '/impostazioni.html?recovery=complete', '/home_page.html?uid=foreign', '/scadenze.html?filter=a&filter=b',
  '/profilo_privato.html?m6pilot=1', '/gestione_destinatari.html?return=https://other.invalid/',
  '/regole_scadenze.html?return=/form_account_privato.html', '/home_page.html#%00', '/%2568ome_page.html'])
  test(`route denied: ${url}`, () => assert.equal(privateFrameUrl(url, origin), null));
for (const url of ['/home', '/profilo_privato.html?profileDocumentId=synthetic#section-email',
  '/form_account_privato.html?type=standard&linkShared=1#shared-credentials-section',
  '/regole_scadenze.html?return=aggiungi_scadenza.html%3FaccountSource%3D1',
  '/gestione_destinatari.html?return=form_account_azienda.html%3FaziendaId%3Dsynthetic',
  '/configurazione_automezzi.html?domain=vehicles&source=deadlineConfig'])
  test(`route preserved: ${url}`, () => assert.ok(privateFrameUrl(url, origin)));
test('insets reject coercion, CSS injection, nonfinite and oversized values', () => {
  const valid = {top: 40, right: 2, bottom: 30, left: 3};
  assert.deepEqual(safeAreaInsets(valid, 393, 852), valid);
  for (const bad of [{...valid, top: '40px'}, {...valid, top: NaN}, {...valid, right: Infinity},
    {...valid, top: -1}, {...valid, top: 900}, {...valid, extra: 0}]) assert.equal(safeAreaInsets(bad, 393, 852), null);
  assert.deepEqual(residualInsets(valid, {width: 393, height: 852}, {left: 3, top: 40, right: 391, bottom: 822, width: 388, height: 782}),
    {top: 0, left: 0, right: 0, bottom: 0});
});
test('A2 production entry remains closed independently of query/storage and preserves headers/Rules scope', async () => {
  const root = new URL('../Frontend/public/assets/js/', import.meta.url);
  assert.match(await readFile(new URL('app-env.js', root), 'utf8'), /VAULT_FRAME_ENABLED = false;/);
  assert.match(await readFile(new URL('modules/core/vault-frame-production.js', root), 'utf8'), /readVaultFramePermit\(\) \{ return null; \}/);
});
