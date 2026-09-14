import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const bufferSource = await readFile(new URL('../Frontend/public/assets/js/modules/settings/backup-export-buffer.js', import.meta.url), 'utf8');
const {createBackupExportBuffer, createBackupRecordBuffer} = await import(`data:text/javascript;base64,${Buffer.from(bufferSource).toString('base64')}`);
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/settings/backup-export-service.js', import.meta.url), 'utf8'))
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '').replace(/export /g, '');

function fixture(stopAt) {
    const events = new EventTarget(), observers = new Set(), writes = [];
    let aborted = 0, closed = 0, encrypted = 0;
    const stop = phase => { if (phase === stopAt) events.dispatchEvent(new Event('vault-session-locked')); };
    const writable = {write: async value => { writes.push(value); stop('write'); }, close: async () => { closed++; stop('close'); }, abort: async () => { aborted++; }};
    const context = {
        auth: {currentUser: {uid: 'A'}}, navigator: {onLine: true}, createBackupExportBuffer, createBackupRecordBuffer,
        onAuthStateChanged: (_auth, fn) => { observers.add(fn); return () => observers.delete(fn); },
        addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
        window: {showSaveFilePicker: async () => { stop('picker'); return {createWritable: async () => { stop('writable'); return writable; }}; }},
        generateRecoveryKey: () => 'synthetic-key', createBackupHeader: () => ({header: true}),
        deriveBackupKey: async () => { stop('derive'); return {}; },
        serializeBackupLine: JSON.stringify,
        encryptBackupEntry: async ({entry}) => { encrypted++; stop('encrypt'); return {envelope: entry, digest: 'synthetic'}; },
        getBackupProfile: async () => { stop('collect'); return {}; },
        createProfileDescriptorFromData: () => ({kind: 'profile'}), collectStoragePaths: () => ['synthetic/path'],
        storage: {}, ref: (_storage, path) => path,
        getBytes: async () => { stop('attachment'); return new Uint8Array([1]); },
        btoa: value => Buffer.from(value, 'binary').toString('base64'),
    };
    for (const name of ['listBackupCompanies', 'listBackupCompanyAccounts', 'listBackupCompanyAttachments', 'listBackupAccountWidgets', 'listBackupContacts', 'listBackupDeadlines', 'listBackupPrivateAccounts', 'listBackupPrivateAttachments', 'listBackupProfileWidgets', 'listBackupSettings', 'listBackupSharedVaultData', 'listBackupSharedVaultLinks']) context[name] = async () => [];
    vm.createContext(context); vm.runInContext(source, context);
    return {context, observers, writes, stats: () => ({aborted, closed, encrypted})};
}

for (const phase of ['picker', 'writable', 'derive', 'write', 'collect', 'encrypt', 'attachment', 'close']) {
    test(`lock during ${phase} rejects export without returning a Recovery Key`, async () => {
        const f = fixture(phase);
        await assert.rejects(f.context.exportOwnerBackup('A'), {code: 'BACKUP_SESSION_INVALIDATED'});
        assert.equal(f.observers.size, 0);
        if (['picker', 'writable', 'derive'].includes(phase)) assert.equal(f.writes.length, 0);
        if (phase !== 'picker') assert.equal(f.stats().aborted, 1);
        if (phase !== 'close') assert.equal(f.stats().closed, 0);
        if (phase === 'encrypt') assert.equal(f.writes.length, 1, 'only header precedes invalidated encryption');
        if (phase === 'attachment') assert.equal(f.writes.length, 2, 'invalidated attachment and footer are never written');
    });
}

test('valid export closes once and releases lifecycle listeners', async () => {
    const f = fixture(); const result = await f.context.exportOwnerBackup('A');
    assert.equal(result.recoveryKey, 'synthetic-key'); assert.equal(result.recordCount, 1); assert.equal(result.attachmentCount, 1);
    assert.equal(f.writes.length, 4); assert.equal(f.stats().closed, 1); assert.equal(f.stats().aborted, 0); assert.equal(f.observers.size, 0);
});

test('wrong owner is rejected before opening any file', async () => {
    const f = fixture(); f.context.window.showSaveFilePicker = () => { assert.fail('unexpected picker'); };
    await assert.rejects(f.context.exportOwnerBackup('B'), {code: 'BACKUP_SESSION_INVALIDATED'});
});

test('provider failure does not disclose provider details', async () => {
    const f = fixture(); f.context.deriveBackupKey = async () => { throw new Error('sensitive provider detail'); };
    await assert.rejects(f.context.exportOwnerBackup('A'), {message: 'BACKUP_EXPORT_FAILED', code: 'BACKUP_EXPORT_FAILED'});
    assert.equal(f.observers.size, 0);
});

test('buffer admits exact cumulative boundary and can only release one complete Blob', async () => {
    const buffer = createBackupExportBuffer(8); buffer.append('abc'); buffer.append('defgh');
    const blob = buffer.takeBlob(); assert.equal(await blob.text(), 'abcdefgh');
    assert.equal(blob.type, 'application/x-codici-password-backup');
    assert.throws(() => buffer.takeBlob(), /BACKUP_BUFFER_CLOSED/);
    assert.throws(() => buffer.append('x'), /BACKUP_BUFFER_CLOSED/);
});

test('overflow discards the partial buffer and prevents a truncated download', () => {
    const buffer = createBackupExportBuffer(8); buffer.append('abc');
    assert.throws(() => buffer.append('defghi'), {code: 'BACKUP_EXPORT_CAPACITY_EXCEEDED'});
    assert.throws(() => buffer.takeBlob(), /BACKUP_BUFFER_CLOSED/);
    buffer.clear(); assert.throws(() => buffer.append('x'), /BACKUP_BUFFER_CLOSED/);
});

test('fallback capacity failure creates no URL or download and retains its safe error code', async () => {
    const f = fixture(); delete f.context.window.showSaveFilePicker;
    f.context.createBackupExportBuffer = () => createBackupExportBuffer(20);
    f.context.URL = {createObjectURL: () => assert.fail('partial download')};
    await assert.rejects(f.context.exportOwnerBackup('A'), {code: 'BACKUP_EXPORT_CAPACITY_EXCEEDED'});
    assert.equal(f.observers.size, 0);
});

test('fallback success downloads the same complete line sequence', async () => {
    const f = fixture(); delete f.context.window.showSaveFilePicker;
    let blob, clicks = 0, revoke;
    f.context.URL = {createObjectURL: value => { blob = value; return 'blob:synthetic'; }, revokeObjectURL: value => { revoke = value; }};
    f.context.document = {createElement: () => ({click() { clicks++; }})};
    f.context.setTimeout = callback => callback();
    const result = await f.context.exportOwnerBackup('A');
    assert.equal(result.streamed, false); assert.equal(clicks, 1); assert.equal(revoke, 'blob:synthetic');
    assert.match(await blob.text(), /footer/); assert.equal(f.observers.size, 0);
});

test('record buffer enforces count before accepting the next record and clears partial state', () => {
    const buffer = createBackupRecordBuffer({maxRecords: 2});
    buffer.append({id: 1}); buffer.append({id: 2});
    assert.throws(() => buffer.append({id: 3}), {code: 'BACKUP_EXPORT_RECORD_CAPACITY_EXCEEDED'});
    assert.throws(() => buffer.takeRecords(), /BACKUP_BUFFER_CLOSED/);
});

test('record character budget admits exact sum and rejects the next cumulative character', () => {
    const record = {id: 'synthetic'}, size = JSON.stringify(record).length;
    const exact = createBackupRecordBuffer({maxCharacters: 2 * size});
    exact.append(record); exact.append(record); assert.equal(exact.takeRecords().length, 2);
    const short = createBackupRecordBuffer({maxCharacters: 2 * size - 1});
    short.append(record); assert.throws(() => short.append(record), {code: 'BACKUP_EXPORT_RECORD_CAPACITY_EXCEEDED'});
});

test('collection overflow prevents downstream company reads and any encrypted record write', async () => {
    const f = fixture();
    f.context.createBackupRecordBuffer = () => createBackupRecordBuffer({maxRecords: 1});
    f.context.listBackupCompanies = async () => [{id: 'company'}];
    f.context.createRecordDescriptorFromData = (_scope, value) => ({kind: 'record', ...value});
    f.context.listBackupCompanyAccounts = () => assert.fail('read after capacity exceeded');
    await assert.rejects(f.context.exportOwnerBackup('A'), {code: 'BACKUP_EXPORT_RECORD_CAPACITY_EXCEEDED'});
    assert.equal(f.writes.length, 1); assert.equal(f.stats().encrypted, 0); assert.equal(f.stats().aborted, 1);
});
