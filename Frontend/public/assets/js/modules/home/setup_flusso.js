/**
 * SETUP FLUSSO MODULE (V4.5)
 * Gestisce il popup di primo accesso per Push e Condivisione.
 */

import { auth, db, messaging } from '../../firebase-config.js';
import { doc, getDoc, updateDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { getToken } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-messaging.js";
import { syncPushToken, checkPushCompatibility } from '../shared/push_manager.js';
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';

export async function initSetupFlusso(user) {
    try {
        const userRef = doc(db, "users", user.uid);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
            const data = userSnap.data();
            // Se già completato, non mostrare nulla
            if (data.sharing_setup_completed) return;
        }

        // Se arriviamo qui, dobbiamo mostrare il modal
        showSetupModal(user);
    } catch (e) {
        console.error("Errore initSetupFlusso:", e);
    }
}

async function showSetupModal(user) {
    // 1. Creazione Overlay
    const overlay = createElement('div', { id: 'setup-flusso-overlay', className: 'modal-overlay active' });

    // 2. Creazione Modal (Stile Premium V4.1)
    const modal = createElement('div', { className: 'modal-premium border-glow animate-in zoom-in' }, [
        createElement('header', { className: 'modal-header-premium' }, [
            createElement('h2', { className: 'modal-title-premium', textContent: 'Configura il tuo Flusso' }),
            createElement('p', { className: 'modal-subtitle-premium', textContent: 'Ottimizza notifiche e condivisioni' })
        ]),

        createElement('div', { className: 'modal-body-premium' }, [
            // Opzione 1: Push
            createSetupOption('push_enable', 'notifications_active', 'Notifiche Push', 'Ricevi avvisi istantanei sul dispositivo', true),
            // Opzione 2: Email Fallback
            createSetupOption('email_fallback', 'mail', 'Fallback Email', 'Ricevi email se la push non è disponibile', true),

            // Opzione 3: Condivisione Contatti
            createElement('div', { className: 'setup-section' }, [
                createElement('label', { className: 'setup-label', textContent: 'Contatti Fidati (Condivisione Rapida)' }),
                createElement('div', { id: 'setup-contacts-list', className: 'setup-contacts-grid scrollbar-hidden', style: 'max-height: 150px; overflow-y: auto;' }, [
                    createElement('p', { className: 'setup-empty-text', textContent: 'Caricamento contatti...' })
                ])
            ])
        ]),

        createElement('footer', { className: 'modal-footer-premium' }, [
            createElement('button', {
                className: 'btn-premium-action',
                onclick: () => handleSaveSetup(user)
            }, [
                createElement('span', { textContent: 'Salva e Inizia' }),
                createElement('span', { className: 'material-symbols-outlined', textContent: 'rocket_launch' })
            ])
        ])
    ]);

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    loadRubricaForSetup(user.uid);
}

function createSetupOption(id, icon, title, desc, checked) {
    return createElement('div', { className: 'setup-option-card' }, [
        createElement('div', { className: 'setup-option-header' }, [
            createElement('div', { className: 'setup-icon-box' }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: icon })
            ]),
            createElement('div', { className: 'setup-option-info' }, [
                createElement('span', { className: 'setup-option-title', textContent: title }),
                createElement('span', { className: 'setup-option-desc', textContent: desc })
            ])
        ]),
        createElement('input', {
            type: 'checkbox',
            id: id,
            className: 'settings-toggle', // Usa toggle standard definito in core_pagine.css
            checked: checked
        })
    ]);
}

async function loadRubricaForSetup(uid) {
    const listContainer = document.getElementById('setup-contacts-list');
    if (!listContainer) return;

    try {
        const snap = await getDocs(collection(db, "users", uid, "contacts"));
        const contacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        clearElement(listContainer);

        if (contacts.length === 0) {
            listContainer.appendChild(createElement('p', {
                className: 'setup-empty-text',
                textContent: 'Nessun contatto in rubrica. Potrai aggiungerli dopo.'
            }));
            return;
        }

        contacts.forEach(c => {
            const item = createElement('label', { className: 'setup-contact-item' }, [
                createElement('input', { type: 'checkbox', className: 'contact-checkbox', value: c.email }),
                createElement('div', { className: 'contact-info-block' }, [
                    createElement('span', { className: 'contact-name', textContent: c.nome || c.email.split('@')[0] }),
                    createElement('span', { className: 'contact-email', textContent: c.email })
                ])
            ]);
            listContainer.appendChild(item);
        });

    } catch (e) {
        console.error("Errore loadRubricaForSetup:", e);
    }
}

async function handleSaveSetup(user) {
    const btn = document.querySelector('.btn-premium-action');
    if (btn) btn.disabled = true;

    const pushEnabled = document.getElementById('push_enable').checked;
    const emailFallback = document.getElementById('email_fallback').checked;

    // Raccoglie email contatti selezionati
    const selectedEmails = Array.from(document.querySelectorAll('.contact-checkbox:checked')).map(cb => cb.value);

    const updateData = {
        sharing_setup_completed: true,
        prefs_push: pushEnabled,
        prefs_email_sharing: emailFallback,
        trusted_contacts: selectedEmails,
        updatedAt: new Date().toISOString()
    };

    try {
        // Se Push attivo, richiedi token
        if (pushEnabled) {
            const comp = checkPushCompatibility();
            if (comp.compatible) {
                await syncPushToken(user);
            } else {
                console.warn("[SETUP] Push non compatibile:", comp.reason);
                updateData.prefs_push = false; // Reset se non compatibile
            }
        }

        await updateDoc(doc(db, "users", user.uid), updateData);

        showToast("Configurazione completata!", "success");

        // Chiudi Modal
        const overlay = document.getElementById('setup-flusso-overlay');
        if (overlay) overlay.remove();

    } catch (e) {
        console.error("Errore handleSaveSetup:", e);
        showToast("Errore durante il salvataggio", "error");
        if (btn) btn.disabled = false;
    }
}

// requestPushToken rimosso - ora gestito da push_manager.js
