import { db, auth, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    collection, doc, getDoc, getDocs, addDoc, deleteDoc,
    serverTimestamp, query, orderBy, where
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

// --- STATE ---
let currentUser = null;
let currentId = null;
let ownerId = null;
let aziendaId = null;
let context = null; // 'profile' or null
let docType = null; // New parameter to filter by document type
let currentFilter = 'all';
let cachedAttachments = [];
let pendingFile = null;

const DOC_TYPES = [
    "Autorizzazione", "Carta di Circolazione", "Carta di Credito", "Carta di Debito",
    "Carta Identità", "Carta Identità (fronte)", "Carta Identità (fronte/retro)", "Carta Identità (retro)",
    "Certificato di Nascita", "Certificato di Residenza", "Certificato Proprietà",
    "Codice Fiscale", "Contatore Acqua", "Contratto", "Dichiarazione dei Redditi",
    "Documento di Trasporto", "Documento Identità", "Estratto Conto Bancario",
    "Fattura Cliente", "Fattura Fornitore", "Foto Prodotto", "Istruzioni", "Nota Spese",
    "Passaporto", "Patente di Guida", "POD", "Polizza Assicurativa", "Preventivo",
    "Ricevuta Pagamento", "Sanità - Foto Scontrino", "Sanità - Referti Medici",
    "Sanità - Ricette Mediche", "Spesa - Foto Scontrino", "Visita Medica", "FIV",
    "Firma", "Isola Ecologica"
];

// --- INIT ---
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentId = urlParams.get('id');
    ownerId = urlParams.get('ownerId');
    aziendaId = urlParams.get('aziendaId');
    context = urlParams.get('context');
    docType = urlParams.get('docType'); // Capture the pre-filter type

    initUI();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            if (!ownerId) ownerId = user.uid; // Default to current user if not specified

            // If viewing someone else's data (shared), ensure we have permission logic here if needed
            // For now assume ownerId is used for paths

            await loadCompanyThemeIfNeeded();
            await loadAttachments();
        } else {
            window.location.href = 'index.html';
        }
    });
});

function initUI() {
    // Populate Select
    const select = document.getElementById('doc-type');
    if (select) {
        DOC_TYPES.sort().forEach(type => {
            const opt = document.createElement('option');
            opt.value = type;
            opt.textContent = type;
            select.insertBefore(opt, select.lastElementChild); // Insert before "Custom"
        });
    }

    // Search Listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderList(); // Local filtering on cached data
        });
    }

    // Modal Events
    window.checkCustomType = (select) => {
        const customInput = document.getElementById('doc-custom-type');
        if (select.value === 'custom') {
            customInput.classList.remove('hidden');
            customInput.focus();
        } else {
            customInput.classList.add('hidden');
        }
    };

    window.closeUploadModal = () => {
        document.getElementById('upload-modal').classList.add('hidden');
        pendingFile = null;
    };

    window.confirmUpload = confirmUpload;
    window.handleFileUpload = handleFileUpload;
    window.filterAttachments = filterAttachments;
    window.deleteAttachment = deleteAttachment;
    window.shareAttachment = shareAttachment;

    // Adjust Title for Profile or Scadenza
    if (context === 'profile') {
        const titleEl = document.querySelector('h2');
        if (titleEl) titleEl.textContent = docType ? `${docType}` : "Documenti Personali";
    } else if (context === 'scadenza') {
        const titleEl = document.querySelector('h2');
        if (titleEl) titleEl.textContent = "Allegati Scadenza";
    }

    // Pre-fill search if docType is provided
    if (docType && searchInput) {
        searchInput.value = docType;
    }
}

async function loadCompanyThemeIfNeeded() {
    if (aziendaId && ownerId) {
        // ... (existing logic)
    }
}

// --- PATH HELPERS ---

function getAttachmentsCollectionPath() {
    // Determine the collection ref string based on context
    const uid = ownerId || currentUser.uid;

    if (context === 'profile') {
        return collection(db, "users", uid, "personal_documents");
    }

    if (context === 'scadenza') {
        // Save in subcollection of the deadline
        return collection(db, "users", uid, "scadenze", currentId, "attachments");
    }

    if (aziendaId) {
        return collection(db, "users", uid, "aziende", aziendaId, "accounts", currentId, "attachments");
    } else {
        return collection(db, "users", uid, "accounts", currentId, "attachments");
    }
}

function getStorageRefPath(fileName) {
    const uid = ownerId || currentUser.uid;

    if (context === 'profile') {
        return `users/${uid}/personal_documents/${fileName}`;
    }

    if (context === 'scadenza') {
        return `users/${uid}/scadenze/${currentId}/attachments/${fileName}`;
    }

    if (aziendaId) {
        return `users/${uid}/aziende/${aziendaId}/accounts/${currentId}/attachments/${fileName}`;
    } else {
        return `users/${uid}/accounts/${currentId}/attachments/${fileName}`;
    }
}


// --- CORE FUNCTIONS ---

async function loadAttachments() {
    const listContainer = document.querySelector('.flex.flex-col.gap-3.px-4');
    if (listContainer) listContainer.innerHTML = '<div class="text-center py-4 text-gray-400"><span class="material-symbols-outlined animate-spin">sync</span></div>';

    try {
        const colRef = getAttachmentsCollectionPath();
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);

        cachedAttachments = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        renderList();

    } catch (e) {
        console.error("Load error:", e);
        if (listContainer) listContainer.innerHTML = `<p class="text-center text-red-400 text-sm">Errore caricamento: ${e.message}</p>`;
    }
}

function renderList() {
    const listContainer = document.querySelector('.flex.flex-col.gap-3.px-4');
    if (!listContainer) return;

    if (cachedAttachments.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-400 text-sm py-8">Nessun file caricato.</p>';
        return;
    }

    // Filtering
    const searchText = (document.getElementById('search-input')?.value || '').toLowerCase();

    const filtered = cachedAttachments.filter(data => {
        // Category Filter
        let categoryMatch = true;
        const type = (data.type || '').toLowerCase();

        if (currentFilter !== 'all') {
            if (currentFilter === 'pdf') categoryMatch = type.includes('pdf');
            else if (currentFilter === 'image') categoryMatch = type.includes('image');
            else if (currentFilter === 'video') categoryMatch = type.includes('video');
            else if (currentFilter === 'file') {
                const isCommon = (type.includes('pdf') || type.includes('image') || type.includes('video'));
                categoryMatch = !isCommon;
            }
        }

        // Search Match
        const name = (data.name || '').toLowerCase();
        const cat = (data.category || '').toLowerCase();

        // If docType is passed from URL, we prioritize it as a filter if search is empty or matches it
        const finalSearchText = searchText || (docType ? docType.toLowerCase() : '');
        const searchMatch = !finalSearchText || name.includes(finalSearchText) || cat.includes(finalSearchText);

        return categoryMatch && searchMatch;
    });

    if (filtered.length === 0) {
        listContainer.innerHTML = '<p class="text-center text-gray-400 text-sm py-8">Nessun file trovato per questo filtro.</p>';
        return;
    }

    // HTML Generation
    let html = '';
    filtered.forEach(data => {
        const type = (data.type || '').toLowerCase();
        const isPdf = type.includes('pdf');
        const isImg = type.includes('image');
        const isVid = type.includes('video');

        let icon = 'description';
        let colorClass = 'text-sky-600 bg-sky-50 border-sky-100';

        if (isPdf) {
            icon = 'picture_as_pdf';
            colorClass = 'text-red-500 bg-red-50 border-red-100';
        }
        else if (isImg) {
            icon = 'image';
            colorClass = 'text-purple-500 bg-purple-50 border-purple-100';
        }
        else if (isVid) {
            icon = 'movie';
            colorClass = 'text-pink-500 bg-pink-50 border-pink-100';
        }

        const sizeMB = (data.size / (1024 * 1024)).toFixed(2);

        let dateStr = 'Oggi';
        if (data.createdAt && data.createdAt.toDate) {
            dateStr = data.createdAt.toDate().toLocaleDateString();
        }

        html += `
        <div onclick="window.open('${data.url}', '_blank')"
            class="flex items-center gap-3 bg-white p-3 rounded-2xl shadow-sm border border-black/5 hover:border-[#137fec]/30 transition-all cursor-pointer group active:scale-[0.99]">
            
            <div class="flex items-center gap-1 shrink-0 mr-1">
                 <div class="flex flex-col gap-1">
                    <button onclick="event.stopPropagation(); shareAttachment('${data.url}', '${data.name.replace(/'/g, "\\'")}')" 
                        class="size-8 flex items-center justify-center text-[#137fec] hover:text-white hover:bg-[#137fec] transition-all rounded-full bg-blue-50">
                        <span class="material-symbols-outlined text-[18px]">ios_share</span>
                    </button>
                    <button onclick="event.stopPropagation(); deleteAttachment('${data.id}', '${data.name.replace(/'/g, "\\'")}')" 
                        class="size-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-red-500 transition-all rounded-full bg-gray-50">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                 </div>
                 <div class="w-px h-12 bg-gray-100 mx-2"></div>
            </div>

            <div class="flex items-center gap-3 flex-1 min-w-0">
                <div class="${colorClass} flex items-center justify-center rounded-2xl shrink-0 size-12 border shadow-sm">
                    <span class="material-symbols-outlined text-[24px]">${icon}</span>
                </div>
                <div class="flex flex-col justify-center min-w-0 gap-0.5">
                    <p class="text-[#0A162A] text-sm font-bold leading-tight truncate group-hover:text-[#137fec] transition-colors">
                        ${data.name}
                    </p>
                    <div class="flex items-center gap-2">
                        <span class="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md border border-slate-100">
                             ${data.category || 'File'}
                        </span>
                        <span class="text-slate-400 text-[11px] font-medium truncate">
                            ${sizeMB} MB • ${dateStr}
                        </span>
                    </div>
                </div>
            </div>
            
            <span class="material-symbols-outlined text-slate-300 group-hover:text-[#137fec] transition-colors text-[20px]">chevron_right</span>
        </div>`;
    });

    listContainer.innerHTML = html;
}

// --- ACTIONS ---

function filterAttachments(type, btn) {
    currentFilter = type;
    document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.remove('bg-[#137fec]/10', 'border-[#137fec]');
        c.classList.add('bg-white', 'border-black/5');

        const p = c.querySelector('p');
        if (p) {
            p.classList.remove('text-[#137fec]', 'font-bold');
            p.classList.add('text-gray-600', 'font-medium');
        }
    });

    if (btn) {
        btn.classList.remove('bg-white', 'border-black/5');
        btn.classList.add('bg-[#137fec]/10', 'border-[#137fec]');

        const p = btn.querySelector('p');
        if (p) {
            p.classList.remove('text-gray-600', 'font-medium');
            p.classList.add('text-[#137fec]', 'font-bold');
        }
    }
    renderList();
}

function handleFileUpload(input) {
    if (input.files[0]) {
        pendingFile = input.files[0];
        document.getElementById('upload-modal').classList.remove('hidden');

        // Reset
        const typeSelect = document.getElementById('doc-type');
        if (docType && Array.from(typeSelect.options).some(o => o.value === docType)) {
            typeSelect.value = docType;
        } else {
            typeSelect.value = "";
        }

        document.getElementById('doc-custom-type').value = "";
        document.getElementById('doc-custom-type').classList.add('hidden');
        document.getElementById('doc-desc').value = "";
        input.value = '';
    }
}

async function confirmUpload() {
    if (!pendingFile) return;

    const btn = document.querySelector('#upload-modal button:last-child');
    const originalText = btn.innerHTML;

    // Validate
    const typeSelect = document.getElementById('doc-type');
    let type = typeSelect.value;
    const customType = document.getElementById('doc-custom-type').value.trim();
    const desc = document.getElementById('doc-desc').value.trim();

    if (!type) { alert("Seleziona un tipo di documento."); return; }
    if (type === 'custom') {
        if (!customType) { alert("Inserisci il nuovo tipo di documento."); return; }
        type = customType;
    }
    if (!desc) { alert("Inserisci una descrizione."); return; }
    if (pendingFile.size > 10 * 1024 * 1024) { alert("Il file supera i 10MB."); return; }

    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin text-lg">progress_activity</span> Caricamento...';

    try {
        const ext = pendingFile.name.split('.').pop();
        const newName = `${type} - ${desc}.${ext}`;
        const storagePath = getStorageRefPath(`${Date.now()}_${newName}`);
        const storageRefHandle = ref(storage, storagePath);

        // Upload
        const snap = await uploadBytes(storageRefHandle, pendingFile);
        const url = await getDownloadURL(snap.ref);

        // Firestore Save
        await addDoc(getAttachmentsCollectionPath(), {
            name: newName,
            storagePath: storagePath, // Save path for deletion reference
            url: url,
            size: pendingFile.size,
            type: pendingFile.type || 'application/octet-stream',
            category: type,
            createdAt: serverTimestamp()
        });

        closeUploadModal();
        showToast("File caricato correttamente!", "success");
        await loadAttachments();

    } catch (error) {
        console.error("Upload error:", error);
        alert("Errore caricamento: " + error.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function deleteAttachment(docId, fileName) {
    if (!confirm(`Sei sicuro di voler eliminare "${fileName}"?`)) return;

    try {
        // 1. Get doc data to find storage path
        const docRef = doc(getAttachmentsCollectionPath(), docId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();

            // 2. Delete Firestore Doc
            await deleteDoc(docRef);

            // 3. Delete from Storage (if path exists)
            if (data.storagePath) {
                const storageRefHandle = ref(storage, data.storagePath);
                await deleteObject(storageRefHandle).catch(err => console.warn("Storage delete warn:", err));
            } else if (data.url) {
                // Try to guess or parse ref from URL if storagePath missing (legacy)
                const storageRefHandle = ref(storage, data.url); // This works only if regex matches bucket
                await deleteObject(storageRefHandle).catch(err => console.warn("Storage delete from URL warn:", err));
            }
        }

        showToast("Elemento eliminato.", "success");
        await loadAttachments();

    } catch (e) {
        console.error("Delete error:", e);
        alert("Errore eliminazione: " + e.message);
    }
}

async function shareAttachment(url, name) {
    if (navigator.share) {
        try {
            await navigator.share({
                title: name,
                text: 'Ecco il documento: ' + name,
                url: url
            });
        } catch (e) {
            fallbackCopy(url);
        }
    } else {
        fallbackCopy(url);
    }
}

function fallbackCopy(url) {
    navigator.clipboard.writeText(url)
        .then(() => showToast("Link copiato negli appunti!"))
        .catch(() => window.open(url, '_blank'));
}

function showToast(msg, type = 'info') {
    const toast = document.getElementById('toast');
    const msgEl = document.getElementById('toast-msg');
    if (toast && msgEl) {
        msgEl.textContent = msg;
        toast.className = `fixed bottom-24 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full text-sm font-bold shadow-xl transition-all duration-300 pointer-events-none z-[100] flex items-center gap-2 transform translate-y-0 opacity-100 ${type === 'success' ? 'bg-green-600 text-white' : 'bg-gray-900 text-white'}`;

        setTimeout(() => {
            toast.classList.add('translate-y-4', 'opacity-0');
        }, 3000);
    }
}
