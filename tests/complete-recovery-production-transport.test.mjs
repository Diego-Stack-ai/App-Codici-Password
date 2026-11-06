import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {once} from 'node:events';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import {initializeApp, deleteApp} from 'firebase/app';
import {getFunctions, connectFunctionsEmulator, httpsCallable} from 'firebase/functions';

const requireFunctions = createRequire(new URL('../functions/package.json', import.meta.url));
const {HttpsError} = requireFunctions('firebase-functions/v2/https');
const {createProductionRecoveryCallables} = requireFunctions('./full-recovery-production.js');
const {RECOVERY_TARGET} = requireFunctions('./full-recovery-policy.js');

test('real Firebase client wire preserves typed production errors through the actual recovery transport', {timeout: 20000}, async () => {
    const uid = 'qa-recovery-transport', now = Date.now(), requests = [], timeoutOptions = [];
    let stale = false, sdkTouches = 0;
    const unavailableSdk = () => { sdkTouches++; throw new Error('must not construct SDK for a disabled cohort'); };
    const handlers = createProductionRecoveryCallables({onCall: (_options, handler) => handler, HttpsError,
        getFirestore: unavailableSdk, getStorage: unavailableSdk, Timestamp: class {}, FieldValue: {serverTimestamp() {}}, clock: () => now});
    const server = createServer(async (incoming, outgoing) => {
        const chunks = [];
        try {
            for await (const chunk of incoming) chunks.push(chunk);
            const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
            const name = incoming.url.split('/').at(-1);
            requests.push({name, owner: body.data?.content?.ownerUid || body.data?.expectedOwnerUid});
            const request = {data: body.data, app: {appId: RECOVERY_TARGET.appId}, auth: {uid, token: {
                email: 'codex.recovery.transport@example.invalid', email_verified: true,
                auth_time: Math.floor(now / 1000) - (stale ? 301 : 0), firebase: {sign_in_provider: 'password'}}}};
            const data = await handlers[name](request);
            outgoing.writeHead(200, {'content-type': 'application/json'}); outgoing.end(JSON.stringify({data}));
        } catch (error) {
            assert.equal(error instanceof HttpsError, true);
            outgoing.writeHead(error.httpErrorCode.status, {'content-type': 'application/json'});
            outgoing.end(JSON.stringify({error: error.toJSON()}));
        }
    });
    server.listen(0, '127.0.0.1'); await once(server, 'listening');
    const app = initializeApp({projectId: 'demo-recovery-transport', apiKey: 'synthetic-unused-api-key', appId: 'synthetic-test'}, `transport-${process.pid}`);
    try {
        const functions = getFunctions(app, 'europe-west1'); connectFunctionsEmulator(functions, '127.0.0.1', server.address().port);
        const source = await readFile(new URL('../Frontend/public/assets/js/modules/settings/complete-recovery-entry.js', import.meta.url), 'utf8');
        const begin = source.indexOf('function transport('), end = source.indexOf('export async function discoverCompleteRecoveryOperation', begin);
        assert.ok(begin >= 0 && end > begin);
        const transport = vm.runInNewContext(`${source.slice(begin, end)}\ntransport`, {functions, auth: {currentUser: {uid}},
            httpsCallable: (instance, name, options) => { timeoutOptions.push(options.timeout); return httpsCallable(instance, name, options); }});
        const restore = transport('manageFullVaultRecovery', uid);
        await assert.rejects(restore({action: 'prepare', content: {ownerUid: uid}}), error => error.code === 'FULL_RECOVERY_DISABLED');
        stale = true;
        await assert.rejects(restore({action: 'prepare', content: {ownerUid: uid}}), error => error.code === 'FULL_RECOVERY_RECENT_AUTH_REQUIRED');
        const reader = transport('readRecoveryBackupAsset', uid);
        await assert.rejects(reader({action: 'inspect', expectedOwnerUid: uid}), error => error.code === 'RECOVERY_ASSET_RECENT_AUTH_REQUIRED');
        stale = false;
        await assert.rejects(reader({action: 'inspect', expectedOwnerUid: uid}), error => error.code === 'RECOVERY_ASSET_DISABLED');
        assert.equal(sdkTouches, 0);
        assert.deepEqual(timeoutOptions, [130000, 130000]);
        assert.deepEqual(requests.map(value => value.name), ['manageFullVaultRecovery', 'manageFullVaultRecovery', 'readRecoveryBackupAsset', 'readRecoveryBackupAsset']);
        assert.equal(requests.every(value => value.owner === uid), true);
    } finally {
        await deleteApp(app); server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    }
});
