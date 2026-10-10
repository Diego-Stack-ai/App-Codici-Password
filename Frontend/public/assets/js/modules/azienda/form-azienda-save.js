import { findProfileAccountItem, patchProfileAccountItem, profileAccountReferences } from '../privato/profile-model.js';
import { prepareCompanyProfileLink } from '../azienda/company-profile-link.js';
/**
 * FORM ACCOUNT AZIENDA — SAVE MODULE (V1.0)
 * Salvataggio e cancellazione degli account aziendali.
 * Estratto da form_account_azienda.js per ridurre la complessità del modulo principale.
 * Entry: saveAccount(ctx), deleteAccount(ctx)
 */

import { auth, db } from '../../firebase-config.js?v=1.2.152';
import { LOG } from '../../logger.js';
import {
    doc, collection, runTransaction, deleteField
} from "/assets/js/vendor/firebase-runtime.js";
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { inviteIdForGuest, logError, sanitizeEmail, sharingCycleOf } from '../../utils.js';
import { encrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { accountModeFromFlags, isOwnerRecipientEmail, preferenceForRecipient, recordFieldsFromAccountMode, validateAccountMode } from '../shared/account-mode-model.js';
import { formatCardExpiry, hasInvalidCardExpiry } from '../shared/banking-model.js';
import { linkProfileEmailToAccount, isProfileEmailPasswordTransferred } from '../privato/profile-model.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
import { DECRYPT_FAILURE_MESSAGE, assertAccountSaveAllowed, isAccountSaveAllowed } from '../shared/credential-decrypt-guard.js';

// Utility locale per recupero rapido valori
const get = (id) => document.getElementById(id)?.value.trim() || '';

/**
 * Salva o aggiorna un account aziendale con crittografia e gestione condivisione.
 * @param {Object} ctx - Stato corrente del form
 */
export async function saveAccount({ bankAccounts, invitedEmails, invitePreferences = {}, isExplicitMemo, currentUid, currentDocId, currentAziendaId, isEditing, profileContactLinkDraft, baseUpdatedAt = '', loadContext = null }) {
    if (!isAccountSaveAllowed(loadContext)) {
        showToast(DECRYPT_FAILURE_MESSAGE, 'warning');
        return;
    }
    const btnSave = document.getElementById('save-btn-footer') || document.querySelector('[data-action="save"]');
    if (btnSave) btnSave.disabled = true;
    let savedAccountId = currentDocId;

    if (hasInvalidCardExpiry(bankAccounts)) {
        showToast('Inserisci la scadenza della carta nel formato MM/AA, con un mese da 01 a 12.', 'warning');
        if (btnSave) btnSave.disabled = false;
        return;
    }

    const hasBankingData = bankAccounts.some(acc => (
        acc.iban?.trim()
        || acc.passwordDispositiva?.trim()
        || acc.referenteNome?.trim()
        || acc.numeroVerde?.trim()
        || acc.referenteTelefono?.trim()
        || acc.referenteCellulare?.trim()
        || (acc.cards && acc.cards.length > 0)
    ));

    // 🔐 PROTOCOLLO BLINDA: Crittografia Dati Sensibili
    let vaultKeyMaterial;
    try {
        vaultKeyMaterial = await ensureVaultKeyMaterial();
    } catch (e) {
        showToast("Accesso negato: Chiave di crittografia richiesta.", "error");
        if (btnSave) btnSave.disabled = false;
        return;
    }

    const passwordToSave = get('account-password');
    const data = {
        nomeAccount: (get('account-name') || '').trim(), // In chiaro
        username: await encrypt((get('account-username') || '').trim(), vaultKeyMaterial),
        account: await encrypt((get('account-code') || '').trim(), vaultKeyMaterial),
        password: await encrypt(passwordToSave, vaultKeyMaterial),
        url: (get('account-url') || '').trim(), // In chiaro
        numeroIscrizione: await encrypt((get('account-numero-iscrizione') || '').trim(), vaultKeyMaterial),
        codiceSocieta: await encrypt((get('account-codice-societa') || '').trim(), vaultKeyMaterial),
        note: await encrypt((get('account-note') || '').trim(), vaultKeyMaterial),
        referenteNome: (get('ref-name') || '').trim(),
        referenteTelefono: (get('ref-phone') || '').trim(),
        referenteCellulare: (get('ref-mobile') || '').trim(),

        isBanking: (document.getElementById('flag-banking')?.checked && hasBankingData) || false,
        banking: await Promise.all(bankAccounts.map(async b => ({
            ...(b.bankId ? {bankId: b.bankId} : {}),
            iban: (b.iban || '').trim(),
            passwordDispositiva: await encrypt((b.passwordDispositiva || '').trim(), vaultKeyMaterial),
            referenteNome: (b.referenteNome || '').trim(),
            numeroVerde: (b.numeroVerde || '').trim(),
            referenteTelefono: (b.referenteTelefono || '').trim(),
            referenteCellulare: (b.referenteCellulare || '').trim(),
            cards: await Promise.all((b.cards || []).map(async c => ({
                cardType: (c.cardType || '').trim(),
                titolare: (c.titolare || '').trim(),
                cardNumber: await encrypt((c.cardNumber || '').trim(), vaultKeyMaterial),
                expiry: formatCardExpiry(c.expiry),
                pin: await encrypt((c.pin || '').trim(), vaultKeyMaterial),
                ccv: await encrypt((c.ccv || '').trim(), vaultKeyMaterial)
            })))
        }))),
        isExplicitMemo: isExplicitMemo,
        updatedAt: new Date().toISOString(),
        _encrypted: true // Indicatore crittografia attiva
    };

    const logoPreview = document.getElementById('account-logo-preview');
    if (logoPreview && !logoPreview.classList.contains('hidden')) {
        data.logo = logoPreview.src;
    }

    if (!data.nomeAccount) {
        showToast("Inserisci un nome account", "error");
        if (btnSave) btnSave.disabled = false;
        return;
    }

    const isSharedUI = document.getElementById('flag-shared')?.checked || false;
    const isMemoUI = document.getElementById('flag-memo')?.checked || false;
    const isMemoSharedUI = document.getElementById('flag-memo-shared')?.checked || false;
    const mode = accountModeFromFlags({ shared: isSharedUI, memo: isMemoUI, memoShared: isMemoSharedUI });
    const credentialValues = { username: get('account-username'), account: get('account-code'), password: get('account-password') };
    const modeValidation = validateAccountMode(mode, credentialValues);
    if (modeValidation.reason === 'memo-has-credentials') {
        showToast('Memorandum non può contenere Utente, Account/Codice o Password. Cancella manualmente questi campi.', 'warning');
        if (btnSave) btnSave.disabled = false;
        return;
    }
    if (modeValidation.reason === 'account-without-credentials') {
        showToast('Un Account deve contenere almeno una credenziale tra Utente, Account/Codice e Password.', 'warning');
        if (btnSave) btnSave.disabled = false;
        return;
    }

    Object.assign(data, recordFieldsFromAccountMode(mode));
    if (profileContactLinkDraft && !profileContactLinkDraft.sourceCompanyId) data.linkedProfileField = { type: profileContactLinkDraft.contactType, id: profileContactLinkDraft.profileContactId };

    const isSharingActive = data.visibility === 'shared';

    let emailsToInvite = [];
    if (isSharingActive) {
        emailsToInvite = [...invitedEmails];
        const raw = get('invite-email');
        if (raw) {
            const extraEmails = raw.split(/[,; ]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
            extraEmails.forEach(e => {
                if (!emailsToInvite.includes(e)) emailsToInvite.push(e);
            });
        }
        emailsToInvite = emailsToInvite.filter(email => !isOwnerRecipientEmail(email, auth.currentUser?.email));
        if (emailsToInvite.length === 0) {
            showToast("Scegli o aggiungi almeno un contatto per condividere.", "warning");
            if (btnSave) btnSave.disabled = false;
            return;
        }
    } else {
        data.sharedWith = {};
        data.acceptedCount = 0;
    }

    try {
        const colPath = `users/${currentUid}/aziende/${currentAziendaId}/accounts`;
        let retainedProfilePassword = false;

        // --- ATOMIC TRANSACTION V3.1 ---
        assertAccountSaveAllowed(loadContext);
        await runTransaction(db, async (transaction) => {
            const accRef = isEditing ? doc(db, colPath, currentDocId) : doc(collection(db, colPath));
            savedAccountId = accRef.id;
            const targetId = accRef.id;

            // 1. ALL READS FIRST
            const accountSnap = isEditing ? await transaction.get(accRef) : null;
            const profileRef = profileContactLinkDraft && !profileContactLinkDraft.sourceCompanyId ? doc(db, 'users', currentUid) : null;
            const profileSnap = profileRef ? await transaction.get(profileRef) : null;
            const oldData = accountSnap?.exists() ? accountSnap.data() : null;
            const companyLink = profileContactLinkDraft?.sourceCompanyId ? await prepareCompanyProfileLink(transaction, { uid: currentUid, draft: profileContactLinkDraft, targetId, targetCompanyId: currentAziendaId, oldData, data, isEditing, baseUpdatedAt }) : null;
            const contactCollection = profileContactLinkDraft?.contactType === 'phone' ? 'contactPhones' : 'contactEmails';
            let linkedContact = null;
            if (profileContactLinkDraft && !profileContactLinkDraft.sourceCompanyId) {
                const draft = profileContactLinkDraft;
                if (draft.ownerUid !== currentUid || auth.currentUser?.uid !== currentUid || draft.companyId !== currentAziendaId || !['email', 'phone', 'utility', 'document'].includes(draft.contactType)) throw new Error('Collegamento non valido per questa sessione.');
                const contact = findProfileAccountItem(profileSnap?.data(), draft);
                if (!contact) throw new Error('Contatto non disponibile.');
                if (contact.linkedAccountId && (contact.linkedAccountId !== targetId || contact.linkedAccountCompanyId !== currentAziendaId)) throw new Error('Contatto già collegato a un altro Account.');
                if (isEditing && (!oldData || (oldData.updatedAt || '') !== baseUpdatedAt)) throw new Error('Account modificato: ricarica prima di collegare.');
                if (oldData?.isArchived || data.visibility === 'shared' || data.type === 'memo') throw new Error('Scegli un Account attivo non condiviso.');
                const legacyPassword = profileContactLinkDraft.contactType === 'email' ? await decryptRequiredValue(contact.password, vaultKeyMaterial) : '';
                const passwordTransferred = isProfileEmailPasswordTransferred(legacyPassword, passwordToSave);
                retainedProfilePassword = Boolean(legacyPassword) && !passwordTransferred;
                linkedContact = profileContactLinkDraft.contactType === 'email'
                    ? linkProfileEmailToAccount(contact, targetId, { passwordTransferred })
                    : { ...contact, linkedAccountId: targetId };
                linkedContact.linkedAccountCompanyId = currentAziendaId;
            }
            let currentSharedWith = oldData?.sharedWith || {};
            // M7-R7C-1: ciclo di condivisione dell'Account (0 = legacy). Un valore
            // malformato chiude il salvataggio invece di scrivere su un ID incerto.
            const sharingCycle = sharingCycleOf(oldData);
            if (sharingCycle === null) throw new Error('CICLO_DI_CONDIVISIONE_NON_VALIDO');

            // 2. NOW EXECUTE ALL WRITES
            assertAccountSaveAllowed(loadContext);
            if (auth.currentUser?.uid !== currentUid) {
                throw Object.assign(new Error('ACCOUNT_SAVE_SESSION_CHANGED'), {code: 'ACCOUNT_SAVE_SESSION_CHANGED'});
            }
            const finalData = { ...data };
            if (linkedContact) {
                const updatedProfile = {...profileSnap.data(), ...patchProfileAccountItem(profileSnap.data(), profileContactLinkDraft, linkedContact)};
                finalData.linkedProfileFields = profileAccountReferences(updatedProfile, targetId, currentAziendaId);
                finalData.linkedProfileField = finalData.linkedProfileFields[0];
            }
            if (companyLink) { finalData.linkedCompanyProfileFields = companyLink.backlinks; finalData.linkedCompanyProfileField = companyLink.backlinks[0]; transaction.update(companyLink.ref, companyLink.patch); }
            if (!isEditing) finalData.createdAt = new Date().toISOString();
            finalData.type = (data.type === 'memo') ? 'memo' : 'account'; // Force correct type V3.1

            // Handle Revocation Logic o Switch to Private
            if (!isSharingActive) {
                // Se diventa privato, distruggi tutti gli inviti pendenti pregressi (orfani)
                for (const sKey of Object.keys(currentSharedWith)) {
                    transaction.delete(doc(db, "invites", inviteIdForGuest(targetId, sKey, sharingCycle)));

                    // Notifica all'ospite: richiede un backend dedicato, non implementata.
                }
                finalData.sharedWith = {};
                finalData.sharedWithUids = [];
                finalData.acceptedCount = 0;
            } else {
                // E' SHARED. Merge new invites into the sharedWith Map
                finalData.sharedWith = { ...currentSharedWith };

                // Track which emails are requested in UI to find removed ones
                const requestedSanitizedKeys = emailsToInvite.map(e => sanitizeEmail(e));

                // Rimuovi quelli sbiancati dalla UI
                for (const oldKey of Object.keys(currentSharedWith)) {
                    if (!requestedSanitizedKeys.includes(oldKey)) {
                        delete finalData.sharedWith[oldKey];
                        transaction.delete(doc(db, "invites", inviteIdForGuest(targetId, oldKey, sharingCycle)));

                        // Notifica all'ospite: richiede un backend dedicato, non implementata.
                    }
                }

                // Aggiungi Nuovi
                for (const email of emailsToInvite) {
                    const sKey = sanitizeEmail(email);
                    const notificationPreference = preferenceForRecipient(invitePreferences, email);
                    const existingGuest = finalData.sharedWith[sKey];
                    if (existingGuest) {
                        finalData.sharedWith[sKey] = {...existingGuest, ...notificationPreference};
                    }

                    // FIX V5.1: Se l'utente non c'e' OPPURE ha rifiutato, crea/resetta l'invito
                    // M7-R7C-1: anche una voce `suspended` (Account archiviato e
                    // ripristinato) richiede un NUOVO invito: è reinvitabile solo
                    // perché l'utente l'ha riselezionata nel modulo.
                    if (!existingGuest || existingGuest.status === 'rejected' || existingGuest.status === 'suspended') {
                        finalData.sharedWith[sKey] = {
                            email: email,
                            status: 'pending',
                            uid: null,
                            ...notificationPreference
                        };

                        // Crea Invito
                        transaction.set(doc(db, "invites", inviteIdForGuest(targetId, sKey, sharingCycle)), {
                            inviteId: inviteIdForGuest(targetId, sKey, sharingCycle),
                            // M7-AUDIT-5C: base opaca dell'istanza di invito, nuova a
                            // ogni creazione e a ogni reinvito. L'id dell'evento di
                            // registro si deriva solo da qui, mai dall'email, dalla
                            // sua chiave sanificata o dall'id del documento.
                            auditRef: crypto.randomUUID(),
                            accountId: targetId,
                            aziendaId: currentAziendaId,
                            ownerId: currentUid,
                            senderId: currentUid,
                            senderEmail: auth.currentUser?.email || '',
                            recipientEmail: email.toLowerCase().trim(),
                            accountName: data.nomeAccount,
                            type: finalData.type,
                            notifyPush: notificationPreference.notifyPush,
                            notifyEmail: notificationPreference.notifyEmail,
                            status: 'pending',
                            cycle: sharingCycle,
                            createdAt: new Date().toISOString()
                        });

                        // Notifica Owner (pending)
                        const notifRef = doc(collection(db, "users", currentUid, "notifications"));
                        transaction.set(notifRef, {
                            title: "Invito Inviato",
                            message: `Hai invitato ${email} ad accedere a ${data.nomeAccount}. In attesa di risposta.`,
                            type: "share_sent",
                            accountId: targetId,
                            guestEmail: email,
                            timestamp: new Date().toISOString(),
                            read: false
                        });
                    }
                }

                // Calcola Accepted Count V3.1
                finalData.acceptedCount = Object.values(finalData.sharedWith).filter(g => g.status === 'accepted').length;
                finalData.sharedWithUids = Object.values(finalData.sharedWith)
                    .filter(g => g.status === 'accepted' && g.uid)
                    .map(g => g.uid);

                // AUTO-HEALING V5.1: Forza visibilità private se non ci sono inviti attivi
                const hasActive = Object.values(finalData.sharedWith).some(g => g.status === 'pending' || g.status === 'accepted');
                if (!hasActive) {
                    finalData.visibility = "private";
                }
            }

            // Elimina vecchi flag se esistenti in OldData (pulizia volante)
            if (isEditing) {
                finalData.shared = deleteField();
                finalData.isMemoShared = deleteField();
                finalData.hasMemo = deleteField();
                finalData.sharedWithEmails = deleteField();
                finalData.recipientEmail = deleteField();
            }

            LOG("[V3.1-DEBUG] Company account transaction ready");
            // Update/Create Account V3.1
            if (isEditing) transaction.update(accRef, finalData);
            else transaction.set(accRef, finalData);
            if (profileRef) transaction.update(profileRef, patchProfileAccountItem(profileSnap.data(), profileContactLinkDraft, linkedContact));
        });

        if (profileContactLinkDraft) sessionStorage.removeItem('profile-account-link-draft');
        showToast(retainedProfilePassword ? 'Account collegato. La password diversa è stata conservata nel Profilo.' : t('success_save'), retainedProfilePassword ? 'warning' : 'success');
        setTimeout(() => {
            const destination = !isEditing && btnSave?.dataset.openSharedCredentials === 'true'
                ? `form_account_azienda.html?id=${savedAccountId}&aziendaId=${currentAziendaId}&linkShared=1#shared-credentials-section`
                : isEditing
                ? `dettaglio_account_azienda.html?id=${currentDocId}&aziendaId=${currentAziendaId}&afterWrite=1`
                : `dati_azienda.html?id=${currentAziendaId}`;
            window.location.replace(destination);
        }, 1000);

    } catch (e) {
        console.error("[V3.1-ERROR] SaveAccount Azienda Failed:", e);
        if (e.code === 'permission-denied') showToast("Accesso negato. Controlla i permessi Firestore.", "error");
        else showToast(t('error_generic') || "Errore durante il salvataggio", "error");
        if (btnSave) btnSave.disabled = false;
    }
}

/**
 * Sposta nell'Archivio un account aziendale: la cancellazione definitiva resta
 * possibile soltanto dall'Archivio, con una conferma esplicita.
 * @param {Object} ctx - Contesto con ID dell'account
 */
export async function deleteAccount({ currentUid, currentAziendaId, currentDocId, observedRevision, observedUpdatedAt, observedSharing = null }) {
    // Import differito: il servizio di Archivio (e con esso il modello dei
    // destinatari) non entra nella closure iniziale della pagina (budget dei
    // moduli statici) e viene caricato soltanto quando l'utente conferma.
    let archiveAccount, archiveConfirmMessage;
    try {
        ({ archiveAccount, archiveConfirmMessage } = await import('../settings/archive-account-service.js'));
    } catch (e) {
        logError("Archive", e);
        showToast(t('error_generic'), "error");
        return;
    }
    // M7-R7B4: avviso informativo sui destinatari, ricavato dal documento
    // caricato all'apertura (nessuna lettura nuova, nessun segreto).
    if (!await showConfirmModal(t('confirm_archive_title'), archiveConfirmMessage(observedSharing, t))) return;
    try {
        // Si usa il marker OSSERVATO all'apertura del modulo: una rilettura
        // appena prima dell'archiviazione renderebbe invisibile una modifica
        // concorrente avvenuta dopo l'apertura. Se manca un marker affidabile
        // l'operazione fallisce chiusa e invita ad aggiornare.
        if (observedRevision === undefined && !observedUpdatedAt) {
            showToast(t('archive_conflict_refresh'), "error");
            return;
        }
        const result = await archiveAccount(currentUid, {id: currentDocId, context: currentAziendaId,
            revision: observedRevision, updatedAt: observedUpdatedAt});
        showToast(result.status === 'already-archived' ? t('success_already_archived') : t('success_moved_to_archive'), "success");
        setTimeout(() => window.location.href = `account_azienda.html?id=${currentAziendaId}`, 1000);
    } catch (e) {
        logError("Archive", e);
        if (['ARCHIVE_CONFLICT', 'ARCHIVE_UPDATED_AT_CONFLICT', 'ARCHIVE_MARKER_MISSING'].includes(e?.code)) showToast(t('archive_conflict_refresh'), "error");
        else if (e?.code === 'ARCHIVE_ACCOUNT_MISSING') showToast(t('archive_missing_refresh'), "error");
        else showToast(t('error_generic'), "error");
    }
}
