import {ensureVaultKeyMaterial} from '../core/security-manager.js';
import {decryptIfPossible, decryptRequiredValue} from '../core/crypto-utils.js';
import {getUserProfile, listProfileDocumentAttachments} from '../data/vault-repository.js';
import {buildProfileDocumentDeadlineDraft} from './profile-model.js';

const DEADLINE_DOCUMENT_FIELDS = Object.freeze([
    'num_serie', 'cf_value', 'id_number', 'license_number', 'cf', 'rilasciato_da'
]);

export async function loadLinkedDocumentDeadlineDraft(uid, documentId) {
    const profile = await getUserProfile(uid);
    const sourceDocument = (profile?.documenti || []).find(item => item?.id === documentId);
    if (!sourceDocument) throw new Error('PROFILE_DOCUMENT_NOT_FOUND');
    const key = await ensureVaultKeyMaterial({promptImmediately: true});
    if (!key) throw new Error('VAULT_LOCKED');
    const readableProfile = {...profile};
    for (const field of ['nome', 'cognome']) {
        if (readableProfile[field]) readableProfile[field] = await decryptIfPossible(readableProfile[field], key);
    }
    const readableDocument = {...sourceDocument};
    for (const field of DEADLINE_DOCUMENT_FIELDS) {
        if (readableDocument[field]) readableDocument[field] = await decryptIfPossible(readableDocument[field], key);
    }
    return {...buildProfileDocumentDeadlineDraft(readableDocument, readableProfile), ownerUid: uid};
}

export async function buildLinkedDocumentDeadlineDraft(uid, documentItem, profile) {
    const source = (await listProfileDocumentAttachments(uid))
        .filter(item => item.documentId === documentItem.id && item.status === 'ready'
            && String(item.storagePath || '').startsWith(`users/${uid}/profile-documents/${documentItem.id}/attachments/`));
    const key = source.length ? await ensureVaultKeyMaterial({promptImmediately: true}) : null;
    const attachments = await Promise.all(source.map(async item => ({
        name: item.encryptedName && key
            ? await decryptRequiredValue(item.encryptedName, key, 'Nome allegato')
            : item.name || 'Allegato',
        storagePath: item.storagePath,
        type: item.mimeType || item.type || 'application/octet-stream',
        size: Number(item.size || 0),
        encryption: item.encryption || null,
        linkedSource: {type: 'profileDocumentAttachment', id: item.id}
    })));
    return {...buildProfileDocumentDeadlineDraft(documentItem, profile), ownerUid: uid, attachments};
}
