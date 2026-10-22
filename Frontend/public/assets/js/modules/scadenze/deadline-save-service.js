import { db, storage } from '../../firebase-config.js?v=1.2.220';
import {
    addDoc,
    arrayUnion,
    collection,
    doc,
    deleteObject,
    getDownloadURL,
    ref,
    runTransaction,
    setDoc,
    Timestamp,
    updateDoc,
    uploadBytes
} from '/assets/js/vendor/firebase-runtime.js';
import { LOG } from '../../logger.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { getDeadline } from '../data/vault-repository.js';
import {normalizeProfileDateInputValue} from '../privato/profile-model.js';
import {
    createStorageObjectName,
    encryptAttachmentFile,
    validateAttachmentFile
} from '../shared/attachment-security.js';
import { deadlineRecipientFields } from './deadline-recipient-model.js';
import { validateDeadlineFrequency, validateDeadlineNotice } from './deadline-config-model.js';

const CONFIG_DOCUMENT_BY_MODE = Object.freeze({
    automezzi: 'deadlineConfig',
    documenti: 'deadlineConfigDocuments',
    generali: 'generalConfig'
});

async function uploadDeadlineAttachments({ userId, deadlineId, files, onProgress }) {
    if (!files.length) return [];
    const vaultKeyMaterial = await ensureVaultKeyMaterial();
    const folderId = deadlineId || `new_${Date.now()}`;
    const uploaded = [];
    LOG(`[FRONTEND-TRACE] Inizio upload di ${files.length} file...`);

    for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        validateAttachmentFile(file);
        onProgress?.({ phase: 'upload', current: index + 1, total: files.length });
        const storagePath = `users/${userId}/scadenze/${folderId}/${createStorageObjectName(file)}`;
        const storageRef = ref(storage, storagePath);
        const encryptedFile = await encryptAttachmentFile(file, vaultKeyMaterial);
        const snapshot = await uploadBytes(storageRef, encryptedFile.blob, {
            contentType: 'application/octet-stream',
            customMetadata: { encrypted: 'v1' }
        });
        const url = await getDownloadURL(snapshot.ref);
        uploaded.push({
            name: file.name,
            url,
            storagePath,
            type: file.type,
            size: file.size,
            encryption: encryptedFile.metadata,
            createdAt: new Date().toISOString()
        });
        LOG(`[FRONTEND-TRACE] File ${index + 1} caricato con successo.`);
    }
    return uploaded;
}

function deadlineAttachmentPath(userId, attachment) {
    const path = String(attachment?.storagePath || '');
    return path.startsWith(`users/${userId}/scadenze/`) ? path : null;
}

function validateLinkedProfileDocumentAttachments(userId, documentId, attachments = []) {
    const prefix = `users/${userId}/profile-documents/${documentId}/attachments/`;
    for (const attachment of attachments) {
        const path = String(attachment?.storagePath || '');
        if (attachment?.linkedSource?.type !== 'profileDocumentAttachment'
            || !attachment.linkedSource.id
            || !path.startsWith(prefix)) {
            throw new Error('Allegato del documento non valido');
        }
    }
}

async function removeDeadlineAttachmentObjects(userId, attachments) {
    const paths = [...new Set(attachments.map(item => deadlineAttachmentPath(userId, item)).filter(Boolean))];
    const results = await Promise.allSettled(paths.map(path => deleteObject(ref(storage, path))));
    const failure = results.find(result => result.status === 'rejected' && result.reason?.code !== 'storage/object-not-found');
    if (failure) throw failure.reason;
}

async function persistDeadlineDocument({
    userId,
    editingDeadlineId,
    profileDocumentLinkDraft,
    linkedSourceRef,
    deadlineData
}) {
    let finalDeadlineId = editingDeadlineId;
    LOG('[FRONTEND-TRACE] Scrittura documento Firestore...');

    if (editingDeadlineId && linkedSourceRef?.type === 'profileDocument') {
        const profileRef = doc(db, 'users', userId);
        const deadlineRef = doc(db, 'users', userId, 'scadenze', editingDeadlineId);
        await runTransaction(db, async transaction => {
            const [profileSnapshot, deadlineSnapshot] = await Promise.all([
                transaction.get(profileRef), transaction.get(deadlineRef)
            ]);
            if (!profileSnapshot.exists()) throw new Error('Profilo non disponibile');
            if (!deadlineSnapshot.exists()) throw new Error('Scadenza non disponibile');
            const documents = profileSnapshot.data()?.documenti || [];
            if (!Array.isArray(documents)) throw new Error('Documenti del Profilo non validi');
            const sourceDocument = documents.find(item => item?.id === linkedSourceRef.id);
            if (!sourceDocument) throw new Error('Documento del Profilo non disponibile');
            if (sourceDocument.expiryReference?.deadlineId !== editingDeadlineId
                || sourceDocument.expiryReference?.linkKind !== 'profile-document-deadline-v1') {
                throw new Error('Il collegamento alla scadenza del documento è cambiato');
            }
            const storedDeadline = deadlineSnapshot.data();
            if (storedDeadline?.sourceRef?.type !== 'profileDocument'
                || storedDeadline.sourceRef.id !== linkedSourceRef.id
                || storedDeadline.linkKind !== 'profile-document-deadline-v1') {
                throw new Error('La fonte della scadenza non corrisponde al documento');
            }
            transaction.update(deadlineRef, deadlineData);
            transaction.update(profileRef, {
                documenti: documents.map(item => item.id === linkedSourceRef.id
                    ? { ...item, expiry_date: deadlineData.dueDate }
                    : item)
            });
        });
    } else if (editingDeadlineId) {
        await updateDoc(doc(db, 'users', userId, 'scadenze', editingDeadlineId), deadlineData);
    } else if (profileDocumentLinkDraft?.profileDocumentId) {
        const deadlineRef = doc(collection(db, 'users', userId, 'scadenze'));
        finalDeadlineId = deadlineRef.id;
        const profileRef = doc(db, 'users', userId);
        await runTransaction(db, async transaction => {
            const profileSnapshot = await transaction.get(profileRef);
            if (!profileSnapshot.exists()) throw new Error('Profilo non disponibile');
            const documents = profileSnapshot.data()?.documenti || [];
            if (!Array.isArray(documents)) throw new Error('Documenti del Profilo non validi');
            const sourceDocument = documents.find(item => item.id === profileDocumentLinkDraft.profileDocumentId);
            if (!sourceDocument) throw new Error('Documento del Profilo non disponibile');
            const sourceDate = normalizeProfileDateInputValue(sourceDocument.expiry_date);
            const draftDate = normalizeProfileDateInputValue(profileDocumentLinkDraft.sourceValueAtLink);
            const deadlineDate = normalizeProfileDateInputValue(deadlineData.dueDate);
            if (!sourceDate || sourceDate !== draftDate || !deadlineDate) {
                throw new Error('La data del documento è cambiata. Torna al Profilo e ripeti la configurazione.');
            }
            const currentReference = sourceDocument.expiryReference || {};
            const definitiveReference = currentReference.deadlineId
                && currentReference.experimentTag !== 'prova-scadenze'
                && currentReference.linkKind === 'profile-document-deadline-v1';
            if (definitiveReference && currentReference.deadlineId !== finalDeadlineId) {
                const currentDeadlineSnapshot = await transaction.get(
                    doc(db, 'users', userId, 'scadenze', currentReference.deadlineId)
                );
                if (currentDeadlineSnapshot.exists()) {
                    throw new Error('Esiste già una scadenza definitiva collegata a questo documento.');
                }
            }
            transaction.set(deadlineRef, deadlineData);
            transaction.update(profileRef, {
                documenti: documents.map(item => item.id === profileDocumentLinkDraft.profileDocumentId
                    ? { ...item, expiry_date: deadlineData.dueDate, expiryReference: {
                        deadlineId: finalDeadlineId,
                        sourceType: 'profileDocument',
                        sourceFieldId: 'document.expiry_date',
                        linkKind: 'profile-document-deadline-v1'
                    } }
                    : item)
            });
        });
    } else {
        const deadlineRef = await addDoc(collection(db, 'users', userId, 'scadenze'), deadlineData);
        finalDeadlineId = deadlineRef.id;
    }

    return finalDeadlineId;
}

function updateDeadlineAutocomplete({ userId, mode, name, recipients }) {
    const configDocument = CONFIG_DOCUMENT_BY_MODE[mode] || CONFIG_DOCUMENT_BY_MODE.generali;
    setDoc(doc(db, 'users', userId, 'settings', configDocument), {
        names: arrayUnion(name)
    }, { merge: true }).catch(error => console.warn('[TRACE] names update failed:', error));

    const emails = recipients.map(recipient => recipient.email).filter(Boolean);
    if (emails.length > 0) {
        setDoc(doc(db, 'users', userId, 'settings', configDocument), {
            notificationEmails: arrayUnion(...emails)
        }, { merge: true }).catch(error => console.warn('[TRACE] emails update failed:', error));
    }
}

export async function saveDeadline({
    user,
    editingDeadlineId = null,
    profileDocumentLinkDraft = null,
    linkedSourceRef = null,
    mode,
    data,
    recipients = [],
    selectedFiles = [],
    existingAttachments = [],
    onProgress = () => {}
}) {
    if (!user?.uid) throw new Error('Utente non autenticato');
    if (profileDocumentLinkDraft?.profileDocumentId) {
        if (profileDocumentLinkDraft.ownerUid !== user.uid) {
            throw new Error('La configurazione appartiene a un altro account');
        }
        validateLinkedProfileDocumentAttachments(
            user.uid,
            profileDocumentLinkDraft.profileDocumentId,
            profileDocumentLinkDraft.attachments || []
        );
        validateLinkedProfileDocumentAttachments(
            user.uid,
            profileDocumentLinkDraft.profileDocumentId,
            existingAttachments
        );
    }
    const notice = validateDeadlineNotice(data?.notif_days_before);
    const frequency = validateDeadlineFrequency(data?.notif_frequency);

    let previousAttachments = [];
    if (editingDeadlineId) {
        const previous = await getDeadline(user.uid, editingDeadlineId);
        if (!previous) throw new Error('Scadenza non disponibile');
        previousAttachments = Array.isArray(previous.attachments) ? previous.attachments : [];
    }

    const uploadedAttachments = await uploadDeadlineAttachments({
        userId: user.uid,
        deadlineId: editingDeadlineId,
        files: selectedFiles,
        onProgress
    });
    onProgress({ phase: 'database' });

    const recipientFields = deadlineRecipientFields(recipients);
    const deadlineData = {
        ...data,
        notif_days_before: notice,
        notif_frequency: frequency,
        uid: user.uid,
        mode,
        attachments: [...existingAttachments, ...uploadedAttachments],
        ...recipientFields,
        updatedAt: Timestamp.now()
    };
    if (profileDocumentLinkDraft?.profileDocumentId) {
        deadlineData.sourceRef = {
            type: 'profileDocument',
            id: profileDocumentLinkDraft.profileDocumentId,
            fieldId: profileDocumentLinkDraft.sourceFieldId || 'document.expiry_date'
        };
        deadlineData.sourceType = 'profileDocument';
        deadlineData.sourceDocumentId = profileDocumentLinkDraft.profileDocumentId;
        deadlineData.sourceFieldId = profileDocumentLinkDraft.sourceFieldId || 'document.expiry_date';
        deadlineData.sourceValueAtLink = data.dueDate;
        deadlineData.sourceStatus = 'active';
        deadlineData.sourceIssue = '';
        deadlineData.linkKind = 'profile-document-deadline-v1';
        deadlineData.notificationsEnabled = true;
        deadlineData.pilotDeliveryDisabled = false;
    } else if (linkedSourceRef?.type) {
        deadlineData.sourceRef = linkedSourceRef;
        if (linkedSourceRef.type === 'profileDocument') {
            deadlineData.sourceType = 'profileDocument';
            deadlineData.sourceDocumentId = linkedSourceRef.id;
            deadlineData.sourceFieldId = linkedSourceRef.fieldId || 'document.expiry_date';
            deadlineData.sourceValueAtLink = data.dueDate;
            deadlineData.sourceStatus = 'active';
            deadlineData.sourceIssue = '';
        }
    }
    if (!editingDeadlineId) deadlineData.createdAt = Timestamp.now();

    let finalDeadlineId;
    try {
        finalDeadlineId = await persistDeadlineDocument({
            userId: user.uid,
            editingDeadlineId,
            profileDocumentLinkDraft,
            linkedSourceRef,
            deadlineData
        });
    } catch (error) {
        await removeDeadlineAttachmentObjects(user.uid, uploadedAttachments).catch(cleanupError =>
            console.warn('[TRACE] cleanup upload scadenza fallito:', cleanupError));
        throw error;
    }

    const retainedPaths = new Set(existingAttachments
        .map(item => deadlineAttachmentPath(user.uid, item)).filter(Boolean));
    const removedAttachments = previousAttachments.filter(item => {
        const path = deadlineAttachmentPath(user.uid, item);
        return path && !retainedPaths.has(path);
    });
    await removeDeadlineAttachmentObjects(user.uid, removedAttachments);
    LOG(`[FRONTEND-TRACE] Documento ${finalDeadlineId} salvato. Trigger backend atteso.`);

    if (!editingDeadlineId && data.name) {
        updateDeadlineAutocomplete({ userId: user.uid, mode, name: data.name, recipients: recipientFields.recipients });
    }

    return Object.freeze({
        deadlineId: finalDeadlineId,
        consumedProfileDocumentDraft: Boolean(!editingDeadlineId && profileDocumentLinkDraft?.profileDocumentId)
    });
}
