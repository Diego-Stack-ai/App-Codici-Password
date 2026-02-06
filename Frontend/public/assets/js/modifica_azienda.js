import { auth, db, storage } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    doc, getDoc, updateDoc, deleteDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import {
    ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-storage.js";

let currentUid = null;
let currentAziendaId = null;
let empresaData = {};
let selectedFiles = [];
let existingAttachments = [];
let selectedColorIndex = 0;

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);
const showConfirmModal = (t, m, c, d) => window.showConfirmModal ? window.showConfirmModal(t, m, c, d) : Promise.resolve(confirm(m));

document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    currentAziendaId = urlParams.get('id');

    if (!currentAziendaId) {
        showToast("ID mancante", "error");
        setTimeout(() => window.location.href = 'lista_aziende.html', 1500);
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUid = user.uid;
            await loadAzienda();
            initFormEvents();
            setupFooterActions();
        } else {
            window.location.href = 'index.html';
        }
    });
});

async function loadAzienda() {
    try {
        const docRef = doc(db, "users", currentUid, "aziende", currentAziendaId);
        const snap = await getDoc(docRef);
        if (!snap.exists()) {
            showToast("Azienda non trovata", "error");
            return;
        }
        empresaData = snap.data();
        populateForm(empresaData);
    } catch (e) {
        console.error(e);
        showToast("Errore caricamento", "error");
    }
}

function initFormEvents() {
    // Logo & Photos
    document.getElementById('btn-trigger-logo')?.addEventListener('click', () => document.getElementById('logo-upload').click());
    document.getElementById('logo-upload')?.addEventListener('change', (e) => handleImagePreview(e, 'logo-preview', 'logo-placeholder'));

    document.getElementById('btn-trigger-ref-photo')?.addEventListener('click', () => document.getElementById('referente-photo-upload').click());
    document.getElementById('referente-photo-upload')?.addEventListener('change', (e) => handleImagePreview(e, 'referente-photo-preview', 'referente-photo-placeholder'));

    // Collapsibles
    document.body.addEventListener('click', (e) => {
        const btnToggle = e.target.closest('.btn-toggle-section');
        if (btnToggle) toggleSection(btnToggle.dataset.target);

        // Visibility Toggles
        const btnPass = e.target.closest('.btn-toggle-pass');
        if (btnPass) {
            const input = document.getElementById(btnPass.dataset.target);
            const isShield = input.classList.toggle('base-shield');
            btnPass.querySelector('span').textContent = isShield ? 'visibility' : 'visibility_off';
        }
    });

    // Attachments
    document.getElementById('btn-trigger-upload')?.addEventListener('click', () => document.getElementById('file-input').click());
    document.getElementById('file-input')?.addEventListener('change', (e) => {
        selectedFiles.push(...Array.from(e.target.files));
        renderAttachments();
        e.target.value = '';
    });

    // Delegated Remove Attachment
    document.getElementById('attachments-list')?.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-remove-attach');
        if (!btn) return;
        const idx = parseInt(btn.dataset.idx);
        const existing = btn.dataset.existing === 'true';
        if (existing) existingAttachments.splice(idx, 1);
        else selectedFiles.splice(idx, 1);
        renderAttachments();
    });
}

function handleImagePreview(e, previewId, placeholderId) {
    if (e.target.files && e.target.files[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => {
            const img = document.getElementById(previewId);
            img.src = ev.target.result;
            img.classList.remove('hidden');
            document.getElementById(placeholderId)?.classList.add('hidden');
        };
        reader.readAsDataURL(e.target.files[0]);
    }
}

function toggleSection(id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    if (!el) return;

    const isOpen = el.style.maxHeight !== '0px' && el.style.maxHeight !== '';
    if (isOpen) {
        el.style.maxHeight = '0px';
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    } else {
        el.style.maxHeight = '1000px'; // Value large enough
        if (arrow) arrow.style.transform = 'rotate(180deg)';
    }
}

function populateForm(data) {
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };

    set('ragione-sociale', data.ragioneSociale);
    set('piva', data.partitaIva);
    set('codice-sdi', data.codiceSDI);
    set('color-azienda', data.themeColor || '#3b82f6');

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
    set('data-iscrizione', data.dataIscrizione);

    // Emails
    if (data.emails) {
        set('email-pec', data.emails.pec?.email);
        set('email-pec-password', data.emails.pec?.password);
        set('email-pec-note', data.emails.pec?.note);
        set('email-amministrazione', data.emails.amministrazione?.email);
        set('email-amministrazione-password', data.emails.amministrazione?.password);
        set('email-personale', data.emails.personale?.email);
        set('email-personale-password', data.emails.personale?.password);
    }

    set('note-azienda', data.note);

    // Images
    if (data.logo) {
        const preview = document.getElementById('logo-preview');
        preview.src = data.logo;
        preview.classList.remove('hidden');
        document.getElementById('logo-placeholder').classList.add('hidden');
    }
    if (data.referentePhoto) {
        const preview = document.getElementById('referente-photo-preview');
        preview.src = data.referentePhoto;
        preview.classList.remove('hidden');
        document.getElementById('referente-photo-placeholder').classList.add('hidden');
    }

    // Altre Sedi
    if (data.altreSedi) {
        const admin = data.altreSedi.find(s => s.tipo === 'Sede Amministrativa');
        if (admin) {
            set('admin-indirizzo', admin.indirizzo);
            set('admin-civico', admin.civico);
            set('admin-citta', admin.citta);
            set('admin-provincia', admin.provincia);
            set('admin-cap', admin.cap);
        }
        const oper = data.altreSedi.find(s => s.tipo === 'Sede Operativa');
        if (oper) {
            set('oper-indirizzo', oper.indirizzo);
            set('oper-civico', oper.civico);
            set('oper-citta', oper.citta);
            set('oper-provincia', oper.provincia);
            set('oper-cap', oper.cap);
        }
    }

    // QR Config
    document.querySelectorAll('input[data-qr-field]').forEach(cb => {
        const field = cb.dataset.qrField;
        if (data.qrConfig && data.qrConfig.hasOwnProperty(field)) cb.checked = data.qrConfig[field];
    });

    // Attachments
    existingAttachments = data.allegati || [];
    renderAttachments();
}

function renderAttachments() {
    const list = document.getElementById('attachments-list');
    if (!list) return;
    list.innerHTML = '';

    const all = [
        ...existingAttachments.map((f, i) => ({ ...f, existing: true, idx: i })),
        ...selectedFiles.map((f, i) => ({ name: f.name, existing: false, idx: i }))
    ];

    list.innerHTML = all.map(f => `
        <div class="flex items-center justify-between p-3 glass-card border-white/5 animate-in slide-in-from-left-2 transition-all">
            <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-white/20">${f.name.toLowerCase().endsWith('.pdf') ? 'picture_as_pdf' : 'description'}</span>
                <div class="flex-col">
                    <span class="text-[10px] font-black text-white/80 uppercase truncate max-w-[150px]">${f.name}</span>
                    <span class="text-[8px] font-bold text-white/20 uppercase tracking-widest">${f.existing ? 'Caricato' : 'Nuovo'}</span>
                </div>
            </div>
            <button class="btn-remove-attach size-8 flex-center text-red-400/40 hover:text-red-400 transition-colors" data-idx="${f.idx}" data-existing="${f.existing}">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
        </div>
    `).join('');
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
            document.getElementById('btn-save').onclick = saveAzienda;
            document.getElementById('btn-delete').onclick = deleteAzienda;
        }
    }, 100);
}

async function saveAzienda() {
    const ragioneSociale = document.getElementById('ragione-sociale').value.trim();
    if (!ragioneSociale) { showToast("Ragione Sociale obbligatoria", "error"); return; }

    const btn = document.getElementById('btn-save');
    btn.disabled = true;
    btn.innerHTML = `<span class="material-symbols-outlined animate-spin text-sm">sync</span>`;

    try {
        const qrConfig = {};
        document.querySelectorAll('input[data-qr-field]').forEach(cb => qrConfig[cb.dataset.qrField] = cb.checked);

        const altreSedi = [];
        const types = [
            { id: 'admin', tipo: 'Sede Amministrativa' },
            { id: 'oper', tipo: 'Sede Operativa' }
        ];
        types.forEach(t => {
            const addr = document.getElementById(`${t.id}-indirizzo`).value.trim();
            if (addr) {
                altreSedi.push({
                    tipo: t.tipo,
                    indirizzo: addr,
                    civico: document.getElementById(`${t.id}-civico`).value.trim(),
                    citta: document.getElementById(`${t.id}-citta`).value.trim(),
                    provincia: document.getElementById(`${t.id}-provincia`).value.trim().toUpperCase(),
                    cap: document.getElementById(`${t.id}-cap`).value.trim()
                });
            }
        });

        const data = {
            ragioneSociale,
            partitaIva: document.getElementById('piva').value.trim(),
            codiceSDI: document.getElementById('codice-sdi').value.trim().toUpperCase(),
            themeColor: document.getElementById('color-azienda').value,
            referenteTitolo: document.getElementById('referente-titolo').value.trim(),
            referenteNome: document.getElementById('referente-nome').value.trim(),
            referenteCognome: document.getElementById('referente-cognome').value.trim(),
            referenteCellulare: document.getElementById('referente-cellulare').value.trim(),
            indirizzoSede: document.getElementById('indirizzo').value.trim(),
            civicoSede: document.getElementById('civico').value.trim(),
            cittaSede: document.getElementById('citta').value.trim(),
            provinciaSede: document.getElementById('provincia').value.trim().toUpperCase(),
            capSede: document.getElementById('cap').value.trim(),
            numeroCCIAA: document.getElementById('numero-cciaa').value.trim(),
            dataIscrizione: document.getElementById('data-iscrizione').value,
            emails: {
                pec: {
                    email: document.getElementById('email-pec').value.trim(),
                    password: document.getElementById('email-pec-password').value.trim(),
                    note: document.getElementById('email-pec-note').value.trim()
                },
                amministrazione: {
                    email: document.getElementById('email-amministrazione').value.trim(),
                    password: document.getElementById('email-amministrazione-password').value.trim()
                },
                personale: {
                    email: document.getElementById('email-personale').value.trim(),
                    password: document.getElementById('email-personale-password').value.trim()
                }
            },
            note: document.getElementById('note-azienda').value.trim(),
            qrConfig,
            altreSedi,
            updatedAt: serverTimestamp()
        };

        // Resize & Attach Images
        const logoSrc = document.getElementById('logo-preview').src;
        if (logoSrc.startsWith('data:')) data.logo = await resizeImage(logoSrc, 400);
        const refSrc = document.getElementById('referente-photo-preview').src;
        if (refSrc.startsWith('data:')) data.referentePhoto = await resizeImage(refSrc, 300);

        // Upload New Attachments
        const newAtt = [];
        for (const file of selectedFiles) {
            btn.innerHTML = `<span class="text-[8px] font-black uppercase">Upload ${file.name.substring(0, 5)}...</span>`;
            const sRef = ref(storage, `users/${currentUid}/aziende_allegati/${Date.now()}_${file.name}`);
            const snap = await uploadBytes(sRef, file);
            const url = await getDownloadURL(snap.ref);
            newAtt.push({ name: file.name, url, type: file.type, size: file.size, date: new Date().toISOString() });
        }
        data.allegati = [...existingAttachments, ...newAtt];

        await updateDoc(doc(db, "users", currentUid, "aziende", currentAziendaId), data);
        showToast("Azienda salvata!", "success");
        setTimeout(() => window.location.href = `dati_azienda.html?id=${currentAziendaId}`, 1000);
    } catch (e) {
        console.error(e);
        showToast("Errore salvataggio", "error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `<span class="material-symbols-outlined">save</span>`;
    }
}

async function deleteAzienda() {
    const ok = await showConfirmModal("ELIMINA AZIENDA", "Questa operazione è irreversibile. Eliminare definitivamente l'azienda?", "Elimina", true);
    if (!ok) return;

    try {
        await deleteDoc(doc(db, "users", currentUid, "aziende", currentAziendaId));
        showToast("Azienda eliminata", "success");
        setTimeout(() => window.location.href = 'lista_aziende.html', 1000);
    } catch (e) { console.error(e); showToast("Errore eliminazione", "error"); }
}

function resizeImage(base64, maxW = 300) {
    return new Promise(res => {
        const img = new Image();
        img.src = base64;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            let w = img.width, h = img.height;
            if (w > maxW) { h *= maxW / w; w = maxW; }
            canvas.width = w; canvas.height = h;
            canvas.getContext('2d').drawImage(img, 0, 0, w, h);
            res(canvas.toDataURL('image/jpeg', 0.8));
        };
    });
}
