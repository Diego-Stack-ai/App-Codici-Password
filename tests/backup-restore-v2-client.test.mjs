import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {readFile} from 'node:fs/promises';

async function loadClient() {
    const source = await readFile('Frontend/public/assets/js/modules/settings/backup-restore-v2-client.js', 'utf8');
    const result = await build({stdin: {contents: source, loader: 'js'}, bundle: true,
        format: 'esm', platform: 'browser', write: false});
    return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
}

test('M8 V2 client integration is code-enabled and builds closed requests', async () => {
    const {clearBackupRestoreV2Locator, confirmedBackupRestoreV2Prefix, createBackupRestoreV2PlanRequest,
        inspectBackupRestoreV2PlanRequest, isBackupRestoreV2Enabled, loadBackupRestoreV2Locator,
        reconstructBackupRestoreV2PlanRequest, reconstructedBackupRestoreV2Commands,
        retainBackupRestoreV2Locator} = await loadClient();
    const commands = Object.freeze([{operationId: 'restore:synthetic:0'}]);
    assert.equal(isBackupRestoreV2Enabled(), true);
    assert.deepEqual(createBackupRestoreV2PlanRequest('synthetic-owner', commands), {
        expectedOwnerUid: 'synthetic-owner', action: 'create', inputs: commands
    });
    assert.throws(() => createBackupRestoreV2PlanRequest('../owner', commands),
        /BACKUP_RESTORE_V2_INVALID_OWNER/);
    assert.throws(() => createBackupRestoreV2PlanRequest('synthetic-owner', []),
        /BACKUP_RESTORE_V2_PLAN_INVALID/);
    const inspect = inspectBackupRestoreV2PlanRequest('synthetic-owner', 'plan-one', commands);
    assert.equal(inspect.action, 'inspect');
    assert.equal(confirmedBackupRestoreV2Prefix({chunks: [
        {operationId: 'restore:synthetic:0', status: 'confirmed'}
    ]}, commands), 1);
    assert.throws(() => confirmedBackupRestoreV2Prefix({chunks: [
        {operationId: 'different', status: 'confirmed'}
    ]}, commands), /BACKUP_RESTORE_V2_INSPECTION_INVALID/);
    const values = new Map();
    const storage = {setItem: (key, value) => values.set(key, value), getItem: key => values.get(key),
        removeItem: key => values.delete(key)};
    retainBackupRestoreV2Locator(storage, 'synthetic-owner', 'backup-one',
        {planId: 'plan-one', expiresAtMs: 5000});
    assert.deepEqual(loadBackupRestoreV2Locator(storage, 'synthetic-owner', 1000), {
        uid: 'synthetic-owner', backupId: 'backup-one', planId: 'plan-one', expiresAtMs: 5000
    });
    assert.equal(loadBackupRestoreV2Locator(storage, 'synthetic-owner', 5000), null);
    assert.equal(JSON.stringify([...values.values()]).includes('restore:synthetic:0'), false);
    clearBackupRestoreV2Locator(storage, 'synthetic-owner', 'other-plan');
    assert.equal(values.size, 1);
    clearBackupRestoreV2Locator(storage, 'synthetic-owner', 'plan-one');
    assert.equal(values.size, 0);
    const reconstruct = reconstructBackupRestoreV2PlanRequest('synthetic-owner', 'plan-one', 'backup-one',
        [{scope: 'private-account', id: 'one', data: {ciphertext: 'synthetic'}}]);
    assert.equal(reconstruct.action, 'reconstruct');
    assert.equal(reconstructedBackupRestoreV2Commands({inputs: commands, expiresAtMs: 5000}), commands);
    assert.throws(() => reconstructedBackupRestoreV2Commands({inputs: []}),
        /BACKUP_RESTORE_V2_RECONSTRUCTION_INVALID/);
});
