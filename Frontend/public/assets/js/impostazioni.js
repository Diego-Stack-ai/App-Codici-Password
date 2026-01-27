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
                <h2 class="text-gray-900 dark:text-white text-[11px] font-black uppercase tracking-widest">${t('settings_page_title')}</h2>
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
                : (user.displayName || t('user_default'));

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
                currentLockTimerEl.textContent = timeout === 0 ? t('lock_immediately') : `${timeout} ${t('unit_minutes')}`;
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

            // --- LOGICA TEMA (Chiaro, Scuro, Auto) ---
            const themeButtons = document.querySelectorAll('.theme-btn');
            if (themeButtons.length > 0) {
                const currentTheme = localStorage.getItem('theme') || 'dark';
                themeButtons.forEach(btn => {
                    if (btn.dataset.theme === currentTheme) btn.classList.add('active');
                    else btn.classList.remove('active');

                    btn.addEventListener('click', () => {
                        const newTheme = btn.dataset.theme;
                        localStorage.setItem('theme', newTheme);
                        window.location.reload();
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
            <div class="px-5 py-6">
                <div class="text-center pb-4 border-b border-slate-200 dark:border-white/5 mb-4">
                    <h4 class="text-lg font-black text-blue-600 dark:text-blue-400 uppercase tracking-tighter">${t('app_info_system_name')}</h4>
                    <p class="text-[9px] text-gray-500 dark:text-white/30 uppercase tracking-[0.2em] mt-1">${t('app_info_system_sub')}</p>
                </div>
                <div class="space-y-4 text-gray-700 dark:text-white/70">
                    <div class="space-y-3">
                        <h5 class="font-bold text-gray-900 dark:text-white text-[11px] uppercase border-l-4 border-blue-500 pl-3">${t('app_info_overview_title')}</h5>
                        <p class="text-[11px] leading-relaxed text-justify">${t('app_info_overview_p1')}</p>
                        <p class="text-[11px] leading-relaxed text-justify">${t('app_info_overview_p2')}</p>
                        <p class="text-[11px] leading-relaxed text-justify">${t('app_info_overview_p3')}</p>
                        <div class="bg-blue-500/5 p-3 rounded-xl border border-blue-500/10 italic text-[10px] text-blue-700 dark:text-blue-300/60">
                            ${t('app_info_overview_quote')}
                        </div>
                    </div>
                    <div class="space-y-3">
                        <h5 class="font-bold text-gray-900 dark:text-white text-[11px] uppercase border-l-4 border-blue-500 pl-3">${t('app_info_features_title')}</h5>
                        <ul class="list-disc list-outside pl-5 space-y-1 text-[10px]">
                            <li>${t('app_info_feat_1')}</li>
                            <li>${t('app_info_feat_2')}</li>
                            <li>${t('app_info_feat_3')}</li>
                            <li>${t('app_info_feat_4')}</li>
                            <li>${t('app_info_feat_5')}</li>
                            <li>${t('app_info_feat_6')}</li>
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
            <div class="px-5 py-6 space-y-6">
                <!-- LE 5 REGOLE D'ORO -->
                <div class="space-y-3">
                    <div class="text-center pb-2">
                        <h4 class="text-[10px] font-black text-yellow-600 dark:text-yellow-400 uppercase tracking-widest">${t('rules_gold_title')}</h4>
                    </div>
                    
                    <div class="space-y-2">
                        <div class="p-3 bg-black/5 dark:bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('rule_1_title')}</h5>
                            <p class="text-[10px] text-gray-600 dark:text-white/50 mt-1">${t('rule_1_desc')}</p>
                        </div>
                        <div class="p-3 bg-black/5 dark:bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('rule_2_title')}</h5>
                            <p class="text-[10px] text-gray-600 dark:text-white/50 mt-1">${t('rule_2_desc')}</p>
                        </div>
                        <div class="p-3 bg-black/5 dark:bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('rule_3_title')}</h5>
                            <p class="text-[10px] text-gray-600 dark:text-white/50 mt-1">${t('rule_3_desc')}</p>
                        </div>
                        <div class="p-3 bg-black/5 dark:bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('rule_4_title')}</h5>
                            <p class="text-[10px] text-gray-600 dark:text-white/50 mt-1">${t('rule_4_desc')}</p>
                        </div>
                        <div class="p-3 bg-black/5 dark:bg-white/5 rounded-xl border-l-2 border-yellow-500/50">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('rule_5_title')}</h5>
                            <p class="text-[10px] text-gray-600 dark:text-white/50 mt-1">${t('rule_5_desc')}</p>
                        </div>
                    </div>
                </div>

                <!-- REGOLE VISUALIZZAZIONE -->
                <div class="space-y-3 pt-4 border-t border-slate-200 dark:border-white/5">
                    <div class="text-center pb-2">
                        <h4 class="text-[10px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest">${t('data_view_title')}</h4>
                    </div>

                    <div class="grid grid-cols-1 gap-2">
                        <div class="p-3 bg-blue-500/5 dark:bg-blue-500/10 rounded-xl border-l-2 border-blue-500">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('view_private_title')}</h5>
                            <p class="text-[10px] text-gray-700 dark:text-white/60 mt-1">${t('view_private_desc')}</p>
                        </div>
                        <div class="p-3 bg-purple-500/5 dark:bg-purple-500/10 rounded-xl border-l-2 border-purple-500">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('view_shared_title')}</h5>
                            <p class="text-[10px] text-gray-700 dark:text-white/60 mt-1">${t('view_shared_desc')}</p>
                        </div>
                        <div class="p-3 bg-amber-500/5 dark:bg-amber-500/10 rounded-xl border-l-2 border-amber-500">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('view_memo_title')}</h5>
                            <p class="text-[10px] text-gray-700 dark:text-white/60 mt-1">${t('view_memo_desc')}</p>
                        </div>
                        <div class="p-3 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-xl border-l-2 border-emerald-500">
                            <h5 class="font-bold text-gray-900 dark:text-white text-[11px]">${t('view_memo_shared_title')}</h5>
                            <p class="text-[10px] text-gray-700 dark:text-white/60 mt-1">${t('view_memo_shared_desc')}</p>
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
            <div class="px-5 py-6 space-y-4">
                <div class="text-center pb-2">
                    <h4 class="text-sm font-black text-gray-900 dark:text-white uppercase tracking-widest">${t('privacy_policy_title')}</h4>
                    <p class="text-[9px] text-gray-500 dark:text-white/30 uppercase mt-1">${t('privacy_extended_title')}</p>
                </div>

                <!-- 1. TITOLARE -->
                <div class="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h5 class="font-bold text-gray-900 dark:text-white text-[11px] mb-2 uppercase tracking-wide">${t('privacy_1_title')}</h5>
                    <p class="text-[11px] text-gray-700 dark:text-white/60 leading-relaxed">
                        ${t('privacy_1_text')}
                    </p>
                </div>

                <!-- 2. DATI TRATTATI -->
                <div class="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h5 class="font-bold text-gray-900 dark:text-white text-[11px] mb-2 uppercase tracking-wide">${t('privacy_2_title')}</h5>
                    <ul class="list-disc pl-4 space-y-1 text-[11px] text-gray-700 dark:text-white/60">
                        <li>${t('privacy_2_li1')}</li>
                        <li>${t('privacy_2_li2')}</li>
                        <li>${t('privacy_2_li3')}</li>
                    </ul>
                </div>

                <!-- 3. SICUREZZA -->
                <div class="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h5 class="font-bold text-gray-900 dark:text-white text-[11px] mb-2 uppercase tracking-wide">${t('privacy_3_title')}</h5>
                    <p class="text-[11px] text-gray-700 dark:text-white/60 leading-relaxed">
                        ${t('privacy_3_text')}
                    </p>
                </div>

                <!-- 4. CONDIVISIONE -->
                <div class="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h5 class="font-bold text-gray-900 dark:text-white text-[11px] mb-2 uppercase tracking-wide">${t('privacy_4_title')}</h5>
                    <p class="text-[11px] text-gray-700 dark:text-white/60 leading-relaxed">
                        ${t('privacy_4_text')}
                    </p>
                </div>

                <!-- 5. DIRITTI -->
                <div class="p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-slate-200 dark:border-white/10">
                    <h5 class="font-bold text-gray-900 dark:text-white text-[11px] mb-2 uppercase tracking-wide">${t('privacy_5_title')}</h5>
                    <ul class="list-disc pl-4 space-y-1 text-[11px] text-gray-700 dark:text-white/60">
                        <li>${t('privacy_5_li1')}</li>
                        <li>${t('privacy_5_li2')}</li>
                        <li>${t('privacy_5_li3')}</li>
                    </ul>
                </div>

                <div class="text-center pt-2">
                    <p class="text-[9px] text-gray-400 dark:text-white/20 uppercase tracking-widest">${t('privacy_update_text')}</p>
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
