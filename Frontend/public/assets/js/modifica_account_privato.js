import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, arrayRemove, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showToast } from './ui-core.js';

// STATE
let currentUid = null;
let currentDocId = null;
let accountData = {};
let myContacts = [];
let bankAccounts = []; // { iban: '', cards: [] }

// DOM ELEMENTS (Moved inside functions for safety)
let inviteInput, suggestions, btnInvite;

// MAIN
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    currentDocId = id;

    if (!id) {
        if (window.showToast) window.showToast(window.t("missing_id") || "ID mancante", "error");
        window.location.href = 'account_privati.html';
        return;
    }

    // --- PROTOCOLLO: INIEZIONE ROBUSTA (BULLETPROOF) ---
    function initBaseUI() {
        const hPlaceholder = document.getElementById('header-placeholder');
        if (!hPlaceholder) return;

        // Internal function to apply Header UI
        const applyHeader = () => {
            // 1. Ensure Header Structure if missing or empty
            const content = document.getElementById('header-content');
            if (!content) {
                hPlaceholder.innerHTML = `
                    <div id="header-content" class="header-balanced-container">
                        <div id="header-left" class="header-left"></div>
                        <div id="header-center" class="header-center"></div>
                        <div id="header-right" class="header-right"></div>
                    </div>
                `;
                hPlaceholder.setAttribute('data-base-init', 'true');
            }

            // 3. Inject Content ONLY if containers are empty
            const hLeft = document.getElementById('header-left');
            const hCenter = document.getElementById('header-center');
            const hRight = document.getElementById('header-right');

            if (hLeft && hLeft.innerHTML.trim() === '') {
                hLeft.innerHTML = `
                    <button id="btn-back-protocol" class="btn-icon-header">
                        <span class="material-symbols-outlined">arrow_back</span>
                    </button>
                `;
                document.getElementById('btn-back-protocol').addEventListener('click', () => history.back());
            }

            if (hCenter && hCenter.innerHTML.trim() === '') {
                const titleText = (window.t && window.t('edit_account')) || 'Modifica Account';
                hCenter.innerHTML = `<h1 class="header-title" id="header-title-page" data-t="edit_account">${titleText}</h1>`;
            }

            if (hRight && hRight.innerHTML.trim() === '') {
                hRight.innerHTML = `
                    <a href="home_page.html" class="btn-icon-header">
                        <span class="material-symbols-outlined">home</span>
                    </a>
                `;
            }
        };

        // Internal function to apply Footer Buttons
        const applyFooter = () => {
            const fCenter = document.getElementById('footer-center-actions');
            const fRight = document.getElementById('footer-right-actions');

            // CENTER: Delete Button
            if (fCenter && !document.getElementById('delete-btn')) {
                const btnDel = document.createElement('button');
                btnDel.id = 'delete-btn';
                btnDel.className = 'btn-icon-header';
                btnDel.title = (window.t && window.t('delete_account')) || 'Elimina Account';
                btnDel.style.color = '#ef4444';
                btnDel.style.borderColor = 'rgba(239, 68, 68, 0.3)';
                btnDel.innerHTML = '<span class="material-symbols-outlined">delete</span>';
                btnDel.addEventListener('click', deleteAccount);
                fCenter.appendChild(btnDel);
            }

            // RIGHT: Save Button
            if (fRight && !document.getElementById('save-btn')) {
                const btnSave = document.createElement('button');
                btnSave.id = 'save-btn';
                btnSave.className = 'btn-icon-header';
                btnSave.title = (window.t && window.t('save_changes')) || 'Salva Modifiche';
                btnSave.style.backgroundColor = 'rgba(59, 130, 246, 0.1)';
                btnSave.style.color = '#3b82f6';
                btnSave.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                btnSave.innerHTML = '<span class="material-symbols-outlined">save</span>';
                btnSave.addEventListener('click', saveChanges);

                // Prepend to be on the left of settings
                fRight.prepend(btnSave);
            }
        };

        // Run immediately
        applyHeader();
        applyFooter();

        // RETRY LOOP: Check every 100ms for 3 seconds
        let attempts = 0;
        const interval = setInterval(() => {
            const hLeft = document.getElementById('header-left');
            // Re-apply Header
            if (!hLeft || hLeft.innerHTML.trim() === '') {
                applyHeader();
            }

            // Re-apply Footer (both Save and Delete)
            if (!document.getElementById('save-btn') || !document.getElementById('delete-btn')) {
                applyFooter();
            }

            attempts++;
            if (attempts > 30) clearInterval(interval);
        }, 100);
    }

    initBaseUI();

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUid = user.uid;
            loadData(currentDocId);
            loadRubrica(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    setupUI();
    setupImageUploader();

    // Trigger per logo-input
    const btnLogo = document.getElementById('btn-trigger-logo');
    if (btnLogo) btnLogo.addEventListener('click', () => document.getElementById('logo-input').click());

    // Main Password Toggle
    const btnToggle = document.getElementById('btn-toggle-password-edit');
    const passInput = document.getElementById('account-password');
    if (btnToggle && passInput) {
        btnToggle.addEventListener('click', () => {
            const isPassword = passInput.type === 'password';
            passInput.type = isPassword ? 'text' : 'password';

            // Toggle shield class for extra effect
            if (isPassword) {
                passInput.classList.remove('base-shield');
            } else {
                passInput.classList.add('base-shield');
            }

            btnToggle.querySelector('span').textContent = isPassword ? 'visibility_off' : 'visibility';
        });
    }
});

// FUNCTIONS
async function loadData(id) {
    try {
        const docRef = doc(db, "users", currentUid, "accounts", id);
        let snap = await getDoc(docRef);

        if (!snap.exists()) {
            // Fallback: search by 'id' field if not document ID (legacy support)
            const q = query(collection(db, "users", currentUid, "accounts"), where("id", "==", id));
            const querySnap = await getDocs(q);
            if (querySnap.empty) {
                if (window.showToast) window.showToast(window.t("account_not_found") || "Account non trovato", "error");
                window.location.href = 'account_privati.html';
                return;
            }
            snap = querySnap.docs[0];
            currentDocId = snap.id; // Correct ID
        } else {
            currentDocId = snap.id;
        }

        const data = snap.data();
        accountData = data;

        // Populate Fields
        document.getElementById('account-name').value = data.nomeAccount || '';
        document.getElementById('account-username').value = data.username || '';
        document.getElementById('account-code').value = data.account || data.codice || ''; // handle variations
        document.getElementById('account-password').value = data.password || '';
        document.getElementById('account-url').value = data.url || data.sitoWeb || '';
        document.getElementById('account-note').value = data.note || '';

        // Banking Data (Support legacy object or new array)
        if (data.banking) {
            if (Array.isArray(data.banking)) {
                bankAccounts = data.banking;
            } else if (typeof data.banking === 'object' && data.banking.iban) {
                // Migrate legacy
                bankAccounts = [{
                    iban: data.banking.iban,
                    passwordDispositiva: data.banking.passwordDispositiva || '',
                    nota: data.banking.nota || '',
                    referenteNome: data.banking.referenteNome || '',
                    referenteCognome: data.banking.referenteCognome || '',
                    referenteTelefono: data.banking.referenteTelefono || '',
                    referenteCellulare: data.banking.referenteCellulare || '',
                    cards: [{
                        type: data.banking.type || 'Credit',
                        titolare: data.banking.titolare || '',
                        cardType: data.banking.cardType || '',
                        cardNumber: data.banking.cardNumber || '',
                        expiry: data.banking.expiry || '',
                        ccv: data.banking.ccv || '',
                        pin: data.banking.pin || '',
                        note: data.banking.note || ''
                    }]
                }];
            }
        }
        if (bankAccounts.length === 0) {
            bankAccounts = [{ iban: '', cards: [] }];
        }
        renderBankAccounts();

        const ref = data.referente || {};
        document.getElementById('ref-name').value = ref.nome || data.nome_cognome_referente || data.referenteNome || '';
        document.getElementById('ref-phone').value = ref.telefono || data.telefono_referente || data.referenteTelefono || '';
        document.getElementById('ref-mobile').value = ref.cellulare || data.cellulare_referente || data.cellulare || '';

        // Flags
        document.getElementById('flag-shared').checked = !!data.shared;
        document.getElementById('flag-memo').checked = !!data.hasMemo;
        document.getElementById('flag-memo-shared').checked = !!data.isMemoShared;

        // UI States
        toggleSharingUI(data.shared || data.isMemoShared);
        if (data.sharedWith) {
            renderGuests(data.sharedWith);
        }

        // Logo
        if (data.logo || data.avatar) {
            const img = document.getElementById('account-logo-preview');
            const placeholder = document.getElementById('logo-placeholder');
            img.src = data.logo || data.avatar;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
        }

        document.getElementById('loading-overlay').classList.add('hidden');

    } catch (e) {
        console.error("Error loading account:", e);
        if (window.showToast) window.showToast((window.t("error_loading") || "Errore caricamento dati: ") + e.message, "error");
    } finally {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) overlay.classList.add('hidden');
    }
}

async function loadRubrica(uid) {
    try {
        const snap = await getDocs(collection(db, "users", uid, "contacts"));
        myContacts = snap.docs.map(d => d.data());
    } catch (e) { console.error(e); }
}

function setupUI() {
    inviteInput = document.getElementById('invite-email');
    suggestions = document.getElementById('rubrica-suggestions');
    btnInvite = document.getElementById('btn-send-invite');
    // Flags
    const flagShared = document.getElementById('flag-shared');
    const flagMemo = document.getElementById('flag-memo');
    const flagMemoShared = document.getElementById('flag-memo-shared');

    if (flagShared && flagMemo && flagMemoShared) {
        const flags = [flagShared, flagMemo, flagMemoShared];
        flags.forEach(el => {
            el.addEventListener('change', () => {
                if (el.checked) {
                    flags.forEach(other => { if (other !== el) other.checked = false; });
                }
                toggleSharingUI(flagShared.checked || flagMemoShared.checked);
            });
        });
    }

    // Banking UI Logic
    const btnAddIban = document.getElementById('btn-add-iban');
    if (btnAddIban) {
        btnAddIban.addEventListener('click', () => {
            bankAccounts.push({
                iban: '',
                cards: [],
                passwordDispositiva: '',
                nota: '',
                referenteNome: '',
                referenteCognome: '',
                referenteTelefono: '',
                referenteCellulare: ''
            });
            renderBankAccounts();
        });
    }

    // Invites Autocomplete
    if (inviteInput && suggestions) {
        inviteInput.addEventListener('input', () => {
            const val = inviteInput.value.toLowerCase();
            if (!val) { suggestions.classList.add('hidden'); return; }
            const filtered = myContacts.filter(c => (c.nome || '').toLowerCase().includes(val) || (c.email || '').toLowerCase().includes(val));
            if (filtered.length === 0) { suggestions.classList.add('hidden'); return; }
            suggestions.classList.remove('hidden');
            suggestions.innerHTML = filtered.map(c => `
                <div class="p-3 hover:bg-primary/5 cursor-pointer border-b border-gray-100 dark:border-gray-800" data-email="${c.email}">
                    <p class="text-xs font-bold pointer-events-none">${c.nome} ${c.cognome}</p>
                    <p class="text-[10px] text-gray-400 pointer-events-none">${c.email}</p>
                </div>
            `).join('');

            suggestions.querySelectorAll('div').forEach(div => {
                div.addEventListener('click', () => {
                    inviteInput.value = div.dataset.email;
                    suggestions.classList.add('hidden');
                });
            });
        });
    }

    // Send Invite Button
    if (btnInvite) {
        btnInvite.addEventListener('click', sendInvite);
    }

    // AUTOFILL PROTECTION HANDLERS
    const protectedFields = ['account-username', 'account-password', 'account-code'];
    protectedFields.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('click', () => {
                if (el.hasAttribute('readonly')) el.removeAttribute('readonly');
            });
            el.addEventListener('focus', () => {
                if (el.hasAttribute('readonly')) el.removeAttribute('readonly');
            });
            // Restore readonly on blur to protect again? Maybe too aggressive.
            // Let's keep it editable once unlocked for UX connectivity.
        }
    });
}

function toggleSharingUI(show) {
    const mgmt = document.getElementById('shared-management');
    if (mgmt) mgmt.classList.toggle('hidden', !show);
}

function setupImageUploader() {
    const input = document.getElementById('logo-input');
    if (!input) return;

    input.addEventListener('change', (e) => {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = function () {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const size = 200;
                    canvas.width = size;
                    canvas.height = size;

                    const min = Math.min(img.width, img.height);
                    const sx = (img.width - min) / 2;
                    const sy = (img.height - min) / 2;

                    ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);

                    const resizedData = canvas.toDataURL('image/jpeg', 0.8);
                    const preview = document.getElementById('account-logo-preview');
                    const placeholder = document.getElementById('logo-placeholder');
                    if (preview && placeholder) {
                        preview.src = resizedData;
                        preview.classList.remove('hidden');
                        placeholder.classList.add('hidden');
                    }
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    });
}

async function renderGuests(listItems) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    list.innerHTML = '';

    if (!listItems || listItems.length === 0) {
        list.innerHTML = `<p class="text-xs text-white/40 italic ml-1">${window.t('no_active_access') || 'Nessun accesso attivo.'}</p>`;
        return;
    }

    listItems.forEach(item => {
        let displayName = 'Account';
        let displayEmail = '';
        let statusLabel = 'Condiviso';
        let guestEmail = '';

        if (typeof item === 'object') {
            displayEmail = item.email;
            displayName = item.email.split('@')[0];
            statusLabel = (item.status === 'accepted') ? 'Condiviso' : (item.status === 'rejected' ? 'Rifiutato' : 'In attesa');
            guestEmail = item.email;
        } else {
            // Legacy UID support
            displayEmail = item;
            displayName = 'Utente UID';
            guestEmail = item;
        }

        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 shadow-sm";
        div.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                    <span class="material-symbols-outlined text-sm">person</span>
                </div>
                <div class="min-w-0">
                    <p class="text-xs font-bold truncate text-slate-900">${displayName}</p>
                    <p class="text-[10px] text-gray-400 truncate">${displayEmail} <span class="ml-1 px-1.5 py-0.5 bg-gray-100 rounded text-[9px] font-bold uppercase">${statusLabel}</span></p>
                </div>
            </div>
            <button type="button" class="text-red-400 hover:text-red-600 transition-colors shrink-0" data-email="${guestEmail}">
                <span class="material-symbols-outlined text-base">remove_circle</span>
            </button>
        `;

        const removeBtn = div.querySelector('button');
        if (removeBtn) {
            removeBtn.addEventListener('click', () => handleRevoke(guestEmail));
        }
        list.appendChild(div);
    });
}

async function handleRevoke(guestEmail) {
    const confirmed = await window.showConfirmModal(
        window.t('revoke_access_title') || "REVOCA ACCESSO",
        (window.t('revoke_access_confirm_to') || "Vuoi revocare definitivamente l'accesso a ") + guestEmail + "?",
        window.t('revoke') || "REVOCA",
        window.t('cancel') || "ANNULLA"
    );
    if (!confirmed) return;
    try {
        const accountRef = doc(db, "users", currentUid, "accounts", currentDocId);
        const snap = await getDoc(accountRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.sharedWith && Array.isArray(data.sharedWith)) {
                const newInfo = data.sharedWith.filter(item => {
                    if (typeof item === 'object') return item.email !== guestEmail;
                    return item !== guestEmail;
                });

                await updateDoc(accountRef, { sharedWith: newInfo });

                // Also delete invitations
                const qInv = query(collection(db, "invites"),
                    where("accountId", "==", currentDocId),
                    where("recipientEmail", "==", guestEmail)
                );
                const snapInv = await getDocs(qInv);
                snapInv.forEach(async d => await deleteDoc(d.ref));

                if (window.showToast) window.showToast(window.t("access_revoked") || "Accesso revocato.", "success");
                loadData(currentDocId); // Refresh UI
            }
        }
    } catch (e) {
        console.error("Revoke error:", e);
        if (window.showToast) window.showToast((window.t("revoke_error") || "Errore durante la revoca: ") + e.message, "error");
    }
}

async function sendInvite() {
    const email = inviteInput.value.trim();
    if (!email) return;
    btnInvite.disabled = true;

    try {
        await addDoc(collection(db, "invites"), {
            accountId: currentDocId,
            accountName: accountData.nomeAccount,
            ownerId: currentUid,
            ownerEmail: auth.currentUser.email,
            recipientEmail: email,
            status: 'pending',
            type: 'privato',
            createdAt: new Date().toISOString()
        });
        if (window.showToast) window.showToast(window.t("invite_sent") || "Invito inviato!", "success");
        inviteInput.value = '';
    } catch (e) {
        if (window.showToast) window.showToast(e.message, "error");
    } finally {
        btnInvite.disabled = false;
    }
}

async function saveChanges() {
    const btn = document.getElementById('save-btn');
    if (!btn) return;
    const icon = btn.querySelector('span');

    btn.disabled = true;
    const originalIcon = icon.textContent;
    icon.textContent = "progress_activity";
    icon.classList.add('animate-spin');

    try {
        const img = document.getElementById('account-logo-preview');
        const logoData = (!img.classList.contains('hidden') && img.src) ? img.src : null;

        const updateObj = {
            nomeAccount: document.getElementById('account-name').value,
            username: document.getElementById('account-username').value,
            codice: document.getElementById('account-code').value,
            account: document.getElementById('account-code').value,
            password: document.getElementById('account-password').value,
            url: document.getElementById('account-url').value,
            banking: bankAccounts.filter(b => b.iban.length > 5),
            note: document.getElementById('account-note').value,
            referente: {
                nome: document.getElementById('ref-name').value,
                telefono: document.getElementById('ref-phone').value,
                cellulare: document.getElementById('ref-mobile').value
            },
            logo: logoData,
            shared: document.getElementById('flag-shared').checked,
            hasMemo: document.getElementById('flag-memo').checked,
            isMemoShared: document.getElementById('flag-memo-shared').checked,
            updatedAt: new Date().toISOString()
        };

        if (!updateObj.nomeAccount) throw new Error(window.t("account_name_required") || "Nome Account è obbligatorio");

        await updateDoc(doc(db, "users", currentUid, "accounts", currentDocId), updateObj);

        icon.textContent = "check_circle";
        icon.classList.remove('animate-spin');

        setTimeout(() => {
            window.location.href = `dettaglio_account_privato.html?id=${currentDocId}`;
        }, 500);

    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast((window.t("save_error") || "Errore salvataggio: ") + e.message, "error");
        btn.disabled = false;
        icon.textContent = originalIcon;
        icon.classList.remove('animate-spin');
    }
}

async function deleteAccount() {
    const confirmed = await window.showConfirmModal(
        "ELIMINAZIONE ACCOUNT",
        "Sei sicuro di voler ELIMINARE definitivamente questo account? L'operazione non è reversibile.",
        "ELIMINA",
        "ANNULLA"
    );
    if (!confirmed) return;

    const btn = document.getElementById('delete-btn');
    if (!btn) return;
    const icon = btn.querySelector('span');
    const originalIcon = icon.textContent;

    btn.disabled = true;
    icon.textContent = "progress_activity";
    icon.classList.add('animate-spin');

    try {
        await deleteDoc(doc(db, "users", currentUid, "accounts", currentDocId));
        if (window.showToast) window.showToast(window.t("account_deleted") || "Account eliminato correttamente.", "success");
        window.location.href = 'account_privati.html';
    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast((window.t("delete_error") || "Errore eliminazione: ") + e.message, "error");
        btn.disabled = false;
        icon.textContent = originalIcon;
        icon.classList.remove('animate-spin');
    }
}

// Global Exports for inline calls if any (though replaced with listeners)
window.toggleAccessi = () => {
    const content = document.getElementById('accessi-content');
    const chevron = document.getElementById('accessi-chevron');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
};

// --- BANKING FUNCTIONS ---
function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    container.innerHTML = '';

    bankAccounts.forEach((account, ibanIdx) => {
        const ibanDiv = document.createElement('div');
        ibanDiv.className = "bg-slate-500/5 backdrop-blur-sm p-5 rounded-[2rem] border border-white/5 relative animate-in fade-in slide-in-from-top-4 duration-500 space-y-5 border-glow";

        ibanDiv.innerHTML = `
            <div class="flex items-center justify-between px-2">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-[var(--accent-blue)]" style="font-size: 20px;">account_balance</span>
                    <span class="text-[10px] font-900 text-white/40 uppercase tracking-[0.2em]">Conto Protocollo #${ibanIdx + 1}</span>
                </div>
                ${bankAccounts.length > 1 ? `
                    <button type="button" class="btn-icon-header btn-remove-iban" style="width: 32px; height: 32px; color: var(--accent-red); border-color: rgba(155, 28, 28, 0.2);" data-idx="${ibanIdx}">
                        <span class="material-symbols-outlined" style="font-size: 18px;">delete</span>
                    </button>
                ` : ''}
            </div>
            
            <div class="glass-field-container">
                <label class="view-label" data-t="finance_iban">IBAN</label>
                <div class="glass-field border-glow">
                    <span class="material-symbols-outlined" style="margin-left: 1rem; color: var(--text-secondary); opacity: 0.4;">account_balance</span>
                    <input type="text" class="iban-input" 
                        data-iban-idx="${ibanIdx}" value="${account.iban}" placeholder="IT00..." 
                        style="font-family: monospace; font-weight: bold; text-transform: uppercase; color: var(--text-primary);" />
                </div>
            </div>

            <div class="dashboard-grid-2" style="gap: 1.5rem;">
                <div class="glass-field-container">
                    <label class="view-label" data-t="dispositive_password">Pass. Dispositiva</label>
                    <div class="glass-field border-glow">
                        <span class="material-symbols-outlined" style="margin-left: 1rem; color: var(--text-secondary); opacity: 0.4;">lock</span>
                        <input type="text" class="dispositiva-input base-shield" 
                            data-iban-idx="${ibanIdx}" value="${account.passwordDispositiva || ''}" 
                            style="font-family: monospace;" />
                        <button type="button" class="glass-field-btn btn-toggle-shield">
                            <span class="material-symbols-outlined" style="font-size: 18px;">visibility</span>
                        </button>
                    </div>
                </div>
                <div class="glass-field-container">
                    <label class="view-label" data-t="iban_notes">Nota IBAN</label>
                    <div class="glass-field border-glow">
                        <textarea class="iban-nota-input w-full bg-transparent border-none px-4 py-2.5 text-sm focus:ring-0 resize-none text-white/80" 
                            data-iban-idx="${ibanIdx}" rows="1" placeholder="Note per questo IBAN...">${account.nota || ''}</textarea>
                    </div>
                </div>
            </div>

            <!-- SEZIONE REFERENTE BANCA -->
            <div class="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-4">
                <div class="flex items-center gap-2 text-white/40">
                    <span class="material-symbols-outlined" style="font-size: 18px;">contact_phone</span>
                    <span class="text-[9px] font-900 uppercase tracking-widest" data-t="bank_referent">Referente di Filiale</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="glass-field-container">
                        <label class="view-label" data-t="first_name">Nome</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="ref-nome-input" data-iban-idx="${ibanIdx}" value="${account.referenteNome || ''}" />
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label" data-t="last_name">Cognome</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="ref-cognome-input" data-iban-idx="${ibanIdx}" value="${account.referenteCognome || ''}" />
                        </div>
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="glass-field-container">
                        <label class="view-label" data-t="phone">Telefono</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="ref-tel-input" data-iban-idx="${ibanIdx}" value="${account.referenteTelefono || ''}" />
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label" data-t="mobile">Cellulare</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="ref-cell-input" data-iban-idx="${ibanIdx}" value="${account.referenteCellulare || ''}" />
                        </div>
                    </div>
                </div>
            </div>

            <div class="space-y-4 pl-4 border-l border-white/10 py-1">
                <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                         <span class="material-symbols-outlined text-[var(--accent-purple)]" style="font-size: 18px;">credit_card</span>
                         <span class="text-[9px] font-900 text-white/40 uppercase tracking-widest" data-t="linked_instruments">Strumenti di Pagamento</span>
                    </div>
                    <button type="button" class="btn-icon-header btn-add-card-edit" style="width: 32px; height: 32px; color: var(--accent-blue); border-color: rgba(33, 150, 243, 0.2);" data-idx="${ibanIdx}">
                        <span class="material-symbols-outlined" style="font-size: 18px;">add</span>
                    </button>
                </div>
                <div class="card-list-container space-y-4">
                    ${account.cards.map((card, cardIdx) => renderCardEntry(ibanIdx, cardIdx, card)).join('')}
                </div>
            </div>
        `;
        container.appendChild(ibanDiv);
    });

    // Attach local listeners
    container.querySelectorAll('.iban-input').forEach(input => {
        input.addEventListener('input', (e) => bankAccounts[e.target.dataset.ibanIdx].iban = e.target.value.trim().toUpperCase());
    });
    container.querySelectorAll('.btn-remove-iban').forEach(btn => {
        btn.addEventListener('click', (e) => removeIban(parseInt(btn.dataset.idx)));
    });
    container.querySelectorAll('.btn-add-card-edit').forEach(btn => {
        btn.addEventListener('click', (e) => addCard(parseInt(btn.dataset.idx)));
    });
    container.querySelectorAll('.btn-remove-card-edit').forEach(btn => {
        btn.addEventListener('click', (e) => removeCard(parseInt(btn.dataset.iban), parseInt(btn.dataset.card)));
    });
    container.querySelectorAll('.btn-toggle-shield').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            input.classList.toggle('base-shield');
            btn.querySelector('span').textContent = input.classList.contains('base-shield') ? 'visibility' : 'visibility_off';
        });
    });
    container.querySelectorAll('.btn-toggle-shield-card').forEach(btn => {
        btn.addEventListener('click', () => {
            const input = btn.previousElementSibling;
            input.classList.toggle('base-shield');
            btn.querySelector('span').textContent = input.classList.contains('base-shield') ? 'visibility' : 'visibility_off';
        });
    });
}

function renderCardEntry(ibanIdx, cardIdx, card) {
    return `
        <div class="bg-white/5 p-5 rounded-[1.5rem] border border-white/5 space-y-4 relative border-glow">
             <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-white/40" style="font-size: 18px;">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                    <span class="text-[9px] font-900 text-white/40 uppercase tracking-wider">Strumento #${cardIdx + 1}</span>
                </div>
                <button type="button" class="btn-icon-header btn-remove-card-edit" style="width: 28px; height: 28px; color: var(--accent-red); border-color: transparent;" data-iban="${ibanIdx}" data-card="${cardIdx}">
                    <span class="material-symbols-outlined" style="font-size: 16px;">close</span>
                </button>
            </div>

            <div class="space-y-4">
                <div class="glass-field-container">
                    <label class="view-label" data-t="instrument_type">Tipo Strumento</label>
                    <div class="glass-field border-glow" style="height: 3rem; background: rgba(0,0,0,0.2) !important;">
                        <select class="type-input w-full bg-transparent border-none px-4 text-sm text-white font-bold h-full focus:ring-0" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}">
                            <option value="Credit" ${card.type === 'Credit' ? 'selected' : ''} class="bg-slate-900">Carta di Credito</option>
                            <option value="Debit" ${card.type === 'Debit' ? 'selected' : ''} class="bg-slate-900">Bancomat / Debit</option>
                        </select>
                    </div>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="glass-field-container">
                        <label class="view-label" data-t="holder">Titolare</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="titolare-input" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.titolare || ''}" />
                        </div>
                    </div>
                    <div class="glass-field-container ${card.type === 'Debit' ? 'hidden' : ''}">
                        <label class="view-label" data-t="card_brand">Circuito</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="cardtype-input" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardType || ''}" placeholder="Visa, MC..." />
                        </div>
                    </div>
                </div>

                <div class="glass-field-container">
                    <label class="view-label" data-t="card_number">Numero Carta</label>
                    <div class="glass-field border-glow" style="height: 3.5rem;">
                         <span class="material-symbols-outlined" style="margin-left: 1rem; color: var(--text-secondary); opacity: 0.4;">pin</span>
                        <input type="text" class="number-input" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardNumber || ''}" placeholder="**** **** **** ****" 
                            style="font-family: monospace; font-weight: bold; font-size: 1rem; color: var(--text-primary);" />
                    </div>
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div class="glass-field-container">
                        <label class="view-label" data-t="expiry">Scadenza</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="expiry-input" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.expiry || ''}" placeholder="MM/AA" style="text-align: center;" />
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label" data-t="cvv">CVV</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="ccv-input" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.ccv || ''}" placeholder="000" style="text-align: center;" />
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label" data-t="pin">PIN</label>
                        <div class="glass-field border-glow" style="height: 3rem;">
                            <input type="text" class="pin-input base-shield" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.pin || ''}" style="text-align: center; font-family: monospace;" />
                            <button type="button" class="glass-field-btn btn-toggle-shield-card">
                                <span class="material-symbols-outlined" style="font-size: 16px;">visibility</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="glass-field-container">
                    <label class="view-label" data-t="notes">Note Strumento</label>
                    <div class="glass-field border-glow" style="height: auto;">
                        <textarea class="note-input w-full bg-transparent border-none p-3 text-sm text-white/80 focus:ring-0 resize-none" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" rows="2" placeholder="Note sulla carta...">${card.note || ''}</textarea>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Global actions
window.addCard = (ibanIdx) => {
    bankAccounts[ibanIdx].cards.push({ type: 'Credit', titolare: '', cardType: '', cardNumber: '', expiry: '', ccv: '', pin: '', note: '' });
    renderBankAccounts();
};

window.removeCard = (ibanIdx, cardIdx) => {
    bankAccounts[ibanIdx].cards.splice(cardIdx, 1);
    renderBankAccounts();
};

window.removeIban = async (ibanIdx) => {
    const confirmed = await window.showConfirmModal(
        "ELIMINA IBAN",
        "Eliminare interamente questo IBAN e tutte le carte collegate?",
        "ELIMINA",
        "ANNULLA"
    );
    if (confirmed) {
        bankAccounts.splice(ibanIdx, 1);
        renderBankAccounts();
    }
};

document.addEventListener('input', (e) => {
    const el = e.target;
    const ibanIdx = el.dataset.ibanIdx;

    if (ibanIdx !== undefined) {
        const account = bankAccounts[ibanIdx];

        if (el.dataset.cardIdx !== undefined) {
            const card = account.cards[el.dataset.cardIdx];
            if (el.classList.contains('type-input')) {
                card.type = el.value;
                renderBankAccounts();
            }
            else if (el.classList.contains('titolare-input')) card.titolare = el.value;
            else if (el.classList.contains('cardtype-input')) card.cardType = el.value;
            else if (el.classList.contains('expiry-input')) {
                let val = el.value.replace(/\D/g, '');
                if (val.length > 4) val = val.substring(0, 4);
                if (val.length > 2) {
                    val = val.substring(0, 2) + '/' + val.substring(2);
                }
                el.value = val;
                card.expiry = val;
            }
            else if (el.classList.contains('ccv-input')) card.ccv = el.value;
            else if (el.classList.contains('pin-input')) card.pin = el.value;
            else if (el.classList.contains('note-input')) card.note = el.value;
        } else {
            // IBAN Level Fields
            if (el.classList.contains('iban-input')) account.iban = el.value.trim().toUpperCase();
            else if (el.classList.contains('dispositiva-input')) account.passwordDispositiva = el.value;
            else if (el.classList.contains('ref-nome-input')) account.referenteNome = el.value;
            else if (el.classList.contains('ref-cognome-input')) account.referenteCognome = el.value;
            else if (el.classList.contains('ref-tel-input')) account.referenteTelefono = el.value;
            else if (el.classList.contains('ref-cell-input')) account.referenteCellulare = el.value;
            else if (el.classList.contains('iban-nota-input')) account.nota = el.value;
        }
    }
});
