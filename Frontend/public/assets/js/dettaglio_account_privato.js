import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { makeCall } from './utils.js';

// --- STATE ---
let currentUid = null;
let currentId = null;
let ownerId = null;
let isReadOnly = false;
let originalData = {};
let myContacts = [];

// --- HELPERS ---
// --- HELPERS (Global versions in main.js are used where possible) ---
import { showToast } from './ui-core.js';
// (deleteDoc is already imported below in original file, keeping it there)
// Local override to handle specific excluded strings
window.copyText = function (text) {
    if (!text || text === '-' || text === 'Nessuna nota presente.') return;
    navigator.clipboard.writeText(text).then(() => {
        if (window.showToast) window.showToast(window.t("copied_to_clipboard") || "Copiato nel protocollo", "success");
    });
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
        if (window.showToast) window.showToast(window.t("missing_id") || "ID mancante", "error");
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
    const banner = document.createElement('div');
    banner.className = "bg-blue-500/10 border-l-4 border-blue-500 text-blue-400 p-4 mb-4 rounded-xl shadow-sm backdrop-blur-sm";
    banner.innerHTML = `
        <p class="font-bold text-sm" data-t="read_only_mode">Modalità Visualizzazione</p>
        <p class="text-[11px]" data-t="read_only_desc">Questo elemento è condiviso con te in sola lettura.</p>
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
    const confirmed = await window.showConfirmModal(
        "RINUNCIA CONDIVISIONE",
        "Vuoi rimuovere definitivamente questo account dalla tua lista?",
        "RIMUOVI",
        "ANNULLA"
    );
    if (!confirmed) return;

    try {
        // 1. Find invite doc to delete
        const q = query(collection(db, 'invites'),
            where('recipientEmail', '==', auth.currentUser.email),
            where('accountId', '==', currentId)
        );
        const snapshot = await getDocs(q);

        const deletePromises = snapshot.docs.map(d => deleteDoc(d.ref));
        await Promise.all(deletePromises);

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

        if (window.showToast) window.showToast(window.t("revoked_success") || "Rimosso con successo.", "success");
        window.location.href = 'home_page.html';
    } catch (e) {
        console.error("Error removing link", e);
        if (window.showToast) window.showToast(window.t("revoked_error") || "Errore durante la rimozione.", "error");
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
                if (window.showToast) window.showToast(window.t("account_not_found") || "Ops! Account non trovato.", "error");
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
        if (window.showToast) window.showToast(window.t("error_loading") || "Errore caricamento dati.", "error");
    }
}

const getAccentColors = (acc) => {
    // Determine type from flags
    const isBanking = (Array.isArray(acc.banking) && acc.banking.length > 0) || (acc.banking && acc.banking.iban);
    const isMemo = acc.hasMemo || acc._isMemo;
    const isShared = acc.shared || acc.isMemoShared || acc._isShared;

    if (isBanking) return { key: 'emerald', via: 'via-emerald-500/40', bg: 'bg-emerald-500', hex: '#10b981' };
    if (isMemo) return { key: 'amber', via: 'via-amber-500/40', bg: 'bg-amber-500', hex: '#f59e0b' };
    if (isShared) return { key: 'rose', via: 'via-rose-500/40', bg: 'bg-rose-500', hex: '#f43f5e' };
    return { key: 'blue', via: 'via-blue-500/40', bg: 'bg-blue-500', hex: '#3b82f6' };
};

function render(acc) {
    document.title = acc.nomeAccount || 'Dettaglio';

    // 1. DYNAMIC ACCENT COLORS
    const colors = getAccentColors(acc);
    const heroBar = document.getElementById('hero-accent-bar');
    if (heroBar) {
        // Remove old gradients (standardized as via-*)
        heroBar.className = heroBar.className.replace(/via-\w+-\d+\/\d+/, '').trim();
        heroBar.classList.add(colors.via);
    }
    const statusDot = document.getElementById('hero-status-dot');
    if (statusDot) {
        statusDot.className = statusDot.className.replace(/bg-\w+-\d+/, '').replace(/shadow-\w+-\d+\/\d+/, '').trim();
        statusDot.classList.add(colors.bg);
        statusDot.classList.add(`shadow-${colors.key}-500/20`);
    }

    // Header & Hero
    const hNome = document.getElementById('header-nome-account');
    if (hNome) hNome.textContent = acc.nomeAccount || window.t('unnamed') || 'Senza Nome';

    const heroTitle = document.getElementById('hero-title');
    if (heroTitle) heroTitle.textContent = acc.nomeAccount || '-';

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
                avatar.innerHTML = window.getAccountIcon(acc.nomeAccount, 'w-full h-full p-6 text-white');
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
                <div class="space-y-4 p-4 bg-slate-500/5 rounded-2xl border border-white/5 border-glow">
                    <div class="flex items-center justify-between border-b border-white/5 pb-2">
                        <span class="text-[10px] font-bold text-blue-500 uppercase tracking-widest">${window.t('account') || 'Conto'} #${idx + 1}</span>
                    </div>

                    <!-- IBAN -->
                    <div class="flex flex-col gap-1.5">
                        <span class="text-[11px] font-bold text-white/40 uppercase ml-1" data-t="iban">IBAN</span>
                        <div class="flex items-center bg-slate-500/5 rounded-xl border border-white/5 overflow-hidden backdrop-blur-sm border-glow">
                            <input readonly
                                class="flex-1 bg-transparent border-none h-12 px-4 text-sm font-bold focus:ring-0 text-white uppercase font-mono"
                                value="${bank.iban || ''}">
                            <button onclick="window.copyText('${bank.iban}')" class="p-3 text-white/40 hover:text-white border-l border-white/5">
                                <span class="material-symbols-outlined text-base">content_copy</span>
                            </button>
                        </div>
                    </div>

                    <!-- PASSWORD & NOTA -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="flex flex-col gap-1.5">
                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="dispositive_pass">Pass. Dispositiva</span>
                            <div class="flex items-center bg-slate-500/5 rounded-xl border border-white/5 overflow-hidden backdrop-blur-sm border-glow">
                                <input readonly type="text"
                                    class="titanium-shield flex-1 bg-transparent border-none h-10 px-4 text-sm focus:ring-0 text-white"
                                    value="${bank.passwordDispositiva || ''}">
                                <button onclick="const p=this.previousElementSibling; p.classList.toggle('titanium-shield'); this.querySelector('span').textContent=p.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-white/40">
                                    <span class="material-symbols-outlined text-sm">visibility</span>
                                </button>
                                <button onclick="window.copyText(this.parentElement.querySelector('input').value)" class="p-2 text-white/40 hover:text-white border-l border-white/5">
                                    <span class="material-symbols-outlined text-sm">content_copy</span>
                                </button>
                            </div>
                        </div>                        <div class="flex flex-col gap-1.5">
                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="iban_note">Nota IBAN</span>
                            <div class="selectable bg-white/5 p-2.5 rounded-xl text-xs text-white/60 border border-white/5 min-h-[40px] flex items-center italic">
                                ${bank.nota || '-'}
                            </div>
                        </div>
                    </div>

                    <!-- SEZIONE REFERENTE BANCA -->
                    <div class="bg-blue-500/5 p-4 rounded-2xl border border-white/5 space-y-3">
                        <div class="flex items-center gap-2 text-blue-500">
                            <span class="material-symbols-outlined text-sm">contact_phone</span>
                            <span class="text-[10px] font-black uppercase tracking-widest" data-t="bank_referent">Referente Banca</span>
                        </div>
                        <div class="flex flex-col gap-1">
                            <span class="text-[9px] font-bold text-white/40 uppercase ml-1" data-t="full_name">Nome e Cognome</span>
                            <p class="text-sm font-bold text-white ml-1">${bank.referenteNome || ''} ${bank.referenteCognome || ''}</p>
                        </div>
                        <div class="grid grid-cols-2 gap-3">
                            <div class="flex flex-col gap-1">
                                <span class="text-[9px] font-bold text-white/40 uppercase ml-1" data-t="phone">Telefono</span>
                                <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors" onclick="window.makeCall('${bank.referenteTelefono}')">
                                    <span class="material-symbols-outlined text-[16px] text-blue-500">call</span>
                                    <span class="text-xs font-bold text-white/70">${bank.referenteTelefono || '-'}</span>
                                </div>
                            </div>
                            <div class="flex flex-col gap-1">
                                <span class="text-[9px] font-bold text-white/40 uppercase ml-1" data-t="mobile">Cellulare</span>
                                <div class="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/5 cursor-pointer hover:bg-white/10 transition-colors" onclick="window.makeCall('${bank.referenteCellulare}')">
                                    <span class="material-symbols-outlined text-[16px] text-blue-500">smartphone</span>
                                    <span class="text-xs font-bold text-white/70">${bank.referenteCellulare || '-'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Carte collegate -->
                    ${(bank.cards || []).length > 0 ? `
                        <div class="space-y-4 pt-2">
                            <span class="text-[10px] font-bold text-white/40 uppercase tracking-widest ml-1" data-t="linked_tools">Strumenti collegati</span>
                            ${bank.cards.map((card, cIdx) => `
                                <div class="bg-white/5 p-4 rounded-xl border border-white/5 shadow-sm space-y-4">
                                     <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2">
                                            <span class="material-symbols-outlined text-blue-500 text-sm">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                                            <span class="text-xs font-black text-blue-500 uppercase">${card.type === 'Debit' ? (window.t('bancomat') || 'Bancomat') : (window.t('credit_card') || 'Carta di Credito')}</span>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="holder">Titolare</span>
                                            <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-white" value="${card.titolare || ''}">
                                                <button onclick="window.copyText('${card.titolare}')" class="p-2 text-white/40 hover:text-white">
                                                    <span class="material-symbols-outlined text-base">content_copy</span>
                                                </button>
                                            </div>
                                        </div>
                                        ${card.type !== 'Debit' ? `
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="card_type">Tipo Carta</span>
                                            <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-white" value="${card.cardType || ''}">
                                            </div>
                                        </div>
                                        ` : ''}
                                    </div>

                                    <div class="flex flex-col gap-1.5">
                                        <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="number">Numero</span>
                                        <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                            <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm font-mono text-white" value="${card.cardNumber || ''}">
                                            <button onclick="window.copyText('${card.cardNumber}')" class="p-2 text-white/40 hover:text-white">
                                                <span class="material-symbols-outlined text-base">content_copy</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-3 gap-3">
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="expiry">Scadenza</span>
                                            <div class="flex items-center bg-white/5 rounded-lg h-10 px-3 text-sm text-white border border-white/5">
                                                ${card.expiry || '-'}
                                            </div>
                                        </div>
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="ccv">CCV</span>
                                            <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                <input readonly class="flex-1 bg-transparent border-none h-10 px-3 text-sm text-white" value="${card.ccv || ''}">
                                                <button onclick="window.copyText('${card.ccv}')" class="p-2 text-white/40 hover:text-white">
                                                    <span class="material-symbols-outlined text-sm">content_copy</span>
                                                </button>
                                            </div>
                                        </div>
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="pin">PIN</span>
                                            <div class="flex items-center bg-white/5 rounded-lg overflow-hidden border border-white/5">
                                                <input readonly type="text" class="titanium-shield pin-field flex-1 bg-transparent border-none h-10 px-3 text-sm font-mono text-white" 
                                                    value="${card.pin || ''}">
                                                <button onclick="const p=this.previousElementSibling; p.classList.toggle('titanium-shield'); this.querySelector('span').textContent=p.classList.contains('titanium-shield')?'visibility':'visibility_off';" class="p-2 text-white/40">
                                                    <span class="material-symbols-outlined text-sm">visibility</span>
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    ${card.note ? `
                                        <div class="flex flex-col gap-1.5">
                                            <span class="text-[10px] font-bold text-white/40 uppercase ml-1" data-t="tool_note">Note Strumento</span>
                                            <div class="selectable bg-white/5 p-3 rounded-lg text-xs text-white/60 italic border border-white/5">
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
    if (elNote) elNote.textContent = acc.note || window.t('no_notes') || 'Nessuna nota presente.';

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
        list.innerHTML = `<p class="text-xs text-white/40 italic ml-1">${window.t('no_active_access') || 'Nessun accesso attivo.'}</p>`;
        return;
    }

    const activeList = listItems.filter(item => {
        if (typeof item === 'object' && item.status === 'rejected') return false;
        return true;
    });

    if (activeList.length === 0) {
        list.innerHTML = `<p class="text-xs text-white/40 italic ml-1">${window.t('no_active_access') || 'Nessun accesso attivo.'}</p>`;
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
        div.className = "flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5";
        div.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="h-8 w-8 rounded-full bg-cover bg-center border border-primary/20 shrink-0" style="background-image: url('${avatarUrl}')"></div>
                <div class="min-w-0">
                    <p class="text-xs font-bold truncate">${displayName}</p>
                    <p class="text-[10px] text-white/40 truncate flex items-center gap-1">
                        ${displayEmail} 
                        <span class="bg-white/10 px-1 rounded text-[9px] text-white/60">${statusLabel}</span>
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
    sel.innerHTML = `<option value="" disabled selected>${window.t('select_contact_opt') || 'Seleziona un contatto...'}</option>`;

    if (!myContacts || myContacts.length === 0) {
        const opt = document.createElement('option');
        opt.disabled = true;
        opt.textContent = window.t('no_contacts_rubrica') || "Nessun contatto in rubrica";
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
            `<span class="material-symbols-outlined text-lg">save</span> ${window.t('save_and_invite') || 'Salva e invia invito'}` :
            `<span class="material-symbols-outlined text-lg">save</span> ${window.t('save_changes') || 'Salva Modifiche'}`;
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
                if (window.showToast) window.showToast(window.t("select_user_error") || "Seleziona un utente.", "error");
                window.closeSaveModal(); // Close modal to let user interact
                toggleSharingUI(true);
                const content = document.getElementById('accessi-content');
                if (content) content.classList.remove('hidden');
                if (inviteSelect) inviteSelect.focus();
                return;
            }

            btnSave.disabled = true;
            btnSave.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span> ${window.t('processing') || 'Elaborazione...'}`;

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

                if (window.showToast) window.showToast(window.t("changes_saved_invite_sent") || "Modifiche salvate e invito inviato!", "success");
                window.closeSaveModal(); // Close Modal

                // Reload
                await loadAccount(currentUid, originalData.docId);
                if (inviteSelect) inviteSelect.value = "";

            } catch (e) {
                console.error(e);
                if (window.showToast) window.showToast(window.t("error_saving") || "Errore salvataggio.", "error");
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
    const confirmed = await window.showConfirmModal(
        window.t('revoke_access_title') || "REVOCA ACCESSO",
        window.t('revoke_access_confirm') || "Vuoi revocare l'accesso a questo utente?",
        window.t('revoke') || "REVOCA",
        window.t('cancel') || "ANNULLA"
    );
    if (!confirmed) return;
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

        if (window.showToast) window.showToast(window.t("access_revoked") || "Accesso revocato.", "success");
        await loadAccount(currentUid, currentId);
    } catch (e) {
        console.error(e);
        if (window.showToast) window.showToast(window.t("error_revoking") || "Errore revoca.", "error");
    }
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
