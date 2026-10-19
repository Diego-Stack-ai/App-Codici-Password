import {auth, db} from '../../firebase-config.js?v=1.2.208';
import {doc, runTransaction, Timestamp, updateDoc} from '/assets/js/vendor/firebase-runtime.js';
import {showAlertModal, showConfirmModal, showToast} from '../../ui-core-v129.js';
import {t} from '../../translations.js';
import {listDeadlines} from '../data/vault-repository.js';
import {buildLinkedDocumentDeadlineDraft} from './profile-document-deadline-link.js';
import {
    buildProfileDocumentPilotDeadline,
    hasTraditionalProfileDocumentDeadlineReference,
    matchingProfileDocumentPilotDeadlines,
    planProfileDocumentDeadlineReconciliation,
    profileDocumentPilotDeadlineId,
    PROFILE_DOCUMENT_DEADLINE_EXPERIMENT
} from './profile-document-deadline-pilot-model.js';

const interpolate = (key, values = {}) => Object.entries(values)
    .reduce((text, [name, value]) => text.replaceAll(`{${name}}`, String(value)), t(key));

async function createPilotDeadline(user, documentItem, profile, candidate) {
    const deadlineId = profileDocumentPilotDeadlineId(candidate.sourceDocumentId, candidate.sourceFieldId);
    const deadlineRef = doc(db, 'users', user.uid, 'scadenze', deadlineId);
    const profileRef = doc(db, 'users', user.uid);
    const linkedDraft = await buildLinkedDocumentDeadlineDraft(user.uid, documentItem, profile);
    const base = buildProfileDocumentPilotDeadline(documentItem, profile, new Date(), {
        attachments: linkedDraft.attachments
    });
    await runTransaction(db, async transaction => {
        const [deadlineSnapshot, profileSnapshot] = await Promise.all([
            transaction.get(deadlineRef), transaction.get(profileRef)
        ]);
        if (!profileSnapshot.exists()) throw new Error('PROFILE_NOT_FOUND');
        if (deadlineSnapshot.exists()) {
            const current = deadlineSnapshot.data();
            const sameSource = current.experimentTag === PROFILE_DOCUMENT_DEADLINE_EXPERIMENT
                && current.sourceDocumentId === candidate.sourceDocumentId
                && current.sourceFieldId === candidate.sourceFieldId;
            if (!sameSource) throw new Error('PILOT_DEADLINE_ID_CONFLICT');
        } else {
            const {createdAtIso, ...record} = base;
            transaction.set(deadlineRef, {...record, createdAt: Timestamp.fromDate(new Date(createdAtIso)), updatedAt: Timestamp.now()});
        }
        const documents = Array.isArray(profileSnapshot.data()?.documenti) ? profileSnapshot.data().documenti : [];
        const sourceDocument = documents.find(item => item?.id === candidate.sourceDocumentId);
        if (!sourceDocument) throw new Error('PROFILE_DOCUMENT_NOT_FOUND');
        const traditionalReference = hasTraditionalProfileDocumentDeadlineReference(sourceDocument);
        if (!traditionalReference) {
            transaction.update(profileRef, {
                documenti: documents.map(item => item?.id === candidate.sourceDocumentId
                    ? {...item, expiryReference: {
                    deadlineId,
                    experimentTag: PROFILE_DOCUMENT_DEADLINE_EXPERIMENT,
                    sourceFieldId: candidate.sourceFieldId
                }} : item)
            });
        }
    });
    return deadlineId;
}

async function updatePilotDeadline(deadline, candidate, documentItem, profile) {
    const linkedDraft = await buildLinkedDocumentDeadlineDraft(auth.currentUser.uid, documentItem, profile);
    const refreshed = buildProfileDocumentPilotDeadline(documentItem, profile, new Date(), {
        attachments: linkedDraft.attachments
    });
    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'scadenze', deadline.id), {
        dueDate: candidate.dueDate,
        sourceValueAtLink: candidate.sourceValueAtLink,
        sourceStatus: 'active',
        sourceIssue: '',
        pilotDeliveryDisabled: true,
        notificationsEnabled: false,
        recipients: [],
        email1: '',
        email2: '',
        documentNumber: refreshed.documentNumber,
        templateText: refreshed.templateText,
        attachments: refreshed.attachments,
        sourceAttachmentCountAtLink: refreshed.sourceAttachmentCountAtLink,
        updatedAt: Timestamp.now()
    });
}

async function markPilotDeadlineForReview(deadline, issue) {
    if (!deadline?.id || !auth.currentUser?.uid) return;
    await updateDoc(doc(db, 'users', auth.currentUser.uid, 'scadenze', deadline.id), {
        sourceStatus: 'needs-review',
        sourceIssue: issue,
        pilotDeliveryDisabled: true,
        notificationsEnabled: false,
        recipients: [],
        email1: '',
        email2: '',
        updatedAt: Timestamp.now()
    });
}

export async function reconcileProfileDocumentDeadlinePilot({
    documentItem,
    profile = {},
    openWhenCurrent = false,
    ensureDocumentPersisted = null
} = {}) {
    const user = auth.currentUser;
    if (!user || !documentItem?.id) return {action: 'none'};
    const deadlines = await listDeadlines(user.uid);
    const plan = planProfileDocumentDeadlineReconciliation(documentItem, deadlines);

    if (plan.action === 'duplicate') {
        await showAlertModal(t('pilot_deadline_duplicate_title'), t('pilot_deadline_duplicate_message'));
        return plan;
    }
    if (plan.action === 'none') {
        if (openWhenCurrent) showToast(t('pilot_deadline_date_required'), 'warning');
        return plan;
    }
    if (plan.action === 'source-missing') {
        await markPilotDeadlineForReview(plan.deadline, 'source-field-missing');
        await showAlertModal(t('pilot_deadline_review_title'), t('pilot_deadline_source_missing_message'));
        return plan;
    }
    if (plan.action === 'current') {
        if (openWhenCurrent) window.location.href = `dettaglio_scadenza.html?id=${encodeURIComponent(plan.deadline.id)}`;
        return plan;
    }
    if (plan.action === 'offer-update') {
        const confirmed = await showConfirmModal(
            t('pilot_deadline_update_title'),
            interpolate('pilot_deadline_update_message', {date: plan.candidate.dueDate}),
            t('pilot_deadline_update_action'),
            t('cancel')
        );
        if (!confirmed) {
            await markPilotDeadlineForReview(plan.deadline, 'source-value-changed');
            return {...plan, action: 'review-required'};
        }
        await updatePilotDeadline(plan.deadline, plan.candidate, documentItem, profile);
        showToast(t('pilot_deadline_updated'), 'success');
        return {...plan, action: 'updated'};
    }

    const confirmed = await showConfirmModal(
        t('pilot_deadline_create_title'),
        interpolate(plan.action === 'offer-create-with-existing'
            ? 'pilot_deadline_create_parallel_message'
            : 'pilot_deadline_create_message', {
            type: documentItem.type || t('document'),
            date: plan.candidate.dueDate
        }),
        t('pilot_deadline_create_action'),
        t('cancel')
    );
    if (!confirmed) return {...plan, action: 'declined'};
    await ensureDocumentPersisted?.();
    const deadlineId = await createPilotDeadline(user, documentItem, profile, plan.candidate);
    const pilotReference = {
        deadlineId,
        experimentTag: PROFILE_DOCUMENT_DEADLINE_EXPERIMENT,
        sourceFieldId: plan.candidate.sourceFieldId
    };
    if (hasTraditionalProfileDocumentDeadlineReference(documentItem)) {
        documentItem.pilotDeadlineReference = pilotReference;
    } else {
        documentItem.expiryReference = pilotReference;
    }
    showToast(t('pilot_deadline_created'), 'success');
    return {...plan, action: 'created', deadlineId};
}

export async function markRemovedProfileDocumentPilot(documentItem = {}) {
    if (!documentItem?.id || !auth.currentUser?.uid) return false;
    const deadlines = await listDeadlines(auth.currentUser.uid);
    const matches = matchingProfileDocumentPilotDeadlines(documentItem, deadlines);
    if (matches.length !== 1) return false;
    await markPilotDeadlineForReview(matches[0], 'source-document-removed');
    return true;
}
