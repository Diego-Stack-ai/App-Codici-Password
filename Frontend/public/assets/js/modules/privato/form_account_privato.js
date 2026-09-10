/**
 * FORM ACCOUNT PRIVATO (V6.0 — Unified Banking Renderer)
 * Creazione e modifica account con gestione IBAN dinamica.
 */

import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { renderBankAccounts } from '../shared/banking-renderer.js';
import { decrypt, ensureVaultKeyMaterial } from '../core/security-manager.js';
import { getPrivateAccount, getPrivateAccountConfirmed, listContacts } from '../data/vault-repository.js';
import { accountModeFromFlags, accountModeFromRecord, validateAccountMode } from '../shared/account-mode-model.js';
import { initAccountEmbeddedWidgets } from '../shared/account-embedded-widgets.js?v=1.2.99';
import { savePrivateAccount } from './form-privato-save.js';

// --- STATE ---
let currentUid = null;
let currentDocId = null;
let isEditing = false;
let bankAccounts = []; // Inizialmente vuoto per nuovi account
let profileEmailLinkDraft = null;
let myContacts = [];
let isExplicitMemo = false; // V5.2: Differenzia Memo Reale da Account condiviso come Memo
let invitedEmails = [];
let currentRevision = 0;
let hasLinkedProfileField = false;
let accountWidgetController = null;

// Re-render callback per banking-renderer.js
const rerender = () => renderBankAccounts(bankAccounts, rerender);

// Utility per recupero rapido valori (evita ReferenceError)
const get = (id) => document.getElementById(id)?.value.trim() || '';

function getPrivateAccountListDestination({refresh = false} = {}) {
    const type = isExplicitMemo ? 'memo' : 'standard';
    const params = new URLSearchParams({type});
    if (refresh) params.set('afterWrite', '1');
    return `account_privati.html?${params.toString()}`;
}

function showM6ConflictChoice() {
    return new Promise(resolve => {
        document.getElementById('m6-conflict-modal')?.remove();
        const modal = createElement('div', {id: 'm6-conflict-modal', className: 'modal-overlay'});
        const close = choice => {
            modal.classList.remove('active');
            setTimeout(() => { modal.remove(); resolve(choice); }, 300);
        };
        const keepServer = createElement('button', {
            className: 'btn-modal btn-primary',
            textContent: 'Mantieni server',
            onclick: () => close('server')
        });
        const recoverLocal = createElement('button', {
            className: 'btn-modal btn-secondary',
            textContent: 'Recupera locale',
            onclick: () => close('local')
        });
        const decideLater = createElement('button', {
            className: 'btn-modal btn-secondary',
            textContent: 'Decidi più tardi',
            onclick: () => close(null)
        });
        setChildren(modal, createElement('div', {className: 'modal-box'}, [
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'sync_problem'}),
            createElement('h3', {className: 'modal-title', textContent: 'Conflitto di sincronizzazione'}),
            createElement('p', {
                className: 'modal-text',
                textContent: 'Questo account è stato modificato altrove. Mantieni il dato più recente del server oppure recupera la modifica offline nel modulo per controllarla prima di salvarla.'
            }),
            createElement('div', {className: 'modal-actions'}, [decideLater, recoverLocal, keepServer])
        ]));
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        modal.addEventListener('click', event => { if (event.target === modal) close(null); });
    });
}

function showM6ForeignConflictChoice(accountName) {
    return new Promise(resolve => {
        document.getElementById('m6-conflict-modal')?.remove();
        const modal = createElement('div', {id: 'm6-conflict-modal', className: 'modal-overlay'});
        const close = openAccount => {
            modal.classList.remove('active');
            setTimeout(() => { modal.remove(); resolve(openAccount); }, 300);
        };
        const later = createElement('button', {
            className: 'btn-modal btn-secondary',
            textContent: 'Più tardi',
            onclick: () => close(false)
        });
        const open = createElement('button', {
            className: 'btn-modal btn-primary',
            textContent: 'Apri account',
            onclick: () => close(true)
        });
        setChildren(modal, createElement('div', {className: 'modal-box'}, [
            createElement('span', {className: 'material-symbols-outlined modal-icon icon-accent-blue', textContent: 'sync_problem'}),
            createElement('h3', {className: 'modal-title', textContent: 'Modifica offline da controllare'}),
            createElement('p', {
                className: 'modal-text',
                textContent: `La coda contiene una modifica di “${accountName || 'un altro account'}”. Apri quel record per scegliere se recuperarla o mantenere il server.`
            }),
            createElement('div', {className: 'modal-actions'}, [later, open])
        ]));
        document.body.appendChild(modal);
        setTimeout(() => modal.classList.add('active'), 10);
        modal.addEventListener('click', event => { if (event.target === modal) close(false); });
    });
}

async function restoreM6ConflictDraft(operation, vaultKeyMaterial, serverRevision) {
    const record = operation.record || {};
    const decrypted = await Promise.all([
        decrypt(record.username || '', vaultKeyMaterial),
        decrypt(record.account || '', vaultKeyMaterial),
        decrypt(record.password || '', vaultKeyMaterial),
        decrypt(record.note || '', vaultKeyMaterial)
    ]);
    const values = {
        'account-name': record.nomeAccount || '',
        'account-username': decrypted[0] || '',
        'account-code': decrypted[1] || '',
        'account-password': decrypted[2] || '',
        'account-url': record.url || '',
        'account-note': decrypted[3] || '',
        'ref-name': record.referenteNome || '',
        'ref-phone': record.referenteTelefono || '',
        'ref-mobile': record.referenteCellulare || ''
    };
    for (const [id, value] of Object.entries(values)) {
        const input = document.getElementById(id);
        if (input) input.value = value;
    }
    currentRevision = Number(serverRevision || currentRevision);
}

// --- INITIALIZATION ---
/**
 * FORM ACCOUNT PRIVATO MODULE (V5.0 ADAPTER)
 * Creazione e modifica account.
 * - Entry Point: initFormAccountPrivato(user)
 */

export async function initFormAccountPrivato(user) {
    
    if (!user) return;
    currentUid = user.uid;

    const params = new URLSearchParams(window.location.search);
    currentDocId = params.get('id');
    isEditing = !!currentDocId;
    document.getElementById('account-mode-edit-controls')?.classList.toggle('hidden', isEditing);
    if (isEditing) {
        ['flag-shared', 'flag-memo', 'flag-memo-shared'].forEach(id => document.getElementById(id)?.closest('label')?.classList.add('hidden'));
        document.getElementById('shared-management')?.classList.add('hidden');
    }
    document.querySelectorAll('.manage-recipients-link').forEach(link => {
        const returnTo = `${window.location.pathname.split('/').pop()}${window.location.search}`;
        link.href = `gestione_destinatari.html?return=${encodeURIComponent(returnTo)}`;
    });
    const profileEmailId = params.get('profileEmailId');
    if (!isEditing && profileEmailId) {
        try {
            const draft = JSON.parse(sessionStorage.getItem('profile-account-link-draft') || 'null');
            if (draft?.profileEmailId === profileEmailId) profileEmailLinkDraft = draft;
        } catch { profileEmailLinkDraft = null; }
    }

    // Footer actions setup
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);

        const cancelBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-neutral',
            title: t('cancel') || 'Annulla',
            onclick: () => {
                if (isEditing && currentDocId) window.location.href = `dettaglio_account_privato.html?id=${currentDocId}`;
                else history.back();
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'close' })
        ]);

        const saveBtn = createElement('button', {
            id: 'btn-save-footer',
            className: 'btn-fab-action btn-fab-scadenza',
            title: t('save') || 'Salva',
            onclick: async () => {
                saveBtn.disabled = true;
                try {
                    await accountWidgetController?.savePendingChanges();
                } catch (error) {
                    showToast(error.message || 'Salvataggio dei campi personalizzati non riuscito.', 'error');
                    saveBtn.disabled = false;
                    return;
                }
                await savePrivateAccount({
                    bankAccounts,
                    invitedEmails,
                    isExplicitMemo,
                    currentUid,
                    currentDocId,
                    isEditing,
                    baseRevision: currentRevision,
                    profileEmailLinkDraft,
                    hasLinkedProfileField
                });
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
        ]);

        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [cancelBtn, saveBtn]));

        // Se una scrittura M6 è stata accodata offline, il ritorno della rete
        // riapre automaticamente il bootstrap del form: la coda cifrata viene
        // sincronizzata prima di qualsiasi nuova modifica dell'utente.
        window.addEventListener('online', () => {
            if (saveBtn.dataset.m6Queued === 'true') window.location.reload();
        }, {once: true});
    }

    // Personalizza pulsante Back per tornare al dettaglio (se in modifica)
    if (isEditing && currentDocId) {
        const hLeft = document.getElementById('header-left');
        if (hLeft) {
            clearElement(hLeft);
            setChildren(hLeft, createElement('button', {
                className: 'btn-icon-header',
                onclick: () => window.location.href = `dettaglio_account_privato.html?id=${currentDocId}`
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
            ]));
        }
    }
    if (profileEmailLinkDraft?.email) {
        const usernameInput = document.getElementById('account-username');
        if (usernameInput) usernameInput.value = profileEmailLinkDraft.email;
    }

    setupUI();
    await Promise.all([
        loadRubrica(),
        isEditing ? loadData() : Promise.resolve()
    ]);
    if (isEditing) {
        accountWidgetController = await initAccountEmbeddedWidgets({
            uid: currentUid, context: 'private', accountId: currentDocId, editable: true
        });
    }

    if (navigator.onLine) {
        try {
            const vaultKeyMaterial = await ensureVaultKeyMaterial();
            const pilot = await import('../data/private-account-offline-pilot.js');
            let lastState = null;
            const result = await pilot.flushPrivateAccountPilot({
                uid: currentUid,
                vaultKeyMaterial,
                onState: state => { lastState = state; }
            });
            const outcome = result?.value || result;
            if (lastState?.state === 'conflict' || outcome?.status === 'conflict') {
                const operation = outcome?.operation || lastState?.operation;
                const serverRevision = outcome?.result?.currentRevision || lastState?.result?.currentRevision;
                showToast('Conflitto M6: nessuna modifica è stata sovrascritta.', 'warning');
                if (operation?.operationId && operation.recordId === currentDocId) {
                    const choice = await showM6ConflictChoice();
                    if (choice === 'server' || choice === 'local') {
                        await pilot.discardPrivateAccountPilotOperation({
                            uid: currentUid,
                            vaultKeyMaterial,
                            operationId: operation.operationId
                        });
                    }
                    if (choice === 'server') {
                        showToast('Versione del server mantenuta.', 'success');
                        setTimeout(() => window.location.replace(getPrivateAccountListDestination({refresh: true})), 600);
                    } else if (choice === 'local') {
                        await restoreM6ConflictDraft(operation, vaultKeyMaterial, serverRevision);
                        showToast('Modifica offline recuperata. Controllala e premi Salva per applicarla.', 'warning');
                    }
                } else if (operation?.recordId) {
                    const openAccount = await showM6ForeignConflictChoice(operation.record?.nomeAccount);
                    if (openAccount) {
                        window.location.replace(`form_account_privato.html?id=${encodeURIComponent(operation.recordId)}`);
                    }
                }
            } else if (lastState?.state === 'recoverable-error' || outcome?.status === 'recoverable-error') {
                showToast('Sincronizzazione M6 temporaneamente non disponibile. La modifica resta conservata.', 'warning');
            } else if (Number(outcome?.completed || 0) > 0) {
                const pendingRecord = lastState?.operation || null;
                if (pendingRecord?.recordId && pendingRecord?.record) {
                    pilot.storePrivateAccountHandoff({
                        uid: currentUid,
                        recordId: pendingRecord.recordId,
                        expectedRevision: pendingRecord.expectedRevision,
                        record: pendingRecord.record
                    });
                }
                showToast('Sincronizzazione M6 completata.', 'success');
                setTimeout(() => window.location.replace(getPrivateAccountListDestination({refresh: true})), 800);
            }
        } catch (error) {
            logError('M6PilotResume', error);
            showToast('Sincronizzazione M6 temporaneamente non disponibile. La modifica resta conservata.', 'warning');
        }
    }

    
}

/**
 * LOADING ENGINE
 */
async function loadData() {
    try {
        const data = navigator.onLine
            ? await getPrivateAccountConfirmed(currentUid, currentDocId)
            : await getPrivateAccount(currentUid, currentDocId);
        if (!data) { showToast(t('account_not_found'), "error"); return; }
        currentRevision = Number.isInteger(data.revision) ? data.revision : 0;
        hasLinkedProfileField = Boolean(data.linkedProfileField?.type && data.linkedProfileField?.id);
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

        // 🔐 PROTOCOLLO BLINDA: Decrittazione automatica se necessario
        let vaultKeyMaterial = null;
        const needsDecryption = data._encrypted === true;
        if (needsDecryption) {
            try {
                vaultKeyMaterial = await ensureVaultKeyMaterial();
            } catch (e) {
                showToast("Dati cifrati: chiave obbligatoria.", "error");
                history.back();
                return;
            }
        }

        const decryptIfPossible = async (val) => {
            if (!needsDecryption || !val) return val;
            try { return await decrypt(val, vaultKeyMaterial); } catch (e) { return "---ERRORE DECRYPT---"; }
        };

        const [username, accountCode, password, note] = await Promise.all([
            decryptIfPossible(data.username),
            decryptIfPossible(data.account || data.codice),
            decryptIfPossible(data.password),
            decryptIfPossible(data.note)
        ]);

        setVal('account-name', data.nomeAccount);
        setVal('account-username', username);
        setVal('account-code', accountCode);
        setVal('account-password', password);
        setVal('account-url', data.url || data.sitoWeb);
        setVal('account-note', note);

        // Referente (Root or Object support)
        const ref = data.referente || {};
        setVal('ref-name', data.referenteNome || ref.nome);
        setVal('ref-phone', data.referenteTelefono || ref.telefono);
        setVal('ref-mobile', data.referenteCellulare || ref.cellulare);

        // Banking & Cards (Normalize & Validate)
        let loadedBanking = [];
        if (Array.isArray(data.banking)) {
            loadedBanking = data.banking;
        } else if (data.banking) {
            loadedBanking = [data.banking];
        } else if (data.iban || (data.cards && data.cards.length > 0)) {
            loadedBanking = [{
                iban: data.iban || '',
                passwordDispositiva: data.passwordDispositiva || '',
                referenteTelefono: data.referenteTelefono || '',
                referenteCellulare: data.referenteCellulare || '',
                cards: data.cards || []
            }];
        }

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

        const hasRealData = loadedBanking.some(acc => {
            const hasIban = acc.iban && acc.iban.trim().length > 0;
            const hasDisp = acc.passwordDispositiva && acc.passwordDispositiva.trim().length > 0;
            const hasCards = acc.cards && acc.cards.some(c => c.cardNumber?.trim() || c.cardType?.trim() || c.pin?.trim() || c.ccv?.trim());
            const hasRef = (acc.referenteTelefono?.trim() || acc.referenteCellulare?.trim());
            return hasIban || hasDisp || hasCards || hasRef;
        });

        if (hasRealData) {
            bankAccounts = loadedBanking;
            document.getElementById('flag-banking').checked = true;
            document.getElementById('banking-section').classList.remove('hidden');
            renderBankAccounts(bankAccounts, rerender);
        } else {
            // Se non ci sono dati reali, il flag rimane spento e la sezione chiusa
            document.getElementById('flag-banking').checked = false;
            document.getElementById('banking-section').classList.add('hidden');
            bankAccounts = [];
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
            const mgmt = document.getElementById('shared-management');
            if (mgmt) mgmt.classList.remove('hidden');
            if (data.sharedWith) {
                invitedEmails = Object.values(data.sharedWith).map(g => g.email);
            } else {
                const emails = data.sharedWithEmails || (data.recipientEmail ? [data.recipientEmail] : []);
                invitedEmails = [...emails];
            }
            renderGuestsList();
        }

        // Logo
        if (data.logo || data.avatar) {
            const preview = document.getElementById('account-logo-preview');
            preview.src = data.logo || data.avatar;
            preview.classList.remove('hidden');
            document.getElementById('logo-placeholder').classList.add('hidden');
        }

    } catch (e) { logError("LoadData", e); }
}

async function loadRubrica() {
    try {
        myContacts = (await listContacts(currentUid)).filter(contact => contact.active !== false);
    } catch (e) { logError("LoadRubrica", e); }
}

/**
 * UI ENGINE
 */
function setupUI() {
    // Flag Mutual Exclusion & Sharing Rules
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
                if (validation.reason === 'shared-account-without-credentials') {
                    f.checked = false;
                    showToast("Per l'Account Condiviso devi compilare almeno uno tra Username, Codice o Password.", "warning");
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

            // RULE 4: Dropdown visibility & Positioning
            const mgmt = document.getElementById('shared-management');
            const isSharing = document.getElementById('flag-shared').checked || document.getElementById('flag-memo-shared').checked;
            if (mgmt) {
                mgmt.classList.toggle('hidden', !isSharing);
                if (isSharing) {
                    // Posiziona il pannello sotto il flag attivo
                    const currentFlagId = document.getElementById('flag-shared').checked ? 'flag-shared' : 'flag-memo-shared';
                    const parentCard = document.getElementById(currentFlagId).closest('.option-card');
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
                    renderGuestsList();
                }
            }
        };
    });

    // Banking Toggle
    const bToggle = document.getElementById('flag-banking');
    if (bToggle) {
        bToggle.onchange = () => {
            document.getElementById('banking-section').classList.toggle('hidden', !bToggle.checked);
            if (bToggle.checked && bankAccounts.length === 0) {
                bankAccounts = [{ iban: '', passwordDispositiva: '', referenteTelefono: '', referenteCellulare: '', cards: [], _isOpen: true }];
            }
            renderBankAccounts(bankAccounts, rerender);
        };
    }

    // Aggiungi conto bancario (una volta sola — pattern architetturale corretto)
    const btnAddIban = document.getElementById('btn-add-iban');
    if (btnAddIban) {
        btnAddIban.onclick = () => {
            bankAccounts.forEach(a => a._isOpen = false);
            bankAccounts.push({
                iban: '',
                passwordDispositiva: '',
                referenteNome: '',
                referenteTelefono: '',
                referenteCellulare: '',
                cards: [],
                _isOpen: true
            });
            renderBankAccounts(bankAccounts, rerender);
        };
    }

    // Logo Trigger
    const btnLogo = document.getElementById('btn-trigger-logo');
    if (btnLogo) btnLogo.onclick = () => document.getElementById('logo-input').click();

    const inputLogo = document.getElementById('logo-input');
    if (inputLogo) {
        inputLogo.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (ev) => {
                    const preview = document.getElementById('account-logo-preview');
                    preview.src = ev.target.result;
                    preview.classList.remove('hidden');
                    document.getElementById('logo-placeholder').classList.add('hidden');
                };
                reader.readAsDataURL(file);
            }
        };
    }

    // Toggle Password
    const togglePassBtn = document.getElementById('btn-toggle-password-edit');
    if (togglePassBtn) {
        togglePassBtn.onclick = () => {
            const input = document.getElementById('account-password');
            if (input) {
                const isPass = input.type === 'password';
                input.type = isPass ? 'text' : 'password';
                input.classList.toggle('base-shield', !isPass);
                togglePassBtn.querySelector('span').textContent = isPass ? 'visibility_off' : 'visibility';
            }
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
                    if (!invitedEmails.includes(email)) {
                        invitedEmails.push(email);
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

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!inviteInput?.contains(e.target) && !suggestions?.contains(e.target)) {
            suggestions?.classList.add('hidden');
        }
    });
}

function renderGuestsList() {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    invitedEmails.forEach((email, idx) => {
        const item = createElement('div', {
            className: 'guest-item account-guest-item'
        }, [
            createElement('span', {
                className: 'account-guest-email',
                textContent: email
            }),
            createElement('button', {
                type: 'button',
                className: 'material-symbols-outlined account-guest-remove',
                textContent: 'delete',
                onclick: () => {
                    invitedEmails.splice(idx, 1);
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
                if (!invitedEmails.includes(email)) {
                    invitedEmails.push(email);
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


// ─── BANKING RENDERER ───────────────────────────────────────────────────────
// renderBankAccounts, renderCardEntry, createInputField sono in ../shared/banking-renderer.js
