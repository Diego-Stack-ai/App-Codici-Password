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
import { collection, getDocs, query, where, deleteDoc, doc, orderBy, limit, addDoc, updateDoc, writeBatch } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
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

    // 2. Setup Event Listeners & FABs (Idempotente)
    setupEventListeners(user.uid);
    setupFABs();

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
        console.log(`[Counters] Fetching own accounts for UID: ${uid}`);
        const allSnap = await getDocs(collection(db, "users", uid, "accounts"));
        console.log(`[Counters] Own accounts fetched: ${allSnap.size}`);
        let counts = { standard: 0, memo: 0, shared: 0, sharedMemo: 0 };

        allSnap.forEach(doc => {
            const d = doc.data();
            if (d.isArchived) return;
            const isShared = d.visibility === 'shared' || !!d.shared || !!d.isMemoShared;
            const isMemo = (d.type === 'memo' || d.type === 'memorandum') || !!d.isMemo || !!d.hasMemo;

            if (isShared) {
                if (isMemo) counts.sharedMemo++;
                else counts.shared++;
            } else if (isMemo) {
                counts.memo++;
            } else {
                counts.standard++;
            }
        });

        // Controlla inviti accettati (per conteggio condivisi) - Normalizzazione V5.0
        const rawEmail = email || "";
        const lowerEmail = rawEmail.toLowerCase().trim();
        const emailsToSearch = [...new Set([rawEmail.trim(), lowerEmail])].filter(Boolean);

        console.log(`[Counters] Fetching invites for:`, emailsToSearch);
        const invitesQ = query(collection(db, "invites"),
            where("recipientEmail", "in", emailsToSearch),
            where("status", "==", "accepted")
        );
        const invitesSnap = await getDocs(invitesQ);
        console.log(`[Counters] Invites fetched: ${invitesSnap.size}`);
        invitesSnap.forEach(invDoc => {
            const inv = invDoc.data();
            const invType = inv.type || 'privato';
            const isMemoInv = (invType === 'memo' || invType === 'memorandum');

            if (isMemoInv) counts.sharedMemo++;
            else counts.shared++;
        });

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
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
                className: 'card-no-data',
                textContent: t('no_active_data') || 'Nessun dato attivo'
            }));
            return;
        }

        const items = snap.docs.map(doc => createMicroAccountCard(doc.id, doc.data()));
        setChildren(list, items);
    } catch (e) {
        logError("TopAccounts", e);
        setChildren(list, createElement('p', { className: 'error-text', textContent: 'Errore caricamento' }));
    }
}

function createMicroAccountCard(id, data) {
    const avatar = data.logo || data.avatar || 'assets/images/google-avatar.png';
    const isMemo = (data.type === 'memo' || data.type === 'memorandum') || !!data.isMemo || !!data.hasMemo;
    const isShared = data.visibility === 'shared' || !!data.shared || !!data.isMemoShared;

    let badgeClass = 'bg-blue-500';
    if (isShared && isMemo) badgeClass = 'bg-emerald-500';
    else if (isShared) badgeClass = 'bg-purple-500';
    else if (isMemo) badgeClass = 'bg-amber-500';

    const card = createElement('div', {
        className: 'account-card',
        onclick: () => window.location.href = `dettaglio_account_privato.html?id=${id}`
    }, [
        createElement('div', { className: 'swipe-content' }, [
            createElement('div', { className: 'account-card-layout' }, [
                createElement('div', { className: 'account-card-left' }, [
                    createElement('div', { className: 'account-icon-box' }, [
                        createElement('img', { className: 'account-avatar', src: avatar }), // class account-avatar not specialized but image fills box
                        createElement('div', { className: `account-badge-dot ${badgeClass}` })
                    ]),
                    createElement('div', { className: 'account-card-info-group' }, [
                        createElement('h3', { className: 'account-card-title' }, [
                            document.createTextNode(data.nomeAccount || t('without_name')),
                            createElement('span', { className: 'micro-visto-inline', style: 'opacity:0.6; font-size: 0.8em; margin-left: 4px;', textContent: `• ${data.views || 0}` })
                        ]),
                        createElement('p', { className: 'account-card-subtitle', textContent: data.username || data.email || 'Utente Nascosto' })
                    ])
                ])
            ]),
            createElement('div', { className: 'account-data-display' }, [
                data.username ? createDataRow(t('label_user'), data.username) : null,
                data.account ? createDataRow(t('label_account'), data.account) : null,
                data.password ? createDataRow(t('label_password'), '••••••••', data.password, true, id) : null
            ].filter(Boolean))
        ])
    ]);
    return card;
}

function createDataRow(label, displayValue, copyValue = null, isPassword = false, id = null) {
    const rowId = Math.random().toString(36).substr(2, 9);
    return createElement('div', { className: 'account-data-row' }, [
        createElement('span', { className: 'account-data-label', textContent: `${label}:` }),
        createElement('span', {
            className: 'account-data-value',
            id: isPassword ? `pass-val-${rowId}` : undefined,
            textContent: displayValue
        }),
        createElement('div', { className: 'micro-row-actions' }, [
            isPassword ? createElement('button', {
                className: 'btn-mini-action',
                onclick: (e) => {
                    e.stopPropagation();
                    const el = document.getElementById(`pass-val-${rowId}`);
                    const span = e.currentTarget.querySelector('span');
                    if (el.textContent === '••••••••') {
                        el.textContent = copyValue;
                        span.textContent = 'visibility_off';
                    } else {
                        el.textContent = '••••••••';
                        span.textContent = 'visibility';
                    }
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 16px;', textContent: 'visibility' })
            ]) : null,
            createElement('button', {
                className: 'btn-mini-action',
                onclick: (e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(copyValue || displayValue);
                    showToast(t('copied') || "Copiato!");
                }
            }, [
                createElement('span', { className: 'material-symbols-outlined', style: 'font-size: 16px;', textContent: 'content_copy' })
            ])
        ].filter(Boolean))
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
            listContainer.appendChild(createElement('p', { className: 'card-no-data', textContent: t('empty_contacts') }));
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
                createElement('p', { className: 'rubrica-item-name', textContent: `${c.nome} ${c.cognome || ''}` }),
                createElement('p', { className: 'rubrica-item-email', textContent: c.email })
            ])
        ]),
        createElement('div', { className: 'rubrica-item-actions' }, [
            createElement('button', {
                className: 'rubrica-item-action action-edit',
                onclick: () => editContact(c)
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'edit' })
            ]),
            createElement('button', {
                className: 'rubrica-item-action action-delete',
                onclick: () => deleteContact(uid, c.id)
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'delete' })
            ])
        ])
    ]);
}

function editContact(c) {
    const nomeInput = document.getElementById('contact-nome');
    const cognomeInput = document.getElementById('contact-cognome');
    const emailInput = document.getElementById('contact-email');
    const form = document.getElementById('add-contact-form');

    if (nomeInput) nomeInput.value = c.nome || '';
    if (cognomeInput) cognomeInput.value = c.cognome || '';
    if (emailInput) emailInput.value = c.email || '';

    if (form) {
        form.classList.remove('hidden');
        form.dataset.editId = c.id; // Salva l'ID per l'update
        const btnSave = document.getElementById('btn-add-contact');
        const btnCancel = document.getElementById('btn-cancel-contact');
        if (btnSave) btnSave.textContent = t('update') || 'AGGIORNA';
        if (btnCancel) btnCancel.classList.remove('hidden');
    }
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

async function resetAccountViews(uid) {
    if (!await showConfirmModal(t('confirm_reset_views_title') || "Reset Visti", t('confirm_reset_views_msg') || "Vuoi davvero azzerare tutti i contatori delle visualizzazioni?")) return;

    try {
        const q = query(collection(db, "users", uid, "accounts"));
        const snap = await getDocs(q);

        if (snap.empty) return;

        const batch = writeBatch(db);
        snap.docs.forEach(d => {
            batch.update(d.ref, { views: 0 });
        });

        await batch.commit();
        showToast(t('views_reset_success') || "Contatori azzerati!");
        loadTopAccounts(uid); // Refresh Top 10
    } catch (e) { logError("ResetViews", e); }
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

    // Reset Views
    addListenerOnce('btn-reset-views', 'click', () => {
        resetAccountViews(uid);
    });

    addListenerOnce('add-contact-btn', 'click', (e) => {
        e.stopPropagation();
        const form = document.getElementById('add-contact-form');
        const btnSave = document.getElementById('btn-add-contact');
        const btnCancel = document.getElementById('btn-cancel-contact');
        if (form) {
            const isHidden = form.classList.toggle('hidden');
            if (isHidden) {
                resetContactForm();
            } else {
                delete form.dataset.editId;
                if (btnSave) btnSave.textContent = t('save_contact') || 'SALVA';
                if (btnCancel) btnCancel.classList.add('hidden');
            }
        }
    });

    // Annulla Modifica
    addListenerOnce('btn-cancel-contact', 'click', () => {
        resetContactForm();
        const form = document.getElementById('add-contact-form');
        if (form) form.classList.add('hidden');
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
            const form = document.getElementById('add-contact-form');
            const editId = form ? form.dataset.editId : null;

            const contactData = {
                nome,
                cognome,
                email,
                updatedAt: new Date().toISOString()
            };

            if (editId) {
                // UPDATE
                await updateDoc(doc(db, "users", uid, "contacts", editId), contactData);
                showToast(t('contact_updated') || 'Contatto aggiornato!');
            } else {
                // ADD
                contactData.createdAt = contactData.updatedAt;
                await addDoc(collection(db, "users", uid, "contacts"), contactData);
                showToast(t('identity_registered'));
            }

            // Reset Form and reload
            resetContactForm();
            if (form) form.classList.add('hidden');
            loadRubrica(uid);
        } catch (e) { logError("RubricaSave", e); }
    });
}

/**
 * ------------------------------------------------------------------
 * FAB SYSTEM (Centrale)
 * ------------------------------------------------------------------
 */
function setupFABs() {
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        clearElement(fCenter);
        setChildren(fCenter, createElement('div', { className: 'fab-group' }, [
            createElement('a', {
                href: 'archivio_account.html',
                className: 'btn-fab-action btn-fab-archive',
                title: t('account_archive') || 'Archivio',
                dataset: { label: t('archive') || 'Archivio' }
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'inventory_2' })
            ]),
            createElement('button', {
                id: 'add-account-btn',
                className: 'btn-fab-action btn-fab-scadenza',
                title: t('add_account') || 'Nuovo Account',
                dataset: { label: t('add_short') || 'Aggiungi' },
                onclick: () => window.location.href = 'form_account_privato.html'
            }, [
                createElement('span', { className: 'material-symbols-outlined', textContent: 'add' })
            ])
        ]));
    }
}

/**
 * RESET FORM CONTATTI
 */
function resetContactForm() {
    const nomeEl = document.getElementById('contact-nome');
    const cognomeEl = document.getElementById('contact-cognome');
    const emailEl = document.getElementById('contact-email');
    const form = document.getElementById('add-contact-form');
    const btnSave = document.getElementById('btn-add-contact');
    const btnCancel = document.getElementById('btn-cancel-contact');

    if (nomeEl) nomeEl.value = '';
    if (cognomeEl) cognomeEl.value = '';
    if (emailEl) emailEl.value = '';
    if (form) delete form.dataset.editId;
    if (btnSave) btnSave.textContent = t('save_contact') || 'SALVA';
    if (btnCancel) btnCancel.classList.add('hidden');
}
