"use strict";
const {revisionDecision, sharedVaultPaths, validateSharedVaultCommand, sharedVaultUnlinkMatches} = require('./shared-vault-service');
const {accountWidgetPaths, validateAccountWidgetCommand, widgetBelongsToCommand, resolveAccountWidgetBankData} = require('./account-widget-service');
const {revisionDecision: profileRevisionDecision, sameWidgetTarget, validateWidgetProfileCommand, widgetProfilePaths} = require('./widget-profile-service');
const {createSharedVaultBinding, verifySharedVaultReceipt} = require('./shared-vault-receipt');
const {createAccountWidgetBinding, verifyAccountWidgetReceipt} = require('./account-widget-receipt');
const {assertTransactionGlobalPurgeUnlocked} = require('./archive-purge-global-lock');

// Registration and infrastructure are injected; importing this module starts no services.
function createReferenceCallables({onCall, getFirestore, FieldValue, HttpsError, requireMutationOwner}) {
    if (typeof requireMutationOwner !== 'function') throw new Error('REFERENCE_OWNER_GUARD_REQUIRED');
    const exports = {};
exports.manageSharedVaultData = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        requireMutationOwner(request, 'expectedOwnerUid');
        let command, binding;
        try {
            command = validateSharedVaultCommand(request.data);
            binding = createSharedVaultBinding(command, request.auth.uid);
        } catch {
            throw new HttpsError("invalid-argument", "Operazione Credenziale comune non valida.");
        }
        const store = getFirestore();
        const paths = sharedVaultPaths(request.auth.uid, command);
        const dataRef = store.doc(paths.data);
        const legacyRef = store.doc(paths.operation);
        const operationRef = store.doc(`mutationResults/${request.auth.uid}/operations/${command.operationId}`);
        return store.runTransaction(async transaction => {
            await assertTransactionGlobalPurgeUnlocked(transaction, store, request.auth.uid);
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
            const legacySnapshot = await transaction.get(legacyRef);
            const dataSnapshot = snapshots[0];
            const operationSnapshot = snapshots[1];
            if (operationSnapshot.exists || legacySnapshot.exists) {
                try {
                    if (!operationSnapshot.exists) throw new Error('UNVERIFIED');
                    return verifySharedVaultReceipt(operationSnapshot.data(), binding);
                } catch {
                    throw new HttpsError('failed-precondition', 'Esito precedente non verificabile.',
                        {reason:'SHARED_RESULT_UNVERIFIED'});
                }
            }
            const decision = revisionDecision({
                exists: dataSnapshot.exists,
                currentRevision: Number(dataSnapshot.data()?.revision || 0),
                expectedRevision: command.expectedRevision,
                previous: null,
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
                    !sharedVaultUnlinkMatches(command, linkSnapshot.data(), widgetSnapshot.data())) {
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
                ...binding,
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
        requireMutationOwner(request, 'expectedOwnerUid');
        let command, binding;
        try {
            command = validateAccountWidgetCommand(request.data);
            binding = createAccountWidgetBinding(command, request.auth.uid);
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
        const legacyRef = store.doc(paths.operation);
        const operationRef = store.doc(`mutationResults/${request.auth.uid}/operations/${command.operationId}`);
        return store.runTransaction(async transaction => {
            await assertTransactionGlobalPurgeUnlocked(transaction, store, request.auth.uid);
            const widgetsRef = store.collection(`users/${request.auth.uid}/accountWidgets`);
            const profileRef = command.data?.profileId
                ? store.doc(`users/${request.auth.uid}/accountWidgetProfiles/${command.data.profileId}`) : null;
            const [accountSnapshot, widgetSnapshot, operationSnapshot, legacySnapshot, widgetsSnapshot, profileSnapshot] = await Promise.all([
                transaction.get(accountRef), transaction.get(widgetRef), transaction.get(operationRef), transaction.get(legacyRef),
                transaction.get(widgetsRef), profileRef ? transaction.get(profileRef) : Promise.resolve(null)
            ]);
            if (!accountSnapshot.exists) throw new HttpsError("not-found", "Account non trovato.");
            if (widgetSnapshot.exists && !widgetBelongsToCommand(widgetSnapshot.data(), command)) {
                throw new HttpsError("failed-precondition", "Il Widget appartiene a un altro Account.");
            }
            if (operationSnapshot.exists || legacySnapshot.exists) {
                try {
                    if (!operationSnapshot.exists) throw new Error('ACCOUNT_WIDGET_RESULT_UNVERIFIED');
                    return verifyAccountWidgetReceipt(operationSnapshot.data(), binding);
                } catch {
                    throw new HttpsError('failed-precondition', 'Esito operazione non verificabile.',
                        {reason: 'ACCOUNT_WIDGET_RESULT_UNVERIFIED'});
                }
            }
            const decision = revisionDecision({
                exists: widgetSnapshot.exists,
                currentRevision: Number(widgetSnapshot.data()?.revision || 0),
                expectedRevision: command.expectedRevision,
                previous: null,
                action: command.action
            });
            if (decision.duplicate || decision.status !== "applied") return decision;
            if (command.data?.profileId) {
                if (!profileSnapshot?.exists || profileSnapshot.data()?.category !== command.data.profileCategory) {
                    throw new HttpsError('failed-precondition', 'Il profilo Widget non è disponibile nella categoria richiesta.');
                }
                const duplicate = widgetsSnapshot.docs.some(snapshot => snapshot.id !== command.widgetId &&
                    snapshot.data()?.kind === 'embedded' && sameWidgetTarget(snapshot.data(), command));
                if (duplicate) throw new HttpsError('already-exists',
                    'Widget già inserito. Crea un nuovo profilo widget.', {reason: 'WIDGET_PROFILE_ALREADY_ATTACHED'});
            }
            let widgetData;
            try {
                widgetData = resolveAccountWidgetBankData(command, accountSnapshot.data(), widgetSnapshot.data());
            } catch {
                throw new HttpsError("failed-precondition", "Il conto bancario collegato al Widget non è disponibile.");
            }
            const now = FieldValue.serverTimestamp();
            if (command.action === "delete") transaction.delete(widgetRef);
            else transaction.set(widgetRef, {
                ...widgetData,
                context: command.context,
                accountId: command.accountId,
                ...(command.context === "company" ? {companyId: command.companyId} : {}),
                revision: decision.revision,
                createdAt: command.action === "create" ? now : widgetSnapshot.data().createdAt,
                updatedAt: now
            });
            transaction.set(operationRef, {
                ...binding, ...decision, createdAt: now
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

exports.manageWidgetProfile = onCall(
    {region: "europe-west1", enforceAppCheck: true},
    async request => {
        if (!request.auth) throw new HttpsError("unauthenticated", "Accesso richiesto.");
        requireMutationOwner(request, 'expectedOwnerUid');
        let command;
        try { command = validateWidgetProfileCommand(request.data); }
        catch (error) {
            throw new HttpsError("invalid-argument", `Profilo Widget non valido (${error.message || 'WIDGET_PROFILE_INVALID'}).`);
        }
        const store = getFirestore();
        const paths = widgetProfilePaths(request.auth.uid, command);
        const profileRef = store.doc(paths.profile);
        const operationRef = store.doc(`mutationResults/${request.auth.uid}/operations/${command.operationId}`);
        const widgetsRef = store.collection(`users/${request.auth.uid}/accountWidgets`);
        return store.runTransaction(async transaction => {
            await assertTransactionGlobalPurgeUnlocked(transaction, store, request.auth.uid);
            const [profileSnapshot, operationSnapshot, widgetsSnapshot] = await Promise.all([
                transaction.get(profileRef), transaction.get(operationRef), transaction.get(widgetsRef)
            ]);
            if (operationSnapshot.exists) {
                const previous = operationSnapshot.data();
                if (previous.domain !== 'widget-profile' || previous.profileId !== command.profileId || previous.action !== command.action) {
                    throw new HttpsError('failed-precondition', 'Esito precedente non verificabile.');
                }
                return {...previous.result, duplicate: true};
            }
            const decision = profileRevisionDecision({
                exists: profileSnapshot.exists,
                currentRevision: Number(profileSnapshot.data()?.revision || 0),
                expectedRevision: command.expectedRevision,
                action: command.action
            });
            if (decision.status !== 'applied') return decision;
            if (command.action === 'delete' && widgetsSnapshot.docs.some(snapshot => snapshot.data()?.profileId === command.profileId)) {
                throw new HttpsError('failed-precondition', 'Il profilo è ancora utilizzato da uno o più Widget.');
            }
            const now = FieldValue.serverTimestamp();
            if (command.action === 'delete') transaction.delete(profileRef);
            else transaction.set(profileRef, {
                ...command.data,
                revision: decision.revision,
                createdAt: command.action === 'create' ? now : profileSnapshot.data().createdAt,
                updatedAt: now
            });
            transaction.set(operationRef, {
                domain: 'widget-profile', profileId: command.profileId, action: command.action,
                result: decision, createdAt: now
            });
            transaction.set(store.collection('users').doc(request.auth.uid).collection('auditEvents').doc(command.operationId), {
                action: `widget-profile-${command.action}`, profileId: command.profileId,
                operationId: command.operationId, revision: decision.revision, createdAt: now
            });
            return decision;
        });
    }
);
    return exports;
}
module.exports = {createReferenceCallables};
