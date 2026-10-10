/**
 * BACKEND CORE (V7.3 - NODEMAILER + APP PASSWORD)
 * Sistema notifiche scadenze via Gmail (App Password).
 *
 * Due funzioni:
 * 1. checkDeadlines    → schedulata ogni giorno alle 09:00 (repliche + avviso finale)
 * 2. onScadenzaCreated → trigger Firestore, invio immediato se preavviso già nella finestra
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated, onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { FieldPath, FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getStorage } = require("firebase-admin/storage");
const nodemailer = require("nodemailer");
const deadlineCalendar = require("./deadline-calendar");
const recipientDeliveryLedger = require("./recipient-delivery-ledger");
const crypto = require("crypto");
const { setGlobalOptions } = require("firebase-functions");
const {
    generateRecoveryCode,
    hasRecentAuthentication,
    nextRecoveryAttemptState,
    normalizeRecoveryCode,
    recoveryAttemptId,
    recoveryCodeHash
} = require("./recovery-security");
const {mutationDecision, validateOfflineMutation} = require("./offline-sync-service");
const {buildAcceptanceReceipt} = require("./invite-acceptance-receipt");
const {parseCloudEventTime} = require("./invite-acceptance-event-time");
const {runInviteRevocationNotification, runAcceptanceMarkerCleanup} = require("./invite-revocation-notification");
const {createMutationBinding, verifyMutationResult, currentMutationRevision} = require("./mutation-result-binding");
const {assertPrivateAccountWriteScope, assertPrivateAccountReferenceScope} = require("./private-account-write-scope");
const {buildRestorePreview, staleRestoreIndexes} = require('./backup-restore-preview');
const {preserveRestoreAuthority} = require('./backup-restore-authority');
const {
    privateAccountMutationDecision, validatePrivateAccountMutation
} = require("./private-account-mutation-service");
const {
    RETENTION_MS, restoreDecision, safeAudit, trashDecision, validateRecoveryCommand
} = require("./history-recovery-service");
const {
    accountPath, isSafeAttachmentPath, purgeDecision, planProfileReferenceCleanup, validatePurgeCommand,
    isArchivePurgeSuspended
} = require("./archive-purge-service");
const {isMaturityTestActor} = require("./maturity-rollout-policy");
const {
    decodeFirestoreValue, restoreChunkDecision, safeRestoreAudit, validateRestoreChunk
} = require("./backup-restore-service");
const {createBackupRestoreBinding, verifyBackupRestoreReceipt} = require("./backup-restore-receipt");
const {createArchivePurgeBinding, verifyArchivePurgeReceipt} = require("./archive-purge-receipt");
const {
    acquireGlobalPurgeLock, assertGlobalPurgeLockHeld, assertTransactionGlobalPurgeUnlocked,
    createGlobalPurgeLockBinding, globalPurgeLockRef, releaseGlobalPurgeLock
} = require("./archive-purge-global-lock");
const {createRecoveryBinding, verifyRecoveryReceipt} = require("./recovery-command-receipt");
const {createVaultAccountCallables} = require('./vault-account-runtime');
const {createSharedAttachmentService} = require('./shared-attachment-service');
const {createProfileDocumentAttachmentService} = require('./profile-document-attachment-service');
const {
    accountEventId, accountTransition, auditWriteDecision, buildAuditEvent, inviteRefOf, inviteTransition,
    invitedEventId, removedEventId, responseEventId
} = require("./audit-event-service");
const {
    DEFAULT_BATCH_SIZE, MAX_EVENTS_PER_RUN, auditEventPath, classifyAuditEvent, planAuditRetention,
    runAuditRetention
} = require("./audit-retention-service");

initializeApp();

// Facciata minima per mantenere leggibile la logica esistente usando la API
// modulare richiesta da Firebase Admin 14.
const firestore = () => getFirestore();
firestore.FieldValue = FieldValue;
const admin = { auth: getAuth, firestore, messaging: getMessaging };
setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

const vaultAccounts = createVaultAccountCallables({db: getFirestore(),
    hash: value => crypto.createHash('sha256').update(value).digest('hex'),
    timestamp: () => FieldValue.serverTimestamp(), deleteField: () => FieldValue.delete(), HttpsError});
const sharedAttachments = createSharedAttachmentService({
    db: getFirestore(), deleteField: () => FieldValue.delete(), HttpsError
});
const profileDocumentAttachments = createProfileDocumentAttachmentService({
    db: getFirestore(), bucket: getStorage().bucket(), timestamp: () => FieldValue.serverTimestamp(),
    assertUnlocked: assertTransactionGlobalPurgeUnlocked, HttpsError
});
exports.registerSharingIdentity = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => sharedAttachments.register(request));
exports.publishSharedAttachmentEnvelopes = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => sharedAttachments.publish(request));
exports.uploadProfileDocumentAttachment = onCall(
    {region: 'europe-west1', enforceAppCheck: true, timeoutSeconds: 120, memory: '512MiB'},
    request => profileDocumentAttachments.upload(request));
exports.removeProfileDocumentAttachment = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => profileDocumentAttachments.remove(request));
exports.applyAccountNoteMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.note(request));
exports.applyAccountStandardMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.standard(request));
exports.applyProfileLinkMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.link(request));
exports.applyProfileAccountCreate = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.create(request));
exports.applyProfileTextMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.text(request));
exports.applyPrivateQrSelection = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.privateQr(request));
exports.applyCompanyQrSelection = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.companyQr(request));
exports.applyPrivateDocumentsMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.documents(request));
exports.applyPrivateUtilitiesMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.utilities(request));
exports.applyProfileContactsMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.contacts(request));
exports.applyPrivateAddressesMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.privateAddresses(request));
exports.applyCompanyAddressesMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.companyAddresses(request));
exports.applyCompanyContactsMutation = onCall(
    {region: 'europe-west1', enforceAppCheck: true}, request => vaultAccounts.companyContacts(request));

function verifiedMutationRetry(resultSnapshot, legacySnapshot, binding) {
    if (resultSnapshot.exists) {
        try { return verifyMutationResult(resultSnapshot.data(), binding); }
        catch (error) {
            if (error.code === 'OPERATION_BINDING_MISMATCH') {
                throw new HttpsError('already-exists', 'Identificatore operazione già utilizzato.');
            }
            throw new HttpsError('failed-precondition', 'Esito operazione non verificabile.');
        }
    }
    // Legacy results were owner-writable: never trust or silently reapply them.
    if (legacySnapshot.exists) throw new HttpsError(
        'failed-precondition',
        'Esito precedente da verificare prima di riprovare.',
        {reason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'}
    );
    return null;
}

function verifiedCurrentRevision(recordSnapshot) {
    try { return currentMutationRevision(recordSnapshot.data()); }
    catch { throw new HttpsError('failed-precondition', 'Revisione record non valida.'); }
}

function requireMutationOwner(request, field = 'uid') {
    if (typeof request.data?.[field] !== 'string' || request.data[field] !== request.auth.uid) {
        throw new HttpsError('failed-precondition', 'La sessione della modifica è cambiata. Riapri il modulo.', {
            reason: 'MUTATION_OWNER_MISMATCH'
        });
    }
}

exports.applyOfflineMutation = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        requireMutationOwner(request);
        let operation;
        try {
            operation = validateOfflineMutation(request.data);
        } catch {
            throw new HttpsError("invalid-argument", "Operazione offline non valida.");
        }
        const store = getFirestore();
        const userRef = store.collection("users").doc(request.auth.uid);
        const recordRef = userRef.collection("syncRecords").doc(operation.recordId);
        const resultRef = store.collection("mutationResults").doc(request.auth.uid).collection("operations").doc(operation.operationId);
        const legacyRef = userRef.collection("operationResults").doc(operation.operationId);
        const binding = createMutationBinding({uid: request.auth.uid, domain: 'offline-sync', operation});
        return store.runTransaction(async (transaction) => {
            await assertTransactionGlobalPurgeUnlocked(transaction, store, request.auth.uid);
            const [recordSnapshot, resultSnapshot, legacySnapshot] = await Promise.all([
                transaction.get(recordRef), transaction.get(resultRef), transaction.get(legacyRef)
            ]);
            const previous = verifiedMutationRetry(resultSnapshot, legacySnapshot, binding);
            const currentRevision = verifiedCurrentRevision(recordSnapshot);
            const decision = mutationDecision(
                currentRevision, operation, previous
            );
            if (decision.duplicate) return decision;
            if (decision.status === "applied") {
                transaction.set(recordRef, {
                    schemaVersion: 1,
                    revision: decision.revision,
                    encryptedPayload: operation.encryptedPayload,
                    lastOperationId: operation.operationId,
                    updatedAt: FieldValue.serverTimestamp()
                }, {merge: true});
            }
            transaction.set(resultRef, {
                ...decision,
                ...binding,
                createdAt: FieldValue.serverTimestamp()
            });
            return decision;
        });
    }
);

exports.applyPrivateAccountMutation = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        requireMutationOwner(request);
        let operation;
        try { operation = validatePrivateAccountMutation(request.data); } catch {
            throw new HttpsError("invalid-argument", "Account privato offline non valido.");
        }
        const store = getFirestore();
        const userRef = store.collection("users").doc(request.auth.uid);
        const recordRef = userRef.collection("accounts").doc(operation.recordId);
        const resultRef = store.collection("mutationResults").doc(request.auth.uid).collection("operations").doc(operation.operationId);
        const legacyRef = userRef.collection("operationResults").doc(operation.operationId);
        const binding = createMutationBinding({uid: request.auth.uid, domain: 'private-account', operation});
        return store.runTransaction(async transaction => {
            await assertTransactionGlobalPurgeUnlocked(transaction, store, request.auth.uid);
            const [recordSnapshot, resultSnapshot, legacySnapshot] = await Promise.all([
                transaction.get(recordRef), transaction.get(resultRef), transaction.get(legacyRef)
            ]);
            const previous = verifiedMutationRetry(resultSnapshot, legacySnapshot, binding);
            // A trusted retry reports its original result without mutating the
            // current document, even if its scope has legitimately changed since.
            if (previous) return {...previous, duplicate: true};
            const [profileSnapshot, companiesSnapshot] = await Promise.all([
                transaction.get(userRef), transaction.get(userRef.collection('aziende'))
            ]);
            try {
                if (recordSnapshot.exists) assertPrivateAccountWriteScope({uid: request.auth.uid, record: recordSnapshot.data()});
                assertPrivateAccountReferenceScope({recordId: operation.recordId,
                    record: recordSnapshot.exists ? recordSnapshot.data() : null,
                    profile: profileSnapshot.exists ? profileSnapshot.data() : {},
                    companies: companiesSnapshot.docs.map(snapshot => snapshot.data())});
            } catch {
                throw new HttpsError('failed-precondition', 'Questo Account richiede il percorso di modifica completo.',
                    {reason: 'PRIVATE_ACCOUNT_SCOPE_UNSUPPORTED'});
            }
            const result = privateAccountMutationDecision({
                exists: recordSnapshot.exists,
                currentRevision: verifiedCurrentRevision(recordSnapshot),
                expectedRevision: operation.expectedRevision,
                previous
            });
            if (result.duplicate || result.status === "conflict") return result;
            transaction.set(recordRef, {
                ...operation.record,
                schemaVersion: 1,
                revision: result.revision,
                updatedAt: FieldValue.serverTimestamp()
            }, {merge: recordSnapshot.exists});
            transaction.set(resultRef, {
                ...result,
                ...binding,
                createdAt: FieldValue.serverTimestamp()
            });
            return result;
        });
    }
);

exports.manageSharedVaultData = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    request => require('./reference-callables').createReferenceCallables({
        onCall: (_options, handler) => handler, getFirestore, FieldValue, HttpsError, requireMutationOwner
    }).manageSharedVaultData(request)
);
exports.manageAccountWidget = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    request => require('./reference-callables').createReferenceCallables({
        onCall: (_options, handler) => handler, getFirestore, FieldValue, HttpsError, requireMutationOwner
    }).manageAccountWidget(request)
);
exports.manageWidgetProfile = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    request => require('./reference-callables').createReferenceCallables({
        onCall: (_options, handler) => handler, getFirestore, FieldValue, HttpsError, requireMutationOwner
    }).manageWidgetProfile(request)
);

async function runRecoveryCommand(request, mode) {
    if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
    requireMutationOwner(request, 'expectedOwnerUid');
    let command;
    try { command = validateRecoveryCommand(request.data); } catch {
        throw new HttpsError("invalid-argument", "Comando di recupero non valido.");
    }
    const store = getFirestore();
    const userRef = store.collection("users").doc(request.auth.uid);
    const recordRef = userRef.collection("syncRecords").doc(command.recordId);
    const trashRef = userRef.collection("trash").doc(command.recordId);
    const resultRef = store.collection("mutationResults").doc(request.auth.uid).collection("operations").doc(command.operationId);
    const legacyRef = userRef.collection("operationResults").doc(command.operationId);
    const binding = createRecoveryBinding(request.auth.uid, mode, command);
    return store.runTransaction(async transaction => {
        await assertTransactionGlobalPurgeUnlocked(transaction, store, request.auth.uid);
        const [record, trash, previous, legacy] = await Promise.all([
            transaction.get(recordRef), transaction.get(trashRef), transaction.get(resultRef), transaction.get(legacyRef)
        ]);
        if (previous.exists) {
            try { return verifyRecoveryReceipt(previous.data(), binding); } catch (error) {
                throw new HttpsError(error.code === 'RECOVERY_BINDING_MISMATCH' ? 'already-exists' : 'failed-precondition',
                    'Esito del recupero non verificabile.');
            }
        }
        if (legacy.exists) throw new HttpsError('failed-precondition', 'Esito precedente da verificare.', {
            reason: 'LEGACY_MUTATION_RESULT_UNVERIFIED'
        });
        const result = mode === "trash" ? trashDecision({
            recordExists: record.exists,
            trashExists: trash.exists,
            currentRevision: verifiedCurrentRevision(record),
            expectedRevision: command.expectedRevision,
            alreadyProcessed: previous.exists
        }) : restoreDecision({
            trashExists: trash.exists,
            destinationExists: record.exists,
            trashedRevision: verifiedCurrentRevision(trash),
            expectedRevision: command.expectedRevision,
            alreadyProcessed: previous.exists
        });
        if (result.duplicate || !["trashed", "restored"].includes(result.status)) return result;
        const action = result.status;
        if (mode === "trash") {
            transaction.set(trashRef, {...record.data(), deletedAt: FieldValue.serverTimestamp(), purgeAfterMs: Date.now() + RETENTION_MS});
            transaction.delete(recordRef);
        } else {
            const restored = {...trash.data(), revision: result.revision, restoredAt: FieldValue.serverTimestamp()};
            delete restored.deletedAt; delete restored.purgeAfterMs;
            transaction.set(recordRef, restored); transaction.delete(trashRef);
        }
        transaction.set(resultRef, {...result, ...binding, createdAt: FieldValue.serverTimestamp()});
        transaction.set(userRef.collection("auditEvents").doc(command.operationId), {
            ...safeAudit({action, actorUid: request.auth.uid, recordId: command.recordId, operationId: command.operationId}),
            at: FieldValue.serverTimestamp()
        });
        return result;
    });
}

exports.trashSyncRecord = onCall({region: "europe-west1", enforceAppCheck: true}, request => runRecoveryCommand(request, "trash"));
exports.restoreSyncRecord = onCall({region: "europe-west1", enforceAppCheck: true}, request => runRecoveryCommand(request, "restore"));

exports.purgeArchivedAccount = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        requireMutationOwner(request, 'expectedOwnerUid');
        if (isArchivePurgeSuspended() && !isMaturityTestActor(request.auth)) {
            throw new HttpsError('failed-precondition',
                'Eliminazione definitiva temporaneamente sospesa per sicurezza. Archivio e ripristino restano disponibili.',
                {reason: 'ARCHIVE_PURGE_TEMPORARILY_SUSPENDED'});
        }
        let command;
        try { command = validatePurgeCommand(request.data); } catch {
            throw new HttpsError("invalid-argument", "Comando di eliminazione non valido.");
        }
        if (!command.confirmation) throw new HttpsError("failed-precondition", "Conferma eliminazione mancante.");
        const ownerUid = request.auth.uid;
        let binding;
        try { binding = createArchivePurgeBinding({uid: ownerUid, command}); }
        catch { throw new HttpsError("invalid-argument", "Comando di eliminazione non verificabile."); }
        let lockBinding;
        try { lockBinding = createGlobalPurgeLockBinding({uid: ownerUid, command}); }
        catch { throw new HttpsError("invalid-argument", "Blocco globale della cancellazione non verificabile."); }
        const verifyReceipt = snapshot => {
            try { return verifyArchivePurgeReceipt(snapshot.exists ? snapshot.data() : null, binding); }
            catch { throw new HttpsError("failed-precondition", "Esito della cancellazione non verificabile.",
                {reason: "ARCHIVE_RESULT_UNVERIFIED"}); }
        };
        const store = getFirestore();
        const userRef = store.collection("users").doc(ownerUid);
        const recordRef = store.doc(accountPath(ownerUid, command));
        const operationRef = store.collection("mutationResults").doc(ownerUid).collection("operations").doc(command.operationId);
        const legacyRef = userRef.collection("archiveOperations").doc(command.operationId);
        const lockRef = globalPurgeLockRef(store, ownerUid);
        const planCascadeCleanup = ({widgetsSnapshot, sharedDataSnapshot, linksSnapshot, invitesSnapshot}) => {
            const matchesAccount = value => value && typeof value === 'object' && !Array.isArray(value) &&
                value.accountId === command.accountId &&
                (command.context === 'private' ? !value.companyId : value.companyId === command.companyId);
            const widgets = widgetsSnapshot.docs.filter(snapshot => matchesAccount(snapshot.data()));
            const sharedData = sharedDataSnapshot.docs.filter(snapshot => matchesAccount(snapshot.data()));
            const sharedDataIds = new Set(sharedData.map(snapshot => snapshot.id));
            const links = linksSnapshot.docs.filter(snapshot => {
                const value = snapshot.data();
                return matchesAccount(value) || (typeof value?.sharedDataId === 'string' && sharedDataIds.has(value.sharedDataId));
            });
            const invites = invitesSnapshot.docs.filter(snapshot => {
                const value = snapshot.data();
                return value?.ownerId === ownerUid && matchesAccount(value);
            });
            const references = [...widgets, ...sharedData, ...links, ...invites].map(snapshot => snapshot.ref);
            if (references.length > 440) {
                throw new HttpsError('failed-precondition', 'Pulizia delle condivisioni troppo estesa.',
                    {reason: 'ARCHIVE_PURGE_CASCADE_LIMIT'});
            }
            return references;
        };
        const readCascadeSnapshots = transaction => Promise.all([
            transaction.get(userRef.collection('accountWidgets')),
            transaction.get(userRef.collection('sharedVaultData')),
            transaction.get(userRef.collection('sharedVaultLinks')),
            transaction.get(store.collection('invites').where('ownerId', '==', ownerUid))
        ]).then(([widgetsSnapshot, sharedDataSnapshot, linksSnapshot, invitesSnapshot]) =>
            ({widgetsSnapshot, sharedDataSnapshot, linksSnapshot, invitesSnapshot}));
        const planReferenceCleanup = (profileSnapshot, companiesSnapshot) => {
            const cleanup = [];
            const plan = (snapshot, reference, company) => {
                if (!snapshot.exists) return;
                const patch = planProfileReferenceCleanup(snapshot.data(), command, {company});
                if (Object.keys(patch).length) cleanup.push({reference, patch});
            };
            try {
                plan(profileSnapshot, userRef, false);
                for (const company of companiesSnapshot.docs) plan(company, company.ref, true);
            } catch {
                throw new HttpsError('failed-precondition', 'Riferimenti non verificabili: eliminazione interrotta.');
            }
            if (cleanup.length > 450) throw new HttpsError('failed-precondition', 'Pulizia riferimenti troppo estesa.');
            return cleanup;
        };
        const preparation = await store.runTransaction(async transaction => {
            const [recordSnapshot, operationSnapshot, legacySnapshot, lockSnapshot] = await Promise.all([
                transaction.get(recordRef), transaction.get(operationRef), transaction.get(legacyRef), transaction.get(lockRef)
            ]);
            const previous = operationSnapshot.exists ? verifyReceipt(operationSnapshot) : null;
            if (!previous && legacySnapshot.exists) {
                throw new HttpsError("failed-precondition", "La precedente cancellazione richiede una verifica.",
                    {reason: "LEGACY_ARCHIVE_RESULT_UNVERIFIED"});
            }
            const decision = purgeDecision({
                record: recordSnapshot.exists ? recordSnapshot.data() : null,
                expectedRevision: command.expectedRevision,
                confirmed: command.confirmation,
                previous
            });
            if (decision.duplicate || !["ready", "resume"].includes(decision.status)) return decision;
            // Reject an already unplannable cleanup before deleting any data.
            // This preflight is not a fence against later concurrent writers.
            const [profileSnapshot, companiesSnapshot] = await Promise.all([
                transaction.get(userRef), transaction.get(userRef.collection('aziende'))
            ]);
            planReferenceCleanup(profileSnapshot, companiesSnapshot);
            planCascadeCleanup(await readCascadeSnapshots(transaction));
            const lock = acquireGlobalPurgeLock(lockSnapshot.exists ? lockSnapshot.data() : null, lockBinding);
            if (!lock.duplicate) transaction.set(lockRef, {
                ...lock.record, createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
            });
            if (decision.status === "resume") return decision;
            transaction.set(operationRef, {
                ...binding, status: "processing",
                ...(previous ? {} : {createdAt: FieldValue.serverTimestamp()}), updatedAt: FieldValue.serverTimestamp()
            }, {merge: true});
            return decision;
        });
        if (preparation.duplicate) return preparation;
        if (!["ready", "resume"].includes(preparation.status)) {
            throw new HttpsError("failed-precondition", `Eliminazione non consentita: ${preparation.status}.`);
        }

        const attachments = await recordRef.collection("attachments").get();
        // Missing paths are not absent attachments: preserve their metadata for repair.
        const storagePaths = attachments.docs.map(snapshot => snapshot.data()?.storagePath);
        if (storagePaths.some(path => !isSafeAttachmentPath(ownerUid, command, path))) {
            throw new HttpsError("failed-precondition", "Percorso allegato non sicuro: eliminazione interrotta.");
        }
        const bucket = getStorage().bucket();
        await Promise.all(storagePaths.map(path => bucket.file(path).delete({ignoreNotFound: true})));
        await store.recursiveDelete(recordRef);

        return store.runTransaction(async transaction => {
            // Full query: never silently truncate the set of referring companies.
            // Reads and all planning precede writes; retries re-read current data.
            const [profileSnapshot, companiesSnapshot, receiptSnapshot, currentRecordSnapshot, lockSnapshot, cascadeSnapshots] = await Promise.all([
                transaction.get(userRef), transaction.get(userRef.collection('aziende')), transaction.get(operationRef),
                transaction.get(recordRef), transaction.get(lockRef), readCascadeSnapshots(transaction)
            ]);
            const receipt = verifyReceipt(receiptSnapshot);
            if (receipt.status === 'purged') {
                releaseGlobalPurgeLock(lockSnapshot.exists ? lockSnapshot.data() : null, lockBinding);
                return receipt;
            }
            assertGlobalPurgeLockHeld(lockSnapshot.exists ? lockSnapshot.data() : null, lockBinding);
            if (currentRecordSnapshot.exists) {
                throw new HttpsError('failed-precondition', 'Account ricreato: pulizia riferimenti interrotta.',
                    {reason: 'ARCHIVE_PURGE_ACCOUNT_RECREATED'});
            }
            const cleanup = planReferenceCleanup(profileSnapshot, companiesSnapshot);
            const cascade = planCascadeCleanup(cascadeSnapshots);
            // Conservative write budget including receipt/audit. An oversized or
            // malformed plan leaves processing resumable, never falsely purged.
            if (cleanup.length + cascade.length > 445) {
                throw new HttpsError('failed-precondition', 'Pulizia complessiva troppo estesa.',
                    {reason: 'ARCHIVE_PURGE_CASCADE_LIMIT'});
            }
            for (const {reference, patch} of cleanup) transaction.update(reference, patch);
            for (const reference of cascade) transaction.delete(reference);
            transaction.set(operationRef, {status: "purged", updatedAt: FieldValue.serverTimestamp()}, {merge: true});
            transaction.set(lockRef, {
                ...releaseGlobalPurgeLock(lockSnapshot.data(), lockBinding).record,
                releasedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
            }, {merge: true});
            transaction.set(userRef.collection("auditEvents").doc(command.operationId), {
                action: "account-purged", actorUid: ownerUid, accountId: command.accountId,
                context: command.context, at: FieldValue.serverTimestamp()
            });
            return {status: "purged", duplicate: false};
        });
    }
);

exports.restoreBackupChunk = onCall(
    {region: "europe-west1", enforceAppCheck: true, timeoutSeconds: 120, memory: "512MiB"},
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        let command;
        try { command = validateRestoreChunk(request.data, request.auth.uid); } catch (error) {
            if (error.code === 'BACKUP_SECURITY_SETTINGS_EXCLUDED') {
                throw new HttpsError('failed-precondition',
                    'Le impostazioni di sicurezza del backup sono escluse: quelle attuali vengono mantenute.',
                    {reason: 'BACKUP_SECURITY_SETTINGS_EXCLUDED'});
            }
            if (error.code === "BACKUP_OWNER_MISMATCH") {
                throw new HttpsError("failed-precondition", "La sessione del ripristino è cambiata. Riapri il backup.", {
                    reason: "BACKUP_OWNER_MISMATCH"
                });
            }
            throw new HttpsError("invalid-argument", "Chunk di ripristino non valido.");
        }
        const store = getFirestore();
        const userRef = store.collection("users").doc(request.auth.uid);
        const operationRef = store.collection("mutationResults").doc(request.auth.uid).collection("operations").doc(command.operationId);
        const legacyRef = userRef.collection("backupRestoreOperations").doc(command.operationId);
        const binding = command.mode === "apply" ? createBackupRestoreBinding({uid: request.auth.uid, command}) : null;
        return store.runTransaction(async transaction => {
            await assertTransactionGlobalPurgeUnlocked(transaction, store, request.auth.uid);
            const references = command.records.map(record => store.doc(record.path));
            const [previous, legacy, ...snapshots] = await Promise.all([
                transaction.get(operationRef), transaction.get(legacyRef),
                ...references.map(reference => transaction.get(reference))
            ]);
            if (command.mode === "apply") {
                if (previous.exists) {
                    try { return verifyBackupRestoreReceipt(previous.data(), binding); }
                    catch {
                        throw new HttpsError("failed-precondition", "Esito del ripristino non compatibile con la richiesta.",
                            {reason: "BACKUP_RESULT_UNVERIFIED"});
                    }
                }
                if (legacy.exists) {
                    throw new HttpsError("failed-precondition", "Il precedente ripristino richiede una verifica.",
                        {reason: "LEGACY_BACKUP_RESULT_UNVERIFIED"});
                }
            }
            const collisions = snapshots
                .map((snapshot, index) => snapshot.exists
                    ? command.records[index].path : null)
                .filter(Boolean);
            const decision = restoreChunkDecision({
                previous: null,
                collisions,
                overwriteExisting: command.mode === "apply" && command.overwriteExisting && command.overwriteConfirmed
            });
            if (command.mode === "preview") return {...decision, ...buildRestorePreview(command.records, snapshots)};
            if (!command.confirmed) throw new HttpsError("failed-precondition", "Conferma ripristino mancante.");
            const staleIndexes = staleRestoreIndexes(command.records, snapshots);
            if (staleIndexes.length) return {status: 'stale-preview', duplicate: false, staleCount: staleIndexes.length, staleIndexes};
            if (decision.status !== "ready") return decision;
            command.records.forEach((record, index) => {
                const data = decodeFirestoreValue(record.data, {
                    timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds),
                    bytes: value => Buffer.from(value)
                });
                transaction.set(references[index], preserveRestoreAuthority(record.path, data,
                    snapshots[index].exists ? snapshots[index].data() : null),
                {merge: record.path === `users/${request.auth.uid}`});
            });
            const result = {status: "applied", duplicate: false, recordCount: command.records.length};
            transaction.set(operationRef, {
                ...result, ...binding,
                appliedAt: FieldValue.serverTimestamp()
            });
            transaction.set(userRef.collection("auditEvents").doc(command.operationId), {
                ...safeRestoreAudit({
                    uid: request.auth.uid, operationId: command.operationId, backupId: command.backupId,
                    chunkIndex: command.chunkIndex, recordCount: command.records.length
                }),
                at: FieldValue.serverTimestamp()
            });
            return result;
        });
    }
);

exports.getAppPresentation = onRequest(
    { region: "europe-west1", cors: false },
    async (request, response) => {
        if (request.method !== "GET") {
            response.set("Allow", "GET").status(405).send("Metodo non consentito.");
            return;
        }

        const authorization = String(request.get("Authorization") || "");
        const idToken = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
        if (!idToken) {
            response.status(401).send("Accesso richiesto.");
            return;
        }

        try {
            await admin.auth().verifyIdToken(idToken);
            const file = getStorage().bucket().file("app-media/presentazione/codici-password-v2.mp4");
            const [metadata] = await file.getMetadata();
            response.set({
                "Content-Type": "video/mp4",
                "Content-Length": metadata.size,
                "Cache-Control": "private, no-store, max-age=0",
                "X-Content-Type-Options": "nosniff"
            });
            file.createReadStream()
                .on("error", (error) => {
                    console.error("[PRESENTAZIONE] Lettura Storage fallita", error);
                    if (!response.headersSent) response.status(404).send("Video non disponibile.");
                    else response.destroy(error);
                })
                .pipe(response);
        } catch (error) {
            console.warn("[PRESENTAZIONE] Richiesta rifiutata", error.message);
            response.status(401).send("Accesso non valido.");
        }
    }
);

// Segreti cifrati (salvati su Google Secret Manager)
const GMAIL_USER = defineSecret("GMAIL_USER");
const GMAIL_APP_PASSWORD = defineSecret("GMAIL_APP_PASSWORD");
const FIREBASE_WEB_API_KEY = "AIzaSyDDt-PacoHtUQg6Ow7-1UxvrGVZLXVYx-o";

exports.createMfaRecoveryCodes = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        if (!hasRecentAuthentication(request.auth.token)) {
            throw new HttpsError("failed-precondition", "Accedi nuovamente prima di generare i codici.");
        }
        const user = await admin.auth().getUser(request.auth.uid);
        const hasTotp = user.multiFactor?.enrolledFactors?.some((factor) => factor.factorId === "totp");
        if (!hasTotp) throw new HttpsError("failed-precondition", "Attiva prima la 2FA Authenticator.");

        const codes = Array.from({ length: 10 }, generateRecoveryCode);
        await admin.firestore().collection("mfaRecovery").doc(user.uid).set({
            codeHashes: codes.map(recoveryCodeHash),
            remaining: codes.length,
            version: 1,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        return { codes };
    }
);

exports.recoverMfaWithCode = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        const email = String(request.data?.email || "").trim().toLowerCase();
        const password = String(request.data?.password || "");
        if (!email || !password || normalizeRecoveryCode(request.data?.recoveryCode).length !== 16) {
            throw new HttpsError("invalid-argument", "Dati di recupero non validi.");
        }

        const db = admin.firestore();
        const ipAddress = request.rawRequest?.ip || request.rawRequest?.socket?.remoteAddress || "unknown";
        const attemptRef = db.collection("mfaRecoveryAttempts").doc(recoveryAttemptId(email, ipAddress));
        let recoveryAttemptAllowed = false;
        await db.runTransaction(async (transaction) => {
            const attemptSnap = await transaction.get(attemptRef);
            let next;
            try {
                next = nextRecoveryAttemptState(attemptSnap.exists ? attemptSnap.data() : null);
            } catch (error) {
                if (error?.message !== 'RECOVERY_ATTEMPT_STATE') throw error;
                throw new HttpsError("failed-precondition", "Recupero non disponibile: verifica dello stato di sicurezza necessaria. Nessun codice consumato.");
            }
            recoveryAttemptAllowed = next.allowed;
            transaction.set(attemptRef, {
                emailHash: crypto.createHash("sha256").update(email, "utf8").digest("hex"),
                attempts: next.attempts,
                windowStartedAt: next.windowStartedAt,
                blockedUntil: next.blockedUntil,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });
        });
        if (!recoveryAttemptAllowed) {
            throw new HttpsError("resource-exhausted", "Troppi tentativi. Riprova più tardi.");
        }

        // Verifica il primo fattore con Firebase Auth senza creare una sessione applicativa.
        const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ email, password, returnSecureToken: true })
        });
        const authResult = await response.json();
        const authenticatedUid = authResult?.localId;
        const firstFactorAccepted = response.ok && typeof authenticatedUid === "string" &&
            authenticatedUid.length > 0 && !authenticatedUid.includes("/") &&
            (typeof authResult.idToken === "string" && authResult.idToken.length > 0 ||
                typeof authResult.mfaPendingCredential === "string" && authResult.mfaPendingCredential.length > 0);
        if (!firstFactorAccepted) throw new HttpsError("permission-denied", "Credenziali o codice di recupero non validi.");

        const user = await admin.auth().getUser(authenticatedUid);
        if (user.uid !== authenticatedUid || user.disabled ||
            typeof user.email !== "string" || user.email.trim().toLowerCase() !== email) {
            throw new HttpsError("permission-denied", "Credenziali o codice di recupero non validi.");
        }
        const enrolledFactors = Array.isArray(user.multiFactor?.enrolledFactors)
            ? user.multiFactor.enrolledFactors : [];
        if (enrolledFactors.length === 0) {
            throw new HttpsError("failed-precondition",
                "Nessun secondo fattore attivo da recuperare. Nessun codice è stato consumato.");
        }
        throw new HttpsError("failed-precondition",
            "Recupero MFA automatico non disponibile. Contatta l'assistenza: nessun codice è stato consumato.");
    }
);

exports.revokeAllSessions = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        await admin.auth().revokeRefreshTokens(request.auth.uid);
        return { ok: true };
    }
);

function sanitizeEmail(email) {
    return String(email || "").toLowerCase().replace(/[^a-zA-Z0-9]/g, "_") || "unknown_guest";
}

function pushText(scadenza, diffDays) {
    const tipo = String(scadenza.type || scadenza.templateText || "Scadenza").trim();
    const veicolo = String(scadenza.veicolo_modello || "").trim();
    const when = diffDays === 0 ? "Scade oggi" : diffDays === 1 ? "Scade domani" : `Scadenza tra ${diffDays} giorni`;
    return { title: "Codici & Password", body: `${tipo}${veicolo ? ` · ${veicolo}` : ""}\n${when}` };
}

function normalizeEmail(email) {
    return String(email || "").trim().toLowerCase();
}

function deadlineRecipients(scadenza) {
    const source = Array.isArray(scadenza.recipients) && scadenza.recipients.length
        ? scadenza.recipients
        : [scadenza.email1, scadenza.email2].filter(Boolean).map((email) => ({ email, sendEmail: true, sendPush: false }));
    const unique = new Map();
    for (const item of source) {
        const email = normalizeEmail(item?.email || item?.address || item);
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue;
        const previous = unique.get(email);
        unique.set(email, {
            email,
            displayName: String(item?.displayName || item?.name || previous?.displayName || "").trim().slice(0, 120),
            sendEmail: (previous?.sendEmail === true) || item?.sendEmail !== false,
            sendPush: (previous?.sendPush === true) || item?.sendPush === true,
            canManage: (previous?.canManage === true) || item?.canManage === true
        });
    }
    return [...unique.values()];
}

function receivedDeadlineId(ownerUid, deadlineId) {
    return crypto.createHash("sha256").update(`${ownerUid}:${deadlineId}`).digest("hex").slice(0, 40);
}

function receivedDeadlineShareRef(db, ownerUid, deadlineId) {
    return db.collection("deadlineShares").doc(receivedDeadlineId(ownerUid, deadlineId));
}

function receivedDeadlineData(owner, ownerUid, deadlineId, scadenza, recipient) {
    return {
        schemaVersion: 1,
        ownerUid,
        ownerLabel: String(owner.displayName || owner.email || "Utente").trim().slice(0, 120),
        sourceDeadlineId: deadlineId,
        recipientEmail: recipient.email,
        permission: recipient.canManage ? "manage" : "view",
        name: String(scadenza.name || "").slice(0, 160),
        type: String(scadenza.type || scadenza.category || "Scadenza").slice(0, 160),
        title: String(scadenza.title || "").slice(0, 200),
        veicolo_modello: String(scadenza.veicolo_modello || "").slice(0, 160),
        dueDate: String(scadenza.dueDate || ""),
        notes: String(scadenza.notes || "").slice(0, 4000),
        referenceUrl: String(scadenza.referenceUrl || scadenza.url || "").slice(0, 2048),
        completed: scadenza.completed === true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
}

async function resolveRecipientUsers(recipients, ownerUid) {
    const resolved = new Map();
    for (const recipient of recipients.filter((item) => item.sendPush || item.canManage)) {
        try {
            const user = await admin.auth().getUserByEmail(recipient.email);
            if (user.uid !== ownerUid) resolved.set(user.uid, { recipient, user });
        } catch (error) {
            if (error.code !== "auth/user-not-found") {
                console.error("[RECEIVED DEADLINE LOOKUP FAILED]", error.code || error.message);
            }
        }
    }
    return resolved;
}

async function syncReceivedDeadlines(db, ownerUid, deadlineId, scadenza, previousScadenza = null) {
    const owner = await admin.auth().getUser(ownerUid);
    const current = await resolveRecipientUsers(deadlineRecipients(scadenza), ownerUid);
    const previous = previousScadenza
        ? await resolveRecipientUsers(deadlineRecipients(previousScadenza), ownerUid)
        : new Map();
    const shareId = receivedDeadlineId(ownerUid, deadlineId);
    const shareRef = receivedDeadlineShareRef(db, ownerUid, deadlineId);
    const shareSnapshot = await shareRef.get();
    const recordedRecipientUids = Array.isArray(shareSnapshot.data()?.recipientUids)
        ? shareSnapshot.data().recipientUids.filter((uid) => typeof uid === "string" && uid)
        : [];
    for (const uid of recordedRecipientUids) previous.set(uid, previous.get(uid) || {});
    const batch = db.batch();

    for (const [recipientUid] of previous) {
        if (!current.has(recipientUid)) {
            batch.delete(db.collection("users").doc(recipientUid).collection("receivedDeadlines").doc(shareId));
        }
    }
    for (const [recipientUid, resolved] of current) {
        const ref = db.collection("users").doc(recipientUid).collection("receivedDeadlines").doc(shareId);
        batch.set(ref, receivedDeadlineData(owner, ownerUid, deadlineId, scadenza, resolved.recipient), { merge: true });
    }
    batch.set(shareRef, {
        ownerUid,
        deadlineId,
        recipientUids: [...current.keys()],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    await batch.commit();
    return current;
}

async function removeReceivedDeadlines(db, ownerUid, deadlineId, scadenza) {
    const recipients = await resolveRecipientUsers(deadlineRecipients(scadenza), ownerUid);
    const shareId = receivedDeadlineId(ownerUid, deadlineId);
    const shareRef = receivedDeadlineShareRef(db, ownerUid, deadlineId);
    const shareSnapshot = await shareRef.get();
    const recordedRecipientUids = Array.isArray(shareSnapshot.data()?.recipientUids)
        ? shareSnapshot.data().recipientUids.filter((uid) => typeof uid === "string" && uid)
        : [];
    for (const uid of recordedRecipientUids) recipients.set(uid, recipients.get(uid) || {});
    const batch = db.batch();
    for (const [recipientUid] of recipients) {
        batch.delete(db.collection("users").doc(recipientUid).collection("receivedDeadlines").doc(shareId));
    }
    batch.delete(shareRef);
    await batch.commit();
}

function shouldSendPush(scadenza, diffDays, forceImmediate = false, lastField = "lastPushNotifiedAt") {
    if (diffDays === 0) return true;
    if (forceImmediate) return true;
    const frequency = Math.max(1, Number(scadenza.notif_frequency || 7));
    if (!scadenza[lastField]) return true;
    const lastDay = deadlineCalendar.day(scadenza[lastField]);
    if (lastDay === null) return true;
    return deadlineCalendar.distance(lastDay, deadlineCalendar.day(new Date())) >= frequency;
}

async function activePushDevices(db, uid, scope = "deadlines") {
    const snap = await db.collection("users").doc(uid).collection("pushDevices")
        .where("enabled", "==", true).get();
    return snap.docs.filter((item) => {
        const data = item.data();
        const scopes = Array.isArray(data.notificationScopes) ? data.notificationScopes : [data.notificationScope];
        return scopes.includes(scope) && data.token;
    });
}

async function sendRecipientDeadlinePushes(db, ownerUid, deadlineId, scadenza, diffDays, options = {}) {
    const sharedRecipients = await syncReceivedDeadlines(db, ownerUid, deadlineId, scadenza);
    const recipients = deadlineRecipients(scadenza).filter((recipient) => recipient.sendPush);
    if (!recipients.length) return;
    const text = pushText(scadenza, diffDays);
    let sent = 0;
    const deadlineRef = db.collection("users").doc(ownerUid).collection("scadenze").doc(deadlineId);
    for (const recipient of recipients) {
        let recipientUser;
        try { recipientUser = await admin.auth().getUserByEmail(recipient.email); }
        catch (error) {
            if (error.code !== "auth/user-not-found") console.error("[RECIPIENT LOOKUP FAILED]", "RECIPIENT_LOOKUP_FAILED");
            continue;
        }
        if (!sharedRecipients.has(recipientUser.uid)) continue;
        const shareId = receivedDeadlineId(ownerUid, deadlineId);
        const recipientBody = recipient.canManage
            ? `${text.body}\nSe la gestisci tu, apri l'app e aggiorna la prossima data.`
            : `${text.body}\nApri l'app per consultare la scadenza ricevuta.`;
        const devices = await activePushDevices(db, recipientUser.uid, "deadlines");
        for (const device of devices) {
            try {
                const outcome = await recipientDeliveryLedger.deliver({db,
                    identity: {ownerUid, deadlineId, dueDate: scadenza.dueDate,
                        recipient: JSON.stringify([recipientUser.uid, device.id]), channel: "push"},
                    frequency: scadenza.notif_frequency, forceImmediate: options.forceImmediate === true,
                    legacyLastSentAt: scadenza.lastRecipientPushNotifiedAt,
                    now: () => Date.now(),
                    eligible: async () => {
                        if (!await recipientDeliveryLedger.isEligible({docRef: deadlineRef, dueDate: scadenza.dueDate,
                            recipient, channel: "push", recipients: deadlineRecipients, now: () => Date.now()})) return false;
                        const current = await device.ref.get();
                        const data = current.data();
                        const scopes = Array.isArray(data?.notificationScopes) ? data.notificationScopes : [data?.notificationScope];
                        return current.exists && data.enabled === true && data.token === device.data().token && scopes.includes("deadlines");
                    },
                    send: () => admin.messaging().send({
                    token: device.data().token,
                    data: {
                        eventType: "external_deadline",
                        receivedDeadlineId: shareId,
                        title: text.title,
                        body: recipientBody,
                        deliveryTag: `external-${deadlineId}-${device.id}`
                    },
                    webpush: { headers: { TTL: diffDays === 0 ? "21600" : "86400", Urgency: "high" } }
                    })
                });
                if (outcome.status === "sent") sent += 1;
                if (outcome.status === "policy-blocked") console.error("[RECIPIENT LEDGER]", "CADENCE_RETENTION_DECISION_REQUIRED");
            } catch (error) {
                const invalid = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(error.code);
                if (invalid) await db.runTransaction(async transaction => {
                    const current = await transaction.get(device.ref);
                    if (current.exists && current.data().token === device.data().token) {
                        transaction.set(device.ref, {enabled: false, status: "invalid",
                            invalidatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
                    }
                });
                console.error("[RECIPIENT PUSH FAILED]", "RECIPIENT_DELIVERY_FAILED");
            }
        }
    }
    // Informational only: per-recipient/device ledger controls retries/cadence.
    if (sent > 0) {
        await db.collection("users").doc(ownerUid).collection("scadenze").doc(deadlineId)
            .update({ lastRecipientPushNotifiedAt: deadlineCalendar.day(new Date()) });
    }
    console.log(`[RECIPIENT PUSH] ${deadlineId}: ${sent} dispositivi raggiunti`);
}

async function sendDeadlinePush(db, uid, deadlineId, scadenza, diffDays, options = {}) {
    if (!shouldSendPush(scadenza, diffDays, options.forceImmediate === true)) return;
    const dueVersion = String(scadenza.dueDate || "").replace(/[^0-9]/g, "").slice(0, 14);
    const previousPush = String(scadenza.lastPushNotifiedAt || "initial").replace(/[^0-9a-zA-Z]/g, "");
    const stage = diffDays === 0 ? "D0" : `after_${previousPush}`;
    const notificationId = `${deadlineId}_${dueVersion}_${stage}`.replace(/[^a-zA-Z0-9_-]/g, "_");
    const notificationRef = db.collection("users").doc(uid).collection("deadlineNotifications").doc(notificationId);
    await db.runTransaction(async (transaction) => {
        const existing = await transaction.get(notificationRef);
        if (!existing.exists) {
            transaction.set(notificationRef, {
                eventType: "deadline", deadlineId, dueDate: String(scadenza.dueDate), diffDays,
                status: "unread", createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }
    });

    const devices = await activePushDevices(db, uid);
    const text = pushText(scadenza, diffDays);
    let acceptedCount = 0;
    let retryableFailure = false;

    for (const device of devices) {
        const deliveryId = `${notificationId}_${device.id}`.replace(/[^a-zA-Z0-9_-]/g, "_");
        const deliveryRef = db.collection("users").doc(uid).collection("notificationDeliveries").doc(deliveryId);
        const reserved = await db.runTransaction(async (transaction) => {
            const existing = await transaction.get(deliveryRef);
            if (existing.exists && existing.data().status === "sent") return false;
            if (existing.exists && existing.data().status === "sending") {
                const updatedAt = existing.data().updatedAt?.toMillis?.() || 0;
                if (Date.now() - updatedAt < 10 * 60 * 1000) return false;
            }
            transaction.set(deliveryRef, {
                eventType: "deadline", deadlineId, deviceId: device.id, channel: "push", stage,
                dueDate: String(scadenza.dueDate), status: "sending", attempts: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            return true;
        });
        if (!reserved) continue;

        try {
            await admin.messaging().send({
                token: device.data().token,
                data: {
                    eventType: "deadline", deadlineId, notificationId, title: text.title, body: text.body,
                    deliveryTag: deliveryId
                },
                webpush: { headers: { TTL: diffDays === 0 ? "21600" : "86400", Urgency: "high" } }
            });
            await deliveryRef.set({ status: "sent", sentAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            acceptedCount += 1;
        } catch (error) {
            const invalid = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"]
                .includes(error.code);
            await deliveryRef.set({
                status: "failed", errorCode: String(error.code || "unknown").slice(0, 120),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
            if (invalid) await device.ref.set({ enabled: false, status: "invalid", invalidatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
            else retryableFailure = true;
            console.error(`[PUSH FAILED] ${deadlineId}/${device.id}:`, error.code || error.message);
        }
    }

    if ((acceptedCount > 0 || devices.length === 0) && !retryableFailure) {
        await db.collection("users").doc(uid).collection("scadenze").doc(deadlineId).update({
            lastPushNotifiedAt: deadlineCalendar.day(new Date())
        });
    }
}

exports.sendDeadlinePushTest = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        const deviceId = String(request.data?.deviceId || "");
        if (!/^[a-f0-9-]{36}$/i.test(deviceId)) throw new HttpsError("invalid-argument", "Dispositivo non valido.");
        const db = admin.firestore();
        const deviceRef = db.collection("users").doc(request.auth.uid).collection("pushDevices").doc(deviceId);
        const device = await deviceRef.get();
        if (!device.exists || !device.data().enabled || device.data().notificationScope !== "deadlines") {
            throw new HttpsError("failed-precondition", "Notifiche non attive su questo dispositivo.");
        }
        const now = Date.now();
        const lastTest = device.data().lastTestAt?.toMillis?.() || 0;
        if (now - lastTest < 60000) {
            return { ok: false, cooldownSeconds: Math.ceil((60000 - (now - lastTest)) / 1000) };
        }
        await deviceRef.set({ lastTestAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        const today = deadlineCalendar.day(new Date());
        const deadlines = await db.collection("users").doc(request.auth.uid).collection("scadenze")
            .where("completed", "==", false).get();
        const upcoming = deadlines.docs.map((item) => {
            const data = item.data();
            const dueDay = deadlineCalendar.day(data.dueDate);
            return { id: item.id, data, dueDay };
        }).filter((item) => item.dueDay !== null && deadlineCalendar.distance(today, item.dueDay) >= 0)
            .sort((left, right) => left.dueDay.localeCompare(right.dueDay))[0];

        const deadlineId = upcoming?.id || "";
        const diffDays = upcoming ? deadlineCalendar.distance(today, upcoming.dueDay) : 0;
        const text = upcoming
            ? pushText(upcoming.data, diffDays)
            : { title: "Codici & Password", body: "Notifica scadenza di prova" };
        try {
            await admin.messaging().send({
                token: device.data().token,
                data: {
                    eventType: "deadline", deadlineId, title: text.title, body: text.body,
                    deliveryTag: `deadline-test-${deviceId}-${now}`
                },
                webpush: { headers: { TTL: "300", Urgency: "high" } }
            });
            return { ok: true, opensDeadline: Boolean(deadlineId) };
        } catch (error) {
            console.error("[PUSH TEST FAILED]", error.code || error.message);
            throw new HttpsError("internal", "Invio della notifica di prova non riuscito.");
        }
    }
);

function validFutureIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const candidate = new Date(`${value}T00:00:00Z`);
    if (Number.isNaN(candidate.getTime()) || candidate.toISOString().slice(0, 10) !== value) return false;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return candidate >= today;
}

async function notifyDeadlineOwner(db, ownerUid, deadlineId, title, body) {
    const devices = await activePushDevices(db, ownerUid, "deadlines");
    await Promise.allSettled(devices.map((device) => admin.messaging().send({
        token: device.data().token,
        data: {
            eventType: "deadline",
            deadlineId,
            title,
            body,
            deliveryTag: `managed-${deadlineId}-${Date.now()}-${device.id}`
        },
        webpush: { headers: { TTL: "86400", Urgency: "high" } }
    })));
}

exports.manageReceivedDeadline = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        requireMutationOwner(request, 'expectedOwnerUid');
        const shareId = String(request.data?.receivedDeadlineId || "");
        const action = String(request.data?.action || "");
        const nextDueDate = String(request.data?.nextDueDate || "");
        if (!/^[a-f0-9]{40}$/.test(shareId) || !["complete", "renew"].includes(action)) {
            throw new HttpsError("invalid-argument", "Operazione sulla scadenza non valida.");
        }
        if (action === "renew" && !validFutureIsoDate(nextDueDate)) {
            throw new HttpsError("invalid-argument", "Inserisci una prossima data valida, da oggi in avanti.");
        }

        const db = admin.firestore();
        const recipientUid = request.auth.uid;
        const recipientEmail = normalizeEmail(request.auth.token.email);
        const receivedRef = db.collection("users").doc(recipientUid).collection("receivedDeadlines").doc(shareId);
        let ownerUid;
        let deadlineId;
        let deadlineLabel;

        await db.runTransaction(async (transaction) => {
            const received = await transaction.get(receivedRef);
            if (!received.exists) throw new HttpsError("not-found", "Scadenza ricevuta non trovata.");
            const shared = received.data();
            if (shared.permission !== "manage" || normalizeEmail(shared.recipientEmail) !== recipientEmail) {
                throw new HttpsError("permission-denied", "Non puoi gestire questa scadenza.");
            }

            ownerUid = String(shared.ownerUid || "");
            deadlineId = String(shared.sourceDeadlineId || "");
            const sourceRef = db.collection("users").doc(ownerUid).collection("scadenze").doc(deadlineId);
            const sourceSnapshot = await transaction.get(sourceRef);
            if (!sourceSnapshot.exists) throw new HttpsError("not-found", "La scadenza originale non esiste più.");
            const source = sourceSnapshot.data();
            const stillAuthorized = deadlineRecipients(source)
                .some((recipient) => recipient.email === recipientEmail && recipient.canManage);
            if (!stillAuthorized) throw new HttpsError("permission-denied", "Il permesso di gestione è stato revocato.");

            deadlineLabel = String(source.type || source.templateText || "la scadenza").slice(0, 120);
            const actor = {
                uid: recipientUid,
                email: recipientEmail,
                name: String(request.auth.token.name || shared.recipientEmail || "Destinatario").slice(0, 120)
            };
            const sourceUpdate = {
                completed: action === "complete",
                lastManagedBy: actor,
                lastManagedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            const receivedUpdate = {
                completed: action === "complete",
                managedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            };
            if (action === "renew") {
                sourceUpdate.dueDate = nextDueDate;
                receivedUpdate.dueDate = nextDueDate;
            }
            transaction.update(sourceRef, sourceUpdate);
            transaction.update(receivedRef, receivedUpdate);
        });

        const actorName = String(request.auth.token.name || recipientEmail || "Il destinatario").slice(0, 120);
        const formattedDate = action === "renew"
            ? new Date(`${nextDueDate}T00:00:00Z`).toLocaleDateString("it-IT")
            : "";
        const body = action === "renew"
            ? `${actorName} ha aggiornato ${deadlineLabel} al ${formattedDate}.`
            : `${actorName} ha segnato ${deadlineLabel} come gestita.`;
        await notifyDeadlineOwner(db, ownerUid, deadlineId, "Scadenza condivisa aggiornata", body);
        return { ok: true, action, dueDate: nextDueDate || null };
    }
);

exports.respondToInvitation = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        const inviteId = String(request.data?.inviteId || "");
        const status = String(request.data?.status || "");
        if (!inviteId || !["accepted", "rejected"].includes(status)) {
            throw new HttpsError("invalid-argument", "Risposta invito non valida.");
        }

        const uid = request.auth.uid;
        const email = String(request.auth.token.email || "").toLowerCase().trim();
        if (!email) throw new HttpsError("permission-denied", "Email verificabile mancante.");

        const firestore = admin.firestore();
        const inviteRef = firestore.collection("invites").doc(inviteId);
        // M7-AUDIT-4: base opaca generata una sola volta per invocazione, quindi
        // stabile anche se la transazione viene ritentata. È usata solo quando
        // l'invito non ha un `auditRef` valido (invito legacy o marcatore corrotto).
        const responseRef = crypto.randomUUID();
        // Independent of client auditRef; stable across transaction retries.
        const acceptanceNonce = crypto.randomUUID();
        const auditOutcome = await firestore.runTransaction(async (transaction) => {
            // Esito dell'audit del tentativo **in corso**: Firestore può rieseguire
            // questa callback, quindi vale solo il tentativo che arriva al commit. Il
            // codice di salto è locale al tentativo: quello di un tentativo scartato
            // non deve sopravvivere e far loggare un salto che non è avvenuto.
            let auditSkipCode = null;
            const inviteSnap = await transaction.get(inviteRef);
            if (!inviteSnap.exists) throw new HttpsError("not-found", "Invito non trovato.");
            const invite = inviteSnap.data();
            if (invite.status !== "pending") throw new HttpsError("failed-precondition", "Invito già elaborato.");
            if (String(invite.recipientEmail || "").toLowerCase().trim() !== email) {
                throw new HttpsError("permission-denied", "Non sei il destinatario dell'invito.");
            }

            await assertTransactionGlobalPurgeUnlocked(transaction, firestore, invite.ownerId);

            const accountPath = invite.aziendaId
                ? `users/${invite.ownerId}/aziende/${invite.aziendaId}/accounts/${invite.accountId}`
                : `users/${invite.ownerId}/accounts/${invite.accountId}`;
            const accountRef = firestore.doc(accountPath);
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists) throw new HttpsError("not-found", "Account condiviso non trovato.");

            const account = accountSnap.data();
            // M7-R7B3: un Account nell'Archivio è sospeso. La risposta a un invito
            // pendente non deve riattivare la condivisione né modificare l'invito:
            // si fallisce con un errore chiaro e senza alcuna scrittura. La lettura
            // dell'Account avviene dentro la transazione, quindi un'archiviazione
            // concorrente fra lettura e scrittura provoca il ritentativo e questo
            // controllo viene rieseguito sullo stato aggiornato.
            if (account.isArchived === true) {
                throw new HttpsError("failed-precondition",
                    "Account nell'Archivio: l'invito resta in attesa finché l'Account è sospeso.",
                    {reason: "ACCOUNT_ARCHIVED"});
            }
            // M7-R7C-1: il ciclo dell'invito deve coincidere con quello dell'Account.
            // Assenza = ciclo legacy 0; valori non interi, negativi o non sicuri
            // vengono rifiutati invece di essere interpretati. L'incremento del ciclo
            // avviene nella stessa transazione dell'archiviazione, quindi una
            // risposta tardiva a un invito del ciclo precedente è negata e non può
            // ricreare `sharedWithUids` dopo il ripristino.
            const cycleOf = value => value === undefined ? 0
                : (Number.isSafeInteger(value) && value >= 0 ? value : null);
            const inviteCycle = cycleOf(invite.cycle);
            const accountCycle = cycleOf(account.sharingCycle);
            if (inviteCycle === null || accountCycle === null || inviteCycle !== accountCycle) {
                throw new HttpsError("failed-precondition",
                    "Invito non più valido: l'Account è cambiato. Serve un nuovo invito.",
                    {reason: "INVITE_CYCLE_STALE"});
            }
            const sharedWith = { ...(account.sharedWith || {}) };
            const guestKey = sanitizeEmail(email);
            const guest = sharedWith[guestKey];
            if (!guest || String(guest.email || "").toLowerCase().trim() !== email) {
                throw new HttpsError("permission-denied", "Destinatario non presente nella condivisione.");
            }
            sharedWith[guestKey] = { ...guest, status, uid: status === "accepted" ? uid : null };
            const acceptedGuests = Object.values(sharedWith).filter((item) => item?.status === "accepted" && item?.uid);
            const sharedWithUids = [...new Set(acceptedGuests.map((item) => item.uid))];
            const hasActive = Object.values(sharedWith).some((item) => ["pending", "accepted"].includes(item?.status));

            // M7-AUDIT-4 (opzione A, decisione D-7) — evento del registro tecnico
            // scritto nella stessa transazione della risposta: un errore Firestore
            // ferma insieme risposta ed evento, quindi il registro non contiene mai
            // una riga per un'azione non avvenuta. Un payload non valido è la sola
            // classe controllabile e non blocca la risposta: si annota un codice
            // stabile e si prosegue senza evento.
            let auditBase = null;
            // Marcatore assente o corrotto: non è un errore fatale, si ripiega sulla
            // base casuale senza toccare `auditRef`.
            try { auditBase = inviteRefOf(invite); } catch { auditBase = null; }
            // Invito legacy (o marcatore corrotto): la scrittura originaria è questa
            // callable, quindi la base opaca diventa `responseRef`, persistito
            // sull'invito come `responseAuditRef` per la futura rimozione (M7-AUDIT-3P-R1).
            const auditLegacy = auditBase === null;
            if (auditLegacy) auditBase = responseRef;
            let auditPlan = null;
            try {
                const auditFields = {
                    actorUid: invite.ownerId,
                    accountId: invite.accountId,
                    context: invite.aziendaId || "privato",
                    cycle: inviteCycle,
                    guestKnown: status === "accepted"
                };
                if (status === "accepted") auditFields.guestUid = uid;
                const auditId = responseEventId(auditBase, status);
                auditPlan = {
                    id: auditId,
                    path: `users/${invite.ownerId}/auditEvents/${auditId}`,
                    payload: buildAuditEvent(`invite-${status}`, auditFields)
                };
            } catch (error) {
                auditPlan = null;
                auditSkipCode = String((error && error.code) || "AUDIT_EVENT_INVALID");
            }
            // Letture prima delle scritture: il documento evento si legge nella fase
            // di lettura della transazione, prima della prima `update` (vincolo reale
            // di Firestore, non stilistico).
            let auditWrite = false;
            if (auditPlan) {
                const auditSnapshot = await transaction.get(firestore.doc(auditPlan.path));
                try {
                    auditWrite = auditWriteDecision(auditSnapshot.exists === true, auditPlan).write;
                } catch (error) {
                    auditWrite = false;
                    auditSkipCode = String((error && error.code) || "AUDIT_DECISION_INVALID");
                }
            }

            transaction.update(accountRef, {
                sharedWith,
                sharedWithUids,
                acceptedCount: acceptedGuests.length,
                visibility: hasActive ? "shared" : "private",
                updatedAt: new Date().toISOString()
            });
            const invitePatch = {
                status,
                guestUid: status === "accepted" ? uid : null,
                respondedAt: new Date().toISOString()
            };
            if (auditLegacy) invitePatch.responseAuditRef = responseRef;
            // Never retain an earlier recipient binding after a new response.
            invitePatch.acceptanceReceipt = FieldValue.delete();
            if (status === "accepted") {
                try {
                    invitePatch.acceptanceReceipt = buildAcceptanceReceipt({
                        nonce: acceptanceNonce, guestUid: uid, ownerUid: invite.ownerId,
                        accountId: invite.accountId, kind: invite.aziendaId ? "company" : "private",
                        companyId: invite.aziendaId || null, cycle: inviteCycle
                    });
                } catch {
                    // Conservative unsupported identifiers: response remains compatible,
                    // but no authoritative revocation notification can be generated.
                }
            }
            transaction.update(inviteRef, invitePatch);
            // Create-if-absent: un evento già presente non viene riscritto, quindi
            // `at` resta quello della prima scrittura.
            if (auditPlan && auditWrite) {
                transaction.set(firestore.doc(auditPlan.path), {
                    ...auditPlan.payload, at: FieldValue.serverTimestamp()
                });
            }
            return {auditSkipCode};
        });
        if (auditOutcome.auditSkipCode) {
            // Nessun dato dell'invito nei log: solo un codice stabile, l'azione e un
            // correlatore casuale. Email, chiave sanificata e id del documento invito
            // non devono mai finire nei log.
            console.warn("[AUDIT] evento saltato", {
                code: auditOutcome.auditSkipCode, action: `invite-${status}`, correlationId: responseRef
            });
        }
        return { ok: true, status };
    }
);

// Separate from audit trigger: audit skips must not suppress N1 handling.
exports.onInviteDeletedNotification = onDocumentDeleted(
    {document: "invites/{inviteId}", region: "europe-west1", retry: true,
        memory: "256MiB", timeoutSeconds: 60},
    async event => {
        const parsed = parseCloudEventTime(event.time);
        if (!parsed.ok || !event.data) return;
        await runInviteRevocationNotification({db: admin.firestore(), inviteId: event.params.inviteId,
            before: event.data.data(), eventTimeMillis: parsed.millis,
            now: () => Date.now(), serverTimestamp: () => FieldValue.serverTimestamp()});
    }
);

// Logical expiry is 30 days; bounded periodic physical cleanup may run later.
exports.cleanupInviteRevocationMarkers = onSchedule(
    {schedule: "30 3 * * *", timeZone: "Europe/Rome", region: "europe-west1",
        memory: "512MiB", timeoutSeconds: 540, retryCount: 3},
    async () => runAcceptanceMarkerCleanup({db: admin.firestore(),
        statePath: "sharingNotificationRetention/scan", limit: 100,
        now: () => Date.now(), serverTimestamp: () => FieldValue.serverTimestamp()})
);

function contactMatchesDeadline(deadline, contactId, email) {
    const recipients = Array.isArray(deadline.recipients) ? deadline.recipients : [];
    if (recipients.some((item) => String(item?.contactId || "") === contactId || normalizeEmail(item?.email || item?.address) === email)) return true;
    const legacy = [deadline.email1, deadline.email2, ...(Array.isArray(deadline.emails) ? deadline.emails : [])];
    return legacy.some((item) => normalizeEmail(typeof item === "object" ? item?.address : item) === email);
}

function contactMatchesShare(account, email) {
    if (Object.values(account.sharedWith || {}).some((item) => normalizeEmail(item?.email) === email)) return true;
    if (Array.isArray(account.sharedWithEmails) && account.sharedWithEmails.some((item) => normalizeEmail(item) === email)) return true;
    return normalizeEmail(account.recipientEmail) === email;
}

exports.deleteContactIfUnused = onCall(
    { region: "europe-west1", enforceAppCheck: true },
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        const contactId = String(request.data?.contactId || "").trim();
        if (!/^[A-Za-z0-9_-]{1,160}$/.test(contactId)) throw new HttpsError("invalid-argument", "Destinatario non valido.");

        const uid = request.auth.uid;
        const store = admin.firestore();
        const contactRef = store.collection("users").doc(uid).collection("contacts").doc(contactId);
        const contactSnap = await contactRef.get();
        if (!contactSnap.exists) throw new HttpsError("not-found", "Destinatario non trovato.");
        const email = normalizeEmail(contactSnap.data().emailNormalized || contactSnap.data().email);
        if (!email) throw new HttpsError("failed-precondition", "Il destinatario non possiede un'email valida.");

        const usage = { deadlines: 0, shares: 0, invites: 0 };
        const deadlinesSnap = await store.collection("users").doc(uid).collection("scadenze").get();
        deadlinesSnap.forEach((item) => {
            if (contactMatchesDeadline(item.data(), contactId, email)) usage.deadlines += 1;
        });

        const privateAccountsSnap = await store.collection("users").doc(uid).collection("accounts").get();
        privateAccountsSnap.forEach((item) => {
            if (contactMatchesShare(item.data(), email)) usage.shares += 1;
        });
        const companiesSnap = await store.collection("users").doc(uid).collection("aziende").get();
        for (const company of companiesSnap.docs) {
            const companyAccounts = await company.ref.collection("accounts").get();
            companyAccounts.forEach((item) => {
                if (contactMatchesShare(item.data(), email)) usage.shares += 1;
            });
        }

        const inviteDocs = new Map();
        const [ownerInvites, senderInvites] = await Promise.all([
            store.collection("invites").where("ownerId", "==", uid).get(),
            store.collection("invites").where("senderId", "==", uid).get()
        ]);
        [...ownerInvites.docs, ...senderInvites.docs].forEach((item) => inviteDocs.set(item.id, item));
        inviteDocs.forEach((item) => {
            if (normalizeEmail(item.data().recipientEmail) === email) usage.invites += 1;
        });

        if (usage.deadlines || usage.shares || usage.invites) return { deleted: false, usage };
        return store.runTransaction(async transaction => {
            // Il controllo d'uso sopra e' soltanto una preflight. La cancellazione
            // effettiva deve partecipare al fence M7: se una purge acquisisce il
            // lock nel frattempo, Firestore ritenta questa transazione e il writer
            // fallisce chiuso senza toccare il profilo.
            await assertTransactionGlobalPurgeUnlocked(transaction, store, uid);
            const current = await transaction.get(contactRef);
            if (!current.exists) return { deleted: true, usage };
            transaction.delete(contactRef);
            return { deleted: true, usage };
        });
    }
);

// ─────────────────────────────────────────────────────────────
// UTILITY — Crea il trasportatore Nodemailer
// ─────────────────────────────────────────────────────────────
function createTransporter(gmailUser, gmailPass) {
    return nodemailer.createTransport({
        service: "gmail",
        auth: { user: gmailUser, pass: gmailPass },
    });
}

exports.onInviteCreated = onDocumentCreated(
    {
        document: "invites/{inviteId}",
        secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async (event) => {
        const invite = event.data.data();
        if (invite.status !== "pending") return;
        const recipientEmail = normalizeEmail(invite.recipientEmail);
        if (!recipientEmail) return;
        const tasks = [];
        if (invite.notifyEmail === true) {
            const transporter = createTransporter(GMAIL_USER.value(), GMAIL_APP_PASSWORD.value());
            tasks.push(transporter.sendMail({
                from: `"Codex Notifiche" <${GMAIL_USER.value()}>`,
                to: recipientEmail,
                subject: "Invito a un account condiviso — Codici & Password",
                html: `<p>Hai ricevuto un invito per un account condiviso in Codici & Password.</p><p>Apri l'app per accettarlo o rifiutarlo.</p><p><a href="https://appcodici-password.web.app/">Apri o installa Codici & Password</a></p>`
            }));
        }
        if (invite.notifyPush === true) {
            tasks.push((async () => {
                let recipientUser;
                try { recipientUser = await admin.auth().getUserByEmail(recipientEmail); }
                catch (error) {
                    if (error.code !== "auth/user-not-found") throw error;
                    return;
                }
                const devices = await activePushDevices(admin.firestore(), recipientUser.uid, "sharing");
                await Promise.allSettled(devices.map((device) => admin.messaging().send({
                    token: device.data().token,
                    data: {
                        eventType: "share_invite",
                        title: "Nuovo invito — Codici & Password",
                        body: `Hai ricevuto un invito per ${String(invite.accountName || "un account condiviso").slice(0, 100)}.`,
                        deliveryTag: `share-${event.params.inviteId}`
                    },
                    webpush: { headers: { TTL: "86400", Urgency: "high" } }
                })));
            })());
        }
        const results = await Promise.allSettled(tasks);
        results.filter((result) => result.status === "rejected")
            .forEach(() => console.error("[INVITE NOTIFICATION FAILED] DELIVERY_FAILED"));
    }
);

// ─────────────────────────────────────────────────────────────
// M7-AUDIT-5I — Registro tecnico degli inviti
// ─────────────────────────────────────────────────────────────
// Trigger **separato** da `onInviteCreated`, che porta i segreti Gmail: qui non
// si invia nulla, non si legge l'email del destinatario, la sua chiave
// sanificata o l'id del documento invito (che la contiene), e non si tocca la
// condivisione. Si scrive una sola riga nel registro del **proprietario**
// dell'invito, con id opaco derivato dalla base dell'istanza (`auditRef`, o
// `responseAuditRef` per un invito legacy già risposto) e create-if-absent, così
// una riconsegna non duplica l'evento né riscrive `at`. Senza base opaca valida
// non si inventa alcuna riga: la scelta D-5 registrata da Codex il 21/09/2026
// preferisce una riga mancante a una riga sintetica indistinguibile.
exports.onInviteWritten = onDocumentWritten(
    {
        document: "invites/{inviteId}",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
        // Gli eventi da trigger sono at-least-once: l'idempotenza dell'id è
        // l'unica difesa contro i duplicati, e il ritentativo va dichiarato.
        retry: true,
    },
    async (event) => {
        const before = event.data?.before?.data() ?? null;
        const after = event.data?.after?.data() ?? null;
        const transition = inviteTransition(before, after);
        if (transition.kind === "none") {
            // Un marcatore presente ma malformato è un difetto di registrazione,
            // non di sicurezza: si annota un codice stabile e non si scrive nulla.
            if (transition.reason === "AUDIT_REF_INVALID") {
                console.warn("[AUDIT] invito ignorato: base opaca non valida", {code: transition.reason});
            }
            return;
        }
        const removed = transition.kind === "invite-removed";
        const source = removed ? before : after;
        const action = removed ? "invite-removed" : "invite-created";
        let effect;
        try {
            const fields = {
                actorUid: source.ownerId,
                accountId: source.accountId,
                context: source.aziendaId || "privato",
                cycle: source.cycle === undefined ? 0 : source.cycle
            };
            if (removed) {
                // Il correlatore del destinatario solo se già noto: su un rifiuto
                // la callable scrive `guestUid: null`, quindi resta anonimo.
                const known = typeof source.guestUid === "string" && source.guestUid.length > 0;
                fields.guestKnown = known;
                if (known) fields.guestUid = source.guestUid;
            } else if (typeof source.createdAt === "string") {
                fields.inviteCreatedAt = source.createdAt;
            }
            effect = {
                id: removed ? removedEventId(transition.ref) : invitedEventId(transition.ref),
                payload: buildAuditEvent(action, fields)
            };
        } catch (error) {
            // Classe controllabile: payload non valido. Nessun evento e una sola
            // riga, senza dati dell'invito e senza messaggi grezzi.
            console.warn("[AUDIT] evento invito saltato", {
                code: String((error && error.code) || "AUDIT_EVENT_INVALID")
            });
            return;
        }
        const eventDocument = firestore().doc(`users/${source.ownerId}/auditEvents/${effect.id}`);
        await firestore().runTransaction(async (transaction) => {
            const snapshot = await transaction.get(eventDocument);
            const decision = auditWriteDecision(snapshot.exists === true, effect);
            if (decision.write) {
                transaction.set(eventDocument, {...decision.payload, at: FieldValue.serverTimestamp()});
            }
        });
    }
);

// ─────────────────────────────────────────────────────────────
// M7-AUDIT-5A — Registro tecnico di archiviazione e ripristino degli Account
// ─────────────────────────────────────────────────────────────
// Due trigger `onDocumentUpdated`, uno per percorso: l'identità dell'Account
// viene dal **percorso autorevole** (`event.params`) e il tipo è un parametro
// esplicito — mai dedotto dal valore di `context` — così un'azienda il cui id è
// `privato` non collide con il profilo privato (M7-AUDIT-3-R2). Si scrive una
// sola riga nel registro del proprietario, con id opaco `${chiaveAccount}:${revision}`
// e create-if-absent, quindi una riconsegna — o un secondo ciclo
// archivia→ripristina→archivia — non sovrascrive nulla.
//
// **Metrica dei contatori (correzione M7-AUDIT-5A).** Il documento Account non
// contiene i contatori delle transazioni client e il trigger **non può** sapere
// quanti **documenti invito** siano stati aggiornati: quei contatori vivono solo
// in memoria nel client (`settings/archive-account-service.js:185-259` e
// `:290-356`) e una voce di condivisione può non avere alcun invito. Il payload
// usa quindi nomi espliciti — `suspendedSharingEntries` /
// `neutralizedSharingEntries` — e conta le **voci di `sharedWith` che passano da
// `pending`/`accepted` a `suspended`** confrontando `before` e `after`: una voce
// già sospesa prima non viene ricontata e un ripristino **non** neutralizzato
// vale **0**, anche se nel documento restano voci sospese. La metrica differisce
// **deliberatamente** dall'esito del client (che conta documenti invito): sono
// due quantità diverse e il registro non promette la seconda. `neutralized` e
// `sharingCycle` restano separati e derivati dall'avanzamento del ciclo, che la
// transazione di ripristino compie esattamente quando neutralizza (`:235-248`).
async function recordAccountTransitionAudit(type, event) {
    const before = event.data?.before?.data() ?? null;
    const after = event.data?.after?.data() ?? null;
    const transition = accountTransition(before, after);
    if (transition.kind === "none") return;
    const archived = transition.kind === "account-archived";
    const params = event.params || {};
    let effect;
    try {
        const descriptor = type === "privato"
            ? {type: "privato", accountId: params.accountId}
            : {type: "azienda", companyId: params.aziendaId, accountId: params.accountId};
        const beforeSharing = before ? before.sharedWith : undefined;
        const afterSharing = after.sharedWith;
        for (const sharing of [beforeSharing, afterSharing]) {
            if (sharing !== undefined && (typeof sharing !== "object" || sharing === null || Array.isArray(sharing))) {
                const invalid = new Error("AUDIT_FIELD_INVALID");
                invalid.code = "AUDIT_FIELD_INVALID";
                throw invalid;
            }
        }
        // Voci portate in stato `suspended` da questa scrittura: non i documenti
        // invito (che il trigger non può contare) e non le voci già sospese.
        const wasActive = entry => entry?.status === "pending" || entry?.status === "accepted";
        const suspended = Object.keys(afterSharing || {}).filter(key =>
            wasActive(beforeSharing ? beforeSharing[key] : undefined)
            && afterSharing[key]?.status === "suspended").length;
        const sharingCycle = after.sharingCycle === undefined ? 0 : after.sharingCycle;
        const previousCycle = before.sharingCycle === undefined ? 0 : before.sharingCycle;
        const fields = {
            actorUid: params.uid,
            accountId: params.accountId,
            context: type === "privato" ? "privato" : params.aziendaId,
            cycle: sharingCycle,
            revision: after.revision,
            sharingCycle
        };
        if (archived) {
            fields.suspendedSharingEntries = suspended;
        } else {
            fields.neutralized = sharingCycle !== previousCycle;
            fields.neutralizedSharingEntries = suspended;
        }
        effect = {
            id: accountEventId(descriptor, after.revision),
            payload: buildAuditEvent(transition.kind, fields)
        };
    } catch (error) {
        // Classe controllabile: dati del documento non validi. Nessun evento e
        // una sola riga con codice stabile, senza dati dell'Account; la
        // scrittura di archiviazione o ripristino è già committata e non viene
        // toccata.
        console.warn("[AUDIT] evento Account saltato", {
            code: String((error && error.code) || "AUDIT_EVENT_INVALID"), action: transition.kind
        });
        return;
    }
    const eventDocument = firestore().doc(`users/${params.uid}/auditEvents/${effect.id}`);
    await firestore().runTransaction(async (transaction) => {
        const snapshot = await transaction.get(eventDocument);
        const decision = auditWriteDecision(snapshot.exists === true, effect);
        if (decision.write) {
            transaction.set(eventDocument, {...decision.payload, at: FieldValue.serverTimestamp()});
        }
    });
}

exports.onPrivateAccountWritten = onDocumentUpdated(
    {
        document: "users/{uid}/accounts/{accountId}",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
        retry: true,
    },
    (event) => recordAccountTransitionAudit("privato", event)
);

exports.onCompanyAccountWritten = onDocumentUpdated(
    {
        document: "users/{uid}/aziende/{aziendaId}/accounts/{accountId}",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
        retry: true,
    },
    (event) => recordAccountTransitionAudit("azienda", event)
);

// ─────────────────────────────────────────────────────────────
// UTILITY — Componi e invia una email per una scadenza
// ─────────────────────────────────────────────────────────────
function escapeHtml(value) {
    return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
        .replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function sendScadenzaEmail(transporter, gmailUser, s, diffDays, docRef) {
    const dueDay = deadlineCalendar.day(s.dueDate);
    if (dueDay === null) throw new Error("Data scadenza non valida.");
    const dueDateFormatted = deadlineCalendar.format(dueDay);

    const templateText = s.templateText || s.type || "una scadenza";
    const veicolo = s.veicolo_modello ? ` ${escapeHtml(s.veicolo_modello)}` : "";

    const giorniLabel =
        diffDays === 0 ? "⚠️ OGGI" :
        diffDays === 1 ? "domani" :
        `tra ${diffDays} giorni`;

    const emailBody = `
<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: Arial, sans-serif; background: #f5f5f5; margin: 0; padding: 20px; }
    .card { background: white; border-radius: 12px; padding: 30px; max-width: 500px; margin: 0 auto; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #667eea, #764ba2); color: white; border-radius: 8px; padding: 20px; text-align: center; margin-bottom: 24px; }
    .header h1 { margin: 0; font-size: 20px; }
    .label { color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4px; }
    .value { color: #222; font-size: 16px; font-weight: bold; margin-bottom: 16px; }
    .badge { display: inline-block; background: #fff3cd; color: #856404; border-radius: 20px; padding: 6px 16px; font-size: 14px; font-weight: bold; margin-bottom: 20px; }
    .button { display: inline-block; background: #2563eb; color: white !important; text-decoration: none; border-radius: 8px; padding: 12px 18px; font-size: 14px; font-weight: bold; }
    .footer { color: #aaa; font-size: 11px; text-align: center; margin-top: 24px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="header">
      <h1>⏰ Promemoria Scadenza</h1>
    </div>
    <p>Gentile <strong>${escapeHtml(s.name || "Utente")}</strong>,</p>
    <p>ti ricordiamo che sta per scadere:</p>

    <div class="label">Oggetto</div>
    <div class="value">📋 ${escapeHtml(templateText)}${veicolo}</div>

    <div class="label">Categoria</div>
    <div class="value">🏷️ ${escapeHtml(s.type || "—")}</div>

    <div class="label">Data scadenza</div>
    <div class="value">📅 ${dueDateFormatted}</div>

    <div class="badge">⏳ Scade ${giorniLabel}</div>

    ${s.notes ? `<div class="label">Note</div><div class="value" style="font-weight:normal;color:#555;">${escapeHtml(s.notes)}</div>` : ""}

    <p style="color:#555;font-size:14px;">Provvedi al rinnovo per tempo.</p>

    <div class="footer">
      — Codex Security System &nbsp;|&nbsp; Notifica automatica<br>
      <strong>Inviato da Codex</strong>
    </div>
  </div>
</body>
</html>`;

    const recipients = deadlineRecipients(s).filter((recipient) => recipient.sendEmail);
    if (!recipients.length) return false;
    const ownerUid = docRef.parent.parent.id;
    const results = await Promise.allSettled(recipients.map(async (recipient) => {
        let appUrl = "https://appcodici-password.web.app/";
        let buttonLabel = "Apri o installa Codici & Password";
        if (recipient.sendPush || recipient.canManage) {
            try {
                const recipientUser = await admin.auth().getUserByEmail(recipient.email);
                if (recipientUser.uid !== ownerUid) {
                    const shareId = receivedDeadlineId(ownerUid, docRef.id);
                    appUrl = `https://appcodici-password.web.app/dettaglio_scadenza.html?received=${shareId}`;
                    buttonLabel = "Apri la scadenza nell'app";
                }
            } catch (error) {
                if (error.code !== "auth/user-not-found") {
                    console.error("[EMAIL RECIPIENT LOOKUP FAILED]", "EMAIL_LOOKUP_FAILED");
                }
            }
        }
        const instruction = recipient.canManage
            ? "Se gestisci tu questa scadenza, apri l'app per registrare l'esecuzione o aggiornare la prossima data."
            : "Apri l'app per consultare la scadenza ricevuta.";
        const callToAction = `<div style="text-align:center;margin:24px 0;"><p style="color:#555;font-size:14px;">${instruction}</p><a class="button" href="${appUrl}">${buttonLabel}</a></div>`;
        return recipientDeliveryLedger.deliver({db: docRef.firestore,
            identity: {ownerUid, deadlineId: docRef.id, dueDate: s.dueDate, recipient: recipient.email, channel: "email"},
            frequency: s.notif_frequency, legacyLastSentAt: s.lastNotifiedAt, now: () => Date.now(),
            eligible: () => recipientDeliveryLedger.isEligible({docRef, dueDate: s.dueDate, recipient,
                channel: "email", recipients: deadlineRecipients, now: () => Date.now()}),
            send: () => transporter.sendMail({
            from: `"Codex Notifiche" <${gmailUser}>`,
            to: recipient.email,
            subject: `⚠️ Scadenza in arrivo — ${s.type || templateText}`,
            html: emailBody.replace('    <div class="footer">', `${callToAction}\n    <div class="footer">`),
            })
        });
    }));
    const sentCount = results.filter((result) => result.status === "fulfilled" && result.value.status === "sent").length;
    if (results.some(result => result.value?.status === "policy-blocked")) console.error("[RECIPIENT LEDGER]", "CADENCE_RETENTION_DECISION_REQUIRED");
    results.filter((result) => result.status === "rejected").forEach(() => console.error("[EMAIL RECIPIENT FAILED]", "EMAIL_DELIVERY_FAILED"));
    if (!sentCount) {
        if (results.some(result => result.status === "rejected" || result.value?.status === "uncertain")) throw new Error("Nessun destinatario email raggiunto.");
        return false;
    }

    // Informational only: never suppress failed recipients with a global marker.
    await docRef.update({
        lastNotifiedAt: deadlineCalendar.day(new Date()),
    });

    console.log(`[OK] Email inviata a ${sentCount}/${recipients.length} destinatari (diffDays: ${diffDays})`);
    return true;
}

// ─────────────────────────────────────────────────────────────
// FUNZIONE 1 — Schedulata ogni giorno alle 09:00
// ─────────────────────────────────────────────────────────────
exports.checkDeadlines = onSchedule(
    {
        schedule: "0 9 * * *",
        timeZone: "Europe/Rome",
        secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 120,
    },
    async () => {
        const db = admin.firestore();
        const today = deadlineCalendar.day(new Date());

        const gmailUser = GMAIL_USER.value();
        const gmailPass = GMAIL_APP_PASSWORD.value();
        const transporter = createTransporter(gmailUser, gmailPass);

        console.log(`[SCHEDULER] Controllo scadenze: ${today}`);

        try {
            try { await recipientDeliveryLedger.cleanup(db); }
            catch { console.error("[RECIPIENT LEDGER CLEANUP]", "CLEANUP_FAILED"); }
            const usersSnap = await db.collection("users").get();

            for (const userDoc of usersSnap.docs) {
                const uid = userDoc.id;
                const scadenzeSnap = await db
                    .collection("users").doc(uid)
                    .collection("scadenze")
                    .where("completed", "==", false)
                    .get();

                for (const sDoc of scadenzeSnap.docs) {
                    const s = sDoc.data();
                    if (!s.dueDate) continue;

                    const dueDay = deadlineCalendar.day(s.dueDate);
                    if (dueDay === null) continue;
                    const diffDays = deadlineCalendar.distance(today, dueDay);
                    if (diffDays === null) continue;

                    const daysBefore = s.notif_days_before || 14;

                    // Scadenze già passate: stop
                    if (diffDays < 0) continue;
                    // Fuori dalla finestra: troppo presto
                    if (diffDays > daysBefore) continue;

                    // Il canale Push usa un registro separato e non interferisce con le email.
                    try {
                        await sendDeadlinePush(db, uid, sDoc.id, s, diffDays);
                    } catch (pushErr) {
                        console.error(`[PUSH FAILED] ${sDoc.id}:`, pushErr.message);
                    }

                    try {
                        await sendRecipientDeadlinePushes(db, uid, sDoc.id, s, diffDays);
                    } catch (pushErr) {
                        console.error(`[RECIPIENT PUSH FAILED] ${sDoc.id}:`, pushErr.message);
                    }

                    if (!deadlineRecipients(s).some((recipient) => recipient.sendEmail)) continue;

                    // Each recipient owns its cadence; a global partial-success
                    // marker must never suppress another recipient's retry.

                    try {
                        await sendScadenzaEmail(transporter, gmailUser, s, diffDays, sDoc.ref);
                    } catch (emailErr) {
                        console.error(`[EMAIL FAILED] ${sDoc.id}:`, emailErr.message);
                    }
                }
            }

            console.log("[SCHEDULER] Controllo completato.");
        } catch (err) {
            console.error("[CRITICAL ERROR]", err.message);
        }
    }
);

// ─────────────────────────────────────────────────────────────
// FUNZIONE 2 — Trigger Firestore: invio immediato alla creazione
// ─────────────────────────────────────────────────────────────
exports.onScadenzaCreated = onDocumentCreated(
    {
        document: "users/{uid}/scadenze/{scadenzaId}",
        secrets: [GMAIL_USER, GMAIL_APP_PASSWORD],
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async (event) => {
        const s = event.data.data();
        const docRef = event.data.ref;

        try {
            await syncReceivedDeadlines(admin.firestore(), event.params.uid, event.params.scadenzaId, s);
        } catch (error) {
            console.error(`[RECEIVED DEADLINE SYNC FAILED] ${event.params.scadenzaId}:`, error.message);
        }

        // Verifica campi minimi
        if (!s.dueDate || s.completed) return;

        const today = deadlineCalendar.day(new Date());
        const dueDay = deadlineCalendar.day(s.dueDate);
        if (dueDay === null) return;
        const diffDays = deadlineCalendar.distance(today, dueDay);
        if (diffDays === null) return;

        const daysBefore = s.notif_days_before || 14;

        // Scadenza già passata o fuori dalla finestra → niente da fare
        if (diffDays < 0 || diffDays > daysBefore) return;

        try {
            await sendDeadlinePush(admin.firestore(), event.params.uid, event.params.scadenzaId, s, diffDays, {
                forceImmediate: true
            });
        } catch (pushErr) {
            console.error(`[TRIGGER PUSH FAILED] ${event.params.scadenzaId}:`, pushErr.message);
        }

        try {
            await sendRecipientDeadlinePushes(admin.firestore(), event.params.uid, event.params.scadenzaId, s, diffDays, {
                forceImmediate: true
            });
        } catch (pushErr) {
            console.error(`[TRIGGER RECIPIENT PUSH FAILED] ${event.params.scadenzaId}:`, pushErr.message);
        }

        if (!deadlineRecipients(s).some((recipient) => recipient.sendEmail)) return;

        console.log(`[TRIGGER] Nuova scadenza creata — diffDays: ${diffDays}, preavviso: ${daysBefore}`);

        const gmailUser = GMAIL_USER.value();
        const gmailPass = GMAIL_APP_PASSWORD.value();
        const transporter = createTransporter(gmailUser, gmailPass);

        try {
            await sendScadenzaEmail(transporter, gmailUser, s, diffDays, docRef);
            console.log(`[TRIGGER] Email immediata inviata per scadenza ${event.params.scadenzaId}`);
        } catch (err) {
            console.error(`[TRIGGER EMAIL FAILED]:`, err.message);
        }
    }
);

exports.onScadenzaUpdated = onDocumentUpdated(
    {
        document: "users/{uid}/scadenze/{scadenzaId}",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async (event) => {
        const before = event.data.before.data();
        const after = event.data.after.data();
        try {
            await syncReceivedDeadlines(
                admin.firestore(), event.params.uid, event.params.scadenzaId, after, before
            );
        } catch (error) {
            console.error(`[RECEIVED DEADLINE SYNC FAILED] ${event.params.scadenzaId}:`, error.message);
        }
        const completedNow = !before.completed && after.completed === true;
        const dueDateChanged = String(before.dueDate || "") !== String(after.dueDate || "");
        if (!completedNow && !dueDateChanged) return;

        const db = admin.firestore();
        const notifications = await db.collection("users").doc(event.params.uid)
            .collection("deadlineNotifications")
            .where("deadlineId", "==", event.params.scadenzaId).get();
        const batch = db.batch();
        notifications.docs.forEach((item) => batch.set(item.ref, {
            status: "resolved",
            resolvedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true }));
        if (dueDateChanged) {
            batch.update(event.data.after.ref, {
                lastPushNotifiedAt: admin.firestore.FieldValue.delete(),
                lastRecipientPushNotifiedAt: admin.firestore.FieldValue.delete(),
                lastNotifiedAt: admin.firestore.FieldValue.delete()
            });
        }
        await batch.commit();
    }
);

exports.onScadenzaDeleted = onDocumentDeleted(
    {
        document: "users/{uid}/scadenze/{scadenzaId}",
        region: "europe-west1",
        memory: "256MiB",
        timeoutSeconds: 60,
    },
    async (event) => {
        try {
            await removeReceivedDeadlines(
                admin.firestore(), event.params.uid, event.params.scadenzaId, event.data.data()
            );
        } catch (error) {
            console.error(`[RECEIVED DEADLINE CLEANUP FAILED] ${event.params.scadenzaId}:`, error.message);
        }
    }
);

// ─────────────────────────────────────────────────────────────
// M7-AUDIT-6 — Retention del registro tecnico (24 mesi di calendario)
// ─────────────────────────────────────────────────────────────
// Job pianificato che cancella **solo** gli eventi scaduti e databili di
// `users/{uid}/auditEvents`. La logica pura (finestra, data efficace,
// classificazione, piano, esecuzione) sta in `./audit-retention-service`; qui
// vivono la scoperta e la cancellazione confermata.
//
// Difese sul confinamento: la scoperta usa una query di **gruppo di collezioni**
// (così trova anche le sottocollezioni il cui documento padre `users/{uid}` non
// esiste), ma ogni risultato viene ricondotto al percorso atteso da
// `auditEventPath(uid, id)` e **respinto** se non coincide: un `auditEvents`
// annidato altrove non viene mai cancellato.
//
// Conferma atomica: la via rapida usa una precondizione di versione
// (`delete(ref, {lastUpdateTime})`), quindi cancella solo la versione che il
// classificatore ha dichiarato scaduta; se il documento è cambiato o sparito la
// transazione di ripiego rilegge la **versione corrente**, la riclassifica e
// cancella solo ciò che è ancora scaduto.
const AUDIT_RETENTION_PAGE_SIZE = 200;
const AUDIT_RETENTION_MAX_BATCHES_PER_RUN = 50;
// Tetto **per proprietario**: senza di esso un singolo proprietario con uno
// storico enorme consumerebbe l'intero budget del run e gli altri non
// progredirebbero (rilievo della revisione M7-AUDIT-6).
const AUDIT_RETENTION_MAX_BATCHES_PER_OWNER = 10;
// Tetto di **scansione**: conta le **letture** effettive (percorsi respinti e
// duplicati compresi), non i documenti raccolti, ed è separato dal budget di
// cancellazione: i documenti vecchi ma non cancellabili non devono impedire di
// raggiungere gli eventi scaduti che vengono dopo.
const AUDIT_RETENTION_MAX_SCAN = 20_000;
// Stato del job: un cursore per campo, così la scansione **avanza fra i run**
// anche quando il prefisso non cancellabile è più lungo del tetto di scansione.
// È un documento di servizio, fuori dal registro e fuori dai dati utente: il job
// non lo cancella mai e il client non può leggerlo né scriverlo (nessuna regola
// lo copre, quindi vale il diniego predefinito di Firestore).
const AUDIT_RETENTION_STATE_PATH = "auditRetentionState/scan";
// Finestra grossolana della query: 24 mesi di calendario sono sempre almeno 730
// giorni, quindi 700 giorni è un sovrainsieme sicuro di ciò che può essere
// scaduto. Il classificatore resta l'unica autorità sulla cancellazione.
const AUDIT_RETENTION_COARSE_CUTOFF_MS = 700 * 24 * 60 * 60 * 1000;
// Campi su cui il job cerca la data efficace: `at` per tutte le famiglie,
// `createdAt` per le due che non scrivono `at` (la politica la applica il
// classificatore, non la query).
const AUDIT_RETENTION_DATE_FIELDS = Object.freeze(["at", "createdAt"]);
const FIREBASE_FAILED_PRECONDITION = 9;

function isPreconditionFailure(error) {
    const code = error?.code;
    return code === FIREBASE_FAILED_PRECONDITION || code === "failed-precondition" ||
        /FAILED_PRECONDITION|PRECONDITION/i.test(String(error?.message || ""));
}

function usableCursor(cursor) {
    return Boolean(cursor) && typeof cursor.path === "string" && cursor.path.length > 0 &&
        cursor.value !== undefined && cursor.value !== null;
}

// I cursori sono dati di servizio: un contenuto malformato non deve fermare la
// retention, si riparte semplicemente dall'inizio di quel campo.
async function readAuditRetentionCursors(db) {
    const snapshot = await db.doc(AUDIT_RETENTION_STATE_PATH).get();
    const stored = snapshot.exists ? snapshot.data() : null;
    const cursors = {};
    for (const field of AUDIT_RETENTION_DATE_FIELDS) {
        const candidate = stored?.cursors?.[field];
        cursors[field] = usableCursor(candidate) ? {value: candidate.value, path: candidate.path} : null;
    }
    return cursors;
}

async function saveAuditRetentionCursors(db, cursors) {
    const stored = {};
    for (const field of AUDIT_RETENTION_DATE_FIELDS) {
        const cursor = cursors[field];
        stored[field] = usableCursor(cursor) ? {value: cursor.value, path: cursor.path} : null;
    }
    await db.doc(AUDIT_RETENTION_STATE_PATH).set(
        {cursors: stored, updatedAt: FieldValue.serverTimestamp()}, {merge: false});
}

// Scoperta: due query di gruppo (una per campo, perché un filtro di intervallo
// non ne copre due), paginazione con cursore sull'**istantanea completa** —
// stabile anche quando più proprietari hanno lo stesso id — e deduplica per
// percorso completo.
//
// `cursors` sono i cursori di partenza (uno per campo, `null` = dall'inizio) e
// `cursors` nel risultato sono quelli aggiornati: avanzano quando la scansione
// del campo è stata interrotta dal tetto di letture, tornano `null` quando la
// query è esaurita (il giro successivo riparte dall'inizio, così nessun evento
// resta fuori per sempre). `truncated` dice se il tetto di **letture** è stato
// raggiunto con altre pagine da leggere: in quel caso il job non può dichiarare
// il completamento.
async function collectExpiredAuditEvents(db, cutoff, {
    pageSize = AUDIT_RETENTION_PAGE_SIZE, maxScan = AUDIT_RETENTION_MAX_SCAN, cursors = {}
} = {}) {
    const collected = new Map();
    const rejected = [];
    const nextCursors = {};
    let scanned = 0, truncated = false;
    for (const field of AUDIT_RETENTION_DATE_FIELDS) {
        const start = usableCursor(cursors[field]) ? cursors[field] : null;
        let cursor = start, exhausted = false, advanced = false;
        for (;;) {
            // Il budget conta le **letture**: un percorso respinto o un duplicato
            // consuma il tetto come qualunque altro documento letto.
            if (scanned >= maxScan) { truncated = true; break; }
            let query = db.collectionGroup("auditEvents")
                .where(field, "<=", cutoff)
                .orderBy(field)
                .orderBy(FieldPath.documentId())
                .limit(pageSize);
            if (cursor) query = query.startAfter(cursor.value, cursor.path);
            const page = await query.get();
            if (page.empty) { exhausted = true; break; }
            for (const snapshot of page.docs) {
                scanned++;
                advanced = true;
                cursor = {value: snapshot.data()[field], path: snapshot.ref.path};
                const owner = snapshot.ref.parent ? snapshot.ref.parent.parent : null;
                const uid = owner ? owner.id : null;
                let expected = null;
                try { expected = auditEventPath(uid, snapshot.ref.id); } catch { expected = null; }
                if (expected !== snapshot.ref.path) {
                    rejected.push({path: snapshot.ref.path, code: "AUDIT_RETENTION_PATH_FORBIDDEN"});
                    continue;
                }
                if (!collected.has(snapshot.ref.path)) {
                    collected.set(snapshot.ref.path, {
                        uid, id: snapshot.ref.id, path: snapshot.ref.path,
                        data: snapshot.data(), updateTime: snapshot.updateTime
                    });
                }
            }
            if (page.size < pageSize) { exhausted = true; break; }
        }
        // Esaurita: si riparte dall'inizio al giro successivo. Interrotta dal
        // tetto: si riprende da dove si era arrivati. Non toccata: resta com'era.
        nextCursors[field] = exhausted ? null : (advanced ? cursor : start);
    }
    return {entries: [...collected.values()], rejected, truncated, scanned, cursors: nextCursors};
}

// Cancellazione di un lotto con conferma della versione. Ritorna il numero di
// documenti effettivamente cancellati (un documento sparito o non più scaduto
// non è una cancellazione).
//
// Il conteggio **non** vive dentro il callback ritentabile: `runTransaction` può
// rieseguirlo più volte su conflitto, e un contatore esterno sommerebbe
// cancellazioni solo tentate. Il callback **restituisce** i percorsi cancellati
// e `runTransaction` risolve con il valore del tentativo che ha committato.
async function deleteAuditBatchWithConfirmation(db, batch, now, updateTimes) {
    const references = batch.paths.map(path => db.doc(path));
    const versions = batch.paths.map(path => updateTimes.get(path));
    if (versions.every(version => version !== undefined)) {
        const writer = db.batch();
        references.forEach((reference, index) => writer.delete(reference, {lastUpdateTime: versions[index]}));
        try {
            await writer.commit();
            return batch.paths.length;
        } catch (error) {
            if (!isPreconditionFailure(error)) throw error;
            // Versione cambiata o documento sparito: si passa alla conferma
            // atomica, senza dichiarare cancellato ciò che non lo è.
        }
    }
    const committed = await db.runTransaction(async (transaction) => {
        const snapshots = await transaction.getAll(...references);
        const deleted = [];
        for (const snapshot of snapshots) {
            if (!snapshot.exists) continue;
            if (classifyAuditEvent(snapshot.data(), now) !== "expired") continue;
            transaction.delete(snapshot.ref);
            deleted.push(snapshot.ref.path);
        }
        return deleted;
    });
    return Array.isArray(committed) ? committed.length : 0;
}

async function runAuditRetentionJob(db, {
    now = Date.now(),
    pageSize = AUDIT_RETENTION_PAGE_SIZE,
    maxScan = AUDIT_RETENTION_MAX_SCAN,
    batchSize = DEFAULT_BATCH_SIZE,
    maxBatches = AUDIT_RETENTION_MAX_BATCHES_PER_RUN,
    maxBatchesPerOwner = AUDIT_RETENTION_MAX_BATCHES_PER_OWNER
} = {}) {
    const cutoff = Timestamp.fromMillis(now - AUDIT_RETENTION_COARSE_CUTOFF_MS);
    const previousCursors = await readAuditRetentionCursors(db);
    const {entries, rejected, truncated, scanned, cursors} =
        await collectExpiredAuditEvents(db, cutoff, {pageSize, maxScan, cursors: previousCursors});
    const updateTimes = new Map(entries.map(entry => [entry.path, entry.updateTime]));
    const byOwner = new Map();
    for (const entry of entries) {
        if (!byOwner.has(entry.uid)) byOwner.set(entry.uid, []);
        byOwner.get(entry.uid).push({id: entry.id, ...entry.data});
    }
    const counters = {scanned, planned: 0, deleted: 0, retained: 0, unverifiable: 0, batches: 0, planErrors: 0};
    // Una scansione troncata significa «potrebbero restare eventi scaduti»:
    // il run non può dichiararsi completato.
    let status = truncated ? "interrupted" : "completed";
    // La finestra è «pulita» solo se tutto ciò che è stato letto è stato gestito:
    // un errore di piano, un lotto saltato per budget o un lotto fallito la
    // lasciano sporca e i cursori **non** avanzano, così il run successivo
    // rilegge la stessa finestra e nessun evento viene perso.
    let windowClean = true;
    for (const [uid, events] of byOwner) {
        if (counters.batches >= maxBatches) { status = "interrupted"; windowClean = false; break; }
        let ownerBatches = 0;
        for (let offset = 0; offset < events.length; offset += MAX_EVENTS_PER_RUN) {
            const ownerBudget = Math.min(maxBatchesPerOwner - ownerBatches, maxBatches - counters.batches);
            if (ownerBudget <= 0) { status = "interrupted"; windowClean = false; break; }
            let plan;
            try {
                plan = planAuditRetention({uid, events: events.slice(offset, offset + MAX_EVENTS_PER_RUN), now, batchSize});
            } catch (error) {
                // Documenti letti ma non valutati: il run **non** è completo e lo
                // stato lo dichiara, invece di proseguire come se nulla fosse.
                counters.planErrors++;
                status = "partial";
                windowClean = false;
                console.warn("[AUDIT] retention: piano saltato", {
                    code: String(error?.code || "AUDIT_RETENTION_INPUT_INVALID")
                });
                continue;
            }
            counters.retained += plan.retained.length;
            counters.unverifiable += plan.unverifiable.length;
            const allowed = plan.batches.slice(0, ownerBudget);
            if (allowed.length < plan.batches.length) { status = "interrupted"; windowClean = false; }
            counters.planned += allowed.reduce((total, batch) => total + batch.ids.length, 0);
            const report = await runAuditRetention({
                plan: {...plan, batches: allowed},
                deleteBatch: async (batch) => {
                    counters.deleted += await deleteAuditBatchWithConfirmation(db, batch, now, updateTimes);
                }
            });
            counters.batches += report.completed;
            ownerBatches += report.completed;
            if (report.status !== "completed") { status = report.status; windowClean = false; break; }
        }
        if (counters.batches >= maxBatches) { status = "interrupted"; windowClean = false; }
    }
    if (windowClean) await saveAuditRetentionCursors(db, cursors);
    // Log di soli conteggi e codici: nessun uid, nessun id, nessun contenuto.
    console.log("[AUDIT] retention registro",
        {status, truncated, cursorsSaved: windowClean, ...counters, rejectedPaths: rejected.length});
    return Object.freeze({...counters, status, truncated, cursorsSaved: windowClean, rejectedPaths: rejected.length});
}

exports.purgeExpiredAuditEvents = onSchedule(
    {
        schedule: "0 3 * * *",
        timeZone: "Europe/Rome",
        region: "europe-west1",
        memory: "512MiB",
        timeoutSeconds: 540,
        retryCount: 3,
    },
    () => runAuditRetentionJob(firestore())
);
