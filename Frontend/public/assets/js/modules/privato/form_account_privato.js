/**
 * FORM ACCOUNT PRIVATO (V4.4)
 * Creazione e modifica account con gestione IBAN dinamica.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

// --- STATE ---
let currentUid = null;
let currentDocId = null;
let isEditing = false;
let bankAccounts = [{ iban: '', cards: [] }];
let myContacts = [];

// --- INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    currentDocId = params.get('id');
    isEditing = !!currentDocId;

    observeAuth(async (user) => {
        if (user) {
            currentUid = user.uid;
            if (isEditing) await loadData();
            await loadRubrica();
        }
    });

    setupUI();
});

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

        // Banking
        if (data.isBanking) {
            document.getElementById('flag-banking').checked = true;
            document.getElementById('banking-section').classList.remove('hidden');
            bankAccounts = Array.isArray(data.banking) ? data.banking : [data.banking || { iban: '', cards: [] }];
            renderBankAccounts();
        }

        // Flags
        if (document.getElementById('flag-shared')) document.getElementById('flag-shared').checked = !!data.shared;
        if (document.getElementById('flag-memo')) document.getElementById('flag-memo').checked = !!data.hasMemo;
        if (document.getElementById('flag-memo-shared')) document.getElementById('flag-memo-shared').checked = !!data.isMemoShared;

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
    // Flag Mutual Exclusion
    const flags = ['flag-shared', 'flag-memo', 'flag-memo-shared'].map(id => document.getElementById(id)).filter(Boolean);
    flags.forEach(f => {
        f.onchange = () => {
            if (f.checked) flags.forEach(other => { if (other !== f) other.checked = false; });
            const mgmt = document.getElementById('shared-management');
            if (mgmt) mgmt.classList.toggle('hidden', !document.getElementById('flag-shared').checked && !document.getElementById('flag-memo-shared').checked);
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
}

/**
 * BANKING MANAGEMENT
 */
function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    clearElement(container);

    bankAccounts.forEach((acc, idx) => {
        const div = createElement('div', { className: 'flex-col-gap p-4 rounded-2xl border border-white/10 bg-white/5 relative border-glow mb-4' }, [
            createElement('div', { className: 'flex items-center justify-between mb-2' }, [
                createElement('span', { className: 'text-[10px] font-black uppercase text-purple-400', textContent: `Conto #${idx + 1}` }),
                bankAccounts.length > 1 ? createElement('button', {
                    className: 'text-red-400 text-xs',
                    onclick: () => { bankAccounts.splice(idx, 1); renderBankAccounts(); }
                }, [createElement('span', { className: 'material-symbols-outlined', textContent: 'close' })]) : null
            ]),
            createInputField('IBAN', acc.iban, (val) => bankAccounts[idx].iban = val, 'account_balance'),
            createInputField('Pass. Disp.', acc.passwordDispositiva, (val) => bankAccounts[idx].passwordDispositiva = val, 'lock')
        ]);
        container.appendChild(div);
    });

    const addBtn = createElement('button', {
        className: 'w-full py-3 rounded-xl bg-purple-500/10 text-purple-400 text-[10px] font-black uppercase border border-purple-500/20 mt-2',
        onclick: () => { bankAccounts.push({ iban: '', cards: [] }); renderBankAccounts(); },
        textContent: '+ Aggiungi Conto'
    });
    container.appendChild(addBtn);
}

function createInputField(label, value, onInput, icon) {
    return createElement('div', { className: 'glass-field-container w-full' }, [
        createElement('label', { className: 'view-label', textContent: label }),
        createElement('div', { className: 'glass-field border-glow' }, [
            createElement('span', { className: 'material-symbols-outlined ml-4 opacity-40', textContent: icon }),
            createElement('input', {
                className: 'bg-transparent border-none text-white text-xs p-3 w-full outline-none',
                value: value || '',
                placeholder: label,
                oninput: (e) => onInput(e.target.value)
            })
        ])
    ]);
}

/**
 * ACTIONS
 */
window.saveAccount = async () => {
    const get = (id) => document.getElementById(id)?.value.trim() || '';
    const data = {
        nomeAccount: get('account-name'),
        username: get('account-username'),
        account: get('account-code'),
        password: get('account-password'),
        url: get('account-url'),
        note: get('account-note'),
        shared: document.getElementById('flag-shared')?.checked || false,
        hasMemo: document.getElementById('flag-memo')?.checked || false,
        isMemoShared: document.getElementById('flag-memo-shared')?.checked || false,
        isBanking: document.getElementById('flag-banking')?.checked || false,
        banking: bankAccounts,
        updatedAt: new Date().toISOString()
    };

    if (!data.nomeAccount) { showToast("Inserisci un nome account", "error"); return; }

    try {
        if (isEditing) {
            await updateDoc(doc(db, "users", currentUid, "accounts", currentDocId), data);
            showToast(t('success_save'));
        } else {
            data.createdAt = new Date().toISOString();
            await addDoc(collection(db, "users", currentUid, "accounts"), data);
            showToast(t('success_create') || "Account creato!");
        }
        setTimeout(() => window.location.href = 'account_privati.html', 1000);
    } catch (e) { logError("SaveAccount", e); showToast(t('error_generic'), "error"); }
};

