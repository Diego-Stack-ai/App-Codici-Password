import { auth, db } from '../../firebase-config.js?v=1.2.54';
import { LOG } from '../../logger.js';
import { collection, deleteField, doc, runTransaction } from '/assets/js/vendor/firebase-runtime.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { sanitizeEmail } from '../../utils.js';
import { encrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { accountModeFromFlags, recordFieldsFromAccountMode, validateAccountMode } from '../shared/account-mode-model.js';

export async function savePrivateAccount({
    bankAccounts,
    invitedEmails,
    isExplicitMemo,
    currentUid,
    currentDocId,
    isEditing,
    profileEmailLinkDraft
}) {
    const get = id => document.getElementById(id)?.value.trim() || '';
    const btnSave = document.getElementById('btn-save-footer') || document.querySelector('[data-action="save"]');
    if (btnSave) btnSave.disabled = true;

    // Check if banking actually has data
    const hasBankingData = (bankAccounts || []).some(acc => {
        const hasIban = acc.iban && acc.iban.trim().length > 0;
        const hasDisp = acc.passwordDispositiva && acc.passwordDispositiva.trim().length > 0;
        const hasCards = acc.cards && acc.cards.some(c => c.cardNumber?.trim() || c.cardType?.trim() || c.pin?.trim() || c.ccv?.trim());
        const hasRef = (acc.referenteTelefono?.trim() || acc.referenteCellulare?.trim());
        return hasIban || hasDisp || hasCards || hasRef;
    });

    // 🔐 PROTOCOLLO BLINDA: Crittografia Dati Sensibili
    let vaultKeyMaterial;
    try {
        vaultKeyMaterial = await ensureVaultKeyMaterial();
    } catch (e) {
        showToast("Accesso negato: Chiave di crittografia richiesta.", "error");
        if (btnSave) btnSave.disabled = false;
        return;
    }

    const logoPreview = document.getElementById('account-logo-preview');
    const logoSrc = (logoPreview && !logoPreview.classList.contains('hidden')) ? logoPreview.src : null;

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

    const data = {
        nomeAccount: (get('account-name') || '').trim(), // In chiaro
        username: await encrypt((get('account-username') || '').trim(), vaultKeyMaterial),
        account: await encrypt((get('account-code') || '').trim(), vaultKeyMaterial),
        password: await encrypt((get('account-password') || '').trim(), vaultKeyMaterial),
        url: (get('account-url') || '').trim(), // In chiaro
        note: await encrypt((get('account-note') || '').trim(), vaultKeyMaterial),
        logo: logoSrc || null,
        referenteNome: (document.getElementById('ref-name')?.value || '').trim(),
        referenteTelefono: (document.getElementById('ref-phone')?.value || '').trim(),
        referenteCellulare: (document.getElementById('ref-mobile')?.value || '').trim(),

        // V3.1: Deterministc Types
        ...recordFieldsFromAccountMode(mode),

        isBanking: (document.getElementById('flag-banking')?.checked && hasBankingData) || false,
        banking: await Promise.all((bankAccounts || []).map(async b => ({
            ...b,
            passwordDispositiva: await encrypt(b.passwordDispositiva || '', vaultKeyMaterial),
            cards: await Promise.all((b.cards || []).map(async c => ({
                ...c,
                cardNumber: await encrypt(c.cardNumber || '', vaultKeyMaterial),
                pin: await encrypt(c.pin || '', vaultKeyMaterial),
                ccv: await encrypt(c.ccv || '', vaultKeyMaterial)
            })))
        }))),
        isExplicitMemo: isExplicitMemo,
        updatedAt: new Date().toISOString(),
        _encrypted: true // Flag per indicare che i dati sono cifrati (V6.0)
    };
    if (profileEmailLinkDraft?.profileEmailId) {
        data.linkedProfileField = { type: 'email', id: profileEmailLinkDraft.profileEmailId };
    }

    if (!data.nomeAccount) { showToast("Inserisci un nome account", "error"); if (btnSave) btnSave.disabled = false; return; }

    const isSharingActive = data.visibility === 'shared';
    

    // Gestione Array UI / Contatti Selezionati
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
        // --- ATOMIC TRANSACTION V3.1 ---
        await runTransaction(db, async (transaction) => {
            const accRef = isEditing ? doc(db, "users", currentUid, "accounts", currentDocId) : doc(collection(db, "users", currentUid, "accounts"));
            const targetId = accRef.id;

            // 1. ALL READS FIRST
            const accountSnap = isEditing ? await transaction.get(accRef) : null;
            const profileUserRef = profileEmailLinkDraft?.profileEmailId ? doc(db, 'users', currentUid) : null;
            const profileUserSnap = profileUserRef ? await transaction.get(profileUserRef) : null;
            const oldData = accountSnap?.exists() ? accountSnap.data() : null;
            let currentSharedWith = oldData?.sharedWith || {};

            // 2. NOW EXECUTE ALL WRITES
            let finalData = { ...data };
            if (!isEditing) finalData.createdAt = new Date().toISOString();

            // Handle Revocation Logic o Switch to Private
            if (!isSharingActive) {
                // Se diventa privato, distruggi tutti gli inviti pendenti pregressi (orfani)
                for (const sKey of Object.keys(currentSharedWith)) {
                    const guest = currentSharedWith[sKey];
                    transaction.delete(doc(db, "invites", `${targetId}_${sKey}`));

                    // [NEW] Notifica Guest (se aveva accettato)
                    if (guest && guest.status === 'accepted' && guest.uid) {
                        const guestNotifRef = doc(collection(db, "users", guest.uid, "notifications"));
                        transaction.set(guestNotifRef, {
                            title: "Accesso Revocato",
                            message: `Il proprietario ha reso privato l'account: ${data.nomeAccount || 'condiviso'}. Il tuo accesso è terminato.`,
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

                        // [NEW] Notifica Guest (se aveva accettato)
                        if (guest && guest.status === 'accepted' && guest.uid) {
                            const guestNotifRef = doc(collection(db, "users", guest.uid, "notifications"));
                            transaction.set(guestNotifRef, {
                                title: "Accesso Revocato",
                                message: `Il proprietario ha rimosso il tuo accesso a: ${data.nomeAccount || 'un account condiviso'}.`,
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

                    // --- FIX V5.1: Se l'utente non c'e' OPPURE ha rifiutato, crea/resetta l'invito ---
                    if (!existingGuest || existingGuest.status === 'rejected') {
                        // Nuovo Guest o Reset di un rifiutato
                        finalData.sharedWith[sKey] = {
                            email: email,
                            status: 'pending',
                            uid: null
                        };

                        // Crea Invito
                        transaction.set(doc(db, "invites", `${targetId}_${sKey}`), {
                            inviteId: `${targetId}_${sKey}`,
                            accountId: targetId,
                            ownerId: currentUid,
                            senderId: currentUid,
                            senderEmail: auth.currentUser?.email || '',
                            recipientEmail: email.toLowerCase().trim(),
                            accountName: data.nomeAccount,
                            type: data.type,
                            notifyPush: document.getElementById('invite-notify-push')?.checked === true,
                            notifyEmail: document.getElementById('invite-notify-email')?.checked === true,
                            status: 'pending',
                            createdAt: new Date().toISOString()
                        });

                        // V3 Notifica Owner (pending)
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

                // --- AUTO-HEALING DI STATO V5.1: Forza visibilità private se non ci sono inviti attivi ---
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

            LOG("[V3.1-DEBUG] Account transaction ready");
            // Update/Create Account V3.1
            if (isEditing) transaction.update(accRef, finalData);
            else transaction.set(accRef, finalData);

            if (!isEditing && profileEmailLinkDraft?.profileEmailId) {
                const emails = profileUserSnap?.data()?.contactEmails || [];
                transaction.update(profileUserRef, {
                    contactEmails: emails.map(email => email.id === profileEmailLinkDraft.profileEmailId
                        ? { ...email, linkedAccountId: targetId, password: '' }
                        : email)
                });
            }
        });

        if (profileEmailLinkDraft) sessionStorage.removeItem('profile-account-link-draft');

        showToast(t('success_save'), "success");
        setTimeout(() => {
            const destination = isEditing
                ? `dettaglio_account_privato.html?id=${currentDocId}`
                : 'account_privati.html';
            window.location.replace(destination);
        }, 1000);

    } catch (e) {
        console.error("[V3.1-ERROR] SaveAccount Transaction Failed:", e);
        if (e.code === 'permission-denied') showToast("Accesso negato. Controlla i permessi Firestore.", "error");
        else showToast(t('error_generic') || "Errore durante il salvataggio", "error");
        if (btnSave) btnSave.disabled = false;
    }
};

