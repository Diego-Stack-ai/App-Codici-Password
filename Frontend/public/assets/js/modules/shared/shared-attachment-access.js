import {functions} from '../../firebase-config.js?v=1.2.154';
import {httpsCallable} from '/assets/js/vendor/firebase-runtime.js';
import {
    decryptAttachmentBytesWithFileKey,
    unwrapAttachmentFileKey
} from './attachment-security.js';
import {
    sharedAttachmentContextId,
    unwrapRecordKeyForRecipient,
    wrapRecordKeyForRecipient
} from './record-sharing-crypto.js';
import {ensureSharingIdentity, getSharingPublicIdentity} from './sharing-identity-service.js';

const acceptedRecipients = account => [...new Set(Object.values(account?.sharedWith || {})
    .filter(item => item?.status === 'accepted' && item?.uid)
    .map(item => String(item.uid)))];

async function importPublicKey(identity, expectedUid) {
    if (identity?.schemaVersion !== 1 || identity?.agreement !== 'ECDH-P256' || identity?.uid !== expectedUid) {
        throw new Error('SHARING_PUBLIC_IDENTITY_INVALID');
    }
    return crypto.subtle.importKey(
        'jwk', identity.publicJwk, {name: 'ECDH', namedCurve: 'P-256'}, false, []
    );
}

async function syncAttachmentAccess({scope, ownerUid, companyId = '', accountId, account, attachments, vaultKeyMaterial}) {
    const recipients = acceptedRecipients(account);
    if (!recipients.length || !attachments.length) return {updated: 0, waiting: 0};
    let updated = 0, waiting = 0;
    for (const attachment of attachments) {
        if (!attachment?.id || !attachment.encryption) continue;
        const envelopes = {};
        let fileKeyBytes;
        try {
            fileKeyBytes = await unwrapAttachmentFileKey(attachment.encryption, vaultKeyMaterial);
            const contextId = await sharedAttachmentContextId({ownerUid, companyId, accountId, attachmentId: attachment.id});
            for (const recipientUid of recipients) {
                if (attachment.recipientKeyEnvelopes?.[recipientUid]) continue;
                try {
                    const identity = await getSharingPublicIdentity(recipientUid);
                    envelopes[recipientUid] = await wrapRecordKeyForRecipient(
                        fileKeyBytes,
                        await importPublicKey(identity, recipientUid),
                        contextId,
                        recipientUid
                    );
                } catch (error) {
                    if (error?.message === 'SHARING_PUBLIC_IDENTITY_MISSING') waiting += 1;
                    else throw error;
                }
            }
        } finally {
            fileKeyBytes?.fill(0);
        }
        if (!Object.keys(envelopes).length) continue;
        await httpsCallable(functions, 'publishSharedAttachmentEnvelopes')({
            scope, accountId, attachmentId: attachment.id, envelopes,
            ...(companyId ? {companyId} : {})
        });
        Object.assign(attachment.recipientKeyEnvelopes ||= {}, envelopes);
        updated += Object.keys(envelopes).length;
    }
    return {updated, waiting};
}

export const syncPrivateAttachmentAccess = options => syncAttachmentAccess({...options, scope: 'private'});
export const syncCompanyAttachmentAccess = options => syncAttachmentAccess({...options, scope: 'company'});

async function decryptReceivedAttachment({
    ownerUid, companyId = '', accountId, attachment, recipientUid, vaultKeyMaterial, ciphertext
}) {
    const envelope = attachment?.recipientKeyEnvelopes?.[recipientUid];
    if (!envelope) throw new Error('SHARED_ATTACHMENT_KEY_PENDING');
    const identity = await ensureSharingIdentity({uid: recipientUid, vaultKeyMaterial});
    const contextId = await sharedAttachmentContextId({
        ownerUid, companyId, accountId, attachmentId: attachment.id
    });
    const fileKeyBytes = await unwrapRecordKeyForRecipient(
        envelope, identity.privateKey, contextId, recipientUid
    );
    try {
        return decryptAttachmentBytesWithFileKey(ciphertext, attachment.encryption, fileKeyBytes);
    } finally {
        fileKeyBytes.fill(0);
    }
}

export const decryptReceivedPrivateAttachment = options => decryptReceivedAttachment(options);
export const decryptReceivedCompanyAttachment = options => decryptReceivedAttachment(options);
