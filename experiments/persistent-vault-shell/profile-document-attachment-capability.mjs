import {documentAttachmentAad, documentAttachmentBytes, documentAttachmentDigest, documentAttachmentEnvelope,
    documentAttachmentInvalid, documentAttachmentObject, documentAttachmentSize, documentImageStoragePath}
    from './profile-document-attachments-contract.mjs';

const SHA256 = async value => {
    const digest = await crypto.subtle.digest('SHA-256', value);
    return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};
// Binary capability, distinct from the textual context.encrypt/read methods: the
// view hands over plaintext bytes and receives an opaque payload, the wrapped
// envelope and the digest of the stored bytes. The Vault Key is never requested,
// never received and never returned here, and the plaintext buffer is cleared on
// every path, including the failing one.
export function createProfileDocumentAttachmentCapability({context, getUser, seal, open}) {
    if (typeof seal !== 'function') throw Error('DOCUMENT_ATTACHMENT_CAPABILITY_UNAVAILABLE');
    const uid = context.user?.uid;
    let disposed = false;
    const dispose = () => {disposed = true; context.signal.removeEventListener('abort', dispose);};
    const check = () => {
        if (disposed || context.signal.aborted || !uid || getUser()?.uid !== uid) {dispose(); throw Error('VIEW_DISPOSED');}
        context.assertUnlocked();
    };
    context.signal.addEventListener('abort', dispose, {once: true});
    return Object.freeze({dispose,
        async sealImage({bytes, documentId, attachmentId}) {
            check();
            if (!documentAttachmentBytes(bytes)) throw Error('DOCUMENT_IMAGE_NOT_ALLOWED');
            if (!documentAttachmentSize(bytes.byteLength)) throw Error('DOCUMENT_IMAGE_NOT_ALLOWED');
            const size = bytes.byteLength;
            const storagePath = documentImageStoragePath({uid, documentId, attachmentId});
            const aad = documentAttachmentAad({uid, documentId, attachmentId, storagePath});
            let sealed;
            try {
                check();
                sealed = await seal({bytes, aad, uid, documentId, attachmentId, storagePath});
                check();
            } finally {
                bytes.fill(0);
            }
            if (!documentAttachmentObject(sealed) || !documentAttachmentBytes(sealed.payload) || !sealed.payload.byteLength) {
                throw Error('DOCUMENT_ATTACHMENT_SEAL_FAILED');
            }
            const envelope = documentAttachmentEnvelope(sealed.envelope);
            const digest = await SHA256(sealed.payload);
            if (!documentAttachmentDigest(digest)) throw Error('DOCUMENT_ATTACHMENT_SEAL_FAILED');
            const payload = sealed.payload;
            return Object.freeze({payload, envelope, digest, size, storagePath, aad});
        },
        // Opening is the mirror image: the capability receives the stored payload
        // and the record envelope, derives the same AAD from the identity and
        // returns the plaintext bytes to its caller, which is then responsible for
        // consuming them immediately (Object URL) and clearing them afterwards.
        async openImage({payload, envelope, documentId, attachmentId}) {
            if (typeof open !== 'function') throw Error('DOCUMENT_ATTACHMENT_CAPABILITY_UNAVAILABLE');
            check();
            if (!documentAttachmentBytes(payload) || !payload.byteLength) throw Error('DOCUMENT_IMAGE_NOT_ALLOWED');
            const storagePath = documentImageStoragePath({uid, documentId, attachmentId});
            const aad = documentAttachmentAad({uid, documentId, attachmentId, storagePath});
            check();
            const plaintext = await open({payload, envelope, aad, uid, documentId, attachmentId, storagePath});
            check();
            if (!documentAttachmentBytes(plaintext) || !plaintext.byteLength) throw Error('DOCUMENT_ATTACHMENT_OPEN_FAILED');
            return plaintext;
        }});
}
export {documentAttachmentInvalid};
