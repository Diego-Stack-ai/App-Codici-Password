import { auth, db } from './firebase-config.js';
import { SwipeList } from './swipe-list-v6.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDocs, collection, query, where, updateDoc, deleteDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- STATE ---
let allArchived = [];
let currentUser = null;
let currentSwipeList = null;
let currentContext = 'all'; // 'all', 'privato' or companyId

// V3 Protocol: UI Core handles Toasts now.
// const showToast = window.showToast; (Already global via ui-core.js link in html)

document.addEventListener('DOMContentLoaded', () => {
    // V3: Selector listener
    const selector = document.getElementById('archive-context-select');
    if (selector) {
        selector.addEventListener('change', (e) => {
            currentContext = e.target.value;
            loadArchived();
        });
    }

    // V3: Search listener
    const searchInput = document.querySelector('input[type="search"]');
    if (searchInput) {
        searchInput.addEventListener('input', filterAndRender);
    }

    // V3: Empty Trash Button
    const btnEmpty = document.getElementById('btn-empty-trash');
    if (btnEmpty) {
        btnEmpty.addEventListener('click', handleEmptyTrash);
    }

    // INIT AUTH
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadCompanies();
            await loadArchived();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Delegated actions (Copy button)
    const container = document.getElementById('accounts-container');
    if (container) {
        container.onclick = function (e) {
            const btn = e.target.closest('.copy-btn-dynamic');
            if (btn) {
                e.preventDefault(); e.stopPropagation();
                const text = btn.getAttribute('data-copy');
                navigator.clipboard.writeText(text).then(() => {
                    window.showToast("Copiato negli appunti!", "success");
                });
            }
        };
    }

    // Unified Visibility Toggle (Global exposure for HTML onclicks)
    window.toggleTripleVisibility = (id) => {
        const eye = document.getElementById(`pass-eye-${id}`);
        const userText = document.getElementById(`user-text-${id}`);
        const accText = document.getElementById(`acc-text-${id}`);
        const passText = document.getElementById(`pass-text-${id}`);

        // Trova i valori originali dai pulsanti copy (data-copy)
        // Questo evita di esporre le password nel DOM visibile finché non richiesto
        const btnUser = document.querySelector(`button[title="Copia Username"][data-id-ref="${id}"]`);
        const btnAcc = document.querySelector(`button[title="Copia Account"][data-id-ref="${id}"]`);
        const btnPass = document.querySelector(`button[title="Copia Password"][data-id-ref="${id}"]`);

        // Recupera valori o usa fallback se i selettori sopra falliscono (usando logica precedente)
        let userVal = btnUser ? btnUser.getAttribute('data-copy') : '';
        let accVal = btnAcc ? btnAcc.getAttribute('data-copy') : '';
        let passVal = btnPass ? btnPass.getAttribute('data-copy') : '';

        // Fallback robusto scan row
        if (!userVal && !accVal && !passVal) {
            const row = document.getElementById(`arch-${id}`);
            if (row) {
                row.querySelectorAll('.copy-btn-dynamic').forEach(btn => {
                    const t = btn.getAttribute('title').toLowerCase();
                    if (t.includes('username')) userVal = btn.getAttribute('data-copy');
                    if (t.includes('account')) accVal = btn.getAttribute('data-copy');
                    if (t.includes('password')) passVal = btn.getAttribute('data-copy');
                });
            }
        }

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

    // Global Restore Handler (for click button)
    window.handleRestore = async (id) => {
        // V3: No confirm needed for restore usually, or maybe simple toast
        // But let's use a nice toast.
        try {
            const item = allArchived.find(a => a.id === id);
            if (!item) return;
            const ref = getCollectionRef(id, item.context);
            await updateDoc(ref, { isArchived: false });
            window.showToast("Account ripristinato", "success");
            allArchived = allArchived.filter(a => a.id !== id);
            filterAndRender();
        } catch (e) {
            console.error(e);
            window.showToast("Errore ripristino", "error");
        }
    };
});

async function loadCompanies() {
    try {
        const selector = document.getElementById('archive-context-select');
        if (!selector) return;

        const colRef = collection(db, "users", currentUser.uid, "aziende");
        const snap = await getDocs(colRef);

        snap.forEach(doc => {
            const data = doc.data();
            const option = document.createElement('option');
            option.value = doc.id;
            option.style.background = "#0f1932"; // Titanium Dark Blue
            option.style.color = "#ffffff";
            selector.appendChild(option);
        });
        selector.value = currentContext;
    } catch (e) {
        console.error("Errore loading companies", e);
    }
}

async function loadArchived() {
    const container = document.getElementById('accounts-container');
    if (container) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; opacity:0.6; padding: 2rem;">
                <div style="width:1.5rem; height:1.5rem; border:2px solid white; border-top-color:transparent; border-radius:50%; animation:spin 1s linear infinite; margin-bottom:0.5rem;"></div>
                <span class="settings-desc">Ricerca archivi...</span>
            </div>`;
    }

    try {
        let results = [];

        // Loading Logic (Same as before, simplified)
        if (currentContext === 'all' || currentContext === 'privato') {
            const q = query(collection(db, "users", currentUser.uid, "accounts"), where("isArchived", "==", true));
            const s = await getDocs(q);
            s.forEach(d => results.push({ ...d.data(), id: d.id, context: 'privato' }));
        }

        if (currentContext === 'all') {
            const bizSnap = await getDocs(collection(db, "users", currentUser.uid, "aziende"));
            for (const b of bizSnap.docs) {
                const q = query(collection(db, "users", currentUser.uid, "aziende", b.id, "accounts"), where("isArchived", "==", true));
                const s = await getDocs(q);
                s.forEach(d => results.push({ ...d.data(), id: d.id, context: b.id, businessName: b.data().ragioneSociale }));
            }
        } else if (currentContext !== 'privato') {
            const q = query(collection(db, "users", currentUser.uid, "aziende", currentContext, "accounts"), where("isArchived", "==", true));
            const s = await getDocs(q);
            s.forEach(d => results.push({ ...d.data(), id: d.id, context: currentContext }));
        }

        allArchived = results;
        filterAndRender();

    } catch (e) {
        console.error(e);
        window.showToast("Errore caricamento dati", "error");
        if (container) container.innerHTML = `<div class="settings-desc" style="text-align:center; color: #f87171;">Errore: ${e.message}</div>`;
    }
}

function filterAndRender() {
    const searchVal = document.querySelector('input[type="search"]')?.value.toLowerCase() || '';
    const filtered = allArchived.filter(acc =>
        (acc.nomeAccount || '').toLowerCase().includes(searchVal) ||
        (acc.username || '').toLowerCase().includes(searchVal)
    );

    const container = document.getElementById('accounts-container');
    if (!container) return;

    if (filtered.length === 0) {
        container.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:3rem 1rem; opacity:0.5;">
                <span class="material-symbols-outlined" style="font-size:3rem; margin-bottom:1rem;">inventory_2</span>
                <p class="settings-desc">Nessun account trovato</p>
            </div>`;
        return;
    }

    container.innerHTML = filtered.map(acc => {
        // Safe Avatar
        const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
        const isMemo = !!acc.hasMemo || acc.type === 'memorandum';
        const isShared = !!acc.shared || !!acc.isSharedWithMe;

        // Colors
        let borderColor = 'rgba(59, 130, 246, 0.5)'; // Blue
        if (isShared && isMemo) borderColor = 'rgba(16, 185, 129, 0.5)'; // Emerald
        else if (isShared) borderColor = 'rgba(168, 85, 247, 0.5)'; // Purple
        else if (isMemo) borderColor = 'rgba(245, 158, 11, 0.5)'; // Amber

        return `
            <div class="settings-item swipe-row" id="arch-${acc.id}" data-id="${acc.id}" style="padding: 0; min-height: auto; overflow: hidden; position: relative; touch-action: pan-y; margin-bottom: 0.5rem; border-left: 3px solid ${borderColor};">
                
                <!-- SWIPE BACKGROUNDS (V3 Compatible) -->
                <div class="absolute inset-y-0 left-0 w-full swipe-bg-left opacity-0 z-0 flex items-center pl-6 bg-rose-900/50">
                     <span class="material-symbols-outlined text-rose-400">delete_forever</span>
                </div>
                <div class="absolute inset-y-0 right-0 w-full swipe-bg-right opacity-0 z-0 flex items-center justify-end pr-6 bg-emerald-900/50">
                     <span class="material-symbols-outlined text-emerald-400">restore_from_trash</span>
                </div>

                <!-- CONTENT -->
                <div class="swipe-content relative z-10 bg-[#e0f2fe] p-4 flex gap-4 w-full transition-transform">
                    <img src="${avatar}" style="width:40px; height:40px; border-radius:10px; object-fit:cover; border:1px solid rgba(0,0,0,0.1); background-color: #f1f5f9;">
                    
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                             <h4 style="color: #0f172a !important; font-weight:700; font-size:0.95rem; word-break:break-word; line-height:1.2; padding-right:0.5rem;">${acc.nomeAccount || 'Senza Nome'}</h4>
                             ${acc.businessName ? `<span style="font-size:0.6rem; padding:2px 6px; border-radius:4px; background:rgba(37,99,235,0.1); color:#2563eb; text-transform:uppercase; margin-top:2px; white-space:nowrap; font-weight:700;">${acc.businessName}</span>` : ''}
                        </div>

                        <!-- Data Rows (Compact V3) -->
                        <div style="margin-top:0.5rem; display:flex; flex-direction:column; gap:0.25rem;">
                             ${renderDataRow(acc.id, 'User', acc.username || acc.utente, 'username')}
                             ${renderDataRow(acc.id, 'Acc', acc.account, 'account')}
                             ${renderDataRow(acc.id, 'Pass', acc.password, 'password')}
                        </div>
                    </div>

                    <!-- Actions Column -->
                    <div style="display:flex; flex-direction:column; gap:0.5rem; padding-left:0.5rem;">
                         <button onclick="window.handleRestore('${acc.id}')" style="width:32px; height:32px; border-radius:8px; background:rgba(16,185,129,0.1); color:#059669; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer;" title="Ripristina">
                            <span class="material-symbols-outlined" style="font-size:18px;">restore_from_trash</span>
                         </button>
                         ${acc.password ? `<button onclick="window.toggleTripleVisibility('${acc.id}')" style="width:32px; height:32px; border-radius:8px; background:rgba(0,0,0,0.05); color:#334155; display:flex; align-items:center; justify-content:center; border:none; cursor:pointer;" title="Mostra">
                            <span id="pass-eye-${acc.id}" class="material-symbols-outlined" style="font-size:18px;">visibility</span>
                         </button>` : ''}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    // Rebind Swipe
    if (currentSwipeList) currentSwipeList = null;
    currentSwipeList = new SwipeList('.swipe-row', {
        threshold: 0.2,
        onSwipeLeft: (item) => handleRestoreSwipe(item), // Left swipe is Green/Restore usually? Check logic. 
        // Logic in previous file: Left BG was Red/Delete. Right BG was Green/Restore.
        // onSwipeLeft trigger is usually "Right to Left motion" -> reveals RIGHT background.
        // Wait, SwipeList v6 logic:
        // if dx < 0 (swipe left), reveals Right BG.
        // if dx > 0 (swipe right), reveals Left BG.
        // So onSwipeLeft -> dx < 0 -> Right Background (Green/Restore).
        // Wait, let's look at template above.
        // swipe-bg-right is GREEN. This appears when content moves LEFT (swipe left).
        // So onSwipeLeft should trigger RESTORE. Correct.
        onSwipeLeft: (item) => handleRestoreSwipe(item),
        onSwipeRight: (item) => handleDeleteForever(item) // Moves content Right, reveals Left BG (Red/Delete).
    });
}

function renderDataRow(id, label, value, type) {
    if (!value) return '';
    return `
        <div style="display:flex; align-items:center; gap:0.5rem; background:rgba(255,255,255,0.6); padding:0.25rem 0.5rem; border-radius:6px; color: #0f172a !important;">
            <span style="font-size:0.65rem; color:#475569 !important; text-transform:uppercase; width:24px; font-weight:700;">${label}</span>
            <span id="${type === 'password' ? 'pass' : (type === 'account' ? 'acc' : 'user')}-text-${id}" style="font-family:monospace; font-size:0.8rem; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#0f172a !important;">••••••••</span>
            <button class="copy-btn-dynamic" data-copy="${value.replace(/"/g, '&quot;')}" title="Copia ${label}" data-id-ref="${id}" style="color:#64748b !important; opacity:1;">
                <span class="material-symbols-outlined" style="font-size:14px;">content_copy</span>
            </button>
        </div>
    `;
}

// --- LOGIC ---
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
        await updateDoc(ref, { isArchived: false });
        window.showToast("Ripristinato!", "success"); // Short message
        // Remove from list
        allArchived = allArchived.filter(a => a.id !== id);
        const el = document.getElementById(`arch-${id}`);
        if (el) el.style.display = 'none'; // Instant visual feedback
        setTimeout(filterAndRender, 300); // Re-render clean
    } catch (e) {
        console.error(e);
        window.showToast("Errore", "error");
        filterAndRender(); // Reset swipe
    }
}

async function handleDeleteForever(item) {
    const id = item.dataset.id;

    // V3: Secure Confirm via Input Modal
    const userConfirm = await window.showInputModal(
        "ELIMINAZIONE DEFINITIVA",
        "",
        "Scrivi 'SI' per confermare l'eliminazione."
    );

    if (userConfirm !== 'SI') {
        window.showToast("Operazione annullata", "info");
        filterAndRender(); // Reset swipe
        return;
    }

    try {
        const archivedItem = allArchived.find(a => a.id === id);
        const ref = getCollectionRef(id, archivedItem?.context);
        await deleteDoc(ref);
        window.showToast("Account eliminato per sempre", "success");
        allArchived = allArchived.filter(a => a.id !== id);
        filterAndRender();
    } catch (e) {
        console.error(e);
        window.showToast("Errore eliminazione", "error");
        filterAndRender();
    }
}

async function handleEmptyTrash() {
    if (allArchived.length === 0) return;

    // V3 Secure Confirm
    const userConfirm = await window.showInputModal(
        "SVUOTA INTERO ARCHIVIO",
        "",
        "Scrivi 'CANCELLA TUTTO' per confermare."
    );

    if (userConfirm !== 'CANCELLA TUTTO') {
        return;
    }

    try {
        const batch = writeBatch(db);
        allArchived.forEach(acc => {
            const ref = getCollectionRef(acc.id, acc.context); // Ensure context is correct
            batch.delete(ref);
        });

        await batch.commit();
        window.showToast("Archivio svuotato", "success");
        allArchived = [];
        filterAndRender();
    } catch (e) {
        console.error(e);
        window.showToast("Errore svuotamento", "error");
    }
}
