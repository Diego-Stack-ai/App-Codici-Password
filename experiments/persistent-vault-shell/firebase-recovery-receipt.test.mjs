import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment, assertFails} from '@firebase/rules-unit-testing';
import {doc, setDoc} from 'firebase/firestore';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, FieldValue} = require('firebase-admin/firestore');
const {HttpsError} = require('firebase-functions/v2/https');
const deps = {...require('./history-recovery-service'), ...require('./recovery-command-receipt'),
    ...require('./mutation-result-binding')};

test('recovery real transaction: concurrency, protected receipt and stale restore', async t => {
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'recovery-receipt');
    const db = getFirestore(app);
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {
        host: '127.0.0.1', port: 8085, rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8')}});
    t.after(async () => {await env.cleanup(); await db.terminate(); await deleteApp(app);});
    const source = await readFile(new URL('../../functions/index.js', import.meta.url), 'utf8');
    const helpers = source.slice(source.indexOf('function verifiedCurrentRevision('), source.indexOf('exports.applyOfflineMutation ='));
    const body = source.slice(source.indexOf('async function runRecoveryCommand('), source.indexOf('exports.purgeArchivedAccount ='));
    const handlers = new Function('exports', 'onCall', 'getFirestore', 'HttpsError', 'FieldValue', ...Object.keys(deps),
        `${helpers}\n${body}\nreturn exports;`)({}, (_options, run) => run, () => db, HttpsError, FieldValue, ...Object.values(deps));
    const uid = 'synthetic-recovery-owner';
    const record = db.doc(`users/${uid}/syncRecords/item`), trash = db.doc(`users/${uid}/trash/item`);
    const command = {expectedOwnerUid: uid, recordId: 'item', operationId: 'trash-op', expectedRevision: 3};
    const run = (action, data) => handlers[action]({auth: {uid}, data});
    await record.set({revision: 3, encryptedPayload: 'SYNTHETIC-CIPHERTEXT'});
    await t.test('concurrent exact retries produce one transition', async () => {
        const results = await Promise.all(Array.from({length: 3}, () => run('trashSyncRecord', command)));
        assert.equal(results.filter(result => result.duplicate === false).length, 1);
        assert.equal(results.filter(result => result.duplicate === true).length, 2);
        assert.equal((await record.get()).exists, false);
        assert.equal((await trash.get()).get('encryptedPayload'), 'SYNTHETIC-CIPHERTEXT');
    });
    await t.test('client cannot forge root receipt and operation cannot change identity', async () => {
        for (const context of [env.authenticatedContext(uid), env.authenticatedContext('other'), env.unauthenticatedContext()]) {
            await assertFails(setDoc(doc(context.firestore(), `mutationResults/${uid}/operations/forged`), {status: 'restored'}));
        }
        await assert.rejects(run('restoreSyncRecord', command), error => error.code === 'already-exists');
        assert.equal((await trash.get()).exists, true);
    });
    await t.test('stale restore leaves trash intact; current restore is bound and idempotent', async () => {
        const restore = {...command, operationId: 'restore-op'};
        assert.equal((await run('restoreSyncRecord', {...restore, expectedRevision: 2})).status, 'conflict');
        assert.equal((await trash.get()).exists, true);
        const results = await Promise.all([run('restoreSyncRecord', restore), run('restoreSyncRecord', restore)]);
        assert.equal(results.filter(result => result.duplicate === false).length, 1);
        assert.equal((await record.get()).get('revision'), 4);
        assert.equal((await trash.get()).exists, false);
    });
});
