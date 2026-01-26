import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { initComponents } from './components.js';
import { logError } from './utils.js';
import { t, getCurrentLanguage, supportedLanguages } from './translations.js';

/**
 * IMPOSTAZIONI PAGE MODULE (Titanium Version)
 */

// 1. Inizializzazione Componenti (Header/Footer Puri)
initComponents().then(() => {
    const headerStack = document.getElementById('header-content');
    if (headerStack) {
        headerStack.style.display = 'flex';
        headerStack.style.alignItems = 'center';
        headerStack.style.justifyContent = 'space-between';
        headerStack.style.width = '100%';

        headerStack.innerHTML = `
            <div class="header-stack" style="justify-content: center; position: relative;">
                <h2 class="text-gray-900 dark:text-white text-[11px] font-black uppercase tracking-widest">Impostazioni</h2>
                <a href="home_page.html" class="btn-icon-header" style="position: absolute; right: 0;">
                    <span class="material-symbols-outlined">home</span>
                </a>
            </div>
        `;
    }

    const footerStack = document.getElementById('footer-content');
    if (footerStack) {
        footerStack.innerHTML = `
            <div class="footer-stack" style="width: 100%; display: flex; justify-content: center; opacity: 0.3;">
                <span class="text-[9px] font-bold uppercase tracking-[0.3em]">${t('version')}</span>
            </div>
        `;
    }

    // --- TRADUZIONE STATICA DEL DOM ---
    document.querySelectorAll('[data-t]').forEach(el => {
        const key = el.getAttribute('data-t');
        el.textContent = t(key);
    });
});

// 2. Stato Utente e Caricamento Dati
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const avatarEl = document.getElementById('user-avatar-settings');
            const nameEl = document.getElementById('user-name-settings');
            const logoutBtn = document.getElementById('logout-btn-settings');

            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            let userData = {};
            if (docSnap.exists()) userData = docSnap.data();

            const displayName = (userData.nome || userData.cognome)
                ? `${userData.nome || ''} ${userData.cognome || ''}`.trim()
                : (user.displayName || "Utente");

            if (nameEl) nameEl.textContent = displayName;

            const photoURL = userData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";
            if (avatarEl) avatarEl.style.backgroundImage = `url('${photoURL}')`;

            if (logoutBtn) {
                logoutBtn.onclick = async () => {
                    await signOut(auth);
                    window.location.href = 'index.html';
                };
            }

            // --- LOGICA SICUREZZA (Face ID & Blocco) ---
            const faceIdToggle = document.getElementById('face-id-toggle');
            const lockTimerSetting = document.getElementById('lock-timer-setting');
            const currentLockTimerEl = document.getElementById('current-lock-timer');

            // 1. Caricamento stati iniziali
            if (faceIdToggle) faceIdToggle.checked = userData.biometric_lock ?? true;
            if (currentLockTimerEl) {
                const timeout = userData.lock_timeout ?? 3;
                currentLockTimerEl.textContent = timeout === 0 ? "Subito" : `${timeout} Minuti`;
            }

            // 2. Listener Face ID
            if (faceIdToggle) {
                faceIdToggle.addEventListener('change', async () => {
                    await updateDoc(docRef, { biometric_lock: faceIdToggle.checked });
                });
            }

            // 3. Listener Timer Selettore (Subito, 1, 3, 5)
            const timerButtons = document.querySelectorAll('.timer-btn');
            if (timerButtons.length > 0) {
                // Imposta stato iniziale
                const timeout = userData.lock_timeout ?? 3;
                timerButtons.forEach(btn => {
                    if (parseInt(btn.dataset.val) === timeout) btn.classList.add('active');
                    else btn.classList.remove('active');

                    btn.addEventListener('click', async () => {
                        const next = parseInt(btn.dataset.val);
                        // Update UI
                        timerButtons.forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        // Update DB
                        await updateDoc(docRef, { lock_timeout: next });
                    });
                });
            }

            // 4. LOGICA SELETTORE LINGUA (Nuovo Accordion Inline)
            const langButtons = document.querySelectorAll('.lang-btn');
            const currentLang = getCurrentLanguage();
            const currentLangLabel = document.getElementById('current-lang-label');
            const langMap = {
                'it': 'Italiano',
                'en': 'English',
                'es': 'Español',
                'fr': 'Français',
                'de': 'Deutsch',
                'zh': '简体中文',
                'hi': 'हिन्दी',
                'pt': 'Português'
            };

            // Aggiorna UI iniziale
            if (currentLangLabel && langMap[currentLang]) {
                currentLangLabel.textContent = langMap[currentLang];
            }

            langButtons.forEach(btn => {
                const btnLang = btn.getAttribute('data-lang');
                const checkIcon = btn.querySelector('.check-icon');

                // Stato Iniziale
                if (btnLang === currentLang) {
                    btn.classList.add('active');
                    btn.classList.remove('opacity-50');
                    if (checkIcon) checkIcon.classList.remove('opacity-0');
                } else {
                    btn.classList.remove('active');
                    btn.classList.add('opacity-50');
                    if (checkIcon) checkIcon.classList.add('opacity-0');
                }

                // Click Handler
                btn.addEventListener('click', () => {
                    localStorage.setItem('app_language', btnLang);
                    window.location.reload(); // Ricarica per applicare traduzioni
                });
            });

        } catch (error) {
            logError("User Data Load (Settings)", error);
        }
    } else {
        window.location.href = 'index.html';
    }
});

// 3. Iniezione Contenuti Informativi (da Test Theme)
document.addEventListener('DOMContentLoaded', () => {
    // Info App Text
    const infoPlaceholder = document.getElementById('info-app-text-placeholder');
    if (infoPlaceholder) {
        infoPlaceholder.innerHTML = `
            <div class="px-[44px] py-6">
                <div class="text-center pb-4 border-b border-white/5 mb-4">
                    <h4 class="text-lg font-black text-blue-400 uppercase tracking-tighter">App Codici Password</h4>
                    <p class="text-[9px] text-white/30 uppercase tracking-[0.2em] mt-1">Sistema Gestione Credenziali</p>
                </div>
                <div class="space-y-4 text-white/70">
                    <div class="space-y-2">
                        <h5 class="font-bold text-white text-[11px] uppercase border-l-2 border-blue-500 pl-2">Panoramica</h5>
                        <p class="text-[11px] leading-relaxed">App Codici Password è un'applicazione PWA per la gestione sicura di credenziali, password e note personali e aziendali.</p>
                    </div>
                    <div class="space-y-2">
                        <h5 class="font-bold text-white text-[11px] uppercase border-l-2 border-blue-500 pl-2">Privato vs Azienda</h5>
                        <p class="text-[11px] leading-relaxed">L'app nasce per il <strong>PRIVATO</strong> per gestire le credenziali personali. La sezione <strong>AZIENDA</strong> è dedicata a titolari, consulenti o impiegati per gestire P.IVA, scadenze e dati professionali.</p>
                        <div class="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10 italic text-[10px] text-blue-300/60">
                            "Tutti partono da Privato, e chi ne ha bisogno espande verso Azienda."
                        </div>
                    </div>
                    <div class="space-y-2">
                        <h5 class="font-bold text-white text-[11px] uppercase border-l-2 border-blue-500 pl-2">Caratteristiche</h5>
                        <ul class="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px]">
                            <li>• Account Privati</li>
                            <li>• Account Aziendali</li>
                            <li>• Memorandum</li>
                            <li>• Condivisione</li>
                            <li>• Scadenze</li>
                            <li>• Cloud Sync</li>
                        </ul>
                    </div>
                </div>
            </div>
        `;
    }

    // Le 5 Regole d'Oro Text
    const rulesPlaceholder = document.getElementById('rules-gold-text-placeholder');
    if (rulesPlaceholder) {
        rulesPlaceholder.innerHTML = `
            <div class="space-y-6 px-[44px] py-6">
                <!-- LE 5 REGOLE D'ORO -->
                <div class="space-y-3">
                    <div class="text-center pb-2">
                        <h4 class="text-[10px] font-black text-yellow-400 uppercase tracking-widest">Le 5 Regole d'Oro</h4>
                    </div>
                    
                    <div class="space-y-2">
                        <div class="p-3 bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-white text-[11px]">1) Rubrica Passiva</h5>
                            <p class="text-[10px] text-white/50 mt-1">La rubrica serve solo per consultazione. Non si inviano inviti da lì.</p>
                        </div>
                        <div class="p-3 bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-white text-[11px]">2) Share-on-Save</h5>
                            <p class="text-[10px] text-white/50 mt-1">L'invito parte premendo il tasto "Salva Modifiche".</p>
                        </div>
                        <div class="p-3 bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-white text-[11px]">3) Visibilità Immediata</h5>
                            <p class="text-[10px] text-white/50 mt-1">Negli "Accessi" vedi subito gli invitati in stato "In attesa".</p>
                        </div>
                        <div class="p-3 bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-white text-[11px]">4) Flusso di Invito</h5>
                            <p class="text-[10px] text-white/50 mt-1">Se l'utente rifiuta, sparisce da entrambe le parti. Se accetta, va in "Account Condivisi".</p>
                        </div>
                        <div class="p-3 bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-white text-[11px]">5) Revoca Unificata</h5>
                            <p class="text-[10px] text-white/50 mt-1">Togliendo la spunta "Condiviso" cancelli inviti, accessi e notifiche.</p>
                        </div>
                    </div>
                </div>

                <!-- REGOLE VISUALIZZAZIONE -->
                <div class="space-y-3 pt-4 border-t border-white/5">
                    <div class="text-center pb-2">
                        <h4 class="text-[10px] font-black text-blue-400 uppercase tracking-widest">Visualizzazione Dati</h4>
                    </div>

                    <div class="grid grid-cols-1 gap-2">
                        <div class="p-3 bg-blue-500/10 rounded-xl border-l-2 border-blue-500">
                            <h5 class="font-bold text-white text-[11px]">Account Privati</h5>
                            <p class="text-[10px] text-white/60 mt-1">Solo i tuoi account NON condivisi.</p>
                        </div>
                        <div class="p-3 bg-purple-500/10 rounded-xl border-l-2 border-purple-500">
                            <h5 class="font-bold text-white text-[11px]">Account Condivisi</h5>
                            <p class="text-[10px] text-white/60 mt-1">TUTTI gli account condivisi (inviati e ricevuti).</p>
                        </div>
                        <div class="p-3 bg-amber-500/10 rounded-xl border-l-2 border-amber-500">
                            <h5 class="font-bold text-white text-[11px]">Memorandum</h5>
                            <p class="text-[10px] text-white/60 mt-1">Solo i tuoi memo NON condivisi.</p>
                        </div>
                        <div class="p-3 bg-emerald-500/10 rounded-xl border-l-2 border-emerald-500">
                            <h5 class="font-bold text-white text-[11px]">Memorandum Condivisi</h5>
                            <p class="text-[10px] text-white/60 mt-1">TUTTE le note condivise (inviate e ricevute).</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Privacy Policy Text (Aggiornato da Immagine Utente)
    const privacyPlaceholder = document.getElementById('privacy-policy-text-placeholder');
    if (privacyPlaceholder) {
        privacyPlaceholder.innerHTML = `
            <div class="space-y-4 px-[44px] py-6">
                <div class="text-center pb-2">
                    <h4 class="text-sm font-black text-white uppercase tracking-widest">Privacy Policy</h4>
                    <p class="text-[9px] text-white/30 uppercase mt-1">Informativa Estesa</p>
                </div>

                <!-- 1. TITOLARE -->
                <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <h5 class="font-bold text-white text-[11px] mb-2 uppercase tracking-wide">1. Titolare del Trattamento</h5>
                    <p class="text-[11px] text-white/60 leading-relaxed">
                        Il Titolare del trattamento dei dati è <strong>Boschetto Diego</strong>.<br>
                        L'applicazione è concepita per garantire la massima sicurezza e riservatezza.
                    </p>
                </div>

                <!-- 2. DATI TRATTATI -->
                <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <h5 class="font-bold text-white text-[11px] mb-2 uppercase tracking-wide">2. Dati Trattati</h5>
                    <ul class="list-disc pl-4 space-y-1 text-[11px] text-white/60">
                        <li><strong>Registrazione:</strong> Email, nome, avatar (per autenticazione).</li>
                        <li><strong>Volontari:</strong> Credenziali, password, note (crittografati).</li>
                        <li><strong>Tecnici:</strong> Log di sistema gestiti da Google Firebase.</li>
                    </ul>
                </div>

                <!-- 3. SICUREZZA -->
                <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <h5 class="font-bold text-white text-[11px] mb-2 uppercase tracking-wide">3. Sicurezza e Storage</h5>
                    <p class="text-[11px] text-white/60 leading-relaxed">
                        Utilizziamo l'infrastruttura sicura di <strong>Google Firebase</strong>. Connessioni SSL/TLS e database protetti. I dati sensibili sono accessibili solo all'utente proprietario e ai destinatari espliciti della condivisione.
                    </p>
                </div>

                <!-- 4. CONDIVISIONE -->
                <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <h5 class="font-bold text-white text-[11px] mb-2 uppercase tracking-wide">4. Condivisione Dati</h5>
                    <p class="text-[11px] text-white/60 leading-relaxed">
                        Nessun dato viene venduto a terzi. La condivisione avviene <strong>solo su tua esplicita azione</strong> tramite la funzione "Condividi" verso le email che selezioni.
                    </p>
                </div>

                <!-- 5. DIRITTI -->
                <div class="p-4 bg-white/5 rounded-2xl border border-white/10">
                    <h5 class="font-bold text-white text-[11px] mb-2 uppercase tracking-wide">5. Diritti Utente (GDPR)</h5>
                    <ul class="list-disc pl-4 space-y-1 text-[11px] text-white/60">
                        <li>Diritto di accesso ai propri dati.</li>
                        <li>Diritto alla cancellazione ("Oblio") eliminando l'account.</li>
                        <li>Diritto di rettifica delle informazioni.</li>
                    </ul>
                </div>

                <div class="text-center pt-2">
                    <p class="text-[9px] text-white/20 uppercase tracking-widest">Ultimo aggiornamento: Gennaio 2026</p>
                </div>
            </div>
        `;
    }

    // Gestore Accordion (Nuova Classe .accordion-header)
    const accordions = document.querySelectorAll('.accordion-header');
    accordions.forEach(acc => {
        acc.addEventListener('click', () => {
            const contentId = acc.dataset.target;
            const content = document.getElementById(contentId);
            const chevron = acc.querySelector('.settings-chevron');

            if (content.classList.contains('hidden')) {
                content.classList.remove('hidden');
                if (chevron) chevron.style.transform = 'rotate(180deg)';
            } else {
                content.classList.add('hidden');
                if (chevron) chevron.style.transform = 'rotate(0deg)';
            }
        });
    });
});

/**
 * SHOW LANGUAGE PICKER MODAL
 */
function showLanguagePicker() {
    const currentLang = getCurrentLanguage();

    const overlay = document.createElement('div');
    overlay.className = 'lang-picker-overlay';
    overlay.id = 'lang-picker-modal';

    let langItemsHtml = '';
    supportedLanguages.forEach(lang => {
        const isActive = lang.code === currentLang;
        langItemsHtml += `
            <div class="lang-item ${isActive ? 'active' : ''}" data-code="${lang.code}">
                <span class="lang-flag">${lang.flag}</span>
                <span class="lang-name">${lang.name}</span>
                <span class="material-symbols-outlined lang-check">check_circle</span>
            </div>
        `;
    });

    overlay.innerHTML = `
        <div class="lang-picker-card">
            <h3 class="lang-picker-title">${t('select_language')}</h3>
            <div class="lang-list">
                ${langItemsHtml}
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Chiusura al click fuori
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 400);
        }
    };

    // Gestione selezione
    overlay.querySelectorAll('.lang-item').forEach(item => {
        item.onclick = () => {
            const newLang = item.dataset.code;
            if (newLang !== currentLang) {
                localStorage.setItem('app_language', newLang);
                window.location.reload();
            } else {
                overlay.click(); // Chiudi se è uguale
            }
        };
    });
}
