import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, collection, addDoc, getDocs, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { showToast } from './ui-core.js';

// --- 1. GLOBALS & CONFIG ---
window.t = window.t || ((k) => k);

// STATE
let currentUid = null;
let currentDocId = null; // Contains ID if editing, otherwise null
let isEditing = false;
let accountData = {};
let myContacts = [];
let bankAccounts = [{ iban: '', cards: [] }];
// Temporary invites for NEW mode
let pendingInvites = [];

// MAIN
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');

    if (id) {
        currentDocId = id;
        isEditing = true;
    } else {
        isEditing = false;
    }

    // --- PROTOCOLLO: INIEZIONE UI ---
    function initBaseUI() {
        const hPlaceholder = document.getElementById('header-placeholder');
        if (!hPlaceholder) return;

        const applyHeader = () => {
            if (!document.getElementById('header-content')) {
                hPlaceholder.innerHTML = `
                    <div id="header-content" class="header-balanced-container">
                        <div id="header-left" class="header-left"></div>
                        <div id="header-center" class="header-center"></div>
                        <div id="header-right" class="header-right"></div>
                    </div>
                `;
            }

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
                // Set initial title based on MODE
                let initialTitle = isEditing ? 'Caricamento...' : 'Nuovo Account';
                if (!isEditing && window.t) initialTitle = window.t('new_account') || 'Nuovo Account';
                if (isEditing && window.t) initialTitle = window.t('loading') || 'Caricamento...';

                // Add pulsate effect if loading
                const animClass = isEditing ? 'animate-pulse' : '';
                hCenter.innerHTML = `<h1 class="header-title ${animClass}" id="header-title-page">${initialTitle}</h1>`;
            }

            if (hRight && hRight.innerHTML.trim() === '') {
                hRight.innerHTML = `
                    <a href="home_page.html" class="btn-icon-header">
                        <span class="material-symbols-outlined">home</span>
                    </a>
                `;
            }
        };

        const applyFooter = () => {
            const fCenter = document.getElementById('footer-center-actions');
            const fRight = document.getElementById('footer-right-actions');

            // CENTER: Delete Button (ONLY IN EDIT MODE)
            if (isEditing && fCenter && !document.getElementById('delete-btn')) {
                const btnDel = document.createElement('button');
                btnDel.id = 'delete-btn';
                btnDel.className = 'btn-icon-header btn-delete-footer';
                btnDel.title = (window.t && window.t('delete_account')) || 'Elimina Account';
                btnDel.innerHTML = '<span class="material-symbols-outlined">delete</span>';
                btnDel.addEventListener('click', deleteAccount);
                fCenter.appendChild(btnDel);
            }

            // RIGHT: Save/Create Button
            if (fRight && !document.getElementById('save-btn')) {
                const btnSave = document.createElement('button');
                btnSave.id = 'save-btn';
                btnSave.className = 'btn-icon-header btn-save-footer';

                // Text/Icon depending on mode
                const btnTitle = isEditing
                    ? ((window.t && window.t('save_changes')) || 'Salva Modifiche')
                    : ((window.t && window.t('create_account')) || 'Crea Account');

                btnSave.title = btnTitle;

                // Icon: save (disk) for edit, check_circle (or add) for create
                const iconName = isEditing ? 'save' : 'check_circle';
                btnSave.innerHTML = `<span class="material-symbols-outlined">${iconName}</span>`;

                btnSave.addEventListener('click', saveChanges);
                fRight.prepend(btnSave);
            }
        };

        applyHeader();
        applyFooter();
        // Retry loop for robustness (Wait for main.js to inject placeholders)
        let attempts = 0;
        const interval = setInterval(() => {
            const fRight = document.getElementById('footer-right-actions');
            if (!fRight || !document.getElementById('save-btn')) {
                applyHeader();
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

            if (isEditing) {
                // LOCK FIELDS initially until loaded? No, readonly attributes in HTML handle that if needed.
                // But for edit mode we might want readonly on username/pass until clicked
                loadData(currentDocId);
            } else {
                // NEW MODE: 
                // Remove readonly attributes that might be set in HTML for edit mode safety
                const safeFields = ['account-username', 'account-password', 'account-code'];
                safeFields.forEach(fid => {
                    const el = document.getElementById(fid);
                    if (el) el.removeAttribute('readonly');
                });
                renderBankAccounts(); // Empty list
                document.getElementById('loading-overlay').classList.add('hidden');

                // PRE-FILL FLAGS BASED ON TYPE
                const type = urlParams.get('type');
                if (type) {
                    if (type === 'shared') {
                        const el = document.getElementById('flag-shared'); if (el) el.checked = true;
                        toggleSharingUI(true);
                    } else if (type === 'memo') {
                        const el = document.getElementById('flag-memo'); if (el) el.checked = true;
                    } else if (type === 'shared_memo') {
                        const el = document.getElementById('flag-memo-shared'); if (el) el.checked = true;
                        toggleSharingUI(true);
                    }
                }
            }

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

    // Password Toggle
    const btnToggle = document.getElementById('btn-toggle-password-edit');
    const passInput = document.getElementById('account-password');
    if (btnToggle && passInput) {
        btnToggle.addEventListener('click', () => {
            const isPassword = passInput.type === 'password';
            passInput.type = isPassword ? 'text' : 'password';
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
            // Fallback search by usage of ID field
            const q = query(collection(db, "users", currentUid, "accounts"), where("id", "==", id));
            const querySnap = await getDocs(q);
            if (querySnap.empty) {
                if (window.showToast) window.showToast("Account non trovato", "error");
                window.location.href = 'account_privati.html';
                return;
            }
            snap = querySnap.docs[0];
            currentDocId = snap.id;
        }

        const data = snap.data();
        accountData = data;

        // Populate Fields
        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

        setVal('account-name', data.nomeAccount);
        setVal('account-username', data.username);
        setVal('account-code', data.account || data.codice);
        setVal('account-password', data.password);
        setVal('account-url', data.url || data.sitoWeb);
        setVal('account-note', data.note);

        // Header Title Update
        const hTitle = document.getElementById('header-title-page');
        if (hTitle) {
            hTitle.textContent = data.nomeAccount || 'Modifica Account';
            hTitle.classList.remove('animate-pulse');
        }

        // Banking Population (Keep data but respect user flag)
        if (data.banking) {
            if (Array.isArray(data.banking)) {
                bankAccounts = data.banking;
            } else if (typeof data.banking === 'object' && data.banking.iban) {
                bankAccounts = [{ ...data.banking, cards: data.banking.cards || [] }];
            }
        } else if (data.iban && data.iban.trim() !== '') {
            bankAccounts = [{ iban: data.iban, cards: [] }];
        }

        // ONLY isBanking flag decides UI visibility
        if (data.isBanking === true) {
            const el = document.getElementById('flag-banking'); if (el) el.checked = true;
            const sec = document.getElementById('banking-section'); if (sec) sec.classList.remove('hidden');
        }

        if (!bankAccounts || bankAccounts.length === 0) bankAccounts = [{ iban: '', cards: [] }];
        renderBankAccounts();

        // Referente
        const ref = data.referente || {};
        setVal('ref-name', ref.nome || data.referenteNome);
        setVal('ref-phone', ref.telefono || data.referenteTelefono);
        setVal('ref-mobile', ref.cellulare || data.referenteCellulare);

        // Flags (Reset e Set esplicito)
        const fShared = document.getElementById('flag-shared');
        const fMemo = document.getElementById('flag-memo');
        const fMemoShared = document.getElementById('flag-memo-shared');

        if (fShared) fShared.checked = !!data.shared;
        if (fMemo) fMemo.checked = !!data.hasMemo;
        if (fMemoShared) fMemoShared.checked = !!data.isMemoShared;

        syncShareDropdownVisibility();

        // Render Guests (Edit Mode)
        if (data.sharedWith) {
            renderGuests(data.sharedWith);
        }

        // Logo
        if (data.logo || data.avatar) {
            const img = document.getElementById('account-logo-preview');
            const placeholder = document.getElementById('logo-placeholder');
            const btnRemove = document.getElementById('btn-remove-logo');
            img.src = data.logo || data.avatar;
            img.classList.remove('hidden');
            placeholder.classList.add('hidden');
            if (btnRemove) btnRemove.classList.remove('hidden');
        }

        document.getElementById('loading-overlay').classList.add('hidden');

    } catch (e) {
        console.error("Error loading:", e);
        if (window.showToast) window.showToast("Errore caricamento: " + e.message, "error");
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
    const inviteInput = document.getElementById('invite-email');
    const suggestions = document.getElementById('rubrica-suggestions');
    const btnInvite = document.getElementById('btn-send-invite');

    // Modulo logic: Mutua esclusione e validazione (Regola 1 & 2)
    const flagShared = document.getElementById('flag-shared');
    const flagMemo = document.getElementById('flag-memo');
    const flagMemoShared = document.getElementById('flag-memo-shared');
    const flags = [flagShared, flagMemo, flagMemoShared].filter(f => f);

    flags.forEach(el => {
        el.addEventListener('change', () => {
            if (el.checked) {
                // Valida le regole prima di permettere l'attivazione
                if (!validateFlagRulesOnToggle(el.id)) {
                    el.checked = false;
                    syncShareDropdownVisibility();
                    return;
                }
                // Se valido, attiva uno e azzera gli altri
                setFlagExclusive(el.id);
            } else {
                syncShareDropdownVisibility();
            }
        });
    });

    // Banking Flag Logic
    const flagBanking = document.getElementById('flag-banking');
    if (flagBanking) {
        flagBanking.addEventListener('change', () => {
            const sec = document.getElementById('banking-section');
            if (sec) sec.classList.toggle('hidden', !flagBanking.checked);
        });
    }

    // Banking Add Button
    const btnAddIban = document.getElementById('btn-add-iban');
    if (btnAddIban) {
        btnAddIban.addEventListener('click', () => window.addIban());
    }

    // Invites AutoComplete
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
        btnInvite.addEventListener('click', () => {
            const email = inviteInput.value.trim();
            if (!email) return;

            if (isEditing) {
                // Real invite logic
                sendInviteReal(email, btnInvite);
            } else {
                // Temporary invite logic (New Account)
                // Just add to list to be processed on save
                if (!pendingInvites.includes(email)) {
                    pendingInvites.push(email);
                    renderGuests(pendingInvites); // Reuse render logic
                    inviteInput.value = '';
                }
            }
        });
    }
}

/**
 * Sincronizza la visibilità del dropdown di condivisione (Regola 3)
 */
function syncShareDropdownVisibility() {
    const isShared = document.getElementById('flag-shared')?.checked;
    const isMemoShared = document.getElementById('flag-memo-shared')?.checked;
    const mgmt = document.getElementById('shared-management');
    if (mgmt) mgmt.classList.toggle('hidden', !(isShared || isMemoShared));
}

function setupImageUploader() {
    const input = document.getElementById('logo-input');
    const btnRemove = document.getElementById('btn-remove-logo');
    const preview = document.getElementById('account-logo-preview');
    const placeholder = document.getElementById('logo-placeholder');

    if (!input) return;

    input.addEventListener('change', (e) => {
        if (input.files[0]) {
            const reader = new FileReader();
            reader.onload = (ev) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    // Resize to 200x200
                    canvas.width = 200; canvas.height = 200;
                    const min = Math.min(img.width, img.height);
                    ctx.drawImage(img, (img.width - min) / 2, (img.height - min) / 2, min, min, 0, 0, 200, 200);
                    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);

                    if (preview) {
                        preview.src = dataUrl;
                        preview.classList.remove('hidden');
                    }
                    if (placeholder) placeholder.classList.add('hidden');
                    if (btnRemove) btnRemove.classList.remove('hidden');
                };
                img.src = ev.target.result;
            };
            reader.readAsDataURL(input.files[0]);
        }
    });

    // Gestione Rimozione
    if (btnRemove) {
        btnRemove.addEventListener('click', (e) => {
            e.stopPropagation(); // Evita di triggerare il caricamento
            if (preview) {
                preview.src = '';
                preview.classList.add('hidden');
            }
            if (placeholder) placeholder.classList.remove('hidden');
            if (btnRemove) btnRemove.classList.add('hidden');
            input.value = ''; // Reset file input
        });
    }
}

function renderBankAccounts() {
    const container = document.getElementById('iban-list-container');
    if (!container) return;
    container.innerHTML = '';

    bankAccounts.forEach((acc, idx) => {
        const isOpen = acc._isOpen !== false; // Default open
        const div = document.createElement('div');
        div.id = `bank-block-${idx}`;
        div.className = `flex-col-gap p-4 rounded-2xl border border-white/10 bg-white/5 relative group border-glow transition-all duration-300 ${!isOpen ? 'opacity-80' : ''}`;

        let cardsHtml = '';
        if (acc.cards && acc.cards.length > 0) {
            cardsHtml = acc.cards.map((card, cIdx) => {
                const isCardOpen = card._isOpen !== false;
                return `
                <div id="card-block-${idx}-${cIdx}" class="p-3 rounded-xl bg-black/20 border border-white/5 space-y-3 relative group/card transition-all">
                    <div class="flex items-center justify-between cursor-pointer" onclick="toggleCard(${idx}, ${cIdx})">
                        <div class="flex items-center gap-2">
                             <span class="material-symbols-outlined text-[14px] text-emerald-500/50 transition-transform ${isCardOpen ? 'rotate-0' : '-rotate-90'}">expand_more</span>
                             <span class="text-[10px] font-black uppercase text-emerald-500/80">${card.type === 'Credit' ? 'Carta di Credito' : 'Bancomat'} ${card.cardNumber ? '• ' + card.cardNumber.slice(-4) : ''}</span>
                        </div>
                        <button type="button" class="glass-field-btn-delete" 
                            onclick="event.stopPropagation(); removeCard(${idx}, ${cIdx})">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                    
                    <div class="${isCardOpen ? 'space-y-3' : 'hidden'}">
                        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div class="glass-field-container">
                                <label class="view-label text-[9px]">Tipo Strumento</label>
                            <div class="glass-field border-glow h-9 px-3">
                                <select class="glass-select card-input text-[10px] font-black uppercase" 
                                    data-card-idx="${cIdx}" data-card-field="type">
                                    <option value="Debit" ${card.type === 'Debit' ? 'selected' : ''}>Bancomat</option>
                                    <option value="Credit" ${card.type === 'Credit' ? 'selected' : ''}>Carta di Credito</option>
                                </select>
                            </div>
                            </div>
                            <div class="glass-field-container">
                                <label class="view-label text-[9px]">Titolare</label>
                                <div class="glass-field border-glow h-9">
                                    <input type="text" class="card-input text-xs" value="${card.titolare || ''}" data-card-idx="${cIdx}" data-card-field="titolare">
                                </div>
                            </div>
                        </div>

                        <div class="glass-field-container">
                            <label class="view-label text-[9px]">Numero Carta</label>
                            <div class="glass-field border-glow h-9">
                                <input type="text" class="card-input text-xs font-mono" value="${card.cardNumber || ''}" data-card-idx="${cIdx}" data-card-field="cardNumber">
                            </div>
                        </div>

                        <div class="grid grid-cols-3 gap-2">
                            <div class="glass-field-container">
                                <label class="view-label text-[9px]">Scadenza</label>
                                <div class="glass-field border-glow h-9 px-2">
                                    <input type="text" class="card-input text-[10px] text-center" value="${card.expiry || ''}" placeholder="MM/AA" data-card-idx="${cIdx}" data-card-field="expiry">
                                </div>
                            </div>
                            <div class="glass-field-container">
                                <label class="view-label text-[9px]">CCV</label>
                                <div class="glass-field border-glow h-9 px-2">
                                    <input type="text" class="card-input text-[10px] text-center" value="${card.ccv || ''}" placeholder="123" data-card-idx="${cIdx}" data-card-field="ccv">
                                </div>
                            </div>
                            <div class="glass-field-container">
                                <label class="view-label text-[9px]">PIN</label>
                                <div class="glass-field border-glow h-9 px-2">
                                    <input type="text" class="card-input text-[10px] text-center font-mono" value="${card.pin || ''}" placeholder="••••" data-card-idx="${cIdx}" data-card-field="pin">
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            }).join('');
        }

        div.innerHTML = `
            <div class="flex items-center justify-between cursor-pointer" onclick="toggleBank(${idx})">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-sm text-purple-400 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}">expand_more</span>
                    <span class="text-[10px] font-black uppercase text-purple-400">Conto #${idx + 1} ${!isOpen && acc.iban ? '• ' + acc.iban.slice(-6) : ''}</span>
                </div>
                <div class="flex items-center gap-1">
                    ${bankAccounts.length > 1 ? `
                    <button type="button" class="glass-field-btn-delete" onclick="event.stopPropagation(); removeIban(${idx})">
                        <span class="material-symbols-outlined text-sm">close</span>
                    </button>` : ''}
                </div>
            </div>

            <div class="${isOpen ? 'flex-col-gap' : 'hidden'}">
                <!-- IBAN -->
                <div class="glass-field-container">
                    <label class="view-label">IBAN</label>
                    <div class="glass-field border-glow">
                        <span class="material-symbols-outlined ml-4 opacity-40">account_balance</span>
                        <input type="text" class="iban-input uppercase font-mono" value="${acc.iban || ''}" placeholder="IT00 X..." data-field="iban">
                    </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div class="glass-field-container">
                        <label class="view-label">Pass. Disp.</label>
                        <div class="glass-field border-glow">
                            <span class="material-symbols-outlined ml-4 opacity-40">lock</span>
                            <input type="text" class="iban-input" value="${acc.passwordDispositiva || ''}" placeholder="PIN / PASS" data-field="passwordDispositiva">
                        </div>
                    </div>
                    <div class="glass-field-container">
                        <label class="view-label">Nota Rapida</label>
                        <div class="glass-field border-glow">
                            <input type="text" class="iban-input" value="${acc.nota || ''}" placeholder="Scopo del conto..." data-field="nota">
                        </div>
                    </div>
                </div>

                <!-- Referente Banca -->
                <div class="mt-2 p-3 rounded-xl bg-purple-500/5 border border-purple-500/10 space-y-3">
                    <div class="flex items-center gap-2 text-purple-400">
                        <span class="material-symbols-outlined text-sm">contact_phone</span>
                        <span class="text-[10px] font-black uppercase">Referente Banca</span>
                    </div>
                    <div class="glass-field-container">
                        <input type="text" class="iban-input bg-transparent border-none p-0 text-sm font-bold text-white placeholder:text-white/20" 
                            value="${acc.referenteNome || ''}" placeholder="Nome e Cognome Referente" data-field="referenteNome">
                    </div>
                    <div class="grid grid-cols-2 gap-3">
                        <div class="glass-field-container">
                            <div class="glass-field border-glow h-10">
                                <span class="material-symbols-outlined ml-3 text-xs opacity-40">call</span>
                                <input type="text" class="iban-input text-xs" value="${acc.referenteTelefono || ''}" placeholder="Tel. Fisso" data-field="referenteTelefono">
                            </div>
                        </div>
                        <div class="glass-field-container">
                            <div class="glass-field border-glow h-10">
                                <span class="material-symbols-outlined ml-3 text-xs opacity-40">smartphone</span>
                                <input type="text" class="iban-input text-xs" value="${acc.referenteCellulare || ''}" placeholder="Cellulare" data-field="referenteCellulare">
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Strumenti di Pagamento (Carte) -->
                <div class="mt-3 space-y-3">
                    <div class="flex items-center justify-between px-1">
                        <span class="text-[9px] font-black uppercase text-white/30 tracking-widest">Strumenti di Pagamento</span>
                        <button type="button" class="glass-field-btn-add" 
                            onclick="addCard(${idx})">+ Strumento</button>
                    </div>
                    <div class="space-y-3">
                        ${cardsHtml || '<p class="text-[10px] text-white/20 italic ml-1">Nessuna carta collegata.</p>'}
                    </div>
                </div>
            </div>
        `;

        // Event listener for bank fields
        div.querySelectorAll('.iban-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const field = e.target.dataset.field;
                bankAccounts[idx][field] = e.target.value;
            });
        });

        // Event listener for card fields
        div.querySelectorAll('.card-input').forEach(input => {
            input.addEventListener('input', (e) => {
                const cIdx = e.target.dataset.cardIdx;
                const field = e.target.dataset.cardField;
                if (!bankAccounts[idx].cards[cIdx]) return;
                bankAccounts[idx].cards[cIdx][field] = e.target.value;
            });
        });

        container.appendChild(div);
    });

    window.toggleBank = (idx) => {
        bankAccounts[idx]._isOpen = bankAccounts[idx]._isOpen === false; // toggle
        renderBankAccounts();
    };

    window.toggleCard = (bIdx, cIdx) => {
        bankAccounts[bIdx].cards[cIdx]._isOpen = bankAccounts[bIdx].cards[cIdx]._isOpen === false;
        renderBankAccounts();
    };

    window.removeIban = async (idx) => {
        const confirmed = await window.showConfirmModal("ELIMINA CONTO", "Vuoi davvero rimuovere l'intero conto bancario?", "ELIMINA", "ANNULLA");
        if (confirmed) {
            bankAccounts.splice(idx, 1);
            renderBankAccounts();
        }
    };

    window.addIban = () => {
        // Collapse all others
        bankAccounts.forEach(b => b._isOpen = false);
        // Add new one open
        bankAccounts.push({ iban: '', cards: [], _isOpen: true });
        renderBankAccounts();

        // Scroll to new
        setTimeout(() => {
            const el = document.getElementById(`bank-block-${bankAccounts.length - 1}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    window.addCard = (bankIdx) => {
        if (!bankAccounts[bankIdx].cards) bankAccounts[bankIdx].cards = [];
        // Collapse other cards in this bank
        bankAccounts[bankIdx].cards.forEach(c => c._isOpen = false);
        // Add new one open
        bankAccounts[bankIdx].cards.push({ type: 'Debit', titolare: '', cardNumber: '', expiry: '', ccv: '', pin: '', _isOpen: true });
        renderBankAccounts();

        // Scroll to new card
        setTimeout(() => {
            const el = document.getElementById(`card-block-${bankIdx}-${bankAccounts[bankIdx].cards.length - 1}`);
            if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
    };

    window.removeCard = async (bankIdx, cardIdx) => {
        const confirmed = await window.showConfirmModal("ELIMINA STRUMENTO", "Vuoi rimuovere questo strumento di pagamento?", "ELIMINA", "ANNULLA");
        if (confirmed) {
            bankAccounts[bankIdx].cards.splice(cardIdx, 1);
            renderBankAccounts();
        }
    };
}

// SHARED LIST: Handles both Real Objects (Edit) and Strings (New)
async function renderGuests(listItems) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    list.innerHTML = '';

    if (!listItems || listItems.length === 0) {
        list.innerHTML = `<p class="text-xs text-white/40 italic ml-1">Nessun accesso.</p>`;
        return;
    }

    listItems.forEach(item => {
        let displayName = 'Utente';
        let displayEmail = '';
        let statusLabel = '';
        let guestEmail = '';
        let isPending = false;

        if (typeof item === 'object') {
            // Real Invite Object
            displayEmail = item.email;
            displayName = item.email.split('@')[0];
            statusLabel = (item.status === 'accepted') ? 'Condiviso' : (item.status === 'rejected' ? 'Rifiutato' : 'In attesa');
            guestEmail = item.email;
        } else {
            // String (Pending Invite or Legacy UID)
            guestEmail = item;
            displayEmail = item;
            displayName = item.split('@')[0];
            statusLabel = 'Nuovo Invito';
            isPending = true;
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
            <button type="button" class="text-red-400 hover:text-red-600 transition-colors shrink-0">
                <span class="material-symbols-outlined text-base">remove_circle</span>
            </button>
        `;

        const btnRm = div.querySelector('button');
        if (isEditing && !isPending) {
            btnRm.addEventListener('click', () => handleRevoke(guestEmail));
        } else {
            // Just remove from local array
            btnRm.addEventListener('click', () => {
                const idx = pendingInvites.indexOf(guestEmail);
                if (idx > -1) {
                    pendingInvites.splice(idx, 1);
                    renderGuests(pendingInvites);
                }
            });
        }

        list.appendChild(div);
    });
}

// REAL LOGIC ACTIONS

async function sendInviteReal(email, btn) {
    if (!email) return;
    btn.disabled = true;
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
        if (window.showToast) window.showToast("Invito inviato!", "success");
        document.getElementById('invite-email').value = '';
    } catch (e) {
        if (window.showToast) window.showToast(e.message, "error");
    } finally {
        btn.disabled = false;
    }
}

async function handleRevoke(guestEmail) {
    const confirmed = await window.showConfirmModal("REVOCA ACCESSO", "Vuoi revocare l'accesso a " + guestEmail + "?", "REVOCA", "ANNULLA");
    if (!confirmed) return;
    try {
        const docRef = doc(db, "users", currentUid, "accounts", currentDocId);
        const snap = await getDoc(docRef);
        const data = snap.data();
        if (data.sharedWith) {
            const newInfo = data.sharedWith.filter(i => (typeof i === 'object' ? i.email !== guestEmail : i !== guestEmail));
            await updateDoc(docRef, { sharedWith: newInfo });

            // Delete pending invites
            const q = query(collection(db, "invites"), where("accountId", "==", currentDocId), where("recipientEmail", "==", guestEmail));
            const snapInv = await getDocs(q);
            snapInv.forEach(d => deleteDoc(d.ref));

            showToast("Revocato", "success");
            loadData(currentDocId);
        }
    } catch (e) { console.error(e); }
}

async function saveChanges() {
    const btn = document.getElementById('save-btn');
    if (!btn) return;

    // VALIDAZIONE REGOLE FLAG (Regola 4)
    if (!validateBeforeSave()) return;

    // Valida Campi Base
    const name = document.getElementById('account-name').value;
    if (!name) { showToast("Il nome account è obbligatorio", "error"); return; }

    btn.disabled = true;
    const OriginalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span>';

    try {
        const img = document.getElementById('account-logo-preview');
        const logoData = (!img.classList.contains('hidden') && img.src) ? img.src : null;

        // Grab fields safely
        const getV = (id) => document.getElementById(id)?.value || '';
        const getC = (id) => document.getElementById(id)?.checked || false;

        const payload = {
            nomeAccount: getV('account-name'),
            username: getV('account-username'),
            codice: getV('account-code'),
            account: getV('account-code'), // redundancy
            password: getV('account-password'),
            url: getV('account-url'),
            banking: bankAccounts.filter(b => b && b.iban && b.iban.trim() !== ''),
            note: getV('account-note'),
            referente: {
                nome: getV('ref-name'),
                telefono: getV('ref-phone'),
                cellulare: getV('ref-mobile')
            },
            logo: logoData,
            shared: getC('flag-shared'),
            hasMemo: getC('flag-memo'),
            isMemoShared: getC('flag-memo-shared'),
            isBanking: getC('flag-banking'),
            updatedAt: new Date().toISOString()
        };

        // VALIDAZIONE CONDIVISIONE (Protocollo 3.6)
        if (payload.shared || payload.isMemoShared) {
            const hasExisting = accountData && accountData.sharedWith && accountData.sharedWith.length > 0;
            const hasPending = pendingInvites && pendingInvites.length > 0;

            if (!hasExisting && !hasPending) {
                if (window.showWarningModal) {
                    window.showWarningModal(
                        "CONTATTO MANCANTE",
                        "Hai attivato una modalità di condivisione. Devi selezionare almeno un contatto dalla rubrica o invitarne uno nuovo per poter salvare."
                    );
                } else {
                    showToast("Seleziona almeno un contatto per la condivisione.", "error");
                }
                btn.disabled = false;
                btn.innerHTML = OriginalHtml;
                return;
            }
        }

        if (isEditing) {
            // UDPATE
            await updateDoc(doc(db, "users", currentUid, "accounts", currentDocId), payload);

            // Success
            showToast("Modifiche salvate", "success");
            setTimeout(() => window.location.href = `dettaglio_account_privato.html?id=${currentDocId}`, 500);

        } else {
            // CREATE (ADD)
            payload.createdAt = new Date().toISOString();
            // Provide a manual ID or let Firestore generate it?
            // Usually we let firestore generate. But legacy code might expect an 'id' field inside the data.
            // Let's add 'id' field matching docId after creation or use random string.
            // Better to just let Firestore do it.

            const docRef = await addDoc(collection(db, "users", currentUid, "accounts"), payload);
            const newId = docRef.id;

            // Also update the doc to contain its own ID if needed by app logic
            await updateDoc(docRef, { id: newId });

            // Process Pending Invites for new account
            if (pendingInvites.length > 0) {
                for (const email of pendingInvites) {
                    await addDoc(collection(db, "invites"), {
                        accountId: newId,
                        accountName: payload.nomeAccount,
                        ownerId: currentUid,
                        ownerEmail: auth.currentUser.email,
                        recipientEmail: email,
                        status: 'pending',
                        type: 'privato',
                        createdAt: new Date().toISOString()
                    });
                }
            }

            showToast("Account creato con successo!", "success");
            setTimeout(() => window.location.href = `dettaglio_account_privato.html?id=${newId}`, 500);
        }

    } catch (e) {
        console.error(e);
        showToast("Errore salvataggio: " + e.message, "error");
        btn.disabled = false;
        btn.innerHTML = OriginalHtml;
    }
}

async function deleteAccount() {
    const confirmed = await window.showConfirmModal("ELIMINA", "Confermi l'eliminazione?", "SI, ELIMINA", "NO");
    if (!confirmed) return;
    try {
        await deleteDoc(doc(db, "users", currentUid, "accounts", currentDocId));
        showToast("Account eliminato", "success");
        setTimeout(() => window.location.href = 'account_privati.html', 500);
    } catch (e) {
        showToast("Errore eliminazione: " + e.message, "error");
    }
}

// --- NUOVE FUNZIONI DI LOGICA FLAG (Regola 1, 2, 3, 4) ---

/**
 * Ottiene lo stato delle credenziali principali (Username, Codice, Password)
 */
function getMainCredentialState() {
    const username = document.getElementById('account-username')?.value.trim() || '';
    const code = document.getElementById('account-code')?.value.trim() || '';
    const password = document.getElementById('account-password')?.value.trim() || '';
    return {
        hasData: username !== '' || code !== '' || password !== '',
        fields: { username, code, password }
    };
}

/**
 * Gestisce la mutua esclusione dei flag (Regola 1)
 */
function setFlagExclusive(activeFlagId) {
    const flags = ['flag-shared', 'flag-memo', 'flag-memo-shared'];
    flags.forEach(id => {
        if (id !== activeFlagId) {
            const el = document.getElementById(id);
            if (el) el.checked = false;
        }
    });
    syncShareDropdownVisibility();
}

/**
 * Valida le regole dei dati al momento del toggle di un flag (Regola 2)
 */
function validateFlagRulesOnToggle(flagId) {
    const state = getMainCredentialState();

    // Regola 2A: Memorandum e Memorandum Condiviso non possono avere credenziali
    if (flagId === 'flag-memo' || flagId === 'flag-memo-shared') {
        if (state.hasData) {
            if (window.showWarningModal) {
                window.showWarningModal(
                    "AZIONE BLOCCATA",
                    "In modalità Memorandum le credenziali (Username, Codice, Password) devono essere vuote. Cancella i dati prima di attivare questo flag."
                );
            } else {
                showToast("Dati presenti. Impossibile attivare Memorandum.", "error");
            }
            return false;
        }
    }

    // Regola 2B: Account Condiviso deve avere almeno una credenziale
    if (flagId === 'flag-shared') {
        if (!state.hasData) {
            if (window.showWarningModal) {
                window.showWarningModal(
                    "AZIONE BLOCCATA",
                    "Per attivare la condivisione account devi inserire almeno una credenziale (Username, Codice o Password)."
                );
            } else {
                showToast("Dati mancanti. Impossibile attivare Condivisione.", "error");
            }
            return false;
        }
    }

    return true;
}

/**
 * Validazione globale prima del salvataggio (Regola 3 & 4)
 */
function validateBeforeSave() {
    const isShared = document.getElementById('flag-shared')?.checked;
    const isMemoShared = document.getElementById('flag-memo-shared')?.checked;
    const isMemo = document.getElementById('flag-memo')?.checked;
    const state = getMainCredentialState();

    // 1. Coerenza credenziali (Regola 2)
    if ((isMemo || isMemoShared) && state.hasData) {
        showToast("Memorandum non può contenere credenziali.", "error");
        return false;
    }
    if (isShared && !state.hasData) {
        showToast("L'account condiviso deve avere almeno una credenziale.", "error");
        return false;
    }

    // 2. Dropdown contatti obbligatorio (Regola 3)
    if (isShared || isMemoShared) {
        const hasExisting = accountData && accountData.sharedWith && accountData.sharedWith.length > 0;
        const hasPending = pendingInvites && pendingInvites.length > 0;

        if (!hasExisting && !hasPending) {
            if (window.showWarningModal) {
                window.showWarningModal(
                    "CONTATTO MANCANTE",
                    "Hai attivato una modalità di condivisione. Devi selezionare almeno un contatto dalla rubrica o invitarne uno nuovo per poter salvare."
                );
            } else {
                showToast("Seleziona almeno un contatto per la condivisione.", "error");
            }
            return false;
        }
    }

    return true;
}

/* --- DEV MODE: TEST SUITE (Regola 6) --- */
/* --- DEV MODE: TEST SUITE (Regola 6) --- */
const isDev = location.hostname === "localhost" || location.hostname === "127.0.0.1" || location.hostname === "[::1]" || window.DEBUG === true;
window.__TEST_FLAGS__ = window.__TEST_FLAGS__ || {};

if (isDev) {
    Object.assign(window.__TEST_FLAGS__, {
        testMutualExclusion: () => {
            const fShared = document.getElementById('flag-shared');
            const fMemo = document.getElementById('flag-memo');
            const fMemoShared = document.getElementById('flag-memo-shared');
            if (!fShared || !fMemo || !fMemoShared) return false;

            const oldS = fShared.checked, oldM = fMemo.checked, oldMS = fMemoShared.checked;

            fShared.checked = true;
            setFlagExclusive('flag-shared');
            const ok1 = fShared.checked && !fMemo.checked && !fMemoShared.checked;

            fMemo.checked = true;
            setFlagExclusive('flag-memo');
            const ok2 = !fShared.checked && fMemo.checked && !fMemoShared.checked;

            fShared.checked = oldS; fMemo.checked = oldM; fMemoShared.checked = oldMS;
            syncShareDropdownVisibility();
            return ok1 && ok2;
        },

        testMemoValidation: () => {
            const userField = document.getElementById('account-username');
            if (!userField) return false;
            const originalValue = userField.value;
            userField.value = "test";
            const resultFail = validateFlagRulesOnToggle('flag-memo');
            userField.value = "";
            const resultPass = validateFlagRulesOnToggle('flag-memo');
            userField.value = originalValue;
            return (resultFail === false && resultPass === true);
        },

        testSharedValidation: () => {
            const userField = document.getElementById('account-username');
            const codeField = document.getElementById('account-code');
            const passField = document.getElementById('account-password');
            if (!userField) return false;
            const ovU = userField.value, ovC = codeField?.value || '', ovP = passField?.value || '';
            userField.value = ""; if (codeField) codeField.value = ""; if (passField) passField.value = "";
            const resultFail = validateFlagRulesOnToggle('flag-shared');
            userField.value = "admin";
            const resultPass = validateFlagRulesOnToggle('flag-shared');
            userField.value = ovU; if (codeField) codeField.value = ovC; if (passField) passField.value = ovP;
            return (resultFail === false && resultPass === true);
        },

        testDropdownRequired: () => {
            const fShared = document.getElementById('flag-shared');
            if (!fShared) return false;
            const originalChecked = fShared.checked, originalData = accountData, originalInvites = pendingInvites;
            fShared.checked = true;
            accountData = { sharedWith: [] }; pendingInvites = [];
            const result = validateBeforeSave();
            fShared.checked = originalChecked; accountData = originalData; pendingInvites = originalInvites;
            return (result === false);
        },

        testLoadSync: () => {
            const fShared = document.getElementById('flag-shared');
            const mgmt = document.getElementById('shared-management');
            if (!fShared || !mgmt) return false;
            const original = fShared.checked;
            fShared.checked = true; syncShareDropdownVisibility();
            const ok1 = !mgmt.classList.contains('hidden');
            fShared.checked = false; syncShareDropdownVisibility();
            const ok2 = mgmt.classList.contains('hidden');
            fShared.checked = original; syncShareDropdownVisibility();
            return ok1 && ok2;
        },

        runAllTests: function () {
            console.group("%c[TEST FLAGS] Esecuzione completa", "color: orange; font-weight: bold;");

            try {
                console.group("1️⃣ Mutual Exclusion");
                const res = this.testMutualExclusion();
                console.assert(res, "Mutual exclusion check failed!");
                if (res) console.log("%c✔ Mutual exclusion OK", "color: green;");
                console.groupEnd();
            } catch (e) {
                console.error("%c❌ Mutual exclusion FAILED", "color: red;", e);
            }

            try {
                console.group("2️⃣ Memorandum Validation");
                const res = this.testMemoValidation();
                console.assert(res, "Memorandum validation check failed!");
                if (res) console.log("%c✔ Memorandum validation OK", "color: green;");
                console.groupEnd();
            } catch (e) {
                console.error("%c❌ Memorandum validation FAILED", "color: red;", e);
            }

            try {
                console.group("3️⃣ Shared Account Validation");
                const res = this.testSharedValidation();
                console.assert(res, "Shared validation check failed!");
                if (res) console.log("%c✔ Shared validation OK", "color: green;");
                console.groupEnd();
            } catch (e) {
                console.error("%c❌ Shared validation FAILED", "color: red;", e);
            }

            try {
                console.group("4️⃣ Dropdown / Contact Required");
                const res = this.testDropdownRequired();
                console.assert(res, "Dropdown validation check failed!");
                if (res) console.log("%c✔ Dropdown check OK", "color: green;");
                console.groupEnd();
            } catch (e) {
                console.error("%c❌ Dropdown check FAILED", "color: red;", e);
            }

            try {
                console.group("5️⃣ Load / Sync Verification");
                const res = this.testLoadSync();
                console.assert(res, "Load & Sync verification check failed!");
                if (res) console.log("%c✔ Load & Sync OK", "color: green;");
                console.groupEnd();
            } catch (e) {
                console.error("%c❌ Load & Sync FAILED", "color: red;", e);
            }

            console.groupEnd();
            console.log("%c✅ Tutti i test completati", "color: orange; font-weight: bold;");
        }
    });

    console.log("%c[DEV] Test flags disponibili:", "color: blue; font-weight: bold;");
    console.log("Esegui: window.__TEST_FLAGS__.runAllTests() per un collaudo completo della logica flags.");
} else {
    // Hidden way to enable tests if NOT on localhost (for remote dev/testing)
    window.__ENABLE_TESTS__ = () => {
        window.DEBUG = true;
        location.reload();
    };
}

