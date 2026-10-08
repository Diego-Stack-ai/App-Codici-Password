import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createPrivateQrSelectionHandler} from './qr-selection-handler.mjs';
import {createCompanyQrSelectionHandler} from './company-qr-selection-handler.mjs';
import {createProfileTextHandler} from './profile-text-handler.mjs';
import {createAccountNoteHandler} from './account-note-handler.mjs';
import {createAccountWriteFenceLab} from './account-write-fence-lab.mjs';
import {createReferenceCallableDbLab} from './reference-callable-db-lab.mjs';
import {createResumePlanLab} from './restore-resume-plan-lab.mjs';
import {createRestoreChunkLab} from './restore-chunk-lab.mjs';
import {createRestoreResumeHandler} from './restore-resume-handler.mjs';
import {createRestoreAccountFenceLab} from './restore-account-fence-lab.mjs';
import {createRestoreStageLab} from './restore-stage-lab.mjs';
import {createRestoreStageHandler} from './restore-stage-handler.mjs';
import {createRestoreStageDownload} from './restore-stage-download.mjs';
import {readBoundedJsonRequest} from './bounded-json-request.mjs';
import {createAccountStandardHandler} from './account-standard-handler.mjs';
import {createBankingEditHandler} from './banking-edit-handler.mjs';
import {createBankingLifecycleHandler} from './banking-lifecycle-handler.mjs';
import {createProfileLinkHandler} from './profile-link-handler.mjs';
import {createProfileAccountCreateHandler} from './profile-account-create-handler.mjs';
import {createProfileContactsHandler} from './profile-contacts-handler.mjs';
import {createCompanyContactsHandler} from './company-contacts-handler.mjs';
import {createPrivateAddressesHandler} from './private-addresses-handler.mjs';
import {createPrivateUtilitiesHandler} from './private-utilities-handler.mjs';
import {createCompanyAddressesHandler} from './company-addresses-handler.mjs';
import {createPrivateDocumentsHandler} from './private-documents-handler.mjs';
import {readFile} from 'node:fs/promises';
import {createProfileDocumentAttachmentHandler} from './profile-document-attachments-handler.mjs';
import {createFirestoreDocumentAttachmentDb, createFirebaseDocumentAttachmentStorage} from './firebase-document-attachment-transport.mjs';
import {documentAttachmentSha256} from './profile-document-attachments-contract.mjs';
import {decodeAttachmentUpload, ATTACHMENT_WIRE_MAX_BODY} from './profile-document-attachment-wire.mjs';

export async function createEmulatorQrBridge(uids) {
    assert.equal(process.env.FIRESTORE_EMULATOR_HOST, '127.0.0.1:8085');
    assert.equal(process.env.FIREBASE_AUTH_EMULATOR_HOST, '127.0.0.1:9099');
    assert.equal(process.env.GCLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.GOOGLE_CLOUD_PROJECT, 'demo-vault-shell');
    assert.equal(process.env.METADATA_SERVER_DETECTION, 'none');
    const require = createRequire(new URL('../../functions/package.json', import.meta.url));
    const {getAuth} = require('firebase-admin/auth'), {getFirestore, FieldValue, Timestamp} = require('firebase-admin/firestore');
    const {getApps, initializeApp} = require('firebase-admin/app');
    const app = getApps().find(item => item.name === '[DEFAULT]') || initializeApp({projectId: 'demo-vault-shell'});
    const owners = new Set(uids), dependencies = {db: getFirestore(app),
        hash: value => createHash('sha256').update(value).digest('hex'), timestamp: () => FieldValue.serverTimestamp()};
    const models = {};
    dependencies.beforeAccountWrite = createAccountWriteFenceLab(dependencies.db);
    const {HttpsError} = require('firebase-functions/v2/https');
    const references = require('./reference-callables').createReferenceCallables({
        onCall: (_options, handler) => handler,
        getFirestore: () => createReferenceCallableDbLab(dependencies.db), FieldValue, HttpsError,
        requireMutationOwner: (request, field) => {
            if (typeof request.data?.[field] !== 'string' || request.data[field] !== request.auth.uid) {
                throw new HttpsError('failed-precondition', 'Laboratory owner mismatch', {reason: 'MUTATION_OWNER_MISMATCH'});
            }
        }
    });
    for (const path of ['privato/profile-model.js', 'azienda/company-profile-model.js']) {
        Object.assign(models, await import('data:text/javascript;base64,' + Buffer.from(await readFile(new URL('../../Frontend/public/assets/js/modules/' + path, import.meta.url))).toString('base64')));
    }
    const handlers = new Map([
        ['/demo-vault-shell/europe-west1/manageAccountWidget', (data, trusted) => references.manageAccountWidget({...trusted, data})],
        ['/demo-vault-shell/europe-west1/manageSharedVaultData', (data, trusted) => references.manageSharedVaultData({...trusted, data})],
        ['/demo-vault-shell/europe-west1/applyPrivateQrSelection', createPrivateQrSelectionHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyCompanyQrSelection', createCompanyQrSelectionHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyProfileTextMutation', createProfileTextHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyAccountNoteMutation', createAccountNoteHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyAccountStandardMutation', createAccountStandardHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyBankingEdit', createBankingEditHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyBankingLifecycle', createBankingLifecycleHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyProfileLinkMutation', createProfileLinkHandler({...dependencies, models, deleteField: () => FieldValue.delete()})],
        ['/demo-vault-shell/europe-west1/applyProfileAccountCreate', createProfileAccountCreateHandler({...dependencies, models, deleteField: () => FieldValue.delete()})],
        ['/demo-vault-shell/europe-west1/applyProfileContactsMutation', createProfileContactsHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyCompanyContactsMutation', createCompanyContactsHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyPrivateAddressesMutation', createPrivateAddressesHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyPrivateUtilitiesMutation', createPrivateUtilitiesHandler(dependencies)],
        ['/demo-vault-shell/europe-west1/applyCompanyAddressesMutation', createCompanyAddressesHandler(dependencies)]
        ,['/demo-vault-shell/europe-west1/applyPrivateDocumentsMutation', createPrivateDocumentsHandler(dependencies)]
    ]);
    let stageLab, stageDownload;
    const resumeOptions = {store: dependencies.db, projectId: 'demo-vault-shell'};
    const resumeHandler = createRestoreResumeHandler({plans: createResumePlanLab(resumeOptions),
        writer: createRestoreChunkLab({...resumeOptions, beforeChunkWrite: createRestoreAccountFenceLab(dependencies.db),
            types: {timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds), bytes: value => Buffer.from(value)}})});
    handlers.set('/demo-vault-shell/europe-west1/manageRestoreResume', async (data, trusted) => {
        // Without the optional verified Storage service, reject all staged input.
        if (['preview', 'cleanupExpired'].includes(data?.action)) return resumeHandler(data, trusted);
        if (data?.action === 'reconstruct') {
            const result = await resumeHandler(data, trusted);
            if (!stageLab && (!Array.isArray(result.stageCommands) || result.stageCommands.some(stage =>
                !Array.isArray(stage?.stageIds) || stage.stageIds.length !== 0))) throw Error('RESUME_STAGING_NOT_CONNECTED');
            return result;
        }
        if (!stageLab && (!Array.isArray(data?.stageCommands) || data.stageCommands.some(stage =>
            !Array.isArray(stage?.stageIds) || stage.stageIds.length !== 0))) throw Error('RESUME_STAGING_NOT_CONNECTED');
        return resumeHandler(data, trusted);
    });
    // Optional, strictly loopback-only Storage path. Other emulator suites do not
    // need Storage; missing configuration never falls back to a real bucket.
    if (process.env.FIREBASE_STORAGE_EMULATOR_HOST) {
        assert.equal(process.env.FIREBASE_STORAGE_EMULATOR_HOST, '127.0.0.1:9199');
        assert.ok(!process.env.STORAGE_EMULATOR_HOST || process.env.STORAGE_EMULATOR_HOST === 'http://127.0.0.1:9199');
        process.env.STORAGE_EMULATOR_HOST = 'http://127.0.0.1:9199';
        const {getStorage} = require('firebase-admin/storage');
        const stageAuth = {
            verifyIdToken: async token => {
                const identity = await getAuth(app).verifyIdToken(token, true);
                if (!owners.has(identity.uid)) throw Error('STAGE_OWNER');
                return identity;
            },
            verifyAppCheck: async token => {if (token !== 'synthetic-app-check') throw Error('STAGE_ATTESTATION');}
        };
        stageLab = createRestoreStageLab({...resumeOptions, bucket: getStorage(app).bucket('demo-vault-shell.appspot.com'),
            ...stageAuth, now: Date.now, timestamp: value => Timestamp.fromMillis(value)});
        stageDownload = createRestoreStageDownload({read: stageLab.read, ...stageAuth});
        handlers.set('/demo-vault-shell/europe-west1/manageRestoreStage', createRestoreStageHandler({stageLab}));
        // Same plan/fence implementation, now with atomic published-stage binding.
        const stagedResume = createRestoreResumeHandler({plans: createResumePlanLab(resumeOptions),
            writer: createRestoreChunkLab({...resumeOptions, stageLab, beforeChunkWrite: createRestoreAccountFenceLab(dependencies.db),
                types: {timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds), bytes: value => Buffer.from(value)}})});
        handlers.set('/demo-vault-shell/europe-west1/manageRestoreResume', async (data, trusted) => {
            const command = structuredClone(data);
            if (command?.action === 'create') {
                if (command.expectedOwnerUid !== trusted?.auth?.uid || !Array.isArray(command.stageCommands)) throw Error('RESUME_STAGE_INVALID');
                for (const stage of command.stageCommands) {
                    if (!Array.isArray(stage?.stageIds)) throw Error('RESUME_STAGE_INVALID');
                    if (stage.stageIds.length) await stageLab.resolveMapping(trusted.auth.uid,
                        {operationId: stage.restoreOperationId, stageIds: stage.stageIds});
                }
            }
            // Commit rechecks the mapping in the record-writing transaction.
            return stagedResume(command, trusted);
        });
        const attachments = createProfileDocumentAttachmentHandler({...dependencies,
            db: createFirestoreDocumentAttachmentDb(dependencies.db),
            storage: createFirebaseDocumentAttachmentStorage({bucket: getStorage(app).bucket('demo-vault-shell.appspot.com'), sha256: documentAttachmentSha256})});
        handlers.set('/demo-vault-shell/europe-west1/uploadProfileDocumentAttachment', async (data, trusted) => {
            const input = decodeAttachmentUpload(data);
            try {return await attachments.upload(input, trusted);} finally {input.payload.fill(0);}
        });
        handlers.set('/demo-vault-shell/europe-west1/removeProfileDocumentAttachment', (data, trusted) => {
            if (!data || Object.keys(data).some(key => !['command', 'digest'].includes(key))) throw Error('INVALID_BODY');
            return attachments.remove(data, trusted);
        });
    }
    return async (request, response) => {
        const binary = stageLab && (request.url === '/restore-stage/upload' ? stageLab.upload :
            request.url === '/restore-stage/download' ? stageDownload : null);
        const run = handlers.get(request.url); if (!run && !binary) return false;
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
        if (binary) {
            const originalUrl = request.url;
            request.url = originalUrl === '/restore-stage/upload' ? '/upload' : '/download';
            try {await binary(request, response);} finally {request.url = originalUrl;}
            return true;
        }
        try {
            const maxBody = request.url.endsWith('/uploadProfileDocumentAttachment') ? ATTACHMENT_WIRE_MAX_BODY :
                request.url.endsWith('/manageRestoreResume') ? 16 * 1024 * 1024 : 200000;
            const payload = await readBoundedJsonRequest(request, maxBody);
            if (!payload || Object.keys(payload).some(key => key !== 'data')) throw Error('INVALID_BODY');
            // Synthetic attestation is confined to this exact demo origin and
            // fixture UID allowlist. It never proves production App Check.
            const result = await run(payload.data, {auth: identity, app: {appId: 'synthetic-vault-laboratory'}});
            response.end(JSON.stringify({result}));
        } catch (error) {
            // Only fixed, non-sensitive restore diagnostics cross the
            // transport; arbitrary exception text remains private.
            const safeRestoreCodes=new Set(['RESUME_DEPENDENCY_CROSS_CHUNK',
                'RESUME_WIDGET_PARENT_MISSING','RESUME_ATTACHMENT_PARENT_MISSING',
                'RESUME_WIDGET_BANK_MISSING',
                'RESUME_PLAN_MISSING_NEW_PREVIEW_REQUIRED','RESUME_PLAN_EXPIRED_NEW_PREVIEW_REQUIRED',
                'BACKUP_TIMESTAMP_PRECISION_UNSUPPORTED']);
            const message=request.url.endsWith('/manageRestoreResume')&&safeRestoreCodes.has(error.message)
                ? error.message : 'Laboratory selection rejected';
            response.writeHead(400).end(JSON.stringify({error: {status: 'INVALID_ARGUMENT', message}}));
        }
        return true;
    };
}
