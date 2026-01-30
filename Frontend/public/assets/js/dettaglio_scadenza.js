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

    console.log("Dati scadenza render:", scadenza);

    if (titleEl) titleEl.textContent = scadenza.title;

    // Fix Categoria vs Intestatario
    // Nel DB vecchio 'name' era usato per l'intestatario in aggiungi_scadenza? 
    // Controlliamo i campi disponibili.

    // Intestatario (Ref)
    const intestatarioEl = document.getElementById('detail-intestatario');
    if (intestatarioEl) {
        // Usa scadenza.name per allinearsi con il campo "Ref" della lista scadenze.
        intestatarioEl.textContent = scadenza.name || scadenza.holder || scadenza.intestatario || '---';
    }

    // Categoria
    if (categoryEl) {
        // La categoria dovrebbe essere in 'category' o 'tipo_scadenza' o 'type'.
        // Se 'category' è vuoto ma 'name' sembra una categoria (raro se name è intestatario), attenzione.
        let cat = scadenza.category || scadenza.tipo_scadenza || scadenza.type;
        if (!cat && !scadenza.intestatario && scadenza.name) {
            // Fallback estremo: se non c'è altro, forse name era la categoria? 
            // Ma dallo screenshot utente "Ester Graziano" era in category, quindi categoryEl prendeva .name
            // Quindi qui NON usiamo .name per la categoria se sospettiamo sia una persona.
            // Lasciamo 'Generale' se non troviamo un campo categoria esplicito.
            cat = 'Generale';
        }
        categoryEl.textContent = cat || 'Generale';
    }

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
            if (iconSpan) {
                iconSpan.textContent = "unarchive";
                iconSpan.classList.add('filled');
            }
            completeBtn.title = "Ripristina";
            completeBtn.style.color = "var(--primary-blue)";
        } else {
            if (iconSpan) {
                iconSpan.textContent = "archive";
                iconSpan.classList.remove('filled');
            }
            completeBtn.title = "Archivia";
            completeBtn.style.color = "";
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
        veicoloInput.textContent = scadenza.veicolo_modello || 'Nessun veicolo specificato';
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
        // Pulisce e ricrea
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
            window.location.href = `modifica_scadenza.html?id=${scadenza.id}`;
        };
    }

    // --- Helper Modale Custom (Stile Inline per Robustezza) ---
    const showTitaniumConfirm = (title, message, confirmText = "Conferma", isDestructive = false) => {
        return new Promise((resolve) => {
            // Crea overlay con stili inline forzati per garantire visibilità
            const overlay = document.createElement('div');
            overlay.id = 'titanium-confirm-overlay';
            overlay.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 2147483647;
                background-color: rgba(0, 0, 0, 0.7);
                backdrop-filter: blur(5px);
                -webkit-backdrop-filter: blur(5px);
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 20px;
                opacity: 0;
                transition: opacity 0.2s ease-out;
            `;

            // Colore bottone
            const btnBg = isDestructive ? '#ef4444' : '#2563eb';
            const btnHover = isDestructive ? '#dc2626' : '#1d4ed8';

            // HTML Modale
            overlay.innerHTML = `
                <div style="
                    background-color: #1e293b;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 350px;
                    padding: 24px;
                    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
                    position: relative;
                    overflow: hidden;
                    font-family: 'Inter', sans-serif;
                    transform: scale(0.95);
                    transition: transform 0.2s ease-out;
                " id="titanium-modal-box">
                    
                    <!-- Glow -->
                    <div style="
                        position: absolute;
                        top: 0;
                        right: 0;
                        width: 150px;
                        height: 150px;
                        background: radial-gradient(circle, rgba(59, 130, 246, 0.15) 0%, transparent 70%);
                        pointer-events: none;
                        transform: translate(30%, -30%);
                    "></div>

                    <h3 style="margin: 0 0 10px 0; color: white; font-size: 1.1rem; font-weight: 700;">${title}</h3>
                    <p style="margin: 0 0 24px 0; color: #94a3b8; font-size: 0.9rem; line-height: 1.5;">${message}</p>
                    
                    <div style="display: flex; gap: 12px;">
                        <button id="modal-cancel" style="
                            flex: 1;
                            padding: 12px;
                            border-radius: 12px;
                            background: rgba(255, 255, 255, 0.05);
                            border: none;
                            color: #cbd5e1;
                            font-size: 0.75rem;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            cursor: pointer;
                            transition: background 0.2s;
                        ">ANNULLA</button>

                        <button id="modal-confirm" style="
                            flex: 1;
                            padding: 12px;
                            border-radius: 12px;
                            background: ${btnBg};
                            border: none;
                            color: white;
                            font-size: 0.75rem;
                            font-weight: 700;
                            text-transform: uppercase;
                            letter-spacing: 0.05em;
                            cursor: pointer;
                            transition: background 0.2s;
                            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                        ">${confirmText.toUpperCase()}</button>
                    </div>
                </div>
            `;

            document.body.appendChild(overlay);

            // Trigger animazione entrata
            setTimeout(() => {
                overlay.style.opacity = '1';
                const box = overlay.querySelector('#titanium-modal-box');
                if (box) box.style.transform = 'scale(1)';
            }, 10);

            // Gestione Hover Button
            const confirmBtn = overlay.querySelector('#modal-confirm');
            confirmBtn.onmouseenter = () => confirmBtn.style.background = btnHover;
            confirmBtn.onmouseleave = () => confirmBtn.style.background = btnBg;

            const cancelBtn = overlay.querySelector('#modal-cancel');
            cancelBtn.onmouseenter = () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.1)';
            cancelBtn.onmouseleave = () => cancelBtn.style.background = 'rgba(255, 255, 255, 0.05)';

            // Cleanup & Listeners
            const cleanup = () => {
                overlay.style.opacity = '0';
                const box = overlay.querySelector('#titanium-modal-box');
                if (box) box.style.transform = 'scale(0.95)';
                setTimeout(() => overlay.remove(), 200);
            };

            overlay.querySelector('#modal-cancel').onclick = () => {
                cleanup();
                resolve(false);
            };

            overlay.querySelector('#modal-confirm').onclick = () => {
                cleanup();
                resolve(true);
            };
        });
    };

    if (deleteBtn) {
        deleteBtn.onclick = async (e) => {
            if (e) e.preventDefault();
            const confirmed = await showTitaniumConfirm(
                "Elimina Scadenza",
                "Sei sicuro di voler eliminare definitivamente questa scadenza? L'azione è irreversibile.",
                "Elimina",
                true
            );

            if (confirmed) {
                try {
                    const userId = auth.currentUser.uid;
                    await deleteScadenza(userId, scadenza.id);
                    window.location.href = 'scadenze.html';
                } catch (error) {
                    console.error("Errore eliminazione:", error);
                    alert("Errore durante l'eliminazione.");
                }
            }
        };
    }

    if (completeBtn) {
        completeBtn.onclick = async (e) => {
            if (e) e.preventDefault();
            const nextStatus = !isCompleted;
            const title = nextStatus ? "Archivia Scadenza" : "Ripristina Scadenza";
            const msg = nextStatus
                ? "Vuoi archiviare questa scadenza? Non verrà più mostrata tra quelle attive."
                : "Vuoi ripristinare questa scadenza tra quelle attive?";
            const btnText = nextStatus ? "Archivia" : "Ripristina";

            const confirmed = await showTitaniumConfirm(title, msg, btnText, false);

            if (confirmed) {
                try {
                    const userId = auth.currentUser.uid;
                    await updateScadenza(userId, scadenza.id, {
                        status: nextStatus ? 'completed' : 'active',
                        completed: nextStatus
                    });
                    location.reload();
                } catch (error) {
                    console.error("Errore cambio stato:", error);
                    alert("Errore cambio stato.");
                }
            }
        };
    }
}
