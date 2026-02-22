/**
 * IMPOSTAZIONI MODULE (V4.6)
 * Gestisce le impostazioni dell'utente, lingua, tema e vincoli di sicurezza.
 * V4.6: Aggiunto initComponents() per header/footer standard con Settings button opaco.
 */

import { auth, db, messaging } from '../../firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getToken } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging.js";
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

/**
 * IMPOSTAZIONI MODULE (V5.0 ADAPTER)
 * Gestione preferenze globali.
 * - Entry Point: initImpostazioni(user)
 */

export async function initImpostazioni(user) {
    console.log("[IMPOSTAZIONI] Init V5.0...");
    if (!user) return;

    // Nota: initComponents() rimosso (gestito da main.js)

    await loadUserData(user);
    initSettingsEvents();
    setupAppInfo();
    setupPrivacyShort();
    setupTermsShort();

    console.log("[IMPOSTAZIONI] Ready.");
}

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

            // Highlight active lang in dropdown
            document.querySelectorAll('.lang-option').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.code === cur);
            });
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
        'btn-change-password': 'imposta_nuova_password.html'
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

    document.getElementById('btn-toggle-privacy')?.addEventListener('click', () => {
        const content = document.getElementById('privacy-dropdown-content');
        const chev = document.getElementById('privacy-chevron');
        const isHidden = content.classList.toggle('hidden');
        if (chev) chev.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        if (!isHidden) setupPrivacyShort();
    });

    document.getElementById('btn-toggle-terms')?.addEventListener('click', () => {
        const content = document.getElementById('terms-dropdown-content');
        const chev = document.getElementById('terms-chevron');
        const isHidden = content.classList.toggle('hidden');
        if (chev) chev.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
        if (!isHidden) setupTermsShort();
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

    // QR Zoom (modal dinamico, stile profilo privato)
    document.getElementById('qrcode-preview')?.addEventListener('click', openQRZoom);

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
    const tPush = document.getElementById('push-notify-toggle');
    const tEmail = document.getElementById('email-notify-toggle');

    if (t2fa) {
        t2fa.checked = data.settings_2fa || false;
        t2fa.addEventListener('change', async () => {
            const val = t2fa.checked;
            try {
                if (auth.currentUser) {
                    await updateDoc(doc(db, "users", auth.currentUser.uid), { settings_2fa: val });
                    showToast(val ? t('2fa_enabled') || "2FA Attivata" : t('2fa_disabled') || "2FA Disattivata");
                }
            } catch (e) {
                console.error("Error saving 2FA:", e);
                t2fa.checked = !val;
                showToast(t('error_config_save') || "Errore salvataggio", "error");
            }
        });
    }

    if (tFace) {
        tFace.checked = data.settings_biometric || false;
        tFace.addEventListener('change', async () => {
            const val = tFace.checked;
            try {
                if (auth.currentUser) {
                    await updateDoc(doc(db, "users", auth.currentUser.uid), { settings_biometric: val });
                    showToast(val ? t('biometric_enabled') || "Biometrico Attivato" : t('biometric_disabled') || "Biometrico Disattivato");
                }
            } catch (e) {
                console.error("Error saving Biometric:", e);
                tFace.checked = !val;
                showToast(t('error_config_save') || "Errore salvataggio", "error");
            }
        });
    }

    if (tPush) {
        // Supporta entrambi i campi per compatibilità, preferendo prefs_push
        tPush.checked = (data.prefs_push !== undefined) ? data.prefs_push : (data.pref_push_enabled !== false);
        tPush.addEventListener('change', async () => {
            const val = tPush.checked;
            try {
                if (auth.currentUser) {
                    const updateData = {
                        prefs_push: val,
                        pref_push_enabled: val
                    };

                    // Se l'utente attiva il push, proviamo a recuperare il token se manca
                    if (val) {
                        const token = await requestPushPermission();
                        if (token) {
                            updateData.fcmToken = token;
                            updateData.fcmTokens = arrayUnion(token);
                        }
                    }

                    await updateDoc(doc(db, "users", auth.currentUser.uid), updateData);
                    showToast(val ? "Notifiche Push Attivate" : "Notifiche Push Disattivate");
                }
            } catch (e) {
                console.error("Error saving Push Pref:", e);
                tPush.checked = !val;
                showToast("Errore salvataggio", "error");
            }
        });
    }

    if (tEmail) {
        // Supporta entrambi i campi per compatibilità, preferendo prefs_email_sharing
        tEmail.checked = (data.prefs_email_sharing !== undefined) ? data.prefs_email_sharing : (data.pref_email_enabled !== false);
        tEmail.addEventListener('change', async () => {
            const val = tEmail.checked;
            try {
                if (auth.currentUser) {
                    await updateDoc(doc(db, "users", auth.currentUser.uid), {
                        prefs_email_sharing: val,
                        pref_email_enabled: val // Manteniamo entrambi per ora per sicurezza
                    });
                    showToast(val ? "Notifiche Email Attivate" : "Notifiche Email Disattivate");
                }
            } catch (e) {
                console.error("Error saving Email Pref:", e);
                tEmail.checked = !val;
                showToast("Errore salvataggio", "error");
            }
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
    // V5.0 OPTIMIZATION: Lazy Preview
    // Genera la vCard reale con lazy load per non bloccare il caricamento.
    setTimeout(async () => {
        const previewDest = document.getElementById('qrcode-preview');
        if (previewDest) {
            await ensureQRCodeLib();
            const vcardStr = buildVCard(currentUserData, qrCodeInclusions, {
                contactPhones,
                contactEmails,
                userAddresses
            });
            // Stessi parametri di profilo_privato: 104x104, correctLevel Q
            renderQRCode(previewDest, vcardStr, { width: 104, height: 104, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: 2 });
        }
    }, 600);
}

async function openQRZoom() {
    // Rimuovi eventuali modali QR già aperti
    document.getElementById('qr-zoom-modal-dynamic')?.remove();

    const qrSize = Math.min(window.innerWidth * 0.7, 300);

    const modal = createElement('div', { id: 'qr-zoom-modal-dynamic', className: 'modal-overlay' }, [
        createElement('div', { className: 'modal-profile-box modal-box-qr' }, [
            createElement('h3', {
                className: 'modal-title',
                textContent: 'QR Code',
                dataset: { t: 'qr_code_profile' }
            }),
            createElement('div', { id: 'qrcode-zoom-dynamic', className: 'qr-zoom-container' }),
            createElement('button', {
                className: 'btn-modal btn-secondary',
                textContent: 'Chiudi',
                dataset: { t: 'close' },
                onclick: () => {
                    modal.classList.remove('active');
                    setTimeout(() => modal.remove(), 300);
                }
            })
        ])
    ]);

    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);

    // Chiusura al click fuori
    modal.onclick = (e) => {
        if (e.target === modal) {
            modal.classList.remove('active');
            setTimeout(() => modal.remove(), 300);
        }
    };

    // Genera QR reale al volo
    await ensureQRCodeLib();
    const vcardStr = buildVCard(currentUserData, qrCodeInclusions, {
        contactPhones,
        contactEmails,
        userAddresses
    });
    renderQRCode(
        document.getElementById('qrcode-zoom-dynamic'),
        vcardStr,
        { width: qrSize, height: qrSize, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: 3 }
    );
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
function setupPrivacyShort() {
    const p = document.getElementById('privacy-short-text-placeholder');
    if (!p) return;

    const sections = [
        { title: t('privacy_short_owner_title'), text: t('privacy_short_owner_text') },
        { title: t('privacy_short_data_title'), text: t('privacy_short_data_text') },
        { title: t('privacy_short_storage_title'), text: t('privacy_short_storage_text') },
        { title: t('privacy_short_security_title'), text: t('privacy_short_security_text') },
        { title: '', text: t('privacy_short_security_note'), isNote: true },
        { title: t('privacy_short_share_title'), text: t('privacy_short_share_text') },
        { title: t('privacy_short_rights_title'), text: t('privacy_short_rights_text') }
    ];

    const container = createElement('div', { className: 'info-stack' }, [
        createElement('p', { className: 'mb-4 text-secondary italic' }, [t('privacy_short_intro')]),
        createElement('p', { className: 'mb-4 border-l-2 border-accent pl-2' }, [t('privacy_short_compliance')]),
        ...sections.map(s => createElement('div', { className: 'mb-3' }, [
            s.title ? createElement('strong', { className: 'block text-accent mb-1' }, [s.title]) : null,
            createElement('p', { className: s.isNote ? 'text-xs opacity-70 mt-1' : '' }, [s.text])
        ].filter(Boolean))),
        createElement('div', { className: 'app-version-info mt-4 opacity-50', textContent: t('privacy_update_text') || 'Ultimo aggiornamento: Gennaio 2026' })
    ]);

    setChildren(p, container);
}

function setupTermsShort() {
    const p = document.getElementById('terms-short-text-placeholder');
    if (!p) return;

    const sections = [
        { title: t('terms_1_title'), text: t('terms_1_text') },
        { title: t('terms_2_title'), text: t('terms_2_text') },
        { title: t('terms_3_title'), text: t('terms_3_text') },
        { title: t('terms_5_title'), text: t('terms_5_text') }
    ];

    const container = createElement('div', { className: 'info-stack' }, [
        createElement('p', { className: 'mb-4 text-secondary italic' }, [t('terms_short_intro')]),
        ...sections.map(s => createElement('div', { className: 'mb-3' }, [
            s.title ? createElement('strong', { className: 'block text-accent mb-1' }, [s.title]) : null,
            createElement('p', {}, [s.text])
        ].filter(Boolean))),
        createElement('div', { className: 'app-version-info mt-4 opacity-50', textContent: t('terms_update_text') || 'Ultimo aggiornamento: Gennaio 2026' })
    ]);

    setChildren(p, container);
}

async function requestPushPermission() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const token = await getToken(messaging, {
                vapidKey: 'BMe7J_...' // Segnaposto, l'utente dovrebbe fornirlo o lo troviamo in console
            });
            return token;
        }
        return null;
    } catch (e) {
        console.error("Errore richiesta token:", e);
        return null;
    }
}
