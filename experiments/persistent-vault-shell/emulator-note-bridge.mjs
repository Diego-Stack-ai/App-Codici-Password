import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

export function createEmulatorNoteBridge(uids) {
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
    const require = createRequire(new URL('../../functions/package.json', import.meta.url));
    const {applyPrivateAccountMutation} = require('./index.js');
    const {getAuth} = require('firebase-admin/auth');
    const owners = new Set(uids);
    return async (request, response) => {
        if (request.url !== '/demo-vault-shell/europe-west1/applyPrivateAccountMutation') return false;
        response.setHeader('Content-Type', 'application/json');
        const deny = () => { response.writeHead(401).end(JSON.stringify({error: {status: 'UNAUTHENTICATED', message: 'Laboratory request rejected'}})); return true; };
        if (request.method !== 'POST' || request.headers.host !== '127.0.0.1:4188' || request.headers.origin !== 'http://127.0.0.1:4188' ||
            request.headers['x-firebase-appcheck'] !== 'synthetic-app-check') return deny();
        let identity;
        try {
            const bearer = request.headers.authorization || '';
            if (!bearer.startsWith('Bearer ')) return deny();
            identity = await getAuth().verifyIdToken(bearer.slice(7));
            if (!owners.has(identity.uid)) return deny();
        } catch { return deny(); }
        try {
            let body = '';
            for await (const chunk of request) {
                body += chunk;
                if (Buffer.byteLength(body) > 400000) throw new Error('BODY_LIMIT');
            }
            const {data} = JSON.parse(body);
            if (data?.uid !== identity.uid || data?.recordId !== 'alfa') throw new Error('DEMO_SCOPE');
            const result = await applyPrivateAccountMutation.run({auth: identity, data});
            response.end(JSON.stringify({result}));
        } catch (error) {
            response.writeHead(400).end(JSON.stringify({error: {status: (error.code || 'invalid-argument').toUpperCase().replaceAll('-', '_'),
                message: 'Laboratory mutation rejected', details: error.details}}));
        }
        return true;
    };
}
