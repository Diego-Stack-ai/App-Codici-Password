import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
Error.stackTraceLimit = 0;

const apiPromise = build({stdin: {contents: `
export * from './settings/complete-recovery-client.js';
export * from './settings/full-recovery-service.js';
export * from './core/crypto-utils.js';
`, resolveDir: `${process.cwd()}/Frontend/public/assets/js/modules`, loader: 'js'},
bundle: true, format: 'esm', platform: 'browser', write: false})
  .then(result => import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`));
const uid = 'synthetic-recovery-client';
const operationId = 'synthetic-operation';
const copy = value => structuredClone(value);
async function fixture({empty = false} = {}) {
  const api = await apiPromise;
  const oldMaster = 'Old-Synthetic!Master-789', newMaster = 'New-Synthetic!Master-987';
  const material = api.generateVaultKey(), lines = [];
  const security = {vaultKeyEnvelope: await api.wrapVaultKey(material, oldMaster),
    verifier: await api.createVaultVerifier('APP_CODICI_PASSWORD_VAULT_VERIFIER_V1', oldMaster)};
  const sourcePath = `users/${uid}/accounts/account-one/attachment-one`;
  const records = [{kind: 'record', scope: 'profile', id: uid, data: {}},
    {kind: 'record', scope: 'private-account', id: 'account-one', data: {nomeAccount: 'Synthetic'}},
    {kind: 'record', scope: 'private-account-attachment', accountId: 'account-one', id: 'attachment-one', data: {storagePath: sourcePath}}];
  if (empty) records.splice(1);
  const exported = await api.writeCompleteRecoveryBackup({uid, readSecurity: async () => copy(security),
    collectRecords: async () => copy(records), promptMasterPassword: async () => oldMaster,
    readIdentity: async () => ({publicIdentity: null, privateEnvelope: null}), listProfileAttachments: async () => [],
    readAsset: async () => ({bytes: new Uint8Array([1,2,3]), size: 3, contentType: 'text/plain', generation: '90071992547409931235'}),
    writeLine: async line => lines.push(line)});
  const file = new Blob(lines), open = () => api.prepareCompleteRecovery(file, uid, exported.recoveryKey, {getCurrentUid: () => uid});
  return {api, file, exported, open, oldMaster, newMaster, material, plan: await open()};
}
function transport(state = {}) {
  const calls = [], locators = [], cleared = [];
  const options = {uid, operationId, confirmation: 'RECOVER_EMPTY_VAULT', getCurrentUid: () => uid,
    rememberOperation: locator => locators.push(copy(locator)), clearRememberedOperation: locator => cleared.push(copy(locator)),
    invoke: async request => {
      calls.push(copy(request));
      if (request.action === 'prepare') return {status: state.security ? 'complete' : state.expired ? 'expired' : 'prepared', operationId,
        planDigest: 'a'.repeat(64), chunkCount: state.chunkCount ?? 1, partBytes: 2097152, ...(state.security ? {security: copy(state.security)} : {})};
      if (request.action === 'repreview') {
        assert.equal(request.confirmation, 'REPREVIEW_EXPIRED_RECOVERY');
        state.expired = false;
        return {status: 'repreviewed', operationId, planDigest: 'a'.repeat(64), chunkCount: state.chunkCount ?? 1, partBytes: 2097152};
      }
      if (request.action === 'uploadPart') return {status: 'staged', assetIndex: request.assetIndex, partIndex: request.partIndex};
      if (request.action === 'finishAsset') return {status: 'verified', assetIndex: request.assetIndex};
      if (request.action === 'cleanupParts') {
        if (state.dropCleanupResponse) throw new Error('synthetic cleanup network failure');
        return {status: 'cleaned', assetIndex: request.assetIndex};
      }
      if (request.action === 'publishChunk') return {status: 'published', chunkIndex: request.chunkIndex};
      if (request.action === 'finalize') {
        state.security = copy(request.finalize.security);
        if (state.dropFinalResponse) throw new Error('provider response contained synthetic-private-details');
        return {status: 'complete', operationId};
      }
      throw new Error('unexpected action');
    }};
  return {state, calls, locators, cleared, options};
}

test('orchestration stages verified bytes before publication and verifies committed password before success', async () => {
  const f = await fixture(), remote = transport();
  const result = await f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options);
  assert.equal(result.status, 'complete');
  assert.deepEqual(remote.calls.map(call => call.action), ['prepare','uploadPart','finishAsset','publishChunk','finalize','prepare','cleanupParts']);
  assert.deepEqual(Object.keys(remote.locators[0]).sort(), ['backupId','contentDigest','operationId','uid']);
  assert.equal(remote.cleared.length, 1);
  for (const secret of [f.material, f.newMaster, f.oldMaster, f.exported.recoveryKey]) {
    assert.equal(JSON.stringify(remote.calls).includes(secret), false);
    assert.equal(JSON.stringify(remote.locators).includes(secret), false);
  }
  assert.throws(() => f.api.createRecoveryContentPayload(f.plan), /RELEASED/);
});

test('lost final response retains operation identity and reopening resumes without replaying publication', async () => {
  const f = await fixture(), remote = transport({dropFinalResponse: true});
  await assert.rejects(f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options), error =>
    error.code === 'RECOVERY_OPERATION_UNCONFIRMED' && error.canResume && !error.message.includes('private-details'));
  assert.equal(remote.cleared.length, 0);
  remote.calls.length = 0;
  const resumed = await f.api.executeCompleteRecovery(await f.open(), f.newMaster, remote.options);
  assert.equal(resumed.resumed, true);
  assert.deepEqual(remote.calls.map(call => call.action), ['prepare','cleanupParts']);
  assert.equal(remote.locators.every(locator => locator.operationId === operationId), true);
  assert.equal(remote.cleared.length, 1);
});

test('completed operation rejects a different newly entered password without claiming success', async () => {
  const f = await fixture(), authority = await f.api.createFinalizePayload(f.plan, f.newMaster), remote = transport({security: authority.security});
  await assert.rejects(f.api.executeCompleteRecovery(f.plan, 'Another-Synthetic!Master-765', remote.options), /COMPLETED_PASSWORD_MISMATCH/);
  assert.deepEqual(remote.calls.map(call => call.action), ['prepare']);
  assert.equal(remote.cleared.length, 0);
});

test('late lock or owner change stops further RPCs and clears recovery authority', async () => {
  const events = new EventTarget(), add = globalThis.addEventListener, remove = globalThis.removeEventListener;
  globalThis.addEventListener = events.addEventListener.bind(events);
  globalThis.removeEventListener = events.removeEventListener.bind(events);
  try {
    const f = await fixture(), remote = transport(), invoke = remote.options.invoke;
    remote.options.invoke = async request => {
      const result = await invoke(request);
      if (request.action === 'publishChunk') events.dispatchEvent(new Event('vault-session-locked'));
      return result;
    };
    await assert.rejects(f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options), /SESSION_INVALIDATED/);
    assert.equal(remote.calls.some(call => call.action === 'finalize'), false);
    assert.equal(remote.cleared.length, 0);
    assert.throws(() => f.api.createRecoveryContentPayload(f.plan), /RELEASED/);
  } finally { globalThis.addEventListener = add; globalThis.removeEventListener = remove; }
  const f = await fixture(), remote = transport(), invoke = remote.options.invoke;
  let currentUid = uid;
  remote.options.getCurrentUid = () => currentUid;
  remote.options.invoke = async request => { const result = await invoke(request); currentUid = 'other-owner'; return result; };
  await assert.rejects(f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options), /SESSION_INVALIDATED/);
  assert.deepEqual(remote.calls.map(call => call.action), ['prepare']);
});

test('confirmation is required before any request or persistent locator', async () => {
  const f = await fixture(), remote = transport();
  await assert.rejects(f.api.executeCompleteRecovery(f.plan, f.newMaster, {...remote.options, confirmation: 'not-confirmed'}), /CONFIRMATION_REQUIRED/);
  assert.equal(remote.calls.length, 0); assert.equal(remote.locators.length, 0);
});

test('transport admission precedes locator/fence and each actual part/finalize body is rechecked', async () => {
  const path = '../Frontend/public/assets/js/modules/settings/';
  const source = (await readFile(new URL(path + 'complete-recovery-client.js', import.meta.url), 'utf8'))
    .replace(/^import[^;]+;\r?\n/gm, '').replace(/^export /gm, '');
  const limitsSource = await readFile(new URL(path + 'recovery-transport-limits.js', import.meta.url), 'utf8');
  const limits = await import(`data:text/javascript;base64,${Buffer.from(limitsSource).toString('base64')}`);
  for (const scenario of ['content', 'finalize-admission', 'part-request', 'finalize-request']) {
    const calls = [], locators = [], plan = {}; let released = 0, cloneCount = 0;
    const asset = {storagePath: 'synthetic-path', sha256: 'a'.repeat(64)};
    const content = {ownerUid: uid, backupId: 'backup', contentDigest: 'a'.repeat(64), records: [],
      assets: scenario === 'part-request' ? [asset] : [], references: []};
    const authority = {security: {}, sharingIdentity: {state: 'absent'}};
    if (scenario === 'content') content.padding = 'x'.repeat(limits.MAX_RECOVERY_CONTENT_BYTES);
    if (scenario === 'finalize-admission') authority.padding = 'x'.repeat(limits.MAX_RECOVERY_CALLABLE_BODY_BYTES);
    const context = vm.createContext({...limits, crypto, Uint8Array,
      createRecoveryContentPayload: () => content, createFinalizePayload: async () => authority,
      visitRecoveryAssets: async (_plan, visitor) => { if (content.assets.length) await visitor(asset, new Uint8Array([1])); },
      recoveryBase64: bytes => Buffer.from(bytes).toString('base64'),
      releaseCompleteRecovery: () => { released++; }, verifyCompletedRecovery: async () => true,
      structuredClone: value => {
        const result = structuredClone(value);
        if (value === content) cloneCount++;
        if ((scenario === 'part-request' && value === content && cloneCount === 2) ||
          (scenario === 'finalize-request' && value === authority)) result.padding = 'x'.repeat(limits.MAX_RECOVERY_CALLABLE_BODY_BYTES);
        return result;
      }});
    vm.runInContext(source, context);
    await assert.rejects(context.executeCompleteRecovery(plan, 'Synthetic!Master-123', {uid, operationId,
      confirmation: 'RECOVER_EMPTY_VAULT', getCurrentUid: () => uid,
      rememberOperation: value => locators.push(value), invoke: async request => {
        calls.push(request.action);
        return {status: 'prepared', operationId, planDigest: 'a'.repeat(64), chunkCount: 0, partBytes: 2097152};
      }}), error => error.code === 'RECOVERY_TRANSPORT_CAPACITY_EXCEEDED' &&
        error.canResume === scenario.endsWith('request'));
    assert.deepEqual(calls, scenario.endsWith('request') ? ['prepare'] : []);
    assert.equal(locators.length, scenario.endsWith('request') ? 1 : 0);
    assert.equal(released, 1);
  }
});

test('profile-only recovery finalizes authority without inventing content chunks or assets', async () => {
  const f = await fixture({empty: true}), remote = transport({chunkCount: 0});
  const result = await f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options);
  assert.equal(result.recordCount, 1); assert.equal(result.assetCount, 0);
  assert.deepEqual(remote.calls.map(call => call.action), ['prepare','finalize','prepare']);
});

test('expired plans require explicit fresh-preview consent before renewing the same operation', async () => {
  const f = await fixture({empty: true}), blocked = transport({expired: true, chunkCount: 0});
  await assert.rejects(f.api.executeCompleteRecovery(f.plan, f.newMaster, blocked.options), /PLAN_REPREVIEW_REQUIRED/);
  assert.deepEqual(blocked.calls.map(call => call.action), ['prepare']);
  assert.equal(blocked.cleared.length, 0);
  const allowed = transport({expired: true, chunkCount: 0});
  allowed.options.confirmExpiredPlan = async counts => { assert.deepEqual(counts, {recordCount: 1, assetCount: 0}); return true; };
  const result = await f.api.executeCompleteRecovery(await f.open(), f.newMaster, allowed.options);
  assert.equal(result.resumed, true);
  assert.deepEqual(allowed.calls.map(call => call.action), ['prepare','repreview','finalize','prepare']);
});

test('cleanup failure reports completed recovery separately and retains its minimal retry locator', async () => {
  const f = await fixture(), remote = transport({dropCleanupResponse: true});
  const result = await f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options);
  assert.equal(result.status, 'complete'); assert.equal(result.cleanupPending, true);
  assert.equal(remote.cleared.length, 0);
  remote.state.dropCleanupResponse = false; remote.calls.length = 0;
  const resumed = await f.api.executeCompleteRecovery(await f.open(), f.newMaster, remote.options);
  assert.equal(resumed.cleanupPending, false);
  assert.deepEqual(remote.calls.map(call => call.action), ['prepare','cleanupParts']);
  assert.equal(remote.cleared.length, 1);
});

test('a failed checking phase clears its locator only after exact server proof of no recovery writes', async () => {
  const f = await fixture(), remote = transport(), invoke = remote.options.invoke;
  remote.options.invoke = async request => {
    if (request.action === 'prepare') {
      remote.calls.push(copy(request));
      throw Object.assign(new Error('FULL_RECOVERY_TARGET_NONEMPTY'), {code: 'FULL_RECOVERY_TARGET_NONEMPTY'});
    }
    if (request.action === 'abortChecking') {
      remote.calls.push(copy(request));
      return {status: 'not-started', operationId, planDigest: 'a'.repeat(64),
        contentDigest: request.content.contentDigest, abortReceiptDigest: 'b'.repeat(64)};
    }
    return invoke(request);
  };
  const result = await f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options);
  assert.deepEqual(result, {status: 'not-started', operationId, reason: 'FULL_RECOVERY_TARGET_NONEMPTY'});
  assert.deepEqual(remote.calls.map(call => call.action), ['prepare', 'abortChecking']);
  assert.equal(remote.cleared.length, 1);
  assert.throws(() => f.api.createRecoveryContentPayload(f.plan), /RELEASED/);
});

test('a lost abort response resumes the same terminal receipt without restarting recovery', async () => {
  const f = await fixture(), remote = transport();
  remote.options.invoke = async request => {
    remote.calls.push(copy(request));
    if (request.action === 'prepare' && remote.state.aborted) return {status: 'not-started', operationId,
      planDigest: 'a'.repeat(64), contentDigest: request.content.contentDigest, abortReceiptDigest: 'b'.repeat(64)};
    if (request.action === 'prepare') throw new Error('FULL_RECOVERY_ROOT_CHANGED');
    if (request.action === 'abortChecking') { remote.state.aborted = true; throw new Error('lost response'); }
    throw new Error('unexpected action');
  };
  await assert.rejects(f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options), error => error.canResume === true);
  assert.equal(remote.cleared.length, 0);
  remote.calls.length = 0;
  assert.equal((await f.api.executeCompleteRecovery(await f.open(), f.newMaster, remote.options)).status, 'not-started');
  assert.deepEqual(remote.calls.map(call => call.action), ['prepare']);
  assert.equal(remote.cleared.length, 1);
});

test('abort rejection, invalid receipts and unknown prepare failures preserve uncertainty and never start another operation', async () => {
  for (const kind of ['prepared', 'receipt', 'network']) {
    const f = await fixture(), remote = transport();
    remote.options.invoke = async request => {
      remote.calls.push(copy(request));
      if (request.action === 'prepare') throw new Error(kind === 'network' ? 'lost response' : 'FULL_RECOVERY_STORAGE_NONEMPTY');
      if (request.action === 'abortChecking' && kind === 'receipt') return {status: 'not-started', operationId,
        planDigest: 'a'.repeat(64), contentDigest: 'c'.repeat(64), abortReceiptDigest: 'b'.repeat(64)};
      throw new Error('FULL_RECOVERY_NOT_CHECKING');
    };
    await assert.rejects(f.api.executeCompleteRecovery(f.plan, f.newMaster, remote.options), error => error.canResume === true);
    assert.equal(remote.cleared.length, 0);
    assert.deepEqual(remote.calls.map(call => call.action), kind === 'network' ? ['prepare'] : ['prepare', 'abortChecking']);
    assert.equal(remote.calls.every(call => call.operationId === operationId), true);
  }
});
