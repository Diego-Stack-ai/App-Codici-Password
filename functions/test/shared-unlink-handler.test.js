const test = require('node:test');
const assert = require('node:assert/strict');
const {readFileSync} = require('node:fs');
const {runInNewContext} = require('node:vm');
const {HttpsError} = require('firebase-functions/v2/https');
const policy = require('../shared-vault-service');
const receipts = require('../shared-vault-receipt');
const source = readFileSync(require.resolve('../index'), 'utf8');
const guard = source.slice(source.indexOf('function requireMutationOwner('), source.indexOf('exports.applyOfflineMutation'));
const handler = source.slice(source.indexOf('exports.manageSharedVaultData'), source.indexOf('exports.manageAccountWidget'));
function fixture(linkPatch = {}, widgetPatch = {}, identity = {context: 'private', accountId: 'a'}) {
  const command = {expectedOwnerUid: 'synthetic', action: 'unlink', operationId: 'op', sharedDataId: 's',
    linkId: 'l', widgetId: 'w', expectedRevision: 1, link: identity};
  const paths = policy.sharedVaultPaths('synthetic', command);
  const states = new Map([[paths.data, {revision: 1, secret: 'synthetic-preserved'}],
    [paths.link, {...identity, sharedDataId: 's', widgetId: 'w', ...linkPatch}],
    [paths.widget, {...identity, kind: 'shared-reference', sharedDataId: 's', linkId: 'l', ...widgetPatch}]]);
  const writes = [];
  const ref = path => ({path, collection: key => ref(`${path}/${key}`), doc: key => ref(`${path}/${key}`)});
  const store = {doc: ref, collection: ref, runTransaction: async callback => {
    const pending = [];
    const result = await callback({get: async r => ({exists: states.has(r.path), data: () => states.get(r.path)}),
      delete: r => pending.push(['delete', r.path]), update: (r,v) => pending.push(['update',r.path,v]),
      set: (r,v) => pending.push(['set',r.path,v])});
    writes.push(...pending);
    for (const [action,path,value] of pending) {
      if (action === 'delete') states.delete(path);
      else states.set(path, {...states.get(path), ...value});
    }
    return result;
  }};
  const scope = {exports: {}, ...policy, ...receipts, HttpsError, require: _name => require('../reference-callables'), onCall: (_options, callback) => callback,
    getFirestore: () => store, FieldValue: {serverTimestamp: () => 'synthetic-time'}};
  runInNewContext(guard + handler, scope);
  return {states,writes,paths,command,run: (patch = {}) => scope.exports.manageSharedVaultData({auth: {uid: 'synthetic'},data: {...command,...patch}})};
}
test('unlink rejects mismatched pairs and Account identities with zero committed writes', async () => {
  for (const [link,widget] of [[{widgetId:'other'},{}],[{},{linkId:'other'}],[{},{kind:'embedded'}],
    [{context:'company',companyId:'c'},{}],[{},{accountId:'other'}],[{companyId:'unexpected'},{}]]) {
    const f = fixture(link,widget), before = structuredClone([...f.states]);
    await assert.rejects(f.run(), error => error.code === 'failed-precondition');
    assert.deepEqual([...f.states],before); assert.equal(f.writes.length,0);
  }
});
test('valid orphan unlink preserves shared data and other Account references', async () => {
  for (const identity of [{context:'private',accountId:'a'},{context:'company',accountId:'a',companyId:'c'}]) {
    const f = fixture({}, {}, identity);
    assert.equal(f.states.has(f.paths.account),false);
    f.states.set('users/synthetic/sharedVaultLinks/other',{sharedDataId:'s',accountId:'other'});
    assert.equal((await f.run()).status,'applied');
    assert.equal(f.states.has(f.paths.link),false); assert.equal(f.states.has(f.paths.widget),false);
    assert.equal(f.states.get(f.paths.data).secret,'synthetic-preserved');
    assert.equal(f.states.get(f.paths.data).revision,2);
    assert.equal(f.states.has('users/synthetic/sharedVaultLinks/other'),true);
  }
});

test('unlink rejects same Account id in a different company', async () => {
  for (const patches of [[{companyId:'other'},{}],[{},{companyId:'other'}]]) {
    const f = fixture(...patches, {context:'company',accountId:'a',companyId:'c'});
    const before = structuredClone([...f.states]);
    await assert.rejects(f.run(), error => error.code === 'failed-precondition');
    assert.deepEqual([...f.states],before); assert.equal(f.writes.length,0);
  }
});

test('unlink matcher rejects malformed shapes without mutating input', () => {
  const command = Object.freeze({sharedDataId:'s',linkId:'l',widgetId:'w',link:Object.freeze({context:'private',accountId:'a'})});
  const link = Object.freeze({context:'private',accountId:'a',sharedDataId:'s',widgetId:'w'});
  const widget = Object.freeze({context:'private',accountId:'a',sharedDataId:'s',linkId:'l',kind:'shared-reference'});
  assert.equal(policy.sharedVaultUnlinkMatches(command,link,widget),true);
  for (const malformed of [null,undefined,[],{},'x',42]) {
    assert.equal(policy.sharedVaultUnlinkMatches(malformed,link,widget),false);
    assert.equal(policy.sharedVaultUnlinkMatches(command,malformed,widget),false);
    assert.equal(policy.sharedVaultUnlinkMatches(command,link,malformed),false);
  }
  for (const bad of ['',42,'a/b','x'.repeat(161)]) {
    assert.equal(policy.sharedVaultUnlinkMatches({...command,linkId:bad},link,widget),false);
    assert.equal(policy.sharedVaultUnlinkMatches({...command,link:{context:'private',accountId:bad}},link,widget),false);
  }
});

test('bound receipt rejects changed pair or preconditions; exact replay is immutable and root overrides legacy', async () => {
  const f=fixture(); await f.run();
  f.states.set(f.paths.operation,{domain:'untrusted-legacy'});
  const before=structuredClone([...f.states]), writes=f.writes.length;
  assert.equal((await f.run()).duplicate,true);
  for(const patch of [{widgetId:'other'},{linkId:'other'},{expectedRevision:2},
    {link:{context:'private',accountId:'other'}},{link:{...f.command.link,order:2}}]) {
    await assert.rejects(f.run(patch),error=>error.details?.reason==='SHARED_RESULT_UNVERIFIED');
  }
  assert.deepEqual([...f.states],before); assert.equal(f.writes.length,writes);
});

test('legacy-only or malformed root cannot authorize replay or overwrite data', async () => {
  for(const path of ['legacy','root']) {
    const f=fixture();
    f.states.set(path==='legacy'?f.paths.operation:'mutationResults/synthetic/operations/op',
      {domain:'shared-vault',sharedDataId:'s',action:'unlink',status:'applied',revision:2});
    const before=structuredClone([...f.states]);
    await assert.rejects(f.run(),error=>error.details?.reason==='SHARED_RESULT_UNVERIFIED');
    assert.deepEqual([...f.states],before); assert.equal(f.writes.length,0);
  }
});
