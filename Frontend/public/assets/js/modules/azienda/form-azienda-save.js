import { findProfileAccountItem, patchProfileAccountItem, profileAccountReferences } from '../privato/profile-model.js';
import { prepareCompanyProfileLink } from '../azienda/company-profile-link.js';
/**
 * FORM ACCOUNT AZIENDA — SAVE MODULE (V1.0)
 * Salvataggio e cancellazione degli account aziendali.
 * Estratto da form_account_azienda.js per ridurre la complessità del modulo principale.
 * Entry: saveAccount(ctx), deleteAccount(ctx)
 */

import { auth, db } from '../../firebase-config.js?v=1.2.111';
import { LOG } from '../../logger.js';
import {
    doc, collection, runTransaction, deleteDoc, deleteField
} from "/assets/js/vendor/firebase-runtime.js";
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError, sanitizeEmail } from '../../utils.js';
import { encrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { accountModeFromFlags, recordFieldsFromAccountMode, validateAccountMode } from '../shared/account-mode-model.js';
import { formatCardExpiry, hasInvalidCardExpiry } from '../shared/banking-model.js';
import { linkProfileEmailToAccount, isProfileEmailPasswordTransferred } from '../privato/profile-model.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';

// Utility locale per recupero rapido valori
const get = (id) => document.getElementById(id)?.value.trim() || '';

/**
 * Salva o aggiorna un account aziendale con crittografia e gestione condivisione.
 * @param {Object} ctx - Stato corrente del form
 */
export async function saveAccount({ bankAccounts, invitedEmails, isExplicitMemo, currentUid, currentDocId, currentAziendaId, isEditing, profileContactLinkDraft, baseUpdatedAt = '' }) {
    const btnSave = document.getElementById('save-btn-footer') || document.querySelector('[data-action="save"]');
    if (btnSave) btnSave.disabled = true;

    if (hasInvalidCardExpiry(bankAccounts)) {
        showToast('Inserisci la scadenza della carta nel formato MM/AA, con un mese da 01 a 12.', 'warning');
        if (btnSave) btnSave.disabled = false;
        return;
    }

    const hasBankingData = bankAccounts.some(acc => acc.iban?.trim() || (acc.cards && acc.cards.length > 0));

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
            iban: (b.iban || '').trim(),
            passwordDispositiva: await encrypt((b.passwordDispositiva || '').trim(), vaultKeyMaterial),
            referenteNome: (b.referenteNome || '').trim(),
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
    if (modeValidation.reason === 'shared-account-without-credentials') {
        showToast('Un Account condiviso deve contenere almeno una credenziale.', 'warning');
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
        await runTransaction(db, async (transaction) => {
            const accRef = isEditing ? doc(db, colPath, currentDocId) : doc(collection(db, colPath));
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

            // 2. NOW EXECUTE ALL WRITES
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
                    const guest = currentSharedWith[sKey];
                    transaction.delete(doc(db, "invites", `${targetId}_${sKey}`));

                    // Notifica Guest (se aveva accettato)
                    if (guest && guest.status === 'accepted' && guest.uid) {
                        const guestNotifRef = doc(collection(db, "users", guest.uid, "notifications"));
                        transaction.set(guestNotifRef, {
                            title: "Accesso Revocato",
                            message: `Il proprietario ha reso privato l'account aziendale: ${data.nomeAccount || 'condiviso'}. Il tuo accesso è terminato.`,
                            accountName: data.nomeAccount || 'Account',
                            type: "share_revoked",
                            ownerEmail: auth.currentUser?.email || 'Proprietario',
                            timestamp: new Date().toISOString(),
                            read: false
                        });
                    }
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
                        const guest = currentSharedWith[oldKey];
                        delete finalData.sharedWith[oldKey];
                        transaction.delete(doc(db, "invites", `${targetId}_${oldKey}`));

                        // Notifica Guest (se aveva accettato)
                        if (guest && guest.status === 'accepted' && guest.uid) {
                            const guestNotifRef = doc(collection(db, "users", guest.uid, "notifications"));
                            transaction.set(guestNotifRef, {
                                title: "Accesso Revocato",
                                message: `Il proprietario ha rimosso il tuo accesso a: ${data.nomeAccount || 'un account aziendale condiviso'}.`,
                                accountName: data.nomeAccount || 'Account',
                                type: "share_revoked",
                                ownerEmail: auth.currentUser?.email || 'Proprietario',
                                timestamp: new Date().toISOString(),
                                read: false
                            });
                        }
                    }
                }

                // Aggiungi Nuovi
                for (const email of emailsToInvite) {
                    const sKey = sanitizeEmail(email);
                    const existingGuest = finalData.sharedWith[sKey];

                    // FIX V5.1: Se l'utente non c'e' OPPURE ha rifiutato, crea/resetta l'invito
                    if (!existingGuest || existingGuest.status === 'rejected') {
                        finalData.sharedWith[sKey] = {
                            email: email,
                            status: 'pending',
                            uid: null
                        };

                        // Crea Invito
                        transaction.set(doc(db, "invites", `${targetId}_${sKey}`), {
                            inviteId: `${targetId}_${sKey}`,
                            accountId: targetId,
                            aziendaId: currentAziendaId,
                            ownerId: currentUid,
                            senderId: currentUid,
                            senderEmail: auth.currentUser?.email || '',
                            recipientEmail: email.toLowerCase().trim(),
                            accountName: data.nomeAccount,
                            type: finalData.type,
                            notifyPush: document.getElementById('invite-notify-push')?.checked === true,
                            notifyEmail: document.getElementById('invite-notify-email')?.checked === true,
                            status: 'pending',
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
            const destination = isEditing
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
 * Cancella un account aziendale da Firestore.
 * @param {Object} ctx - Contesto con ID dell'account
 */
export async function deleteAccount({ currentUid, currentAziendaId, currentDocId }) {
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) return;
    try {
        await deleteDoc(doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentDocId));
        showToast(t('success_deleted'), "success");
        setTimeout(() => window.location.href = `account_azienda.html?id=${currentAziendaId}`, 1000);
    } catch (e) { logError("Delete", e); showToast(t('error_generic'), "error"); }
}
