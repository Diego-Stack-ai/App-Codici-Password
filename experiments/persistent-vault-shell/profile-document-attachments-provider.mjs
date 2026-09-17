import {createProfileDocumentAttachmentCapability} from './profile-document-attachment-capability.mjs';
import {createProfileDocumentAttachmentsReader} from './profile-document-attachments-reader.mjs';
import {createProfileDocumentAttachmentsSource} from './profile-document-attachments-source.mjs';
import {mountProfileDocumentAttachments} from './profile-document-attachments-view.mjs';
import {planProfileDocumentAttachmentDelete, planProfileDocumentAttachmentUpload}
    from './prepare-profile-document-attachment.mjs';

// Laboratory provider: the only place that knows how the DS-002B pieces fit
// together, and it reuses them without duplicating a single decision. The session
// lends the binary capability, the repository lends the profile, the records and
// the stored bytes, the planner mints the immutable commands against a freshly
// read profile, and the candidate service decides the outcome. The section signal
// closes everything: the view, the source (which revokes the Object URL and clears
// the plaintext) and the capability.
export function createProfileDocumentAttachmentsProvider({context, getUser, repository, service, hash, isOnline,
    objectUrl, trusted, createAttachmentId, createOperationId}) {
    if (!repository || ['readProfile', 'readDocuments', 'listAttachments', 'readAttachment', 'download']
        .some(name => typeof repository[name] !== 'function')) throw Error('DOCUMENT_ATTACHMENT_PROVIDER_INVALID');
    const readProfile = (uid, confirmed) => repository.readProfile(uid, confirmed);
    return async function mountDocumentAttachments(root, {signal} = {}) {
        const scoped = {...context, signal: signal ?? context.signal};
        const capability = createProfileDocumentAttachmentCapability({context: scoped, getUser,
            seal: ({bytes, aad}) => scoped.sealImage({bytes, aad}),
            open: ({payload, envelope, aad}) => scoped.openImage({payload, envelope, aad})});
        const reader = createProfileDocumentAttachmentsReader({context: scoped, getUser,
            repository: {getUserProfile: uid => readProfile(uid, false), getUserProfileConfirmed: uid => readProfile(uid, true),
                listProfileDocumentAttachments: uid => repository.listAttachments(uid)}, isOnline});
        const source = createProfileDocumentAttachmentsSource({context: scoped, getUser, reader,
            repository: {read: (uid, attachmentId) => repository.readAttachment(uid, attachmentId),
                download: (uid, reference) => repository.download(uid, reference)},
            capability, service, isOnline, objectUrl, trusted, createOperationId,
            // The limit and the document identity are always decided on a freshly
            // read profile and record list, never on what the view happens to show.
            planner: {
                async upload(options) {
                    const [documents, attachments] = await Promise.all([repository.readDocuments(),
                        repository.listAttachments(getUser()?.uid)]);
                    return planProfileDocumentAttachmentUpload({...options, documents, attachments, hash, createAttachmentId});
                },
                async remove(options) {
                    return planProfileDocumentAttachmentDelete({...options, documents: await repository.readDocuments(), hash});
                }
            }});
        let view = null, disposed = false;
        const dispose = () => {
            if (disposed) return;
            disposed = true;
            try {view?.dispose();} finally {try {source.dispose();} finally {capability.dispose();}}
        };
        const documents = await repository.readDocuments();
        if (disposed || scoped.signal.aborted) {dispose(); throw Error('VIEW_DISPOSED');}
        view = mountProfileDocumentAttachments(root, {source, documents, isOnline});
        if (disposed || scoped.signal.aborted) dispose();
        return dispose;
    };
}
