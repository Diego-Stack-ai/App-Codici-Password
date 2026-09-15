import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createPrivateQrSelectionHandler} from './qr-selection-handler.mjs';
import {createCompanyQrSelectionHandler} from './company-qr-selection-handler.mjs';

export function createEmulatorQrBridge(uids) {
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
    const require = createRequire(new URL('../../functions/package.json', import.meta.url));
    const {getAuth} = require('firebase-admin/auth'), {getFirestore, FieldValue} = require('firebase-admin/firestore');
    const {getApps, initializeApp} = require('firebase-admin/app');
    const app = getApps().find(item => item.name === '[DEFAULT]') || initializeApp({projectId: 'demo-vault-shell'});
    const owners = new Set(uids), dependencies = {db: getFirestore(app),
        hash: value => createHash('sha256').update(value).digest('hex'), timestamp: () => FieldValue.serverTimestamp()};
    const handlers = new Map([
        ['/demo-vault-shell/europe-west1/applyPrivateQrSelection', createPrivateQrSelectionHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyCompanyQrSelection', createCompanyQrSelectionHandler(dependencies)]
    ]);
    return async (request, response) => {
        const run = handlers.get(request.url); if (!run) return false;
        response.setHeader('Content-Type', 'application/json'); response.setHeader('Cache-Control', 'no-store');
        const deny = () => {response.writeHead(401).end(JSON.stringify({error: {status: 'UNAUTHENTICATED', message: 'Laboratory request rejected'}})); return true;};
        if (request.method !== 'POST' || request.headers.host !== '127.0.0.1:4188' || request.headers.origin !== 'http://127.0.0.1:4188' ||
            request.headers['x-firebase-appcheck'] !== 'synthetic-app-check') return deny();
        let identity;
        try {
            const bearer = request.headers.authorization || '';
            if (!bearer.startsWith('Bearer ')) return deny();
            identity = await getAuth(app).verifyIdToken(bearer.slice(7), true);
            if (!owners.has(identity.uid)) return deny();
        } catch {return deny();}
        try {
            let body = ''; for await (const chunk of request) {body += chunk; if (Buffer.byteLength(body) > 200000) throw Error('BODY_LIMIT');}
            const payload = JSON.parse(body);
            if (!payload || Object.keys(payload).some(key => key !== 'data')) throw Error('INVALID_BODY');
            // Synthetic attestation is confined to this exact demo origin and
            // fixture UID allowlist. It never proves production App Check.
            const result = await run(payload.data, {auth: identity, app: {appId: 'synthetic-vault-laboratory'}});
            response.end(JSON.stringify({result}));
        } catch {response.writeHead(400).end(JSON.stringify({error: {status: 'INVALID_ARGUMENT', message: 'Laboratory selection rejected'}}));}
        return true;
    };
}
