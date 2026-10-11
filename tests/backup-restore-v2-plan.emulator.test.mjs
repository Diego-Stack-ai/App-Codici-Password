import {after, before, beforeEach, test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment} from '@firebase/rules-unit-testing';

const PROJECT_ID = 'codici-password-m8-v2-plan';
const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = requireFunctions('firebase-admin/app');
const {getFirestore} = requireFunctions('firebase-admin/firestore');
const {createBackupRestoreV2Runtime} = requireFunctions('./backup-restore-v2-runtime.js');
const {createBackupRestoreBinding} = requireFunctions('./backup-restore-receipt.js');
const {validateRestoreChunk} = requireFunctions('./backup-restore-service.js');

const uid = 'synthetic-m8-v2-owner';
const command = {expectedOwnerUid: uid, operationId: 'restore:synthetic:plan:0', backupId: 'synthetic-backup',
    chunkIndex: 0, chunkCount: 1, mode: 'apply', overwriteExisting: false, confirmation: 'RESTORE_VALIDATED',
    records: [{scope: 'private-account', id: 'one', data: {name: 'synthetic-ciphertext'},
        expectedVersion: {exists: false}}]};
const app = initializeApp({projectId: PROJECT_ID}, `m8-v2-plan-${process.pid}`);
const db = getFirestore(app);
let testEnv;

before(async () => {
    testEnv = await initializeTestEnvironment({projectId: PROJECT_ID,
        firestore: {rules: await readFile(new URL('../firestore.rules', import.meta.url), 'utf8')}});
});
beforeEach(async () => testEnv.clearFirestore());
after(async () => { await deleteApp(app); await testEnv.cleanup(); });

test('M8 V2 persists only its manifest and resumes from an attested receipt', async () => {
    let now = 1000;
    const runtime = createBackupRestoreV2Runtime({db, now: () => now});
    const created = await runtime.create(uid, [command]);
    const plans = await db.collection(`backupRestorePlans/${uid}/plans`).get();
    assert.equal(plans.size, 1);
    const stored = plans.docs[0].data();
    assert.equal(JSON.stringify(stored).includes('synthetic-ciphertext'), false);
    const rebuilt = await runtime.reconstruct(uid, created.planId, command.backupId, command.records);
    assert.deepEqual(rebuilt.inputs, [command]);
    const validated = validateRestoreChunk(command, uid);
    await db.doc(`mutationResults/${uid}/operations/${command.operationId}`).set({
        status: 'applied', duplicate: false, recordCount: 1,
        ...createBackupRestoreBinding({uid, command: validated})
    });
    assert.deepEqual(await runtime.inspect(uid, created.planId, [command]),
        {chunks: [{operationId: command.operationId, status: 'confirmed'}]});
    now = created.expiresAtMs;
    assert.deepEqual(await runtime.removeExpired(uid, created.planId), {status: 'removed'});
    assert.equal((await db.collection(`backupRestorePlans/${uid}/plans`).get()).empty, true);
});
