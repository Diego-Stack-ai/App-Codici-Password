/**
 * FORM ACCOUNT AZIENDA MODULE (V5.9.5 ADAPTER)
 * Creazione e modifica account aziendali con gestione dinamica IBAN.
 * - Entry Point: initFormAccountAzienda(user)
 */

import { auth, db } from '../../firebase-config.js';
import {
    doc, getDoc, getDocFromServer, updateDoc, deleteDoc, collection,
    addDoc, getDocs, setDoc, query, where, runTransaction,
    arrayUnion, arrayRemove, deleteField
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError, sanitizeEmail } from '../../utils.js';

// --- STATE ---
let currentUid = null;
let currentDocId = null;
let currentAziendaId = null;
let isEditing = false;
let bankAccounts = [];
let myContacts = [];
let isExplicitMemo = false; // V5.2: Differenzia Memo Reale da Account condiviso come Memo
let invitedEmails = [];

// Utility per recupero rapido valori
const get = (id) => document.getElementById(id)?.value.trim() || '';

// --- INITIALIZATION ---
export async function initFormAccountAzienda(user) {
    console.log("[FORM-ACCOUNT-AZIENDA] Init V5.0...");
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

    initBaseUI();
    setupUI();
    setupImageUploader();
    await loadRubrica();
    if (isEditing) await loadData();

    console.log("[FORM-ACCOUNT-AZIENDA] Ready.");
}

function initBaseUI() {
    console.log('[FORM-ACCOUNT-AZIENDA] initBaseUI...');

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
            onclick: () => window.saveAccount()
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

        setVal('account-name', data.nomeAccount);
        setVal('account-username', data.username);
        setVal('account-code', data.account || data.codice);
        setVal('account-password', data.password);
        setVal('account-url', data.url || data.sitoWeb);
        setVal('account-note', data.note);
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

        const hasRealData = loadedBanking.some(acc => {
            return (acc.iban?.trim() || acc.passwordDispositiva?.trim() || (acc.cards && acc.cards.length > 0));
        });

        if (hasRealData || data.isBanking) {
            bankAccounts = loadedBanking;
            document.getElementById('flag-banking').checked = true;
            document.getElementById('banking-section').classList.remove('hidden');
            renderBankAccounts();
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
                renderBankAccounts();
            }
        };
    }

    const btnAddIban = document.getElementById('btn-add-iban');
    if (btnAddIban) {
        btnAddIban.onclick = () => {
            bankAccounts.forEach(b => b._isOpen = false);
            bankAccounts.push({ iban: '', cards: [], _isOpen: true });
            renderBankAccounts();
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
        inviteInput.onfocus = () => { if (myContacts.length > 0) { renderSuggestions(myContacts); suggestions.classList.remove('hidden'); } };
        inviteInput.oninput = (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = myContacts.filter(c => c.email.toLowerCase().includes(val) || (c.nome && c.nome.toLowerCase().includes(val)));
            renderSuggestions(filtered);
            suggestions.classList.toggle('hidden', filtered.length === 0);
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

window.renderGuestsList = function () {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    invitedEmails.forEach((email, idx) => {
        const item = createElement('div', { className: 'guest-item flex justify-between items-center py-2 px-1 border-b border-white/5 last:border-0' }, [
            createElement('span', {
                className: 'font-bold flex-1 truncate',
                style: 'font-size: 14px; color: var(--text-primary); margin-right: 10px;',
                textContent: email
            }),
            createElement('button', {
                type: 'button',
                className: 'material-symbols-outlined flex-shrink-0',
                style: 'font-size: 20px; color: #ef4444; background: transparent !important; border: none !important; outline: none !important; box-shadow: none !important; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center;',
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
                className: 'font-black text-primary m-0',
                style: 'font-size: 13px; line-height: 1.2;',
                textContent: c.nome || c.email.split('@')[0]
            }),
            createElement('p', {
                className: 'text-secondary m-0',
                style: 'font-size: 10px; opacity: 0.8; font-weight: 600;',
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

function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    clearElement(container);

    bankAccounts.forEach((acc, idx) => {
        const isOpen = acc._isOpen !== false;

        const div = createElement('div', { className: 'bank-account-card border-glow' }, [
            createElement('div', {
                className: 'bank-header',
                onclick: () => { acc._isOpen = !isOpen; renderBankAccounts(); }
            }, [
                createElement('div', { className: 'bank-header-left' }, [
                    createElement('span', {
                        className: 'material-symbols-outlined bank-expand-icon',
                        style: `transform: rotate(${isOpen ? '0' : '-90'}deg)`,
                        textContent: 'expand_more'
                    }),
                    createElement('span', { className: 'bank-title', textContent: acc.iban ? `Conto: ${acc.iban.substring(0, 10)}...` : `Nuovo Conto #${idx + 1}` })
                ]),
                createElement('button', {
                    className: 'btn-delete-bank',
                    onclick: async (e) => {
                        e.stopPropagation();
                        const ok = await showConfirmModal('Elimina Conto', 'Vuoi eliminare interamente questo conto?', 'Elimina', 'Annulla');
                        if (ok) {
                            bankAccounts.splice(idx, 1);
                            renderBankAccounts();
                        }
                    }
                }, [createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'delete' })])
            ]),

            isOpen ? createElement('div', { className: 'bank-details' }, [
                createInputField('IBAN', acc.iban, (val) => bankAccounts[idx].iban = val, 'account_balance'),
                createInputField('Pass. Disp.', acc.passwordDispositiva, (val) => bankAccounts[idx].passwordDispositiva = val, 'lock'),
                createInputField('Tel. Banca', acc.referenteTelefono, (val) => bankAccounts[idx].referenteTelefono = val, 'call'),
                createInputField('Cell. Banca', acc.referenteCellulare, (val) => bankAccounts[idx].referenteCellulare = val, 'smartphone'),

                // Carte Section
                createElement('div', { className: 'bank-cards-section' }, [
                    createElement('div', { className: 'bank-cards-header' }, [
                        createElement('span', { className: 'bank-cards-title', textContent: 'Carte Associate' }),
                        createElement('button', {
                            className: 'btn-add-card',
                            onclick: () => { if (!acc.cards) acc.cards = []; acc.cards.push({ cardType: '', cardNumber: '', expiry: '', titolare: '', ccv: '', pin: '', _isOpen: true }); renderBankAccounts(); }
                        }, [createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'add_card' })])
                    ]),
                    createElement('div', { className: 'flex-col-gap' }, (acc.cards || []).map((card, cIdx) => renderCardEntry(idx, cIdx, card)))
                ])
            ]) : null
        ]);
        container.appendChild(div);
    });
}

function renderCardEntry(bankIdx, cardIdx, card) {
    const isOpen = card._isOpen !== false;
    return createElement('div', { className: 'card-entry border-glow' }, [
        createElement('div', {
            className: 'card-entry-header',
            onclick: () => { card._isOpen = !isOpen; renderBankAccounts(); }
        }, [
            createElement('div', { className: 'card-entry-title-row' }, [
                createElement('span', { className: 'material-symbols-outlined card-entry-icon', textContent: 'credit_card' }),
                createElement('span', { className: 'card-entry-label', textContent: card.cardType || `Carta #${cardIdx + 1}` })
            ])
        ]),
        createElement('button', {
            className: 'btn-delete-card',
            onclick: async (e) => {
                e.stopPropagation();
                const msg = t('confirm_delete_card') || 'Eliminare questa carta?';
                const ok = await showConfirmModal('Elimina Carta', msg, 'Elimina', 'Annulla');
                if (ok) {
                    bankAccounts[bankIdx].cards.splice(cardIdx, 1);
                    renderBankAccounts();
                }
            }
        }, [createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'delete' })]),

        isOpen ? createElement('div', { className: 'flex-col-gap animate-fade-in' }, [
            createInputField('Nome Carta', card.cardType, (val) => bankAccounts[bankIdx].cards[cardIdx].cardType = val, 'credit_card'),
            createInputField('Titolare', card.titolare, (val) => bankAccounts[bankIdx].cards[cardIdx].titolare = val, 'person'),
            createInputField('Numero Carta', card.cardNumber, (val) => bankAccounts[bankIdx].cards[cardIdx].cardNumber = val, 'numbers'),
            createElement('div', { className: 'form-grid-2' }, [
                createInputField('Scadenza', card.expiry, (val) => bankAccounts[bankIdx].cards[cardIdx].expiry = val, 'calendar_month'),
                createInputField('PIN', card.pin, (val) => bankAccounts[bankIdx].cards[cardIdx].pin = val, 'pin'),
                createInputField('CCV', card.ccv, (val) => bankAccounts[bankIdx].cards[cardIdx].ccv = val, 'shield')
            ])
        ]) : null
    ]);
}

function createInputField(label, value, onInput, icon) {
    return createElement('div', { className: 'glass-field-container' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field border-glow' }, [
            createElement('span', { className: 'material-symbols-outlined ml-4 opacity-40', textContent: icon }),
            createElement('input', {
                className: 'field-input',
                value: value || '',
                placeholder: label,
                oninput: (e) => onInput(e.target.value)
            })
        ])
    ]);
}

async function removeIban(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_remove_account') || "Rimuovere conto?")) return;
    bankAccounts.splice(idx, 1);
    renderBankAccounts();
}

window.saveAccount = async () => {
    const btnSave = document.querySelector('button[onclick="window.saveAccount()"]') || document.getElementById('save-btn-footer');
    if (btnSave) btnSave.disabled = true;

    const hasBankingData = bankAccounts.some(acc => acc.iban?.trim() || (acc.cards && acc.cards.length > 0));
    const inviteEmail = get('invite-email');

    const data = {
        nomeAccount: (get('account-name') || '').trim(),
        username: (get('account-username') || '').trim(),
        account: (get('account-code') || '').trim(),
        password: (get('account-password') || '').trim(),
        url: (get('account-url') || '').trim(),
        note: (get('account-note') || '').trim(),
        referenteNome: (get('ref-name') || '').trim(),
        referenteTelefono: (get('ref-phone') || '').trim(),
        referenteCellulare: (get('ref-mobile') || '').trim(),

        isBanking: (document.getElementById('flag-banking')?.checked && hasBankingData) || false,
        banking: bankAccounts.map(b => ({
            iban: (b.iban || '').trim(),
            passwordDispositiva: (b.passwordDispositiva || '').trim(),
            referenteNome: (b.referenteNome || '').trim(),
            referenteTelefono: (b.referenteTelefono || '').trim(),
            referenteCellulare: (b.referenteCellulare || '').trim(),
            cards: b.cards || []
        })),
        isExplicitMemo: isExplicitMemo,
        updatedAt: new Date().toISOString()
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

    data.type = (isMemoUI || isMemoSharedUI) ? "memo" : "account";
    data.visibility = (isSharedUI || isMemoSharedUI) ? "shared" : "private";

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

        // --- ATOMIC TRANSACTION V3.1 ---
        await runTransaction(db, async (transaction) => {
            const accRef = isEditing ? doc(db, colPath, currentDocId) : doc(collection(db, colPath));
            const targetId = accRef.id;

            // 1. ALL READS FIRST
            const accountSnap = isEditing ? await transaction.get(accRef) : null;
            const oldData = accountSnap?.exists() ? accountSnap.data() : null;
            let currentSharedWith = oldData?.sharedWith || {};

            // 2. NOW EXECUTE ALL WRITES
            const finalData = { ...data };
            if (!isEditing) finalData.createdAt = new Date().toISOString();
            finalData.type = (data.type === 'memo') ? 'memo' : 'account'; // Force correct type V3.1

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
                            aziendaId: currentAziendaId,
                            ownerId: currentUid,
                            senderId: currentUid,
                            senderEmail: auth.currentUser?.email || '',
                            recipientEmail: email.toLowerCase().trim(),
                            accountName: data.nomeAccount,
                            type: finalData.type,
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

                // --- AUTO-HEALING V5.1: Forza visibilità private se non ci sono inviti attivi ---
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

            console.log("[V3.1-DEBUG] Final Transaction Payload Azienda:", finalData);
            // Update/Create Account V3.1
            if (isEditing) transaction.update(accRef, finalData);
            else transaction.set(accRef, finalData);
        });

        showToast(t('success_save'), "success");
        setTimeout(() => window.location.href = 'dettaglio_azienda.html?id=' + currentAziendaId, 1000);

    } catch (e) {
        console.error("[V3.1-ERROR] SaveAccount Azienda Failed:", e);
        if (e.code === 'permission-denied') showToast("Accesso negato. Controlla i permessi Firestore.", "error");
        else showToast(t('error_generic') || "Errore durante il salvataggio", "error");
        if (btnSave) btnSave.disabled = false;
    }
};

async function deleteAccount() {
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) return;
    try {
        await deleteDoc(doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentDocId));
        showToast(t('success_deleted'), "success");
        setTimeout(() => window.location.href = `account_azienda.html?id=${currentAziendaId}`, 1000);
    } catch (e) { logError("Delete", e); showToast(t('error_generic'), "error"); }
}

function toggleLoading(show) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.classList.toggle('hidden', !show);
}

