import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- STATE ---
let currentUid = null;
let currentId = null;
let ownerId = null;
let isReadOnly = false;
let originalData = {};
let myContacts = [];

// --- HELPERS ---
// --- HELPERS (Global versions in main.js are used where possible) ---
function showToast(msg) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.textContent = msg;
        toast.style.opacity = '1';
        setTimeout(() => toast.style.opacity = '0', 2000);
    }
}
// Local override to handle specific excluded strings
window.copyText = function (text) {
    if (!text || text === '-' || text === 'Nessuna nota presente.') return;
    if (typeof window.copyTextGlobal === 'function') {
        window.copyTextGlobal(text);
    } else {
        // Fallback if main.js not loaded or names differ
        navigator.clipboard.writeText(text).then(() => showToast("Copiato!"));
    }
};
// Note: window.makeCall is already defined globally in main.js

// --- MAIN LOGIC ---
document.addEventListener('DOMContentLoaded', () => {
    // URL Params
    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    if (!currentId) {
        const match = window.location.href.match(/[?&]id=([^&]+)/);
        if (match) currentId = decodeURIComponent(match[1]);
    }

    if (!currentId || currentId === 'undefined') {
        alert("ID mancante");
        window.location.href = 'account_privati.html';
        return;
    }

    // Auth Listener
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUid = user.uid;
            ownerId = urlParams.get('ownerId') || user.uid;
            isReadOnly = (ownerId !== currentUid);

            if (isReadOnly) {
                enableReadOnlyMode();
                // UI Hiding for ReadOnly
                const actions = document.getElementById('save-bar');
                if (actions) actions.classList.add('hidden');
                const editBtn = document.getElementById('btn-edit-page');
                if (editBtn) editBtn.classList.add('hidden');
                const sharedMgmt = document.getElementById('shared-management-section');
                if (sharedMgmt) sharedMgmt.classList.add('hidden');
            }

            await loadAccount(ownerId, currentId);
            await loadMyRubrica(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    setupListeners();
});

// --- CORE FUNCTIONS ---

function enableReadOnlyMode() {
    // Banner
    const banner = document.createElement('div');
    banner.className = "bg-indigo-100 border-l-4 border-indigo-500 text-indigo-700 p-4 mb-4 rounded shadow-sm";
    banner.innerHTML = `
        <p class="font-bold">Modalità Visualizzazione</p>
        <p class="text-sm">Questo elemento è condiviso con te in sola lettura.</p>
    `;
    const hero = document.querySelector('.px-4.space-y-6');
    if (hero) hero.insertBefore(banner, hero.firstChild);

    // Disable checkboxes
    ['detail-shared', 'detail-hasMemo', 'detail-isMemoShared'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });

    // Add Rinuncia Button
    const bottomSection = document.querySelector('section.pb-10');
    if (bottomSection) {
        const btnRinuncia = document.createElement('button');
        btnRinuncia.className = "w-full mt-4 h-12 bg-red-50 text-red-600 border border-red-200 font-bold rounded-xl flex items-center justify-center gap-2 hover:bg-red-100 transition-colors";
        btnRinuncia.innerHTML = `<span class="material-symbols-outlined">person_remove</span> Rinuncia alla condivisione`;
        btnRinuncia.onclick = removeSharedLink;
        bottomSection.appendChild(btnRinuncia);
    }
}

async function removeSharedLink() {
    if (!confirm("Vuoi rimuovere questo account dalla tua lista?")) return;

    try {
        // 1. Find invite doc to delete
        const q = query(collection(db, 'invites'),
            where('recipientEmail', '==', auth.currentUser.email),
            where('accountId', '==', currentId)
        );
        const snapshot = await getDocs(q);

        const promises = snapshot.docs.map(d => deleteDoc(d.ref)); // Wait? deleteDoc needs import from firestore
        // Wait, I didn't import deleteDoc. Let's fix imports later or assume implementation.
        // Actually, I should import deleteDoc.

        // Re-import dynamically or use what I have. I imported updateDoc, addDoc...
        // I need to update the import statement at the top. I'll do that in 'CodeContent'.

        // ... Assuming deleteDoc is available ...
        // (I will fix imports in the actual tool call string below).

        // Actually I can't easily modify the imports in the function body.
        // I'll ensure deleteDoc is imported in the main file write.

        // 2. Notify Owner
        if (ownerId && ownerId !== currentUid) {
            await addDoc(collection(db, "users", ownerId, "notifications"), {
                type: "share_returned",
                message: `Un utente ha rimosso la condivisione.`,
                details: `L'utente ${auth.currentUser.email} ha rinunciato all'accesso per un account privato.`,
                timestamp: new Date(),
                read: false,
                accountId: currentId
            });
        }

        // Actually perform deletes
        // NOTE: snapshot.docs.map(d => deleteDoc(d.ref)) returns promises
        // I need to await them. But deleteDoc takes a Reference.
        // In Modular SDK: deleteDoc(docRef).
        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);

        alert("Rimosso con successo.");
        window.location.href = 'home_page.html';
    } catch (e) {
        console.error("Error removing link", e);
        alert("Errore durante la rimozione.");
    }
}
// Needed for removeSharedLink
import { deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";


async function loadAccount(uid, id) {
    try {
        let docRef = doc(db, "users", uid, "accounts", id);
        let docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
            // Fallback: search by 'id' field if docId doesn't match
            const q = query(collection(db, "users", uid, "accounts"), where("id", "==", id));
            const qSnap = await getDocs(q);

            if (qSnap.empty) {
                alert("Ops! Account non trovato.");
                // history.back(); // Can be annoying in dev
                return;
            }
            originalData = qSnap.docs[0].data();
            originalData.docId = qSnap.docs[0].id;
            // Update docRef for future updates
            docRef = doc(db, "users", uid, "accounts", originalData.docId);
        } else {
            originalData = docSnap.data();
            originalData.docId = docSnap.id;
        }

        // Increment View Count
        if (!isReadOnly) {
            updateDoc(docRef, { views: increment(1) }).catch(console.error);
        }

        render(originalData);
    } catch (e) {
        console.error(e);
        alert("Errore caricamento dati: " + e.message);
    }
}

function render(acc) {
    document.title = acc.nomeAccount || 'Dettaglio';

    // Header
    const hNome = document.getElementById('header-nome-account');
    if (hNome) hNome.textContent = acc.nomeAccount || 'Senza Nome';

    const avatar = document.getElementById('detail-avatar');
    const logoUrl = acc.logo || acc.avatar;
    if (avatar) {
        if (logoUrl) {
            avatar.style.backgroundImage = `url("${logoUrl}")`;
            avatar.style.backgroundSize = 'cover';
            avatar.style.backgroundPosition = 'center';
            avatar.innerHTML = ''; // Clear fallback
        } else {
            avatar.style.backgroundImage = 'none';
            if (window.getAccountIcon) {
                avatar.innerHTML = window.getAccountIcon(acc.nomeAccount, 'w-full h-full');
                avatar.classList.add('bg-transparent');
                avatar.classList.remove('bg-white/20');
            }
        }
    }

    const ref = acc.referente || {};

    const map = {
        'detail-nomeAccount': acc.nomeAccount,
        'detail-username': acc.username,
        'detail-account': acc.account || acc.codice,
        'detail-password': acc.password,
        'detail-website': acc.url || acc.sitoWeb || acc.website,
        'detail-referenteNome': ref.nome || acc.nome_cognome_referente || acc.referenteNome,
        'detail-referenteTelefono': ref.telefono || acc.telefono_referente || acc.referenteTelefono,
        'detail-referenteCellulare': ref.cellulare || acc.cellulare_referente || acc.referenteCellulare
    };

    for (const [id, val] of Object.entries(map)) {
        const el = document.getElementById(id);
        if (el) {
            el.value = val || '';
        }
    }

    // Banking Details
    const bankingArr = Array.isArray(acc.banking) ? acc.banking : (acc.banking && acc.banking.iban ? [acc.banking] : []);
    const hasBanking = bankingArr.length > 0;
    const sectionBanking = document.getElementById('section-banking');
    if (sectionBanking) {
        sectionBanking.classList.toggle('hidden', !hasBanking);
    }

    if (hasBanking) {
        const bankingContent = document.getElementById('banking-content');
        if (bankingContent) {
            bankingContent.innerHTML = bankingArr.map((bank, idx) => `
                <div class="space-y-4 p-4 bg-white/50 dark:bg-slate-800/20 rounded-2xl border border-black/5 dark:border-white/5">
                    <div class="flex items-center justify-between border-b border-black/5 dark:border-white/5 pb-2">
                        <span class="text-[10px] font-bold text-primary uppercase tracking-widest">Conto #${idx + 1}</span>
                    </div>

                    <!-- IBAN -->
                    <div class="flex flex-col gap-1.5">
                        <span class="text-[11px] font-bold text-gray-400 uppercase ml-1">IBAN</span>
                        <div class="flex items-center bg-white dark:bg-slate-900/50 rounded-xl border border-black/5 dark:border-white/10 overflow-hidden">
                            <input readonly
                                class="flex-1 bg-transparent border-none h-12 px-4 text-sm font-bold focus:ring-0 text-[#0A162A] dark:text-white uppercase font-mono"
                                value="${bank.iban || ''}">
                            <button onclick="copyText('${bank.iban}')" class="p-3 text-gray-400 hover:text-primary border-l border-black/5 dark:border-white/10">
                                <span class="material-symbols-outlined text-base">content_copy</span>
                            </button>
                        </div>
                    </div>

                    <!-- PASSWORD & NOTA -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Pass. Dispositiva</span>
                            <div class="flex items-center bg-white dark:bg-slate-900/50 rounded-xl border border-black/5 dark:border-white/10 overflow-hidden">
                                <input readonly type="text"
                                    class="titanium-shield flex-1 bg-transparent border-none h-10 px-4 text-sm focus:ring-0 text-[#0A162A] dark:text-white"
                                    value="${bank.passwordDispositiva || ''}">
                                <button onclick="const p=this.previousElementSibling; p.classList.toggle('titanium-shield'); this.querySelector('span').textContent=p.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-gray-400">
                                    <span class="material-symbols-outlined text-sm">visibility</span>
                                </button>
                                <button onclick="copyText(this.parentElement.querySelector('input').value)" class="p-2 text-gray-400 hover:text-primary border-l border-black/5 dark:border-white/10">
                                    <span class="material-symbols-outlined text-sm">content_copy</span>
                                </button>
                            </div>
                        </div>
                        <div class="flex flex-col gap-1.5">
                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Nota IBAN</span>
                            <div class="selectable bg-blue-50/50 dark:bg-blue-900/10 p-2.5 rounded-xl text-xs text-blue-800 dark:text-blue-300 border border-blue-100 dark:border-blue-900/20 min-h-[40px] flex items-center">
                                ${bank.nota || '-'}
                            </div>
                        </div>
                    </div>

                    <!-- SEZIONE REFERENTE BANCA -->
                    <div class="bg-primary/5 dark:bg-primary/5 p-4 rounded-2xl border border-primary/10 space-y-3">
                        <div class="flex items-center gap-2 text-primary">
                            <span class="material-symbols-outlined text-sm">contact_phone</span>
                            <span class="text-[10px] font-bold uppercase tracking-widest">Referente Banca</span>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-[9px] font-bold text-gray-400 uppercase ml-1">Nome e Cognome</span>
                            <p class="text-sm font-bold text-slate-900 dark:text-white ml-1">${bank.referenteNome || ''} ${bank.referenteCognome || ''}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="flex flex-col gap-1">
                                <span class="text-[9px] font-bold text-gray-400 uppercase ml-1">Telefono</span>
                                <div class="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors" onclick="makeCall('${bank.referenteTelefono}')" title="Chiama">
                                    <span class="material-symbols-outlined text-[16px] text-primary">call</span>
                                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${bank.referenteTelefono || '-'}</span>
                                </div>
                            </div>
                            <div class="flex flex-col gap-1">
                                <span class="text-[9px] font-bold text-gray-400 uppercase ml-1">Cellulare</span>
                                <div class="flex items-center gap-2 p-2 rounded-xl bg-white dark:bg-slate-900 border border-black/5 dark:border-white/5 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors" onclick="makeCall('${bank.referenteCellulare}')" title="Chiama">
                                    <span class="material-symbols-outlined text-[16px] text-primary">smartphone</span>
                                    <span class="text-xs font-bold text-slate-700 dark:text-slate-300">${bank.referenteCellulare || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Carte collegate -->
                    ${(bank.cards || []).length > 0 ? `
                        <div class="space-y-4 pt-2">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Strumenti collegati</span>
                            ${bank.cards.map((card, cIdx) => `
                                <div class="bg-white dark:bg-slate-900 p-4 rounded-xl border border-black/5 dark:border-white/5 shadow-sm space-y-4">
                                     <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="material-symbols-outlined text-primary text-sm">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                                            <span class="text-xs font-bold text-primary uppercase">${card.type === 'Debit' ? 'Bancomat' : 'Carta di Credito'}</span>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Titolare</span>
                                            <div class="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-black/5 dark:border-white/5">
                                                <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-[#0A162A] dark:text-white" value="${card.titolare || ''}">
                                                <button onclick="copyText('${card.titolare}')" class="p-2 text-gray-400 hover:text-primary">
                                                    <span class="material-symbols-outlined text-base">content_copy</span>
                                                </button>
                                            </div>
                                        </div>
                                        ${card.type !== 'Debit' ? `
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Tipo Carta</span>
                                            <div class="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-black/5 dark:border-white/5">
                                                <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-[#0A162A] dark:text-white" value="${card.cardType || ''}">
                                            </div>
                                        </div>
                                        ` : ''}
                                    </div>

                                    <div class="flex flex-col gap-1.5">
                                        <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Numero</span>
                                        <div class="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-black/5 dark:border-white/5">
                                            <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm font-mono text-[#0A162A] dark:text-white" value="${card.cardNumber || ''}">
                                            <button onclick="copyText('${card.cardNumber}')" class="p-2 text-gray-400 hover:text-primary">
                                                <span class="material-symbols-outlined text-base">content_copy</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-3 gap-3">
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Scadenza</span>
                                            <div class="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg h-10 px-3 text-sm text-[#0A162A] dark:text-white border border-black/5 dark:border-white/5">
                                                ${card.expiry || '-'}
                                            </div>
                                        </div>
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">CCV</span>
                                            <div class="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-black/5 dark:border-white/5">
                                                <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-[#0A162A] dark:text-white" value="${card.ccv || ''}">
                                                <button onclick="copyText('${card.ccv}')" class="p-2 text-gray-400 hover:text-primary">
                                                    <span class="material-symbols-outlined text-sm">content_copy</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">PIN</span>
                                            <div class="flex items-center bg-slate-50 dark:bg-slate-800 rounded-lg overflow-hidden border border-black/5 dark:border-white/5">
                                                <input readonly type="text" class="titanium-shield pin-field flex-1 bg-transparent border-none h-10 px-3 text-sm font-mono text-[#0A162A] dark:text-white" 
                                                    value="${card.pin || ''}">
                                                <button onclick="const p=this.previousElementSibling; p.classList.toggle('titanium-shield'); this.querySelector('span').textContent=p.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-gray-400">
                                                    <span class="material-symbols-outlined text-sm">visibility</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    ${card.note ? `
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-gray-400 uppercase ml-1">Note Strumento</span>
                                            <div class="selectable bg-slate-50 dark:bg-slate-800 p-3 rounded-lg text-xs text-gray-600 dark:text-gray-400 italic border border-black/5 dark:border-white/5">
                                                ${card.note}
                                            </div>
                                        </div>
                                    ` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
    }

    const elNote = document.getElementById('detail-note');
    if (elNote) elNote.textContent = acc.note || 'Nessuna nota presente.';

    // Checkboxes
    const chkShared = document.getElementById('detail-shared');
    const chkMemo = document.getElementById('detail-hasMemo');
    const chkMemoShared = document.getElementById('detail-isMemoShared');

    if (chkShared) chkShared.checked = !!acc.shared;
    if (chkMemo) chkMemo.checked = !!acc.hasMemo;
    if (chkMemoShared) chkMemoShared.checked = !!acc.isMemoShared;

    toggleSharingUI(acc.shared || acc.isMemoShared);
    renderGuests(acc.sharedWith || []);
    updateAttachmentCount(ownerId, acc.docId);
}

function toggleSharingUI(show) {
    const mgmt = document.getElementById('shared-management');
    if (mgmt) mgmt.classList.toggle('hidden', !show);
}

async function renderGuests(listItems) {
    const list = document.getElementById('guests-list');
    if (!list) return;
    list.innerHTML = '';

    if (!listItems || listItems.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400 italic ml-1">Nessun accesso attivo.</p>';
        return;
    }

    const activeList = listItems.filter(item => {
        if (typeof item === 'object' && item.status === 'rejected') return false;
        return true;
    });

    if (activeList.length === 0) {
        list.innerHTML = '<p class="text-xs text-gray-400 italic ml-1">Nessun accesso attivo.</p>';
        // Auto-uncheck if we are owner
        if (!isReadOnly && currentUid) {
            const chkShared = document.getElementById('detail-shared');
            if (chkShared && chkShared.checked) {
                chkShared.checked = false;
                updateDoc(doc(db, "users", currentUid, "accounts", originalData.docId), { shared: false }).catch(console.error);
            }
        }
        toggleSharingUI(false);
        return;
    }

    for (const item of activeList) {
        let displayName = 'Account';
        let displayEmail = '';
        let avatarUrl = 'assets/images/google-avatar.png';
        let statusLabel = 'Condiviso';
        let guestUid = '';

        if (typeof item === 'object') {
            displayEmail = item.email;
            displayName = item.email.split('@')[0];
            statusLabel = (item.status === 'accepted') ? 'Condiviso' : (item.status === 'rejected' ? 'Rifiutato' : 'In attesa');
            guestUid = '';
        } else if (typeof item === 'string') {
            // Legacy fetch
            try {
                const userSnap = await getDoc(doc(db, "users", item));
                if (userSnap.exists()) {
                    const uData = userSnap.data();
                    displayName = `${uData.nome || ''} ${uData.cognome || ''}`.trim() || 'Utente';
                    displayEmail = uData.email || 'Email nascosta';
                    avatarUrl = uData.photoURL || uData.avatar || 'assets/images/google-avatar.png';
                    guestUid = item;
                } else {
                    displayName = 'Utente rimosso';
                    guestUid = item;
                }
            } catch (e) { console.error(e); }
        }

        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3 bg-gray-50/50 dark:bg-gray-700/30 rounded-xl border border-gray-100 dark:border-gray-800";
        div.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="h-8 w-8 rounded-full bg-cover bg-center border border-primary/20 shrink-0" style="background-image: url('${avatarUrl}')"></div>
                <div class="min-w-0">
                    <p class="text-xs font-bold truncate">${displayName}</p>
                    <p class="text-[10px] text-gray-400 truncate flex items-center gap-1">
                        ${displayEmail} 
                        <span class="bg-gray-200 dark:bg-gray-600 px-1 rounded text-[9px] text-gray-600 dark:text-gray-300">${statusLabel}</span>
                    </p>
                </div>
            </div>
            <button onclick="window.handleRevoke('${guestUid}', '${displayEmail}')" class="text-red-400 hover:text-red-600 transition-colors shrink-0" title="Rimuovi Accesso">
                <span class="material-symbols-outlined text-sm">remove_circle</span>
            </button>
        `;
        list.appendChild(div);
    }
}

async function loadMyRubrica(uid) {
    try {
        // Simple fetch without orderBy on server to avoid index issues
        const snap = await getDocs(collection(db, "users", uid, "contacts"));
        myContacts = snap.docs.map(d => d.data());
        myContacts.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));

        populateInviteSelect();
    } catch (e) { console.error("Rubrica error:", e); }
}

function populateInviteSelect() {
    const sel = document.getElementById('invite-select');
    if (!sel) return;
    sel.innerHTML = '<option value="" disabled selected>Seleziona un contatto...</option>';

    if (!myContacts || myContacts.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = "Nessun contatto in rubrica";
        sel.appendChild(opt);
        return;
    }

    myContacts.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.email;
        opt.textContent = `${c.nome} ${c.cognome} (${c.email})`;
        sel.appendChild(opt);
    });
}

// --- MODAL UTILS ---
window.closeSaveModal = () => {
    const modal = document.getElementById('save-modal');
    if (modal) modal.classList.add('hidden');
    // Optional: Revert checkboxes if canceled? 
    // For now, keep visual selection. User can click Save again.
    // Ideally, reload plain state if cancel? Keep it simple: just close.
};

function showSaveModal(isSharingActive) {
    const modal = document.getElementById('save-modal');
    if (!modal) return;

    // Update Text inside Modal Button
    const btnParams = document.getElementById('btn-save-modal');
    if (btnParams) {
        btnParams.innerHTML = isSharingActive ?
            '<span class="material-symbols-outlined text-lg">save</span> Salva Modifiche e invia l\'invito' :
            '<span class="material-symbols-outlined text-lg">save</span> Salva Modifiche';
    }

    modal.classList.remove('hidden');
}


// --- SETUP LISTENERS ---
function setupListeners() {
    // Copy btns
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = () => {
            const input = btn.parentElement.querySelector('input');
            copyText(input.value);
        };
    });
    const copyNoteBtn = document.getElementById('copy-note');
    if (copyNoteBtn) copyNoteBtn.onclick = () => copyText(document.getElementById('detail-note').textContent);

    // Toggle Triple Visibility (Username, Account, Password)
    const toggle = document.getElementById('toggle-password');
    const passInput = document.getElementById('detail-password');
    const userInput = document.getElementById('detail-username');
    const accInput = document.getElementById('detail-account');

    if (toggle && passInput) {
        toggle.onclick = () => {
            passInput.classList.toggle('titanium-shield');
            if (userInput) userInput.classList.toggle('titanium-shield');
            if (accInput) accInput.classList.toggle('titanium-shield');

            const isMasked = passInput.classList.contains('titanium-shield');
            toggle.querySelector('span').textContent = isMasked ? 'visibility' : 'visibility_off';
        };
    }

    // Website
    const webBtn = document.getElementById('open-website');
    const webInput = document.getElementById('detail-website');
    if (webBtn && webInput) {
        webBtn.onclick = () => {
            let url = webInput.value.trim();
            if (!url) return;
            if (!url.startsWith('http')) url = 'https://' + url;
            window.open(url, '_blank');
        };
    }

    // Call btns
    document.querySelectorAll('.call-btn').forEach(btn => {
        btn.onclick = () => {
            const num = btn.parentElement.querySelector('input').value.trim();
            if (num && num !== '-' && num !== '') {
                window.location.href = `tel:${num.replace(/\s+/g, '')}`;
            }
        };
    });

    // Edit Redirect
    const btnEditPage = document.getElementById('btn-edit-page');
    if (btnEditPage) {
        btnEditPage.onclick = () => {
            window.location.href = `modifica_account_privato.html?id=${encodeURIComponent(currentId)}`;
        };
    }

    // Flags & Modal Trigger
    const checkShared = document.getElementById('detail-shared');
    const checkMemo = document.getElementById('detail-hasMemo');
    const checkMemoShared = document.getElementById('detail-isMemoShared');

    if (checkShared && checkMemo && checkMemoShared) {
        const flags = [checkShared, checkMemo, checkMemoShared];
        flags.forEach(el => {
            el.onchange = () => {
                // Mutual Exclusion Logic
                if (el.checked) {
                    flags.forEach(other => { if (other !== el) other.checked = false; });

                    const isSharing = el.id === 'detail-shared' || el.id === 'detail-isMemoShared';

                    if (isSharing) {
                        toggleSharingUI(true);
                        const content = document.getElementById('accessi-content');
                        const chevron = document.getElementById('accessi-chevron');
                        if (content && content.classList.contains('hidden')) {
                            content.classList.remove('hidden');
                            if (chevron) chevron.style.transform = 'rotate(180deg)';
                        }
                        const select = document.getElementById('invite-select');
                        if (select) populateInviteSelect();
                    } else {
                        toggleSharingUI(false);
                        const content = document.getElementById('accessi-content');
                        if (content) content.classList.add('hidden');
                    }
                } else {
                    toggleSharingUI(false);
                }

                // Show Modal instead of Bar
                const isSharingActive = checkShared.checked || checkMemoShared.checked;
                showSaveModal(isSharingActive);
            };
        });
    }

    // Save Button (Inside Modal)
    const btnSave = document.getElementById('btn-save-modal'); // Updated ID
    const inviteSelect = document.getElementById('invite-select');

    if (btnSave) {
        btnSave.onclick = async () => {
            const isShared = checkShared.checked || checkMemoShared.checked;
            const newGuestEmail = inviteSelect ? inviteSelect.value : '';
            const guestsContainer = document.getElementById('guests-list');
            const hasGuests = guestsContainer && guestsContainer.children.length > 0 && !guestsContainer.textContent.includes('Nessun accesso attivo');

            if (isShared && !hasGuests && !newGuestEmail) {
                alert("Per attivare la condivisione, devi selezionare un utente dalla rubrica (o averne già invitato uno).");
                window.closeSaveModal(); // Close modal to let user interact
                toggleSharingUI(true);
                const content = document.getElementById('accessi-content');
                if (content) content.classList.remove('hidden');
                if (inviteSelect) inviteSelect.focus();
                return;
            }

            btnSave.disabled = true;
            btnSave.innerHTML = '<span class="material-symbols-outlined animate-spin">sync</span> Elaborazione...';

            try {
                // 1. New Invite
                if (newGuestEmail) {
                    await addDoc(collection(db, "invites"), {
                        accountId: originalData.docId,
                        accountName: document.getElementById('detail-nomeAccount').value,
                        ownerId: currentUid,
                        ownerEmail: auth.currentUser.email,
                        recipientEmail: newGuestEmail,
                        status: 'pending',
                        type: 'privato',
                        createdAt: new Date().toISOString()
                    });

                    // Optimistic update sharedWith
                    await updateDoc(doc(db, "users", currentUid, "accounts", originalData.docId), {
                        sharedWith: arrayUnion({
                            email: newGuestEmail,
                            status: 'pending',
                            invitedAt: new Date().toISOString()
                        })
                    });
                }

                // 2. Save Flags
                const updatePayload = {
                    shared: checkShared.checked,
                    hasMemo: checkMemo.checked,
                    isMemoShared: checkMemoShared.checked
                };

                // Auto-revoke if unchecked
                if (!checkShared.checked && !checkMemoShared.checked) {
                    // Notify revocation logic here?
                    // For brevity, deleting invites and clearing sharedWith
                    const qInvites = query(collection(db, "invites"),
                        where("accountId", "==", originalData.docId),
                        where("ownerId", "==", currentUid)
                    );
                    const snapInvites = await getDocs(qInvites);
                    const delPromises = snapInvites.docs.map(d => deleteDoc(d.ref));
                    await Promise.all(delPromises);

                    // Notify logic omitted for simplicity or can be added if critical
                    // ...

                    updatePayload.sharedWith = [];
                }

                await updateDoc(doc(db, "users", currentUid, "accounts", originalData.docId), updatePayload);

                if (!checkShared.checked && !checkMemoShared.checked) {
                    renderGuests([]);
                }

                showToast("Modifiche salvate e invito inviato!");
                window.closeSaveModal(); // Close Modal

                // Reload
                await loadAccount(currentUid, originalData.docId);
                if (inviteSelect) inviteSelect.value = "";

            } catch (e) {
                console.error(e);
                alert("Errore salvataggio: " + e.message);
            } finally {
                btnSave.disabled = false;
                // Text reset handled by showSaveModal next time
            }
        };
    }
}

// Global Exports for inline HTML calls (like onclick="toggleReferente()")
window.toggleReferente = () => {
    const content = document.getElementById('referente-content');
    const chevron = document.getElementById('referente-chevron');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
}

window.toggleBanking = () => {
    const content = document.getElementById('banking-content');
    const chevron = document.getElementById('banking-chevron');
    if (content && content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
    } else {
        if (content) content.classList.add('hidden');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
    }
}

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

window.openAttachments = () => {
    if (!currentId) return;
    window.location.href = `gestione_allegati.html?id=${currentId}&ownerId=${ownerId || currentUid}`;
}

window.handleRevoke = async (guestUid, guestEmail) => {
    if (!confirm("Revocare l'accesso a questo utente?")) return;
    try {
        await updateDoc(doc(db, "users", currentUid, "accounts", originalData.docId), {
            sharedWith: arrayRemove(guestUid) // This works for legacy scalar UIDs
            // For objects, arrayRemove requires exact object match, which is hard.
            // Better to Read -> Filter -> Write for array of objects
        });

        // Handling Object array removal manually
        const snap = await getDoc(doc(db, "users", currentUid, "accounts", originalData.docId));
        if (snap.exists()) {
            const data = snap.data();
            if (data.sharedWith && Array.isArray(data.sharedWith)) {
                // Remove matching email or uid
                const newInfo = data.sharedWith.filter(item => {
                    if (typeof item === 'object') return item.email !== guestEmail;
                    return item !== guestUid;
                });
                await updateDoc(doc(db, "users", currentUid, "accounts", originalData.docId), { sharedWith: newInfo });
            }
        }

        // Delete invites
        const q1 = query(collection(db, "invites"), where("accountId", "==", currentId), where("recipientEmail", "==", guestEmail));
        const snap1 = await getDocs(q1);
        snap1.forEach(async d => await deleteDoc(d.ref));

        showToast("Accesso revocato.");
        await loadAccount(currentUid, currentId);
    } catch (e) { alert("Errore revoca: " + e.message); }
}

async function updateAttachmentCount(uid, docId) {
    try {
        const snap = await getDocs(collection(db, "users", uid, "accounts", docId, "attachments"));
        const count = snap.size;
        const badge = document.getElementById('attachment-count');
        if (badge) {
            badge.textContent = count;
            badge.classList.remove('hidden');
        }
    } catch (e) {
        console.error("Error counting attachments", e);
    }
}
