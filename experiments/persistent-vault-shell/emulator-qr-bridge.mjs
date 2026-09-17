import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createPrivateQrSelectionHandler} from './qr-selection-handler.mjs';
import {createCompanyQrSelectionHandler} from './company-qr-selection-handler.mjs';
import {createProfileTextHandler} from './profile-text-handler.mjs';
import {createAccountNoteHandler} from './account-note-handler.mjs';
import {createProfileLinkHandler} from './profile-link-handler.mjs';
import {createProfileAccountCreateHandler} from './profile-account-create-handler.mjs';
import {createProfileContactsHandler} from './profile-contacts-handler.mjs';
import {createCompanyContactsHandler} from './company-contacts-handler.mjs';
import {createPrivateAddressesHandler} from './private-addresses-handler.mjs';
import {createPrivateUtilitiesHandler} from './private-utilities-handler.mjs';
import {createCompanyAddressesHandler} from './company-addresses-handler.mjs';
import {createPrivateDocumentsHandler} from './private-documents-handler.mjs';
import {readFile} from 'node:fs/promises';

export async function createEmulatorQrBridge(uids) {
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
    const models = {};
    for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js']) {
        Object.assign(models, await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
    }
    const handlers = new Map([
        ['/demo-vault-shell/europe-west1/applyPrivateQrSelection', createPrivateQrSelectionHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyCompanyQrSelection', createCompanyQrSelectionHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyProfileTextMutation', createProfileTextHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyAccountNoteMutation', createAccountNoteHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyProfileLinkMutation', createProfileLinkHandler({...dependencies, models, deleteField: () => FieldValue.delete()})],
        ['/demo-vault-shell/europe-west1/applyProfileAccountCreate', createProfileAccountCreateHandler({...dependencies, models, deleteField: () => FieldValue.delete()})],
        ['/demo-vault-shell/europe-west1/applyProfileContactsMutation', createProfileContactsHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyCompanyContactsMutation', createCompanyContactsHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyPrivateAddressesMutation', createPrivateAddressesHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyPrivateUtilitiesMutation', createPrivateUtilitiesHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyCompanyAddressesMutation', createCompanyAddressesHandler(dependencies)]
        ,['/demo-vault-shell/europe-west1/applyPrivateDocumentsMutation', createPrivateDocumentsHandler(dependencies)]
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
