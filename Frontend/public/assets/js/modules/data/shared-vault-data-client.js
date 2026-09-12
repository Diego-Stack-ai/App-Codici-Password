import {functions} from '../../firebase-config.js?v=1.2.106';
import {httpsCallable} from '/assets/js/vendor/firebase-runtime.js';
import {encrypt, ensureVaultKeyMaterial} from '../core/security-manager.js';
import {
    createSharedVaultIdentifiers,
    createSharedVaultLinkIdentifiers,
    prepareSharedVaultData
} from './shared-vault-data-model.js';

const manageSharedVaultData = httpsCallable(functions, 'manageSharedVaultData');

async function encryptedPayload(data) {
    const vaultKeyMaterial = await ensureVaultKeyMaterial({promptImmediately: true});
    return prepareSharedVaultData(data, value => encrypt(value, vaultKeyMaterial));
}

async function send(command) {
    if (!navigator.onLine) throw new Error('Le Credenziali comuni si modificano soltanto online.');
    const response = await manageSharedVaultData(command);
    if (response.data?.status !== 'applied') {
        const error = new Error(response.data?.status === 'conflict'
            ? 'La Credenziale comune è stata modificata altrove. Aggiorna e riprova.'
            : 'Operazione sulla Credenziale comune non completata.');
        error.result = response.data;
        throw error;
    }
    return response.data;
}

export async function createSharedCredential(data, sharedDataId) {
    const ids = createSharedVaultIdentifiers(sharedDataId);
    return send({...ids, action: 'create', data: await encryptedPayload(data)});
}

export async function updateSharedCredential(sharedDataId, expectedRevision, data) {
    return send({
        ...createSharedVaultIdentifiers(sharedDataId), action: 'update', expectedRevision,
        data: await encryptedPayload(data)
    });
}

export async function linkSharedCredential(sharedDataId, expectedRevision, link) {
    const ids = createSharedVaultLinkIdentifiers(
        sharedDataId, link.context, link.accountId, link.companyId
    );
    return send({...ids, action: 'link', sharedDataId, expectedRevision, link});
}

export async function unlinkSharedCredential(sharedDataId, expectedRevision, link) {
    const ids = createSharedVaultLinkIdentifiers(
        sharedDataId, link.context, link.accountId, link.companyId
    );
    return send({...ids, action: 'unlink', sharedDataId, expectedRevision, link});
}

export async function deleteSharedCredential(sharedDataId, expectedRevision) {
    return send({
        ...createSharedVaultIdentifiers(sharedDataId), action: 'delete', expectedRevision
    });
}
