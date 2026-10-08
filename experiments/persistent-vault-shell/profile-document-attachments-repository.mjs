import {documentAttachmentId, documentAttachmentObject, documentAttachmentCollection, documentAttachmentRecordPath,
    documentImageStoragePath, DOCUMENT_IMAGE_MAX_STORED_BYTES} from './profile-document-attachments-contract.mjs';

// Browser boundary. SDK operations are injected; this adapter never writes data,
// downloads a public URL, or falls back from a failed server read to cached data.
export function createProfileDocumentAttachmentsRepository({context, getUser, transport,
    isOnline = () => globalThis.navigator?.onLine !== false}) {
    const uid = context.user?.uid;
    if (!documentAttachmentId(uid)) throw Error('OWNER_MISMATCH');
    const check = requestedUid => {
        if (requestedUid !== uid || getUser()?.uid !== uid || context.signal.aborted) throw Error('VIEW_DISPOSED');
        context.assertUnlocked();
    };
    const read = async (path, confirmed) => {
        check(uid);
        if (confirmed && !isOnline()) throw Error('OFFLINE_NOT_ALLOWED');
        const value = await transport.read(path, {source: confirmed ? 'server' : 'cache'});
        check(uid);
        return value;
    };
    const readProfile = async (requestedUid, confirmed = isOnline()) => {
        check(requestedUid);
        const value = await read(`users/${uid}`, confirmed);
        if (!value || (value.ownerId !== undefined && value.ownerId !== uid)) throw Error('OWNER_MISMATCH');
        return value;
    };
    return Object.freeze({
        readProfile,
        async readDocuments() {
            const profile = await readProfile(uid);
            check(uid);
            if (profile.documenti !== undefined && (!Array.isArray(profile.documenti)
                || profile.documenti.length > 10000 || profile.documenti.some(item => !documentAttachmentObject(item)))) throw Error('DOCUMENTS_INVALID');
            // Only identity and label are required by the attachment surface.
            // Never expose encrypted document fields to a label renderer.
            return (profile.documenti ?? []).map(item => ({id: item?.id ?? null,
                type: typeof item?.type === 'string' ? item.type : 'Documento'}));
        },
        async listAttachments(requestedUid) {
            check(requestedUid);
            const values = await transport.list(documentAttachmentCollection(uid), {source: isOnline() ? 'server' : 'cache'});
            check(uid);
            if (!Array.isArray(values)) throw Error('DOCUMENT_ATTACHMENTS_UNAVAILABLE');
            return values;
        },
        async readAttachment(requestedUid, attachmentId) {
            check(requestedUid);
            return read(documentAttachmentRecordPath({uid, attachmentId}), isOnline());
        },
        async download(requestedUid, {storagePath} = {}) {
            check(requestedUid);
            if (!isOnline()) throw Error('OFFLINE_NOT_ALLOWED');
            const parts = typeof storagePath === 'string' ? storagePath.split('/') : [];
            const documentId = parts[3], attachmentId = parts[5];
            if (parts.length !== 6 || !documentAttachmentId(documentId) || !documentAttachmentId(attachmentId)
                || storagePath !== documentImageStoragePath({uid, documentId, attachmentId})) throw Error('PATH_MISMATCH');
            const bytes = await transport.download(storagePath, {maxBytes: DOCUMENT_IMAGE_MAX_STORED_BYTES});
            try {
                check(uid);
                if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > DOCUMENT_IMAGE_MAX_STORED_BYTES)
                    throw Error('ATTACHMENT_PAYLOAD_INVALID');
                return bytes;
            } catch (error) {bytes?.fill?.(0); throw error;}
        }
    });
}
