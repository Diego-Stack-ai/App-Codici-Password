import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

let currentAziendaId = new URLSearchParams(window.location.search).get('id');
let currentAziendaData = null;
let currentLocations = [];

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);

document.addEventListener('DOMContentLoaded', () => {
    // 1. Zoom QR
    document.getElementById('btn-zoom-qr')?.addEventListener('click', openQRZoom);
    document.getElementById('btn-close-qr')?.addEventListener('click', closeQRZoom);
    document.getElementById('qr-zoom-modal')?.addEventListener('click', closeQRZoom);

    // 2. Edit Note
    const btnEditNote = document.getElementById('btn-edit-note');
    const btnCancelNote = document.getElementById('btn-cancel-note');
    const noteView = document.getElementById('note-azienda');
    const noteEdit = document.getElementById('note-azienda-edit');

    btnEditNote?.addEventListener('click', async () => {
        const isEditing = !noteEdit.classList.contains('hidden');
        if (!isEditing) {
            noteEdit.value = noteView.textContent === '-' ? '' : noteView.textContent;
            noteView.classList.add('hidden');
            noteEdit.classList.remove('hidden');
            btnEditNote.textContent = 'Salva';
            btnCancelNote.classList.remove('hidden');
        } else {
            const newNote = noteEdit.value.trim();
            try {
                btnEditNote.disabled = true;
                await updateDoc(doc(db, "users", auth.currentUser.uid, "aziende", currentAziendaId), { note: newNote });
                noteView.textContent = newNote || '-';
                showToast('Note aggiornate', 'success');
                exitNoteEdit();
            } catch (e) {
                console.error(e);
                showToast('Errore salvataggio', 'error');
            } finally {
                btnEditNote.disabled = false;
            }
        }
    });

    btnCancelNote?.addEventListener('click', exitNoteEdit);

    function exitNoteEdit() {
        noteView.classList.remove('hidden');
        noteEdit.classList.add('hidden');
        btnEditNote.textContent = 'Modifica';
        btnCancelNote.classList.add('hidden');
    }

    // 3. Toggle Allegati
    document.getElementById('toggle-allegati-btn')?.addEventListener('click', () => {
        const container = document.getElementById('allegati-container');
        const chevron = document.getElementById('allegati-chevron');
        const isHidden = container.classList.toggle('hidden');
        if (chevron) chevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    // 4. Delegated Copy Actions
    document.body.addEventListener('click', (e) => {
        const btn = e.target.closest('.copy-btn');
        if (btn) {
            const id = btn.dataset.copyId;
            const text = document.getElementById(id)?.textContent;
            if (text && text !== '-') {
                navigator.clipboard.writeText(text).then(() => showToast('Copiato!', 'success'));
            }
        }
    });

    // 5. Auth & Load
    onAuthStateChanged(auth, async (user) => {
        if (user && currentAziendaId) {
            await loadData();
            setupFooterActions();
        } else if (!user) {
            window.location.href = 'index.html';
        }
    });
});

async function loadData() {
    try {
        const snap = await getDoc(doc(db, "users", auth.currentUser.uid, "aziende", currentAziendaId));
        if (snap.exists()) {
            currentAziendaData = snap.data();
            populateFields(currentAziendaData);
            handleLogoAndQR(currentAziendaData);
            renderAllegati(currentAziendaData.allegati);
        } else {
            showToast("Azienda non trovata", "error");
        }
    } catch (e) {
        console.error(e);
    }
}

function setupFooterActions() {
    const interval = setInterval(() => {
        const footerRight = document.getElementById('footer-right-actions');
        if (footerRight) {
            clearInterval(interval);
            footerRight.innerHTML = `
                <button id="footer-btn-edit" class="base-btn-primary flex-center-gap" title="Modifica Azienda">
                    <span class="material-symbols-outlined">edit</span>
                    <span data-t="edit">Modifica</span>
                </button>
            `;
            document.getElementById('footer-btn-edit').onclick = () => {
                window.location.href = `modifica_azienda.html?id=${currentAziendaId}`;
            };
        }
    }, 100);
}

function populateFields(data) {
    const set = (id, val) => { if (document.getElementById(id)) document.getElementById(id).textContent = val || '-'; };

    set('ragione-sociale', data.ragioneSociale);
    set('forma-giuridica', data.formaGiuridica);
    set('referente-nome', `${data.referenteNome || ''} ${data.referenteCognome || ''}`.trim());
    set('referente-ruolo', data.referenteTitolo);
    set('referente-cellulare', data.referenteCellulare);

    // Call Actions
    const btnCallRef = document.getElementById('btn-call-referente');
    if (btnCallRef) btnCallRef.href = data.referenteCellulare ? `tel:${data.referenteCellulare}` : '#';

    const btnCallTel = document.getElementById('btn-call-tel');
    if (btnCallTel) btnCallTel.href = data.telefonoAzienda ? `tel:${data.telefonoAzienda}` : '#';

    set('telefono-azienda', data.telefonoAzienda);
    set('fax-azienda', data.faxAzienda);
    set('piva', data.partitaIva);
    set('codice-sdi', data.codiceSDI);
    set('cciaa', data.numeroCCIAA);
    set('note-azienda', data.note);

    if (data.dataIscrizione) {
        const p = data.dataIscrizione.split('-');
        set('data-iscrizione', p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : data.dataIscrizione);
    }

    // Photos
    const refPhoto = document.getElementById('referente-photo');
    const refPlace = document.getElementById('referente-photo-placeholder');
    if (data.referentePhoto && refPhoto) {
        refPhoto.src = data.referentePhoto;
        refPhoto.classList.remove('hidden');
        refPlace?.classList.add('hidden');
    }

    setupLocations(data);
    renderEmailCategories(data);
}

function setupLocations(data) {
    currentLocations = [
        { tipo: 'Legale', icon: 'gavel', data: { indirizzo: data.indirizzoSede, civico: data.civicoSede, citta: data.cittaSede, cap: data.capSede, prov: data.provinciaSede } }
    ];
    if (data.altreSedi && Array.isArray(data.altreSedi)) {
        data.altreSedi.forEach(s => {
            currentLocations.push({ tipo: s.tipo.replace('Sede ', ''), icon: 'domain', data: s });
        });
    }

    const tabs = document.getElementById('locations-tabs-container');
    if (!tabs) return;

    tabs.innerHTML = currentLocations.map((l, i) => `
        <button class="location-tab-btn flex-center-col gap-1 min-w-[70px] p-2 rounded-xl transition-all border ${i === 0 ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' : 'bg-white/5 border-white/5 text-white/40'}" data-index="${i}">
            <span class="material-symbols-outlined text-lg">${l.icon}</span>
            <span class="text-[9px] font-black uppercase tracking-tighter truncate w-full text-center">${l.tipo}</span>
        </button>
    `).join('');

    tabs.querySelectorAll('.location-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => switchLocation(parseInt(btn.dataset.index)));
    });

    switchLocation(0);
}

function switchLocation(index) {
    const loc = currentLocations[index];
    const d = loc.data;

    const set = (id, val) => { if (document.getElementById(id)) document.getElementById(id).textContent = val || '-'; };
    const fullAddr = `${d.indirizzo || ''} ${d.civico || ''}`.trim();
    const cityFull = `${d.cap || ''} ${d.citta || ''} ${d.prov ? '(' + d.prov + ')' : ''}`.trim();

    set('indirizzo-completo', fullAddr || 'Indirizzo non specificato');
    set('citta-cap-prov', cityFull || '-');

    const btnMap = document.getElementById('btn-vedi-mappa');
    if (btnMap) {
        btnMap.onclick = () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddr + ' ' + cityFull)}`, '_blank');
        btnMap.disabled = !fullAddr && !cityFull;
    }

    // Update Tabs UI
    document.querySelectorAll('.location-tab-btn').forEach((btn, i) => {
        if (i === index) {
            btn.classList.add('bg-blue-500/20', 'border-blue-500/30', 'text-blue-400');
            btn.classList.remove('bg-white/5', 'border-white/5', 'text-white/40');
        } else {
            btn.classList.remove('bg-blue-500/20', 'border-blue-500/30', 'text-blue-400');
            btn.classList.add('bg-white/5', 'border-white/5', 'text-white/40');
        }
    });

    // Update Thumbnail (Iframe)
    const thumb = document.getElementById('location-map-thumbnail');
    if (thumb && (fullAddr || cityFull)) {
        const query = encodeURIComponent(`${fullAddr}, ${cityFull}, Italy`);
        thumb.innerHTML = `<iframe style="width:300px; height:300px; border:0; position:absolute; top:-100px; left:-100px; pointer-events:none;" 
                            loading="lazy" src="https://maps.google.com/maps?q=${query}&z=15&output=embed"></iframe>`;
    }
}

function renderEmailCategories(data) {
    const wrap = document.getElementById('wrapper-email-section');
    const container = document.getElementById('email-list-container');
    if (!container) return;

    const cats = [
        { id: 'pec', label: 'PEC', icon: 'verified_user', email: data.aziendaEmail || data.emails?.pec?.email },
        { id: 'amministrazione', label: 'Amm.ne', icon: 'payments', email: data.emails?.amministrazione?.email },
        { id: 'personale', label: 'Personale', icon: 'group', email: data.emails?.personale?.email },
        { id: 'manutenzione', label: 'Manutenz.', icon: 'build_circle', email: data.emails?.manutenzione?.email },
        { id: 'attrezzatura', label: 'Attrezzat.', icon: 'precision_manufacturing', email: data.emails?.attrezzatura?.email },
        { id: 'magazzino', label: 'Magazzino', icon: 'inventory_2', email: data.emails?.magazzino?.email }
    ].filter(c => c.email);

    if (cats.length > 0) {
        wrap?.classList.remove('hidden');
        container.innerHTML = cats.map(c => `
            <div class="glass-card flex items-center justify-between p-4 group">
                <div class="flex items-center gap-3">
                    <div class="size-10 rounded-xl bg-purple-500/10 text-purple-400 flex-center border border-purple-500/10 shrink-0">
                        <span class="material-symbols-outlined text-xl">${c.icon}</span>
                    </div>
                    <div class="flex flex-col min-w-0">
                        <span class="text-[9px] font-black uppercase text-white/40 tracking-widest">${c.label}</span>
                        <a href="mailto:${c.email}" class="text-sm font-bold text-white truncate break-all">${c.email}</a>
                    </div>
                </div>
                <span class="copy-btn material-symbols-outlined text-xs opacity-20 group-hover:opacity-100 transition-opacity cursor-pointer" data-copy-id="${c.id}-email-text">content_copy</span>
                <span id="${c.id}-email-text" class="hidden">${c.email}</span>
            </div>
        `).join('');
    }
}

function handleLogoAndQR(data) {
    const logoImg = document.getElementById('azienda-logo');
    const logoPlace = document.getElementById('azienda-logo-placeholder');
    if (data.logo && logoImg) {
        logoImg.src = data.logo;
        logoImg.classList.remove('hidden');
        logoPlace?.classList.add('hidden');
    }

    const vcard = buildVCard(data);
    const options = { width: 100, height: 100, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.M };

    const qrCont = document.getElementById('qrcode-container');
    if (qrCont) { qrCont.innerHTML = ''; new QRCode(qrCont, { ...options, text: vcard }); }

    const qrZoom = document.getElementById('qrcode-zoom-container');
    if (qrZoom) { qrZoom.innerHTML = ''; new QRCode(qrZoom, { ...options, width: 300, height: 300, text: vcard }); }
}

function buildVCard(data) {
    let v = "BEGIN:VCARD\nVERSION:3.0\n";
    v += `FN:${data.ragioneSociale}\nORG:${data.ragioneSociale}\n`;
    if (data.referenteCellulare) v += `TEL;TYPE=CELL:${data.referenteCellulare}\n`;
    if (data.telefonoAzienda) v += `TEL;TYPE=WORK,VOICE:${data.telefonoAzienda}\n`;
    if (data.aziendaEmail) v += `EMAIL;TYPE=PREF,INTERNET:${data.aziendaEmail}\n`;
    v += "END:VCARD";
    return v;
}

function openQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            modal.classList.add('opacity-100');
            modal.children[1].classList.remove('scale-90');
            modal.children[1].classList.add('scale-100');
        }, 10);
    }
}

function closeQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.remove('opacity-100');
        modal.children[1].classList.remove('scale-100');
        modal.children[1].classList.add('scale-90');
        setTimeout(() => modal.classList.add('hidden'), 300);
    }
}

function renderAllegati(allegati) {
    const container = document.getElementById('allegati-list');
    if (!container) return;
    if (!allegati || allegati.length === 0) return;

    container.innerHTML = allegati.map(a => `
        <a href="${a.url}" target="_blank" class="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all group">
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-blue-400">description</span>
                <span class="text-xs text-white/80 font-medium">${a.nome}</span>
            </div>
            <span class="material-symbols-outlined text-sm opacity-20 group-hover:opacity-100">open_in_new</span>
        </a>
    `).join('');
}
