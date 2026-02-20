/**
 * FORM ACCOUNT PRIVATO (V4.4)
 * Creazione e modifica account con gestione IBAN dinamica.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { doc, getDoc, getDocFromServer, updateDoc, deleteDoc, collection, addDoc, getDocs, setDoc, query, where, runTransaction, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- STATE ---
let currentUid = null;
let currentDocId = null;
let isEditing = false;
let bankAccounts = []; // Inizialmente vuoto per nuovi account
let myContacts = [];
let invitedEmails = [];

// Utility per recupero rapido valori (evita ReferenceError)
const get = (id) => document.getElementById(id)?.value.trim() || '';

// --- INITIALIZATION ---
/**
 * FORM ACCOUNT PRIVATO MODULE (V5.0 ADAPTER)
 * Creazione e modifica account.
 * - Entry Point: initFormAccountPrivato(user)
 */

export async function initFormAccountPrivato(user) {
    console.log("[FORM-ACC] Init V5.0...");
    if (!user) return;
    currentUid = user.uid;

    const params = new URLSearchParams(window.location.search);
    currentDocId = params.get('id');
    isEditing = !!currentDocId;

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
            onclick: () => window.saveAccount()
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
        ]);

        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [cancelBtn, saveBtn]));
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

    setupUI();
    await loadRubrica();
    if (isEditing) await loadData();

    console.log("[FORM-ACC] Ready.");
}

/**
 * LOADING ENGINE
 */
async function loadData() {
    try {
        const snap = await getDoc(doc(db, "users", currentUid, "accounts", currentDocId));
        if (!snap.exists()) { showToast(t('account_not_found'), "error"); return; }

        const data = snap.data();
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

        setVal('account-name', data.nomeAccount);
        setVal('account-username', data.username);
        setVal('account-code', data.account || data.codice);
        setVal('account-password', data.password);
        setVal('account-url', data.url || data.sitoWeb);
        setVal('account-note', data.note);

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
            renderBankAccounts();
        } else {
            // Se non ci sono dati reali, il flag rimane spento e la sezione chiusa
            document.getElementById('flag-banking').checked = false;
            document.getElementById('banking-section').classList.add('hidden');
            bankAccounts = [];
        }

        // Flags & Sharing UI
        const isShared = !!data.shared;
        const isMemoShared = !!data.isMemoShared;

        if (document.getElementById('flag-shared')) document.getElementById('flag-shared').checked = isShared;
        if (document.getElementById('flag-memo')) document.getElementById('flag-memo').checked = !!data.hasMemo;
        if (document.getElementById('flag-memo-shared')) document.getElementById('flag-memo-shared').checked = isMemoShared;

        if (isShared || isMemoShared) {
            const mgmt = document.getElementById('shared-management');
            if (mgmt) mgmt.classList.remove('hidden');
            const emails = data.sharedWithEmails || (data.recipientEmail ? [data.recipientEmail] : []);
            invitedEmails = [...emails];
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
        const snap = await getDocs(collection(db, "users", currentUid, "contacts"));
        myContacts = snap.docs.map(d => d.data());
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
            const get = (id) => document.getElementById(id)?.value.trim() || '';
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
            if (bToggle.checked && bankAccounts.length === 0) bankAccounts = [{ iban: '', cards: [] }];
            renderBankAccounts();
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
            if (myContacts.length > 0) {
                renderSuggestions(myContacts);
                suggestions.classList.remove('hidden');
            }
        };
        inviteInput.oninput = (e) => {
            const val = e.target.value.toLowerCase();
            const filtered = myContacts.filter(c => c.email.toLowerCase().includes(val) || (c.nome && c.nome.toLowerCase().includes(val)));
            renderSuggestions(filtered);
            suggestions.classList.toggle('hidden', filtered.length === 0);
        };
    }

    // Close suggestions on outside click
    document.addEventListener('click', (e) => {
        if (!inviteInput?.contains(e.target) && !suggestions?.contains(e.target)) {
            suggestions?.classList.add('hidden');
        }
    });
}

window.renderGuestsList = function () {
    const list = document.getElementById('guests-list');
    if (!list) return;
    clearElement(list);

    invitedEmails.forEach((email, idx) => {
        const item = createElement('div', { className: 'guest-item flex justify-between border border-white/20 p-2 rounded-lg bg-white/5 items-center mb-2' }, [
            createElement('span', { className: 'text-sm text-white/80', textContent: email }),
            createElement('button', {
                type: 'button',
                className: 'material-symbols-outlined text-red-400 hover:text-red-300',
                style: 'font-size: 18px;',
                textContent: 'close',
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
                className: 'font-bold text-primary m-0',
                style: 'font-size: 11px; line-height: 1.2;',
                textContent: c.nome || c.email.split('@')[0]
            }),
            createElement('p', {
                className: 'text-secondary m-0',
                style: 'font-size: 9px; opacity: 0.7;',
                textContent: c.email
            })
        ]);
        container.appendChild(div);
    });
}

function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    clearElement(container);

    bankAccounts.forEach((acc, idx) => {
        const isOpen = acc._isOpen !== false;

        const div = createElement('div', { className: 'bank-account-card border-glow' }, [
            // Header: titolo + cestino inline
            createElement('div', { className: 'bank-header' }, [
                createElement('div', {
                    className: 'bank-header-left',
                    onclick: () => { acc._isOpen = !isOpen; renderBankAccounts(); },
                    style: 'cursor:pointer; flex:1;'
                }, [
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
                }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })])
            ]),

            // Content (Solo se aperto)
            isOpen ? createElement('div', { className: 'bank-details' }, [
                createInputField('IBAN', acc.iban, (val) => bankAccounts[idx].iban = val, 'account_balance'),
                createInputField('Pass. Disp.', acc.passwordDispositiva, (val) => bankAccounts[idx].passwordDispositiva = val, 'lock'),
                createInputField('Tel. Banca', acc.referenteTelefono, (val) => bankAccounts[idx].referenteTelefono = val, 'call'),
                createInputField('Cell. Banca', acc.referenteCellulare, (val) => bankAccounts[idx].referenteCellulare = val, 'smartphone'),

                // Carte Section
                createElement('div', { className: 'bank-cards-section' }, [
                    createElement('div', { className: 'bank-cards-header' }, [
                        createElement('span', { className: 'bank-cards-label', textContent: 'Carte Associate' }),
                        createElement('button', {
                            className: 'btn-add-card',
                            onclick: () => {
                                if (!acc.cards) acc.cards = [];
                                acc.cards.forEach(c => c._isOpen = false);
                                acc.cards.push({ cardType: '', cardNumber: '', expiry: '', titolare: '', ccv: '', pin: '', type: 'Credit', _isOpen: true });
                                renderBankAccounts();
                            }
                        }, [
                            createElement('span', { className: 'material-symbols-outlined', textContent: 'add_card' })
                        ])
                    ]),
                    createElement('div', { className: 'flex-col-gap' }, (acc.cards || []).map((card, cIdx) => renderCardEntry(idx, cIdx, card)))
                ])
            ]) : null
        ]);
        container.appendChild(div);
    });

    // Hook up the header button if it exists
    const headAddBtn = document.getElementById('btn-add-iban');
    if (headAddBtn) headAddBtn.onclick = () => {
        // Chiudi altri IBAN
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
        renderBankAccounts();
    };
}

function renderCardEntry(bankIdx, cardIdx, card) {
    const isOpen = card._isOpen !== false;

    return createElement('div', { className: 'card-entry border-glow' }, [
        // Card Header: titolo + cestino inline
        createElement('div', { className: 'card-entry-header' }, [
            createElement('div', {
                className: 'card-entry-title-row',
                onclick: () => { card._isOpen = !isOpen; renderBankAccounts(); },
                style: 'cursor:pointer; flex:1;'
            }, [
                createElement('span', {
                    className: 'material-symbols-outlined card-entry-icon',
                    style: `transform: rotate(${isOpen ? '0' : '-90'}deg)`,
                    textContent: 'credit_card'
                }),
                createElement('span', { className: 'card-entry-label', textContent: card.cardType || `Carta #${cardIdx + 1}` })
            ]),
            createElement('button', {
                className: 'btn-delete-bank',
                onclick: async (e) => {
                    e.stopPropagation();
                    const msg = t('confirm_delete_card') || 'Eliminare questa carta?';
                    const ok = await showConfirmModal('Elimina Carta', msg, 'Elimina', 'Annulla');
                    if (ok) {
                        bankAccounts[bankIdx].cards.splice(cardIdx, 1);
                        renderBankAccounts();
                    }
                }
            }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })])
        ]),

        isOpen ? createElement('div', { className: 'flex-col-gap' }, [
            createInputField('Nome Carta (es. Visa, Blu...)', card.cardType, (val) => bankAccounts[bankIdx].cards[cardIdx].cardType = val, 'credit_card'),
            createInputField('Titolare', card.titolare, (val) => bankAccounts[bankIdx].cards[cardIdx].titolare = val, 'person'),
            createInputField('Numero Carta', card.cardNumber, (val) => bankAccounts[bankIdx].cards[cardIdx].cardNumber = val, 'numbers'),
            createInputField('Scadenza', card.expiry, (val) => bankAccounts[bankIdx].cards[cardIdx].expiry = val, 'event'),
            createInputField('PIN', card.pin, (val) => bankAccounts[bankIdx].cards[cardIdx].pin = val, 'pin'),
            createInputField('CCV', card.ccv, (val) => bankAccounts[bankIdx].cards[cardIdx].ccv = val, 'verified_user')
        ]) : null
    ]);
}

function createInputField(label, value, onInput, icon, type = 'text') {
    return createElement('div', { className: 'glass-field-container w-full' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field border-glow' }, [
            createElement('span', { className: 'material-symbols-outlined ml-4 opacity-40', textContent: icon }),
            createElement('input', {
                className: 'field-input',
                type: type,
                value: value || '',
                oninput: (e) => onInput(e.target.value)
            })
        ])
    ]);
}

/**
 * ACTIONS
 */
window.saveAccount = async () => {
    const btnSave = document.querySelector('button[onclick="saveAccount()"]') || document.getElementById('save-btn-footer');
    if (btnSave) btnSave.disabled = true;

    // Check if banking actually has data
    const hasBankingData = (bankAccounts || []).some(acc => {
        const hasIban = acc.iban && acc.iban.trim().length > 0;
        const hasDisp = acc.passwordDispositiva && acc.passwordDispositiva.trim().length > 0;
        const hasCards = acc.cards && acc.cards.some(c => c.cardNumber?.trim() || c.cardType?.trim() || c.pin?.trim() || c.ccv?.trim());
        const hasRef = (acc.referenteTelefono?.trim() || acc.referenteCellulare?.trim());
        return hasIban || hasDisp || hasCards || hasRef;
    });

    const logoPreview = document.getElementById('account-logo-preview');
    const logoSrc = (logoPreview && !logoPreview.classList.contains('hidden')) ? logoPreview.src : null;

    const data = {
        nomeAccount: get('account-name'),
        username: get('account-username'),
        account: get('account-code'),
        password: get('account-password'),
        url: get('account-url'),
        note: get('account-note'),
        logo: logoSrc, // Save the Base64 logo
        shared: document.getElementById('flag-shared')?.checked || false,
        hasMemo: document.getElementById('flag-memo')?.checked || false,
        isMemoShared: document.getElementById('flag-memo-shared')?.checked || false,
        isBanking: (document.getElementById('flag-banking')?.checked && hasBankingData) || false,
        banking: bankAccounts,
        updatedAt: new Date().toISOString()
    };

    const isSharingActive = (data.shared || data.isMemoShared);
    const inviteEmail = get('invite-email');

    if (!data.nomeAccount) { showToast("Inserisci un nome account", "error"); return; }

    // RULE 4: Validation for Sharing
    let inviteEmails = [];
    if (data.shared || data.isMemoShared) {
        inviteEmails = [...invitedEmails];
        const raw = get('invite-email');
        if (raw) {
            const extraEmails = raw.split(/[,; ]+/).map(e => e.trim().toLowerCase()).filter(e => e.includes('@'));
            extraEmails.forEach(e => {
                if (!inviteEmails.includes(e)) inviteEmails.push(e);
            });
        }
        if (inviteEmails.length === 0) {
            showToast("Scegli o aggiungi almeno un contatto per condividere.", "warning");
            if (btnSave) btnSave.disabled = false;
            return;
        }
        data.recipientEmail = inviteEmails[0];
        data.sharedWithEmails = inviteEmails;
    } else {
        data.sharedWithEmails = [];
        data.recipientEmail = "";
    }

    try {
        // --- ATOMIC TRANSACTION (HARDENING V2) ---
        await runTransaction(db, async (transaction) => {
            const accRef = isEditing ? doc(db, "users", currentUid, "accounts", currentDocId) : doc(collection(db, "users", currentUid, "accounts"));
            const targetId = accRef.id;

            // 1. ALL READS FIRST (Firestore Constraint)
            const accountSnap = isEditing ? await transaction.get(accRef) : null;
            const oldData = accountSnap?.exists() ? accountSnap.data() : null;
            const oldEmails = oldData?.sharedWithEmails || (oldData?.recipientEmail ? [oldData.recipientEmail] : []);

            const inviteSnaps = {};
            if (isSharingActive) {
                for (const email of inviteEmails) {
                    const invId = `${targetId}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    inviteSnaps[email] = await transaction.get(doc(db, "invites", invId));
                }
            }

            // 2. NOW EXECUTE ALL WRITES
            const finalData = { ...data };
            if (!isEditing) finalData.createdAt = new Date().toISOString();

            // Handle Revocation Logic
            if (!isSharingActive && oldEmails.length > 0) {
                oldEmails.forEach(email => {
                    const invId = `${targetId}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    transaction.delete(doc(db, "invites", invId));
                });
                finalData.sharedWithEmails = [];
                finalData.recipientEmail = "";
            } else if (isSharingActive) {
                const toRemove = oldEmails.filter(e => !inviteEmails.includes(e));
                toRemove.forEach(email => {
                    const invId = `${targetId}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    transaction.delete(doc(db, "invites", invId));
                });
            }

            // Update/Create Account
            if (isEditing) transaction.update(accRef, finalData);
            else transaction.set(accRef, finalData);

            // Create/Update Invites
            if (isSharingActive) {
                for (const email of inviteEmails) {
                    const inviteId = `${targetId}_${email.replace(/[^a-zA-Z0-9]/g, '_')}`;
                    const inviteRef = doc(db, "invites", inviteId);
                    const snap = inviteSnaps[email];

                    let shouldSet = true;
                    if (snap && snap.exists()) {
                        const status = snap.data().status;
                        if (status === 'accepted' || status === 'pending') {
                            shouldSet = false; // Preserva stato esistente
                        }
                    }

                    if (shouldSet) {
                        transaction.set(inviteRef, {
                            senderId: currentUid,
                            senderEmail: auth.currentUser?.email || 'unknown',
                            recipientEmail: email,
                            accountId: targetId,
                            accountName: data.nomeAccount,
                            type: data.isMemoShared ? 'memorandum' : 'privato',
                            status: 'pending',
                            createdAt: new Date().toISOString()
                        });
                    }
                }
            }
        });

        showToast(t('success_save'), "success");
        setTimeout(() => window.location.href = 'account_privati.html', 1000);

    } catch (e) {
        console.error("SaveAccountTransaction", e);
        showToast(t('error_generic'), 'error');
        if (btnSave) btnSave.disabled = false;
    }
};
