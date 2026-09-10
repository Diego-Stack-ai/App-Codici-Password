import { db, storage } from '../../firebase-config.js?v=1.2.84';
import {
    addDoc,
    arrayUnion,
    collection,
    doc,
    getDownloadURL,
    ref,
    setDoc,
    Timestamp,
    updateDoc,
    uploadBytes,
    writeBatch
} from '/assets/js/vendor/firebase-runtime.js';
import { LOG } from '../../logger.js';
import { ensureVaultKeyMaterial } from '../core/security-manager.js';
import { getUserProfile } from '../data/vault-repository.js';
import {
    createStorageObjectName,
    encryptAttachmentFile,
    validateAttachmentFile
} from '../shared/attachment-security.js';
import { deadlineRecipientFields } from './deadline-recipient-model.js';

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
        const profile = await getUserProfile(userId);
        const documents = profile?.documenti || [];
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', userId, 'scadenze', editingDeadlineId), deadlineData);
        batch.update(profileRef, {
            documenti: documents.map(item => item.id === linkedSourceRef.id
                ? { ...item, expiry_date: deadlineData.dueDate }
                : item)
        });
        await batch.commit();
    } else if (editingDeadlineId) {
        await updateDoc(doc(db, 'users', userId, 'scadenze', editingDeadlineId), deadlineData);
    } else if (profileDocumentLinkDraft?.profileDocumentId) {
        const deadlineRef = doc(collection(db, 'users', userId, 'scadenze'));
        finalDeadlineId = deadlineRef.id;
        const profileRef = doc(db, 'users', userId);
        const profile = await getUserProfile(userId);
        const documents = profile?.documenti || [];
        const batch = writeBatch(db);
        batch.set(deadlineRef, deadlineData);
        batch.update(profileRef, {
            documenti: documents.map(item => item.id === profileDocumentLinkDraft.profileDocumentId
                ? { ...item, expiryReference: { deadlineId: finalDeadlineId } }
                : item)
        });
        await batch.commit();
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
        uid: user.uid,
        mode,
        attachments: [...existingAttachments, ...uploadedAttachments],
        ...recipientFields,
        updatedAt: Timestamp.now()
    };
    if (profileDocumentLinkDraft?.profileDocumentId) {
        deadlineData.sourceRef = { type: 'profileDocument', id: profileDocumentLinkDraft.profileDocumentId };
    } else if (linkedSourceRef?.type === 'profileDocument') {
        deadlineData.sourceRef = linkedSourceRef;
    }
    if (!editingDeadlineId) deadlineData.createdAt = Timestamp.now();

    const finalDeadlineId = await persistDeadlineDocument({
        userId: user.uid,
        editingDeadlineId,
        profileDocumentLinkDraft,
        linkedSourceRef,
        deadlineData
    });
    LOG(`[FRONTEND-TRACE] Documento ${finalDeadlineId} salvato. Trigger backend atteso.`);

    if (!editingDeadlineId && data.name) {
        updateDeadlineAutocomplete({ userId: user.uid, mode, name: data.name, recipients: recipientFields.recipients });
    }

    return Object.freeze({
        deadlineId: finalDeadlineId,
        consumedProfileDocumentDraft: Boolean(!editingDeadlineId && profileDocumentLinkDraft?.profileDocumentId)
    });
}
