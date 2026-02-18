/**
 * AREA PRIVATA MODULE (V5.0 - Single Orchestrator Compliant)
 * Logica specifica per la dashboard privata (Counters, Top 10, Rubrica).
 * 
 * REFACTOR NOTE:
 * - Rimossa auto-inizializzazione (osserveAuth).
 * - Rimossa chiamata a initComponents() (gestita da main.js).
 * - Rimossa logica inviti (gestita da main.js).
 * - Espone initAreaPrivata(user) come entry point unico.
 */

import { db } from '../../firebase-config.js';
import { collection, getDocs, query, where, deleteDoc, doc, orderBy, limit, addDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast, showConfirmModal } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';

// State locale per evitare reload inutili
let _isInitialized = false;
let _currentUserStart = null;

/**
 * ENTRY POINT UNICO
 * Chiamato da main.js dopo che l'autenticazione è confermata e il layout base è pronto.
 * @param {Object} user - Oggetto User di Firebase Auth
 */
export async function initAreaPrivata(user) {
    if (!user) return;

    // Evita re-inizializzazione se l'utente è lo stesso
    // (Nota: se serve refresh forzato, passare force=true o gestire a parte)
    if (_isInitialized && _currentUserStart === user.uid) {
        console.log("[AreaPrivata] Già inizializzato per questo utente.");
        return;
    }

    _currentUserStart = user.uid;
    _isInitialized = true;

    console.log("[AreaPrivata] Inizializzazione Modulo...");

    // 1. Caricamento Dati Parallelo (Performance V5.0)
    await Promise.all([
        loadCounters(user.uid, user.email),
        loadTopAccounts(user.uid),
        loadRubrica(user.uid)
    ]);

    // 2. Setup Event Listeners (Idempotente)
    setupEventListeners(user.uid);

    console.log("[AreaPrivata] Modulo Pronto.");
}

/**
 * ------------------------------------------------------------------
 * COUNTERS ENGINE
 * Calcola e aggiorna i badge dei contatori nella dashboard.
 * ------------------------------------------------------------------
 */
async function loadCounters(uid, email) {
    try {
        const allSnap = await getDocs(collection(db, "users", uid, "accounts"));
        let counts = { standard: 0, memo: 0, shared: 0, sharedMemo: 0 };

        allSnap.forEach(doc => {
            const d = doc.data();
            if (d.isArchived) return;
            const isShared = !!d.shared || !!d.isMemoShared;
            const isMemo = !!d.isMemo || d.type === 'memorandum' || !!d.hasMemo;

            if (isShared) {
                if (isMemo) counts.sharedMemo++;
                else counts.shared++;
            } else if (isMemo) {
                counts.memo++;
            } else {
                counts.standard++;
            }
        });

        // Controlla inviti accettati (per conteggio condivisi)
        const invitesQ = query(collection(db, "invites"),
            where("recipientEmail", "==", email),
            where("status", "==", "accepted")
        );
        const invitesSnap = await getDocs(invitesQ);
        invitesSnap.forEach(invDoc => {
            const inv = invDoc.data();
            if (inv.type === 'privato') counts.shared++;
        });

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = `(${val})`;
        };

        setVal('count-standard', counts.standard);
        setVal('count-memo', counts.memo);
        setVal('count-shared', counts.shared);
        setVal('count-shared-memo', counts.sharedMemo);

    } catch (e) { logError("Counters", e); }
}

/**
 * ------------------------------------------------------------------
 * TOP 10 WIDGET
 * Mostra gli account più utilizzati.
 * ------------------------------------------------------------------
 */
async function loadTopAccounts(uid) {
    const list = document.getElementById('top-accounts-list');
    if (!list) return;

    try {
        const q = query(collection(db, "users", uid, "accounts"), orderBy("views", "desc"), limit(10));
        const snap = await getDocs(q);

        clearElement(list);

        if (snap.empty) {
            list.appendChild(createElement('p', {
                className: 'text-[10px] text-white/20 text-center py-6 font-bold uppercase tracking-widest',
                textContent: t('no_active_data') || 'Nessun dato attivo'
            }));
            return;
        }

        const items = snap.docs.map(doc => createMicroAccountCard(doc.id, doc.data()));
        setChildren(list, items);
    } catch (e) {
        logError("TopAccounts", e);
        setChildren(list, createElement('p', { className: 'text-[10px] text-red-400/30 text-center py-6', textContent: 'Errore caricamento' }));
    }
}

function createMicroAccountCard(id, data) {
    const avatar = data.logo || data.avatar || 'assets/images/google-avatar.png';
    const isMemo = !!data.hasMemo || data.type === 'memorandum';
    const isShared = !!data.shared || !!data.isMemoShared;

    let badgeClass = 'bg-blue-500';
    if (isShared && isMemo) badgeClass = 'badge-shared-memo bg-emerald-500';
    else if (isShared) badgeClass = 'badge-shared bg-purple-500';
    else if (isMemo) badgeClass = 'badge-memo bg-amber-500';

    const card = createElement('div', {
        className: 'micro-account-card cursor-pointer hover:bg-white/5 transition-all active:scale-95',
        onclick: () => window.location.href = `dettaglio_account_privato.html?id=${id}`
    }, [
        createElement('div', { className: 'swipe-content' }, [
            createElement('div', { className: 'micro-account-content' }, [
                createElement('div', { className: 'micro-account-avatar-box' }, [
                    createElement('img', { className: 'micro-account-avatar', src: avatar }),
                    createElement('div', { className: `micro-item-badge-dot ${badgeClass}` })
                ]),
                createElement('div', { className: 'micro-account-info' }, [
                    createElement('h3', { className: 'micro-account-name', textContent: data.nomeAccount || t('without_name') }),
                    createElement('div', { className: 'micro-account-subtitle' }, [
                        createElement('span', { textContent: `${t('views')}: ${data.views || 0}` })
                    ])
                ]),
                createElement('div', { className: 'micro-account-top-actions' }, [
                    data.password ? createElement('button', {
                        className: 'micro-btn-utility relative z-10',
                        onclick: (e) => { e.stopPropagation(); window.toggleTripleVisibility(id); }
                    }, [
                        createElement('span', { className: 'material-symbols-outlined', textContent: 'visibility' })
                    ]) : null
                ])
            ]),
            createElement('div', { className: 'micro-data-display' }, [
                data.username ? createDataRow(t('label_user'), data.username) : null,
                data.account ? createDataRow(t('label_account'), data.account) : null,
                data.password ? createDataRow(t('label_password'), '••••••••', data.password, true) : null
            ].filter(Boolean))
        ])
    ]);
    return card;
}

function createDataRow(label, displayValue, copyValue = null, isPassword = false) {
    return createElement('div', { className: 'micro-data-row' }, [
        createElement('span', { className: 'micro-data-label', textContent: `${label}:` }),
        createElement('span', {
            className: 'micro-data-value',
            id: isPassword ? `pass-text-${Math.random().toString(36).substr(2, 9)}` : undefined, // Genera ID casuale se serve per visibilità
            textContent: displayValue
        }),
        createElement('button', {
            className: 'micro-btn-copy-inline relative z-10',
            onclick: (e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(copyValue || displayValue);
                showToast(t('copied') || "Copiato!");
            }
        }, [
            createElement('span', { className: 'material-symbols-outlined', textContent: 'content_copy' })
        ])
    ]);
}

/**
 * ------------------------------------------------------------------
 * RUBRICA ENGINE
 * Gestione contatti condivisi.
 * ------------------------------------------------------------------
 */
async function loadRubrica(uid) {
    const listContainer = document.getElementById('contacts-list');
    if (!listContainer) return;

    try {
        const snap = await getDocs(collection(db, "users", uid, "contacts"));
        const contacts = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        const counter = document.getElementById('rubrica-counter');
        if (counter) counter.textContent = `(${contacts.length})`;

        clearElement(listContainer);

        if (contacts.length === 0) {
            listContainer.appendChild(createElement('p', { className: 'text-xs text-white/10 py-10 text-center', textContent: t('empty_contacts') }));
            return;
        }

        contacts.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        const items = contacts.map(c => createContactItem(uid, c));
        setChildren(listContainer, items);
    } catch (e) { logError("Rubrica", e); }
}

function createContactItem(uid, c) {
    return createElement('div', { className: 'rubrica-list-item' }, [
        createElement('div', { className: 'rubrica-item-info-row' }, [
            createElement('div', { className: 'rubrica-item-avatar', textContent: (c.nome || '?').charAt(0).toUpperCase() }),
            createElement('div', { className: 'rubrica-item-info' }, [
                createElement('p', { className: 'truncate m-0 rubrica-item-name', textContent: `${c.nome} ${c.cognome || ''}` }),
                createElement('p', { className: 'truncate m-0 tracking-tighter max-w-100 rubrica-item-email', textContent: c.email })
            ])
        ]),
        createElement('div', { className: 'rubrica-item-actions' }, [
            createElement('button', {
                className: 'btn-delete-contact rubrica-item-action',
                onclick: () => deleteContact(uid, c.id)
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
            ])
        ])
    ]);
}

async function deleteContact(uid, id) {
    // Usa showConfirmModal di ui-core (esportata)
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) return;
    try {
        await deleteDoc(doc(db, "users", uid, "contacts", id));
        showToast(t('contact_removed'));
        loadRubrica(uid); // Ricarica rubrica
    } catch (e) { logError("RubricaDelete", e); }
}

/**
 * ------------------------------------------------------------------
 * EVENT LISTENERS (Idempotent)
 * Assicura che i listener siano attaccati una sola volta.
 * ------------------------------------------------------------------
 */
function setupEventListeners(uid) {
    // Helper per attaccare listener una volta sola
    const addListenerOnce = (id, event, handler) => {
        const el = document.getElementById(id);
        if (el && !el.dataset.listenerAttached) {
            el.addEventListener(event, handler);
            el.dataset.listenerAttached = 'true';
        }
    };

    // Toggle Rubrica
    addListenerOnce('rubrica-toggle-btn', 'click', () => {
        const content = document.getElementById('rubrica-content');
        const chevron = document.getElementById('rubrica-chevron');
        if (content) {
            const isHidden = content.classList.toggle('hidden');
            if (chevron) chevron.classList.toggle('rotate-180', !isHidden);
        }
    });

    // Toggle Form Aggiungi
    addListenerOnce('add-contact-btn', 'click', (e) => {
        e.stopPropagation();
        const form = document.getElementById('add-contact-form');
        if (form) form.classList.toggle('hidden');
    });

    // Salva Contatto
    addListenerOnce('btn-add-contact', 'click', async () => {
        const nomeEl = document.getElementById('contact-nome');
        const cognomeEl = document.getElementById('contact-cognome');
        const emailEl = document.getElementById('contact-email');

        if (!nomeEl || !emailEl) return;

        const nome = nomeEl.value.trim();
        const cognome = cognomeEl ? cognomeEl.value.trim() : '';
        const email = emailEl.value.trim();

        if (!email) {
            showToast(t('email_required') || 'Email obbligatoria', 'error');
            return;
        }

        try {
            await addDoc(collection(db, "users", uid, "contacts"), {
                nome,
                cognome,
                email,
                createdAt: new Date().toISOString()
            });

            showToast(t('identity_registered'));

            // Reset Form
            nomeEl.value = '';
            if (cognomeEl) cognomeEl.value = '';
            emailEl.value = '';
            document.getElementById('add-contact-form').classList.add('hidden');

            // Reload
            loadRubrica(uid);
        } catch (e) { logError("RubricaAdd", e); }
    });
}
