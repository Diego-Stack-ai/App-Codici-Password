/**
 * BACKEND CORE (V7.3 - NODEMAILER + APP PASSWORD)
 * Sistema notifiche scadenze via Gmail (App Password).
 *
 * Due funzioni:
 * 1. checkDeadlines    → schedulata ogni giorno alle 09:00 (repliche + avviso finale)
 * 2. onScadenzaCreated → trigger Firestore, invio immediato se preavviso già nella finestra
 */

const { onSchedule } = require("firebase-functions/v2/scheduler");
const { onDocumentCreated, onDocumentDeleted, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { onCall, onRequest, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { Bytes, FieldValue, Timestamp, getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getStorage } = require("firebase-admin/storage");
const nodemailer = require("nodemailer");
const crypto = require("crypto");
const { setGlobalOptions } = require("firebase-functions");
const {
    generateRecoveryCode,
    nextRecoveryAttemptState,
    normalizeRecoveryCode,
    recoveryAttemptId,
    recoveryCodeHash
} = require("./recovery-security");
const {mutationDecision, validateOfflineMutation} = require("./offline-sync-service");
const {
    privateAccountMutationDecision, validatePrivateAccountMutation
} = require("./private-account-mutation-service");
const {
    RETENTION_MS, restoreDecision, safeAudit, trashDecision, validateRecoveryCommand
} = require("./history-recovery-service");
const {
    accountPath, isSafeAttachmentPath, purgeDecision, unlinkProfileEmails, validatePurgeCommand
} = require("./archive-purge-service");
const {
    decodeFirestoreValue, restoreChunkDecision, safeRestoreAudit, validateRestoreChunk
} = require("./backup-restore-service");
const {
    revisionDecision, sharedVaultPaths, validateSharedVaultCommand
} = require("./shared-vault-service");
const {
    accountWidgetPaths, validateAccountWidgetCommand, widgetBelongsToCommand
} = require("./account-widget-service");

initializeApp();

// Facciata minima per mantenere leggibile la logica esistente usando la API
// modulare richiesta da Firebase Admin 14.
const firestore = () => getFirestore();
firestore.FieldValue = FieldValue;
const admin = { auth: getAuth, firestore, messaging: getMessaging };
setGlobalOptions({ maxInstances: 10, region: "europe-west1" });

exports.applyOfflineMutation = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    async (request) => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        let operation;
        try {
            operation = validateOfflineMutation(request.data);
        } catch {
            throw new HttpsError("invalid-argument", "Operazione offline non valida.");
        }
        const store = getFirestore();
        const userRef = store.collection("users").doc(request.auth.uid);
        const recordRef = userRef.collection("syncRecords").doc(operation.recordId);
        const resultRef = userRef.collection("operationResults").doc(operation.operationId);
        return store.runTransaction(async (transaction) => {
            const [recordSnapshot, resultSnapshot] = await Promise.all([
                transaction.get(recordRef), transaction.get(resultRef)
            ]);
            const currentRevision = Number(recordSnapshot.data()?.revision || 0);
            const decision = mutationDecision(
                currentRevision, operation, resultSnapshot.exists ? resultSnapshot.data() : null
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
                ownerUid: request.auth.uid,
                deviceId: operation.deviceId,
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
        let operation;
        try { operation = validatePrivateAccountMutation(request.data); } catch {
            throw new HttpsError("invalid-argument", "Account privato offline non valido.");
        }
        const store = getFirestore();
        const userRef = store.collection("users").doc(request.auth.uid);
        const recordRef = userRef.collection("accounts").doc(operation.recordId);
        const resultRef = userRef.collection("operationResults").doc(operation.operationId);
        return store.runTransaction(async transaction => {
            const [recordSnapshot, resultSnapshot] = await Promise.all([
                transaction.get(recordRef), transaction.get(resultRef)
            ]);
            const previous = resultSnapshot.exists ? resultSnapshot.data() : null;
            if (previous && (previous.domain !== "private-account" || previous.recordId !== operation.recordId)) {
                throw new HttpsError("already-exists", "Identificatore operazione già utilizzato.");
            }
            const result = privateAccountMutationDecision({
                exists: recordSnapshot.exists,
                currentRevision: Number(recordSnapshot.data()?.revision || 0),
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
                domain: "private-account",
                recordId: operation.recordId,
                ownerUid: request.auth.uid,
                deviceId: operation.deviceId,
                createdAt: FieldValue.serverTimestamp()
            });
            return result;
        });
    }
);

exports.manageSharedVaultData = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        let command;
        try {
            command = validateSharedVaultCommand(request.data);
        } catch {
            throw new HttpsError("invalid-argument", "Operazione Credenziale comune non valida.");
        }
        const store = getFirestore();
        const paths = sharedVaultPaths(request.auth.uid, command);
        const dataRef = store.doc(paths.data);
        const operationRef = store.doc(paths.operation);
        return store.runTransaction(async transaction => {
            const reads = [transaction.get(dataRef), transaction.get(operationRef)];
            let linkRef = null;
            let widgetRef = null;
            let accountRef = null;
            let linksQuery = null;
            if (paths.link) {
                linkRef = store.doc(paths.link);
                widgetRef = store.doc(paths.widget);
                accountRef = store.doc(paths.account);
                reads.push(transaction.get(linkRef), transaction.get(widgetRef), transaction.get(accountRef));
            }
            if (command.action === "delete") {
                linksQuery = store.collection(`users/${request.auth.uid}/sharedVaultLinks`)
                    .where("sharedDataId", "==", command.sharedDataId).limit(1);
                reads.push(transaction.get(linksQuery));
            }
            const snapshots = await Promise.all(reads);
            const dataSnapshot = snapshots[0];
            const operationSnapshot = snapshots[1];
            const previous = operationSnapshot.exists ? operationSnapshot.data() : null;
            if (previous && (previous.domain !== "shared-vault" ||
                previous.sharedDataId !== command.sharedDataId || previous.action !== command.action)) {
                throw new HttpsError("already-exists", "Identificatore operazione già utilizzato.");
            }
            const decision = revisionDecision({
                exists: dataSnapshot.exists,
                currentRevision: Number(dataSnapshot.data()?.revision || 0),
                expectedRevision: command.expectedRevision,
                previous,
                action: command.action
            });
            if (decision.duplicate || decision.status !== "applied") return decision;

            const now = FieldValue.serverTimestamp();
            if (command.action === "create" || command.action === "update") {
                const payload = {
                    ...command.data,
                    revision: decision.revision,
                    updatedAt: now
                };
                const createdAt = command.action === "create" ? now : dataSnapshot.data().createdAt;
                if (createdAt !== undefined) payload.createdAt = createdAt;
                transaction.set(dataRef, payload);
            } else if (command.action === "link") {
                const [linkSnapshot, widgetSnapshot, accountSnapshot] = snapshots.slice(2, 5);
                if (!accountSnapshot.exists) throw new HttpsError("not-found", "Account non trovato.");
                if (linkSnapshot.exists || widgetSnapshot.exists) {
                    throw new HttpsError("already-exists", "Credenziale già collegata.");
                }
                const linkPayload = {
                    ...command.link,
                    sharedDataId: command.sharedDataId,
                    widgetId: command.widgetId,
                    schemaVersion: 1,
                    createdAt: now,
                    updatedAt: now
                };
                transaction.set(linkRef, linkPayload);
                transaction.set(widgetRef, {
                    ...command.link,
                    kind: "shared-reference",
                    sharedDataId: command.sharedDataId,
                    linkId: command.linkId,
                    schemaVersion: 1,
                    createdAt: now,
                    updatedAt: now
                });
                transaction.update(dataRef, {revision: decision.revision, updatedAt: now});
            } else if (command.action === "unlink") {
                const [linkSnapshot, widgetSnapshot] = snapshots.slice(2, 4);
                if (!linkSnapshot.exists || !widgetSnapshot.exists ||
                    linkSnapshot.data().sharedDataId !== command.sharedDataId ||
                    widgetSnapshot.data().sharedDataId !== command.sharedDataId) {
                    throw new HttpsError("failed-precondition", "Collegamento non coerente.");
                }
                transaction.delete(linkRef);
                transaction.delete(widgetRef);
                transaction.update(dataRef, {revision: decision.revision, updatedAt: now});
            } else if (command.action === "delete") {
                const linksSnapshot = snapshots[2];
                if (!linksSnapshot.empty) {
                    throw new HttpsError("failed-precondition", "Scollega prima tutti gli Account.");
                }
                transaction.delete(dataRef);
            }
            transaction.set(operationRef, {
                ...decision,
                domain: "shared-vault",
                action: command.action,
                sharedDataId: command.sharedDataId,
                ownerUid: request.auth.uid,
                createdAt: now
            });
            transaction.set(store.collection("users").doc(request.auth.uid)
                .collection("auditEvents").doc(command.operationId), {
                action: `shared-vault-${command.action}`,
                sharedDataId: command.sharedDataId,
                operationId: command.operationId,
                revision: decision.revision,
                createdAt: now
            });
            return decision;
        });
    }
);

exports.manageAccountWidget = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        let command;
        try {
            command = validateAccountWidgetCommand(request.data);
        } catch (error) {
            const validationCode = /^ACCOUNT_WIDGET_|^SHARED_VAULT_/.test(String(error?.message || ""))
                ? error.message
                : "ACCOUNT_WIDGET_COMMAND_INVALID";
            console.warn("[ACCOUNT_WIDGET] Comando rifiutato", {validationCode});
            throw new HttpsError(
                "invalid-argument",
                `Operazione Widget Account non valida (${validationCode}).`
            );
        }
        const store = getFirestore();
        const paths = accountWidgetPaths(request.auth.uid, command);
        const accountRef = store.doc(paths.account);
        const widgetRef = store.doc(paths.widget);
        const operationRef = store.doc(paths.operation);
        return store.runTransaction(async transaction => {
            const [accountSnapshot, widgetSnapshot, operationSnapshot] = await Promise.all([
                transaction.get(accountRef), transaction.get(widgetRef), transaction.get(operationRef)
            ]);
            if (!accountSnapshot.exists) throw new HttpsError("not-found", "Account non trovato.");
            const previous = operationSnapshot.exists ? operationSnapshot.data() : null;
            if (previous && (previous.domain !== "account-widget" || previous.widgetId !== command.widgetId ||
                previous.action !== command.action)) {
                throw new HttpsError("already-exists", "Identificatore operazione già utilizzato.");
            }
            if (widgetSnapshot.exists && !widgetBelongsToCommand(widgetSnapshot.data(), command)) {
                throw new HttpsError("failed-precondition", "Il Widget appartiene a un altro Account.");
            }
            const decision = revisionDecision({
                exists: widgetSnapshot.exists,
                currentRevision: Number(widgetSnapshot.data()?.revision || 0),
                expectedRevision: command.expectedRevision,
                previous,
                action: command.action
            });
            if (decision.duplicate || decision.status !== "applied") return decision;
            const now = FieldValue.serverTimestamp();
            if (command.action === "delete") transaction.delete(widgetRef);
            else transaction.set(widgetRef, {
                ...command.data,
                context: command.context,
                accountId: command.accountId,
                ...(command.context === "company" ? {companyId: command.companyId} : {}),
                revision: decision.revision,
                createdAt: command.action === "create" ? now : widgetSnapshot.data().createdAt,
                updatedAt: now
            });
            transaction.set(operationRef, {
                ...decision, domain: "account-widget", action: command.action,
                widgetId: command.widgetId, ownerUid: request.auth.uid, createdAt: now
            });
            transaction.set(store.collection("users").doc(request.auth.uid)
                .collection("auditEvents").doc(command.operationId), {
                action: `account-widget-${command.action}`,
                widgetId: command.widgetId,
                operationId: command.operationId,
                revision: decision.revision,
                createdAt: now
            });
            return decision;
        });
    }
);

async function runRecoveryCommand(request, mode) {
    if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
    let command;
    try { command = validateRecoveryCommand(request.data); } catch {
        throw new HttpsError("invalid-argument", "Comando di recupero non valido.");
    }
    const store = getFirestore();
    const userRef = store.collection("users").doc(request.auth.uid);
    const recordRef = userRef.collection("syncRecords").doc(command.recordId);
    const trashRef = userRef.collection("trash").doc(command.recordId);
    const resultRef = userRef.collection("operationResults").doc(command.operationId);
    return store.runTransaction(async transaction => {
        const [record, trash, previous] = await Promise.all([
            transaction.get(recordRef), transaction.get(trashRef), transaction.get(resultRef)
        ]);
        const result = mode === "trash" ? trashDecision({
            recordExists: record.exists,
            currentRevision: Number(record.data()?.revision || 0),
            expectedRevision: command.expectedRevision,
            alreadyProcessed: previous.exists
        }) : restoreDecision({
            trashExists: trash.exists,
            destinationExists: record.exists,
            trashedRevision: Number(trash.data()?.revision || 0),
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
        transaction.set(resultRef, {...result, ownerUid: request.auth.uid, createdAt: FieldValue.serverTimestamp()});
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
        let command;
        try { command = validatePurgeCommand(request.data); } catch {
            throw new HttpsError("invalid-argument", "Comando di eliminazione non valido.");
        }
        const store = getFirestore();
        const ownerUid = request.auth.uid;
        const userRef = store.collection("users").doc(ownerUid);
        const recordRef = store.doc(accountPath(ownerUid, command));
        const operationRef = userRef.collection("archiveOperations").doc(command.operationId);
        const preparation = await store.runTransaction(async transaction => {
            const [recordSnapshot, operationSnapshot] = await Promise.all([
                transaction.get(recordRef), transaction.get(operationRef)
            ]);
            const previous = operationSnapshot.exists ? operationSnapshot.data() : null;
            if (previous && (previous.accountId !== command.accountId ||
                previous.context !== command.context || previous.companyId !== command.companyId)) {
                throw new HttpsError("already-exists", "Identificatore operazione già utilizzato.");
            }
            const decision = purgeDecision({
                record: recordSnapshot.exists ? recordSnapshot.data() : null,
                expectedRevision: command.expectedRevision,
                confirmed: command.confirmation,
                previous
            });
            if (decision.duplicate || !["ready", "resume"].includes(decision.status)) return decision;
            if (decision.status === "resume") return decision;
            transaction.set(operationRef, {
                status: "processing", ownerUid, accountId: command.accountId,
                context: command.context, companyId: command.companyId,
                createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp()
            }, {merge: true});
            return decision;
        });
        if (preparation.duplicate) return preparation;
        if (!["ready", "resume"].includes(preparation.status)) {
            throw new HttpsError("failed-precondition", `Eliminazione non consentita: ${preparation.status}.`);
        }

        const attachments = await recordRef.collection("attachments").get();
        const storagePaths = attachments.docs.map(snapshot => snapshot.data()?.storagePath).filter(Boolean);
        if (storagePaths.some(path => !isSafeAttachmentPath(ownerUid, command, path))) {
            throw new HttpsError("failed-precondition", "Percorso allegato non sicuro: eliminazione interrotta.");
        }
        const bucket = getStorage().bucket();
        await Promise.all(storagePaths.map(path => bucket.file(path).delete({ignoreNotFound: true})));
        await store.recursiveDelete(recordRef);

        await store.runTransaction(async transaction => {
            const profileSnapshot = await transaction.get(userRef);
            if (command.context === "private" && profileSnapshot.exists) {
                const existingEmails = profileSnapshot.data()?.contactEmails;
                const unlinkedEmails = unlinkProfileEmails(existingEmails, command.accountId);
                if (Array.isArray(unlinkedEmails)) transaction.update(userRef, {contactEmails: unlinkedEmails});
            }
            transaction.set(operationRef, {status: "purged", updatedAt: FieldValue.serverTimestamp()}, {merge: true});
            transaction.set(userRef.collection("auditEvents").doc(command.operationId), {
                action: "account-purged", actorUid: ownerUid, accountId: command.accountId,
                context: command.context, at: FieldValue.serverTimestamp()
            });
        });
        return {status: "purged", duplicate: false};
    }
);

exports.restoreBackupChunk = onCall(
    {region: "europe-west1", enforceAppCheck: true, timeoutSeconds: 120, memory: "512MiB"},
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        let command;
        try { command = validateRestoreChunk(request.data, request.auth.uid); } catch {
            throw new HttpsError("invalid-argument", "Chunk di ripristino non valido.");
        }
        const store = getFirestore();
        const userRef = store.collection("users").doc(request.auth.uid);
        const operationRef = userRef.collection("backupRestoreOperations").doc(command.operationId);
        return store.runTransaction(async transaction => {
            const references = command.records.map(record => store.doc(record.path));
            const [previous, ...snapshots] = await Promise.all([
                transaction.get(operationRef), ...references.map(reference => transaction.get(reference))
            ]);
            if (previous.exists) {
                const data = previous.data();
                if (data.backupId !== command.backupId || data.chunkIndex !== command.chunkIndex) {
                    throw new HttpsError("already-exists", "Identificatore operazione già utilizzato.");
                }
            }
            const collisions = snapshots
                .map((snapshot, index) => snapshot.exists && command.records[index].path !== `users/${request.auth.uid}`
                    ? command.records[index].path : null)
                .filter(Boolean);
            const decision = restoreChunkDecision({
                previous: previous.exists ? previous.data() : null,
                collisions,
                overwriteExisting: command.mode === "apply" && command.overwriteExisting && command.overwriteConfirmed
            });
            if (decision.duplicate || command.mode === "preview") return decision;
            if (!command.confirmed) throw new HttpsError("failed-precondition", "Conferma ripristino mancante.");
            if (decision.status !== "ready") return decision;
            command.records.forEach((record, index) => {
                const data = decodeFirestoreValue(record.data, {
                    timestamp: (seconds, nanoseconds) => new Timestamp(seconds, nanoseconds),
                    bytes: value => Bytes.fromUint8Array(value)
                });
                transaction.set(references[index], data, {merge: record.path === `users/${request.auth.uid}`});
            });
            const result = {status: "applied", duplicate: false, recordCount: command.records.length};
            transaction.set(operationRef, {
                ...result, backupId: command.backupId, chunkIndex: command.chunkIndex,
                chunkCount: command.chunkCount, ownerUid: request.auth.uid,
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
        const authAgeSeconds = Math.floor(Date.now() / 1000) - Number(request.auth.token.auth_time || 0);
        if (authAgeSeconds > 300) {
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
        const codeHash = recoveryCodeHash(request.data?.recoveryCode);
        if (!email || !password || normalizeRecoveryCode(request.data?.recoveryCode).length !== 16) {
            throw new HttpsError("invalid-argument", "Dati di recupero non validi.");
        }

        const db = admin.firestore();
        const ipAddress = request.rawRequest?.ip || request.rawRequest?.socket?.remoteAddress || "unknown";
        const attemptRef = db.collection("mfaRecoveryAttempts").doc(recoveryAttemptId(email, ipAddress));
        let recoveryAttemptAllowed = false;
        await db.runTransaction(async (transaction) => {
            const attemptSnap = await transaction.get(attemptRef);
            const next = nextRecoveryAttemptState(attemptSnap.exists ? attemptSnap.data() : null);
            recoveryAttemptAllowed = next.allowed;
            transaction.set(attemptRef, {
                emailHash: crypto.createHash("sha256").update(email, "utf8").digest("hex"),
                attempts: next.attempts || 0,
                windowStartedAt: next.windowStartedAt || Date.now(),
                blockedUntil: next.blockedUntil || 0,
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
        const firstFactorAccepted = response.ok || String(authResult?.error?.message || "").startsWith("MFA_REQUIRED");
        if (!firstFactorAccepted) throw new HttpsError("permission-denied", "Credenziali o codice di recupero non validi.");

        const user = await admin.auth().getUserByEmail(email);
        const recoveryRef = db.collection("mfaRecovery").doc(user.uid);
        await db.runTransaction(async (transaction) => {
            const recovery = await transaction.get(recoveryRef);
            const hashes = recovery.exists ? recovery.data().codeHashes || [] : [];
            if (!hashes.includes(codeHash)) {
                throw new HttpsError("permission-denied", "Credenziali o codice di recupero non validi.");
            }
            const remainingHashes = hashes.filter((hash) => hash !== codeHash);
            transaction.set(recoveryRef, {
                codeHashes: remainingHashes,
                remaining: remainingHashes.length,
                recoveryPendingAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        await admin.auth().updateUser(user.uid, { multiFactor: { enrolledFactors: null } });
        await admin.auth().revokeRefreshTokens(user.uid);
        await recoveryRef.set({
            recoveredAt: admin.firestore.FieldValue.serverTimestamp(),
            recoveryPendingAt: admin.firestore.FieldValue.delete(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        await attemptRef.delete();
        return { ok: true };
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
    const lastPush = new Date(scadenza[lastField]);
    lastPush.setHours(0, 0, 0, 0);
    if (Number.isNaN(lastPush.getTime())) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return Math.floor((today - lastPush) / (1000 * 60 * 60 * 24)) >= frequency;
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
    if (!shouldSendPush(scadenza, diffDays, options.forceImmediate === true, "lastRecipientPushNotifiedAt")) return;
    const recipients = deadlineRecipients(scadenza).filter((recipient) => recipient.sendPush);
    if (!recipients.length) return;
    const text = pushText(scadenza, diffDays);
    let sent = 0;
    for (const recipient of recipients) {
        let recipientUser;
        try { recipientUser = await admin.auth().getUserByEmail(recipient.email); }
        catch (error) {
            if (error.code !== "auth/user-not-found") console.error("[RECIPIENT LOOKUP FAILED]", error.code || error.message);
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
                await admin.messaging().send({
                    token: device.data().token,
                    data: {
                        eventType: "external_deadline",
                        receivedDeadlineId: shareId,
                        title: text.title,
                        body: recipientBody,
                        deliveryTag: `external-${deadlineId}-${device.id}`
                    },
                    webpush: { headers: { TTL: diffDays === 0 ? "21600" : "86400", Urgency: "high" } }
                });
                sent += 1;
            } catch (error) {
                const invalid = ["messaging/registration-token-not-registered", "messaging/invalid-registration-token"].includes(error.code);
                if (invalid) await device.ref.set({ enabled: false, status: "invalid", invalidatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                console.error(`[RECIPIENT PUSH FAILED] ${deadlineId}/${device.id}:`, error.code || error.message);
            }
        }
    }
    const today = new Date(); today.setHours(0, 0, 0, 0);
    await db.collection("users").doc(ownerUid).collection("scadenze").doc(deadlineId)
        .update({ lastRecipientPushNotifiedAt: today.toISOString().split("T")[0] });
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        await db.collection("users").doc(uid).collection("scadenze").doc(deadlineId).update({
            lastPushNotifiedAt: today.toISOString().split("T")[0]
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const deadlines = await db.collection("users").doc(request.auth.uid).collection("scadenze")
            .where("completed", "==", false).get();
        const upcoming = deadlines.docs.map((item) => {
            const data = item.data();
            const dueDate = new Date(data.dueDate);
            dueDate.setHours(0, 0, 0, 0);
            return { id: item.id, data, dueDate };
        }).filter((item) => !Number.isNaN(item.dueDate.getTime()) && item.dueDate >= today)
            .sort((left, right) => left.dueDate - right.dueDate)[0];

        const deadlineId = upcoming?.id || "";
        const diffDays = upcoming ? Math.ceil((upcoming.dueDate - today) / (1000 * 60 * 60 * 24)) : 0;
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
        await firestore.runTransaction(async (transaction) => {
            const inviteSnap = await transaction.get(inviteRef);
            if (!inviteSnap.exists) throw new HttpsError("not-found", "Invito non trovato.");
            const invite = inviteSnap.data();
            if (invite.status !== "pending") throw new HttpsError("failed-precondition", "Invito già elaborato.");
            if (String(invite.recipientEmail || "").toLowerCase().trim() !== email) {
                throw new HttpsError("permission-denied", "Non sei il destinatario dell'invito.");
            }

            const accountPath = invite.aziendaId
                ? `users/${invite.ownerId}/aziende/${invite.aziendaId}/accounts/${invite.accountId}`
                : `users/${invite.ownerId}/accounts/${invite.accountId}`;
            const accountRef = firestore.doc(accountPath);
            const accountSnap = await transaction.get(accountRef);
            if (!accountSnap.exists) throw new HttpsError("not-found", "Account condiviso non trovato.");

            const account = accountSnap.data();
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

            transaction.update(accountRef, {
                sharedWith,
                sharedWithUids,
                acceptedCount: acceptedGuests.length,
                visibility: hasActive ? "shared" : "private",
                updatedAt: new Date().toISOString()
            });
            transaction.update(inviteRef, {
                status,
                guestUid: status === "accepted" ? uid : null,
                respondedAt: new Date().toISOString()
            });
        });
        return { ok: true, status };
    }
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
        await contactRef.delete();
        return { deleted: true, usage };
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
            .forEach((result) => console.error(`[INVITE NOTIFICATION FAILED] ${event.params.inviteId}:`, result.reason?.message || result.reason));
    }
);

// ─────────────────────────────────────────────────────────────
// UTILITY — Componi e invia una email per una scadenza
// ─────────────────────────────────────────────────────────────
async function sendScadenzaEmail(transporter, gmailUser, s, diffDays, docRef) {
    const dueDate = new Date(s.dueDate);
    dueDate.setHours(0, 0, 0, 0);

    const dueDateFormatted = dueDate.toLocaleDateString("it-IT", {
        day: "2-digit", month: "long", year: "numeric",
    });

    const templateText = s.templateText || s.type || "una scadenza";
    const veicolo = s.veicolo_modello ? ` ${s.veicolo_modello}` : "";

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
    <p>Gentile <strong>${s.name || "Utente"}</strong>,</p>
    <p>ti ricordiamo che sta per scadere:</p>

    <div class="label">Oggetto</div>
    <div class="value">📋 ${templateText}${veicolo}</div>

    <div class="label">Categoria</div>
    <div class="value">🏷️ ${s.type || "—"}</div>

    <div class="label">Data scadenza</div>
    <div class="value">📅 ${dueDateFormatted}</div>

    <div class="badge">⏳ Scade ${giorniLabel}</div>

    ${s.notes ? `<div class="label">Note</div><div class="value" style="font-weight:normal;color:#555;">${s.notes}</div>` : ""}

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
                    console.error("[EMAIL RECIPIENT LOOKUP FAILED]", error.code || error.message);
                }
            }
        }
        const instruction = recipient.canManage
            ? "Se gestisci tu questa scadenza, apri l'app per registrare l'esecuzione o aggiornare la prossima data."
            : "Apri l'app per consultare la scadenza ricevuta.";
        const callToAction = `<div style="text-align:center;margin:24px 0;"><p style="color:#555;font-size:14px;">${instruction}</p><a class="button" href="${appUrl}">${buttonLabel}</a></div>`;
        return transporter.sendMail({
            from: `"Codex Notifiche" <${gmailUser}>`,
            to: recipient.email,
            subject: `⚠️ Scadenza in arrivo — ${s.type || templateText}`,
            html: emailBody.replace('    <div class="footer">', `${callToAction}\n    <div class="footer">`),
        });
    }));
    const sentCount = results.filter((result) => result.status === "fulfilled").length;
    results.filter((result) => result.status === "rejected").forEach((result) => console.error("[EMAIL RECIPIENT FAILED]", result.reason?.message || result.reason));
    if (!sentCount) throw new Error("Nessun destinatario email raggiunto.");

    // Aggiorna lastNotifiedAt per evitare duplicati dallo scheduler
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    await docRef.update({
        lastNotifiedAt: today.toISOString().split("T")[0],
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
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const gmailUser = GMAIL_USER.value();
        const gmailPass = GMAIL_APP_PASSWORD.value();
        const transporter = createTransporter(gmailUser, gmailPass);

        console.log(`[SCHEDULER] Controllo scadenze: ${today.toISOString().split("T")[0]}`);

        try {
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

                    const dueDate = new Date(s.dueDate);
                    dueDate.setHours(0, 0, 0, 0);
                    const diffMs = dueDate - today;
                    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

                    const daysBefore = s.notif_days_before || 14;
                    const freqDays = s.notif_frequency || 7;

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

                    // Giorno 0: invia SEMPRE
                    // Altri giorni: rispetta la frequenza
                    if (diffDays > 0) {
                        const lastNotified = s.lastNotifiedAt
                            ? new Date(s.lastNotifiedAt) : null;
                        if (lastNotified) {
                            const daysSinceLast = Math.floor(
                                (today - lastNotified) / (1000 * 60 * 60 * 24)
                            );
                            if (daysSinceLast < freqDays) continue;
                        }
                    }

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

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const dueDate = new Date(s.dueDate);
        dueDate.setHours(0, 0, 0, 0);

        const diffMs = dueDate - today;
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

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
