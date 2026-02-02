import { getScadenza, updateScadenza } from './db.js';
import { db, auth } from './firebase-config.js';
import { collection, getDocs, getDoc, doc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { showToast } from './ui-core.js';

let currentScadenzaId = null;

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentScadenzaId = urlParams.get('id');

    if (!currentScadenzaId) {
        alert("ID Scadenza mancante");
        history.back();
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // 1. Caricamento Configurazioni per Menu a Tendina (Come in Aggiungi Scadenza)
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

                // Popolamento Select Categoria
                const catSelect = document.getElementById('edit-category');
                if (catSelect) {
                    catSelect.innerHTML = '<option value="">Seleziona Categoria...</option>';
                    const groups = [
                        { label: "AUTOMEZZI", types: unified.automezzi.deadlineTypes },
                        { label: "DOCUMENTI", types: unified.documenti.deadlineTypes },
                        { label: "GENERALI", types: unified.generali.deadlineTypes }
                    ];

                    groups.forEach(g => {
                        if (g.types && g.types.length > 0) {
                            const groupEl = document.createElement('optgroup');
                            groupEl.label = g.label;
                            g.types.forEach(t => {
                                const name = typeof t === 'object' ? t.name : t;
                                const opt = document.createElement('option');
                                opt.value = name;
                                opt.textContent = name;
                                groupEl.appendChild(opt);
                            });
                            catSelect.appendChild(groupEl);
                        }
                    });
                }

                // Popolamento Datalist Nomi
                const namesList = document.getElementById('names-list');
                if (namesList) {
                    const allNames = new Set([
                        ...(unified.automezzi.names || []),
                        ...(unified.documenti.names || []),
                        ...(unified.generali.names || [])
                    ]);
                    [...allNames].sort().forEach(n => {
                        const opt = document.createElement('option');
                        opt.value = n;
                        namesList.appendChild(opt);
                    });
                }
            } catch (e) {
                console.warn("Errore caricamento config menu:", e);
            }

            // 2. Caricamento Dati Scadenza
            const scadenza = await getScadenza(user.uid, currentScadenzaId);
            if (scadenza) {
                document.getElementById('edit-title').value = scadenza.title || '';
                document.getElementById('edit-holder').value = scadenza.name || scadenza.holder || '';
                document.getElementById('edit-date').value = scadenza.dueDate || '';
                document.getElementById('edit-category').value = scadenza.type || scadenza.category || '';
                document.getElementById('edit-notes').value = scadenza.notes || '';

                // Link Gestione Allegati & Count
                const btnManage = document.getElementById('btn-manage-attachments');
                if (btnManage) {
                    btnManage.href = `gestione_allegati.html?id=${currentScadenzaId}&context=scadenza&ownerId=${user.uid}`;

                    try {
                        const attRef = collection(db, "users", user.uid, "scadenze", currentScadenzaId, "attachments");
                        const attSnap = await getDocs(attRef);
                        const countSpan = document.getElementById('attachments-count');
                        if (countSpan) {
                            countSpan.textContent = attSnap.size;
                            countSpan.style.display = attSnap.size > 0 ? 'inline' : 'none';
                        }
                    } catch (e) {
                        console.warn("Errore caricamento contatore allegati:", e);
                    }
                }
            }
        }
    });

    document.getElementById('save-changes-btn').onclick = async () => {
        const user = auth.currentUser;
        if (!user) return;

        const updatedData = {
            title: document.getElementById('edit-title').value,
            name: document.getElementById('edit-holder').value, // Salva correttamente l'intestatario
            holder: document.getElementById('edit-holder').value, // Ridondanza utile
            dueDate: document.getElementById('edit-date').value,
            category: document.getElementById('edit-category').value,
            notes: document.getElementById('edit-notes').value
        };

        try {
            await updateScadenza(user.uid, currentScadenzaId, updatedData);
            showToast('Scadenza aggiornata!', 'success');
            setTimeout(() => {
                window.location.href = `dettaglio_scadenza.html?id=${currentScadenzaId}`;
            }, 1000);
        } catch (error) {
            console.error(error);
            showToast('Errore aggiornamento', 'error');
        }
    };
});
