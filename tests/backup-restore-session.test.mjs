import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const root = new URL('../Frontend/public/assets/js/modules/settings/', import.meta.url);
const strip = source => source.replace(/^import[\s\S]*?;\r?\n/gm, '').replace(/^export /gm, '');
const service = strip(await readFile(new URL('backup-import-service.js', root), 'utf8'));
const model = strip(await readFile(new URL('backup-import-model.js', root), 'utf8'));
const exportModel = strip(await readFile(new URL('backup-export-model.js', root), 'utf8'));
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
        collectOwnerBackup: async () => { throw new Error('Separate snapshot must not be read'); },
        respond: async command => ({data: command.mode === 'preview' ? {previewVersion: 1,
            entries: command.records.map((_record, index) => ({index, status: 'missing', expectedVersion: {exists: false}}))
        } : {status: 'applied'}}),
        httpsCallable: () => async command => { calls.push({uid: auth.currentUser?.uid, command}); return context.respond(command); },
        uploadBytes: async (...args) => uploads.push(args),
    });
    vm.runInContext(`(() => { ${model}\nObject.assign(globalThis,{chunkRestoreRecords,describeRestoreRecords,validateBackupFooter,validateRestoreStoragePath}); })()`, context);
    vm.runInContext(`(() => { ${exportModel}\nObject.assign(globalThis,{collectStoragePaths}); })()`, context);
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

test('a late server snapshot after identity change cannot publish a preview', async () => {
    const f = fixture(), gate = deferred();
    f.context.respond = () => gate.promise;
    const pending = f.prepare(); await new Promise(setImmediate); f.changeUid('B'); gate.resolve({records: []});
    await assert.rejects(pending, /SESSION_INVALIDATED/); assert.equal(f.calls.length, 1);
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

test('server comparison and versions stay paired through noncontiguous selection and rechunking', async () => {
    const f = fixture(803);
    f.context.respond = async command => ({data: command.mode === 'preview' ? {previewVersion: 1,
        entries: command.records.map((record, index) => ({index, status: 'changed', expectedVersion: {
            exists: true, updateTime: {seconds: 100, nanoseconds: Number(record.id.slice(1))}
        }})).reverse()
    } : {status: 'applied'}});
    const plan = await f.prepare();
    assert.equal(plan.comparison.counts.changed, 803);
    assert.equal(plan.comparison.entries[802].description, 'Synthetic');
    assert.equal('versions' in plan, false);
    assert.equal('expectedVersion' in plan.records[802], false);
    const selected = Array.from({length: 402}, (_, index) => index * 2);
    const result = await f.context.executeBackupRestore(plan, selected);
    assert.equal(result.recordCount, 402);
    const applies = f.calls.filter(call => call.command.mode === 'apply');
    assert.equal(applies.length, 2);
    assert.equal(applies[0].command.records.length, 400);
    assert.equal(applies[1].command.records.length, 2);
    for (const record of applies.flatMap(call => call.command.records)) {
        assert.equal(record.expectedVersion.updateTime.nanoseconds, Number(record.id.slice(1)));
        assert.equal('expectedVersion' in record.data, false);
    }
    f.context.releaseBackupRestore(plan);
});

test('preview rejects old servers and incomplete, duplicate, inconsistent or malformed versions', async () => {
    const missing = index => ({index, status: 'missing', expectedVersion: {exists: false}});
    const changed = time => ({index: 0, status: 'changed', expectedVersion: {exists: true, updateTime: time}});
    const invalid = [
        {status: 'ready', collisionCount: 0},
        {previewVersion: 2, entries: [missing(0), missing(1)]},
        {previewVersion: 1, entries: [missing(0)]},
        {previewVersion: 1, entries: [missing(0), missing(0)]},
        {previewVersion: 1, entries: [missing(0), missing(2)]},
        {previewVersion: 1, entries: [{...missing(0), status: 'changed'}, missing(1)]},
        {previewVersion: 1, entries: [changed({seconds: 1, nanoseconds: 1e9}), missing(1)]},
        {previewVersion: 1, entries: [changed({seconds: 1.5, nanoseconds: 0}), missing(1)]},
        {previewVersion: 1, entries: [changed({seconds: 1, nanoseconds: 0, extra: true}), missing(1)]},
        {previewVersion: 1, entries: [{...missing(0), expectedVersion: {exists: false, updateTime: null}}, missing(1)]},
    ];
    for (const data of invalid) {
        const f = fixture(2);
        f.context.respond = async () => ({data});
        await assert.rejects(f.prepare(), /BACKUP_PREVIEW_INVALID/);
        assert.equal(f.observers.size, 0);
        assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 0);
    }
});

test('stale preview stops later chunks and uploads with accurate partial progress and invalidates the plan', async () => {
    for (const firstStale of [true, false]) {
        const f = fixture(801, true), plan = await f.prepare(); let sent = 0;
        f.context.respond = async () => ({data: {status: ++sent === (firstStale ? 1 : 2) ? 'stale-preview' : 'applied'}});
        await assert.rejects(f.context.executeBackupRestore(plan), error => {
            assert.equal(error.code, 'BACKUP_PREVIEW_STALE');
            assert.equal(error.progress.confirmedChunks, firstStale ? 0 : 1);
            assert.equal(error.progress.attemptedChunks, firstStale ? 1 : 2);
            assert.equal(error.progress.mayHaveApplied, !firstStale);
            return true;
        });
        assert.equal(sent, firstStale ? 1 : 2);
        assert.equal(f.uploads.length, 0);
        assert.equal(plan.file, null);
        await assert.rejects(f.context.executeBackupRestore(plan), /BACKUP_PLAN_INVALID/);
    }
});

test('an existing profile requires manual overwrite selection and an unchanged profile cannot be selected', async () => {
    for (const status of ['changed', 'unchanged']) {
        const f = fixture();
        const originalText = f.file.text;
        f.file.text = async () => (await originalText()).replace('"scope":"private-account"', '"scope":"profile"');
        f.context.respond = async command => ({data: command.mode === 'preview' ? {previewVersion: 1,
            entries: [{index: 0, status, expectedVersion: {exists: true, updateTime: {seconds: 2, nanoseconds: 0}}}]
        } : {status: 'applied'}});
        const plan = await f.prepare();
        assert.equal(plan.collisionCount, 1);
        assert.equal(plan.comparison.entries[0].description, 'Profilo utente');
        await assert.rejects(f.context.executeBackupRestore(plan), error => !error.progress.mayHaveApplied);
        assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 0);
        if (status === 'changed') {
            await f.context.executeBackupRestore(plan, [0]);
            const command = f.calls.find(call => call.command.mode === 'apply').command;
            assert.equal(command.overwriteExisting, true);
            assert.equal(command.confirmation, 'RESTORE_SELECTED_OVERWRITE');
        } else {
            await assert.rejects(f.context.executeBackupRestore(plan, [0]), error => !error.progress.mayHaveApplied);
            assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 0);
        }
        f.context.releaseBackupRestore(plan);
    }
});

test('explicit retry reuses the uncertain command and skips confirmed chunks before or after a lost commit response', async () => {
    for (const committedBeforeLoss of [false, true]) {
        const f = fixture(401), plan = await f.prepare(), receipts = new Set();
        let fail = true, applied = 0;
        f.context.respond = async command => {
            if (receipts.has(command.operationId)) return {data: {status: 'applied', duplicate: true}};
            if (command.chunkIndex === 1 && fail) {
                fail = false;
                if (committedBeforeLoss) { receipts.add(command.operationId); applied++; }
                throw new Error('lost response with private provider detail');
            }
            receipts.add(command.operationId); applied++;
            return {data: {status: 'applied', duplicate: false}};
        };
        await assert.rejects(f.context.executeBackupRestore(plan), error => {
            assert.equal(error.code, 'BACKUP_FIRESTORE_UNCERTAIN'); assert.equal(error.retryable, true);
            assert.equal(error.progress.confirmedChunks, 1); assert.equal(error.progress.mayHaveApplied, true);
            assert.doesNotMatch(error.message, /provider detail/); return true;
        });
        const firstCommands = f.calls.filter(call => call.command.mode === 'apply').map(call => call.command);
        assert.equal(firstCommands.length, 2);
        await assert.rejects(f.context.executeBackupRestore(plan), error => error.code === 'BACKUP_RETRY_REQUIRED' && error.retryable);
        assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 2);
        const result = await f.context.executeBackupRestore(plan, null, {retry: true});
        const commands = f.calls.filter(call => call.command.mode === 'apply').map(call => call.command);
        assert.equal(commands.length, 3); assert.equal(commands[2], firstCommands[1]);
        assert.equal(JSON.stringify(commands[2]), JSON.stringify(firstCommands[1]));
        assert.equal(applied, 2); assert.equal(result.recordCount, 401);
        assert.ok(Object.isFrozen(commands[2])); assert.ok(Object.isFrozen(commands[2].records[0].data));
        f.context.releaseBackupRestore(plan);
    }
});

test('retry selection is immutable and replacing public plan fields cannot alter the captured payload', async () => {
    const f = fixture(3), plan = await f.prepare(), selected = [2, 0];
    f.context.respond = async () => { throw new Error('response lost'); };
    await assert.rejects(f.context.executeBackupRestore(plan, selected), error => error.retryable);
    const original = f.calls.find(call => call.command.mode === 'apply').command;
    assert.throws(() => { plan.records[0].data.nomeAccount = 'changed'; }, /read only/);
    selected.push(1);
    await assert.rejects(f.context.executeBackupRestore(plan, selected, {retry: true}), error => error.code === 'BACKUP_RESTORE_SELECTION_CHANGED' && !error.retryable);
    plan.records = []; plan.comparison = {entries: [], counts: {}}; plan.header.backupId = 'changed'; plan.recoveryKey = 'changed';
    plan.file = null;
    f.context.respond = async () => ({data: {status: 'applied'}});
    const result = await f.context.executeBackupRestore(plan, [0, 2], {retry: true});
    const commands = f.calls.filter(call => call.command.mode === 'apply').map(call => call.command);
    assert.equal(commands.length, 2); assert.equal(commands[1], original);
    assert.equal(commands[1].backupId, 'fixture'); assert.equal(result.recordCount, 2);
    f.context.releaseBackupRestore(plan);
});

test('single flight rejects concurrent executions without another Firestore call', async () => {
    const f = fixture(), plan = await f.prepare(), gate = deferred();
    f.context.respond = () => gate.promise;
    const first = f.context.executeBackupRestore(plan);
    await assert.rejects(f.context.executeBackupRestore(plan, null, {retry: true}), error => error.code === 'BACKUP_RESTORE_IN_PROGRESS' && !error.retryable);
    assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 1);
    gate.resolve({data: {status: 'applied'}}); await first;
    f.context.releaseBackupRestore(plan);
});

test('completed execution returns its saved result without repeating Firestore or Storage', async () => {
    const f = fixture(1, true), plan = await f.prepare();
    const first = await f.context.executeBackupRestore(plan);
    first.recordCount = 999;
    const second = await f.context.executeBackupRestore(plan, null, {retry: true});
    assert.equal(second.recordCount, 2); assert.equal(second.attachmentCount, 1);
    assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 1); assert.equal(f.uploads.length, 1);
    f.context.releaseBackupRestore(plan);
});

test('Storage uncertainty blocks generic retry and cannot upload or send records a second time', async () => {
    const f = fixture(1, true), plan = await f.prepare(); let uploadAttempts = 0;
    f.context.uploadBytes = async () => { uploadAttempts++; throw new Error('upload response lost'); };
    await assert.rejects(f.context.executeBackupRestore(plan), error => error.code === 'BACKUP_STORAGE_RETRY_BLOCKED' && !error.retryable && error.progress.mayHaveApplied);
    await assert.rejects(f.context.executeBackupRestore(plan, null, {retry: true}), error => error.code === 'BACKUP_STORAGE_RETRY_BLOCKED' && !error.retryable);
    assert.equal(uploadAttempts, 1); assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 1);
    f.context.releaseBackupRestore(plan);
});

test('logout after a lost response destroys the retry plan and cannot submit under a new identity', async () => {
    const f = fixture(), plan = await f.prepare();
    f.context.respond = async () => { throw new Error('response lost'); };
    await assert.rejects(f.context.executeBackupRestore(plan), error => error.retryable);
    f.changeUid('B');
    assert.equal(plan.records.length, 0); assert.equal(plan.file, null); assert.equal(plan.recoveryKey, '');
    await assert.rejects(f.context.executeBackupRestore(plan, null, {retry: true}), /BACKUP_PLAN_INVALID/);
    assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 1);
});

test('definite RPC rejection blocks retries while retaining prior confirmed or uncertain writes', async () => {
    for (const prior of ['none', 'confirmed', 'uncertain']) {
        const f = fixture(prior === 'confirmed' ? 401 : 1), plan = await f.prepare(); let sent = 0;
        const reject = () => { const error = new Error('private reason'); error.code = 'functions/failed-precondition'; throw error; };
        if (prior === 'uncertain') {
            f.context.respond = async () => { throw new Error('response lost'); };
            await assert.rejects(f.context.executeBackupRestore(plan), error => error.retryable);
        }
        f.context.respond = async () => { if (prior === 'confirmed' && ++sent === 1) return {data: {status: 'applied'}}; return reject(); };
        await assert.rejects(f.context.executeBackupRestore(plan, null, {retry: prior === 'uncertain'}), error => {
            assert.equal(error.retryable, false); assert.equal(error.progress.mayHaveApplied, prior !== 'none');
            assert.doesNotMatch(error.message, /private reason/); return true;
        });
        const before = f.calls.length;
        await assert.rejects(f.context.executeBackupRestore(plan, null, {retry: true}), error => !error.retryable);
        assert.equal(f.calls.length, before);
        f.context.releaseBackupRestore(plan);
    }
});

function replaceBackupEntries(f, records, attachments) {
    const entries = [...records, ...attachments];
    f.file.text = async () => [JSON.stringify({backupId: 'fixture'}), ...entries.map(JSON.stringify),
        JSON.stringify({kind: 'footer', entryCount: entries.length, recordCount: records.length, attachmentCount: attachments.length})].join('\n');
}
const blob = storagePath => ({kind: 'attachment', storagePath, content: 'QQ=='});

test('selective company and deadline restore includes nested Storage references exactly once', async () => {
    const f = fixture(), shared = 'users/A/aziende/company/shared', deadline = 'users/A/scadenze/deadline/file', other = 'users/A/other/file';
    replaceBackupEntries(f, [
        {kind: 'record', scope: 'company', id: 'company', data: {documents: [{files: [{storagePath: shared}, {storagePath: shared}]}]}},
        {kind: 'record', scope: 'deadline', id: 'deadline', data: {attachments: [{nested: {storagePath: deadline}}, {storagePath: shared}]}},
        {kind: 'record', scope: 'company', id: 'other', data: {document: {storagePath: other}}}
    ], [blob(shared), blob(deadline), blob(other)]);
    const plan = await f.prepare();
    const result = await f.context.executeBackupRestore(plan, [0, 1]);
    assert.equal(result.recordCount, 2); assert.equal(result.attachmentCount, 2);
    assert.deepEqual(f.uploads.map(args => args[0]).sort(), [shared, deadline].sort());
    assert.equal(f.calls.filter(call => call.command.mode === 'apply')[0].command.records.length, 2);
    f.context.releaseBackupRestore(plan);
});

test('cross-owner nested reference is rejected before preview or apply', async () => {
    const f = fixture();
    replaceBackupEntries(f, [{kind: 'record', scope: 'deadline', id: 'deadline', data: {attachments: [{storagePath: 'users/B/file'}]}}], []);
    await assert.rejects(f.prepare(), /BACKUP_STORAGE_PATH_INVALID/);
    assert.equal(f.calls.length, 0); assert.equal(f.uploads.length, 0);
});

test('missing selected blob fails preflight before writes and public manifest cannot bypass it', async () => {
    const f = fixture(), missing = 'users/A/missing', available = 'users/A/available';
    replaceBackupEntries(f, [
        {kind: 'record', scope: 'company', id: 'missing', data: {files: [{storagePath: missing}]}},
        {kind: 'record', scope: 'deadline', id: 'available', data: {files: [{storagePath: available}]}}
    ], [blob(available)]);
    const plan = await f.prepare(); plan.storagePaths.push(missing);
    await assert.rejects(f.context.executeBackupRestore(plan, [0]), error => error.code === 'BACKUP_ATTACHMENT_MISSING' && !error.progress.mayHaveApplied);
    assert.equal(f.calls.filter(call => call.command.mode === 'apply').length, 0);
    const result = await f.context.executeBackupRestore(plan, [1]);
    assert.equal(result.attachmentCount, 1); assert.equal(f.uploads[0][0], available);
    f.context.releaseBackupRestore(plan);
});

test('duplicate attachment paths or invalid contents fail the initial scan with no writes', async () => {
    const path = 'users/A/file';
    for (const attachments of [[blob(path), blob(path)], ...[undefined, '', 'not base64', 'Q===', 'QQ', 'QQ=Q'].map(content => [{...blob(path), content}])]) {
        const f = fixture();
        replaceBackupEntries(f, [{kind: 'record', scope: 'company', id: 'company', data: {storagePath: path}}], attachments);
        await assert.rejects(f.prepare(), /BACKUP_ATTACHMENT_(DUPLICATE|SIZE_INVALID|CONTENT_INVALID)/);
        assert.equal(f.calls.length, 0); assert.equal(f.uploads.length, 0); assert.equal(f.observers.size, 0);
    }
});

test('oversized base64 is rejected before decoding and upload count follows referenced manifest', async () => {
    const oversized = fixture(); let decoded = 0;
    oversized.context.atob = () => { decoded++; throw new Error('must not decode oversized content'); };
    oversized.context.parseBackupLine = value => { const parsed = JSON.parse(value); if (parsed.kind === 'attachment') parsed.content = 'A'.repeat(Math.ceil((25 * 1024 * 1024 + 1024) / 3) * 4 + 4); return parsed; };
    replaceBackupEntries(oversized, [{kind: 'record', scope: 'company', id: 'company', data: {storagePath: 'users/A/file'}}], [blob('users/A/file')]);
    await assert.rejects(oversized.prepare(), /BACKUP_ATTACHMENT_SIZE_INVALID/);
    assert.equal(decoded, 0); assert.equal(oversized.calls.length, 0);
    const f = fixture(), referenced = 'users/A/selected', extra = 'users/A/unreferenced';
    replaceBackupEntries(f, [{kind: 'record', scope: 'company', id: 'company', data: {files: [{storagePath: referenced}]}}], [blob(referenced), blob(extra)]);
    const plan = await f.prepare(), result = await f.context.executeBackupRestore(plan);
    assert.equal(plan.counts.attachments, 2); assert.equal(result.attachmentCount, 1); assert.equal(f.uploads[0][0], referenced);
    f.context.releaseBackupRestore(plan);
});

test('nested attachment manifest remains stable through explicit Firestore retry', async () => {
    const f = fixture(), path = 'users/A/company/file';
    replaceBackupEntries(f, [{kind: 'record', scope: 'company', id: 'company', data: {files: [{storagePath: path}]}}], [blob(path)]);
    const plan = await f.prepare(); f.context.respond = async () => { throw new Error('response lost'); };
    await assert.rejects(f.context.executeBackupRestore(plan, [0]), error => error.retryable);
    assert.equal(f.uploads.length, 0);
    plan.storagePaths = [];
    f.context.respond = async () => ({data: {status: 'applied', duplicate: true}});
    const result = await f.context.executeBackupRestore(plan, [0], {retry: true});
    assert.equal(result.attachmentCount, 1); assert.equal(f.uploads[0][0], path);
    const commands = f.calls.filter(call => call.command.mode === 'apply').map(call => call.command);
    assert.equal(commands[0], commands[1]); f.context.releaseBackupRestore(plan);
});
