import {documentAttachmentIdentity, documentAttachmentMetadata, documentAttachmentObject} from './profile-document-attachments-contract.mjs';

// Read-only projection for one digital document: metadata only, never bytes. An
// attachment is `available` only when the session is online and the record is
// finalized; offline the already synchronized metadata is shown with
// availability false, because attachment bytes are never part of the cache.
// Owner, document and derived path are re-checked on every record and the view is
// revoked after every await.
export function createProfileDocumentAttachmentsReader({context, getUser, repository,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    let disposed = false;
    const dispose = () => {disposed = true;};
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {disposed = true; throw Error('VIEW_DISPOSED');}
        context.assertUnlocked();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    return Object.freeze({dispose,
        async read(documentId) {
            check();
            const online = isOnline();
            const profile = await repository[online ? 'getUserProfileConfirmed' : 'getUserProfile'](uid);
            check();
            if (!documentAttachmentObject(profile)) throw Error('PROFILE_NOT_FOUND');
            if (profile.ownerId !== undefined && profile.ownerId !== uid) throw Error('OWNER_MISMATCH');
            const identity = documentAttachmentIdentity(profile.documenti ?? [], documentId);
            const records = await repository.listProfileDocumentAttachments(uid);
            check();
            if (!Array.isArray(records)) throw Error('DOCUMENT_ATTACHMENTS_UNAVAILABLE');
            const attachments = [], invalid = [];
            for (const record of records) {
                check();
                let metadata;
                try {
                    metadata = documentAttachmentMetadata(record, {uid});
                } catch {
                    // Fail closed: an unverifiable record is reported, never exposed.
                    invalid.push(Object.freeze({attachmentId: typeof record?.id === 'string' ? record.id : null,
                        code: 'METADATA_INVALID'}));
                    continue;
                }
                if (metadata.documentId !== documentId) continue;
                attachments.push(Object.freeze({attachmentId: metadata.attachmentId, mimeType: metadata.mimeType,
                    size: metadata.size, digest: metadata.digest, status: metadata.status,
                    schemaVersion: metadata.schemaVersion, available: online && metadata.status === 'ready'}));
            }
            check();
            return Object.freeze({documentId, online, allowed: identity.allowed,
                refusal: identity.allowed ? null : identity.code, attachments: Object.freeze(attachments),
                invalid: Object.freeze(invalid), bytesAvailable: false});
        }});
}
