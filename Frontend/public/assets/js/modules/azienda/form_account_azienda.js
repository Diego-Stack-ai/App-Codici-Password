import {normalizeEditableBankingAccounts, hasRealBankingData} from '../shared/banking-model.js';
import { findProfileAccountItem } from '../privato/profile-model.js';
import { loadCompanyProfileContact } from '../azienda/company-profile-link.js';
/**
 * FORM ACCOUNT AZIENDA MODULE (V6.0 SPLIT)
 * Creazione e modifica account aziendali con gestione dinamica IBAN.
 * - Entry Point: initFormAccountAzienda(user)
 * - Save/Delete estratto in: form-azienda-save.js
 */

import { db } from '../../firebase-config.js?v=1.2.156';
import { doc, collection } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { renderBankAccounts } from '../shared/banking-renderer.js?v=1.2.156';
import { logError } from '../../utils.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
async function saveAccount(...args) {
    let module;
    try { module = await import('./form-azienda-save.js'); }
    catch {
        if (args[0]?.loadContext === loadContext && isAccountSaveAllowed(loadContext)) {
            showToast('Impossibile caricare il salvataggio. Riprova.', 'error');
            const button = document.getElementById('save-btn-footer');
            if (button) button.disabled = false;
        }
        return;
    }
    return module.saveAccount(...args);
}
async function deleteAccount(...args) {
    const epoch = mountEpoch;
    let module;
    try { module = await import('./form-azienda-save.js'); }
    catch {
        if (epoch === mountEpoch) showToast('Impossibile caricare l’archiviazione. Riprova.', 'error');
        return;
    }
    if (epoch !== mountEpoch || !markerConfirmed) return;
    return module.deleteAccount(...args);
}
import { getCompanyAccount, getUserProfile, listContacts } from '../data/vault-repository.js';
import { prepareProfileEmailAccountValues } from '../privato/profile-model.js';
import { decryptRequiredValue } from '../core/crypto-utils.js';
import { accountModeFromFlags, accountModeFromRecord, filterRecipientContacts, isOwnerRecipientEmail, normalizeRecipientEmail, preferenceForRecipient, recipientPreferencesFromSharedWith, serializeRecipientPreferences, validateAccountMode } from '../shared/account-mode-model.js';
import { initAccountEmbeddedWidgets } from '../shared/account-embedded-widgets.js?v=1.2.156';
import { initAccountSharedCredentials, initNewAccountSharedCredentials } from '../shared/account-shared-credentials.js?v=1.2.156';
import { DECRYPT_FAILURE_MESSAGE, createAccountLoadContext, isAccountSaveAllowed } from '../shared/credential-decrypt-guard.js';

// --- STATE ---
let currentUid = null;
let currentDocId = null;
let currentAziendaId = null;
let isEditing = false;
let savedBankIds = new Set();
let bankAccounts = [];
let myContacts = [];
let isExplicitMemo = false; // V5.2: Differenzia Memo Reale da Account condiviso come Memo
let invitedEmails = [];
let recipientPreferences = new Map();
let ownerEmail = '';
let accountWidgetController = null;
let profileContactLinkDraft = null;
let baseUpdatedAt = '';
let loadContext = null;
globalThis.addEventListener?.('vault-session-locked', () => loadContext?.invalidate());
// Marker osservato all'apertura del modulo: è il termine di paragone
// dell'archiviazione, così una modifica concorrente non viene sovrascritta.
let observedRevision;
// Falso finché il `loadData()` del montaggio corrente non ha confermato il
// documento mostrato: un rimontaggio su un altro Account, o un caricamento
// fallito, non possono riusare il marker del montaggio precedente.
let markerConfirmed = false;
// Campi di condivisione osservati all'apertura: servono solo a comporre
// l'avviso dei destinatari prima di archiviare. Non contengono credenziali.
let observedSharing = null;
// Epoch del montaggio: ogni `initFormAccountAzienda` ne apre uno nuovo. Un
// caricamento che termina dopo l'avvio di un altro montaggio appartiene a
// un'epoch superata e va scartato: senza questo controllo il completamento
// tardivo del montaggio A potrebbe confermare il marker di A nella callback
// `window.deleteAccount` del montaggio B.
let mountEpoch = 0;

// Funzione di re-render locale per banking-renderer
const rerender = () => renderBankAccounts(bankAccounts, rerender, {
    onAddWidget: bankId => {
        if (accountWidgetController) return accountWidgetController.openNewWidget(bankId);
        showToast('Salva prima l’Account, poi aggiungi i Widget del conto.', 'warning');
    },
    onWidgetsMount: () => accountWidgetController?.placeBankWidgets()
});

// Utility per recupero rapido valori
const get = (id) => document.getElementById(id)?.value.trim() || '';

// --- INITIALIZATION ---
export async function initFormAccountAzienda(user) {
    const credentialsForm = document.getElementById('account-credentials-form');
    if (credentialsForm) credentialsForm.onsubmit = event => event.preventDefault();
    savedBankIds = new Set();

    if (!user) return;
    const mount = ++mountEpoch;
    currentUid = user.uid;
    ownerEmail = normalizeRecipientEmail(user.email);
    invitedEmails = [];
    recipientPreferences = new Map();

    const urlParams = new URLSearchParams(window.location.search);
    currentDocId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');
    profileContactLinkDraft = null;
    baseUpdatedAt = '';
    observedRevision = undefined;
    markerConfirmed = false;
    observedSharing = null;
    try {
        const draft = JSON.parse(sessionStorage.getItem('profile-account-link-draft') || 'null');
        if (draft?.profileContactId === urlParams.get('profileContactId') && draft.ownerUid === user.uid &&
            draft.companyId === currentAziendaId && ['email', 'phone', 'utility', 'document'].includes(draft.contactType)) profileContactLinkDraft = draft;
    } catch { profileContactLinkDraft = null; }
    isEditing = !!currentDocId;
    loadContext?.invalidate();
    loadContext = createAccountLoadContext({recordId: currentDocId, mode: isEditing ? 'edit' : 'create'});
    const pagehideMount = mountEpoch;
    const pagehideContext = loadContext;
    window.addEventListener('pagehide', () => {
        if (pagehideMount !== mountEpoch) return;
        mountEpoch += 1;
        pagehideContext?.invalidate();
    }, {once:true});
    document.getElementById('account-mode-edit-controls')?.classList.toggle('hidden', isEditing);
    if (isEditing) {
        ['flag-shared', 'flag-memo', 'flag-memo-shared'].forEach(id => document.getElementById(id)?.closest('label')?.classList.add('hidden'));
        document.getElementById('shared-management')?.classList.add('hidden');
    }
    document.querySelectorAll('.manage-recipients-link').forEach(link => {
        const returnTo = `${window.location.pathname.split('/').pop()}${window.location.search}`;
        link.href = `gestione_destinatari.html?return=${encodeURIComponent(returnTo)}`;
    });

    if (!currentAziendaId) {
        showToast("ID Azienda mancante", "error");
        setTimeout(() => history.back(), 1000);
        return;
    }

    // Reset State
    bankAccounts = [];
    myContacts = [];

    // Esponi deleteAccount su window per eventuali onclick HTML.
    // L'archiviazione resta bloccata finché questo montaggio non ha confermato
    // identità e marker del documento visualizzato: senza la conferma si invita
    // ad aggiornare invece di usare lo stato di un montaggio precedente.
    window.deleteAccount = () => {
        if (!markerConfirmed) { showToast(t('archive_conflict_refresh'), "error"); return; }
        return deleteAccount({ currentUid, currentAziendaId, currentDocId, observedRevision, observedUpdatedAt: baseUpdatedAt, observedSharing });
    };

    initBaseUI();
    setupUI();
    setupImageUploader();
    await Promise.all([
        loadRubrica(),
        isEditing ? loadData() : Promise.resolve()
    ]);
    // Un montaggio superato non deve proseguire: lo stato di modulo (compresi
    // gli identificativi) appartiene ormai al montaggio corrente.
    if (mount !== mountEpoch) return;
    if (profileContactLinkDraft) {
        try {
            const profile = profileContactLinkDraft.sourceCompanyId ? null : await getUserProfile(user.uid);
            const isPhone = profileContactLinkDraft.contactType === 'phone';
            const contact = profileContactLinkDraft.sourceCompanyId ? await loadCompanyProfileContact(user.uid, profileContactLinkDraft) : findProfileAccountItem(profile, profileContactLinkDraft);
            if (!contact) throw new Error('Contatto non disponibile.');
            const key = await ensureVaultKeyMaterial();
            const email = isPhone ? { address: contact.number } : { ...contact,
                password: await decryptRequiredValue(contact.password, key), note: await decryptRequiredValue(contact.note, key) };
            if (profileContactLinkDraft.contactType === 'document') email.address = await decryptRequiredValue(contact.username, key);
            if (profileContactLinkDraft.contactType === 'utility') email.address = '';
            if (profileContactLinkDraft.sourceCompanyId && contact.username) email.address = await decryptRequiredValue(contact.username, key);
            const values = prepareProfileEmailAccountValues(email, {
                username: get('account-username'), password: get('account-password'), note: get('account-note')
            });
            for (const [field, value] of Object.entries(values)) {
                const input = document.getElementById(`account-${field}`);
                if (input) input.value = value;
            }
            if (!get('account-name')) document.getElementById('account-name').value = ({phone:'Telefono ',email:'Email ',utility:'Utenza ',document:'Documento '}[profileContactLinkDraft.contactType]) + (contact.label || contact.type || email.address || '');
            showToast('Verifica i dati e salva per collegare il contatto all’Account aziendale.', 'info');
            document.getElementById('save-btn-footer').disabled = false;
        } catch {
            showToast('Dati non disponibili: torna al Profilo e riprova. Nessun dato è stato trasferito.', 'error');
            return;
        }
    }
    if (isEditing) {
        await initAccountSharedCredentials({
            uid: currentUid, context: 'company', companyId: currentAziendaId,
            accountId: currentDocId, editable: true
        });
        accountWidgetController = await initAccountEmbeddedWidgets({
            isBankSaved: bankId => savedBankIds.has(bankId),
            uid: currentUid, context: 'company', companyId: currentAziendaId,
            accountId: currentDocId, editable: true,
            onSharedLinked: () => initAccountSharedCredentials({
                uid: currentUid, context: 'company', companyId: currentAziendaId,
                accountId: currentDocId, editable: true
            })
        });
    } else {
        initNewAccountSharedCredentials({saveButtonId: 'save-btn-footer'});
    }
}

function initBaseUI() {
    

    // Footer actions setup
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);

        const cancelBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-neutral',
            title: t('cancel') || 'Annulla',
            onclick: () => {
                if (isEditing && currentDocId) window.location.href = `dettaglio_account_azienda.html?id=${currentDocId}&aziendaId=${currentAziendaId}`;
                else history.back();
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'close' })
        ]);

        const saveBtn = createElement('button', {
            id: 'save-btn-footer',
            disabled: Boolean(profileContactLinkDraft),
            className: 'btn-fab-action btn-fab-scadenza',
            title: t('save') || 'Salva',
            onclick: async () => {
                saveBtn.disabled = true;
                const saveContext = loadContext;
                const saveMount = mountEpoch;
                const saveUid = currentUid;
                const saveDocId = currentDocId;
                if (!isAccountSaveAllowed(saveContext)) {
                    showToast(DECRYPT_FAILURE_MESSAGE, 'warning');
                    saveBtn.disabled = false;
                    return;
                }
                try {
                    await accountWidgetController?.savePendingChanges();
                } catch (error) {
                    showToast(error.message || 'Salvataggio dei campi personalizzati non riuscito.', 'error');
                    saveBtn.disabled = false;
                    return;
                }
                if (saveContext !== loadContext || saveMount !== mountEpoch
                    || currentUid !== saveUid || currentDocId !== saveDocId) {
                    showToast('Sessione o Account cambiati: salvataggio annullato.', 'warning');
                    saveBtn.disabled = false;
                    return;
                }
                await saveAccount({
                    bankAccounts, invitedEmails, invitePreferences: serializeRecipientPreferences(recipientPreferences, invitedEmails), isExplicitMemo, currentUid: saveUid,
                    currentDocId: saveDocId, currentAziendaId, isEditing, profileContactLinkDraft, baseUpdatedAt,
                    loadContext: saveContext
                });
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
        ]);

        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [cancelBtn, saveBtn]));
    }

    // Header Back button customization
    if (isEditing && currentDocId) {
        const hLeft = document.getElementById('header-left');
        if (hLeft) {
            clearElement(hLeft);
            setChildren(hLeft, createElement('button', {
                className: 'btn-icon-header',
                onclick: () => window.location.href = `dettaglio_account_azienda.html?id=${currentDocId}&aziendaId=${currentAziendaId}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
            ]));
        }
    }
}

async function loadData() {
    // Come `loadRubrica`, l'epoch è catturata SINCROMENTE alla chiamata (dentro il
    // `Promise.all` dello stesso `init`): il contratto di fondazione UI
    // `loadRubrica()` + `loadData()` resta intatto e la protezione dal montaggio
    // superato è identica.
    const mount = mountEpoch;
    const stale = () => mount !== mountEpoch;
    const context = loadContext;
    const loadToken = context?.beginLoad() ?? null;
    const live = () => Boolean(context) && !stale() && context === loadContext && context.isCurrent(loadToken);
    try {
        const data = await getCompanyAccount(currentUid, currentAziendaId, currentDocId);
        // Il montaggio può essere stato superato durante l'attesa: da qui in poi
        // nessuno stato di modulo viene toccato.
        if (!live()) return;
        if (!data) {
            showToast(t('account_not_found'), "error");
            context.markFailed(loadToken, 'ACCOUNT_LOAD_UNAVAILABLE');
            if (profileContactLinkDraft) throw new Error('Account non disponibile.');
            return;
        }
        baseUpdatedAt = data.updatedAt || '';
        observedRevision = Number.isSafeInteger(data.revision) ? data.revision : undefined;
        // Solo i campi di condivisione: nessuna credenziale entra nell'avviso.
        observedSharing = {
            sharedWith: data.sharedWith,
            sharedWithEmails: data.sharedWithEmails,
            recipientEmail: data.recipientEmail
        };
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        const setDecrypted = (id, val) => { if (val !== undefined) setVal(id, val); };

        // 🔐 PROTOCOLLO BLINDA: Decrittazione automatica se necessario (V6.0)
        let vaultKeyMaterial = null;
        const needsDecryption = data._encrypted === true;
        if (needsDecryption) {
            try {
                vaultKeyMaterial = await ensureVaultKeyMaterial();
            } catch (e) {
                showToast("Dati cifrati: chiave obbligatoria.", "error");
                context.markFailed(loadToken, 'ACCOUNT_VAULT_KEY_UNAVAILABLE');
                if (profileContactLinkDraft) throw e;
                history.back();
                return;
            }
            if (!live()) return;
        }

        const decryptIfPossible = async (val) => {
            if (!needsDecryption || !val) return val;
            if (profileContactLinkDraft) {
                try { return await decryptRequiredValue(val, vaultKeyMaterial); }
                catch (e) {
                    if (context.markFailed(loadToken, 'ACCOUNT_DECRYPT_FAILED')) showToast(DECRYPT_FAILURE_MESSAGE, 'warning');
                    throw e;
                }
            }
            // Il decrypt permissivo restituisce sentinelle: il validatore le rifiuta.
            try { return await decryptRequiredValue(val, vaultKeyMaterial); }
            catch (e) {
                if (context.markFailed(loadToken, 'ACCOUNT_DECRYPT_FAILED')) showToast(DECRYPT_FAILURE_MESSAGE, 'warning');
                return undefined;
            }
        };

        const [username, accountCode, password, registrationNumber, companyCode, note] = await Promise.all([
            decryptIfPossible(data.username),
            decryptIfPossible(data.account || data.codice),
            decryptIfPossible(data.password),
            decryptIfPossible(data.numeroIscrizione),
            decryptIfPossible(data.codiceSocieta),
            decryptIfPossible(data.note)
        ]);
        if (!live()) return;

        setVal('account-name', data.nomeAccount);
        setDecrypted('account-username', username);
        setDecrypted('account-code', accountCode);
        setDecrypted('account-password', password);
        setVal('account-url', data.url || data.sitoWeb);
        setDecrypted('account-numero-iscrizione', registrationNumber);
        setDecrypted('account-codice-societa', companyCode);
        setDecrypted('account-note', note);
        setVal('ref-name', data.referenteNome || data.referente?.nome);
        setVal('ref-phone', data.referenteTelefono || data.referente?.telefono);
        setVal('ref-mobile', data.referenteCellulare || data.referente?.cellulare);

        // Banking Premium
        let loadedBanking = normalizeEditableBankingAccounts(data);
        savedBankIds = new Set(loadedBanking.map(bank => bank.bankId).filter(Boolean));

        // Decrittazione Banking
        if (needsDecryption) {
            loadedBanking = await Promise.all(loadedBanking.map(async b => ({
                ...b,
                passwordDispositiva: await decryptIfPossible(b.passwordDispositiva),
                cards: await Promise.all((b.cards || []).map(async c => ({
                    ...c,
                    cardNumber: await decryptIfPossible(c.cardNumber),
                    pin: await decryptIfPossible(c.pin),
                    ccv: await decryptIfPossible(c.ccv)
                })))
            })));
        }

        if (!live()) return;
        const hasRealData = hasRealBankingData({banking: loadedBanking});

        if (hasRealData || data.isBanking) {
            bankAccounts = loadedBanking;
            document.getElementById('flag-banking').checked = true;
            document.getElementById('banking-section').classList.remove('hidden');
            rerender();
        } else {
            bankAccounts = loadedBanking.filter(bank => bank.bankId);
            rerender();
        }

        isExplicitMemo = data.isExplicitMemo || false;

        // Flags & Sharing UI (V5.1 Master - Strict Mode)
        const loadedMode = accountModeFromRecord(data);
        const isMemo = loadedMode.startsWith('memo-');
        const isShared = loadedMode.endsWith('-shared');
        const isMemoShared = loadedMode === 'memo-shared';

        if (document.getElementById('flag-shared')) document.getElementById('flag-shared').checked = isShared && !isMemo;
        if (document.getElementById('flag-memo')) document.getElementById('flag-memo').checked = isMemo && !isShared;
        if (document.getElementById('flag-memo-shared')) document.getElementById('flag-memo-shared').checked = isMemoShared;

        if (isShared) {
            document.getElementById('shared-management')?.classList.remove('hidden');
            if (data.sharedWith) {
                const activeGuests = Object.values(data.sharedWith)
                    .filter(guest => guest?.status !== 'suspended' && guest?.status !== 'rejected')
                    .filter(guest => !isOwnerRecipientEmail(guest?.email, ownerEmail));
                invitedEmails = activeGuests.map(g => normalizeRecipientEmail(g.email));
                recipientPreferences = recipientPreferencesFromSharedWith(activeGuests);
            } else {
                const emails = data.sharedWithEmails || (data.recipientEmail ? [data.recipientEmail] : []);
                invitedEmails = emails.map(normalizeRecipientEmail).filter(email => email && !isOwnerRecipientEmail(email, ownerEmail));
                recipientPreferences = new Map(invitedEmails.map(email => [email, preferenceForRecipient(null, email)]));
            }
            renderGuestsList();
        }

        // Logo
        if (data.logo || data.avatar) {
            const preview = document.getElementById('account-logo-preview');
            preview.src = data.logo || data.avatar;
            preview.classList.remove('hidden');
            document.getElementById('logo-placeholder').classList.add('hidden');
            document.getElementById('btn-remove-logo')?.classList.remove('hidden');
        }

        // Ultima istruzione del percorso felice: da qui il documento mostrato ha
        // identità e marker confermati e l'archiviazione è ammessa. Solo il
        // montaggio ancora corrente può arrivare qui.
        if (stale()) return;
        markerConfirmed = true;
        if (live()) context.markLoaded(loadToken);

    } catch (e) { context?.markFailed(loadToken, 'ACCOUNT_LOAD_FAILED'); logError("LoadData", e); if (profileContactLinkDraft) throw e; }
    finally { if (!stale()) toggleLoading(false); }
}

async function loadRubrica() {
    // L'epoch viene catturata SINCROMENTE alla chiamata, che avviene dentro il
    // `Promise.all` dello stesso `init`: è quindi quella del montaggio corrente
    // senza bisogno di un parametro, e la protezione contro un montaggio superato
    // resta identica (`loadRubrica()` mantiene il contratto di fondazione UI del
    // caricamento parallelo di Account e rubrica).
    const mount = mountEpoch;
    try {
        const contacts = filterRecipientContacts(await listContacts(currentUid), {ownerUid: currentUid, ownerEmail});
        if (mount !== mountEpoch) return;
        myContacts = contacts;
    } catch (e) { logError("LoadRubrica", e); }
}

function setupUI() {
    // Flag Rules (Mutual Exclusion)
    const flags = ['flag-shared', 'flag-memo', 'flag-memo-shared'].map(id => document.getElementById(id)).filter(Boolean);
    flags.forEach(f => {
        f.onchange = () => {
            const namePopulated = !!get('account-name');
            const credentialValues = { username: get('account-username'), account: get('account-code'), password: get('account-password') };
            if (f.checked) {
                if (!namePopulated) {
                    f.checked = false;
                    showToast("Il campo 'Nome Account' è obbligatorio prima di attivare questa opzione.", "warning");
                    return;
                }
                const candidateMode = accountModeFromFlags({
                    shared: f.id === 'flag-shared',
                    memo: f.id === 'flag-memo',
                    memoShared: f.id === 'flag-memo-shared'
                });
                const validation = validateAccountMode(candidateMode, credentialValues);
                if (validation.reason === 'account-without-credentials') {
                    f.checked = false;
                    showToast("Per un Account devi compilare almeno uno tra Username, Codice o Password.", "warning");
                    return;
                }
                if (validation.reason === 'memo-has-credentials') {
                    f.checked = false;
                    const msg = f.id === 'flag-memo-shared' ? "Per il Memorandum Condiviso NON devono essere compilati Username, Codice o Password." : "Per usare Memorandum devi svuotare Username, Codice e Password.";
                    showToast(msg, "warning");
                    return;
                }
                if (f.id === 'flag-memo') isExplicitMemo = true;
                if (f.id === 'flag-shared') isExplicitMemo = false;
                // Se è flag-memo-shared (Verde), NON tocchiamo isExplicitMemo per preservare la natura originale

                flags.forEach(other => { if (other !== f) other.checked = false; });
            }
            const mgmt = document.getElementById('shared-management');
            const isSharing = document.getElementById('flag-shared').checked || document.getElementById('flag-memo-shared').checked;
            if (mgmt) {
                mgmt.classList.toggle('hidden', !isSharing);
                if (isSharing) {
                    const activeFlag = document.getElementById('flag-shared').checked ? 'flag-shared' : 'flag-memo-shared';
                    const parentCard = document.getElementById(activeFlag).closest('.option-card');
                    if (parentCard) parentCard.after(mgmt);

                    // Proactive focus (Hardening V2.1)
                    const inviteInput = document.getElementById('invite-email');
                    const suggestions = document.getElementById('rubrica-suggestions');
                    if (inviteInput) {
                        setTimeout(() => {
                            inviteInput.focus();
                            if (myContacts.length > 0) {
                                renderSuggestions(myContacts);
                                suggestions?.classList.remove('hidden');
                            }
                        }, 100);
                    }
                } else {
                    // Reset sharing fields
                    const inviteInput = document.getElementById('invite-email');
                    const suggestions = document.getElementById('rubrica-suggestions');
                    if (inviteInput) inviteInput.value = '';
                    if (suggestions) suggestions.classList.add('hidden');
                    invitedEmails = [];
                    recipientPreferences.clear();
                    renderGuestsList();
                }
            }
        };
    });

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        const inviteInput = document.getElementById('invite-email');
        const suggestions = document.getElementById('rubrica-suggestions');
        if (!inviteInput?.contains(e.target) && !suggestions?.contains(e.target)) {
            suggestions?.classList.add('hidden');
        }
    });

    // Banking
    const flagBanking = document.getElementById('flag-banking');
    if (flagBanking) {
        flagBanking.onchange = () => {
            document.getElementById('banking-section')?.classList.toggle('hidden', !flagBanking.checked);
            if (flagBanking.checked && bankAccounts.length === 0) {
                bankAccounts = [{ iban: '', passwordDispositiva: '', referenteNome: '', numeroVerde: '', referenteTelefono: '', referenteCellulare: '', cards: [], _isOpen: true }];
                rerender();
            }
        };
    }

    const btnAddIban = document.getElementById('btn-add-iban');
    if (btnAddIban) {
        btnAddIban.onclick = () => {
            bankAccounts.forEach(b => b._isOpen = false);
            bankAccounts.push({ iban: '', passwordDispositiva: '', referenteNome: '', numeroVerde: '', referenteTelefono: '', referenteCellulare: '', cards: [], _isOpen: true });
            rerender();
        };
    }

    // Suggestion logic and INVITA button
    const btnInvite = document.getElementById('btn-send-invite');
    if (btnInvite) {
        btnInvite.onclick = () => {
            const input = document.getElementById('invite-email');
            const val = input.value.trim().toLowerCase();
            const emails = val.split(/[,; ]+/).filter(e => e.includes('@'));

            if (emails.length > 0) {
                let added = false;
                emails.forEach(email => {
                    const normalized = normalizeRecipientEmail(email);
                    if (isOwnerRecipientEmail(normalized, ownerEmail)) return;
                    if (!invitedEmails.includes(normalized)) {
                        invitedEmails.push(normalized);
                        recipientPreferences.set(normalized, preferenceForRecipient(null, normalized));
                        added = true;
                    }
                });
                if (added) {
                    input.value = '';
                    renderGuestsList();
                } else {
                    showToast("Email già aggiunte", "warning");
                }
            } else if (val !== '') {
                showToast("Inserisci un'email valida", "warning");
            }
        };
    }

    const inviteInput = document.getElementById('invite-email');
    const suggestions = document.getElementById('rubrica-suggestions');
    if (inviteInput && suggestions) {
        inviteInput.onfocus = () => {
            renderSuggestions(myContacts);
            suggestions.classList.remove('hidden');
        };
        inviteInput.oninput = (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = myContacts.filter(c => [c.email, c.nome, c.cognome, [c.nome, c.cognome].filter(Boolean).join(' ')].some(value => String(value || '').toLowerCase().includes(val)));
            renderSuggestions(filtered);
            suggestions.classList.remove('hidden');
        };
    }

    // Toggle Password
    const togglePassBtn = document.getElementById('btn-toggle-password-edit');
    const passInput = document.getElementById('account-password');
    if (togglePassBtn && passInput) {
        togglePassBtn.onclick = () => {
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            passInput.classList.toggle('base-shield', !isPass);
            togglePassBtn.querySelector('span').textContent = isPass ? 'visibility_off' : 'visibility';
        };
    }
}

function renderGuestsList() {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    invitedEmails.forEach((email, idx) => {
        const preference = preferenceForRecipient(recipientPreferences, email);
        const push = createElement('input', {
            type: 'checkbox', checked: preference.notifyPush,
            onchange: event => recipientPreferences.set(email, {...preferenceForRecipient(recipientPreferences, email), notifyPush: event.target.checked})
        });
        const notifyEmail = createElement('input', {
            type: 'checkbox', checked: preference.notifyEmail,
            onchange: event => recipientPreferences.set(email, {...preferenceForRecipient(recipientPreferences, email), notifyEmail: event.target.checked})
        });
        const item = createElement('div', {
            className: 'guest-item account-guest-item'
        }, [
            createElement('div', {className: 'account-guest-main'}, [
                createElement('span', {className: 'account-guest-email', textContent: email}),
                createElement('div', {className: 'account-guest-channels'}, [
                    createElement('label', {className: 'account-guest-channel'}, [push, createElement('span', {textContent: 'Push'})]),
                    createElement('label', {className: 'account-guest-channel'}, [notifyEmail, createElement('span', {textContent: 'Email'})])
                ])
            ]),
            createElement('button', {
                type: 'button',
                className: 'material-symbols-outlined account-guest-remove',
                textContent: 'delete',
                onclick: () => {
                    invitedEmails.splice(idx, 1);
                    recipientPreferences.delete(email);
                    renderGuestsList();
                }
            })
        ]);
        list.appendChild(item);
    });
}

function renderSuggestions(list) {
    const container = document.getElementById('rubrica-suggestions');
    if (!container) return;
    clearElement(container);
    if (list.length === 0) {
        container.appendChild(createElement('p', {
            className: 'suggestion-empty',
            textContent: myContacts.length === 0 ? t('empty_contacts') : 'Nessun contatto corrispondente'
        }));
        return;
    }
    list.forEach(c => {
        const div = createElement('div', {
            className: 'suggestion-item',
            onclick: () => {
                const email = c.email.toLowerCase();
                if (!isOwnerRecipientEmail(email, ownerEmail) && !invitedEmails.includes(email)) {
                    invitedEmails.push(email);
                    recipientPreferences.set(email, preferenceForRecipient(null, email));
                    renderGuestsList();
                }
                const input = document.getElementById('invite-email');
                if (input) input.value = '';
                container.classList.add('hidden');
                if (input) input.focus();
            }
        }, [
            createElement('p', {
                className: 'suggestion-contact-name',
                textContent: [c.nome, c.cognome].filter(Boolean).join(' ').trim() || c.email.split('@')[0]
            }),
            createElement('p', {
                className: 'suggestion-contact-email',
                textContent: c.email
            })
        ]);
        container.appendChild(div);
    });
}

function setupImageUploader() {
    const trigger = document.getElementById('btn-trigger-logo');
    const input = document.getElementById('logo-input');
    const btnRemove = document.getElementById('btn-remove-logo');
    const preview = document.getElementById('account-logo-preview');
    const placeholder = document.getElementById('logo-placeholder');

    if (!input || !trigger) return;

    // Reset visibility if empty
    if (!preview.src || preview.classList.contains('hidden')) {
        btnRemove?.classList.add('hidden');
    }

    trigger.onclick = () => input.click();

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = 200; canvas.height = 200;
                const min = Math.min(img.width, img.height);
                ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, 200, 200);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                if (preview) { preview.src = dataUrl; preview.classList.remove('hidden'); }
                if (placeholder) placeholder.classList.add('hidden');
                if (btnRemove) btnRemove.classList.remove('hidden');
            };
            img.src = ev.target.result;
        };
        reader.readAsDataURL(file);
    };

    if (btnRemove) {
        btnRemove.onclick = (e) => {
            e.stopPropagation();
            if (preview) { preview.src = ''; preview.classList.add('hidden'); }
            if (placeholder) placeholder.classList.remove('hidden');
            if (btnRemove) btnRemove.classList.add('hidden');
            input.value = '';
        };
    }
}


async function removeIban(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_remove_account') || "Rimuovere conto?")) return;
    bankAccounts.splice(idx, 1);
    rerender();
}

function toggleLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('hidden', !show);
}
