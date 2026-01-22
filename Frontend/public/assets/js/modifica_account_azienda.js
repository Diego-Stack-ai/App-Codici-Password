import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp, collection, addDoc, getDocs, query, where } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- STATE ---
let currentUid = null;
let currentAziendaId = null;
let currentAccountId = null;
let accountData = {};
let myContacts = [];
let bankAccounts = []; // { iban: '', cards: [] }
let inviteInput, suggestions, btnInvite;

// --- THEME LOGIC ---
const companyPalettes = [
    { from: '#10b981', to: '#047857', name: 'Green' },   // Green
    { from: '#3b82f6', to: '#1d4ed8', name: 'Blue' },    // Blue
    { from: '#8b5cf6', to: '#6d28d9', name: 'Purple' },  // Purple
    { from: '#f59e0b', to: '#b45309', name: 'Orange' },  // Orange
    { from: '#ec4899', to: '#be185d', name: 'Pink' },    // Pink
    { from: '#ef4444', to: '#b91c1c', name: 'Red' },     // Red
    { from: '#06b6d4', to: '#0e7490', name: 'Cyan' },    // Cyan
    { from: '#6366f1', to: '#4338ca', name: 'Indigo' },  // Indigo
    { from: '#84cc16', to: '#4d7c0f', name: 'Lime' },    // Lime
    { from: '#14b8a6', to: '#0f766e', name: 'Teal' },    // Teal
];

function getCompanyColor(companyName, colorIndex) {
    // 1. Prefer Stored Index
    if (typeof colorIndex === 'number' && companyPalettes[colorIndex]) {
        return companyPalettes[colorIndex];
    }
    // 2. Fallback
    if (!companyName) return companyPalettes[0];
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % companyPalettes.length;
    return companyPalettes[index];
}

function applyTheme(companyName, colorIndex) {
    const theme = getCompanyColor(companyName, colorIndex);
    document.documentElement.style.setProperty('--primary-color', theme.from);

    // Update Save Button Gradient - REMOVED for Minimal Header Icon Style
    /*
    const btnSave = document.getElementById('btn-save');
    if (btnSave) {
        btnSave.style.background = `linear-gradient(to right, ${theme.from}, ${theme.to})`;
        btnSave.style.boxShadow = `0 10px 15px -3px ${theme.from}4d`; // 30% opacity
    }
    */
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    let bgClass = 'bg-gray-800 text-white';
    if (type === 'error') bgClass = 'bg-red-500 text-white';
    if (type === 'success') bgClass = 'bg-green-500 text-white';
    toast.className = `${bgClass} px-4 py-2 rounded-lg shadow-lg text-sm font-medium transition-all duration-300 transform translate-y-full opacity-0 pointer-events-auto`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.remove('translate-y-full', 'opacity-0'));
    setTimeout(() => {
        toast.classList.add('translate-y-full', 'opacity-0');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Expose copyToClipboard
window.copyToClipboard = function (elementId) {
    const el = document.getElementById(elementId);
    if (el && el.value) {
        navigator.clipboard.writeText(el.value).then(() => showToast("Copiato!", "success"));
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const aziendaId = urlParams.get('aziendaId');
    const accountId = urlParams.get('id');
    currentAziendaId = aziendaId;
    currentAccountId = accountId;

    document.getElementById('btn-back').onclick = () => {
        if (aziendaId) window.location.href = `dettaglio_account_azienda.html?id=${accountId}&aziendaId=${aziendaId}`;
        else history.back();
    };

    if (!aziendaId || !accountId) {
        showToast("Parametri mancanti", 'error');
        setTimeout(() => window.location.href = 'lista_aziende.html', 1500);
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUid = user.uid;
            loadAccount(user.uid, aziendaId, accountId);
            loadRubrica(user.uid);
            setupImageUploader();
            setupUI();

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
        } else {
            window.location.href = 'index.html';
        }
    });
});

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

    // Flags mutual exclusivity (matching private)
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
                div.onclick = () => {
                    inviteInput.value = div.dataset.email;
                    suggestions.classList.add('hidden');
                };
            });
        });
    }

    // Send Invite Button
    if (btnInvite) {
        btnInvite.onclick = sendInvite;
    }
}

function toggleSharingUI(show) {
    const mgmt = document.getElementById('shared-management');
    if (mgmt) mgmt.classList.toggle('hidden', !show);
}

async function loadAccount(uid, aziendaId, accountId) {
    try {
        // 1. Load Company for Theme
        const companyDocRef = doc(db, "users", uid, "aziende", aziendaId);
        const companyDoc = await getDoc(companyDocRef);
        if (companyDoc.exists()) {
            const cData = companyDoc.data();
            if (cData.ragioneSociale || typeof cData.colorIndex === 'number') {
                applyTheme(cData.ragioneSociale, cData.colorIndex);
            }
        }

        // 2. Load Account
        const docRef = doc(db, "users", uid, "aziende", aziendaId, "accounts", accountId);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            showToast("Account non trovato", "error");
            return;
        }
        const d = docSnap.data();

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };
        set('nome-account', d.nomeAccount);
        set('sito-web', d.sitoWeb);
        set('codice-societa', d.codiceSocieta);
        set('numero-iscrizione', d.numeroIscrizione);

        set('utente', d.utente);
        set('account', d.account);
        set('password', d.password);

        set('referente-nome', d.referenteNome);
        set('referente-telefono', d.referenteTelefono);
        set('referente-cellulare', d.referenteCellulare);

        set('note', d.note || d.nota);

        // Banking Data (Support legacy object or new array)
        if (d.banking) {
            if (Array.isArray(d.banking)) {
                bankAccounts = d.banking;
            } else if (typeof d.banking === 'object' && d.banking.iban) {
                // Migrate legacy
                bankAccounts = [{
                    iban: d.banking.iban,
                    passwordDispositiva: d.banking.passwordDispositiva || '',
                    nota: d.banking.nota || '',
                    referenteNome: d.banking.referenteNome || '',
                    referenteCognome: d.banking.referenteCognome || '',
                    referenteTelefono: d.banking.referenteTelefono || '',
                    referenteCellulare: d.banking.referenteCellulare || '',
                    cards: [{
                        type: d.banking.type || 'Credit',
                        titolare: d.banking.titolare || '',
                        cardType: d.banking.cardType || '',
                        cardNumber: d.banking.cardNumber || '',
                        expiry: d.banking.expiry || '',
                        ccv: d.banking.ccv || '',
                        pin: d.banking.pin || '',
                        note: d.banking.note || ''
                    }]
                }];
            }
        }
        if (bankAccounts.length === 0) {
            bankAccounts = [{ iban: '', cards: [] }];
        }
        renderBankAccounts();

        accountData = d;

        // Flags
        if (document.getElementById('flag-shared')) document.getElementById('flag-shared').checked = !!d.shared;
        if (document.getElementById('flag-memo')) document.getElementById('flag-memo').checked = !!d.hasMemo;
        if (document.getElementById('flag-memo-shared')) document.getElementById('flag-memo-shared').checked = !!d.isMemoShared;

        // UI States
        toggleSharingUI(d.shared || d.isMemoShared);
        if (d.sharedWith) {
            renderGuests(d.sharedWith);
        }

        // Logo
        if (d.logo || d.avatar) {
            const imgPreview = document.getElementById('account-logo-preview');
            const placeholder = document.getElementById('logo-placeholder');
            if (imgPreview && placeholder) {
                imgPreview.src = d.logo || d.avatar;
                imgPreview.classList.remove('hidden');
                placeholder.classList.add('hidden');
            }
        }

        setupButtons(uid, aziendaId, accountId);

    } catch (e) {
        console.error(e);
        showToast("Errore caricamento: " + e.message, "error");
    }
}

function setupButtons(uid, aziendaId, accountId) {
    const btnSave = document.getElementById('btn-save');
    const btnDelete = document.getElementById('btn-delete');

    if (btnSave) {
        btnSave.onclick = async function () {
            if (!auth.currentUser) return;

            const nome = document.getElementById('nome-account').value.trim();
            if (!nome) return showToast("Inserisci Nome Account", "error");

            const data = {
                nomeAccount: nome,
                sitoWeb: document.getElementById('sito-web').value.trim(),
                codiceSocieta: document.getElementById('codice-societa').value.trim(),
                numeroIscrizione: document.getElementById('numero-iscrizione').value.trim(),
                utente: document.getElementById('utente').value.trim(),
                account: document.getElementById('account').value.trim(),
                password: document.getElementById('password').value.trim(),
                referenteNome: document.getElementById('referente-nome').value.trim(),
                referenteTelefono: document.getElementById('referente-telefono').value.trim(),
                referenteCellulare: document.getElementById('referente-cellulare').value.trim(),
                note: document.getElementById('note').value.trim(),
                logo: (!document.getElementById('account-logo-preview').classList.contains('hidden')) ? document.getElementById('account-logo-preview').src : null,
                shared: document.getElementById('flag-shared').checked,
                hasMemo: document.getElementById('flag-memo').checked,
                isMemoShared: document.getElementById('flag-memo-shared').checked,
                banking: bankAccounts.filter(b => b.iban.length > 5),
                updatedAt: serverTimestamp()
            };

            try {
                btnSave.disabled = true;
                btnSave.innerHTML = `<span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Salvataggio...`;

                const docRef = doc(db, "users", uid, "aziende", aziendaId, "accounts", accountId);
                await updateDoc(docRef, data);

                showToast("Modifiche salvate!", 'success');
                setTimeout(() => {
                    window.location.href = `dettaglio_account_azienda.html?id=${accountId}&aziendaId=${aziendaId}`;
                }, 1000);

            } catch (e) {
                console.error(e);
                showToast("Errore: " + e.message, 'error');
                btnSave.disabled = false;
                btnSave.innerText = "Salva Modifiche";
            }
        };
    }

    if (btnDelete) {
        btnDelete.onclick = async function () {
            if (!confirm("Sei sicuro di voler eliminare DEFINITIVAMENTE questo account?")) return;

            try {
                btnDelete.disabled = true;
                btnDelete.innerHTML = "Eliminazione...";

                const docRef = doc(db, "users", uid, "aziende", aziendaId, "accounts", accountId);
                await deleteDoc(docRef);

                showToast("Account eliminato.", 'success');
                setTimeout(() => {
                    window.location.href = `account_azienda.html?id=${aziendaId}`;
                }, 1000);
            } catch (e) {
                console.error(e);
                showToast("Errore: " + e.message, 'error');
                btnDelete.disabled = false;
                btnDelete.innerText = "Elimina Account";
            }
        };
    }
}

// INVITE FUNCTIONS
async function renderGuests(listItems) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    list.innerHTML = '';

    if (!listItems || listItems.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400 italic ml-1">Nessun accesso attivo.</p>';
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
            displayEmail = item;
            displayName = 'Utente';
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
            removeBtn.onclick = () => handleRevoke(guestEmail);
        }
        list.appendChild(div);
    });
}

async function handleRevoke(guestEmail) {
    if (!confirm(`Revocare l'accesso a ${guestEmail}?`)) return;
    try {
        const accountRef = doc(db, "users", currentUid, "aziende", currentAziendaId, "accounts", currentAccountId);
        const snap = await getDoc(accountRef);
        if (snap.exists()) {
            const data = snap.data();
            if (data.sharedWith && Array.isArray(data.sharedWith)) {
                const newInfo = data.sharedWith.filter(item => {
                    if (typeof item === 'object') return item.email !== guestEmail;
                    return item !== guestEmail;
                });

                await updateDoc(accountRef, { sharedWith: newInfo });

                // Delete invitations
                const qInv = query(collection(db, "invites"),
                    where("accountId", "==", currentAccountId),
                    where("recipientEmail", "==", guestEmail)
                );
                const snapInv = await getDocs(qInv);
                snapInv.forEach(async d => await deleteDoc(d.ref));

                showToast("Accesso revocato.", "success");
                loadAccount(currentUid, currentAziendaId, currentAccountId);
            }
        }
    } catch (e) {
        console.error("Revoke error:", e);
        showToast("Errore durante la revoca: " + e.message, "error");
    }
}

async function sendInvite() {
    const email = inviteInput.value.trim();
    if (!email) return;
    btnInvite.disabled = true;

    try {
        await addDoc(collection(db, "invites"), {
            accountId: currentAccountId,
            aziendaId: currentAziendaId, // Crucial for company accounts
            accountName: accountData.nomeAccount,
            ownerId: currentUid,
            ownerEmail: auth.currentUser.email,
            recipientEmail: email,
            status: 'pending',
            type: 'azienda',
            createdAt: new Date().toISOString()
        });
        showToast("Invito inviato!", "success");
        inviteInput.value = '';
    } catch (e) {
        showToast(e.message, "error");
    } finally {
        btnInvite.disabled = false;
    }
}

// --- BANKING FUNCTIONS ---
function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    container.innerHTML = '';

    bankAccounts.forEach((account, ibanIdx) => {
        const ibanDiv = document.createElement('div');
        ibanDiv.className = "bg-white/50 p-4 rounded-2xl border border-black/5 space-y-4 relative animate-in fade-in slide-in-from-top-4 duration-500";

        ibanDiv.innerHTML = `
            <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold text-primary uppercase tracking-widest">Conto #${ibanIdx + 1}</span>
                ${bankAccounts.length > 1 ? `
                    <button type="button" class="text-gray-400 hover:text-red-500 transition-colors" onclick="removeIban(${ibanIdx})">
                        <span class="material-symbols-outlined text-sm">delete</span>
                    </button>
                ` : ''}
            </div>
            
            <div class="flex flex-col gap-2">
                <label class="text-[#0A162A] text-xs font-bold uppercase tracking-wide opacity-50 pl-1">IBAN</label>
                <div class="flex w-full items-center rounded-xl border border-black/5 bg-white overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
                    <div class="pl-4 text-gray-400 flex items-center justify-center">
                        <span class="material-symbols-outlined">account_balance</span>
                    </div>
                    <input type="text" class="iban-input w-full bg-transparent border-none h-14 px-4 text-base text-[#0A162A] font-mono focus:ring-0 uppercase font-bold" 
                        data-iban-idx="${ibanIdx}" value="${account.iban}" placeholder="IT00..." />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Pass. Dispositiva</label>
                    <div class="flex items-center bg-white rounded-xl border border-black/5 overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                        <input type="password" class="dispositiva-input w-full bg-transparent border-none h-11 px-4 text-sm focus:ring-0" 
                            data-iban-idx="${ibanIdx}" value="${account.passwordDispositiva || ''}" placeholder="Password..." />
                        <button type="button" onclick="const i=this.previousElementSibling; i.type=i.type==='password'?'text':'password'; this.querySelector('span').textContent=i.type==='password'?'visibility':'visibility_off';" class="p-2 text-gray-400">
                            <span class="material-symbols-outlined text-sm">visibility</span>
                        </button>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Nota IBAN</label>
                    <textarea class="iban-nota-input w-full bg-white rounded-xl border border-black/5 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary/20 resize-none" 
                        data-iban-idx="${ibanIdx}" rows="1" placeholder="Note per questo IBAN...">${account.nota || ''}</textarea>
                </div>
            </div>

            <!-- SEZIONE REFERENTE -->
            <div class="bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-3">
                <div class="flex items-center gap-2 text-primary">
                    <span class="material-symbols-outlined text-sm">contact_phone</span>
                    <span class="text-[10px] font-bold uppercase tracking-widest">Referente Banca</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Nome</label>
                        <input type="text" class="ref-nome-input w-full bg-white rounded-lg border border-black/5 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteNome || ''}" placeholder="Nome" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Cognome</label>
                        <input type="text" class="ref-cognome-input w-full bg-white rounded-lg border border-black/5 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteCognome || ''}" placeholder="Cognome" />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Telefono</label>
                        <input type="text" class="ref-tel-input w-full bg-white rounded-lg border border-black/5 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteTelefono || ''}" placeholder="Tel." />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Cellulare</label>
                        <input type="text" class="ref-cell-input w-full bg-white rounded-lg border border-black/5 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteCellulare || ''}" placeholder="Cell." />
                    </div>
                </div>
            </div>

            <div class="space-y-3 pl-4 border-l-2 border-primary/10 py-1">
                <div class="flex items-center justify-between">
                    <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Carte collegate</span>
                    <button type="button" class="text-primary text-[10px] font-bold hover:underline flex items-center gap-0.5" onclick="addCard(${ibanIdx})">
                        <span class="material-symbols-outlined text-sm">add</span> Aggiungi carta
                    </button>
                </div>
                <div class="card-list-container space-y-4">
                    ${account.cards.map((card, cardIdx) => renderCardEntry(ibanIdx, cardIdx, card)).join('')}
                </div>
            </div>
        `;
        container.appendChild(ibanDiv);
    });

    container.querySelectorAll('.iban-input').forEach(input => {
        input.oninput = (e) => bankAccounts[e.target.dataset.ibanIdx].iban = e.target.value.trim().toUpperCase();
    });
}

function renderCardEntry(ibanIdx, cardIdx, card) {
    return `
        <div class="bg-white p-4 rounded-xl border border-black/5 shadow-sm space-y-4 relative">
             <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-gray-400 text-sm">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                    <span class="text-[10px] font-bold text-gray-500 uppercase">Strumento #${cardIdx + 1}</span>
                </div>
                <button type="button" class="text-gray-300 hover:text-red-500 transition-colors" onclick="removeCard(${ibanIdx}, ${cardIdx})">
                    <span class="material-symbols-outlined text-sm">close</span>
                </button>
            </div>

            <div class="grid grid-cols-1 gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Tipo Strumento</label>
                    <select class="type-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                        data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}">
                        <option value="Credit" ${card.type === 'Credit' ? 'selected' : ''}>Carta di credito (Credit)</option>
                        <option value="Debit" ${card.type === 'Debit' ? 'selected' : ''}>Bancomat (Debit)</option>
                    </select>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Titolare</label>
                        <input type="text" class="titolare-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.titolare || ''}" placeholder="Titolare..." />
                    </div>
                    <div class="flex flex-col gap-1.5 ${card.type === 'Debit' ? 'hidden' : ''}">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Tipo Carta</label>
                        <input type="text" class="cardtype-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardType || ''}" placeholder="Visa, MC..." />
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Numero</label>
                    <input type="text" class="number-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm font-mono focus:ring-1 focus:ring-primary/20" 
                        data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardNumber || ''}" placeholder="**** **** **** ****" />
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Scadenza</label>
                        <input type="text" class="expiry-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.expiry || ''}" placeholder="MM/AA" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">CCV</label>
                        <input type="text" class="ccv-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.ccv || ''}" placeholder="123" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">PIN</label>
                        <input type="text" class="pin-input w-full bg-slate-50 border-none rounded-lg h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.pin || ''}" placeholder="****" />
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Note</label>
                    <textarea class="note-input w-full bg-slate-50 border-none rounded-lg p-3 text-sm focus:ring-1 focus:ring-primary/20 resize-none" 
                        data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" rows="2" placeholder="Note sulla carta...">${card.note || ''}</textarea>
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

window.removeIban = (ibanIdx) => {
    if (confirm("Eliminare interamente questo IBAN e tutte le carte collegate?")) {
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
