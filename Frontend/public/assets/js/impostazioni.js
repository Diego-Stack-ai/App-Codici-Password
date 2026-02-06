import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { t, getCurrentLanguage } from './translations.js';
import { syncTimeoutWithFirestore } from './inactivity-timer.js';

let currentUserData = null;

const showToast = (msg, type) => window.showToast ? window.showToast(msg, type) : console.log(msg);
const showConfirmModal = (t, m, c, d) => window.showConfirmModal ? window.showConfirmModal(t, m, c, d) : Promise.resolve(confirm(m));

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            await loadUserData(user);
            initSettingsEvents();
            setupAppInfo();
        } else {
            window.location.href = 'index.html';
        }
    });
});

async function loadUserData(user) {
    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        currentUserData = snap.exists() ? snap.data() : {};

        // Avatar & Name
        const nameEl = document.getElementById('user-name-settings');
        const avatarEl = document.getElementById('user-avatar-settings');
        const displayName = (currentUserData.nome || currentUserData.cognome)
            ? `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim()
            : (user.displayName || t('user_default'));

        if (nameEl) nameEl.textContent = displayName;
        if (avatarEl) {
            const photo = currentUserData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";
            avatarEl.style.backgroundImage = `url('${photo}')`;
        }

        // Toggles & Selectors
        setupToggles(currentUserData);
        setupThemeSelector();
        setupTimeoutSelector(currentUserData);
        generateVCard(user, currentUserData);

        // Language label
        const langLabel = document.getElementById('current-lang-label');
        if (langLabel) {
            const cur = getCurrentLanguage();
            if (cur === 'it') langLabel.textContent = 'Italiano';
            else if (cur === 'en') langLabel.textContent = 'English';
            else if (cur === 'ro') langLabel.textContent = 'Română';
        }

    } catch (e) {
        console.error(e);
    }
}

function initSettingsEvents() {
    // Nav links
    document.getElementById('btn-manage-account')?.addEventListener('click', () => window.location.href = 'profilo_privato.html');
    document.getElementById('btn-expiry-rules')?.addEventListener('click', () => window.location.href = 'regole_scadenze.html');
    document.getElementById('btn-account-archive')?.addEventListener('click', () => window.location.href = 'archivio_account.html');
    document.getElementById('btn-change-password')?.addEventListener('click', () => window.location.href = 'imposta_nuova_password.html');
    document.getElementById('btn-privacy')?.addEventListener('click', () => window.location.href = 'privacy.html');

    // Accordions
    document.getElementById('btn-toggle-lang')?.addEventListener('click', () => {
        const drop = document.getElementById('lang-dropdown');
        const chev = document.getElementById('lang-chevron');
        const isHidden = drop.classList.toggle('hidden');
        if (chev) chev.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    document.getElementById('btn-toggle-app-info')?.addEventListener('click', () => {
        const content = document.getElementById('info-app-content');
        const chev = document.getElementById('info-chevron');
        const isHidden = content.classList.toggle('hidden');
        if (chev) chev.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
    });

    // Language change
    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.dataset.code;
            if (code) {
                localStorage.setItem('app_language', code);
                window.location.reload();
            }
        });
    });

    // QR Zoom
    document.getElementById('btn-zoom-qr')?.addEventListener('click', openQRZoom);
    document.getElementById('btn-close-qr')?.addEventListener('click', closeQRZoom);

    // Logout
    document.getElementById('logout-btn-settings')?.addEventListener('click', async () => {
        const ok = await showConfirmModal(t('section_security'), "Vuoi davvero uscire dall'account?", "Esci", true);
        if (ok) {
            await signOut(auth);
            window.location.href = 'index.html';
        }
    });
}

function setupToggles(data) {
    const t2fa = document.getElementById('2fa-toggle');
    const tFace = document.getElementById('face-id-toggle');

    if (t2fa) {
        t2fa.checked = false;
        t2fa.addEventListener('change', () => {
            t2fa.checked = false;
            showConfirmModal("BETA", "Funzionalità in fase di sviluppo. Sarà disponibile a breve.", "OK", false);
        });
    }

    if (tFace) {
        tFace.checked = false;
        tFace.addEventListener('change', () => {
            tFace.checked = false;
            showConfirmModal("BETA", "Funzionalità in fase di sviluppo. Sarà disponibile a breve.", "OK", false);
        });
    }
}

function setupThemeSelector() {
    const cur = localStorage.getItem('theme') || 'dark';
    document.querySelectorAll('.theme-btn').forEach(btn => {
        if (btn.dataset.theme === cur) btn.classList.add('active');
        btn.addEventListener('click', () => {
            localStorage.setItem('theme', btn.dataset.theme);
            window.location.reload();
        });
    });
}

function setupTimeoutSelector(data) {
    const cur = data.lock_timeout ?? 3;
    document.querySelectorAll('#lock-timer-selector .timer-btn').forEach(btn => {
        if (parseInt(btn.dataset.val) === cur) btn.classList.add('active');
        btn.addEventListener('click', async () => {
            const val = parseInt(btn.dataset.val);
            document.querySelectorAll('#lock-timer-selector .timer-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), { lock_timeout: val });
                await syncTimeoutWithFirestore(auth.currentUser.uid);
                showToast("Risparmio energetico aggiornato", "success");
            } catch (e) {
                console.error(e);
            }
        });
    });
}

function generateVCard(user, data) {
    const config = data.qr_personal || {};
    let v = ["BEGIN:VCARD", "VERSION:3.0"];

    const n = config.nome ? (data.nome || '') : '';
    const s = config.cognome ? (data.cognome || '') : '';
    if (n || s) {
        v.push(`N:${s};${n};;;`);
        v.push(`FN:${n} ${s}`.trim());
    }

    if (data.contactPhones && Array.isArray(data.contactPhones)) {
        data.contactPhones.forEach(p => { if (p.shareQr && p.number) v.push(`TEL;TYPE=CELL:${p.number}`); });
    }
    if (data.contactEmails && Array.isArray(data.contactEmails)) {
        data.contactEmails.forEach(e => { if (e.shareQr && e.address) v.push(`EMAIL;TYPE=INTERNET:${e.address}`); });
    }

    v.push("END:VCARD");
    const vcardStr = v.join("\n");

    const dest = document.getElementById('qrcode-zoom');
    if (dest && typeof QRCode !== 'undefined') {
        dest.innerHTML = '';
        new QRCode(dest, { text: vcardStr, width: 250, height: 250, colorDark: "#000000", colorLight: "#ffffff", correctLevel: QRCode.CorrectLevel.H });
    }
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

function setupAppInfo() {
    const p = document.getElementById('info-app-text-placeholder');
    if (!p) return;
    p.innerHTML = `
        <div class="flex-col-gap-2">
            <p><strong>App Codici Password</strong> è la soluzione PWA per la gestione sicura di credenziali personali e aziendali.</p>
            <p>Sviluppata per offrire massima crittografia e facilità di condivisione tramite standard Titanium.</p>
            <div class="mt-2 text-[10px] font-black opacity-30">VERSIONE 3.6 • TITANIUM CORE</div>
        </div>
    `;
}
