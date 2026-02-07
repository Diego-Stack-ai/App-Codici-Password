import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, collection, addDoc, query, where, getDocs, arrayUnion, arrayRemove, increment } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { makeCall } from './utils.js';

// --- 1. GLOBALS & CONFIG ---
window.t = window.t || ((k) => k);

// --- STATE ---
let currentUid = null;
let currentId = null;
let ownerId = null;
let isReadOnly = false;
let originalData = null;
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

    initBaseUI();

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
                const sharedMgmt = document.getElementById('shared-management-section');
                if (sharedMgmt) sharedMgmt.classList.add('hidden');

                // Remove edit icon if read-only
                const btnEdit = document.getElementById('btn-edit-footer');
                if (btnEdit) btnEdit.remove();
            }

            await loadAccount(ownerId, currentId);
            await loadMyRubrica(user.uid);
        } else {
            window.location.href = 'index.html';
        }
    });

    setupListeners();
});

/**
 * Protocol UI Initialization (Fixed 3-Zone Header + Footer)
 */
/**
 * Protocol UI Initialization (Fixed 3-Zone Header + Footer)
 */
/**
 * Protocol UI Initialization (Fixed 3-Zone Header + Footer)
 */
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

        // 3. Inject Content ONLY if containers are empty (prevents duplicates, fixes overwritten)
        const hLeft = document.getElementById('header-left');
        const hCenter = document.getElementById('header-center');
        const hRight = document.getElementById('header-right');

        if (hLeft && hLeft.innerHTML.trim() === '') {
            hLeft.innerHTML = `
                <button id="btn-back-protocol" class="btn-icon-header">
                    <span class="material-symbols-outlined">arrow_back</span>
                </button>
            `;
            document.getElementById('btn-back-protocol').addEventListener('click', () => window.location.href = 'account_privati.html');
        }

        if (hCenter && hCenter.innerHTML.trim() === '') {
            // Placeholder iniziale mentre carichiamo i dati veri
            const loadingText = (window.t && window.t('loading')) || 'Caricamento...';
            hCenter.innerHTML = `<h1 class="header-title animate-pulse" id="header-nome-account">${loadingText}</h1>`;
        }

        if (hRight && hRight.innerHTML.trim() === '') {
            hRight.innerHTML = `
                <a href="home_page.html" class="btn-icon-header">
                    <span class="material-symbols-outlined">home</span>
                </a>
            `;
        }
    };

    // Internal function to apply Footer Button
    const applyFooter = () => {
        const fRight = document.getElementById('footer-right-actions');
        // Only proceed if footer container exists
        if (fRight) {
            // Check if button already exists to avoid duplicates
            if (!document.getElementById('btn-edit-footer')) {
                const btnEdit = document.createElement('button');
                btnEdit.id = 'btn-edit-footer';
                btnEdit.className = 'btn-icon-header';
                btnEdit.title = (window.t && window.t('edit_account')) || 'Modifica Account';
                btnEdit.innerHTML = '<span class="material-symbols-outlined">edit</span>';

                // Robust ID retrieval on click
                btnEdit.addEventListener('click', () => {
                    const params = new URLSearchParams(window.location.search);
                    const idToEdit = currentId || params.get('id');
                    if (idToEdit) {
                        window.location.href = `form_account_privato.html?id=${encodeURIComponent(idToEdit)}`;
                    } else {
                        console.error("ID mancante per modifica");
                    }
                });

                // Prepend to ensure it appears before settings icon if possible, or append.
                // Using prepend to put it to the left of settings
                fRight.prepend(btnEdit);
            }
        }
    };

    // Run immediately
    applyHeader();
    applyFooter();

    // RETRY LOOP: Check every 100ms for 2 seconds to fix race conditions with main.js
    let attempts = 0;
    const interval = setInterval(() => {
        const hLeft = document.getElementById('header-left');
        // RE-APPLY HEADER if missing
        if (!hLeft || hLeft.innerHTML.trim() === '') {
            applyHeader();
        }

        // RE-APPLY FOOTER if missing (main.js loads footer async, so we must retry until it appears)
        if (!document.getElementById('btn-edit-footer')) {
            applyFooter();
        }

        attempts++;
        if (attempts > 30) clearInterval(interval); // Extended to 3s for slower fetch
    }, 100);
}

// --- CORE FUNCTIONS ---

function enableReadOnlyMode() {
    const banner = document.createElement('div');
    banner.className = "read-only-banner";
    banner.innerHTML = `
        <p class="read-only-title" data-t="read_only_mode">Modalità Visualizzazione</p>
        <p class="read-only-desc" data-t="read_only_desc">Questo elemento è condiviso con te in sola lettura.</p>
    `;
    const container = document.querySelector('.detail-content-wrap');
    if (container) container.insertBefore(banner, container.firstChild);

    // Disable checkboxes
    ['detail-shared', 'detail-hasMemo', 'detail-isMemoShared'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.disabled = true;
    });

    // Add Rinuncia Button
    const bottomSection = document.querySelector('.detail-content-wrap section:last-child');
    if (bottomSection) {
        const btnRinuncia = document.createElement('button');
        btnRinuncia.className = "auth-btn-primary mt-6 !bg-red-500/10 !text-red-400 border border-red-500/20";
        btnRinuncia.innerHTML = `<span class="material-symbols-outlined">person_remove</span> Rinuncia alla condivisione`;
        btnRinuncia.addEventListener('click', removeSharedLink);
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
    const isBanking = acc.isBanking === true;
    const isMemo = acc.hasMemo || acc._isMemo;
    const isShared = acc.shared || acc.isMemoShared || acc._isShared;

    if (isBanking) return { key: 'emerald', via: 'via-emerald-500/40', bg: 'bg-emerald-500', hex: '#10b981', rgb: '16, 185, 129' };
    if (isMemo) return { key: 'amber', via: 'via-amber-500/40', bg: 'bg-amber-500', hex: '#f59e0b', rgb: '245, 158, 11' };
    if (isShared) return { key: 'rose', via: 'via-rose-500/40', bg: 'bg-rose-500', hex: '#f43f5e', rgb: '244, 63, 94' };
    return { key: 'blue', via: 'via-blue-500/40', bg: 'bg-blue-500', hex: '#3b82f6', rgb: '59, 130, 246' };
};

function render(acc) {
    document.title = acc.nomeAccount || 'Dettaglio';

    // 1. DYNAMIC ACCENT COLORS
    const colors = getAccentColors(acc);

    // Set CSS variable on container for Titanium Glow and badges
    const container = document.querySelector('.base-container');
    if (container) {
        container.style.setProperty('--accent-rgb', colors.rgb);
        container.style.setProperty('--accent-hex', colors.hex);
    }

    const heroBar = document.getElementById('hero-accent-bar');
    if (heroBar) {
        heroBar.style.backgroundColor = colors.hex;
        heroBar.style.boxShadow = `0 0 15px ${colors.hex}66`;
    }
    const statusDot = document.getElementById('hero-status-dot');
    if (statusDot) {
        statusDot.style.backgroundColor = colors.hex;
        statusDot.style.boxShadow = `0 0 15px ${colors.hex}66`;
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
    let bankingArr = [];
    if (Array.isArray(acc.banking)) {
        bankingArr = acc.banking;
    } else if (acc.banking && acc.banking.iban) {
        bankingArr = [acc.banking];
    } else if (acc.iban && acc.iban.trim() !== '') {
        bankingArr = [{ iban: acc.iban, cards: [] }];
    }

    const hasBanking = acc.isBanking === true;
    const sectionBanking = document.getElementById('section-banking');
    if (sectionBanking) {
        sectionBanking.classList.toggle('hidden', !hasBanking);
    }

    // Toggle suggerimento bancario
    const bankingPrompt = document.getElementById('add-banking-prompt');
    if (bankingPrompt) {
        bankingPrompt.classList.toggle('hidden', hasBanking);
    }

    if (hasBanking) {
        const bankingContent = document.getElementById('banking-content');
        if (bankingContent) {
            bankingContent.innerHTML = bankingArr.map((bank, idx) => `
                <div class="space-y-4 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 border-glow relative">
                    <div class="flex items-center justify-between border-b border-white/5 pb-2">
                        <span class="text-[9px] font-black text-emerald-500 uppercase tracking-[0.2em]">${window.t('account') || 'Conto'} #${idx + 1}</span>
                    </div>

                    <!-- IBAN Principal -->
                    <div class="bg-black/20 p-2.5 rounded-xl border border-white/5">
                        <div class="micro-data-row">
                            <span class="micro-data-label" data-t="iban">Codice IBAN</span>
                            <span class="micro-data-value text-emerald-400 font-mono tracking-wider truncate">${bank.iban || '-'}</span>
                            <button class="micro-btn-copy-inline relative z-10" data-action="copy-text" data-text="${bank.iban}">
                                <span class="material-symbols-outlined !text-[14px]">content_copy</span>
                            </button>
                        </div>
                    </div>

                    <!-- PASSWORD & NOTA -->
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div class="bg-black/20 p-2.5 rounded-xl border border-white/5 h-full">
                            <div class="micro-data-row">
                                <span class="micro-data-label" data-t="dispositive_pass">Pass. Disp.</span>
                                <span id="bank-pass-${idx}" class="micro-data-value base-shield truncate">${bank.passwordDispositiva || '••••••••'}</span>
                                <div class="flex items-center gap-1.5">
                                    <button class="micro-btn-copy-inline relative z-10 !bg-transparent" data-action="toggle-visibility">
                                        <span class="material-symbols-outlined !text-[14px]">visibility</span>
                                    </button>
                                    <button class="micro-btn-copy-inline relative z-10" data-action="copy-text" data-text="${bank.passwordDispositiva}">
                                        <span class="material-symbols-outlined !text-[14px]">content_copy</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="bg-black/20 p-2.5 rounded-xl border border-white/5 h-full">
                            <div class="micro-data-row">
                                <span class="micro-data-label" data-t="iban_note">Nota Rapida</span>
                                <span class="micro-data-value italic text-white/50 truncate">${bank.nota || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- SEZIONE REFERENTE BANCA -->
                    <div class="bg-emerald-500/10 p-3 rounded-xl border border-white/5 space-y-2.5">
                        <div class="flex items-center gap-2 text-emerald-500/80">
                            <span class="material-symbols-outlined text-xs">contact_emergency</span>
                            <span class="text-[9px] font-black uppercase tracking-widest" data-t="bank_referent">Referente dedicato</span>
                        </div>
                        <div class="micro-data-row px-1">
                             <span class="micro-data-value font-black text-white text-[11px] uppercase tracking-wide">${bank.referenteNome || 'No Name'}</span>
                        </div>
                        <div class="grid grid-cols-2 gap-2">
                            <div class="micro-data-row bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer hover:bg-emerald-500/10 transition-all group"
                                data-action="make-call" data-number="${bank.referenteTelefono}">
                                <span class="material-symbols-outlined text-[14px] text-emerald-500/50 group-hover:text-emerald-400">call</span>
                                <span class="micro-data-value text-[10px] font-bold text-white/60 group-hover:text-white">${bank.referenteTelefono || '-'}</span>
                            </div>
                            <div class="micro-data-row bg-black/20 p-2 rounded-lg border border-white/5 cursor-pointer hover:bg-emerald-500/10 transition-all group"
                                data-action="make-call" data-number="${bank.referenteCellulare}">
                                <span class="material-symbols-outlined text-[14px] text-emerald-500/50 group-hover:text-emerald-400">smartphone</span>
                                <span class="micro-data-value text-[10px] font-bold text-white/60 group-hover:text-white">${bank.referenteCellulare || '-'}</span>
                            </div>
                        </div>
                    </div>

                    <!-- Carte collegate -->
                    ${(bank.cards || []).length > 0 ? `
                        <div class="space-y-3 pt-1">
                            <span class="text-[9px] font-black text-white/20 uppercase tracking-[0.2em] ml-1" data-t="linked_tools">Strumenti di Pagamento</span>
                            ${bank.cards.map((card, cIdx) => `
                                <div class="bg-black/10 p-3 rounded-xl border border-white/5 space-y-3 border-glow">
                                     <div class="flex items-center justify-between">
                                        <div class="flex items-center gap-2 text-emerald-500/80">
                                            <span class="material-symbols-outlined text-xs">${card.type === 'Debit' ? 'account_balance_wallet' : 'credit_card'}</span>
                                            <span class="text-[10px] font-black uppercase tracking-widest">${card.type === 'Debit' ? (window.t('bancomat') || 'Bancomat') : (window.t('credit_card') || 'Carta di Credito')}</span>
                                        </div>
                                    </div>

                                    <div class="space-y-2">
                                        <div class="micro-data-row bg-black/20 p-2 rounded-lg border border-white/5">
                                            <span class="micro-data-label" data-t="holder">Titolare</span>
                                            <span class="micro-data-value truncate text-[10px] font-bold uppercase">${card.titolare || '-'}</span>
                                            <button class="micro-btn-copy-inline relative z-10" data-action="copy-text" data-text="${card.titolare}">
                                                <span class="material-symbols-outlined !text-[12px]">content_copy</span>
                                            </button>
                                        </div>
                                        <div class="micro-data-row bg-black/20 p-2 rounded-lg border border-white/5">
                                            <span class="micro-data-label" data-t="number">Numero</span>
                                            <span class="micro-data-value truncate text-[10px] font-mono font-bold tracking-widest">${card.cardNumber || '-'}</span>
                                            <button class="micro-btn-copy-inline relative z-10" data-action="copy-text" data-text="${card.cardNumber}">
                                                <span class="material-symbols-outlined !text-[12px]">content_copy</span>
                                            </button>
                                        </div>
                                    </div>

                                    <div class="grid grid-cols-4 gap-2">
                                        <div class="col-span-2 micro-data-row bg-black/20 p-2 rounded-lg border border-white/5">
                                            <span class="micro-data-label !min-w-0 mr-2" data-t="expiry">Scad.</span>
                                            <span class="micro-data-value text-[10px] font-bold">${card.expiry || '-'}</span>
                                        </div>
                                        <div class="col-span-1 micro-data-row bg-black/20 p-2 rounded-lg border border-white/5">
                                            <span class="micro-data-label !min-w-0 mr-2" data-t="ccv">CCV</span>
                                            <span class="micro-data-value text-[10px] font-bold">${card.ccv || '-'}</span>
                                        </div>
                                        <div class="col-span-1 micro-data-row bg-black/20 p-2 rounded-lg border border-white/5">
                                            <span class="micro-data-label !min-w-0 mr-2" data-t="pin">PIN</span>
                                            <span class="micro-data-value base-shield font-mono text-[10px]">${card.pin || '••••'}</span>
                                            <button class="micro-btn-copy-inline relative z-10 !bg-transparent" data-action="toggle-visibility">
                                                <span class="material-symbols-outlined !text-[12px]">visibility</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            `).join('');
        }
    }

    const elNote = document.getElementById('detail-note');
    if (elNote) elNote.textContent = acc.note || '-';

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
        div.className = "rubrica-list-item"; // Reuse semantic class
        div.innerHTML = `
            <div class="rubrica-item-info-row">
                <div class="rubrica-item-avatar" style="background-image: url('${avatarUrl}'); background-size: cover;"></div>
                <div class="rubrica-item-info">
                    <p class="truncate m-0 rubrica-item-name">${displayName}</p>
                    <p class="truncate m-0 opacity-60 text-[10px]">${displayEmail} <span class="badge-status">${statusLabel}</span></p>
                </div>
            </div>
            <div class="rubrica-item-actions">
                <button class="btn-revoke-guest rubrica-item-action" data-uid="${guestUid}" data-email="${displayEmail}" title="Rimuovi Accesso">
                    <span class="material-symbols-outlined">remove_circle</span>
                </button>
            </div>
        `;
        list.appendChild(div);

        // Add Listener
        div.querySelector('.btn-revoke-guest').addEventListener('click', (e) => {
            const uid = e.currentTarget.getAttribute('data-uid');
            const email = e.currentTarget.getAttribute('data-email');
            window.handleRevoke(uid, email);
        });
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
        btn.addEventListener('click', () => {
            const input = btn.parentElement.querySelector('input');
            copyText(input.value);
        });
    });
    const copyNoteBtn = document.getElementById('copy-note');
    if (copyNoteBtn) {
        copyNoteBtn.addEventListener('click', () => {
            copyText(document.getElementById('detail-note').textContent);
        });
    }

    // Toggle Password Visibility (ONLY password)
    const toggle = document.getElementById('toggle-password');
    const passInput = document.getElementById('detail-password');

    if (toggle && passInput) {

        // Stato iniziale: nascosta
        passInput.classList.add('base-shield');
        passInput.type = "password";

        toggle.addEventListener('click', () => {
            const isMasked = passInput.classList.contains('base-shield');

            passInput.classList.toggle('base-shield');
            passInput.type = isMasked ? "text" : "password";

            const icon = toggle.querySelector('span');
            if (icon) icon.textContent = isMasked ? 'visibility_off' : 'visibility';
        });
    }

    // Website
    const webBtn = document.getElementById('open-website');
    const webInput = document.getElementById('detail-website');
    if (webBtn && webInput) {
        webBtn.addEventListener('click', () => {
            let url = webInput.value.trim();
            if (!url) return;
            if (!url.startsWith('http')) url = 'https://' + url;
            window.open(url, '_blank');
        });
    }

    // Theme Toggle
    const themeBtn = document.getElementById('theme-toggle-detail');
    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            const html = document.documentElement;
            const isDark = html.classList.contains('dark');
            html.classList.toggle('dark');
            localStorage.setItem('theme', isDark ? 'light' : 'dark');
        });
    }

    // Call btns
    document.querySelectorAll('.call-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const num = btn.parentElement.querySelector('input').value.trim();
            if (num && num !== '-' && num !== '') {
                window.location.href = `tel:${num.replace(/\s+/g, '')}`;
            }
        });
    });

    // Coordinate Bancarie Toggle
    const bankingBtn = document.getElementById('banking-toggle');
    if (bankingBtn) {
        bankingBtn.addEventListener('click', () => window.toggleBanking());
    }

    // Banking Info Modal
    const btnBankingInfo = document.getElementById('btn-banking-info');
    if (btnBankingInfo) {
        btnBankingInfo.addEventListener('click', () => {
            if (window.showWarningModal) {
                window.showWarningModal(
                    "AGGIUNGI CONTO BANCARIO",
                    "Per gestire IBAN e strumenti di pagamento, entra in modalità <b>Modifica</b> e attiva l'opzione <b>'Account Bancario'</b> nelle impostazioni dell'account."
                );
            }
        });
    }

    // Safe Translation Helper
    const t = (k) => (window.t && typeof window.t === 'function') ? window.t(k) : k;

    // Flags & Modal Trigger
    const checkShared = document.getElementById('detail-shared');
    const checkMemo = document.getElementById('detail-hasMemo');
    const checkMemoShared = document.getElementById('detail-isMemoShared');

    if (checkShared && checkMemo && checkMemoShared) {
        const flags = [checkShared, checkMemo, checkMemoShared];
        flags.forEach(el => {
            el.addEventListener('change', () => {
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
            });
        });
    }

    // TOGGLE PASSWORD LOGIC (Specific)
    const togglePwdBtnDetail = document.getElementById('toggle-password');
    const passwordInputDetail = document.getElementById('detail-password');

    if (togglePwdBtnDetail && passwordInputDetail) {
        // Initial State
        passwordInputDetail.classList.add('base-shield');
        passwordInputDetail.type = "password";

        // Remove old listeners by cloning
        const newBtn = togglePwdBtnDetail.cloneNode(true);
        togglePwdBtnDetail.parentNode.replaceChild(newBtn, togglePwdBtnDetail);

        newBtn.addEventListener('click', () => {
            const isMasked = passwordInputDetail.classList.contains('base-shield');

            passwordInputDetail.classList.toggle('base-shield');
            passwordInputDetail.type = isMasked ? "text" : "password";

            const icon = newBtn.querySelector('span');
            if (icon) icon.textContent = isMasked ? 'visibility_off' : 'visibility';
        });
    }

    // GLOBAL DELEGATION FOR BANKING TOGGLES
    if (!window._bankingToggleInit) {
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-action="toggle-visibility"]');
            if (!btn) return;

            // Find value span in the same row
            const wrapper = btn.closest(".micro-data-row");
            const valueSpan = wrapper ? wrapper.querySelector(".micro-data-value") : null;

            if (!valueSpan) return;

            // Toggle logic for span elements using base-shield class
            const isMasked = valueSpan.classList.contains('base-shield');

            if (isMasked) {
                valueSpan.classList.remove('base-shield');
            } else {
                valueSpan.classList.add('base-shield');
            }

            const icon = btn.querySelector('span');
            if (icon) icon.textContent = isMasked ? 'visibility_off' : 'visibility';
        });
        window._bankingToggleInit = true;
    }


    // Save Button (Inside Modal)
    const btnSave = document.getElementById('btn-save-modal'); // Updated ID
    const inviteSelect = document.getElementById('invite-select');

    if (btnSave) {
        // Remove old listeners
        const newBtnSave = btnSave.cloneNode(true);
        btnSave.parentNode.replaceChild(newBtnSave, btnSave);

        newBtnSave.addEventListener('click', async () => {
            const isShared = checkShared.checked || checkMemoShared.checked;
            const newGuestEmail = inviteSelect ? inviteSelect.value : '';
            const guestsContainer = document.getElementById('guests-list');
            const hasGuests = guestsContainer && guestsContainer.children.length > 0 && !guestsContainer.textContent.includes('Nessun accesso attivo');

            if (isShared && !hasGuests && !newGuestEmail) {
                if (window.showToast) window.showToast(t("select_user_error") || "Seleziona un utente.", "error");
                window.closeSaveModal(); // Close modal to let user interact
                toggleSharingUI(true);
                const content = document.getElementById('accessi-content');
                if (content) content.classList.remove('hidden');
                if (inviteSelect) inviteSelect.focus();
                return;
            }

            newBtnSave.disabled = true;
            newBtnSave.innerHTML = `<span class="material-symbols-outlined animate-spin">sync</span> ${t("processing") || 'Elaborazione...'}`;

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
                    const qInvites = query(collection(db, "invites"),
                        where("accountId", "==", originalData.docId),
                        where("ownerId", "==", currentUid)
                    );
                    const snapInvites = await getDocs(qInvites);
                    const delPromises = snapInvites.docs.map(d => deleteDoc(d.ref));
                    await Promise.all(delPromises);

                    updatePayload.sharedWith = [];
                }

                await updateDoc(doc(db, "users", currentUid, "accounts", originalData.docId), updatePayload);

                if (!checkShared.checked && !checkMemoShared.checked) {
                    renderGuests([]);
                }

                if (window.showToast) window.showToast(t("changes_saved_invite_sent") || "Modifiche salvate e invito inviato!", "success");
                window.closeSaveModal(); // Close Modal

                // Reload
                await loadAccount(currentUid, originalData.docId);
                if (inviteSelect) inviteSelect.value = "";

            } catch (e) {
                console.error(e);
                if (window.showToast) window.showToast(t("error_saving") || "Errore salvataggio.", "error");
            } finally {
                newBtnSave.disabled = false;
                // Text reset handled by showSaveModal next time
            }
        });
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
