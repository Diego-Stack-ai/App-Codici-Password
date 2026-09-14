import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const source = (await readFile(new URL('../Frontend/public/assets/js/modules/settings/backup-export-service.js', import.meta.url), 'utf8'))
    .replace(/import\s+[\s\S]*?from\s+['"][^'"]+['"];?/g, '').replace(/export /g, '');

function fixture(stopAt) {
    const events = new EventTarget(), observers = new Set(), writes = [];
    let aborted = 0, closed = 0, encrypted = 0;
    const stop = phase => { if (phase === stopAt) events.dispatchEvent(new Event('vault-session-locked')); };
    const writable = {write: async value => { writes.push(value); stop('write'); }, close: async () => { closed++; stop('close'); }, abort: async () => { aborted++; }};
    const context = {
        auth: {currentUser: {uid: 'A'}}, navigator: {onLine: true},
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
