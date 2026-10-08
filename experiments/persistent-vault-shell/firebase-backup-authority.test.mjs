import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment, assertFails, assertSucceeds} from '@firebase/rules-unit-testing';
import {doc, getDoc} from 'firebase/firestore';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore, Timestamp, FieldValue} = require('firebase-admin/firestore');
const {HttpsError} = require('firebase-functions/v2/https');
const deps = {...require('./backup-restore-service'), ...require('./backup-restore-preview'),
    ...require('./backup-restore-receipt'), ...require('./backup-restore-authority')};

test('real restore transaction and Rules preserve current authority, never backup recipients', async t => {
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'backup-authority');
    const db = getFirestore(app);
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {
        host: '127.0.0.1', port: 8085, rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8')}});
    t.after(async () => {await env.cleanup(); await db.terminate(); await deleteApp(app);});
    const source = await readFile(new URL('../../functions/index.js', import.meta.url), 'utf8');
    const body = source.slice(source.indexOf('exports.restoreBackupChunk ='), source.indexOf('exports.getAppPresentation ='));
    const invoke = new Function('exports', 'onCall', 'getFirestore', 'HttpsError', 'Timestamp', 'FieldValue',
        ...Object.keys(deps), `${body}\nreturn exports.restoreBackupChunk;`)({}, (_options, run) => run, () => db,
        HttpsError, Timestamp, FieldValue, ...Object.values(deps));
    for (const scope of ['private-account', 'company-account']) {
        await t.test(scope, async () => {
            const path = scope === 'private-account' ? 'users/restore-owner/accounts/a' : 'users/restore-owner/aziende/c/accounts/a';
            const stale = {password: 'synthetic-backup-cipher', visibility: 'shared', sharedWithUids: ['old-guest'],
                sharedWith: {old: {uid: 'old-guest', status: 'accepted'}}, sharingCycle: 2, acceptedCount: 1};
            const command = {expectedOwnerUid: 'restore-owner', operationId: `restore:${scope}`, backupId: 'synthetic',
                chunkIndex: 0, chunkCount: 1, mode: 'apply', confirmation: 'RESTORE_VALIDATED',
                records: [{scope, id: 'a', companyId: 'c', data: stale, expectedVersion: {exists: false}}]};
            const run = data => invoke({auth: {uid: 'restore-owner'}, data});
            assert.equal((await run(command)).status, 'applied');
            await assertFails(getDoc(doc(env.authenticatedContext('old-guest').firestore(), path)));
            assert.equal((await db.doc(path).get()).get('visibility'), 'private');
            assert.equal((await run(command)).duplicate, true);
            await db.doc(path).set({...stale, password: 'newer', sharedWithUids: ['live-guest'],
                sharedWith: {live: {uid: 'live-guest', status: 'accepted'}}, sharingCycle: 9});
            const preview = await run({...command, mode: 'preview'});
            const overwrite = {...command, operationId: `overwrite:${scope}`, overwriteExisting: true,
                confirmation: 'RESTORE_SELECTED_OVERWRITE', records: [{...command.records[0], expectedVersion: preview.entries[0].expectedVersion}]};
            assert.equal((await run(overwrite)).status, 'applied');
            await assertFails(getDoc(doc(env.authenticatedContext('old-guest').firestore(), path)));
            await assertSucceeds(getDoc(doc(env.authenticatedContext('live-guest').firestore(), path)));
            const compared = await run({...command, mode: 'preview'});
            assert.equal(compared.entries[0].status, 'unchanged');
            await db.doc(path).update({password: 'concurrent-update'});
            assert.equal((await run({...overwrite, operationId: `stale:${scope}`})).status, 'stale-preview');
            assert.equal((await db.doc(path).get()).get('password'), 'concurrent-update');
            await db.doc(path).update({isArchived: true});
            const archivedPreview = await run({...command, mode: 'preview'});
            assert.equal((await run({...overwrite, operationId: `archived:${scope}`,
                records: [{...command.records[0], expectedVersion: archivedPreview.entries[0].expectedVersion}]})).status, 'applied');
            await assertFails(getDoc(doc(env.authenticatedContext('live-guest').firestore(), path)));
            assert.deepEqual((await db.doc(path).get()).get('sharedWithUids'), []);
        });
    }
});
