import {ensureVaultKeyMaterial} from '../core/security-manager.js';
import {decryptRequiredValue} from '../core/crypto-utils.js';
import {listProfileDocumentAttachments} from '../data/vault-repository.js';
import {buildProfileDocumentDeadlineDraft} from './profile-model.js';

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
