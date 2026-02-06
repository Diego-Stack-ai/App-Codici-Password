import { getScadenza, updateScadenza, deleteScadenza } from './db.js';
import { db, auth } from './firebase-config.js';
import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";

let currentScadenzaId = null;
let currentUid = null;

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);
const showConfirmModal = (t, m, c, d) => window.showConfirmModal ? window.showConfirmModal(t, m, c, d) : Promise.resolve(confirm(m));

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentScadenzaId = urlParams.get('id');

    if (!currentScadenzaId) {
        showToast("ID mancante", "error");
        setTimeout(() => history.back(), 1500);
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUid = user.uid;
            await initPage(user);
            setupFooterActions();
        } else {
            window.location.href = 'index.html';
        }
    });
});

async function initPage(user) {
    // 1. Load Configurations for Select & Datalist
    try {
        const [autoSnap, docSnap, genSnap] = await Promise.all([
            getDoc(doc(db, "users", user.uid, "settings", "deadlineConfig")),
            getDoc(doc(db, "users", user.uid, "settings", "deadlineConfigDocuments")),
            getDoc(doc(db, "users", user.uid, "settings", "generalConfig"))
        ]);

        const unified = {
            automezzi: autoSnap.exists() ? autoSnap.data() : { deadlineTypes: [], names: [] },
            documenti: docSnap.exists() ? docSnap.data() : { deadlineTypes: [], names: [] },
            generali: genSnap.exists() ? genSnap.data() : { deadlineTypes: [], names: [] }
        };

        const catSelect = document.getElementById('edit-category');
        if (catSelect) {
            catSelect.innerHTML = '<option value="">Seleziona Categoria...</option>';
            const groups = [
                { label: "AUTOMEZZI", types: unified.automezzi.deadlineTypes },
                { label: "DOCUMENTI", types: unified.documenti.deadlineTypes },
                { label: "GENERALI", types: unified.generali.deadlineTypes }
            ];
            groups.forEach(g => {
                if (g.types?.length) {
                    const groupEl = document.createElement('optgroup');
                    groupEl.label = g.label;
                    g.types.forEach(t => {
                        const name = typeof t === 'object' ? t.name : t;
                        const opt = new Option(name, name);
                        groupEl.appendChild(opt);
                    });
                    catSelect.appendChild(groupEl);
                }
            });
        }

        const namesList = document.getElementById('names-list');
        if (namesList) {
            const allNames = new Set([
                ...(unified.automezzi.names || []),
                ...(unified.documenti.names || []),
                ...(unified.generali.names || [])
            ]);
            [...allNames].sort().forEach(n => namesList.appendChild(new Option(n, n)));
        }
    } catch (e) { console.warn("Errore config:", e); }

    // 2. Load Scadenza Data
    try {
        const scadenza = await getScadenza(user.uid, currentScadenzaId);
        if (!scadenza) {
            showToast("Scadenza non trovata", "error");
            return;
        }

        document.getElementById('edit-title').value = scadenza.title || '';
        document.getElementById('edit-holder').value = scadenza.name || scadenza.holder || '';
        document.getElementById('edit-date').value = scadenza.dueDate || '';
        document.getElementById('edit-category').value = scadenza.category || scadenza.type || '';
        document.getElementById('edit-notes').value = scadenza.notes || '';

        // Manage Attachments Link
        const btnManage = document.getElementById('btn-manage-attachments');
        if (btnManage) {
            btnManage.href = `gestione_allegati.html?id=${currentScadenzaId}&context=scadenza&ownerId=${user.uid}`;
            const attRef = collection(db, "users", user.uid, "scadenze", currentScadenzaId, "attachments");
            const attSnap = await getDocs(attRef);
            const count = document.getElementById('attachments-count');
            if (count) {
                count.textContent = attSnap.size;
                count.classList.toggle('hidden', attSnap.size === 0);
            }
        }
    } catch (e) {
        console.error(e);
        showToast("Errore caricamento dati", "error");
    }
}

function setupFooterActions() {
    const interval = setInterval(() => {
        const fCenter = document.getElementById('footer-center-actions');
        const fRight = document.getElementById('footer-right-actions');
        if (fCenter && fRight) {
            clearInterval(interval);
            fCenter.innerHTML = `
                <button id="btn-delete" class="footer-action-btn text-red-400">
                    <span class="material-symbols-outlined">delete</span>
                </button>
            `;
            fRight.innerHTML = `
                <button id="btn-save" class="footer-action-btn text-blue-400">
                    <span class="material-symbols-outlined">save</span>
                </button>
            `;
            document.getElementById('btn-save').onclick = handleSave;
            document.getElementById('btn-delete').onclick = handleDelete;
        }
    }, 100);
}

async function handleSave() {
    const title = document.getElementById('edit-title').value.trim();
    if (!title) { showToast("Titolo obbligatorio", "error"); return; }

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">sync</span>`;

    const data = {
        title,
        name: document.getElementById('edit-holder').value.trim(),
        holder: document.getElementById('edit-holder').value.trim(),
        dueDate: document.getElementById('edit-date').value,
        category: document.getElementById('edit-category').value,
        notes: document.getElementById('edit-notes').value.trim(),
        updatedAt: new Date().toISOString()
    };

    try {
        await updateScadenza(currentUid, currentScadenzaId, data);
        showToast("Scadenza aggiornata!", "success");
        setTimeout(() => window.location.href = `dettaglio_scadenza.html?id=${currentScadenzaId}`, 1000);
    } catch (e) {
        console.error(e);
        showToast("Errore salvataggio", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined">save</span>`;
    }
}

async function handleDelete() {
    const ok = await showConfirmModal("ELIMINA SCADENZA", "Vuoi davvero eliminare questa scadenza? L'azione è irreversibile.", "Elimina", true);
    if (!ok) return;

    try {
        await deleteScadenza(currentUid, currentScadenzaId);
        showToast("Scadenza eliminata", "success");
        setTimeout(() => window.location.href = 'home_page.html', 1000);
    } catch (e) {
        console.error(e);
        showToast("Errore eliminazione", "error");
    }
}
