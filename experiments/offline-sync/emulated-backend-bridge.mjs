import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

export async function createEmulatedBackendBridge() {
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
    const require = createRequire(new URL('../../functions/package.json', import.meta.url));
    const {applyOfflineMutation} = require('./index.js');
    const {getFirestore} = require('firebase-admin/firestore');
    const {getApps, deleteApp} = require('firebase-admin/app');
    const db = getFirestore(), uid = `browser-emulated-${crypto.randomUUID()}`;
    const record = db.doc(`users/${uid}/syncRecords/fixture`);
    return {
        async handle(request, response) {
            if (request.url === '/fixture' && request.method === 'GET') {
                response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify({uid})); return true;
            }
            if (!['/mutation', '/snapshot'].includes(request.url)) return false;
            if (request.method !== 'POST' || request.headers.origin !== `http://${request.headers.host}`) {
                response.writeHead(403).end(); return true;
            }
            let body = '';
            for await (const chunk of request) { body += chunk; if (body.length > 50000) throw new Error('BRIDGE_BODY_LIMIT'); }
            const {operation, dropResponse} = JSON.parse(body);
            if (operation?.recordId !== 'fixture' || !/^bridge-[a-z-]+$/.test(operation.operationId || '')) throw new Error('BRIDGE_SCOPE');
            response.setHeader('Content-Type', 'application/json');
            if (request.url === '/snapshot') {
                const stored = await record.get(), receipt = await db.doc(`mutationResults/${uid}/operations/${operation.operationId}`).get();
                response.end(JSON.stringify({record: stored.data() || null, updateTime: stored.updateTime?.toMillis(), receipt: receipt.data() || null}));
                return true;
            }
            try {
                // Same original handler as production, direct invocation only. HTTP/Auth/App Check not tested here.
                const result = await applyOfflineMutation.run({auth: {uid}, data: operation});
                response.writeHead(dropResponse ? 503 : 200).end(JSON.stringify(dropResponse ? {code: 'RESPONSE_LOST'} : result));
            } catch (error) {
                response.writeHead(400).end(JSON.stringify({code: error.code || 'HANDLER_ERROR', details: error.details}));
            }
            return true;
        },
        async close() { for (const app of getApps()) { await getFirestore(app).terminate(); await deleteApp(app); } }
    };
}
