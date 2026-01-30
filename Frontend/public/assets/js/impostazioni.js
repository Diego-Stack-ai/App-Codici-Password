import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { t, getCurrentLanguage, supportedLanguages } from './translations.js';
import { syncTimeoutWithFirestore } from './inactivity-timer.js';
import { showToast, showWarningModal } from './ui-core.js';

/**
 * IMPOSTAZIONI PAGE MODULE (Titanium Account V1.1)
 */

const initImpostazioni = () => {
    // 1. Traduzione statica immediata degli elementi presenti nel DOM
    const updateTranslations = () => {
        document.querySelectorAll('[data-t]').forEach(el => {
            const key = el.getAttribute('data-t');
            const translation = t(key);
            if (translation && translation !== key) {
                // Se l'elemento ha Material Icons (span con classe material-symbols-outlined), non sovrascrivere tutto
                // In questo caso data-t è solitamente su span che contengono solo testo
                el.textContent = translation;
            }
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
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initImpostazioni);
} else {
    initImpostazioni();
}

function setupPrivacyInfo() {
    const placeholder = document.getElementById('info-privacy-text-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = `
        <div class="info-content" style="padding: 1.5rem;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h3>PRIVACY POLICY</h3>
                <p class="subtitle-caps">INFORMATIVA ESTESA</p>
            </div>

            <div class="info-card">
                <h4>1. TITOLARE DEL TRATTAMENTO</h4>
                <p>Il Titolare del trattamento dei dati è <strong>Boschetto Diego</strong>. L'applicazione è concepita per garantire la massima sicurezza e riservatezza.</p>
            </div>

            <div class="info-card">
                <h4>2. DATI TRATTATI</h4>
                <ul style="list-style: none; padding: 0; margin: 0.5rem 0;">
                    <li style="margin-bottom: 0.4rem;"><strong>• Registrazione:</strong> Email, nome, avatar (per autenticazione).</li>
                    <li style="margin-bottom: 0.4rem;"><strong>• Volontari:</strong> Credenziali, password, note (crittografati).</li>
                    <li style="margin-bottom: 0.4rem;"><strong>• Tecnici:</strong> Log di sistema gestiti da Google Firebase.</li>
                </ul>
            </div>

            <div class="info-card">
                <h4>3. SICUREZZA E STORAGE</h4>
                <p>Utilizziamo l'infrastruttura sicura di <strong>Google Firebase</strong>. Connessioni SSL/TLS e database protetti. I dati sensibili sono accessibili solo all'utente proprietario e ai destinatari espliciti della condivisione.</p>
            </div>

            <div class="info-card">
                <h4>4. CONDIVISIONE DATI</h4>
                <p>Nessun dato viene venduto a terzi. La condivisione avviene <strong>solo su tua esplicita azione</strong> tramite la funzione "Condividi" verso le email che selezioni.</p>
            </div>

            <div class="info-card">
                <h4>5. DIRITTI UTENTE (GDPR)</h4>
                <ul style="list-style: none; padding: 0; margin: 0.5rem 0;">
                    <li style="margin-bottom: 0.4rem;"><strong>•</strong> Diritto di accesso ai propri dati.</li>
                    <li style="margin-bottom: 0.4rem;"><strong>•</strong> Diritto alla cancellazione ("Oblio") eliminando l'account.</li>
                    <li style="margin-bottom: 0.4rem;"><strong>•</strong> Diritto di rettifica delle informazioni.</li>
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
        <div class="info-content" style="padding: 1.5rem;">
            <div style="text-align: center; margin-bottom: 2rem;">
                <h3>APP CODICI PASSWORD</h3>
                <p class="subtitle-caps">SISTEMA DI GESTIONE CREDENZIALI E CONDIVISIONE</p>
            </div>

            <h4 class="section-divider">Panoramica</h4>
            <p style="margin-bottom: 1rem;"><strong>App Codici Password</strong> è un'applicazione web progressiva (PWA) per la gestione sicura di credenziali, password e note personali e aziendali.</p>
            <p style="margin-bottom: 1rem;">L'app nasce per l'utente <strong>PRIVATO</strong>: chiunque può utilizzarla per gestire le proprie credenziali personali senza necessità di funzionalità aziendali. La sezione "Privato" è il cuore dell'applicazione e rappresenta il punto di partenza per tutti gli utenti.</p>
            <p style="margin-bottom: 1rem;">Tuttavia, molte persone sono anche titolari di azienda o professionisti che hanno bisogno di salvare dati aziendali e organizzare scadenze. Per queste esigenze, l'app offre una sezione "Azienda" dedicata, opzionale ma perfettamente integrata.</p>
            <p class="highlight-box">In sintesi: tutti partono da "Privato", e chi ne ha bisogno espande verso "Azienda".</p>

            <h4 class="section-divider">Caratteristiche Principali</h4>
            <ul style="list-style: none; padding: 0; margin-bottom: 1.5rem;">
                <li style="margin-bottom: 0.5rem;"><strong>• Account Privati:</strong> Credenziali, allegati, logo</li>
                <li style="margin-bottom: 0.5rem;"><strong>• Account Aziendali:</strong> Dati anagrafici, P.IVA, QR</li>
                <li style="margin-bottom: 0.5rem;"><strong>• Memorandum:</strong> Note importanti condivisibili</li>
                <li style="margin-bottom: 0.5rem;"><strong>• Condivisione:</strong> Inviti via email sicuri</li>
                <li style="margin-bottom: 0.5rem;"><strong>• Scadenze:</strong> Calendario con notifiche</li>
                <li style="margin-bottom: 0.5rem;"><strong>• Sicurezza:</strong> Firebase & Crittonomia</li>
            </ul>

            <h4 class="section-divider">Flussi Principali</h4>
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

            // --- QR CODE GENERATION ---
            const qrContainer = document.getElementById('qrcode-settings');
            if (qrContainer && typeof QRCode !== 'undefined') {
                qrContainer.innerHTML = '';

                // --- DYNAMIC vCard GENERATION (based on QR Flags) ---
                const config = userData.qr_personal || {};

                // 1. NOME & ANAGRAFICA
                const sName = config.nome ? (userData.nome || '') : '';
                const sSurname = config.cognome ? (userData.cognome || '') : '';
                const fn = `${sName} ${sSurname}`.trim();

                let notes = [];
                if (config.cf && (userData.cf || userData.codiceFiscale)) notes.push(`CF: ${userData.cf || userData.codiceFiscale}`);
                if (config.nascita && userData.birth_date) notes.push(`Nato il: ${userData.birth_date}`);
                if (config.luogo && userData.birth_place) notes.push(`Nato a: ${userData.birth_place} ${userData.birth_province ? '(' + userData.birth_province + ')' : ''}`);

                let vcardPayload = ['BEGIN:VCARD', 'VERSION:3.0'];

                if (sName || sSurname) vcardPayload.push(`N:${sSurname};${sName};;;`);
                if (fn) vcardPayload.push(`FN:${fn}`);
                if (notes.length > 0) vcardPayload.push(`NOTE:${notes.join(' - ')}`);

                // 2. TELEFONI
                if (userData.contactPhones && Array.isArray(userData.contactPhones)) {
                    userData.contactPhones.forEach(p => {
                        if (p.shareQr && p.number) {
                            let type = 'VOICE';
                            const tLower = (p.type || '').toLowerCase();
                            if (tLower.includes('cell')) type = 'CELL';
                            else if (tLower.includes('lavoro') || tLower.includes('work')) type = 'WORK';
                            else if (tLower.includes('casa') || tLower.includes('home') || tLower.includes('fisso')) type = 'HOME';
                            vcardPayload.push(`TEL;TYPE=${type}:${p.number}`);
                        }
                    });
                }

                // 3. EMAIL
                if (userData.contactEmails && Array.isArray(userData.contactEmails)) {
                    userData.contactEmails.forEach(e => {
                        if (e.shareQr && e.address) {
                            vcardPayload.push(`EMAIL;TYPE=INTERNET:${e.address}`);
                        }
                    });
                }

                // 4. INDIRIZZI
                if (userData.userAddresses && Array.isArray(userData.userAddresses)) {
                    userData.userAddresses.forEach(a => {
                        if (a.shareQr) {
                            const street = `${a.address || ''} ${a.civic || ''}`.trim();
                            const city = a.city || '';
                            const region = a.province || '';
                            const zip = a.cap || '';
                            let type = 'HOME';
                            const tLower = (a.type || '').toLowerCase();
                            if (tLower.includes('lavoro')) type = 'WORK';
                            vcardPayload.push(`ADR;TYPE=${type}:;;${street};${city};${region};${zip};`);
                        }
                    });
                }

                vcardPayload.push('END:VCARD');
                const vcard = vcardPayload.join('\n');

                // Store vCard for Modal Zoom
                qrContainer.dataset.vcard = vcard;

                try {
                    new QRCode(qrContainer, {
                        text: vcard,
                        width: 90,
                        height: 90,
                        colorDark: "#000000",
                        colorLight: "#ffffff",
                        correctLevel: QRCode.CorrectLevel.H
                    });
                } catch (e) {
                    console.error("QR Error", e);
                }
            }

            // Logout
            if (logoutBtn) {
                logoutBtn.onclick = async () => {
                    const confirmed = await window.showConfirmModal(t('section_security'), t('logout_confirm') || "Vuoi davvero uscire?");
                    if (confirmed) {
                        await signOut(auth);
                        window.location.href = 'index.html';
                    }
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
        <button class="lang-option" style="width:100%; display:flex; align-items:center; gap:12px; padding:12px 16px; background:transparent; border:none; color:var(--text-primary); cursor:pointer; font-size:0.9rem; border-radius:10px; transition: background 0.2s;" data-code="${lang.code}">
            <span style="font-size:1.2rem;">${lang.flag}</span>
            <span style="font-weight: 500;">${lang.name}</span>
            ${lang.code === currentLang ? '<span class="material-symbols-outlined" style="margin-left:auto; font-size:1.1rem; color:#34d399;">check_circle</span>' : ''}
        </button>
    `).join('');

    btn.onclick = (e) => {
        // Se il click avviene dentro il dropdown (es. sui pulsanti), non fare toggle qui
        if (dropdown.contains(e.target)) return;

        e.stopPropagation();
        dropdown.classList.toggle('show');
    };

    document.addEventListener('click', () => dropdown.classList.remove('show'));

    dropdown.querySelectorAll('.lang-option').forEach(opt => {
        opt.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevenire interferenze col document listener
            const code = opt.dataset.code;
            if (code) {
                localStorage.setItem('app_language', code);
                window.location.reload();
            }
        });
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
            if (content) {
                const isShowing = content.classList.toggle('show');
                // Force inline style per sicurezza ibrida come da protocollo V3
                content.style.display = isShowing ? 'block' : 'none';
                if (chevron) chevron.style.transform = isShowing ? 'rotate(180deg)' : 'rotate(0deg)';
            }
        };
    });
}

// --- QR ZOOM MODAL ---
window.showQrModal = () => {
    const qrContainer = document.getElementById('qrcode-settings');
    const vcard = qrContainer ? qrContainer.dataset.vcard : null;

    if (!vcard) {
        console.warn("Nessun dato vCard trovato per il QR Code.");
        return;
    }

    // Overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(10px);
        z-index: 10000; display: flex; flex-direction: column;
        align-items: center; justify-content: center; opacity: 0; transition: opacity 0.3s;
    `;

    // Content Box
    const content = document.createElement('div');
    content.style.cssText = `
        background: white; padding: 2rem; border-radius: 30px;
        box-shadow: 0 0 50px rgba(255, 255, 255, 0.2);
        display: flex; flex-direction: column; align-items: center; gap: 2rem;
        transform: scale(0.9); transition: transform 0.3s;
    `;

    // QR Div Large
    const qrDivLarge = document.createElement('div');

    // Close Button
    const closeBtn = document.createElement('button');
    closeBtn.textContent = "CHIUDI";
    closeBtn.className = "auth-btn";
    closeBtn.style.cssText = "width: auto; padding: 12px 40px; border-radius: 50px;";
    closeBtn.onclick = () => {
        overlay.style.opacity = '0';
        overlay.style.pointerEvents = 'none';
        setTimeout(() => overlay.remove(), 300);
    };

    content.appendChild(qrDivLarge);
    content.appendChild(closeBtn);
    overlay.appendChild(content);
    document.body.appendChild(overlay);

    // Render QR with Delay
    setTimeout(() => {
        try {
            new QRCode(qrDivLarge, {
                text: vcard,
                width: 300,
                height: 300,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            // Show Animation
            overlay.style.opacity = '1';
            content.style.transform = 'scale(1)';
        } catch (e) {
            console.error("Zoom render error", e);
            overlay.remove();
        }
    }, 50);
};
