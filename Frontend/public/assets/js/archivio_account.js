import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDocs, collection, query, where, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

let allArchived = [];
let currentUser = null;
let currentSwipeList = null;
let currentContext = 'all';

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);

document.addEventListener('DOMContentLoaded', () => {
    // 1. Context Selector
    const selector = document.getElementById('archive-context-select');
    if (selector) {
        selector.addEventListener('change', (e) => {
            currentContext = e.target.value;
            loadArchived();
        });
    }

    // 2. Search Area
    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', () => filterAndRender());
    }

    // 3. Empty Trash
    const btnEmpty = document.getElementById('btn-empty-trash');
    if (btnEmpty) {
        btnEmpty.addEventListener('click', handleEmptyTrash);
    }

    // 4. Delegated Actions (Copy & Toggle Visibility)
    const container = document.getElementById('accounts-container');
    if (container) {
        container.addEventListener('click', (e) => {
            // Copy Action
            const btnCopy = e.target.closest('.copy-btn-dynamic');
            if (btnCopy) {
                e.stopPropagation();
                const text = btnCopy.dataset.copy;
                navigator.clipboard.writeText(text).then(() => {
                    showToast("Copiato!", "success");
                });
                return;
            }

            // Visibility Action
            const btnEye = e.target.closest('.btn-toggle-eye');
            if (btnEye) {
                e.stopPropagation();
                toggleTripleVisibility(btnEye.dataset.id);
                return;
            }

            // Restore Action
            const btnRestore = e.target.closest('.btn-restore-acc');
            if (btnRestore) {
                e.stopPropagation();
                handleRestore(btnRestore.dataset.id);
                return;
            }
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadCompanies();
            await loadArchived();
        } else {
            window.location.href = 'index.html';
        }
    });
});

async function loadCompanies() {
    const selector = document.getElementById('archive-context-select');
    if (!selector) return;

    try {
        const snap = await getDocs(collection(db, "users", currentUser.uid, "aziende"));
        snap.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.textContent = data.ragioneSociale || doc.id;
            selector.appendChild(option);
        });
    } catch (e) {
        console.error(e);
    }
}

async function loadArchived() {
    const container = document.getElementById('accounts-container');
    if (!container) return;

    container.innerHTML = `
        <div class="flex-center-col py-10 opacity-50">
            <div class="size-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <span class="text-xs uppercase tracking-widest font-bold" data-t="searching_archives">Ricerca archivi...</span>
        </div>`;

    try {
        let results = [];
        // Privato
        if (currentContext === 'all' || currentContext === 'privato') {
            const snap = await getDocs(query(collection(db, "users", currentUser.uid, "accounts"), where("isArchived", "==", true)));
            snap.forEach(d => results.push({ ...d.data(), id: d.id, context: 'privato' }));
        }
        // Aziende
        if (currentContext === 'all') {
            const bizSnap = await getDocs(collection(db, "users", currentUser.uid, "aziende"));
            for (const b of bizSnap.docs) {
                const snap = await getDocs(query(collection(db, "users", currentUser.uid, "aziende", b.id, "accounts"), where("isArchived", "==", true)));
                snap.forEach(d => results.push({ ...d.data(), id: d.id, context: b.id, businessName: b.data().ragioneSociale }));
            }
        } else if (currentContext !== 'privato') {
            const snap = await getDocs(query(collection(db, "users", currentUser.uid, "aziende", currentContext, "accounts"), where("isArchived", "==", true)));
            snap.forEach(d => results.push({ ...d.data(), id: d.id, context: currentContext }));
        }

        allArchived = results;
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast("Errore caricamento", "error");
    }
}

function filterAndRender() {
    const searchVal = document.querySelector('input[type="search"]')?.value.toLowerCase() || '';
    const filtered = allArchived.filter(acc =>
        (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
        (acc.username || acc.utente || '').toLowerCase().includes(searchVal)
    );

    const container = document.getElementById('accounts-container');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="flex-center-col py-16 opacity-30 text-center">
                <span class="material-symbols-outlined text-5xl mb-4">inventory_2</span>
                <p class="text-xs font-bold uppercase tracking-widest" data-t="no_accounts_found">Nessun account trovato</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(acc => {
        const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
        return `
            <div class="glass-card swipe-row overflow-hidden relative" id="arch-${acc.id}" data-id="${acc.id}" style="padding:0;">
                <!-- Swipe Backgrounds -->
                <div class="absolute inset-y-0 left-0 w-full flex items-center pl-6 bg-red-500/20 opacity-0 swipe-bg-delete">
                    <span class="material-symbols-outlined text-red-500">delete_forever</span>
                </div>
                <div class="absolute inset-y-0 right-0 w-full flex items-center justify-end pr-6 bg-emerald-500/20 opacity-0 swipe-bg-restore">
                    <span class="material-symbols-outlined text-emerald-500">restore_from_trash</span>
                </div>

                <!-- Card Content -->
                <div class="swipe-content relative z-10 bg-[#0f172a] p-4 flex gap-4 transition-transform border-l-4 border-blue-500/50">
                    <img src="${avatar}" class="size-10 rounded-xl object-cover bg-white/5 border border-white/10 shrink-0">
                    
                    <div class="flex-1 min-w-0">
                        <div class="flex justify-between items-start gap-2 mb-3">
                            <h4 class="text-sm font-bold truncate text-white">${acc.nomeAccount || 'Senza Nome'}</h4>
                            ${acc.businessName ? `<span class="text-[8px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-black uppercase">${acc.businessName}</span>` : ''}
                        </div>

                        <div class="flex-col-gap-2">
                             ${renderDataRow(acc.id, 'User', acc.username || acc.utente, 'username')}
                             ${renderDataRow(acc.id, 'Acc', acc.account, 'account')}
                             ${renderDataRow(acc.id, 'Pass', acc.password, 'password')}
                        </div>
                    </div>

                    <div class="flex-center-col gap-2 shrink-0">
                         <button class="btn-restore-acc size-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex-center border border-emerald-500/20 hover:bg-emerald-500/20 transition-all" data-id="${acc.id}" title="Ripristina">
                            <span class="material-symbols-outlined text-lg">restore_from_trash</span>
                         </button>
                         <button class="btn-toggle-eye size-8 rounded-lg bg-white/5 text-white/40 flex-center border border-white/10 hover:bg-white/10 transition-all" data-id="${acc.id}" title="Mostra/Nascondi">
                            <span id="pass-eye-${acc.id}" class="material-symbols-outlined text-lg">visibility</span>
                         </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    setupSwipe();
}

function renderDataRow(id, label, value, type) {
    if (!value) return '';
    return `
        <div class="flex items-center gap-2 bg-white/5 px-2 py-1 rounded-lg border border-white/5">
            <span class="text-[9px] font-black text-white/30 uppercase w-8">${label}</span>
            <span id="${type}-text-${id}" class="text-xs font-mono text-white/80 truncate flex-1">••••••••</span>
            <button class="copy-btn-dynamic text-white/20 hover:text-blue-400 transition-colors" data-copy="${value.replace(/"/g, '&quot;')}" title="Copia">
                <span class="material-symbols-outlined text-sm">content_copy</span>
            </button>
        </div>
    `;
}

function setupSwipe() {
    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.2,
        onSwipeLeft: (item) => handleRestore(item.dataset.id),
        onSwipeRight: (item) => handleDeleteForever(item.dataset.id)
    });
}

function toggleTripleVisibility(id) {
    const eye = document.getElementById(`pass-eye-${id}`);
    const rows = ['username', 'account', 'password'];

    const isHidden = eye.textContent === 'visibility';
    eye.textContent = isHidden ? 'visibility_off' : 'visibility';

    rows.forEach(type => {
        const textEl = document.getElementById(`${type}-text-${id}`);
        if (!textEl) return;

        if (isHidden) {
            // Reveal: find value in copy btn
            const btn = textEl.parentElement.querySelector('.copy-btn-dynamic');
            textEl.textContent = btn ? btn.dataset.copy : '---';
            textEl.classList.remove('text-white/80');
            textEl.classList.add('text-blue-300');
        } else {
            // Hide
            textEl.textContent = '••••••••';
            textEl.classList.add('text-white/80');
            textEl.classList.remove('text-blue-300');
        }
    });
}

async function handleRestore(id) {
    const item = allArchived.find(a => a.id === id);
    if (!item) return;

    try {
        const ref = getCollectionRef(id, item.context);
        await updateDoc(ref, { isArchived: false });
        showToast("Ripristinato", "success");
        allArchived = allArchived.filter(a => a.id !== id);
        const el = document.getElementById(`arch-${id}`);
        if (el) {
            el.style.transform = 'scale(0.9)';
            el.style.opacity = '0';
            setTimeout(() => filterAndRender(), 300);
        } else {
            filterAndRender();
        }
    } catch (e) {
        console.error(e);
        showToast("Errore", "error");
    }
}

async function handleDeleteForever(id) {
    if (!window.showInputModal) return;
    const confirm = await window.showInputModal("ELIMINA PER SEMPRE", "", "Scrivi 'SI' per confermare l'eliminazione definitiva.");
    if (confirm !== 'SI') return filterAndRender(); // Reset swipe

    try {
        const item = allArchived.find(a => a.id === id);
        const ref = getCollectionRef(id, item.context);
        await deleteDoc(ref);
        showToast("Eliminato definitivamente", "success");
        allArchived = allArchived.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast("Errore", "error");
    }
}

async function handleEmptyTrash() {
    if (allArchived.length === 0) return;
    if (!window.showInputModal) return;

    const confirm = await window.showInputModal("SVUOTA CESTINO", "", "Scrivi 'SVUOTA' per eliminare tutto definitivamente.");
    if (confirm !== 'SVUOTA') return;

    try {
        const batch = writeBatch(db);
        allArchived.forEach(acc => {
            batch.delete(getCollectionRef(acc.id, acc.context));
        });
        await batch.commit();
        showToast("Cestino svuotato", "success");
        allArchived = [];
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast("Errore", "error");
    }
}

function getCollectionRef(id, context) {
    if (context === 'privato') return doc(db, "users", currentUser.uid, "accounts", id);
    return doc(db, "users", currentUser.uid, "aziende", context, "accounts", id);
}
