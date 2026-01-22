import { getScadenza, updateScadenza, deleteScadenza } from './db.js';
import { auth } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { buildEmailBody } from './scadenza_templates.js'; // IMPORTATA FUNZIONE CONDIVISA

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const scadenzaId = urlParams.get('id');

    if (!scadenzaId) {
        document.querySelector('main').innerHTML = '<div class="text-center p-10 text-slate-500">ID Scadenza mancante</div>';
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadScadenzaData(user.uid, scadenzaId);
        } else {
            window.location.href = 'index.html';
        }
    });
});

async function loadScadenzaData(userId, scadenzaId) {
    try {
        const scadenza = await getScadenza(userId, scadenzaId);
        if (!scadenza) {
            document.querySelector('main').innerHTML = '<div class="text-center p-10 text-slate-500">Scadenza non trovata</div>';
            return;
        }
        renderScadenza(scadenza);
    } catch (error) {
        console.error("Errore caricamento scadenza:", error);
    }
}

function renderScadenza(scadenza) {
    const isCompleted = scadenza.status === 'completed' || scadenza.completed === true;

    // Header Info
    const titleEl = document.getElementById('detail-title');
    const categoryEl = document.getElementById('detail-category');
    const statusLabel = document.getElementById('status-label');
    const dateDayEl = document.getElementById('detail-date-day');
    const dateYearEl = document.getElementById('detail-date-year');
    const completeBtn = document.getElementById('complete-btn');

    if (titleEl) titleEl.textContent = scadenza.title;
    if (categoryEl) categoryEl.textContent = scadenza.name || 'Generale';

    if (statusLabel) {
        statusLabel.textContent = isCompleted ? 'Archiviata' : 'Attiva';
        statusLabel.className = isCompleted
            ? "text-[10px] font-black uppercase tracking-widest text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100"
            : "text-[10px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100";
    }

    if (completeBtn) {
        const iconSpan = completeBtn.querySelector('.material-symbols-outlined');
        const textSpan = completeBtn.querySelector('span:last-child');

        if (isCompleted) {
            // Se già completata, mostra pulsante per ripristinare
            completeBtn.classList.remove('bg-blue-50', 'text-blue-600', 'hover:bg-blue-100');
            completeBtn.classList.add('bg-emerald-50', 'text-emerald-600', 'hover:bg-emerald-100');
            if (iconSpan) {
                iconSpan.textContent = "unarchive";
                iconSpan.classList.add('filled');
            }
            if (textSpan) textSpan.textContent = "Ripristina";
        } else {
            // Se attiva, mostra pulsante per archiviare (Default HTML state)
            completeBtn.classList.remove('bg-emerald-50', 'text-emerald-600', 'hover:bg-emerald-100');
            completeBtn.classList.add('bg-blue-50', 'text-blue-600', 'hover:bg-blue-100');
            if (iconSpan) {
                iconSpan.textContent = "archive";
                iconSpan.classList.remove('filled');
            }
            if (textSpan) textSpan.textContent = "Archivia";
        }
    }

    // Date formatting (DD MMM YYYY)
    if (scadenza.dueDate) {
        const dateObj = new Date(scadenza.dueDate);
        const day = dateObj.getDate();
        const month = dateObj.toLocaleString('it-IT', { month: 'short' }).toUpperCase();
        const year = dateObj.getFullYear();
        if (dateDayEl) dateDayEl.textContent = `${day} ${month}`;
        if (dateYearEl) dateYearEl.textContent = year;
    }

    // Veicolo
    const veicoloInput = document.getElementById('display-veicolo');
    const veicoloSection = document.getElementById('section-vehicle');
    if (veicoloInput) {
        veicoloInput.value = scadenza.veicolo_modello || 'Nessun veicolo specificato';
        if (!scadenza.veicolo_modello && veicoloSection) veicoloSection.classList.add('hidden');
    }

    // Testo Email (USO LOGICA CONDIVISA)
    const testoEmailEl = document.getElementById('display-testo-email');
    if (testoEmailEl) {
        let formattedDate = '';
        if (scadenza.dueDate) {
            const d = new Date(scadenza.dueDate);
            formattedDate = d.toLocaleDateString('it-IT');
        }

        const nome = scadenza.name || 'Cliente';
        // Costruiamo il dettaglio unendo testo base + targa se presente
        const testoBase = scadenza.email_testo_selezionato || '';
        const targaPart = scadenza.veicolo_targa ? ` ${scadenza.veicolo_targa}` : '';
        const detailCombined = testoBase + targaPart; // es. "la revisione dell'auto targata AA123BB"

        // Usa la funzione condivisa per coerenza, ma aggiungi prefisso "Ciao [Nome],"
        const bodyContent = buildEmailBody(detailCombined, null, formattedDate);
        testoEmailEl.textContent = `Ciao ${nome}, ${bodyContent}`;
    }

    // Destinatari con stile aggiornato
    const destContainer = document.getElementById('display-destinatari');
    if (destContainer && scadenza.emails && scadenza.emails.length > 0) {
        // Pulisce e ricrea (Mantiene il titolo HTML header statico se c'è, se no lo rimpiazza)
        // Nel nuovo HTML il titolo è fuori dal container iniettato o gestito staticamente?
        // Verificando HTML: <div id="display-destinatari" class="p-4 bg-white"> <span ...>Destinatari</span> <!-- Injected --> </div>
        // Quindi appendiamo DOPO lo span
        const titleSpan = destContainer.querySelector('span');
        destContainer.innerHTML = '';
        if (titleSpan) destContainer.appendChild(titleSpan);

        scadenza.emails.forEach(email => {
            const div = document.createElement('div');
            div.className = "flex items-center gap-3 mt-3 p-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-100";
            div.innerHTML = `
                <div class="size-8 rounded-full bg-blue-50 flex items-center justify-center text-blue-600 shrink-0">
                    <span class="material-symbols-outlined text-[16px] filled">alternate_email</span>
                </div>
                <span class="selectable text-sm font-semibold text-slate-700 truncate">${email}</span>
            `;
            destContainer.appendChild(div);
        });
    }

    // Note Body
    const noteBody = document.getElementById('detail-note-body');
    if (noteBody) {
        noteBody.textContent = scadenza.notes || "Nessuna nota aggiuntiva presente.";
    }

    // --- Allegati ---
    const attachmentsContainer = document.getElementById('display-attachments');
    const attachmentSection = document.getElementById('section-attachments');

    if (attachmentsContainer) {
        attachmentsContainer.innerHTML = '';
        if (scadenza.attachments && scadenza.attachments.length > 0) {
            if (attachmentSection) attachmentSection.classList.remove('hidden');
            scadenza.attachments.forEach(file => {
                const div = document.createElement('div');
                div.className = "flex items-center justify-between p-3 bg-white rounded-xl border border-slate-200 shadow-sm transition-all hover:bg-slate-50/50";

                const extension = file.name.split('.').pop().toLowerCase();
                let icon = 'description';
                let iconColor = 'text-slate-500 bg-slate-100'; // Default

                if (['jpg', 'jpeg', 'png', 'gif'].includes(extension)) {
                    icon = 'image';
                    iconColor = 'text-purple-600 bg-purple-50';
                }
                if (extension === 'pdf') {
                    icon = 'picture_as_pdf';
                    iconColor = 'text-red-600 bg-red-50';
                }

                div.innerHTML = `
                    <div class="flex items-center gap-3 overflow-hidden">
                        <div class="size-10 rounded-lg ${iconColor} flex items-center justify-center shrink-0">
                            <span class="material-symbols-outlined text-[20px]">${icon}</span>
                        </div>
                        <div class="flex flex-col min-w-0">
                            <span class="text-sm font-bold text-slate-700 truncate max-w-[150px]">${file.name}</span>
                            <span class="text-[10px] text-slate-400 uppercase font-bold tracking-wider">${extension}</span>
                        </div>
                    </div>
                    <a href="${file.url}" target="_blank" class="size-10 flex items-center justify-center text-slate-400 hover:text-primary hover:bg-slate-100 rounded-full transition-colors">
                        <span class="material-symbols-outlined text-[20px]">open_in_new</span>
                    </a>
                `;
                attachmentsContainer.appendChild(div);
            });
        } else {
            if (attachmentSection) attachmentSection.classList.add('hidden');
        }
    }

    // --- Pulsanti Azioni Rapide ---
    const editBtn = document.getElementById('edit-btn');
    const deleteBtn = document.getElementById('delete-btn');

    if (editBtn) {
        editBtn.onclick = () => {
            // Passiamo l'ID per l'edit
            window.location.href = `aggiungi_scadenza.html?id=${scadenza.id}`;
        };
    }

    if (deleteBtn) {
        deleteBtn.onclick = async () => {
            if (confirm("Sei sicuro di voler eliminare questa scadenza?")) {
                try {
                    const userId = auth.currentUser.uid;
                    await deleteScadenza(userId, scadenza.id);
                    // alert("Scadenza eliminata."); // Removed alert for smoother UX
                    window.location.href = 'scadenze.html';
                } catch (error) {
                    console.error("Errore eliminazione:", error);
                    alert("Errore durante l'eliminazione.");
                }
            }
        };
    }

    if (completeBtn) {
        completeBtn.onclick = async () => {
            const nextStatus = !isCompleted;
            const msg = nextStatus
                ? "Archiviare questa scadenza? Non verrà più mostrata tra quelle attive."
                : "Ripristinare questa scadenza tra quelle attive?";

            if (confirm(msg)) {
                try {
                    const userId = auth.currentUser.uid;
                    await updateScadenza(userId, scadenza.id, {
                        status: nextStatus ? 'completed' : 'active',
                        completed: nextStatus
                    });
                    location.reload();
                } catch (error) {
                    console.error("Errore cambio stato:", error);
                }
            }
        };
    }
}
