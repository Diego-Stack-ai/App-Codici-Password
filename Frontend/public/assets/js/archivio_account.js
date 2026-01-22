import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, where, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- STATE ---
let allArchived = [];
let currentUser = null;
let currentSwipeList = null;
let currentContext = 'all'; // 'all', 'privato' or companyId

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

document.addEventListener('DOMContentLoaded', () => {
    const selector = document.getElementById('archive-context-select');
    if (selector) {
        selector.addEventListener('change', (e) => {
            currentContext = e.target.value;
            loadArchived();
        });
    }

    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    const btnEmpty = document.getElementById('btn-empty-trash');
    if (btnEmpty) {
        btnEmpty.addEventListener('click', handleEmptyTrash);
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

    // Delegated actions (Restore/Copy button)
    const container = document.getElementById('accounts-container');
    if (container) {
        container.onclick = function (e) {
            const btn = e.target.closest('.copy-btn-dynamic');
            if (btn) {
                e.preventDefault(); e.stopPropagation();
                const text = btn.getAttribute('data-copy');
                navigator.clipboard.writeText(text).then(() => {
                    const icon = btn.querySelector('span');
                    const old = icon.textContent; icon.textContent = 'check';
                    setTimeout(() => icon.textContent = old, 1500);
                    showToast("Copiato negli appunti!");
                });
            }
        };
    }

    // Unified Visibility Toggle (User, Account, Password)
    window.toggleTripleVisibility = (id) => {
        const eye = document.getElementById(`pass-eye-${id}`);
        const userText = document.getElementById(`user-text-${id}`);
        const accText = document.getElementById(`acc-text-${id}`);
        const passText = document.getElementById(`pass-text-${id}`);

        const row = document.getElementById(`arch-${id}`);
        if (!row || !eye) return;

        const copyBtns = row.querySelectorAll('.copy-btn-dynamic');
        let userVal = '', accVal = '', passVal = '';

        copyBtns.forEach(btn => {
            const title = (btn.getAttribute('title') || '').toLowerCase();
            const val = btn.getAttribute('data-copy') || '';
            if (title.includes('username') || title.includes('utente')) userVal = val;
            else if (title.includes('account')) accVal = val;
            else if (title.includes('password')) passVal = val;
        });

        const isHidden = eye.textContent === 'visibility';
        const dots = '••••••••';

        if (isHidden) {
            eye.textContent = 'visibility_off';
            if (userText) userText.textContent = userVal;
            if (accText) accText.textContent = accVal;
            if (passText) passText.textContent = passVal;
        } else {
            eye.textContent = 'visibility';
            if (userText) userText.textContent = dots;
            if (accText) accText.textContent = dots;
            if (passText) passText.textContent = dots;
        }
    };

    window.handleRestore = async (id) => {
        try {
            const item = allArchived.find(a => a.id === id);
            if (!item) return;
            const ref = getCollectionRef(id, item.context);
            await updateDoc(ref, { isArchived: false });
            showToast("Account ripristinato", "success");
            allArchived = allArchived.filter(a => a.id !== id);
            filterAndRender();
        } catch (e) {
            console.error(e);
            showToast("Errore ripristino", "error");
        }
    };
});

async function loadCompanies() {
    try {
        const selector = document.getElementById('archive-context-select');
        if (!selector) return;

        const colRef = collection(db, "users", currentUser.uid, "aziende");
        const snap = await getDocs(colRef);

        // Append company options
        snap.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.classList.add('bg-[#0a162a]', 'text-white');
            option.textContent = `Archivio ${data.ragioneSociale || 'Azienda'}`;
            selector.appendChild(option);
        });

        // Set initial selector value based on currentContext
        selector.value = currentContext;

    } catch (e) {
        console.error("Errore caricamento aziende selector", e);
    }
}

async function loadArchived() {
    const container = document.getElementById('accounts-container');
    if (container) {
        container.innerHTML = `
            <div class="text-center py-10 text-gray-500 flex flex-col items-center">
                <span class="material-symbols-outlined animate-spin text-3xl mb-2 text-primary">progress_activity</span>
                Caricamento in corso...
            </div>`;
    }

    try {
        let results = [];

        if (currentContext === 'all' || currentContext === 'privato') {
            const qPrivato = query(
                collection(db, "users", currentUser.uid, "accounts"),
                where("isArchived", "==", true)
            );
            const snapPrivato = await getDocs(qPrivato);
            snapPrivato.forEach(doc => {
                results.push({ ...doc.data(), id: doc.id, context: 'privato' });
            });
        }

        if (currentContext === 'all') {
            const businessesSnap = await getDocs(collection(db, "users", currentUser.uid, "aziende"));
            const promises = businessesSnap.docs.map(async (bizDoc) => {
                const qBizAccounts = query(
                    collection(db, "users", currentUser.uid, "aziende", bizDoc.id, "accounts"),
                    where("isArchived", "==", true)
                );
                const snapBiz = await getDocs(qBizAccounts);
                snapBiz.forEach(accDoc => {
                    results.push({
                        ...accDoc.data(),
                        id: accDoc.id,
                        context: bizDoc.id,
                        businessName: bizDoc.data().ragioneSociale || 'Azienda'
                    });
                });
            });
            await Promise.all(promises);
        } else if (currentContext !== 'privato') {
            // Specific Company selective view
            const qBiz = query(
                collection(db, "users", currentUser.uid, "aziende", currentContext, "accounts"),
                where("isArchived", "==", true)
            );
            const snapBiz = await getDocs(qBiz);
            snapBiz.forEach(doc => {
                results.push({ ...doc.data(), id: doc.id, context: currentContext });
            });
        }

        allArchived = results;
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast("Errore caricamento", "error");
        if (container) container.innerHTML = `<div class="text-center py-10 text-red-500">Errore: ${e.message}</div>`;
    }
}

function filterAndRender() {
    const searchVal = document.querySelector('input[type="search"]')?.value.toLowerCase() || '';

    let filtered = allArchived.filter(acc =>
        (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
        (acc.username || '').toLowerCase().includes(searchVal)
    );

    const container = document.getElementById('accounts-container');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="text-center py-10 opacity-70 flex flex-col items-center">
                <div class="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mb-3">
                    <span class="material-symbols-outlined text-3xl text-amber-600">inventory_2</span>
                </div>
                <p class="text-gray-500 font-medium">Nessun account in archivio.</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(acc => {
        const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';

        // Style Logic - Titanium Style with Colored Borders
        let borderClass = 'border-l-4 border-blue-500'; // Standard Blue
        let iconColor = 'text-blue-400';

        const isMemo = !!acc.hasMemo || !!acc.isMemoShared || acc.type === 'memorandum' || acc.category === 'memorandum';
        const isShared = !!acc.shared || !!acc.isSharedWithMe;

        if (isShared && isMemo) {
            borderClass = 'border-l-4 border-emerald-500';
            iconColor = 'text-emerald-400';
        } else if (isShared) {
            borderClass = 'border-l-4 border-purple-500';
            iconColor = 'text-purple-400';
        } else if (isMemo) {
            borderClass = 'border-l-4 border-amber-500';
            iconColor = 'text-amber-400';
        }

        return `
            <div class="relative mb-3 select-none swipe-row rounded-xl group" 
                 style="touch-action: pan-y;"
                 id="arch-${acc.id}" 
                 data-id="${acc.id}">
              
              <!-- BACKGROUND ACTIONS -->
              <div class="absolute inset-y-0 left-0 flex w-full swipe-bg-left opacity-0 transition-opacity z-0 rounded-xl overflow-hidden">
                 <div class="w-full h-full bg-red-500/20 backdrop-blur-md flex items-center justify-start pl-6 border border-red-500/30">
                    <div class="flex flex-col items-center text-red-400">
                        <span class="material-symbols-outlined text-2xl">delete_forever</span>
                        <span class="text-[10px] font-bold uppercase mt-1">Elimina</span>
                    </div>
                 </div>
              </div>

              <div class="absolute inset-y-0 right-0 flex w-full swipe-bg-right opacity-0 transition-opacity z-0 rounded-xl overflow-hidden">
                 <div class="w-full h-full bg-green-500/20 backdrop-blur-md flex items-center justify-end pr-6 border border-green-500/30">
                    <div class="flex flex-col items-center text-green-400">
                        <span class="material-symbols-outlined text-2xl">restore_from_trash</span>
                        <span class="text-[10px] font-bold uppercase mt-1">Ripristina</span>
                    </div>
                 </div>
              </div>

              <!-- FOREGROUND CONTENT: Titanium Card -->
              <div class="relative z-10 bg-[#1e293b]/90 backdrop-blur-md hover:bg-[#1e293b] ${borderClass} border-glow rounded-xl transition-all duration-300 swipe-content shadow-lg border-y border-r border-white/5 overflow-hidden group-hover:-translate-y-1 active:scale-[0.99]">
                 
                 <!-- 10) Glow Overlay -->
                 <div class="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"></div>

                 <!-- "Archived" Badge Watermark -->
                 <div class="absolute top-[-10px] right-[-10px] p-0 opacity-5 pointer-events-none rotate-12 z-0">
                    <span class="material-symbols-outlined text-white text-[80px]">inventory_2</span>
                 </div>

                 <div class="relative z-10 p-4 flex items-start space-x-4">
                     <!-- Avatar -->
                     <img class="w-12 h-12 rounded-xl object-cover bg-black/20 shadow-inner border border-white/10 shrink-0" src="${avatar}">
                     
                     <div class="flex-1 min-w-0 pr-8">
                         <div class="flex items-center justify-between mb-1">
                             <h3 class="font-bold text-base text-white truncate pr-2">${acc.nomeAccount || 'Senza Nome'}</h3>
                              ${acc.businessName ? `<span class="text-[9px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded font-bold uppercase tracking-tighter shrink-0">${acc.businessName.toUpperCase()}</span>` : ''}
                         </div>
                         
                         <!-- Data Fields -->
                         <div class="space-y-1.5 text-xs text-gray-300">
                              ${(acc.username || acc.utente) ? `
                                 <div class="flex items-center justify-between bg-black/20 rounded-md px-2 py-1 border border-white/5">
                                     <span class="opacity-60 mr-2">User:</span>
                                     <div class="flex items-center min-w-0 flex-1 justify-end gap-2">
                                        <span id="user-text-${acc.id}" class="truncate font-mono text-white/90">••••••••</span>
                                        <button class="copy-btn-dynamic text-white/50 hover:text-white transition-colors" data-copy="${(acc.username || acc.utente).replace(/"/g, '&quot;')}" title="Copia Username">
                                            <span class="material-symbols-outlined text-[16px]">content_copy</span>
                                        </button>
                                     </div>
                                 </div>` : ''}
                             
                             ${acc.account ? `
                                 <div class="flex items-center justify-between bg-black/20 rounded-md px-2 py-1 border border-white/5">
                                     <span class="opacity-60 mr-2">Acc:</span>
                                      <div class="flex items-center min-w-0 flex-1 justify-end gap-2">
                                        <span id="acc-text-${acc.id}" class="truncate font-mono text-white/90">••••••••</span>
                                        <button class="copy-btn-dynamic text-white/50 hover:text-white transition-colors" data-copy="${acc.account.replace(/"/g, '&quot;')}" title="Copia Account">
                                            <span class="material-symbols-outlined text-[16px]">content_copy</span>
                                        </button>
                                     </div>
                                 </div>` : ''}

                             ${acc.password ? `
                                 <div class="flex items-center justify-between bg-black/20 rounded-md px-2 py-1 border border-white/5">
                                     <span class="opacity-60 mr-2">Pass:</span>
                                      <div class="flex items-center min-w-0 flex-1 justify-end gap-2">
                                        <span id="pass-text-${acc.id}" class="truncate font-mono text-white/90">••••••••</span>
                                        <button class="copy-btn-dynamic text-white/50 hover:text-white transition-colors" data-copy="${acc.password.replace(/"/g, '&quot;')}" title="Copia Password">
                                            <span class="material-symbols-outlined text-[16px]">content_copy</span>
                                        </button>
                                     </div>
                                 </div>` : ''}
                         </div>
                     </div>
                 </div>
                 
                 <!-- Quick Actions (Absolute Right) -->
                 <div class="absolute top-3 right-3 z-20 flex flex-col gap-2">
                     <button onclick="event.stopPropagation(); window.handleRestore('${acc.id}')" 
                             class="flex items-center justify-center w-8 h-8 rounded-lg bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 text-green-400 transition-all shadow-sm active:scale-95" 
                             title="Ripristina">
                         <span class="material-symbols-outlined text-[18px]">restore_from_trash</span>
                     </button>
                     ${acc.password ? `
                     <button onclick="event.stopPropagation(); window.toggleTripleVisibility('${acc.id}')" 
                             class="flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-all shadow-sm active:scale-95" 
                             title="Mostra Dati">
                         <span id="pass-eye-${acc.id}" class="material-symbols-outlined text-[18px]">visibility</span>
                     </button>` : ''}
                 </div>

              </div>
            </div>
         `;
    }).join('');

    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.15,
        onSwipeLeft: (item) => handleRestoreSwipe(item),
        onSwipeRight: (item) => handleDeleteForever(item)
    });
}

// --- HELPERS (Restore/Delete Logic) ---

function getCollectionRef(id, itemContext) {
    const context = itemContext || currentContext;
    if (context === 'privato') {
        return doc(db, "users", currentUser.uid, "accounts", id);
    } else {
        return doc(db, "users", currentUser.uid, "aziende", context, "accounts", id);
    }
}

async function handleRestoreSwipe(item) {
    const id = item.dataset.id;
    try {
        const archivedItem = allArchived.find(a => a.id === id);
        const ref = getCollectionRef(id, archivedItem?.context);
        await updateDoc(ref, {
            isArchived: false
        });
        showToast("Account ripristinato", "success");
        allArchived = allArchived.filter(a => a.id !== id);
    } catch (e) {
        console.error(e);
        showToast("Errore ripristino", "error");
        filterAndRender();
    }
}

async function handleDeleteForever(item) {
    const id = item.dataset.id;
    if (!confirm("Questa operazione è IRREVERSIBILE. Vuoi eliminare questo account per sempre?")) {
        filterAndRender();
        return;
    }

    try {
        const archivedItem = allArchived.find(a => a.id === id);
        const ref = getCollectionRef(id, archivedItem?.context);
        await deleteDoc(ref);
        showToast("Eliminato definitivamente", "success");
        allArchived = allArchived.filter(a => a.id !== id);
    } catch (e) {
        console.error(e);
        showToast("Errore eliminazione", "error");
        filterAndRender();
    }
}

async function handleEmptyTrash() {
    if (allArchived.length === 0) return;

    if (!confirm(`Sei sicuro di voler eliminare TUTTI i ${allArchived.length} account in archivio per ${currentContext === 'privato' ? 'Privato' : 'questa Azienda'}? Questa operazione non si può annullare.`)) {
        return;
    }

    try {
        const batch = writeBatch(db);
        allArchived.forEach(acc => {
            const ref = getCollectionRef(acc.id);
            batch.delete(ref);
        });

        await batch.commit();
        showToast("Archivio svuotato con successo!", "success");
        allArchived = [];
        filterAndRender();
    } catch (e) {
        console.error(e);
        showToast("Errore durante lo svuotamento", "error");
    }
}
