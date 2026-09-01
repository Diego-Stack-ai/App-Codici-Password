/**
 * IMPOSTAZIONI MODULE (V4.6)
 * Gestisce le impostazioni dell'utente, lingua, tema e vincoli di sicurezza.
 */

import { auth, db } from '../../firebase-config.js?v=1.1.8';
import { signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { t, getCurrentLanguage } from '../../translations.js';
import { syncTimeoutWithFirestore } from '../../inactivity-timer.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { safeSetText, setChildren, createElement, clearElement } from '../../dom-utils.js';
import { ensureQRCodeLib, buildVCard, renderQRCode } from '../shared/qr_code_utils.js';
import { encrypt, decrypt, ensureMasterKey, clearSession, resetVault, isBiometricUnlockConfigured } from '../core/security-manager.js';
import { enrollTotp, unenrollTotp, getTotpEnrollment } from '../core/mfa-manager.js';

// [V8.0] FLAG AMBIENTE — automatico: true solo su localhost, false in produzione
const DEV_MODE = location.hostname === 'localhost' || location.hostname === '127.0.0.1';

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
 * IMPOSTAZIONI MODULE (V5.0 ADAPTER) - RESET NOTIFICHE
 * Gestione preferenze globali.
 */
export async function initImpostazioni(user) {
    
    if (!user) return;

    await loadUserData(user);
    initSettingsEvents();
    setupSecurityToggles(currentUserData);
    setupAppInfo();
    setupPrivacyShort();
    setupTermsShort();

    
}

function setupSecurityToggles(data) {
    const t2fa = document.getElementById('2fa-toggle');
    const tFace = document.getElementById('face-id-toggle');

    if (t2fa) {
        t2fa.checked = !!getTotpEnrollment();
        t2fa.addEventListener('change', async () => {
            const enable = t2fa.checked;
            t2fa.disabled = true;
            try {
                const completed = enable ? await enrollTotp() : await unenrollTotp();
                t2fa.checked = completed ? enable : !enable;
                if (completed) showToast(enable ? "2FA Authenticator attivata" : "2FA disattivata", "success");
            } catch (error) {
                console.error("TOTP configuration failed", error);
                t2fa.checked = !enable;
                const message = error.code === 'auth/requires-recent-login'
                    ? "Per modificare la 2FA esci ed effettua nuovamente il login."
                    : (error.message || "Configurazione 2FA non riuscita.");
                showToast(message, "error");
            } finally {
                t2fa.disabled = false;
            }
        });
    }

    if (tFace) {
        // La biometria è legata a questo dispositivo: la fonte di verità è la
        // credenziale locale, non una preferenza Firestore potenzialmente obsoleta.
        tFace.checked = isBiometricUnlockConfigured();
        
        // Verifica supporto WebAuthn PRF asincrono
        const prfStatusEl = document.getElementById('prf-support-status');
        import('../core/webauthn-manager.js').then(manager => {
            manager.isWebAuthnSupported().then(supported => {
                if (prfStatusEl) {
                    if (supported) {
                        prfStatusEl.textContent = "Dispositivo compatibile (WebAuthn PRF)";
                        prfStatusEl.style.color = "var(--success-color, green)";
                    } else {
                        prfStatusEl.textContent = "Non compatibile (WebAuthn non supportato)";
                        prfStatusEl.style.color = "var(--error-color, red)";
                        tFace.disabled = true;
                    }
                }
            });
        });
        
        tFace.addEventListener('change', async () => {
            const val = tFace.checked;
            try {
                if (val) {
                    const key = await ensureMasterKey();
                    // WebAuthn richiede interazione diretta dell'utente. enableBiometricUnlock lancia la registrazione.
                    const { enableBiometricUnlock } = await import('../core/security-manager.js');
                    const success = await enableBiometricUnlock(key);
                    if (!success) {
                        tFace.checked = false; // rollback UI se non supportato o fallito
                    }
                } else {
                    await resetVault();
                }
            } catch (e) {
                tFace.checked = !val;
                showToast("Errore durante l'operazione biometrica", "error");
            }
        });
    }
}



async function loadUserData(user) {
    try {
        const snap = await getDoc(doc(db, "users", user.uid));
        currentUserData = snap.exists() ? snap.data() : {};

        userAddresses = currentUserData.userAddresses || [];
        contactPhones = currentUserData.contactPhones || [];
        contactEmails = currentUserData.contactEmails || [];

        const qrSnap = await getDoc(doc(db, "users", user.uid, "settings", "qrCodeInclusions"));
        if (qrSnap.exists()) {
            qrCodeInclusions = { ...qrCodeInclusions, ...qrSnap.data() };
        }

        const nameEl = document.getElementById('user-name-settings');
        const avatarEl = document.getElementById('user-avatar-settings');

        // 🔐 PROTOCOLLO BLINDA (V7.0): Decifrazione Profilo Utente
        try {
            const mk = await ensureMasterKey();
            const isEnc = (v) => v && typeof v === 'string' && v.length > 30 && /^[A-Za-z0-9+/]+={0,2}$/.test(v);

            // 1. Dati Anagrafici
            if (isEnc(currentUserData.nome)) currentUserData.nome = await decrypt(currentUserData.nome, mk);
            if (isEnc(currentUserData.cognome)) currentUserData.cognome = await decrypt(currentUserData.cognome, mk);
            if (isEnc(currentUserData.birth_place)) currentUserData.birth_place = await decrypt(currentUserData.birth_place, mk);
            if (isEnc(currentUserData.cf)) currentUserData.cf = await decrypt(currentUserData.cf, mk);

            // 2. Telefoni
            if (Array.isArray(contactPhones)) {
                for (let p of contactPhones) {
                    if (isEnc(p.number)) p.number = await decrypt(p.number, mk);
                }
            }

            // 3. Email
            if (Array.isArray(contactEmails)) {
                for (let e of contactEmails) {
                    if (isEnc(e.password)) e.password = await decrypt(e.password, mk);
                    if (isEnc(e.note)) e.note = await decrypt(e.note, mk);
                }
            }

            // 4. Indirizzi
            if (Array.isArray(userAddresses)) {
                for (let a of userAddresses) {
                    if (isEnc(a.address)) a.address = await decrypt(a.address, mk);
                    if (isEnc(a.city)) a.city = await decrypt(a.city, mk);
                    if (isEnc(a.cap)) a.cap = await decrypt(a.cap, mk);
                    if (isEnc(a.civic)) a.civic = await decrypt(a.civic, mk);
                }
            }
        } catch (e) {
            console.warn("[IMPOSTAZIONI] Vault Locked o Errore Decriptazione:", e);
        }

        const displayName = (currentUserData.nome || currentUserData.cognome)
            ? `${currentUserData.nome || ''} ${currentUserData.cognome || ''}`.trim()
            : (user.displayName || t('user_default'));

        safeSetText(nameEl, displayName);

        if (avatarEl) {
            const photo = currentUserData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";
            avatarEl.style.backgroundImage = `url('${photo}')`;
        }

        setupThemeSelector();
        setupTimeoutSelector(currentUserData);
        generateVCard(user, currentUserData);

        const langLabel = document.getElementById('current-lang-label');
        if (langLabel) {
            const cur = getCurrentLanguage();
            const langMap = {
                'it': 'Italiano', 'en': 'English', 'es': 'Español', 'fr': 'Français',
                'de': 'Deutsch', 'zh': '中文', 'hi': 'हिन्दी', 'pt': 'Português', 'ro': 'Română'
            };
            safeSetText(langLabel, langMap[cur] || 'Italiano');

            document.querySelectorAll('.lang-option').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.code === cur);
            });
        }
    } catch (e) {
        console.error(e);
    }
}

function initSettingsEvents() {
    const navMap = {
        'btn-manage-account': 'profilo_privato.html',
        'btn-change-password': 'imposta_nuova_password.html',
        'btn-expiry-rules': 'regole_scadenze.html'
    };

    for (const [id, url] of Object.entries(navMap)) {
        document.getElementById(id)?.addEventListener('click', () => window.location.href = url);
    }

    document.getElementById('btn-account-archive')?.addEventListener('click', () => window.location.href = 'archivio_account.html');

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

    document.querySelectorAll('.lang-option').forEach(btn => {
        btn.addEventListener('click', () => {
            const code = btn.dataset.code;
            if (code) {
                localStorage.setItem('app_language', code);
                window.location.reload();
            }
        });
    });

    document.getElementById('qrcode-preview')?.addEventListener('click', openQRZoom);

    document.getElementById('logout-btn-settings')?.addEventListener('click', async () => {
        const ok = await showConfirmModal(t('section_security') || 'Sicurezza', "Vuoi davvero uscire dall'account?", "Esci", "Annulla");
        if (ok) {
            clearSession(); // 🔐 Pulisce masterKey e sessionStorage
            await signOut(auth);
            window.location.href = 'login-v115.html';
        }
    });

    document.getElementById('btn-reset-vault')?.addEventListener('click', async () => {
        const ok = await showConfirmModal(
            'Rimuovi accesso biometrico',
            'Questa operazione non cancella i dati. Dovrai inserire la Master Password al prossimo accesso. Continuare?',
            'Rimuovi', 'Annulla'
        );
        if (ok) await resetVault();
    });
}


function setupThemeSelector() {
    const cur = localStorage.getItem('theme') || 'auto';
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
    const selector = document.getElementById('lock-timer-selector');
    if (!selector) return;

    // Tutte le opzioni visibili tranne 'Subito' (0) rimosso definitivamente
    const btns = selector.querySelectorAll('.timer-btn');
    btns.forEach(btn => {
        const val = parseInt(btn.dataset.val);
        // 'Subito' (0) rimosso: troppo aggressivo, deprecato da V8.0
        if (val === 0) {
            btn.style.display = 'none';
        }

        if (val === cur) btn.classList.add('active');

        btn.addEventListener('click', async () => {
            document.querySelectorAll('#lock-timer-selector .timer-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            try {
                await updateDoc(doc(db, "users", auth.currentUser.uid), { lock_timeout: val });
                await syncTimeoutWithFirestore(auth.currentUser.uid);
                showToast("Sicurezza inattività aggiornata", "success");
            } catch (e) {
                console.error(e);
            }
        });
    });
}

async function generateVCard(user, data) {
    setTimeout(async () => {
        const previewDest = document.getElementById('qrcode-preview');
        if (previewDest) {
            await ensureQRCodeLib();
            const vcardStr = buildVCard(currentUserData, qrCodeInclusions, {
                contactPhones, contactEmails, userAddresses
            });
            // Optimization: Defer rendering to prevent blocking the main thread (fixes Violation 'load' handler)
            setTimeout(() => {
                renderQRCode(previewDest, vcardStr, { width: 104, height: 104, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: 2 });
            }, 0);
        }
    }, 600);
}

async function openQRZoom() {
    document.getElementById('qr-zoom-modal-dynamic')?.remove();
    const qrSize = Math.min(window.innerWidth * 0.7, 300);
    const modal = createElement('div', { id: 'qr-zoom-modal-dynamic', className: 'modal-overlay' }, [
        createElement('div', { className: 'modal-profile-box modal-box-qr' }, [
            createElement('h3', { className: 'modal-title', textContent: 'QR Code' }),
            createElement('div', { id: 'qrcode-zoom-dynamic', className: 'qr-zoom-container' }),
            createElement('button', {
                className: 'btn-modal btn-secondary', textContent: 'Chiudi',
                onclick: () => { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); }
            })
        ])
    ]);
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 10);
    modal.onclick = (e) => { if (e.target === modal) { modal.classList.remove('active'); setTimeout(() => modal.remove(), 300); } };
    await ensureQRCodeLib();
    const vcardStr = buildVCard(currentUserData, qrCodeInclusions, {
        contactPhones, contactEmails, userAddresses
    });
    renderQRCode(document.getElementById('qrcode-zoom-dynamic'), vcardStr, { width: qrSize, height: qrSize, colorDark: "#000000", colorLight: "#E3F2FD", correctLevel: 3 });
}

function setupAppInfo() {
    const p = document.getElementById('info-app-text-placeholder');
    if (!p) return;
    setChildren(p, createElement('div', { className: 'info-stack' }, [
        createElement('p', {}, [createElement('strong', {}, ["Codex"]), " Security System"]),
        createElement('p', { textContent: t('app_info_security_desc') }),
        createElement('div', { className: 'app-version-info', textContent: "RESET NOTIFICHE COMPLETATO" })
    ]));
}

function setupPrivacyShort() {
    const p = document.getElementById('privacy-short-text-placeholder');
    if (!p) return;
    setChildren(p, createElement('div', { className: 'info-stack', textContent: "Privacy Policy invariata. Notifiche Push e Email sospese." }));
}

function setupTermsShort() {
    const p = document.getElementById('terms-short-text-placeholder');
    if (!p) return;
    setChildren(p, createElement('div', { className: 'info-stack', textContent: "Termini e Condizioni invariati." }));
}
