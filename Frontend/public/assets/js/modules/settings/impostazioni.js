/**
 * IMPOSTAZIONI MODULE (V4.6)
 * Gestisce le impostazioni dell'utente, lingua, tema e vincoli di sicurezza.
 */

import { auth, db } from '../../firebase-config.js?v=1.2.35';
import { signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { t, getCurrentLanguage } from '../../translations.js';
import { syncTimeoutWithFirestore } from '../../inactivity-timer.js';
import { showToast, showConfirmModal } from '../../ui-core-v129.js';
import { safeSetText, setChildren, createElement, clearElement } from '../../dom-utils.js';
import { ensureQRCodeLib, buildVCard, renderQRCode } from '../shared/qr_code_utils.js';
import { encrypt, decrypt, ensureMasterKey, clearSession, resetVault, isBiometricUnlockConfigured, changeMasterPassword } from '../core/security-manager.js';
import { enrollTotp, unenrollTotp, getTotpEnrollment, createRecoveryCodes, revokeAllSessions } from '../core/mfa-manager.js';
import { disableDeadlinePush, disableSharingPush, enableDeadlinePush, enableSharingPush, getCurrentPushState, listenForDeadlinePushInForeground, sendDeadlinePushTest } from '../shared/push-manager.js';

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
    setupAIAssistantToggle(user, currentUserData);
    setupAppInfo();
    setupPrivacyShort();
    setupTermsShort();
    await setupDeadlinePush(user);
    await setupSharingPush(user);
    showPendingSecurityNotice();

    
}

async function setupSharingPush(user) {
    const toggle = document.getElementById('sharing-push-toggle');
    const status = document.getElementById('sharing-push-status');
    if (!toggle || !status) return;
    const render = async () => {
        const state = await getCurrentPushState(user, 'sharing');
        toggle.checked = state.enabled;
        toggle.disabled = !state.compatible;
        status.textContent = state.compatible ? (state.enabled ? 'Attive su questo dispositivo' : 'Disattivate su questo dispositivo') : state.reason;
    };
    await render();
    toggle.addEventListener('change', async () => {
        const enabling = toggle.checked;
        toggle.disabled = true;
        try {
            if (enabling) await enableSharingPush(user); else await disableSharingPush(user);
            showToast(enabling ? 'Notifiche inviti attivate' : 'Notifiche inviti disattivate', 'success');
            if (enabling) await listenForDeadlinePushInForeground();
        } catch (error) {
            console.error('[SHARING PUSH] Configurazione fallita', error);
            showToast(error.message || 'Configurazione notifiche non riuscita', 'error');
        } finally { await render(); }
    });
}

function setupAIAssistantToggle(user, data) {
    const toggle = document.getElementById('ai-assistant-toggle');
    if (!toggle) return;
    toggle.checked = data?.settings_ai_assistant === true;
    toggle.addEventListener('change', async () => {
        const enabled = toggle.checked;
        toggle.disabled = true;
        try {
            await updateDoc(doc(db, 'users', user.uid), { settings_ai_assistant: enabled });
            if (currentUserData) currentUserData.settings_ai_assistant = enabled;
            showToast(enabled ? 'Agente AI attivato' : 'Agente AI disattivato', 'success');
        } catch (error) {
            console.error('[ASSISTANT] Salvataggio preferenza fallito.', error);
            toggle.checked = !enabled;
            showToast('Impossibile salvare la preferenza Agente AI', 'error');
        } finally {
            toggle.disabled = false;
        }
    });
}

function showPendingSecurityNotice() {
    const message = sessionStorage.getItem('codex_security_notice');
    if (!message) return;
    sessionStorage.removeItem('codex_security_notice');
    showToast(message, 'info');
}

async function requireSecurityReauthentication(message) {
    sessionStorage.setItem('codex_security_notice', message);
    clearSession();
    try {
        await signOut(auth);
    } finally {
        window.location.replace('login-v115.html?reauth=security-settings');
    }
}

async function setupDeadlinePush(user) {
    const toggle = document.getElementById('deadline-push-toggle');
    const status = document.getElementById('deadline-push-status');
    const testButton = document.getElementById('btn-test-deadline-push');
    if (!toggle || !status || !testButton) return;

    const render = async () => {
        const state = await getCurrentPushState(user);
        toggle.checked = state.enabled;
        toggle.disabled = !state.compatible;
        testButton.classList.toggle('hidden', !state.enabled);
        status.textContent = state.compatible
            ? (state.enabled ? 'Attive su questo dispositivo · Solo scadenze' : 'Disattivate su questo dispositivo')
            : state.reason;
    };

    await render();
    await listenForDeadlinePushInForeground();
    toggle.addEventListener('change', async () => {
        const enabling = toggle.checked;
        toggle.disabled = true;
        try {
            if (enabling) await enableDeadlinePush(user);
            else await disableDeadlinePush(user);
            showToast(enabling ? 'Notifiche scadenze attivate' : 'Notifiche scadenze disattivate', 'success');
            if (enabling) await listenForDeadlinePushInForeground();
        } catch (error) {
            console.error('[PUSH] Configurazione fallita', error);
            toggle.checked = !enabling;
            showToast(error.message || 'Configurazione notifiche non riuscita', 'error');
        } finally {
            await render();
        }
    });

    testButton.addEventListener('click', async () => {
        testButton.disabled = true;
        try {
            await sendDeadlinePushTest();
            showToast('Notifica di prova inviata', 'success');
        } catch (error) {
            if (error.code !== 'functions/resource-exhausted') console.error('[PUSH TEST] Invio fallito', error);
            showToast(error.message || 'Invio di prova non riuscito', 'error');
        } finally {
            testButton.disabled = false;
        }
    });
}

function setupSecurityToggles(data) {
    const t2fa = document.getElementById('2fa-toggle');
    const tFace = document.getElementById('face-id-toggle');

    if (t2fa) {
        t2fa.checked = !!getTotpEnrollment();
        document.getElementById('btn-regenerate-recovery-codes')?.classList.toggle('hidden', !t2fa.checked);
        t2fa.addEventListener('change', async () => {
            const enable = t2fa.checked;
            t2fa.disabled = true;
            try {
                const completed = enable ? await enrollTotp() : await unenrollTotp();
                t2fa.checked = completed ? enable : !enable;
                if (completed) {
                    document.getElementById('btn-regenerate-recovery-codes')?.classList.toggle('hidden', !enable);
                    if (enable) await generateAndShowRecoveryCodes();
                    showToast(enable ? "2FA Authenticator attivata" : "2FA disattivata", "success");
                }
            } catch (error) {
                console.error("TOTP configuration failed", error);
                t2fa.checked = !enable;
                if (error.code === 'auth/requires-recent-login') {
                    await requireSecurityReauthentication('Accesso confermato. Ripeti ora la modifica della 2FA.');
                    return;
                }
                if (error.code === 'auth/user-token-expired') {
                    await requireSecurityReauthentication('La configurazione 2FA è cambiata. Accedi nuovamente per continuare.');
                    return;
                }
                const message = error.code === 'auth/invalid-verification-code'
                    ? 'Codice Authenticator errato o scaduto.'
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
                const message = e.name === 'NotAllowedError'
                    ? 'Verifica biometrica annullata o non autorizzata.'
                    : (e.message === 'PRF_NOT_SUPPORTED'
                        ? 'Questo dispositivo non supporta lo sblocco Vault tramite WebAuthn PRF.'
                        : "Operazione biometrica non riuscita. Puoi usare la Master Password.");
                showToast(message, "error");
            }
        });
    }
}

async function generateAndShowRecoveryCodes() {
    const codes = await createRecoveryCodes();
    const modal = createElement('div', { className: 'modal-overlay active' });
    const list = createElement('div', { className: 'recovery-code-grid' },
        codes.map(code => createElement('code', { textContent: code }))
    );
    const close = () => modal.remove();
    setChildren(modal, createElement('div', { className: 'modal-box' }, [
        createElement('h3', { className: 'modal-title', textContent: 'Codici di recupero 2FA' }),
        createElement('p', { className: 'modal-text', textContent: 'Salvali ora in un luogo sicuro. Ogni codice funziona una sola volta e non sarà più mostrato.' }),
        list,
        createElement('div', { className: 'modal-actions' }, [
            createElement('button', { className: 'btn-modal btn-primary', textContent: 'Li ho salvati', onclick: close })
        ])
    ]));
    document.body.appendChild(modal);
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

    document.getElementById('btn-change-master-password')?.addEventListener('click', async () => {
        try {
            await changeMasterPassword();
            const faceToggle = document.getElementById('face-id-toggle');
            if (faceToggle) faceToggle.checked = false;
        } catch (error) {
            showToast(error.message || 'Cambio Master Password non riuscito.', 'error');
        }
    });

    document.getElementById('btn-regenerate-recovery-codes')?.addEventListener('click', async () => {
        const ok = await showConfirmModal('Nuovi codici di recupero', 'I codici precedenti smetteranno subito di funzionare. Continuare?', 'Genera', 'Annulla');
        if (!ok) return;
        try { await generateAndShowRecoveryCodes(); }
        catch (error) { showToast(error.message || 'Generazione codici non riuscita.', 'error'); }
    });

    document.getElementById('btn-revoke-all-sessions')?.addEventListener('click', async () => {
        const ok = await showConfirmModal('Disconnetti tutte le postazioni', 'Dovrai eseguire nuovamente login e 2FA su ogni dispositivo. Continuare?', 'Disconnetti', 'Annulla');
        if (!ok) return;
        try {
            await revokeAllSessions();
            clearSession();
            await signOut(auth);
            window.location.replace('login-v115.html?reauth=sessions-revoked');
        } catch (error) {
            showToast(error.message || 'Revoca delle sessioni non riuscita.', 'error');
        }
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
