/**
 * IMPOSTAZIONI MODULE (V4.6)
 * Gestisce le impostazioni dell'utente, lingua, tema e vincoli di sicurezza.
 * V4.6: Aggiunto initComponents() per header/footer standard con Settings button opaco.
 */

import { auth, db } from '../../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { t, getCurrentLanguage } from '../../translations.js';
import { syncTimeoutWithFirestore } from '../../inactivity-timer.js';
import { showToast } from '../../ui-core.js';
import { safeSetText, setChildren, createElement, clearElement } from '../../dom-utils.js';
import { initComponents } from '../../components.js';
import { ensureQRCodeLib, buildVCard, renderQRCode } from '../shared/qr_code_utils.js';

let currentUserData = null;
let userAddresses = [];
let contactPhones = [];
let contactEmails = [];
let qrCodeInclusions = {
    nome: false,
    cf: false,
    nascita: false,
    phones: [],
    emails: [],
    addresses: []
};

document.addEventListener('DOMContentLoaded', async () => {
    // Inizializza Header e Footer secondo Protocollo Base
    await initComponents();

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

        // Sub-collections (come profilo_privato)
        userAddresses = currentUserData.userAddresses || [];
        contactPhones = currentUserData.contactPhones || [];
        contactEmails = currentUserData.contactEmails || [];

        // Preferenze QR inclusioni (come profilo_privato)
        const qrSnap = await getDoc(doc(db, "users", user.uid, "settings", "qrCodeInclusions"));
        if (qrSnap.exists()) {
            qrCodeInclusions = { ...qrCodeInclusions, ...qrSnap.data() };
        }

        // Avatar & Name
        const nameEl = document.getElementById('user-name-settings');
        const avatarEl = document.getElementById('user-avatar-settings');
        const displayName = (currentUserData.nome || currentUserData.cognome)
            ? `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim()
            : (user.displayName || t('user_default'));

        safeSetText(nameEl, displayName);

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
            const langMap = {
                'it': 'Italiano',
                'en': 'English',
                'es': 'Español',
                'fr': 'Français',
                'de': 'Deutsch',
                'zh': '中文',
                'hi': 'हिन्दी',
                'pt': 'Português',
                'ro': 'Română'
            };
            safeSetText(langLabel, langMap[cur] || 'Italiano');
        }

    } catch (e) {
        console.error(e);
    }
}

function initSettingsEvents() {
    // Nav links
    const navMap = {
        'btn-manage-account': 'profilo_privato.html',
        'btn-expiry-rules': 'regole_scadenze.html',
        'btn-account-archive': 'archivio_account.html',
        'btn-notifications-history': 'notifiche_storia.html',
        'btn-change-password': 'imposta_nuova_password.html',
        'btn-privacy': 'privacy.html'
    };

    for (const [id, url] of Object.entries(navMap)) {
        document.getElementById(id)?.addEventListener('click', () => window.location.href = url);
    }

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
    document.getElementById('qrcode-preview')?.addEventListener('click', openQRZoom);
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


async function generateVCard(user, data) {
    await ensureQRCodeLib();
    // Usa la stessa logica di profilo_privato: buildVCard con inclusioni e sub-collections
    const vcardStr = buildVCard(currentUserData, qrCodeInclusions, {
        contactPhones,
        contactEmails,
        userAddresses
    });

    // QR Preview (Small)
    const previewDest = document.getElementById('qrcode-preview');
    if (previewDest) {
        // Remove only QR canvases/images, not the lens
        previewDest.querySelectorAll('canvas,img').forEach(el => el.remove());
        // Render QR code directly into previewDest (canvas will be absolutely positioned by CSS)
        renderQRCode(previewDest, vcardStr, { width: 72, height: 72, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: 1 });
    }

    // QR Zoom (Large)
    const dest = document.getElementById('qrcode-zoom');
    if (dest) {
        clearElement(dest);
        renderQRCode(dest, vcardStr, { width: 250, height: 250, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: 3 });
    }
}

function openQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.remove('hidden');
        // Force reflow
        void modal.offsetWidth;
        modal.classList.add('is-visible');
    }
}

function closeQRZoom() {
    const modal = document.getElementById('qr-zoom-modal');
    if (modal) {
        modal.classList.remove('is-visible');
        setTimeout(() => {
            modal.classList.add('hidden');
        }, 300); // Wait for transition
    }
}

function setupAppInfo() {
    const p = document.getElementById('info-app-text-placeholder');
    if (!p) return;

    // Create elements securely instead of using innerHTML
    const container = createElement('div', { className: 'info-stack' }, [
        createElement('p', {}, [
            createElement('strong', {}, [t('app_info_system_name')]),
            ` ${t('app_info_system_sub')}`
        ]),
        createElement('p', {}, [t('app_info_overview_p1')]),
        createElement('p', {}, [t('app_info_security_desc')]),
        createElement('div', {
            className: 'app-version-info',
            textContent: `${t('version_label') || 'VERSIONE'} 4.4 • base CORE`
        })
    ]);

    setChildren(p, container);
}
