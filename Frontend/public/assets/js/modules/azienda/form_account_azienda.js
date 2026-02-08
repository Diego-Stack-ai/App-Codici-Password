/**
 * FORM ACCOUNT AZIENDA MODULE (V4.1)
 * Creazione e modifica account aziendali con gestione dinamica IBAN.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- STATE ---
let currentUid = null;
let currentDocId = null;
let currentAziendaId = null;
let isEditing = false;
let bankAccounts = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentDocId = urlParams.get('id');
    currentAziendaId = urlParams.get('aziendaId');
    isEditing = !!currentDocId;

    if (!currentAziendaId) {
        showToast("ID Azienda mancante", "error");
        setTimeout(() => history.back(), 1000);
        return;
    }

    initBaseUI();
    setupUI();
    setupImageUploader();

    observeAuth(async (user) => {
        if (user) {
            currentUid = user.uid;
            if (isEditing) {
                await loadData(currentDocId);
            } else {
                bankAccounts = [{ iban: '', nota: '', _isOpen: true }];
                renderBankAccounts();
                toggleLoading(false);
            }
        } else {
            window.location.href = 'index.html';
        }
    });
});

function initBaseUI() {
    // Header
    const hLeft = document.getElementById('header-left');
    if (hLeft) {
        clearElement(hLeft);
        setChildren(hLeft, createElement('button', {
            className: 'btn-icon-header',
            onclick: () => {
                if (isEditing) window.location.href = `dettaglio_account_azienda.html?id=${currentDocId}&aziendaId=${currentAziendaId}`;
                else window.location.href = `account_azienda.html?id=${currentAziendaId}`;
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'arrow_back' })
        ]));
    }

    const hCenter = document.getElementById('header-center');
    if (hCenter) {
        clearElement(hCenter);
        setChildren(hCenter, createElement('h1', {
            id: 'header-title-page',
            className: `header-title ${isEditing ? 'animate-pulse' : ''}`,
            textContent: isEditing ? (t('loading') || 'Caricamento...') : (t('new_company_account') || 'Nuovo Account Azienda')
        }));
    }

    const hRight = document.getElementById('header-right');
    if (hRight) {
        clearElement(hRight);
        setChildren(hRight, createElement('a', {
            href: 'home_page.html',
            className: 'btn-icon-header'
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'home' })
        ]));
    }

    // Footer
    const fCenter = document.getElementById('footer-center-actions');
    if (isEditing && fCenter) {
        clearElement(fCenter);
        setChildren(fCenter, createElement('button', {
            id: 'delete-btn',
            className: 'btn-icon-header btn-delete-footer',
            onclick: deleteAccount
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
        ]));
    }

    const fRight = document.getElementById('footer-right-actions');
    if (fRight) {
        clearElement(fRight);
        setChildren(fRight, createElement('button', {
            id: 'save-btn',
            className: 'btn-icon-header btn-save-footer',
            onclick: saveChanges
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: isEditing ? 'save' : 'check_circle' })
        ]));
    }
}

async function loadData(id) {
    try {
        const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", id);
        const snap = await getDoc(docRef);

        if (!snap.exists()) {
            showToast(t('error_not_found') || "Account non trovato", "error");
            window.location.href = `account_azienda.html?id=${currentAziendaId}`;
            return;
        }

        const data = snap.data();

        // Fill static fields
        const setV = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
        setV('account-name', data.nomeAccount);
        setV('account-username', data.username);
        setV('account-code', data.account || data.codice);
        setV('account-password', data.password);
        setV('account-url', data.url || data.sitoWeb);
        setV('account-note', data.note);
        setV('ref-name', data.referenteNome || data.referente?.nome);
        setV('ref-phone', data.referenteTelefono || data.referente?.telefono);
        setV('ref-mobile', data.referenteCellulare || data.referente?.cellulare);

        const hTitle = document.getElementById('header-title-page');
        if (hTitle) {
            hTitle.textContent = data.nomeAccount || t('edit_account') || 'Modifica Account';
            hTitle.classList.remove('animate-pulse');
        }

        // Banking
        if (data.isBanking) {
            const el = document.getElementById('flag-banking'); if (el) el.checked = true;
            const sec = document.getElementById('banking-section'); if (sec) sec.classList.remove('hidden');

            bankAccounts = Array.isArray(data.banking) ? data.banking :
                (data.banking?.iban ? [{ ...data.banking }] :
                    (data.iban ? [{ iban: data.iban }] : []));
        }

        if (bankAccounts.length === 0) bankAccounts = [{ iban: '', nota: '', _isOpen: true }];
        renderBankAccounts();

        // Logo
        if (data.logo || data.avatar) {
            const preview = document.getElementById('account-logo-preview');
            const placeholder = document.getElementById('logo-placeholder');
            const btnRemove = document.getElementById('btn-remove-logo');
            if (preview) { preview.src = data.logo || data.avatar; preview.classList.remove('hidden'); }
            if (placeholder) placeholder.classList.add('hidden');
            if (btnRemove) btnRemove.classList.remove('hidden');
        }

    } catch (e) {
        logError("LoadData", e);
        showToast(t('error_generic'), "error");
    } finally {
        toggleLoading(false);
    }
}

function setupUI() {
    const flagBanking = document.getElementById('flag-banking');
    if (flagBanking) {
        flagBanking.onchange = () => {
            document.getElementById('banking-section')?.classList.toggle('hidden', !flagBanking.checked);
            if (flagBanking.checked && bankAccounts.length === 0) {
                bankAccounts = [{ iban: '', nota: '', _isOpen: true }];
                renderBankAccounts();
            }
        };
    }

    const btnAddIban = document.getElementById('btn-add-iban');
    if (btnAddIban) {
        btnAddIban.onclick = () => {
            bankAccounts.forEach(b => b._isOpen = false);
            bankAccounts.push({ iban: '', nota: '', _isOpen: true });
            renderBankAccounts();
        };
    }

    const btnTogglePass = document.getElementById('btn-toggle-password-edit');
    const passInput = document.getElementById('account-password');
    if (btnTogglePass && passInput) {
        btnTogglePass.onclick = () => {
            const isPass = passInput.type === 'password';
            passInput.type = isPass ? 'text' : 'password';
            if (isPass) passInput.classList.remove('base-shield');
            else passInput.classList.add('base-shield');
            const icon = btnTogglePass.querySelector('span');
            if (icon) icon.textContent = isPass ? 'visibility_off' : 'visibility';
        };
    }

    const btnLogo = document.getElementById('btn-trigger-logo');
    if (btnLogo) btnLogo.onclick = () => document.getElementById('logo-input')?.click();
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

    const rows = bankAccounts.map((acc, idx) => {
        const isOpen = acc._isOpen !== false;

        return createElement('div', {
            id: `bank-block-${idx}`,
            className: `flex-col-gap p-4 rounded-2xl border border-white/10 bg-white/5 relative group border-glow transition-all duration-300 ${!isOpen ? 'opacity-80' : ''}`
        }, [
            createElement('div', {
                className: 'flex items-center justify-between cursor-pointer',
                onclick: () => { bankAccounts[idx]._isOpen = !isOpen; renderBankAccounts(); }
            }, [
                createElement('div', { className: 'flex items-center gap-2' }, [
                    createElement('span', {
                        className: `material-symbols-outlined text-sm text-purple-400 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`,
                        textContent: 'expand_more'
                    }),
                    createElement('span', {
                        className: 'text-[10px] font-black uppercase text-purple-400',
                        textContent: `${t('account_short') || 'Conto'} #${idx + 1} ${!isOpen && acc.iban ? '• ' + acc.iban.slice(-6) : ''}`
                    })
                ]),
                bankAccounts.length > 1 ? createElement('button', {
                    type: 'button',
                    className: 'glass-field-btn-delete',
                    onclick: (e) => {
                        e.stopPropagation();
                        removeIban(idx);
                    }
                }, [
                    createElement('span', { className: 'material-symbols-outlined text-sm', textContent: 'close' })
                ]) : null
            ]),
            createElement('div', { className: isOpen ? 'flex-col-gap' : 'hidden' }, [
                createFieldGroup('IBAN', acc.iban || '', 'IT00 X...', (v) => bankAccounts[idx].iban = v.toUpperCase(), 'font-mono uppercase'),
                createFieldGroup(t('note_short') || 'Nota Rapida', acc.nota || '', 'Note...', (v) => bankAccounts[idx].nota = v)
            ])
        ]);
    });

    setChildren(container, rows);
}

function createFieldGroup(label, value, placeholder, onInput, inputClass = '') {
    const input = createElement('input', {
        type: 'text',
        className: `iban-input ${inputClass}`,
        value: value,
        placeholder: placeholder,
    });
    input.oninput = (e) => onInput(e.target.value);

    return createElement('div', { className: 'glass-field-container' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field border-glow' }, [input])
    ]);
}

async function removeIban(idx) {
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_remove_account') || "Rimuovere conto?")) return;
    bankAccounts.splice(idx, 1);
    renderBankAccounts();
}

async function saveChanges() {
    const btn = document.getElementById('save-btn');
    if (btn) btn.disabled = true;

    try {
        const payload = {
            nomeAccount: document.getElementById('account-name').value.trim(),
            username: document.getElementById('account-username').value.trim(),
            account: document.getElementById('account-code').value.trim(),
            password: document.getElementById('account-password').value,
            url: document.getElementById('account-url').value.trim(),
            note: document.getElementById('account-note').value.trim(),
            referenteNome: document.getElementById('ref-name').value.trim(),
            referenteTelefono: document.getElementById('ref-phone').value.trim(),
            referenteCellulare: document.getElementById('ref-mobile').value.trim(),
            isBanking: document.getElementById('flag-banking')?.checked || false,
            banking: bankAccounts.map(b => ({ iban: b.iban, nota: b.nota })),
            updatedAt: new Date().toISOString(),
            type: 'azienda'
        };

        const preview = document.getElementById('account-logo-preview');
        if (preview && !preview.classList.contains('hidden') && preview.src.startsWith('data:')) {
            payload.logo = preview.src;
        } else if (preview && preview.classList.contains('hidden')) {
            payload.logo = null;
        }

        if (isEditing) {
            await updateDoc(doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentDocId), payload);
            showToast(t('success_save'), "success");
        } else {
            payload.createdAt = new Date().toISOString();
            await addDoc(collection(db, "users", currentUid, "aziende", currentAziendaId, "accounts"), payload);
            showToast(t('account_created') || "Account creato!", "success");
        }

        setTimeout(() => {
            if (isEditing) window.location.href = `dettaglio_account_azienda.html?id=${currentDocId}&aziendaId=${currentAziendaId}`;
            else window.location.href = `account_azienda.html?id=${currentAziendaId}`;
        }, 1000);

    } catch (e) {
        logError("Save", e);
        showToast(t('error_save'), "error");
        if (btn) btn.disabled = false;
    }
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

