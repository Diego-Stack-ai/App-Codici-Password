/**
 * SECURITY SETUP ONBOARDING (V4.3)
 * Mostra un modal obbligatorio se l'utente non ha ancora configurato la sicurezza.
 * Refactor: Rimozione innerHTML, uso dom-utils.js con import corretti.
 */

import { db } from '../../firebase-config.js';
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren } from '../../dom-utils.js';

export async function showSecuritySetupModal(user, userData) {
    if (userData.security_setup_done) return;

    // Crea Overlay
    const overlay = createElement('div', {
        className: 'security-setup-overlay',
        id: 'security-setup-modal'
    });

    const timerBtnsContainer = createElement('div', { className: 'timer-selector', id: 'setup-timer-selector' });
    const timerOptions = [
        { label: 'Subito', val: 0 },
        { label: '1 Min', val: 1 },
        { label: '3 Min', val: 3, active: true },
        { label: '5 Min', val: 5 }
    ];

    let selectedTimeout = 3;

    const timerBtnElements = timerOptions.map(opt => {
        const btn = createElement('button', {
            className: `timer-btn${opt.active ? ' active' : ''}`,
            dataset: { val: opt.val },
            textContent: opt.label
        });
        btn.addEventListener('click', () => {
            // Reset active class
            Array.from(timerBtnsContainer.children).forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedTimeout = opt.val;
        });
        return btn;
    });

    setChildren(timerBtnsContainer, timerBtnElements);

    const faceIdCheckbox = createElement('input', {
        type: 'checkbox',
        id: 'setup-face-id',
        className: 'base-toggle',
        checked: true
    });

    const confirmBtn = createElement('button', {
        id: 'confirm-security-setup',
        className: 'w-full py-4 mt-4 bg-blue-600 text-white font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-blue-600/20 active:scale-95 transition-all text-sm',
        textContent: 'ATTIVA PROTEZIONE'
    });

    const card = createElement('div', { className: 'security-setup-card no-select' }, [
        createElement('div', { className: 'icon-header' }, [
            createElement('span', { className: 'material-symbols-outlined !text-4xl', textContent: 'shield_lock' })
        ]),
        createElement('h2', { textContent: 'PROTOCOLLO BASE' }),
        createElement('p', { textContent: 'La tua sicurezza è la nostra priorità. Configura ora il blocco automatico per proteggere i tuoi dati sensibili.' }),
        createElement('div', { className: 'space-y-6 text-left mt-6' }, [
            // Toggle Face ID
            createElement('div', { className: 'flex items-center justify-between bg-white/5 p-4 rounded-2xl border border-white/5' }, [
                createElement('div', { className: 'flex items-center gap-3' }, [
                    createElement('span', { className: 'material-symbols-outlined text-blue-400', textContent: 'face' }),
                    createElement('span', { className: 'text-xs font-bold text-white uppercase tracking-wider', textContent: 'Face ID / Biometria' })
                ]),
                faceIdCheckbox
            ]),
            // Selettore Tempo
            createElement('div', { className: 'bg-white/5 p-4 rounded-2xl border border-white/5' }, [
                createElement('div', { className: 'flex items-center gap-3 mb-3' }, [
                    createElement('span', { className: 'material-symbols-outlined text-indigo-400', textContent: 'timer' }),
                    createElement('span', { className: 'text-[10px] font-bold text-white/50 uppercase tracking-widest', textContent: 'Tempo di Inattività' })
                ]),
                timerBtnsContainer
            ]),
            confirmBtn
        ])
    ]);

    setChildren(overlay, card);
    document.body.appendChild(overlay);

    confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        confirmBtn.textContent = "Configurazione in corso...";

        try {
            const isFaceId = faceIdCheckbox.checked;
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
    });
}
