import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root = new URL('../Frontend/public/assets/js/modules/settings/', import.meta.url);
const strip = source => source.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const service = strip(await readFile(new URL('backup-import-service.js', root), 'utf8'));
const model = strip(await readFile(new URL('backup-import-model.js', root), 'utf8'));
const deferred = () => { let resolve; return {promise: new Promise(done => { resolve = done; }), resolve}; };

function fixture(count = 1, attachment = false) {
    const observers = new Set(), events = new EventTarget(), calls = [], uploads = [];
    const auth = {currentUser: {uid: 'A'}};
    const records = Array.from({length: count}, (_, index) => ({kind: 'record', scope: 'private-account', id: `r${index}`, data: {nomeAccount: 'Synthetic', password: 'cipher'}}));
    if (attachment) records.push({kind: 'record', scope: 'private-account-attachment', id: 'file', accountId: 'r0', data: {storagePath: 'users/A/accounts/r0/attachments/file'}});
    const entries = [...records, ...(attachment ? [{kind: 'attachment', storagePath: 'users/A/accounts/r0/attachments/file', content: 'QQ=='}] : [])];
    const file = {size: 100, text: async () => [JSON.stringify({backupId: 'fixture'}), ...entries.map(JSON.stringify), JSON.stringify({kind: 'footer', entryCount: entries.length, recordCount: records.length, attachmentCount: attachment ? 1 : 0})].join('\n')};
    const context = vm.createContext({
        auth, AbortController, TextEncoder, Uint8Array, crypto: {randomUUID: () => 'execution'},
        functions: {}, storage: {}, ref: (_storage, path) => path,
        atob: value => Buffer.from(value, 'base64').toString('binary'),
        onAuthStateChanged: (_auth, callback) => { observers.add(callback); return () => observers.delete(callback); },
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        parseBackupLine: JSON.parse, deriveBackupKey: async () => 'synthetic-key',
        decryptBackupEntry: async ({envelope}) => ({entry: envelope, digest: 'fixture'}),
        collectOwnerBackup: async () => ({records: []}),
        respond: async () => ({data: {status: 'applied', collisionCount: 0}}),
        httpsCallable: () => async command => { calls.push({uid: auth.currentUser?.uid, command}); return context.respond(command); },
        uploadBytes: async (...args) => uploads.push(args),
    });
    vm.runInContext(`(() => { ${model}\nObject.assign(globalThis,{chunkRestoreRecords,compareRestoreRecords,validateBackupFooter,validateRestoreStoragePath}); })()`, context);
    vm.runInContext(service, context);
    return {context, file, calls, uploads, observers,
        prepare: () => context.prepareBackupRestore(file, 'A', 'synthetic-recovery'),
        changeUid: uid => { auth.currentUser = {uid}; for (const callback of [...observers]) callback(auth.currentUser); },
        lock: () => events.dispatchEvent(new Event('vault-session-locked')),
    };
}

test('a prepared plan is immediately cleared on UID change and cannot write under the next identity', async () => {
    const f = fixture(), plan = await f.prepare();
    f.changeUid('B');
    assert.equal(plan.recoveryKey, ''); assert.equal(plan.file, null); assert.equal(plan.records.length, 0);
    await assert.rejects(f.context.executeBackupRestore(plan), /PLAN_INVALID/);
    assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 0);
    assert.equal(f.observers.size, 0);
});

test('a late current-Vault read after identity change cannot publish a preview', async () => {
    const f = fixture(), gate = deferred();
    f.context.collectOwnerBackup = () => gate.promise;
    const pending = f.prepare(); await new Promise(setImmediate); f.changeUid('B'); gate.resolve({records: []});
    await assert.rejects(pending, /SESSION_INVALIDATED/); assert.equal(f.calls.length, 0);
});

test('same-UID lock during file decryption prevents a late preview and releases observers', async () => {
    const f = fixture(), gate = deferred();
    f.context.decryptBackupEntry = () => gate.promise;
    const pending = f.prepare(); await new Promise(setImmediate); f.lock(); gate.resolve({entry: {kind: 'record'}, digest: 'late'});
    await assert.rejects(pending, /SESSION_INVALIDATED/); assert.equal(f.calls.length, 0); assert.equal(f.observers.size, 0);
});

test('lock cancels a pending stream read and releases its reader without publishing a preview', async () => {
    const f = fixture(), gate = deferred(); let cancelled = 0, released = 0;
    f.context.TextDecoderStream = class {};
    f.file.stream = () => ({pipeThrough: () => ({getReader: () => ({
        read: () => gate.promise,
        cancel: async () => { cancelled += 1; gate.resolve({done: true}); },
        releaseLock: () => { released += 1; },
    })})});
    const pending = f.prepare(); f.lock();
    await assert.rejects(pending, /SESSION_INVALIDATED/);
    assert.equal(cancelled, 1); assert.equal(released, 1); assert.equal(f.calls.length, 0);
});

test('lock after an apply was sent stops the next chunk without claiming the first request was cancelled', async () => {
    const f = fixture(401), plan = await f.prepare(), gate = deferred();
    f.context.respond = () => gate.promise;
    const pending = f.context.executeBackupRestore(plan); f.lock(); gate.resolve({data: {status: 'applied'}});
    await assert.rejects(pending, error => error.code === 'BACKUP_SESSION_INVALIDATED' && error.progress.mayHaveApplied && error.progress.attemptedChunks === 1);
    assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 1);
    assert.equal(plan.recoveryKey, ''); assert.equal(f.uploads.length, 0);
});

test('failure on the second chunk reports confirmed progress and sanitizes provider errors', async () => {
    const f = fixture(401), plan = await f.prepare(); let sent = 0;
    f.context.respond = async () => { if (++sent === 2) throw new Error('provider secret fixture'); return {data: {status: 'applied'}}; };
    await assert.rejects(f.context.executeBackupRestore(plan), error => {
        assert.equal(error.progress.confirmedChunks, 1); assert.equal(error.progress.attemptedChunks, 2);
        assert.equal(error.progress.mayHaveApplied, true); assert.doesNotMatch(error.message, /provider secret/); return true;
    });
    f.context.releaseBackupRestore(plan);
});

test('attachment failure remains a partial restore while normal restore preserves successful counts', async () => {
    const f = fixture(1, true), plan = await f.prepare();
    f.context.uploadBytes = async () => { throw new Error('storage failure'); };
    await assert.rejects(f.context.executeBackupRestore(plan), error => error.progress.confirmedChunks === 1 && error.progress.mayHaveApplied);
    f.context.releaseBackupRestore(plan);
    const healthy = fixture(), healthyPlan = await healthy.prepare();
    const result = await healthy.context.executeBackupRestore(healthyPlan);
    assert.equal(result.recordCount, 1); assert.equal(result.attachmentCount, 0);
    assert.equal(healthy.calls.length, 2);
    assert.ok(healthy.calls.every(call => call.command.expectedOwnerUid === 'A'));
    healthy.context.releaseBackupRestore(healthyPlan);
});
