import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

export async function createEmulatedBackendBridge({privateAccounts = false} = {}) {
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
    const require = createRequire(new URL('../../functions/package.json', import.meta.url));
    const {applyOfflineMutation, applyPrivateAccountMutation} = require('./index.js');
    const {getFirestore} = require('firebase-admin/firestore');
    const {getApps, deleteApp} = require('firebase-admin/app');
    const {getAuth} = require('firebase-admin/auth');
    const db = getFirestore(), uid = `browser-emulated-${crypto.randomUUID()}`;
    const record = db.doc(`users/${uid}/${privateAccounts ? 'accounts' : 'syncRecords'}/fixture`);
    const profile = db.doc(`users/${uid}`), company = db.doc(`users/${uid}/aziende/fixture-company`);
    if (privateAccounts) await profile.set({});
    const email = `${uid}@example.invalid`, password = 'Synthetic-emulator-login!123';
    await getAuth().createUser({uid, email, password});
    const callablePath = `/demo-vault-shell/europe-west1/${privateAccounts ? 'applyPrivateAccountMutation' : 'applyOfflineMutation'}`;
    let heldReply, delayed = false;
    return {
        async handle(request, response) {
            if (request.url === '/fixture' && request.method === 'GET') {
                response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({uid, privateAccounts, email, password})); return true;
            }
            const callableRequest = request.url === callablePath;
            if (!callableRequest && !['/mutation', '/snapshot', '/release-sdk', ...(privateAccounts ? ['/scope'] : [])].includes(request.url)) return false;
            if (request.method !== 'POST' || request.headers.origin !== `http://${request.headers.host}`) {
                response.writeHead(403).end(); return true;
            }
            let body = '';
            for await (const chunk of request) { body += chunk; if (body.length > 50000) throw new Error('BRIDGE_BODY_LIMIT'); }
            const parsed = JSON.parse(body);
            const {dropResponse, scope} = parsed;
            const operation = callableRequest ? parsed.data : parsed.operation;
            if (operation?.recordId !== 'fixture' || !/^bridge-[a-z-]+$/.test(operation.operationId || '')) throw new Error('BRIDGE_SCOPE');
            response.setHeader('Content-Type', 'application/json');
            if (request.url === '/release-sdk') {
                heldReply?.(); heldReply = null; response.end('{}'); return true;
            }
            if (callableRequest) {
                // Real Auth emulator JWT; synthetic App Check header only. This
                // bridge does NOT certify the remote onCall/App Check middleware.
                let identity;
                try {
                    if (request.headers['x-firebase-appcheck'] !== 'synthetic-app-check') throw new Error('APP_CHECK');
                    const authorization = request.headers.authorization || '';
                    if (!authorization.startsWith('Bearer ')) throw new Error('AUTH');
                    identity = await getAuth().verifyIdToken(authorization.slice(7));
                    if (identity.uid !== uid) throw new Error('OWNER');
                } catch {
                    response.writeHead(401).end(JSON.stringify({error: {status: 'UNAUTHENTICATED', message: 'Synthetic transport rejected'}})); return true;
                }
                try {
                    const result = await (privateAccounts ? applyPrivateAccountMutation : applyOfflineMutation).run({auth: identity, data: operation});
                    if (operation.operationId === 'bridge-sdk-late' && !delayed) {
                        delayed = true; heldReply = () => response.end(JSON.stringify({result})); return true;
                    }
                    response.end(JSON.stringify({result}));
                } catch (error) {
                    response.writeHead(400).end(JSON.stringify({error: {status: (error.code || 'internal').toUpperCase().replaceAll('-', '_'), message: 'Synthetic handler rejected', details: error.details}}));
                }
                return true;
            }
            if (request.url === '/scope') {
                if (!['none', 'profile', 'company'].includes(scope)) throw new Error('BRIDGE_SCOPE_PRESET');
                await profile.set(scope === 'profile' ? {contactPhones: [{value: '', linkedAccountId: 'fixture'}]} : {});
                await company.set(scope === 'company' ? {isArchived: true, emails: {extra: [{value: '', linkedAccountId: 'fixture'}]}} : {});
                response.end('{}'); return true;
            }
            if (request.url === '/snapshot') {
                const stored = await record.get(), receipt = await db.doc(`mutationResults/${uid}/operations/${operation.operationId}`).get();
                response.end(JSON.stringify({record: stored.data() || null, updateTime: stored.updateTime?.toMillis(), receipt: receipt.data() || null}));
                return true;
            }
            try {
                // Same original handler as production, direct invocation only. HTTP/Auth/App Check not tested here.
                const result = await (privateAccounts ? applyPrivateAccountMutation : applyOfflineMutation).run({auth: {uid}, data: operation});
                response.writeHead(dropResponse ? 503 : 200).end(JSON.stringify(dropResponse ? {code: 'RESPONSE_LOST'} : result));
            } catch (error) {
                response.writeHead(400).end(JSON.stringify({code: error.code || 'HANDLER_ERROR', details: error.details}));
            }
            return true;
        },
        async close() { heldReply?.(); for (const app of getApps()) { await getFirestore(app).terminate(); await deleteApp(app); } }
    };
}
