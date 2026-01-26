
import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { initComponents } from './components.js';
import { t } from './translations.js';

// Setup Base (Header/Footer)
initComponents().then(() => {
    // Pattern 'Impostazioni' VERO: Inietta contenuto DENTRO l'header standard
    const headerStack = document.getElementById('header-content');
    if (headerStack) {
        // ... (Header Injection Logic - Invariata) ...
        headerStack.style.display = 'flex';
        headerStack.style.alignItems = 'center';
        headerStack.style.justifyContent = 'space-between';
        headerStack.style.width = '100%';
        headerStack.className = "px-4";

        headerStack.innerHTML = `
            <div class="header-stack w-full flex items-center justify-between relative">
                <a href="impostazioni.html" class="btn-icon-header border-glow flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-white">
                    <span class="material-symbols-outlined">arrow_back</span>
                </a>
                <h2 class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white text-[11px] font-black uppercase tracking-widest whitespace-nowrap">
                    Regole Invio
                </h2>
                <a href="home_page.html" class="btn-icon-header border-glow flex items-center justify-center p-2 rounded-xl bg-white/5 hover:bg-white/10 transition-all active:scale-95 text-white">
                    <span class="material-symbols-outlined">home</span>
                </a>
            </div>
        `;
    }

    // Pattern Footer (Effetto 5): Inietta versione
    const footerStack = document.getElementById('footer-content');
    if (footerStack) {
        footerStack.innerHTML = `
            <div class="footer-stack" style="width: 100%; display: flex; justify-content: center; opacity: 0.3;">
                <span class="text-[9px] font-bold uppercase tracking-[0.3em] font-mono text-white/50 user-select-none">${t('version')}</span>
            </div>
        `;
    }
});

const memoArea = document.getElementById('future_memo');
const saveBtn = document.getElementById('save_memo_btn');

const DEFAULT_MEMO = "";

// Nuovi appunti da unire agli esistenti (Versione Dettagliata)
const NEW_NOTES_TO_ADD = `
---------------------------------------------------
[DA IMPLEMENTARE - DETTAGLIO SCADENZA e LOGICA]

1. CAMPI MANCANTI NELLA UI
   - Oggetto Email: Aggiungere visualizzazione nella sezione Configurazione Email.
   - Regole Notifica: Mostrare Giorni di Preavviso (notificationDaysBefore) e Frequenza (notificationFrequency).
   - WhatsApp: Indicare chiaramente se la notifica WhatsApp è attiva o meno.

2. LOGICA CORPO EMAIL (Refactoring)
   - Attualmente in dettaglio_scadenza.js la costruzione del testo è duplicata/manuale.
   - AZIONE: Importare 'buildEmailBody' da scadenza_templates.js per garantire coerenza assoluta tra creazione e visualizzazione.

3. GERARCHIA VISIVA (Hero Card)
   - Attualmente il focus è sull'Oggetto (Titolo), con l'Intestatario come sottotitolo.
   - VALUTAZIONE: Invertire o bilanciare meglio per rendere subito chiaro "CHI" è il soggetto (es. Nome Cliente in grande, Tipo Scadenza come etichetta).
---------------------------------------------------`;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // Load Memo
    if (memoArea) {
        try {
            const docRef = doc(db, "users", user.uid, "settings", "roadmap_memo");
            const snap = await getDoc(docRef);

            let currentText = DEFAULT_MEMO;
            if (snap.exists() && snap.data().text) {
                currentText = snap.data().text;
            }

            // Append logic if not already present
            if (!currentText.includes("DA IMPLEMENTARE - DETTAGLIO SCADENZA")) {
                currentText += NEW_NOTES_TO_ADD;
                // Auto-save the update
                await setDoc(docRef, { text: currentText }, { merge: true });
            }

            memoArea.value = currentText;

        } catch (e) {
            console.error("Error loading memo:", e);
            memoArea.value = DEFAULT_MEMO;
        }
    }
});

if (saveBtn) {
    saveBtn.onclick = async () => {
        const user = auth.currentUser;
        if (!user) return;

        if (!memoArea) return;

        const originalText = saveBtn.innerHTML;
        saveBtn.innerHTML = '<span class="material-symbols-outlined !text-[16px] animate-spin">refresh</span> SALVATAGGIO...';

        try {
            const docRef = doc(db, "users", user.uid, "settings", "roadmap_memo");
            await setDoc(docRef, { text: memoArea.value }, { merge: true });

            setTimeout(() => {
                saveBtn.innerHTML = '<span class="material-symbols-outlined !text-[16px]">done</span> SALVATO!';
                saveBtn.className = "text-[11px] font-bold text-green-400 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 transition-colors";

                setTimeout(() => {
                    saveBtn.innerHTML = '<span class="material-symbols-outlined !text-[16px]">save</span> SALVA APPUNTO';
                    saveBtn.className = "text-[11px] font-bold text-purple-400 hover:text-purple-300 flex items-center gap-1.5 px-3 py-1.5 rounded-lg hover:bg-purple-500/10 transition-colors";
                }, 2000);
            }, 500);
        } catch (e) {
            alert("Errore nel salvataggio!");
            saveBtn.innerHTML = originalText;
        }
    };
}
