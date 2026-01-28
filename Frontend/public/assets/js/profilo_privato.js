import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { t } from './translations.js';

/**
 * PROFILO PRIVATO MODULE (Titanium Account V1.1)
 */

document.addEventListener('DOMContentLoaded', () => {
    setupAccordions();
});

// --- STATE ---
let contactEmails = [];
let userUtilities = [];
let userDocuments = [];

// --- LOGIC: ACCORDIONS ---
function setupAccordions() {
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        acc.onclick = () => {
            const targetId = acc.dataset.target;
            const content = document.getElementById(targetId);
            const chevron = acc.querySelector('.settings-chevron');

            const isVisible = content.classList.contains('show');

            // Close others (optional, but keeps it clean)
            // document.querySelectorAll('.accordion-content').forEach(el => el.classList.remove('show'));
            // document.querySelectorAll('.settings-chevron').forEach(el => el.style.transform = 'rotate(0deg)');

            if (isVisible) {
                content.classList.remove('show');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            } else {
                content.classList.add('show');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
            }
        };
    });
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text || '-';
}

function formatDateToIT(val) {
    if (!val || val === '-') return '-';
    if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}$/)) {
        const [y, m, d] = val.split('-');
        return `${d}/${m}/${y}`;
    }
    return val;
}

// --- RENDERING: EMAILS ---
function renderEmailsView() {
    const container = document.getElementById('email-view-container');
    if (!container) return;
    container.innerHTML = '';

    const visibleEmails = contactEmails.filter(e => e.visible);

    if (visibleEmails.length === 0) {
        container.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;">Nessuna email visibile</p>`;
        return;
    }

    visibleEmails.forEach(e => {
        const div = document.createElement('div');
        div.className = "glass-field-titanium glass-field-cyan";
        div.style.flexDirection = "column";
        div.style.alignItems = "flex-start";
        div.style.height = "auto";
        div.style.padding = "1rem";

        let passwordHtml = '';
        if (e.password) {
            passwordHtml = `
                <div style="width:100%; margin-top:1rem;">
                    <span class="field-label">Password</span>
                    <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                        <span class="field-value" style="font-family:monospace;">********</span>
                        <div style="display:flex; gap:0.5rem;">
                             <button class="btn-icon-header" style="position:relative; width:32px; height:32px; border-radius:8px;" 
                                onclick="const txt = this.parentElement.previousElementSibling; 
                                         const isMasked = txt.textContent === '********';
                                         txt.textContent = isMasked ? '${e.password.replace(/'/g, "\\'")}' : '********';
                                         this.querySelector('span').textContent = isMasked ? 'visibility' : 'visibility_off';">
                                <span class="material-symbols-outlined" style="font-size:18px;">visibility_off</span>
                            </button>
                             <button class="btn-icon-header" style="position:relative; width:32px; height:32px; border-radius:8px;" 
                                onclick="navigator.clipboard.writeText('${e.password.replace(/'/g, "\\'")}').then(() => alert('Copiato!'))">
                                <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }

        div.innerHTML = `
            <div style="width:100%;">
                <span class="field-label">Indirizzo Email</span>
                <div style="display:flex; align-items:center; justify-content:space-between; width:100%;">
                    <span class="field-value">${e.address}</span>
                    <button class="btn-icon-header" style="position:relative; width:32px; height:32px; border-radius:8px;" 
                            onclick="navigator.clipboard.writeText('${e.address.replace(/'/g, "\\'")}').then(() => alert('Copiato!'))">
                        <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                    </button>
                </div>
            </div>
            ${passwordHtml}
        `;
        container.appendChild(div);
    });
}

// --- RENDERING: UTENZE ---
function renderUtenzeView() {
    const container = document.getElementById('utenze-view-container');
    if (!container) return;
    container.innerHTML = '';

    if (userUtilities.length === 0) {
        container.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;">Nessuna utenza registrata</p>`;
        return;
    }

    userUtilities.forEach((u) => {
        const div = document.createElement('div');
        div.className = "glass-field-titanium glass-field-amber";
        div.innerHTML = `
            <span class="field-label">${u.type || 'Utenza'}</span>
            <span class="field-value">${u.value || '-'}</span>
            <button class="btn-icon-header" style="position:relative; width:32px; height:32px; border-radius:8px;" 
                    onclick="navigator.clipboard.writeText('${(u.value || '').replace(/'/g, "\\'")}').then(() => alert('Copiato!'))">
                <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
            </button>
        `;
        container.appendChild(div);
    });
}

// --- RENDERING: DOCUMENTI ---
function renderDocumentiView() {
    const container = document.getElementById('documenti-view-container');
    if (!container) return;
    container.innerHTML = '';

    if (userDocuments.length === 0) {
        container.innerHTML = `<p style="text-align:center; opacity:0.5; font-size:0.8rem; padding:1rem;">Nessun documento registrato</p>`;
        return;
    }

    userDocuments.forEach((docItem) => {
        const div = document.createElement('div');
        div.className = "glass-field-titanium glass-field-violet";
        div.style.flexDirection = "column";
        div.style.alignItems = "flex-start";
        div.style.height = "auto";
        div.style.padding = "1.5rem 1rem";

        // Logic fields display
        let info = [];
        if (docItem.num_serie || docItem.id_number || docItem.license_number) info.push(docItem.num_serie || docItem.id_number || docItem.license_number);
        if (docItem.expiry_date) info.push("Scadenza: " + formatDateToIT(docItem.expiry_date));

        div.innerHTML = `
            <span class="field-label">${docItem.type || 'Documento'}</span>
            <div style="width:100%; display:flex; justify-content:space-between; align-items:center;">
                <div style="display:flex; flex-direction:column; gap:0.2rem;">
                    <span class="field-value" style="font-size:1rem;">${info[0] || docItem.type}</span>
                    <span style="font-size:0.7rem; opacity:0.6; font-weight:700; text-transform:uppercase;">${info[1] || ''}</span>
                </div>
                <button class="btn-icon-header" style="position:relative; width:32px; height:32px; border-radius:8px;" 
                        onclick="navigator.clipboard.writeText('${(info[0] || '').replace(/'/g, "\\'")}').then(() => alert('Copiato!'))">
                    <span class="material-symbols-outlined" style="font-size:18px;">content_copy</span>
                </button>
            </div>
        `;
        container.appendChild(div);
    });
}

// --- MAIN LOGIC ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    try {
        setText('profile-email', user.email);
        const avatar = document.getElementById('profile-avatar');

        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            const data = userDoc.data();
            const fullName = `${data.nome || ''} ${data.cognome || ''}`.trim() || t('user_default');

            setText('profile-name', fullName);

            // Avatar Fix
            const photoURL = data.photoURL || user.photoURL || "assets/images/user-avatar-5.png";
            if (avatar) avatar.src = photoURL;

            // Dati Personali
            setText('nome-view', data.nome);
            setText('cognome-view', data.cognome);
            setText('cf-view', data.cf || data.codiceFiscale);
            setText('birth_date-view', formatDateToIT(data.birth_date));
            setText('birth_place-view', `${data.birth_place || ''} ${data.birth_province ? '(' + data.birth_province + ')' : ''}`.trim());

            // Residenza
            const addressFull = `${data.residence_address || ''} ${data.residence_civic || ''}`.trim();
            const cityFull = `${data.residence_cap || ''} ${data.residence_city || ''} ${data.residence_province ? '(' + data.residence_province + ')' : ''}`.trim();
            setText('field-address-full', addressFull);
            setText('field-city-full', cityFull);

            // Contatti
            const mobile = data.mobile_private || '-';
            setText('mobile_private-view', mobile);
            const phone = data.phone_private || '-';
            setText('phone_private-view', phone);

            const btnCallMobile = document.getElementById('btn-call-mobile-sm');
            if (btnCallMobile && mobile !== '-') {
                btnCallMobile.onclick = () => window.location.href = `tel:${mobile.replace(/\s/g, '')}`;
            }
            const btnCallPhone = document.getElementById('btn-call-phone-sm');
            if (btnCallPhone && phone !== '-') {
                btnCallPhone.onclick = () => window.location.href = `tel:${phone.replace(/\s/g, '')}`;
            }

            // Note
            setText('note-view', data.note || '-');

            // Complex Views
            contactEmails = data.contactEmails || [];
            if (contactEmails.length === 0 && (data.email || user.email)) {
                contactEmails.push({ address: data.email || user.email, visible: true });
            }
            renderEmailsView();

            userUtilities = data.utenze || [];
            renderUtenzeView();

            userDocuments = data.documenti || [];
            renderDocumentiView();

            // QR Code
            const qrContainer = document.getElementById('qrcode');
            if (typeof QRCode !== 'undefined' && qrContainer) {
                qrContainer.innerHTML = '';
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${fullName}\nTEL;TYPE=CELL:${mobile}\nEMAIL:${user.email}\nEND:VCARD`;
                new QRCode(qrContainer, {
                    text: vcard,
                    width: 120,
                    height: 120,
                    colorDark: "#050a18",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
            }
        }
    } catch (e) {
        console.error("Profile load error", e);
    }
});
