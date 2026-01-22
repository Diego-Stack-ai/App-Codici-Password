// DATI AZIENDA JS - Refactored for Firebase Modular SDK (v11)
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

console.log("Script Dati Azienda Caricato (Modular Mode)");

document.addEventListener('DOMContentLoaded', () => {
    // Check Auth State
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            console.log("Logged in:", user.uid);
            const urlParams = new URLSearchParams(window.location.search);
            const aziendaId = urlParams.get('id');

            if (aziendaId) {
                // Load Data
                await loadAziendaData(user.uid, aziendaId);

                // Enable Edit Button
                const btnEdit = document.getElementById('btn-edit-azienda');
                if (btnEdit) {
                    btnEdit.addEventListener('click', () => {
                        window.location.href = `modifica_azienda.html?id=${aziendaId}`;
                    });
                }

            } else {
                console.error("Nessun ID azienda specificato");
                alert("Errore: Nessun ID azienda specificato.");
                window.location.href = 'lista_aziende.html';
            }
        } else {
            console.log("Utente non loggato, reindirizzamento...");
            window.location.href = 'index.html'; // Or login page
        }
    });
});

// --- COLOR PALETTE (Matching other files) ---
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

function getCompanyColor(companyName, colorIndex) {
    // 1. Prefer Stored Index
    if (typeof colorIndex === 'number' && companyPalettes[colorIndex]) {
        return companyPalettes[colorIndex];
    }
    // 2. Fallback
    if (!companyName) return companyPalettes[0];
    let hash = 0;
    for (let i = 0; i < companyName.length; i++) {
        hash = companyName.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % companyPalettes.length;
    return companyPalettes[index];
}

function applyTheme(companyName, colorIndex) {
    const theme = getCompanyColor(companyName, colorIndex);
    document.documentElement.style.setProperty('--primary-color', theme.from);
    document.documentElement.style.setProperty('--primary-dark', theme.to);

    // Color header icons
    const textIds = ['btn-back', 'btn-home', 'btn-edit-azienda'];
    textIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.color = theme.to;
    });
}

async function loadAziendaData(uid, aziendaId) {
    try {
        // Modular SDK: getDoc(doc(db, ...))
        const docRef = doc(db, "users", uid, "aziende", aziendaId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            console.log("Dati azienda caricati:", data);

            // APPLY THEME
            if (data.ragioneSociale || typeof data.colorIndex === 'number') {
                applyTheme(data.ragioneSociale, data.colorIndex);
            }

            populateFields(data, aziendaId);
            handleLogoAndQR(data);
            renderAllegati(data.allegati);
        } else {
            console.error("Nessun documento trovato!");
            document.getElementById('ragione-sociale').textContent = "Azienda non trovata";
        }
    } catch (error) {
        console.error("Errore nel recupero dei dati:", error);
        alert("Errore nel recupero dati: " + error.message);
    }
}

function populateFields(data, id) {
    // Helper to safe set text
    const set = (elementId, val) => {
        const el = document.getElementById(elementId);
        if (el) el.textContent = val || '-';
    };

    set('ragione-sociale', data.ragioneSociale);
    set('azienda-id-display', `Ref ID: ${id}`);

    // Interaction for Referente Cell
    const elCell = document.getElementById('referente-cellulare');
    if (elCell && data.referenteCellulare) {
        const parent = elCell.closest('.group');
        if (parent) {
            parent.onclick = () => window.makeCall(data.referenteCellulare);
            parent.title = "Chiama " + data.referenteCellulare;
        }
    }

    // Interaction for Company Phone and Fax (Row Click)
    ['telefono-azienda', 'fax-azienda'].forEach(fieldId => {
        const el = document.getElementById(fieldId);
        // data field name mapping
        const dataField = fieldId === 'telefono-azienda' ? 'telefonoAzienda' : 'faxAzienda';
        const val = data[dataField];

        if (el && val) {
            const parent = el.closest('.group');
            if (parent) {
                parent.onclick = (e) => {
                    // Avoid double trigger if clicking the copy button (z-10) or specific excluded elements
                    if (e.target.closest('.copy-btn') || e.target.closest('.copy-button')) return;
                    window.makeCall(val);
                };
                parent.title = "Chiama " + val;
            }
        }
    });

    set('referente-nome', `${data.referenteNome || ''} ${data.referenteCognome || ''}`);
    set('referente-ruolo', data.referenteTitolo);
    set('referente-cellulare', data.referenteCellulare);

    // Handle Referente Photo
    const refPhoto = document.getElementById('referente-photo');
    const refPlaceholder = document.getElementById('referente-photo-placeholder');
    if (refPhoto && refPlaceholder) {
        if (data.referentePhoto) {
            refPhoto.src = data.referentePhoto;
            refPhoto.classList.remove('hidden');
            refPlaceholder.classList.add('hidden');
        } else {
            refPhoto.classList.add('hidden');
            refPlaceholder.classList.remove('hidden');
        }
    }

    // --- FIXED LOCATIONS LOGIC ---
    const locations = [];
    const fixedTypes = [
        { tipo: 'Sede Legale', icon: 'gavel', id: 'legale' },
        { tipo: 'Sede Amministrativa', icon: 'admin_panel_settings', id: 'admin' },
        { tipo: 'Sede Operativa', icon: 'engineering', id: 'oper' },
        { tipo: 'Sede Commerciale', icon: 'storefront', id: 'comm' }
    ];

    fixedTypes.forEach(t => {
        let locData = null;
        if (t.tipo === 'Sede Legale') {
            locData = {
                tipo: 'Sede Legale',
                indirizzo: data.indirizzoSede || '',
                civico: data.civicoSede || '',
                citta: data.cittaSede || '',
                provincia: data.provinciaSede || '',
                cap: data.capSede || ''
            };
        } else if (data.altreSedi && Array.isArray(data.altreSedi)) {
            const found = data.altreSedi.find(s => s.tipo === t.tipo);
            if (found) locData = found;
        }

        locations.push({
            ...t,
            data: locData
        });
    });

    const tabsContainer = document.getElementById('locations-tabs-container');
    const indirizzoEl = document.getElementById('indirizzo-completo');
    const cittaEl = document.getElementById('citta-cap-prov');
    const mapBtn = document.getElementById('btn-vedi-mappa');
    const mapThumbnail = document.getElementById('location-map-thumbnail');

    window.switchLocation = function (index) {
        const entry = locations[index];
        if (!entry) return;

        const loc = entry.data;

        // Update Text
        if (loc && (loc.indirizzo || loc.citta)) {
            const fullAddr = `${loc.indirizzo || ''} ${loc.civico || ''}`.trim();
            let cityFull = `${loc.cap || ''} ${loc.citta || ''}`.trim();
            if (loc.provincia) cityFull += ` (${loc.provincia})`;

            indirizzoEl.textContent = fullAddr || 'Indirizzo non specificato';
            cittaEl.textContent = cityFull || '-';

            // Button Update
            if (mapBtn) {
                mapBtn.classList.remove('opacity-50', 'pointer-events-none');
                const query = encodeURIComponent(`${fullAddr}, ${cityFull}, Italy`); // Generic country append
                mapBtn.onclick = () => window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
            }

            // Map Thumbnail Logic (Using Iframe Embed instead of Static Image for reliability without specific API Key)
            if (mapThumbnail) {
                const query = encodeURIComponent(`${fullAddr}, ${cityFull}, Italy`);
                const embedUrl = `https://maps.google.com/maps?q=${query}&z=15&output=embed`;

                mapThumbnail.style.backgroundImage = 'none'; // Clear static bg

                // Hide fallback
                const fallback = mapThumbnail.querySelector('div'); // The icon container
                if (fallback) fallback.style.display = 'none';

                // Check for existing iframe
                let iframe = mapThumbnail.querySelector('iframe');
                if (!iframe) {
                    iframe = document.createElement('iframe');
                    // Aggressive cropping to hide "View larger map" text
                    // Container is approx 80x80px. We make iframe 400x400px and center it.
                    iframe.style.width = '400px';
                    iframe.style.height = '400px';
                    iframe.style.border = '0';
                    iframe.style.position = 'absolute';
                    iframe.style.top = '-160px'; // (400 - 80) / 2 = 160 offset to center
                    iframe.style.left = '-160px';
                    iframe.style.pointerEvents = 'none'; // Disable interactions

                    iframe.setAttribute('loading', 'lazy');
                    mapThumbnail.appendChild(iframe);
                }
                iframe.src = embedUrl;
                iframe.style.display = 'block';
            }

        } else {
            // No Data
            indirizzoEl.textContent = 'Indirizzo non presente';
            cittaEl.textContent = '-';

            if (mapBtn) {
                mapBtn.classList.add('opacity-50', 'pointer-events-none');
                mapBtn.onclick = null;
            }

            if (mapThumbnail) {
                mapThumbnail.style.backgroundImage = '';
                const iframe = mapThumbnail.querySelector('iframe');
                if (iframe) iframe.style.display = 'none';

                const fallback = mapThumbnail.querySelector('div');
                if (fallback) fallback.style.display = 'flex';
            }
        }

        // Update Tabs UI (DARK TITANIUM)
        document.querySelectorAll('.location-tab').forEach((tab, i) => {
            const icon = tab.querySelector('.material-symbols-outlined');
            if (i === index) {
                tab.classList.remove('bg-[#1e293b]', 'text-gray-400', 'border-white/5');
                tab.classList.add('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20', 'border-primary');
                if (icon) {
                    icon.classList.remove('text-gray-500');
                    icon.classList.add('text-white');
                }
            } else {
                tab.classList.add('bg-[#1e293b]', 'text-gray-400', 'border-white/5');
                tab.classList.remove('bg-primary', 'text-white', 'shadow-lg', 'shadow-primary/20', 'border-primary');
                if (icon) {
                    icon.classList.add('text-gray-500');
                    icon.classList.remove('text-white');
                }
            }
        });
    };

    if (tabsContainer) {
        tabsContainer.innerHTML = '';
        locations.forEach((entry, i) => {
            const btn = document.createElement('button');
            const hasData = entry.data && (entry.data.indirizzo || entry.data.citta);

            // Slightly more readable text (10px) but still compact (DARK TITANIUM)
            btn.className = `location-tab flex-1 flex flex-col items-center justify-center gap-1 px-1 py-1.5 rounded-lg text-[10px] font-bold transition-all duration-300 border uppercase active:scale-95 min-w-0 ${!hasData ? 'opacity-40 grayscale' : ''}`;

            const label = entry.tipo.replace('Sede ', '')
                .replace('Amministrativa', 'Amm.ne')
                .replace('Operativa', 'Operat.')
                .replace('Commerciale', 'Comm.le');

            btn.innerHTML = `
                <span class="material-symbols-outlined notranslate text-[16px] ${i === 0 ? 'text-white' : 'text-gray-500'} transition-colors">${entry.icon}</span>
                <span class="truncate w-full text-center">${label}</span>
            `;

            btn.onclick = () => switchLocation(i);
            tabsContainer.appendChild(btn);
        });

        // Default to first tab
        switchLocation(0);
    }

    // Fiscal Data
    set('piva', data.partitaIva);
    set('codice-sdi', data.codiceSDI);
    set('cciaa', data.numeroCCIAA);

    // Format Date: YYYY-MM-DD -> DD/MM/YYYY
    let dataIscrizioneFormatted = '-';
    if (data.dataIscrizione) {
        const parts = data.dataIscrizione.split('-');
        if (parts.length === 3) {
            dataIscrizioneFormatted = `${parts[2]}/${parts[1]}/${parts[0]}`;
        } else {
            dataIscrizioneFormatted = data.dataIscrizione; // Fallback
        }
    }
    set('data-iscrizione', dataIscrizioneFormatted);

    // Contacts
    set('telefono-azienda', data.telefonoAzienda);
    set('fax-azienda', data.faxAzienda);

    // Email Aziendali (Categorical)
    const wrapperEmail = document.getElementById('wrapper-email-section');
    const containerEmail = document.getElementById('email-list-container');
    const btnToggleEmail = document.getElementById('btn-toggle-email');

    if (wrapperEmail && containerEmail) {
        containerEmail.innerHTML = '';
        let hasAnyEmail = false;

        const categories = [
            { id: 'pec', label: 'PEC (Posta Certificata)', icon: 'verified_user' },
            { id: 'amministrazione', label: 'Amministrazione', icon: 'payments' },
            { id: 'personale', label: 'Personale', icon: 'group' },
            { id: 'manutenzione', label: 'Manutenzione', icon: 'build_circle' },
            { id: 'attrezzatura', label: 'Attrezzatura', icon: 'precision_manufacturing' },
            { id: 'magazzino', label: 'Magazzino', icon: 'inventory_2' }
        ];

        // Prepare list of emails to render
        const emailsToRender = [];

        categories.forEach(cat => {
            let emailData = data.emails ? data.emails[cat.id] : null;

            // Fallback for PEC/Legacy
            if (cat.id === 'pec' && !emailData && data.aziendaEmail) {
                emailData = {
                    email: data.aziendaEmail,
                    password: data.aziendaEmailPassword,
                    note: data.aziendaEmailPasswordNote
                };
            }

            if (emailData && (emailData.email || emailData.password)) {
                emailsToRender.push({
                    ...cat,
                    data: emailData
                });
            }
        });

        if (emailsToRender.length > 0) {
            hasAnyEmail = true;
            emailsToRender.forEach(item => {
                const itemId = `email-item-${item.id}`;
                const passId = `pass-${item.id}`;
                const rawPassId = `raw-pass-${item.id}`;

                const div = document.createElement('div');
                div.className = "bg-[#1e293b] rounded-xl shadow-lg border border-white/5 overflow-hidden";

                div.innerHTML = `
                    <!-- Visible Header: Icon, Title, Email, Expand Arrow -->
                    <div class="p-3 flex items-center gap-3 cursor-pointer hover:bg-white/5 transition-colors"
                         onclick="toggleEmailItem('${itemId}')">
                        <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-primary border border-primary/20">
                            <span class="material-symbols-outlined notranslate text-[20px]">${item.icon}</span>
                        </div>
                        <div class="flex-1 min-w-0">
                            <p class="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">${item.label}</p>
                            <div class="flex items-center gap-2">
                                <p class="text-sm font-medium text-white truncate select-all flex-1">${item.data.email || '-'}</p>
                                <button onclick="event.stopPropagation(); window.location.href='mailto:${item.data.email}'" class="p-1 text-primary hover:bg-primary/10 rounded-full transition-colors">
                                    <span class="material-symbols-outlined text-sm">mail</span>
                                </button>
                            </div>
                        </div>
                        <span id="arrow-${itemId}" class="material-symbols-outlined notranslate text-gray-500 transition-transform duration-300">expand_more</span>
                    </div>

                    <!-- Collapsible Body: Password & Notes -->
                    <div id="${itemId}" class="max-h-0 overflow-hidden transition-all duration-300 bg-black/20">
                        <div class="p-3 pt-0 border-t border-white/5 flex flex-col gap-3">
                            <div class="mt-3">
                                <div class="flex items-center justify-between mb-1">
                                    <span class="text-xs text-gray-500">Password</span>
                                    ${item.data.password ? `
                                    <button onclick="togglePasswordVisibility(this, 'masked-${passId}', '${rawPassId}')" 
                                        class="text-xs text-primary font-bold hover:underline flex items-center gap-1">
                                        <span class="material-symbols-outlined notranslate text-[14px]">visibility</span>
                                        MOSTRA
                                    </button>` : ''}
                                </div>
                                <div class="flex items-center gap-2 bg-[#0a0f1e] border border-white/10 rounded-lg p-2">
                                    <div class="flex-1 min-w-0 font-mono text-sm text-white truncate">
                                        ${item.data.password ? `
                                        <span id="masked-${passId}">••••••••</span>
                                        <span id="${rawPassId}" class="hidden">${item.data.password}</span>`
                        : '<span class="text-gray-500 italic">Nessuna password</span>'}
                                    </div>
                                    ${item.data.password ? `
                                    <button onclick="copyToClipboard('${rawPassId}')" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-primary transition-colors">
                                        <span class="material-symbols-outlined notranslate text-[18px]">content_copy</span>
                                    </button>` : ''}
                                </div>
                            </div>
                            ${item.data.note ? `
                            <div class="bg-amber-500/10 p-2 rounded-lg border border-amber-500/20">
                                <p class="selectable text-xs text-amber-500 italic">Note: ${item.data.note}</p>
                            </div>` : ''}
                        </div>
                    </div>
                `;
                containerEmail.appendChild(div);
            });
        }

        if (hasAnyEmail) {
            wrapperEmail.classList.remove('hidden');
        } else {
            wrapperEmail.classList.add('hidden');
        }
    }

    // Toggle Function for Email Items (Global or attached to window)
    window.toggleEmailItem = function (id) {
        const el = document.getElementById(id);
        const arrow = document.getElementById(`arrow-${id}`);
        if (!el) return;

        if (el.style.maxHeight) {
            el.style.maxHeight = null;
            if (arrow) arrow.style.transform = 'rotate(0deg)';
        } else {
            el.style.maxHeight = (el.scrollHeight + 20) + "px"; // Added buffer
            if (arrow) arrow.style.transform = 'rotate(180deg)';
        }
    };

    // Notes
    set('note-azienda', data.note);

    // After populating fields, setup interactions
    setupInteractions();
}

// Helper for opening maps (reusable)
window.openExternalMap = function (address) {
    if (address && address.trim() !== '' && address.trim() !== ',') {
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
        window.open(url, '_blank');
    } else {
        showToast('Indirizzo non valido', 'error');
    }
}

function setupInteractions() {
    // 1. Map Button
    const btnMappa = document.getElementById('btn-vedi-mappa');
    if (btnMappa) {
        btnMappa.addEventListener('click', (e) => {
            e.preventDefault();
            const addr = document.getElementById('indirizzo-completo').textContent;
            const city = document.getElementById('citta-cap-prov').textContent;
            if (addr !== '-' && city !== '-') {
                openExternalMap(`${addr}, ${city}`);
            } else {
                showToast('Indirizzo non disponibile', 'error');
            }
        });
    }

    // 2. Edit Note Button (Inline Logic)
    const btnEditNote = document.getElementById('btn-edit-note');
    const btnCancelNote = document.getElementById('btn-cancel-note');
    const noteView = document.getElementById('note-azienda');
    const noteEdit = document.getElementById('note-azienda-edit');

    if (btnEditNote && noteView && noteEdit) {
        btnEditNote.addEventListener('click', async () => {
            const isEditing = !noteEdit.classList.contains('hidden');

            if (!isEditing) {
                // START EDITING
                noteEdit.value = noteView.textContent === '-' ? '' : noteView.textContent;
                noteView.classList.add('hidden');
                noteEdit.classList.remove('hidden');
                btnEditNote.textContent = 'Salva';
                btnCancelNote.classList.remove('hidden');
            } else {
                // SAVE
                const newNote = noteEdit.value.trim();
                const urlParams = new URLSearchParams(window.location.search);
                const aziendaId = urlParams.get('id');
                const userById = auth.currentUser ? auth.currentUser.uid : null; // Should be available

                if (aziendaId && userById) {
                    try {
                        btnEditNote.textContent = 'Salvataggio...';
                        // Modular SDK: updateDoc(doc(db,...), {...})
                        const docRef = doc(db, "users", userById, "aziende", aziendaId);
                        await updateDoc(docRef, { note: newNote });

                        // Update View
                        noteView.textContent = newNote || '-';
                        showToast('Note aggiornate!', 'success');

                        // Reset UI to View Mode
                        noteView.classList.remove('hidden');
                        noteEdit.classList.add('hidden');
                        btnEditNote.textContent = 'Modifica';
                        btnCancelNote.classList.add('hidden');

                    } catch (err) {
                        console.error("Errore salvataggio note:", err);
                        showToast('Errore nel salvataggio.', 'error');
                        btnEditNote.textContent = 'Salva'; // Revert
                    }
                }
            }
        });

        if (btnCancelNote) {
            btnCancelNote.addEventListener('click', () => {
                // CANCEL
                noteView.classList.remove('hidden');
                noteEdit.classList.add('hidden');
                btnEditNote.textContent = 'Modifica';
                btnCancelNote.classList.add('hidden');
            });
        }
    }

    // 3. Copy Buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = (e) => { // Use onclick to override potential parent clicks
            e.stopPropagation(); // Prevent card click if any
            const targetId = btn.getAttribute('data-copy-target');
            if (targetId) {
                const targetEl = document.getElementById(targetId);
                const text = targetEl ? targetEl.textContent : '';

                if (text && text !== '-') {
                    navigator.clipboard.writeText(text).then(() => {
                        showToast('Copiato negli appunti!');
                    }).catch(err => {
                        console.error('Errore copia:', err);
                        showToast('Errore durante la copia', 'error');
                    });
                }
            }
        };
    });
}

// --- UI TOAST HELPER (from standard) ---
function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const msgEl = document.getElementById('toast-message');
    const iconEl = document.getElementById('toast-icon');

    if (!container || !msgEl || !iconEl) return;

    // Set content
    msgEl.textContent = message;
    if (type === 'success') {
        iconEl.textContent = 'check_circle';
        iconEl.className = 'material-symbols-outlined text-green-400 text-xl';
    } else {
        iconEl.textContent = 'error';
        iconEl.className = 'material-symbols-outlined text-red-400 text-xl';
    }

    // Show
    container.classList.remove('opacity-0', 'translate-y-10', 'pointer-events-none');

    // Hide after 3s
    setTimeout(() => {
        container.classList.add('opacity-0', 'translate-y-10', 'pointer-events-none');
    }, 3000);
}

// --- LOGO & QR CODE HANDLING ---
function handleLogoAndQR(data) {
    // Logo
    const logoImg = document.getElementById('azienda-logo');
    const logoPlaceholder = document.getElementById('azienda-logo-placeholder');

    if (logoImg && logoPlaceholder) {
        if (data.logo) {
            logoImg.src = data.logo;
            logoImg.classList.remove('hidden');
            logoPlaceholder.classList.add('hidden');
        } else {
            logoImg.classList.add('hidden');
            logoPlaceholder.classList.remove('hidden');
        }
    }

    // QR Code
    const qrConfig = data.qrConfig || {};
    generateQRCode(data, qrConfig);
}

function generateQRCode(data, config) {
    const container = document.getElementById('qrcode-container');
    if (!container) return;
    container.innerHTML = ''; // Clear previous

    // Build vCard 3.0
    let v = "BEGIN:VCARD\nVERSION:3.0\n";

    // FN = Formatted Name
    if (config.ragioneSociale || !data.qrConfig) {
        const name = data.ragioneSociale || 'Azienda';
        v += `FN:${name}\n`;
        v += `ORG:${name}\n`;
    }

    // P.IVA / SDI / CCIAA
    let noteParts = [];
    if (config.partitaIva && data.partitaIva) noteParts.push(`P.IVA: ${data.partitaIva}`);
    if (config.codiceSDI && data.codiceSDI) noteParts.push(`SDI: ${data.codiceSDI}`);
    if (config.numeroCCIAA && data.numeroCCIAA) noteParts.push(`CCIAA: ${data.numeroCCIAA}`);

    // Referente
    let hasReferente = false;
    let refN = "";
    if (config.referenteNome && data.referenteNome) {
        refN = data.referenteNome;
        hasReferente = true;
    }
    let refC = "";
    if (config.referenteCognome && data.referenteCognome) {
        refC = data.referenteCognome;
        hasReferente = true;
    }

    if (hasReferente) {
        v += `N:${refC};${refN};;;\n`;
    }

    if (config.referenteTitolo && data.referenteTitolo) v += `TITLE:${data.referenteTitolo}\n`;
    if (config.referenteCellulare && data.referenteCellulare) v += `TEL;TYPE=CELL:${data.referenteCellulare}\n`;

    // Azienda Contacts
    if (config.telefonoAzienda && data.telefonoAzienda) v += `TEL;TYPE=WORK,VOICE:${data.telefonoAzienda}\n`;
    if (config.faxAzienda && data.faxAzienda) v += `TEL;TYPE=WORK,FAX:${data.faxAzienda}\n`;
    if (config.aziendaEmail && data.aziendaEmail) v += `EMAIL;TYPE=PREF,INTERNET:${data.aziendaEmail}\n`;

    // Addresses
    // 1. Sede Legale (Backward compatibility + New unified flag)
    if (config.qrLegale || config.indirizzoSede || config.cittaSede) {
        const street = `${data.indirizzoSede || ''} ${data.civicoSede || ''}`.trim();
        const city = data.cittaSede || '';
        const prov = data.provinciaSede || '';
        const cap = data.capSede || '';
        v += `ADR;TYPE=WORK,POSTAL,PARCEL:;;${street};${city};${prov};${cap};Italy\n`;
    }

    // 2. Altre Sedi (Admin, Oper, Comm)
    if (data.altreSedi && data.altreSedi.length > 0) {
        data.altreSedi.forEach(sede => {
            let shouldInclude = false;
            if (sede.tipo === 'Sede Amministrativa' && config.qrAdmin) shouldInclude = true;
            if (sede.tipo === 'Sede Operativa' && config.qrOper) shouldInclude = true;
            if (sede.tipo === 'Sede Commerciale' && config.qrComm) shouldInclude = true;

            if (shouldInclude) {
                const street = `${sede.indirizzo || ''} ${sede.civico || ''}`.trim();
                const city = sede.citta || '';
                const prov = sede.provincia || '';
                const cap = sede.cap || '';
                v += `ADR;TYPE=WORK:;;${street};${city};${prov};${cap};Italy\n`;
            }
        });
    }

    // Categorical Emails (Custom Logic)
    // Map internal ID to config flag
    const emailFlags = [
        { id: 'amministrazione', flag: 'emailAmministrazione' },
        { id: 'personale', flag: 'emailPersonale' },
        { id: 'manutenzione', flag: 'emailManutenzione' },
        { id: 'attrezzatura', flag: 'emailAttrezzatura' },
        { id: 'magazzino', flag: 'emailMagazzino' }
    ];

    emailFlags.forEach(item => {
        if (config[item.flag] && data.emails && data.emails[item.id] && data.emails[item.id].email) {
            v += `EMAIL;TYPE=INTERNET:${data.emails[item.id].email}\n`;
        }
    });

    // Notes
    if (config.note && data.note) noteParts.push(`Note: ${data.note}`);

    if (noteParts.length > 0) {
        v += `NOTE:${noteParts.join(' - ')}\n`;
    }

    v += "END:VCARD";

    // Generate Main QR (Small)
    try {
        if (container) {
            container.innerHTML = '';
            new QRCode(container, {
                text: v,
                width: 150,
                height: 150,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    } catch (e) {
        console.error("QR Generation Error:", e);
        if (container) container.textContent = "Errore QR";
    }

    // Generate Zoom QR (Large)
    const zoomContainer = document.getElementById('qrcode-zoom-container');
    try {
        if (zoomContainer) {
            zoomContainer.innerHTML = '';
            new QRCode(zoomContainer, {
                text: v,
                width: 300,
                height: 300,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }
    } catch (e) { console.error("Zoom QR Error", e); }
}

// QR Zoom Functions
window.openQRZoom = function () {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Small delay to allow display:block to apply before opacity transition
        setTimeout(() => {
            modal.classList.remove('opacity-0');
            modal.querySelector('div').classList.remove('scale-90');
            modal.querySelector('div').classList.add('scale-100');
        }, 10);
    }
};

window.closeQRZoom = function () {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.add('opacity-0');
        modal.querySelector('div').classList.remove('scale-100');
        modal.querySelector('div').classList.add('scale-90');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300);
    }
};

window.togglePasswordVisibility = function (btn, maskedId, rawId) {
    const masked = document.getElementById(maskedId);
    const raw = document.getElementById(rawId);
    if (!masked || !raw) return;

    if (masked.textContent === '••••••••') {
        masked.textContent = raw.textContent;
        btn.innerHTML = '<span class="material-symbols-outlined notranslate text-[14px]">visibility_off</span> NASCONDI';
    } else {
        masked.textContent = '••••••••';
        btn.innerHTML = '<span class="material-symbols-outlined notranslate text-[14px]">visibility</span> MOSTRA';
    }
};

function renderAllegati(allegati) {
    const list = document.getElementById('allegati-list');
    const msg = document.getElementById('no-allegati-msg');

    if (!list) return;

    // Rimuovi vecchi elementi (tranne il messaggio di default)
    const items = list.querySelectorAll('.allegato-item');
    items.forEach(el => el.remove());

    if (!allegati || allegati.length === 0) {
        if (msg) msg.classList.remove('hidden');
        return;
    }

    if (msg) msg.classList.add('hidden');

    allegati.forEach(file => {
        const div = document.createElement('div');
        div.className = "allegato-item flex items-center justify-between p-3 bg-[#1e293b] rounded-xl border border-white/5 hover:border-primary/50 transition-all group";

        const extension = file.name.split('.').pop().toLowerCase();
        let icon = 'description';
        let iconColor = 'text-gray-400';

        if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
            icon = 'image';
            iconColor = 'text-blue-500';
        } else if (extension === 'pdf') {
            icon = 'picture_as_pdf';
            iconColor = 'text-red-500';
        } else if (['doc', 'docx'].includes(extension)) {
            icon = 'description';
            iconColor = 'text-blue-700';
        } else if (['xls', 'xlsx'].includes(extension)) {
            icon = 'table_chart';
            iconColor = 'text-green-600';
        }

        div.innerHTML = `
            <div class="flex items-center gap-3 min-w-0">
                <div class="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                    <span class="material-symbols-outlined notranslate text-[24px] ${iconColor}">${icon}</span>
                </div>
                <div class="flex flex-col min-w-0">
                    <span class="text-sm font-medium text-white truncate">${file.name}</span>
                    <span class="text-xs text-gray-500 truncate">${formatBytes(file.size)} • ${new Date(file.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
            <a href="${file.url}" target="_blank" class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-gray-400 hover:text-primary transition-colors">
                <span class="material-symbols-outlined notranslate">download</span>
            </a>
        `;
        list.appendChild(div);
    });
}

function formatBytes(bytes, decimals = 2) {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}
