import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, arrayRemove, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

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
        alert("ID mancante");
        window.location.href = 'account_privati.html';
        return;
    }

    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUid = user.uid;
            loadData(id);
            loadRubrica(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    setupUI();
    setupImageUploader();
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
                alert("Account non trovato");
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
        alert("Errore caricamento dati: " + e.message);
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

    // Save Button
    const saveBtn = document.getElementById('save-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveChanges);
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

    // Delete Button
    const deleteBtn = document.getElementById('delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', deleteAccount);
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
        btnInvite.addEventListener('click', sendInvite);
    }
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
            removeBtn.onclick = () => handleRevoke(guestEmail);
        }
        list.appendChild(div);
    });
}

async function handleRevoke(guestEmail) {
    if (!confirm(`Revocare l'accesso a ${guestEmail}?`)) return;
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

                alert("Accesso revocato.");
                loadData(currentDocId); // Refresh UI
            }
        }
    } catch (e) {
        console.error("Revoke error:", e);
        alert("Errore durante la revoca: " + e.message);
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
        alert("Invito inviato!");
        inviteInput.value = '';
    } catch (e) {
        alert(e.message);
    } finally {
        btnInvite.disabled = false;
    }
}

async function saveChanges() {
    const btn = document.getElementById('save-btn');
    const icon = btn.querySelector('span');
    const originalIcon = icon.textContent;

    btn.disabled = true;
    icon.textContent = "sync"; // Show sync icon during saving
    icon.classList.add('animate-spin');

    try {
        const img = document.getElementById('account-logo-preview');
        const logoData = (!img.classList.contains('hidden') && img.src) ? img.src : null;

        const updateObj = {
            nomeAccount: document.getElementById('account-name').value,
            username: document.getElementById('account-username').value,
            codice: document.getElementById('account-code').value,
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

        if (!updateObj.nomeAccount) throw new Error("Nome Account è obbligatorio");

        await updateDoc(doc(db, "users", currentUid, "accounts", currentDocId), updateObj);

        icon.textContent = "check_circle"; // Flash success
        icon.classList.remove('animate-spin');

        setTimeout(() => {
            window.location.href = `dettaglio_account_privato.html?id=${currentDocId}`;
        }, 500);

    } catch (e) {
        console.error(e);
        alert("Errore salvataggio: " + e.message);
        btn.disabled = false;
        icon.textContent = originalIcon;
        icon.classList.remove('animate-spin');
    }
}

async function deleteAccount() {
    if (!confirm("Sei sicuro di voler ELIMINARE definitivamente questo account? L'operazione non è reversibile.")) return;

    const btn = document.getElementById('delete-btn');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = "Eliminazione...";

    try {
        await deleteDoc(doc(db, "users", currentUid, "accounts", currentDocId));
        alert("Account eliminato correttamente.");
        window.location.href = 'account_privati.html';
    } catch (e) {
        console.error(e);
        alert("Errore eliminazione: " + e.message);
        btn.disabled = false;
        btn.innerHTML = originalText;
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
        ibanDiv.className = "bg-white/50 dark:bg-slate-800/20 p-4 rounded-2xl border border-black/5 dark:border-white/5 space-y-4 relative animate-in fade-in slide-in-from-top-4 duration-500";

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
                <label class="text-[#0A162A] dark:text-white text-xs font-bold uppercase tracking-wide opacity-50 pl-1">IBAN</label>
                <div class="flex w-full items-center rounded-xl border border-black/5 dark:border-white/10 bg-white dark:bg-slate-900/50 overflow-hidden focus-within:border-primary focus-within:ring-1 focus-within:ring-primary/20 transition-all shadow-sm">
                    <div class="pl-4 text-gray-400 flex items-center justify-center">
                        <span class="material-symbols-outlined">account_balance</span>
                    </div>
                    <input type="text" class="iban-input w-full bg-transparent border-none h-14 px-4 text-base text-[#0A162A] dark:text-white font-mono focus:ring-0 uppercase font-bold" 
                        data-iban-idx="${ibanIdx}" value="${account.iban}" placeholder="IT00..." />
                </div>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Pass. Dispositiva</label>
                    <div class="flex items-center bg-white dark:bg-slate-900/50 rounded-xl border border-black/5 dark:border-white/10 overflow-hidden focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                        <input type="text" class="dispositiva-input titanium-shield w-full bg-transparent border-none h-11 px-4 text-sm focus:ring-0 dark:text-white" 
                            data-iban-idx="${ibanIdx}" value="${account.passwordDispositiva || ''}" placeholder="Password..." />
                        <button type="button" onclick="const i=this.previousElementSibling; i.classList.toggle('titanium-shield'); this.querySelector('span').textContent=i.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-gray-400">
                            <span class="material-symbols-outlined text-sm">visibility</span>
                        </button>
                    </div>
                </div>
                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Nota IBAN</label>
                    <textarea class="iban-nota-input w-full bg-white dark:bg-slate-900/50 rounded-xl border border-black/5 dark:border-white/10 px-4 py-2.5 text-sm focus:ring-1 focus:ring-primary/20 resize-none dark:text-white" 
                        data-iban-idx="${ibanIdx}" rows="1" placeholder="Note per questo IBAN...">${account.nota || ''}</textarea>
                </div>
            </div>

            <!-- SEZIONE REFERENTE -->
            <div class="bg-primary/5 dark:bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-3">
                <div class="flex items-center gap-2 text-primary">
                    <span class="material-symbols-outlined text-sm">contact_phone</span>
                    <span class="text-[10px] font-bold uppercase tracking-widest">Referente Banca</span>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Nome</label>
                        <input type="text" class="ref-nome-input w-full bg-white dark:bg-slate-900/50 rounded-lg border border-black/5 dark:border-white/10 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20 dark:text-white" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteNome || ''}" placeholder="Nome" />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Cognome</label>
                        <input type="text" class="ref-cognome-input w-full bg-white dark:bg-slate-900/50 rounded-lg border border-black/5 dark:border-white/10 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20 dark:text-white" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteCognome || ''}" placeholder="Cognome" />
                    </div>
                </div>
                <div class="grid grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Telefono</label>
                        <input type="text" class="ref-tel-input w-full bg-white dark:bg-slate-900/50 rounded-lg border border-black/5 dark:border-white/10 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20 dark:text-white" 
                            data-iban-idx="${ibanIdx}" value="${account.referenteTelefono || ''}" placeholder="Tel." />
                    </div>
                    <div class="flex flex-col gap-1">
                        <label class="text-[9px] font-bold text-gray-400 uppercase pl-1">Cellulare</label>
                        <input type="text" class="ref-cell-input w-full bg-white dark:bg-slate-900/50 rounded-lg border border-black/5 dark:border-white/10 h-10 px-3 text-sm focus:ring-1 focus:ring-primary/20 dark:text-white" 
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

    // Attach local listeners
    container.querySelectorAll('.iban-input').forEach(input => {
        input.oninput = (e) => bankAccounts[e.target.dataset.ibanIdx].iban = e.target.value.trim().toUpperCase();
    });
}

function renderCardEntry(ibanIdx, cardIdx, card) {
    return `
        <div class="bg-white dark:bg-slate-900/50 p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm space-y-4 relative">
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
                    <select class="type-input w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg h-10 px-3 text-sm text-[#0A162A] dark:text-white focus:ring-1 focus:ring-primary/20" 
                        data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}">
                        <option value="Credit" ${card.type === 'Credit' ? 'selected' : ''}>Carta di credito (Credit)</option>
                        <option value="Debit" ${card.type === 'Debit' ? 'selected' : ''}>Bancomat (Debit)</option>
                    </select>
                </div>

                <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Titolare</label>
                        <input type="text" class="titolare-input w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg h-10 px-3 text-sm text-[#0A162A] dark:text-white focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.titolare || ''}" placeholder="Titolare..." />
                    </div>
                    <div class="flex flex-col gap-1.5 ${card.type === 'Debit' ? 'hidden' : ''}">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Tipo Carta</label>
                        <input type="text" class="cardtype-input w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg h-10 px-3 text-sm text-[#0A162A] dark:text-white focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardType || ''}" placeholder="Visa, MC..." />
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Numero</label>
                    <input type="text" class="number-input w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg h-10 px-3 text-sm text-[#0A162A] dark:text-white font-mono focus:ring-1 focus:ring-primary/20" 
                        data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.cardNumber || ''}" placeholder="**** **** **** ****" />
                </div>

                <div class="grid grid-cols-3 gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Scadenza</label>
                        <input type="text" class="expiry-input w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg h-10 px-3 text-sm text-[#0A162A] dark:text-white focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.expiry || ''}" placeholder="MM/AA" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">CCV</label>
                        <input type="text" class="ccv-input w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg h-10 px-3 text-sm text-[#0A162A] dark:text-white focus:ring-1 focus:ring-primary/20" 
                            data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.ccv || ''}" placeholder="123" />
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">PIN</label>
                        <div class="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-black/5 dark:border-white/5">
                            <input type="text" class="pin-input titanium-shield w-full bg-transparent border-none h-10 px-3 text-sm text-[#0A162A] dark:text-white focus:ring-1 focus:ring-primary/20" 
                                data-iban-idx="${ibanIdx}" data-card-idx="${cardIdx}" value="${card.pin || ''}" placeholder="****" />
                            <button type="button" onclick="const i=this.previousElementSibling; i.classList.toggle('titanium-shield'); this.querySelector('span').textContent=i.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-gray-400">
                                <span class="material-symbols-outlined text-sm">visibility</span>
                            </button>
                        </div>
                    </div>
                </div>

                <div class="flex flex-col gap-1.5">
                    <label class="text-[10px] font-bold text-gray-400 uppercase pl-1">Note</label>
                    <textarea class="note-input w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg p-3 text-sm text-[#0A162A] dark:text-white focus:ring-1 focus:ring-primary/20 resize-none" 
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
