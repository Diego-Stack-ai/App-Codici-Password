// Script estratto da modifica_azienda.html
// Gestione modifica azienda e logica UI relativa
// Refactored for Firebase Modular SDK (v11)

import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

// --- UI TOAST ---
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast-container');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');
    if (!toast) return;

    msgEl.textContent = message;

    // Reset classes
    iconEl.className = "material-symbols-outlined text-xl";

    if (type === 'error') {
        iconEl.textContent = 'error';
        iconEl.classList.add('text-red-400');
    } else {
        iconEl.textContent = 'check_circle';
        iconEl.classList.add('text-green-400');
    }

    toast.classList.remove('opacity-0', 'translate-y-10');
    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-10');
    }, 3000);
}

// --- THEME LOGIC ---
const companyPalettes = [
    { from: '#10b981', to: '#047857', name: 'Green' },   // Green
    { from: '#3b82f6', to: '#1d4ed8', name: 'Blue' },    // Blue
    { from: '#8b5cf6', to: '#6d28d9', name: 'Purple' },  // Purple
    { from: '#f59e0b', to: '#b45309', name: 'Orange' },  // Orange
    { from: '#ec4899', to: '#be185d', name: 'Pink' },    // Pink
    { from: '#ef4444', to: '#b91c1c', name: 'Red' },     // Red
    { from: '#06b6d4', to: '#0e7490', name: 'Cyan' },    // Cyan
    { from: '#6366f1', to: '#4338ca', name: 'Indigo' },  // Indigo
    { from: '#84cc16', to: '#4d7c0f', name: 'Lime' },    // Lime
    { from: '#14b8a6', to: '#0f766e', name: 'Teal' },    // Teal
];

// Current selected index
let selectedColorIndex = 0;

function getCompanyColor(companyName) {
    if (!companyName) return companyPalettes[0];
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % companyPalettes.length;
    return companyPalettes[index];
}

// Helper to get index from name hash (consistency)
function getHashIndex(companyName) {
    if (!companyName) return 0;
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash) % companyPalettes.length;
}

function applyTheme(themeIdentifier) {
    let theme;
    // If number, use index
    if (typeof themeIdentifier === 'number') {
        theme = companyPalettes[themeIdentifier] || companyPalettes[0];
    } else if (typeof themeIdentifier === 'string') {
        // Fallback to hash Legacy
        theme = getCompanyColor(themeIdentifier);
    } else {
        theme = companyPalettes[0];
    }

    document.documentElement.style.setProperty('--primary-color', theme.from);

    // Update Save Button Gradient
    const btnSave = document.getElementById('btn-save-azienda');
    if (btnSave) {
        btnSave.style.background = `linear-gradient(135deg, ${theme.from}, ${theme.to})`;
    }
}

// Toggle Section Logic
window.toggleLocationSection = function (id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    if (!el) return;

    if (el.style.maxHeight === '1000px' || (el.style.maxHeight === '' && el.classList.contains('max-h-[1000px]'))) {
        el.style.maxHeight = '0px';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        el.style.maxHeight = '1000px';
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Loaded (Modular Mode) - EDIT MODE");
    const btnSave = document.getElementById('btn-save-azienda');
    const backLink = document.getElementById('back-link');
    const cancelLink = document.getElementById('cancel-link');

    // Initial arrow rotation
    document.querySelectorAll('[id^="section-"]').forEach(section => {
        const arrow = document.getElementById('arrow-' + section.id);
        if (arrow) {
            if (window.getComputedStyle(section).maxHeight !== '0px') {
                arrow.style.transform = 'rotate(180deg)';
            }
        }
    });

    // Get ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const aziendaId = urlParams.get('id');

    if (!aziendaId) {
        if (!aziendaId) {
            showToast("Errore: ID azienda mancante.", "error");
            setTimeout(() => window.location.href = 'lista_aziende.html', 1500);
            return;
        }
    }

    // Update Back Links
    if (backLink) backLink.href = `dati_azienda.html?id=${aziendaId}`;
    if (cancelLink) cancelLink.href = `dati_azienda.html?id=${aziendaId}`;

    let currentUser = null;
    let selectedFiles = [];
    let existingAttachments = [];
    const attachmentsList = document.getElementById('attachments-list');
    const fileInput = document.getElementById('file-input');

    // --- GESTIONE ALLEGATI ---
    function renderAttachments() {
        if (!attachmentsList) return;
        attachmentsList.innerHTML = '';

        // 1. Mostra file esistenti
        existingAttachments.forEach((file, index) => {
            const item = createAttachmentItem(file.name, true, index);
            attachmentsList.appendChild(item);
        });

        // 2. Mostra nuovi file selezionati
        selectedFiles.forEach((file, index) => {
            const item = createAttachmentItem(file.name, false, index);
            attachmentsList.appendChild(item);
        });
    }

    function createAttachmentItem(name, isExisting, index) {
        const div = document.createElement('div');
        div.className = "flex items-center justify-between p-3 bg-white dark:bg-slate-900/50 rounded-xl border border-slate-100 dark:border-slate-800 animate-in fade-in slide-in-from-left-2 duration-300";

        const extension = name.split('.').pop().toLowerCase();
        let icon = 'description';
        let iconColor = 'text-slate-400';

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
            icon = 'image';
            iconColor = 'text-blue-500';
        } else if (extension === 'pdf') {
            icon = 'picture_as_pdf';
            iconColor = 'text-red-500';
        }

        div.innerHTML = `
            <div class="flex items-center gap-3 overflow-hidden">
                <span class="material-symbols-outlined ${iconColor}">${icon}</span>
                <div class="flex flex-col min-w-0">
                    <span class="text-xs font-bold text-slate-700 dark:text-slate-200 truncate">${name}</span>
                    <span class="text-[10px] text-slate-400">${isExisting ? 'Già caricato' : 'Nuovo file'}</span>
                </div>
            </div>
            <button type="button" class="remove-btn p-1 text-slate-300 hover:text-red-500 transition-colors" data-index="${index}" data-existing="${isExisting}">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
        `;

        div.querySelector('.remove-btn').onclick = (e) => {
            const idx = parseInt(e.currentTarget.dataset.index);
            const existing = e.currentTarget.dataset.existing === 'true';
            if (existing) {
                existingAttachments.splice(idx, 1);
            } else {
                selectedFiles.splice(idx, 1);
            }
            renderAttachments();
        };

        return div;
    }

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const files = Array.from(e.target.files);
            selectedFiles.push(...files);
            renderAttachments();
            fileInput.value = '';
        });
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            await loadData(user.uid, aziendaId);
        } else {
            console.log("Not logged in");
            // window.location.href = 'index.html'; // Optional redirect
        }
    });

    async function loadData(uid, id) {
        try {
            // Modular SDK: doc(db, path...) - getDoc(ref)
            const docRef = doc(db, "users", uid, "aziende", id);
            const docSnap = await getDoc(docRef);

            if (docSnap.exists()) {
                const data = docSnap.data();
                populateForm(data);
            } else {
                showToast("Azienda non trovata!", "error");
                setTimeout(() => window.location.href = 'lista_aziende.html', 1500);
            }
        } catch (error) {
            console.error("Errore caricamento:", error);
            showToast("Errore nel caricamento dati: " + error.message, "error");
        }
    }

    function populateForm(data) {
        // SETUP THEME
        // If colorIndex exists, use it. Else calculate from name hash.
        if (typeof data.colorIndex === 'number') {
            selectedColorIndex = data.colorIndex;
        } else if (data.ragioneSociale) {
            // Fallback to hash
            selectedColorIndex = getHashIndex(data.ragioneSociale);
        }

        // Apply & Render
        // Apply index
        applyTheme(selectedColorIndex);

        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.value = val || '';
        };

        set('ragione-sociale', data.ragioneSociale);

        // Load Categorical Emails
        if (data.emails) {
            set('email-pec', data.emails.pec?.email);
            set('email-pec-password', data.emails.pec?.password);
            set('email-pec-note', data.emails.pec?.note);

            set('email-amministrazione', data.emails.amministrazione?.email);
            set('email-amministrazione-password', data.emails.amministrazione?.password);

            set('email-personale', data.emails.personale?.email);
            set('email-personale-password', data.emails.personale?.password);

            set('email-manutenzione', data.emails.manutenzione?.email);
            set('email-manutenzione-password', data.emails.manutenzione?.password);

            set('email-attrezzatura', data.emails.attrezzatura?.email);
            set('email-attrezzatura-password', data.emails.attrezzatura?.password);

            set('email-magazzino', data.emails.magazzino?.email);
            set('email-magazzino-password', data.emails.magazzino?.password);
        } else {
            // Fallback for legacy data (single email)
            set('email-pec', data.aziendaEmail);
            set('email-pec-password', data.aziendaEmailPassword);
            set('email-pec-note', data.aziendaEmailPasswordNote);
        }

        set('piva', data.partitaIva);
        set('codice-sdi', data.codiceSDI);

        set('referente-titolo', data.referenteTitolo);
        set('referente-nome', data.referenteNome);
        set('referente-cognome', data.referenteCognome);
        set('referente-cellulare', data.referenteCellulare);

        set('indirizzo', data.indirizzoSede);
        set('civico', data.civicoSede);
        set('citta', data.cittaSede);
        set('provincia', data.provinciaSede);
        set('cap', data.capSede);

        set('numero-cciaa', data.numeroCCIAA);

        // Handle Date Conversion (DD/MM/YYYY -> YYYY-MM-DD)
        if (data.dataIscrizione) {
            // Check if it's already YYYY-MM-DD
            if (data.dataIscrizione.match(/^\d{4}-\d{2}-\d{2}$/)) {
                set('data-iscrizione', data.dataIscrizione);
            } else if (data.dataIscrizione.includes('/')) {
                // Assume DD/MM/YYYY
                const parts = data.dataIscrizione.split('/');
                if (parts.length === 3) {
                    const formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`; // YYYY-MM-DD
                    set('data-iscrizione', formattedDate);
                }
            } else {
                set('data-iscrizione', data.dataIscrizione);
            }
        } else {
            set('data-iscrizione', '');
        }

        set('telefono-azienda', data.telefonoAzienda);
        set('fax-azienda', data.faxAzienda);
        set('note-azienda', data.note);

        // Load Logo + Config
        if (data.logo) {
            document.getElementById('logo-preview').src = data.logo;
            document.getElementById('logo-preview').classList.remove('hidden');
            document.getElementById('logo-placeholder').classList.add('hidden');
        }

        // Load QR Config
        document.querySelectorAll('input[data-qr-field]').forEach(cb => {
            const field = cb.getAttribute('data-qr-field');
            if (data.qrConfig && data.qrConfig.hasOwnProperty(field)) {
                cb.checked = data.qrConfig[field];
            } else {
                cb.checked = true; // Default to checked for missing/legacy data
            }
        });

        // Load Referente Photo
        if (data.referentePhoto) {
            document.getElementById('referente-photo-preview').src = data.referentePhoto;
            document.getElementById('referente-photo-preview').classList.remove('hidden');
            document.getElementById('referente-photo-placeholder').classList.add('hidden');
        }

        // Load Altre Sedi (Fixed Groups)
        if (data.altreSedi && Array.isArray(data.altreSedi)) {
            const types = [
                { id: 'admin', tipo: 'Sede Amministrativa' },
                { id: 'oper', tipo: 'Sede Operativa' },
                { id: 'comm', tipo: 'Sede Commerciale' }
            ];

            types.forEach(t => {
                const sede = data.altreSedi.find(s => s.tipo === t.tipo);
                if (sede) {
                    set(`${t.id}-indirizzo`, sede.indirizzo);
                    set(`${t.id}-civico`, sede.civico);
                    set(`${t.id}-citta`, sede.citta);
                    set(`${t.id}-provincia`, sede.provincia);
                    set(`${t.id}-cap`, sede.cap);
                }
            });
        }

        // Load Attachments
        existingAttachments = data.allegati || [];
        renderAttachments();
    }

    // ... Logo logic same ...
    window.previewLogo = function (input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('logo-preview').src = e.target.result;
                document.getElementById('logo-preview').classList.remove('hidden');
                document.getElementById('logo-placeholder').classList.add('hidden');
            }
            reader.readAsDataURL(input.files[0]);
        }
    };

    window.previewReferentePhoto = function (input) {
        if (input.files && input.files[0]) {
            const reader = new FileReader();
            reader.onload = function (e) {
                document.getElementById('referente-photo-preview').src = e.target.result;
                document.getElementById('referente-photo-preview').classList.remove('hidden');
                document.getElementById('referente-photo-placeholder').classList.add('hidden');
            }
            reader.readAsDataURL(input.files[0]);
        }
    };

    // Helper to copy to clipboard
    window.copyToClipboard = function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        const text = el.value || el.innerText;
        if (!text) return;
        navigator.clipboard.writeText(text).then(() => {
            showToast("Copiato negli appunti!");
        }).catch(err => {
            console.error("Errore copia:", err);
        });
    };

    window.togglePasswordVisibility = function (id) {
        const input = document.getElementById(id);
        const icon = document.getElementById('icon-' + id);
        if (!input) return;

        input.classList.toggle('titanium-shield');
        const isShielded = input.classList.contains('titanium-shield');

        if (icon) {
            icon.textContent = isShielded ? 'visibility' : 'visibility_off';
        }
    };

    function resizeImage(base64Str, maxWidth = 300) {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                if (width > maxWidth) {
                    height *= maxWidth / width;
                    width = maxWidth;
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.8));
            };
        });
    }

    if (btnSave) {
        btnSave.addEventListener('click', async () => {
            if (!currentUser) return;

            // Helpers
            const getValue = (id) => {
                const el = document.getElementById(id);
                return el ? el.value.trim() : '';
            };

            // Data Gathering
            const ragioneSociale = getValue('ragione-sociale');
            const pIva = getValue('piva');

            // Validation
            if (!ragioneSociale) {
                showToast("Inserisci la Ragione Sociale.", "error");
                return;
            }
            if (!pIva) {
                showToast("Inserisci la Partita IVA.", "error");
                return;
            }

            // Collect QR Config
            const qrConfig = {};
            document.querySelectorAll('input[data-qr-field]').forEach(cb => {
                const field = cb.getAttribute('data-qr-field');
                if (field) qrConfig[field] = cb.checked;
            });

            // Collect Altre Sedi (Fixed Groups)
            const altreSedi = [];
            const types = [
                { id: 'admin', tipo: 'Sede Amministrativa' },
                { id: 'oper', tipo: 'Sede Operativa' },
                { id: 'comm', tipo: 'Sede Commerciale' }
            ];

            types.forEach(t => {
                const addr = getValue(`${t.id}-indirizzo`);
                if (addr) {
                    altreSedi.push({
                        tipo: t.tipo,
                        indirizzo: addr,
                        civico: getValue(`${t.id}-civico`),
                        citta: getValue(`${t.id}-citta`),
                        provincia: getValue(`${t.id}-provincia`).toUpperCase(),
                        cap: getValue(`${t.id}-cap`)
                    });
                }
            });

            const emails = {
                pec: {
                    email: getValue('email-pec'),
                    password: getValue('email-pec-password'),
                    note: getValue('email-pec-note')
                },
                amministrazione: {
                    email: getValue('email-amministrazione'),
                    password: getValue('email-amministrazione-password')
                },
                personale: {
                    email: getValue('email-personale'),
                    password: getValue('email-personale-password')
                },
                manutenzione: {
                    email: getValue('email-manutenzione'),
                    password: getValue('email-manutenzione-password')
                },
                attrezzatura: {
                    email: getValue('email-attrezzatura'),
                    password: getValue('email-attrezzatura-password')
                },
                magazzino: {
                    email: getValue('email-magazzino'),
                    password: getValue('email-magazzino-password')
                }
            };

            const updatedData = {
                ragioneSociale,
                partitaIva: pIva,
                codiceSDI: getValue('codice-sdi').toUpperCase(),
                referenteTitolo: getValue('referente-titolo'),
                referenteNome: getValue('referente-nome'),
                referenteCognome: getValue('referente-cognome'),
                referenteCellulare: getValue('referente-cellulare'),
                indirizzoSede: getValue('indirizzo'),
                civicoSede: getValue('civico'),
                cittaSede: getValue('citta'),
                provinciaSede: getValue('provincia').toUpperCase(),
                capSede: getValue('cap'),
                numeroCCIAA: getValue('numero-cciaa'),
                dataIscrizione: getValue('data-iscrizione'),
                telefonoAzienda: getValue('telefono-azienda'),
                faxAzienda: getValue('fax-azienda'),
                // Primary Email Fields (for backward compatibility and QR)
                aziendaEmail: emails.pec.email,
                aziendaEmailPassword: emails.pec.password,
                aziendaEmailPasswordNote: emails.pec.note,
                // Full categorical emails
                emails: emails,
                note: getValue('note-azienda'),
                qrConfig: qrConfig,
                updatedAt: serverTimestamp(),
                colorIndex: selectedColorIndex,
                altreSedi: altreSedi
            };

            try {
                // Handle Logo
                const logoPreview = document.getElementById('logo-preview');
                if (logoPreview && !logoPreview.classList.contains('hidden')) {
                    const currentSrc = logoPreview.src;
                    if (currentSrc.startsWith('data:')) {
                        updatedData.logo = await resizeImage(currentSrc, 400);
                    } else if (currentSrc && currentSrc !== '') {
                        updatedData.logo = currentSrc;
                    }
                }

                // Handle Referente Photo
                const refPreview = document.getElementById('referente-photo-preview');
                if (refPreview && !refPreview.classList.contains('hidden')) {
                    const currentSrc = refPreview.src;
                    if (currentSrc.startsWith('data:')) {
                        updatedData.referentePhoto = await resizeImage(currentSrc, 300);
                    } else if (currentSrc && currentSrc !== '') {
                        updatedData.referentePhoto = currentSrc;
                    }
                }

                // 1. UPLOAD NUOVI ALLEGATI
                const newUploadedAttachments = [];
                // Modular Storage: ref(storage, path) -> uploadBytes...
                for (const file of selectedFiles) {
                    btnSave.innerHTML = `<span class="material-symbols-outlined animate-spin mr-2">progress_activity</span> Upload ${file.name}...`;
                    const storageRef = ref(storage, `users/${currentUser.uid}/aziende_allegati/${Date.now()}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(snapshot.ref);
                    newUploadedAttachments.push({
                        name: file.name,
                        url: url,
                        type: file.type,
                        size: file.size,
                        date: new Date().toISOString()
                    });
                }

                // Combina esistenti + nuovi
                updatedData.allegati = [...existingAttachments, ...newUploadedAttachments];

                // Modular: updateDoc(doc(...), data)
                const docRef = doc(db, "users", currentUser.uid, "aziende", aziendaId);
                await updateDoc(docRef, updatedData);

                showToast("Azienda aggiornata!", "success");
                setTimeout(() => window.location.href = `dati_azienda.html?id=${aziendaId}`, 1500);
            } catch (e) {
                console.error("Save error:", e);
                showToast("Errore salvataggio: " + e.message, "error");
            }
        });
    }


    // DELETE BUTTON HANDLER
    const btnDelete = document.getElementById('btn-delete-azienda');
    if (btnDelete) {
        btnDelete.addEventListener('click', async () => {
            if (!currentUser || !aziendaId) return;

            if (!confirm("ATTENZIONE: Stai per eliminare definitivamente questa azienda e TUTTI i suoi dati? L'operazione NON è reversibile.")) return;

            // Double confirmation
            const confirmName = prompt("Per confermare, scrivi il nome esatto dell'azienda che stai cancellando (es. da ragione sociale):");
            const currentName = document.getElementById('ragione-sociale').value;

            if (confirmName !== currentName) {
                alert("Il nome inserito non corrisponde. Eliminazione annullata.");
                return;
            }

            try {
                btnDelete.disabled = true;
                btnDelete.innerText = "Eliminazione in corso...";

                // 1. Delete Company Document
                // Modular: deleteDoc(doc(...))
                const docRef = doc(db, "users", currentUser.uid, "aziende", aziendaId);
                await deleteDoc(docRef);

                // NOTE: Subcollections (accounts) are NOT automatically deleted in Firestore client SDK.
                alert("Azienda eliminata correttamente.");
                window.location.href = 'lista_aziende.html';

            } catch (e) {
                console.error(e);
                alert("Errore eliminazione: " + e.message);
                btnDelete.disabled = false;
                btnDelete.innerText = "Elimina Azienda";
            }
        });
    }
});
