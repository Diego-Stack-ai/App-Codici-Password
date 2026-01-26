import { db } from './firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

/**
 * SECURITY SETUP ONBOARDING
 * Mostra un modal obbligatorio se l'utente non ha ancora configurato la sicurezza.
 */
export async function showSecuritySetupModal(user, userData) {
    if (userData.security_setup_done) return;

    // Inietta il Modal nel DOM
    const overlay = document.createElement('div');
    overlay.className = 'security-setup-overlay';
    overlay.id = 'security-setup-modal';

    overlay.innerHTML = `
        <div class="security-setup-card no-select">
            <div class="icon-header">
                <span class="material-symbols-outlined !text-4xl">shield_lock</span>
            </div>
            <h2>Protocollo Titanium</h2>
            <p>La tua sicurezza è la nostra priorità. Configura ora il blocco automatico per proteggere i tuoi dati sensibili.</p>
            
            <div class="space-y-6 text-left">
                <!-- Toggle Face ID -->
                <div class="flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div class="flex items-center gap-3">
                        <span class="material-symbols-outlined text-blue-400">face</span>
                        <span class="text-xs font-bold text-white uppercase tracking-wider">Face ID / Biometria</span>
                    </div>
                    <input type="checkbox" id="setup-face-id" class="titanium-toggle" checked>
                </div>

                <!-- Selettore Tempo -->
                <div class="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div class="flex items-center gap-3 mb-3">
                        <span class="material-symbols-outlined text-indigo-400">timer</span>
                        <span class="text-[10px] font-bold text-white/50 uppercase tracking-widest">Tempo di Inattività</span>
                    </div>
                    <div class="timer-selector" id="setup-timer-selector">
                        <button class="timer-btn" data-val="0">Subito</button>
                        <button class="timer-btn" data-val="1">1 Min</button>
                        <button class="timer-btn active" data-val="3">3 Min</button>
                        <button class="timer-btn" data-val="5">5 Min</button>
                    </div>
                </div>

                <button id="confirm-security-setup" class="w-full py-4 mt-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all">
                    Attiva Protezione
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    // Gestione Logica Modal
    let selectedTimeout = 3;
    const timerBtns = overlay.querySelectorAll('.timer-btn');
    timerBtns.forEach(btn => {
        btn.onclick = () => {
            timerBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTimeout = parseInt(btn.dataset.val);
        };
    });

    const confirmBtn = document.getElementById('confirm-security-setup');
    confirmBtn.onclick = async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Configurazione in corso...";

        try {
            const isFaceId = document.getElementById('setup-face-id').checked;
            const userDocRef = doc(db, "users", user.uid);

            await updateDoc(userDocRef, {
                biometric_lock: isFaceId,
                lock_timeout: selectedTimeout,
                security_setup_done: true
            });

            // Chiudi modal con animazione
            overlay.style.opacity = '0';
            overlay.style.transform = 'scale(1.1)';
            setTimeout(() => overlay.remove(), 500);

        } catch (error) {
            console.error("Security Setup Error:", error);
            confirmBtn.disabled = false;
            confirmBtn.textContent = "Riprova";
        }
    };
}
