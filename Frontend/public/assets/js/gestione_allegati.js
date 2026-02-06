import { db, auth, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    collection, doc, getDoc, getDocs, addDoc, deleteDoc,
    serverTimestamp, query, orderBy
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

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
].sort();

let currentId = new URLSearchParams(window.location.search).get('id');
let ownerId = new URLSearchParams(window.location.search).get('ownerId');
let aziendaId = new URLSearchParams(window.location.search).get('aziendaId');
let context = new URLSearchParams(window.location.search).get('context');
let docType = new URLSearchParams(window.location.search).get('docType');

let currentFilter = 'all';
let cachedAttachments = [];
let pendingFile = null;

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);
const showConfirmModal = (t, m, c, d) => window.showConfirmModal ? window.showConfirmModal(t, m, c, d) : Promise.resolve(confirm(m));

document.addEventListener('DOMContentLoaded', () => {
    initUI();

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            if (!ownerId) ownerId = user.uid;
            await loadAttachments();
        } else {
            window.location.href = 'index.html';
        }
    });

    // Event Listeners
    document.getElementById('search-input')?.addEventListener('input', renderList);
    document.getElementById('btn-trigger-upload')?.addEventListener('click', () => document.getElementById('file-upload').click());
    document.getElementById('file-upload')?.addEventListener('change', (e) => handleFileUpload(e.target));
    document.getElementById('btn-cancel-upload')?.addEventListener('click', closeUploadModal);
    document.getElementById('btn-confirm-upload')?.addEventListener('click', confirmUpload);
    document.getElementById('doc-type')?.addEventListener('change', (e) => {
        const custom = document.getElementById('doc-custom-type');
        if (e.target.value === 'custom') {
            custom.classList.remove('hidden');
            custom.focus();
        } else {
            custom.classList.add('hidden');
        }
    });

    document.getElementById('filter-chips')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip-btn');
        if (btn) {
            document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderList();
        }
    });

    // Delegated actions for list
    document.getElementById('attachments-list')?.addEventListener('click', (e) => {
        const btnDelete = e.target.closest('.btn-delete-att');
        const btnShare = e.target.closest('.btn-share-att');

        if (btnDelete) {
            e.stopPropagation();
            deleteAttachment(btnDelete.dataset.id, btnDelete.dataset.name);
        } else if (btnShare) {
            e.stopPropagation();
            shareAttachment(btnShare.dataset.url, btnShare.dataset.name);
        } else {
            const card = e.target.closest('.att-card');
            if (card) window.open(card.dataset.url, '_blank');
        }
    });
});

function initUI() {
    const select = document.getElementById('doc-type');
    if (select) {
        DOC_TYPES.forEach(t => {
            const opt = new Option(t, t);
            select.add(opt, select.options[select.options.length - 1]);
        });
    }

    if (context === 'profile') {
        const sub = document.getElementById('context-subtitle');
        if (sub) sub.textContent = docType || "Documenti Personali";
    }

    if (docType) {
        const search = document.getElementById('search-input');
        if (search) search.value = docType;
    }
}

async function loadAttachments() {
    try {
        const colRef = getCollectionPath();
        const q = query(colRef, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        cachedAttachments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        renderList();
    } catch (e) {
        console.error(e);
        showToast("Errore caricamento", "error");
    }
}

function renderList() {
    const container = document.getElementById('attachments-list');
    if (!container) return;

    const search = document.getElementById('search-input')?.value.toLowerCase() || "";

    const filtered = cachedAttachments.filter(a => {
        const type = (a.type || "").toLowerCase();
        let catMatch = true;
        if (currentFilter === 'pdf') catMatch = type.includes('pdf');
        else if (currentFilter === 'image') catMatch = type.includes('image');
        else if (currentFilter === 'video') catMatch = type.includes('video');
        else if (currentFilter === 'file') catMatch = !type.includes('pdf') && !type.includes('image') && !type.includes('video');

        const name = (a.name || "").toLowerCase();
        const cat = (a.category || "").toLowerCase();
        const searchMatch = !search || name.includes(search) || cat.includes(search);

        return catMatch && searchMatch;
    });

    if (filtered.length === 0) {
        container.innerHTML = `<p class="text-[10px] text-white/30 uppercase text-center py-12">${cachedAttachments.length === 0 ? 'Nessun file' : 'Nessun risultato'}</p>`;
        return;
    }

    container.innerHTML = filtered.map(a => {
        const type = (a.type || "").toLowerCase();
        let icon = 'description';
        let color = 'text-blue-400';
        if (type.includes('pdf')) { icon = 'picture_as_pdf'; color = 'text-red-400'; }
        else if (type.includes('image')) { icon = 'image'; color = 'text-purple-400'; }
        else if (type.includes('video')) { icon = 'movie'; color = 'text-pink-400'; }

        const date = a.createdAt?.toDate ? a.createdAt.toDate().toLocaleDateString() : '---';
        const size = (a.size / (1024 * 1024)).toFixed(2);

        return `
            <div class="att-card glass-card flex items-center gap-3 p-3 group transition-all active:scale-[0.98] cursor-pointer" data-url="${a.url}">
                <!-- Quick Actions Left -->
                 <div class="flex flex-col gap-1 border-r border-white/5 pr-2">
                    <button class="btn-share-att size-8 flex-center text-blue-400 bg-blue-500/10 rounded-lg hover:bg-blue-500/20" data-url="${a.url}" data-name="${a.name.replace(/"/g, '&quot;')}">
                        <span class="material-symbols-outlined text-[18px]">ios_share</span>
                    </button>
                    <button class="btn-delete-att size-8 flex-center text-white/20 hover:text-red-400 hover:bg-red-500/10 rounded-lg" data-id="${a.id}" data-name="${a.name.replace(/"/g, '&quot;')}">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
                
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <div class="size-12 rounded-2xl bg-white/5 flex-center border border-white/10 shrink-0">
                        <span class="material-symbols-outlined ${color} text-2xl">${icon}</span>
                    </div>
                    <div class="flex-1 flex flex-col min-w-0 justify-center">
                        <p class="text-sm font-bold text-white truncate">${a.name}</p>
                        <div class="flex items-center gap-2">
                            <span class="text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-white/5 text-white/40 border border-white/5">${a.category || 'File'}</span>
                            <span class="text-[10px] text-white/20 font-medium">${size} MB • ${date}</span>
                        </div>
                    </div>
                </div>
                
                <span class="material-symbols-outlined text-white/10 group-hover:text-white/40 transition-colors">chevron_right</span>
            </div>
        `;
    }).join("");
}

function handleFileUpload(input) {
    if (input.files[0]) {
        pendingFile = input.files[0];
        const modal = document.getElementById('upload-modal');
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('opacity-100');
            modal.children[1].classList.remove('scale-90');
            modal.children[1].classList.add('scale-100');
        }, 10);

        const sel = document.getElementById('doc-type');
        if (docType && Array.from(sel.options).some(o => o.value === docType)) sel.value = docType;
        else sel.value = "";
    }
}

function closeUploadModal() {
    const modal = document.getElementById('upload-modal');
    modal.classList.remove('opacity-100');
    modal.children[1].classList.remove('scale-100');
    modal.children[1].classList.add('scale-90');
    setTimeout(() => {
        modal.classList.add('hidden');
        pendingFile = null;
    }, 300);
}

async function confirmUpload() {
    if (!pendingFile) return;

    const sel = document.getElementById('doc-type');
    let type = sel.value;
    const custom = document.getElementById('doc-custom-type').value.trim();
    const desc = document.getElementById('doc-desc').value.trim();

    if (!type) { showToast("Scegli un tipo", "error"); return; }
    if (type === 'custom') {
        if (!custom) { showToast("Scegli un tipo", "error"); return; }
        type = custom;
    }
    if (!desc) { showToast("Inserisci descrizione", "error"); return; }

    const btn = document.getElementById('btn-confirm-upload');
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">sync</span> Caricamento...`;

    try {
        const ext = pendingFile.name.split('.').pop();
        const fileName = `${type} - ${desc}.${ext}`;
        const path = getStoragePath(`${Date.now()}_${fileName}`);
        const sRef = ref(storage, path);

        const snap = await uploadBytes(sRef, pendingFile);
        const url = await getDownloadURL(snap.ref);

        await addDoc(getCollectionPath(), {
            name: fileName,
            storagePath: path,
            url: url,
            size: pendingFile.size,
            type: pendingFile.type || 'application/octet-stream',
            category: type,
            createdAt: serverTimestamp()
        });

        closeUploadModal();
        showToast("File caricato!", "success");
        await loadAttachments();
    } catch (e) {
        console.error(e);
        showToast("Errore upload", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = originalText;
    }
}

async function deleteAttachment(id, name) {
    const ok = await showConfirmModal("ELIMINA", `Confermi l'eliminazione di ${name}?`, "Elimina", true);
    if (!ok) return;

    try {
        const colRef = getCollectionPath();
        const docRef = doc(colRef, id);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const data = snap.data();
            await deleteDoc(docRef);
            if (data.storagePath) await deleteObject(ref(storage, data.storagePath));
            showToast("Eliminato", "success");
            await loadAttachments();
        }
    } catch (e) {
        console.error(e);
        showToast("Errore", "error");
    }
}

async function shareAttachment(url, name) {
    if (navigator.share) {
        try {
            await navigator.share({ title: name, url: url });
        } catch (e) {
            copyToClipboard(url);
        }
    } else {
        copyToClipboard(url);
    }
}

function copyToClipboard(url) {
    navigator.clipboard.writeText(url).then(() => showToast("Link copiato!", "success"));
}

// Path Helpers
function getCollectionPath() {
    const uid = ownerId || auth.currentUser.uid;
    if (context === 'profile') return collection(db, "users", uid, "personal_documents");
    if (context === 'scadenza') return collection(db, "users", uid, "scadenze", currentId, "attachments");
    if (aziendaId) return collection(db, "users", uid, "aziende", aziendaId, "accounts", currentId, "attachments");
    return collection(db, "users", uid, "accounts", currentId, "attachments");
}

function getStoragePath(fileName) {
    const uid = ownerId || auth.currentUser.uid;
    if (context === 'profile') return `users/${uid}/personal_documents/${fileName}`;
    if (context === 'scadenza') return `users/${uid}/scadenze/${currentId}/attachments/${fileName}`;
    if (aziendaId) return `users/${uid}/aziende/${aziendaId}/accounts/${currentId}/attachments/${fileName}`;
    return `users/${uid}/accounts/${currentId}/attachments/${fileName}`;
}
