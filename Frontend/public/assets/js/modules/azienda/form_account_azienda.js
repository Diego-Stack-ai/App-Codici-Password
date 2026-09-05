import { getDocSmart as getDoc, getDocsSmart as getDocs } from "/assets/js/offline-firestore.js";
/**
 * FORM ACCOUNT AZIENDA MODULE (V6.0 SPLIT)
 * Creazione e modifica account aziendali con gestione dinamica IBAN.
 * - Entry Point: initFormAccountAzienda(user)
 * - Save/Delete estratto in: form-azienda-save.js
 */

import { db } from '../../firebase-config.js?v=1.2.38';
import { doc, collection } from "/assets/js/vendor/firebase-runtime.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core-v129.js';
import { t } from '../../translations.js';
import { renderBankAccounts } from '../shared/banking-renderer.js';
import { logError } from '../../utils.js';
import { decrypt, ensureMasterKey } from '../core/security-manager.js';
import { saveAccount, deleteAccount } from './form-azienda-save.js';

// --- STATE ---
let currentUid = null;
let currentDocId = null;
let currentAziendaId = null;
let isEditing = false;
let bankAccounts = [];
let myContacts = [];
let isExplicitMemo = false; // V5.2: Differenzia Memo Reale da Account condiviso come Memo
let invitedEmails = [];

// Funzione di re-render locale per banking-renderer
const rerender = () => renderBankAccounts(bankAccounts, rerender);

// Utility per recupero rapido valori
const get = (id) => document.getElementById(id)?.value.trim() || '';

// --- INITIALIZATION ---
export async function initFormAccountAzienda(user) {

    if (!user) return;
    currentUid = user.uid;

    const urlParams = new URLSearchParams(window.location.search);
    currentDocId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');
    isEditing = !!currentDocId;

    if (!currentAziendaId) {
        showToast("ID Azienda mancante", "error");
        setTimeout(() => history.back(), 1000);
        return;
    }

    // Reset State
    bankAccounts = [];
    myContacts = [];

    // Esponi deleteAccount su window per eventuali onclick HTML
    window.deleteAccount = () => deleteAccount({ currentUid, currentAziendaId, currentDocId });

    initBaseUI();
    setupUI();
    setupImageUploader();
    await Promise.all([
        loadRubrica(),
        isEditing ? loadData() : Promise.resolve()
    ]);
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
            className: 'btn-fab-action btn-fab-scadenza',
            title: t('save') || 'Salva',
            onclick: () => saveAccount({ bankAccounts, invitedEmails, isExplicitMemo, currentUid, currentDocId, currentAziendaId, isEditing })
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
    try {
        const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentDocId);
        const snap = await getDoc(docRef);

        if (!snap.exists()) { showToast(t('account_not_found'), "error"); return; }

        const data = snap.data();
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

        // 🔐 PROTOCOLLO BLINDA: Decrittazione automatica se necessario (V6.0)
        let masterKey = null;
        const needsDecryption = data._encrypted === true;
        if (needsDecryption) {
            try {
                masterKey = await ensureMasterKey();
            } catch (e) {
                showToast("Dati cifrati: chiave obbligatoria.", "error");
                history.back();
                return;
            }
        }

        const decryptIfPossible = async (val) => {
            if (!needsDecryption || !val) return val;
            try { return await decrypt(val, masterKey); } catch (e) { return "---ERRORE DECRYPT---"; }
        };

        const [username, accountCode, password, registrationNumber, companyCode, note] = await Promise.all([
            decryptIfPossible(data.username),
            decryptIfPossible(data.account || data.codice),
            decryptIfPossible(data.password),
            decryptIfPossible(data.numeroIscrizione),
            decryptIfPossible(data.codiceSocieta),
            decryptIfPossible(data.note)
        ]);

        setVal('account-name', data.nomeAccount);
        setVal('account-username', username);
        setVal('account-code', accountCode);
        setVal('account-password', password);
        setVal('account-url', data.url || data.sitoWeb);
        setVal('account-numero-iscrizione', registrationNumber);
        setVal('account-codice-societa', companyCode);
        setVal('account-note', note);
        setVal('ref-name', data.referenteNome || data.referente?.nome);
        setVal('ref-phone', data.referenteTelefono || data.referente?.telefono);
        setVal('ref-mobile', data.referenteCellulare || data.referente?.cellulare);

        // Banking Premium
        let loadedBanking = [];
        if (Array.isArray(data.banking)) {
            loadedBanking = data.banking;
        } else if (data.banking) {
            loadedBanking = [data.banking];
        } else if (data.iban) {
            loadedBanking = [{ iban: data.iban, cards: [] }];
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
            return (acc.iban?.trim() || acc.passwordDispositiva?.trim() || (acc.cards && acc.cards.length > 0));
        });

        if (hasRealData || data.isBanking) {
            bankAccounts = loadedBanking;
            document.getElementById('flag-banking').checked = true;
            document.getElementById('banking-section').classList.remove('hidden');
            renderBankAccounts(bankAccounts, rerender);
        }

        isExplicitMemo = data.isExplicitMemo || false;

        // Flags & Sharing UI (V5.1 Master - Strict Mode)
        const isMemo = (data.type === 'memo' || data.type === 'memorandum');
        const isShared = (data.visibility === 'shared');
        const isMemoShared = isShared && isMemo;

        if (document.getElementById('flag-shared')) document.getElementById('flag-shared').checked = isShared && !isMemo;
        if (document.getElementById('flag-memo')) document.getElementById('flag-memo').checked = isMemo && !isShared;
        if (document.getElementById('flag-memo-shared')) document.getElementById('flag-memo-shared').checked = isMemoShared;

        if (isShared) {
            document.getElementById('shared-management')?.classList.remove('hidden');
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
            document.getElementById('btn-remove-logo')?.classList.remove('hidden');
        }

    } catch (e) { logError("LoadData", e); }
    finally { toggleLoading(false); }
}

async function loadRubrica() {
    try {
        const snap = await getDocs(collection(db, "users", currentUid, "contacts"));
        myContacts = snap.docs.map(d => d.data());
    } catch (e) { logError("LoadRubrica", e); }
}

function setupUI() {
    // Flag Rules (Mutual Exclusion)
    const flags = ['flag-shared', 'flag-memo', 'flag-memo-shared'].map(id => document.getElementById(id)).filter(Boolean);
    flags.forEach(f => {
        f.onchange = () => {
            const namePopulated = !!get('account-name');
            const fieldsPopulated = !!(get('account-username') || get('account-code') || get('account-password'));
            if (f.checked) {
                if (!namePopulated) {
                    f.checked = false;
                    showToast("Il campo 'Nome Account' è obbligatorio prima di attivare questa opzione.", "warning");
                    return;
                }
                if (f.id === 'flag-shared' && !fieldsPopulated) {
                    f.checked = false;
                    showToast("Per l'Account Condiviso devi compilare almeno uno tra Username, Codice o Password.", "warning");
                    return;
                }
                if ((f.id === 'flag-memo' || f.id === 'flag-memo-shared') && fieldsPopulated) {
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
                bankAccounts = [{ iban: '', cards: [], _isOpen: true }];
                renderBankAccounts(bankAccounts, rerender);
            }
        };
    }

    const btnAddIban = document.getElementById('btn-add-iban');
    if (btnAddIban) {
        btnAddIban.onclick = () => {
            bankAccounts.forEach(b => b._isOpen = false);
            bankAccounts.push({ iban: '', cards: [], _isOpen: true });
            renderBankAccounts(bankAccounts, rerender);
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
            const filtered = myContacts.filter(c => c.email.toLowerCase().includes(val) || (c.nome && c.nome.toLowerCase().includes(val)));
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
                textContent: c.nome || c.email.split('@')[0]
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
    renderBankAccounts(bankAccounts, rerender);
}

function toggleLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('hidden', !show);
}
