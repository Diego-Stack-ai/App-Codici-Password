import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { t, getCurrentLanguage, supportedLanguages } from './translations.js';
import { syncTimeoutWithFirestore } from './inactivity-timer.js';
import { showToast, showWarningModal } from './ui-core.js';

/**
 * IMPOSTAZIONI PAGE MODULE (Titanium Account V1.1)
 */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Traduzione statica immediata degli elementi presenti nel DOM
    const updateTranslations = () => {
        document.querySelectorAll('[data-t]').forEach(el => {
            const key = el.getAttribute('data-t');
            el.textContent = t(key);
        });
    };
    updateTranslations();

    // 2. Setup Selettore Lingua Premium (Inline)
    setupPremiumLanguageSelector(updateTranslations);

    // 3. Gestore Accordion
    setupAccordions();

    // 4. Caricamento Testo Informazioni App
    setupAppInfo();

    // 5. Caricamento Testo Privacy
    setupPrivacyInfo();

    // 5. Caricamento Testo Privacy
    setupPrivacyInfo();
});

function setupPrivacyInfo() {
    const placeholder = document.getElementById('info-privacy-text-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = `
        <div class="info-content" style="padding: 1.5rem; color: rgba(255,255,255,0.7); font-size: 0.9rem; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h3 style="color: white; font-weight: 800; margin-bottom: 0.25rem; text-transform: uppercase;">PRIVACY POLICY</h3>
                <p style="font-size: 0.7rem; letter-spacing: 0.1em; color: rgba(255,255,255,0.4);">INFORMATIVA ESTESA</p>
            </div>

            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h4 style="color: white; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.02em;">1. TITOLARE DEL TRATTAMENTO</h4>
                <p>Il Titolare del trattamento dei dati è <strong>Boschetto Diego</strong>. L'applicazione è concepita per garantire la massima sicurezza e riservatezza.</p>
            </div>

            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h4 style="color: white; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.02em;">2. DATI TRATTATI</h4>
                <ul style="list-style: none; padding: 0; margin: 0.5rem 0;">
                    <li style="margin-bottom: 0.4rem;"><strong style="color: white;">• Registrazione:</strong> Email, nome, avatar (per autenticazione).</li>
                    <li style="margin-bottom: 0.4rem;"><strong style="color: white;">• Volontari:</strong> Credenziali, password, note (crittografati).</li>
                    <li style="margin-bottom: 0.4rem;"><strong style="color: white;">• Tecnici:</strong> Log di sistema gestiti da Google Firebase.</li>
                </ul>
            </div>

            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h4 style="color: white; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.02em;">3. SICUREZZA E STORAGE</h4>
                <p>Utilizziamo l'infrastruttura sicura di <strong>Google Firebase</strong>. Connessioni SSL/TLS e database protetti. I dati sensibili sono accessibili solo all'utente proprietario e ai destinatari espliciti della condivisione.</p>
            </div>

            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h4 style="color: white; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.02em;">4. CONDIVISIONE DATI</h4>
                <p>Nessun dato viene venduto a terzi. La condivisione avviene <strong>solo su tua esplicita azione</strong> tramite la funzione "Condividi" verso le email che selezioni.</p>
            </div>

            <div style="background: rgba(255,255,255,0.03); border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; border: 1px solid rgba(255,255,255,0.05); box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h4 style="color: white; font-size: 0.85rem; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5rem; letter-spacing: 0.02em;">5. DIRITTI UTENTE (GDPR)</h4>
                <ul style="list-style: none; padding: 0; margin: 0.5rem 0;">
                    <li style="margin-bottom: 0.4rem;"><strong style="color: white;">•</strong> Diritto di accesso ai propri dati.</li>
                    <li style="margin-bottom: 0.4rem;"><strong style="color: white;">•</strong> Diritto alla cancellazione ("Oblio") eliminando l'account.</li>
                    <li style="margin-bottom: 0.4rem;"><strong style="color: white;">•</strong> Diritto di rettifica delle informazioni.</li>
                </ul>
            </div>

            <div style="text-align: center; font-size: 0.7rem; opacity: 0.4; margin-top: 2rem;">
                <p>Ultimo aggiornamento: Gennaio 2026</p>
            </div>
        </div>
    `;
}

function setupAppInfo() {
    const placeholder = document.getElementById('info-app-text-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = `
        <div class="info-content" style="padding: 1.5rem; color: rgba(255,255,255,0.7); font-size: 0.9rem; line-height: 1.6;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h3 style="color: white; font-weight: 800; margin-bottom: 0.25rem;">APP CODICI PASSWORD</h3>
                <p style="font-size: 0.7rem; letter-spacing: 0.1em; color: rgba(255,255,255,0.4);">SISTEMA DI GESTIONE CREDENZIALI E CONDIVISIONE</p>
            </div>

            <h4 style="color: white; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-left: 3px solid #3b82f6; padding-left: 10px; margin: 1.5rem 0 1rem 0;">Panoramica</h4>
            <p style="margin-bottom: 1rem;"><strong>App Codici Password</strong> è un'applicazione web progressiva (PWA) per la gestione sicura di credenziali, password e note personali e aziendali.</p>
            <p style="margin-bottom: 1rem;">L'app nasce per l'utente <strong>PRIVATO</strong>: chiunque può utilizzarla per gestire le proprie credenziali personali senza necessità di funzionalità aziendali. La sezione "Privato" è il cuore dell'applicazione e rappresenta il punto di partenza per tutti gli utenti.</p>
            <p style="margin-bottom: 1rem;">Tuttavia, molte persone sono anche titolari di azienda o professionisti che hanno bisogno di salvare dati aziendali e organizzare scadenze. Per queste esigenze, l'app offre una sezione "Azienda" dedicata, opzionale ma perfettamente integrata.</p>
            <p style="font-style: italic; opacity: 0.8; background: rgba(255,255,255,0.05); padding: 10px; border-radius: 8px;">In sintesi: tutti partono da "Privato", e chi ne ha bisogno espande verso "Azienda".</p>

            <h4 style="color: white; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-left: 3px solid #3b82f6; padding-left: 10px; margin: 2rem 0 1rem 0;">Caratteristiche Principali</h4>
            <ul style="list-style: none; padding: 0; margin-bottom: 1.5rem;">
                <li style="margin-bottom: 0.5rem;"><strong style="color: white;">• Account Privati:</strong> Credenziali, allegati, logo</li>
                <li style="margin-bottom: 0.5rem;"><strong style="color: white;">• Account Aziendali:</strong> Dati anagrafici, P.IVA, QR</li>
                <li style="margin-bottom: 0.5rem;"><strong style="color: white;">• Memorandum:</strong> Note importanti condivisibili</li>
                <li style="margin-bottom: 0.5rem;"><strong style="color: white;">• Condivisione:</strong> Inviti via email sicuri</li>
                <li style="margin-bottom: 0.5rem;"><strong style="color: white;">• Scadenze:</strong> Calendario con notifiche</li>
                <li style="margin-bottom: 0.5rem;"><strong style="color: white;">• Sicurezza:</strong> Firebase & Crittonomia</li>
            </ul>

            <h4 style="color: white; font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; border-left: 3px solid #3b82f6; padding-left: 10px; margin: 2rem 0 1rem 0;">Flussi Principali</h4>
            <ol style="padding-left: 1.2rem; margin-bottom: 2rem;">
                <li style="margin-bottom: 0.5rem;"><strong>Registrazione:</strong> Email/Google & Profilo</li>
                <li style="margin-bottom: 0.5rem;"><strong>Creazione:</strong> Privato/Azienda/Memo</li>
                <li style="margin-bottom: 0.5rem;"><strong>Condivisione:</strong> Rubrica e Inviti</li>
                <li style="margin-bottom: 0.5rem;"><strong>Scadenze:</strong> Notifiche e Urgenze</li>
            </ol>

            <div style="text-align: center; font-size: 0.7rem; opacity: 0.5; margin-top: 3rem;">
                <p>&copy; Boschetto Diego<br>Tutti i diritti riservati</p>
            </div>
        </div>
    `;
}

// STATO UTENTE
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const avatarEl = document.getElementById('user-avatar-settings');
            const nameEl = document.getElementById('user-name-settings');
            const logoutBtn = document.getElementById('logout-btn-settings');

            const userDoc = await getDoc(doc(db, "users", user.uid));
            let userData = userDoc.exists() ? userDoc.data() : {};

            // Update Name
            const displayName = (userData.nome || userData.cognome)
                ? `${userData.nome || ''} ${userData.cognome || ''}`.trim()
                : (user.displayName || t('user_default'));
            if (nameEl) nameEl.textContent = displayName;

            // Update Avatar
            const photoURL = userData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";
            if (avatarEl) {
                avatarEl.style.backgroundImage = `url('${photoURL}')`;
                avatarEl.style.backgroundSize = 'cover';
                avatarEl.style.backgroundPosition = 'center';
            }

            // Logout
            if (logoutBtn) {
                logoutBtn.onclick = async () => {
                    await signOut(auth);
                    window.location.href = 'index.html';
                };
            }

            // 3. Logic Sicurezza (Functional)
            setupSecuritySections(user.uid, userData);

            // Logic Tema
            setupThemeSelector();

        } catch (error) {
            console.error("Error loading user data:", error);
        }
    } else {
        window.location.href = 'index.html';
    }
});

function setupPremiumLanguageSelector(refreshCallback) {
    const btn = document.getElementById('lang-btn');
    const dropdown = document.getElementById('lang-dropdown');
    const currentDisplay = document.getElementById('current-lang-display-full');

    if (!btn || !dropdown) return;

    const currentLang = getCurrentLanguage();
    const langObj = supportedLanguages.find(l => l.code === currentLang);
    if (currentDisplay && langObj) currentDisplay.textContent = langObj.name;

    // Popola dropdown
    dropdown.innerHTML = supportedLanguages.map(lang => `
        <button class="lang-option" style="width:100%; display:flex; align-items:center; gap:12px; padding:12px 16px; background:transparent; border:none; color:white; cursor:pointer; font-size:0.9rem; border-radius:10px; transition: background 0.2s;" data-code="${lang.code}">
            <span style="font-size:1.2rem;">${lang.flag}</span>
            <span style="font-weight: 500;">${lang.name}</span>
            ${lang.code === currentLang ? '<span class="material-symbols-outlined" style="margin-left:auto; font-size:1.1rem; color:#34d399;">check_circle</span>' : ''}
        </button>
    `).join('');

    btn.onclick = (e) => {
        e.stopPropagation();
        dropdown.classList.toggle('show');
    };

    document.addEventListener('click', () => dropdown.classList.remove('show'));

    dropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.onclick = () => {
            const code = opt.dataset.code;
            localStorage.setItem('app_language', code);
            window.location.reload(); // Reload per rinfrescare tutto il sistema
        };
    });
}

function setupSecuritySections(uid, userData) {
    const userDocRef = doc(db, "users", uid);

    // 1. 2FA Toggle (In costruzione con Premium Modal)
    const toggle2fa = document.getElementById('2fa-toggle');
    if (toggle2fa) {
        toggle2fa.checked = false;
        toggle2fa.onchange = () => {
            showWarningModal(
                t('section_security'),
                t('feature_coming_soon'),
                () => { toggle2fa.checked = false; }
            );
        };
    }

    // 2. Face ID Toggle (In costruzione con Premium Modal)
    const toggleFaceId = document.getElementById('face-id-toggle');
    if (toggleFaceId) {
        toggleFaceId.checked = false;
        toggleFaceId.onchange = () => {
            showWarningModal(
                t('section_security'),
                t('feature_coming_soon'),
                () => { toggleFaceId.checked = false; }
            );
        };
    }

    // 3. Timer Inattività
    const timerButtons = document.querySelectorAll('.timer-btn:not(.theme-btn)');
    const currentTimeout = userData.lock_timeout ?? 3;
    timerButtons.forEach(btn => {
        btn.classList.remove('active');
        if (parseInt(btn.dataset.val) === currentTimeout) btn.classList.add('active');
        btn.onclick = async (e) => {
            e.stopPropagation();
            const val = parseInt(btn.dataset.val);
            timerButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            await updateDoc(userDocRef, { lock_timeout: val });
            await syncTimeoutWithFirestore(uid);
            showToast(t('success_save'), 'success');
        };
    });
}

function setupThemeSelector() {
    const themeButtons = document.querySelectorAll('.theme-btn');
    const currentTheme = localStorage.getItem('theme') || 'dark';
    themeButtons.forEach(btn => {
        btn.classList.remove('active'); // Pulisce selezioni precedenti
        if (btn.dataset.theme === currentTheme) btn.classList.add('active');
        btn.onclick = () => {
            localStorage.setItem('theme', btn.dataset.theme);
            window.location.reload();
        };
    });
}

function setupAccordions() {
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        acc.onclick = () => {
            const targetId = acc.dataset.target;
            const content = document.getElementById(targetId);
            const chevron = acc.querySelector('.settings-chevron');
            const isHidden = content.style.display === 'none';
            content.style.display = isHidden ? 'block' : 'none';
            if (chevron) chevron.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
        };
    });
}
