/**
 * FORM ACCOUNT AZIENDA MODULE (V5.0 ADAPTER)
 * Creazione e modifica account aziendali con gestione dinamica IBAN.
 * - Entry Point: initFormAccountAzienda(user)
 */

import { auth, db } from '../../firebase-config.js';
import { doc, getDoc, getDocFromServer, updateDoc, deleteDoc, collection, addDoc, getDocs, setDoc, query, where } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

// --- STATE ---
let currentUid = null;
let currentDocId = null;
let currentAziendaId = null;
let isEditing = false;
let bankAccounts = [];
let myContacts = [];

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

    if (isEditing) await loadData();
    await loadRubrica();

    console.log("[FORM-ACCOUNT-AZIENDA] Ready.");
}

function initBaseUI() {
    console.log('[form_account_azienda] UI Base gestita da main.js');

    // Aggiorna titolo Header (se già presente)
    const hTitle = document.querySelector('.base-header .header-title');
    if (hTitle) {
        hTitle.textContent = isEditing ? (t('loading') || 'Caricamento...') : (t('new_company_account') || 'Nuovo Account Azienda');
        if (isEditing) hTitle.classList.add('animate-pulse');
    }

    // Footer actions setup
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);

        const cancelBtn = createElement('button', {
            className: 'btn-fab-action btn-fab-neutral',
            title: t('cancel') || 'Annulla',
            onclick: () => history.back()
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'close' })
        ]);

        const saveBtn = createElement('button', {
            id: 'save-btn',
            className: 'btn-fab-action btn-fab-scadenza',
            title: t('save') || 'Salva',
            onclick: saveChanges
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'save' })
        ]);

        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [cancelBtn, saveBtn]));
    }

    const fRight = document.getElementById('footer-right-actions');
    if (fRight) {
        clearElement(fRight);
        setChildren(fRight, createElement('a', {
            href: 'impostazioni.html',
            className: 'btn-icon-header',
            title: 'Impostazioni'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'tune' })
        ]));
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

        // Flags & Sharing
        if (document.getElementById('flag-shared')) document.getElementById('flag-shared').checked = !!data.shared;
        if (document.getElementById('flag-memo')) document.getElementById('flag-memo').checked = !!data.hasMemo;
        if (document.getElementById('flag-memo-shared')) document.getElementById('flag-memo-shared').checked = !!data.isMemoShared;

        if (data.shared || data.isMemoShared) {
            document.getElementById('shared-management')?.classList.remove('hidden');
            setVal('invite-email', data.recipientEmail);
        }

        // Logo
        if (data.logo || data.avatar) {
            const preview = document.getElementById('account-logo-preview');
            preview.src = data.logo || data.avatar;
            preview.classList.remove('hidden');
            document.getElementById('logo-placeholder').classList.add('hidden');
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
            const fieldsPopulated = !!(get('account-username') || get('account-code') || get('account-password'));
            if (f.checked) {
                if ((f.id === 'flag-memo' || f.id === 'flag-memo-shared') && fieldsPopulated) {
                    f.checked = false;
                    showToast("Per usare Memorandum devi prima svuotare Username / Codice / Password", "warning");
                    return;
                }
                if (f.id === 'flag-shared' && !fieldsPopulated) {
                    f.checked = false;
                    showToast("Per condividere devi inserire almeno Username, Codice o Password", "warning");
                    return;
                }
                flags.forEach(other => { if (other !== f) other.checked = false; });
            }
            const mgmt = document.getElementById('shared-management');
            const isSharing = document.getElementById('flag-shared').checked || document.getElementById('flag-memo-shared').checked;
            if (mgmt) mgmt.classList.toggle('hidden', !isSharing);
        };
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

    // Suggestions logic
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

function renderSuggestions(list) {
    const container = document.getElementById('rubrica-suggestions');
    if (!container) return;
    clearElement(container);
    list.forEach(c => {
        const div = createElement('div', {
            className: 'p-3 cursor-pointer border-b border-white/5 last:border-none selection-item-hover',
            onclick: () => { document.getElementById('invite-email').value = c.email; container.classList.add('hidden'); }
        }, [
            createElement('p', { className: 'text-xs font-bold text-primary m-0', textContent: c.nome || c.email.split('@')[0] }),
            createElement('p', { className: 'text-[10px] text-secondary m-0', textContent: c.email })
        ]);
        container.appendChild(div);
    });
}

function setupImageUploader() {
    const input = document.getElementById('logo-input');
    const btnRemove = document.getElementById('btn-remove-logo');
    const preview = document.getElementById('account-logo-preview');
    const placeholder = document.getElementById('logo-placeholder');

    if (!input) return;

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

        const div = createElement('div', { className: 'flex-col-gap p-4 rounded-2xl border border-white/10 bg-white/5 relative border-glow mb-4' }, [
            createElement('div', {
                className: 'flex items-center justify-between mb-2 cursor-pointer',
                onclick: () => { acc._isOpen = !isOpen; renderBankAccounts(); }
            }, [
                createElement('div', { className: 'flex items-center gap-2' }, [
                    createElement('span', {
                        className: 'material-symbols-outlined text-[16px] text-purple-400 transition-transform',
                        style: `transform: rotate(${isOpen ? '0' : '-90'}deg)`,
                        textContent: 'expand_more'
                    }),
                    createElement('span', { className: 'text-[10px] font-black uppercase text-purple-400', textContent: acc.iban ? `Conto: ${acc.iban.substring(0, 10)}...` : `Nuovo Conto #${idx + 1}` })
                ]),
                createElement('button', {
                    className: 'bg-transparent border-none text-red-500/20 hover:text-red-500 transition-all p-1',
                    onclick: (e) => { e.stopPropagation(); bankAccounts.splice(idx, 1); renderBankAccounts(); }
                }, [createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'delete' })])
            ]),

            isOpen ? createElement('div', { className: 'flex-col-gap animate-fade-in' }, [
                createInputField('IBAN', acc.iban, (val) => bankAccounts[idx].iban = val, 'account_balance'),
                createInputField('Pass. Disp.', acc.passwordDispositiva, (val) => bankAccounts[idx].passwordDispositiva = val, 'lock'),
                createInputField('Tel. Banca', acc.referenteTelefono, (val) => bankAccounts[idx].referenteTelefono = val, 'call'),
                createInputField('Cell. Banca', acc.referenteCellulare, (val) => bankAccounts[idx].referenteCellulare = val, 'smartphone'),

                // Carte Section
                createElement('div', { className: 'mt-4 border-t border-white/5 pt-4' }, [
                    createElement('div', { className: 'flex items-center justify-between mb-3' }, [
                        createElement('span', { className: 'text-[9px] font-black uppercase text-white/40 tracking-widest', textContent: 'Carte Associate' }),
                        createElement('button', {
                            className: 'bg-transparent border-none text-emerald-400/40 hover:text-emerald-400 p-1',
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
    return createElement('div', { className: 'bg-black/20 p-4 rounded-2xl border border-white/5 relative group mb-3 border-glow' }, [
        createElement('div', {
            className: 'flex items-center justify-between cursor-pointer mb-2',
            onclick: () => { card._isOpen = !isOpen; renderBankAccounts(); }
        }, [
            createElement('div', { className: 'flex items-center gap-2' }, [
                createElement('span', { className: 'material-symbols-outlined text-[16px] text-emerald-400', textContent: 'credit_card' }),
                createElement('span', { className: 'text-[10px] font-black uppercase text-emerald-400', textContent: card.cardType || `Carta #${cardIdx + 1}` })
            ])
        ]),
        createElement('button', {
            className: 'absolute top-3 right-3 bg-transparent border-none text-red-500/20 hover:text-red-500 p-1',
            onclick: (e) => { e.stopPropagation(); bankAccounts[bankIdx].cards.splice(cardIdx, 1); renderBankAccounts(); }
        }, [createElement('span', { className: 'material-symbols-outlined !text-[18px]', textContent: 'delete' })]),

        isOpen ? createElement('div', { className: 'flex-col-gap animate-fade-in' }, [
            createInputField('Nome Carta', card.cardType, (val) => bankAccounts[bankIdx].cards[cardIdx].cardType = val, 'credit_card'),
            createInputField('Titolare', card.titolare, (val) => bankAccounts[bankIdx].cards[cardIdx].titolare = val, 'person'),
            createInputField('Numero Carta', card.cardNumber, (val) => bankAccounts[bankIdx].cards[cardIdx].cardNumber = val, 'numbers'),
            createElement('div', { className: 'grid grid-cols-3 gap-3' }, [
                createInputField('Scadenza', card.expiry, (val) => bankAccounts[bankIdx].cards[cardIdx].expiry = val, 'calendar_month'),
                createInputField('PIN', card.pin, (val) => bankAccounts[bankIdx].cards[cardIdx].pin = val, 'pin'),
                createInputField('CCV', card.ccv, (val) => bankAccounts[bankIdx].cards[cardIdx].ccv = val, 'shield')
            ])
        ]) : null
    ]);
}

function createInputField(label, value, onInput, icon) {
    return createElement('div', { className: 'glass-field-container w-full' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field border-glow' }, [
            createElement('span', { className: 'material-symbols-outlined ml-4 opacity-40', textContent: icon }),
            createElement('input', {
                className: 'bg-transparent border-none text-primary text-xs p-3 w-full outline-none',
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

async function saveChanges() {
    const btn = document.getElementById('save-btn') || document.getElementById('btn-save-footer');
    if (btn) btn.disabled = true;

    const hasBankingData = bankAccounts.some(acc => acc.iban?.trim() || (acc.cards && acc.cards.length > 0));
    const inviteEmail = get('invite-email');

    const data = {
        nomeAccount: get('account-name'),
        username: get('account-username'),
        account: get('account-code'),
        password: get('account-password'),
        url: get('account-url'),
        note: get('account-note'),
        referenteNome: get('ref-name'),
        referenteTelefono: get('ref-phone'),
        referenteCellulare: get('ref-mobile'),
        shared: document.getElementById('flag-shared')?.checked || false,
        hasMemo: document.getElementById('flag-memo')?.checked || false,
        isMemoShared: document.getElementById('flag-memo-shared')?.checked || false,
        isBanking: (document.getElementById('flag-banking')?.checked && hasBankingData) || false,
        banking: bankAccounts.map(b => ({
            iban: b.iban || '',
            passwordDispositiva: b.passwordDispositiva || '',
            referenteNome: b.referenteNome || '',
            referenteTelefono: b.referenteTelefono || '',
            referenteCellulare: b.referenteCellulare || '',
            cards: b.cards || []
        })),
        updatedAt: new Date().toISOString(),
        type: 'azienda'
    };

    if (!data.nomeAccount) { showToast("Inserisci un nome account", "error"); if (btn) btn.disabled = false; return; }

    const isSharingActive = (data.shared || data.isMemoShared);
    if (isSharingActive) {
        if (!inviteEmail) { showToast("Scegli un contatto o disattiva il flag condiviso", "warning"); if (btn) btn.disabled = false; return; }
        data.recipientEmail = inviteEmail;
        data.sharedWith = [{ email: inviteEmail, status: 'pending' }];
        data.sharedWithEmails = [inviteEmail];
    }

    try {
        let tid = currentDocId;
        const colPath = `users/${currentUid}/aziende/${currentAziendaId}/accounts`;

        // Revoca Search & Destroy
        if (isEditing) {
            const oldSnap = await getDocFromServer(doc(db, colPath, currentDocId));
            if (oldSnap.exists()) {
                const old = oldSnap.data();
                const wasShared = old.shared || old.isMemoShared;
                if (wasShared && (!isSharingActive || old.recipientEmail !== inviteEmail)) {
                    const qFlags = query(collection(db, "invites"), where("accountId", "==", currentDocId), where("senderId", "==", currentUid));
                    const qS = await getDocs(qFlags);
                    qS.forEach(async (d) => await deleteDoc(d.ref));
                }
            }
            await updateDoc(doc(db, colPath, currentDocId), data);
        } else {
            data.createdAt = new Date().toISOString();
            const nr = await addDoc(collection(db, colPath), data);
            tid = nr.id;
        }

        // Invito
        if (isSharingActive) {
            const invId = `${tid}_${inviteEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const invRef = doc(db, "invites", invId);
            const invSnap = await getDoc(invRef);
            if (!invSnap.exists() || (invSnap.data().status !== 'accepted' && invSnap.data().status !== 'pending')) {
                await setDoc(invRef, {
                    senderId: currentUid,
                    senderEmail: auth.currentUser?.email || 'unknown',
                    recipientEmail: inviteEmail,
                    accountId: tid,
                    accountName: data.nomeAccount,
                    type: 'azienda',
                    status: 'pending',
                    aziendaId: currentAziendaId,
                    createdAt: new Date().toISOString()
                });
                showToast(t('success_invite_sent'));
            }
        }

        showToast(isEditing ? (t('success_save') || "Dati salvati con successo!") : "Account creato con successo!", "success");
        setTimeout(() => window.location.href = `dettaglio_account_azienda.html?id=${tid}&aziendaId=${currentAziendaId}`, 1000);
    } catch (e) { logError("Save", e); showToast(t('error_save'), "error"); if (btn) btn.disabled = false; }
}

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

