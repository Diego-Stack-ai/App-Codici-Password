import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {initializeTestEnvironment, assertFails} from '@firebase/rules-unit-testing';
import {doc, getDoc, setDoc} from 'firebase/firestore';

assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
const require = createRequire(new URL('../../functions/package.json', import.meta.url));
const {initializeApp, deleteApp} = require('firebase-admin/app');
const {getFirestore} = require('firebase-admin/firestore');
const ledger = require('./recipient-delivery-ledger');

test('recipient ledger: real Firestore claims, isolated retries, retention and client denial', async t => {
    const app = initializeApp({projectId: 'demo-vault-shell'}, 'recipient-ledger-test');
    const db = getFirestore(app);
    const env = await initializeTestEnvironment({projectId: 'demo-vault-shell', firestore: {
        host: '127.0.0.1', port: 8085, rules: await readFile(new URL('../../firestore.rules', import.meta.url), 'utf8')}});
    t.after(async () => {await env.cleanup(); await db.terminate(); await deleteApp(app);});
    const identity = {ownerUid: 'ledger-owner', deadlineId: 'fixture', dueDate: '2026-10-10',
        recipient: 'synthetic@example.invalid', channel: 'email'};
    let now = Date.parse('2026-09-27T08:00:00Z'), sends = 0;
    const invoke = patch => ledger.deliver({db, identity, eligible: async () => true,
        send: async () => {sends++;}, now: () => now, ...patch});
    await t.test('overlapping calls commit only one external-send authorization', async () => {
        const results = await Promise.all([invoke(), invoke(), invoke()]);
        assert.equal(sends, 1);
        assert.deepEqual(results.map(value => value.status).sort(), ['sent', 'skipped', 'skipped']);
    });
    await t.test('failed recipient retries independently from the successful one', async () => {
        const second = {...identity, recipient: 'second@example.invalid'};
        await assert.rejects(invoke({identity: second, send: async () => {throw Error('synthetic');}}));
        assert.equal((await invoke({identity: second})).status, 'sent');
        assert.equal((await invoke()).status, 'skipped');
        assert.equal(sends, 2);
    });
    await t.test('owner, other user and anonymous cannot read or forge delivery records', async () => {
        const id = ledger.deliveryId(identity), path = `${ledger.COLLECTION}/${id}`;
        for (const context of [env.authenticatedContext(identity.ownerUid), env.authenticatedContext('other'), env.unauthenticatedContext()]) {
            await assertFails(getDoc(doc(context.firestore(), path)));
            await assertFails(setDoc(doc(context.firestore(), path), {state: 'sent'}));
        }
        const snap = await db.doc(path).get();
        assert.deepEqual(Object.keys(snap.data()).sort(), ['expiresAt', 'finishedAt', 'lastSentAt', 'state']);
    });
    await t.test('expired delivery records are removed from the emulator', async () => {
        now += ledger.RETENTION_MS + 1;
        assert.equal(await ledger.cleanup(db, () => now), 2);
        assert.equal((await db.collection(ledger.COLLECTION).get()).size, 0);
    });
});
