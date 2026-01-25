import { auth, db } from './firebase-config.js';
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { initComponents } from './components.js';
import { logError } from './utils.js';

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
            <div class="header-stack">
                <a href="home_page.html" class="btn-icon-header border-glow">
                    <span class="material-symbols-outlined">arrow_back</span>
                </a>
                <h2 class="text-white text-[11px] font-black uppercase tracking-widest">Impostazioni</h2>
                <a href="home_page.html" class="btn-icon-header border-glow">
                    <span class="material-symbols-outlined">home</span>
                </a>
            </div>
        `;
    }

    const footerStack = document.getElementById('footer-content');
    if (footerStack) {
        footerStack.innerHTML = `
            <div class="footer-stack">
                <span class="build-tag">Titanium Protocol v5.1 Build 400</span>
            </div>
        `;
    }
});

// 2. Stato Utente e Caricamento Dati
onAuthStateChanged(auth, async (user) => {
    if (user) {
        try {
            const avatarEl = document.getElementById('user-avatar-settings');
            const nameEl = document.getElementById('user-name-settings');
            const emailEl = document.getElementById('user-email-settings');
            const logoutBtn = document.getElementById('logout-btn-settings');

            const docRef = doc(db, "users", user.uid);
            const docSnap = await getDoc(docRef);
            let userData = {};
            if (docSnap.exists()) userData = docSnap.data();

            const displayName = (userData.nome || userData.cognome)
                ? `${userData.nome || ''} ${userData.cognome || ''}`.trim()
                : (user.displayName || "Utente");

            if (nameEl) nameEl.textContent = displayName;
            if (emailEl) emailEl.textContent = user.email || "No Email";

            const photoURL = userData.photoURL || user.photoURL || "assets/images/user-avatar-5.png";
            if (avatarEl) avatarEl.style.backgroundImage = `url('${photoURL}')`;

            if (logoutBtn) {
                logoutBtn.onclick = async () => {
                    await signOut(auth);
                    window.location.href = 'index.html';
                };
            }
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
            <p>App Codici Password è un'applicazione PWA per la gestione sicura di credenziali e note personali/aziendali.</p>
            <p><strong>Privato:</strong> La sezione cuore per gestire le tue credenziali personali.</p>
            <p><strong>Azienda:</strong> Sezione opzionale per gestire dati anagrafici, P.IVA e QR Code professionali.</p>
            <div class="bg-white/5 p-3 rounded-lg border border-white/10 italic">
                Tutti partono da "Privato", e chi ne ha bisogno espande verso "Azienda".
            </div>
        `;
    }

    // Le 5 Regole d'Oro Text
    const rulesPlaceholder = document.getElementById('rules-gold-text-placeholder');
    if (rulesPlaceholder) {
        rulesPlaceholder.innerHTML = `
            <div class="space-y-4">
                <div class="p-3 bg-white/5 rounded-lg border-l-2 border-yellow-500">
                    <h5 class="font-bold text-white mb-1">1. Regola della Rubrica Passiva</h5>
                    <p class="text-[10px] text-white/50">La rubrica serve solo per consultazione. Gli inviti non si inviano da lì.</p>
                </div>
                <div class="p-3 bg-white/5 rounded-lg border-l-2 border-yellow-500">
                    <h5 class="font-bold text-white mb-1">2. Regola "Share-on-Save"</h5>
                    <p class="text-[10px] text-white/50">L'invito parte premendo il tasto "Salva Modifiche".</p>
                </div>
                <div class="p-3 bg-white/5 rounded-lg border-l-2 border-yellow-500">
                    <h5 class="font-bold text-white mb-1">3. Visibilità Immediata</h5>
                    <p class="text-[10px] text-white/50">Nella lista "Accessi" vedi subito gli invitati in attesa.</p>
                </div>
                <div class="p-3 bg-white/5 rounded-lg border-l-2 border-yellow-500">
                    <h5 class="font-bold text-white mb-1">4. Regola Regole Visualizzazione</h5>
                    <p class="text-[10px] text-white/50">Filtri automatici tra account privati e condivisi.</p>
                </div>
                <div class="p-3 bg-white/5 rounded-lg border-l-2 border-yellow-500">
                    <h5 class="font-bold text-white mb-1">5. Revoca Unificata</h5>
                    <p class="text-[10px] text-white/50">Dalla rubrica cancelli inviti, accessi e notifiche in un colpo solo.</p>
                </div>
            </div>
        `;
    }

    // Privacy Policy Text
    const privacyPlaceholder = document.getElementById('privacy-policy-text-placeholder');
    if (privacyPlaceholder) {
        privacyPlaceholder.innerHTML = `
            <div class="space-y-3">
                <p><strong>Titolare:</strong> Boschetto Diego.</p>
                <p><strong>Dati:</strong> Email, Nome, Password e Note crittografate su Firebase.</p>
                <p><strong>Sicurezza:</strong> Connessioni SSL/TLS e database Google protetti.</p>
                <p><strong>Diritti:</strong> Accesso, rettifica e cancellazione (Oblio) immediati.</p>
            </div>
        `;
    }

    // Gestore Accordion
    const accordions = document.querySelectorAll('.accordion-toggle');
    accordions.forEach(acc => {
        acc.addEventListener('click', () => {
            const contentId = acc.dataset.target;
            const chevronId = acc.dataset.chevron;
            const content = document.getElementById(contentId);
            const chevron = document.getElementById(chevronId);

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
