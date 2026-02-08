/**
 * AREA PRIVATA MODULE (V4.1)
 * Dashboard per account personali, condivisi e rubrica.
 */

import { auth, db } from '../../firebase-config.js';
import { observeAuth } from '../../auth.js';
import { collection, getDocs, query, where, deleteDoc, doc, orderBy, limit, updateDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { createElement, setChildren, clearElement } from '../../dom-utils.js';
import { showToast } from '../../ui-core.js';
import { t } from '../../translations.js';
import { logError } from '../../utils.js';
import { initComponents } from '../../components.js';

// --- INITIALIZATION ---
observeAuth(async (user) => {
    if (user) {
        // Inizializza Header e Footer secondo Protocollo Base
        await initComponents();

        // Load Data
        loadCounters(user.uid, user.email);
        loadTopAccounts(user.uid);
        loadRubrica(user.uid);
        loadRubrica(user.uid);
        setupEventListeners(user.uid);

        // Check for pending invites
        checkForPendingInvites(user.email);
    }
});

/**
 * COUNTERS ENGINE
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

        // Invites Accepted
        const invitesQ = query(collection(db, "invites"),
            where("recipientEmail", "==", email),
            where("status", "==", "accepted")
        );
        const invitesSnap = await getDocs(invitesQ);
        invitesSnap.forEach(invDoc => {
            const inv = invDoc.data();
            if (inv.type === 'privato') counts.shared++;
        });

        const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = `(${val})`; };
        setVal('count-standard', counts.standard);
        setVal('count-memo', counts.memo);
        setVal('count-shared', counts.shared);
        setVal('count-shared-memo', counts.sharedMemo);

    } catch (e) { logError("Counters", e); }
}

/**
 * TOP 10 WIDGET
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

    let badgeClass = '';
    if (isShared && isMemo) badgeClass = 'badge-shared-memo bg-emerald-500';
    else if (isShared) badgeClass = 'badge-shared bg-purple-500';
    else if (isMemo) badgeClass = 'badge-memo bg-amber-500';
    else badgeClass = 'bg-blue-500';

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
        createElement('span', { className: 'micro-data-value', textContent: displayValue }),
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
 * RUBRICA ENGINE
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
    if (!await showConfirmModal(t('confirm_delete_title'), t('confirm_delete_msg'))) return;
    try {
        await deleteDoc(doc(db, "users", uid, "contacts", id));
        showToast(t('contact_removed'));
        loadRubrica(uid);
    } catch (e) { logError("RubricaDelete", e); }
}

/**
 * EVENT LISTENERS
 */
function setupEventListeners(uid) {
    const toggleBtn = document.getElementById('rubrica-toggle-btn');
    if (toggleBtn) {
        toggleBtn.onclick = () => {
            const content = document.getElementById('rubrica-content');
            const chevron = document.getElementById('rubrica-chevron');
            const isHidden = content.classList.toggle('hidden');
            if (chevron) chevron.classList.toggle('rotate-180', !isHidden);
        };
    }

    const addBtn = document.getElementById('add-contact-btn');
    if (addBtn) {
        addBtn.onclick = (e) => {
            e.stopPropagation();
            document.getElementById('add-contact-form').classList.toggle('hidden');
        };
    }

    const saveBtn = document.getElementById('btn-add-contact');
    if (saveBtn) {
        saveBtn.onclick = async () => {
            const nome = document.getElementById('contact-nome').value.trim();
            const cognome = document.getElementById('contact-cognome').value.trim();
            const email = document.getElementById('contact-email').value.trim();
            if (!email) return;

            try {
                const { addDoc, collection } = await import("https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js");
                await addDoc(collection(db, "users", uid, "contacts"), { nome, cognome, email, createdAt: new Date().toISOString() });
                showToast(t('identity_registered'));
                document.querySelectorAll('#add-contact-form input').forEach(i => i.value = '');
                document.getElementById('add-contact-form').classList.add('hidden');
                loadRubrica(uid);
            } catch (e) { logError("RubricaAdd", e); }
        };
    }
}

/**
 * INVITE SYSTEM (Receiver Side)
 */
async function checkForPendingInvites(email) {
    if (!email) return;

    try {
        const q = query(collection(db, "invites"),
            where("recipientEmail", "==", email),
            where("status", "==", "pending")
        );
        const snap = await getDocs(q);

        if (!snap.empty) {
            // Processing one invite at a time for simplicity
            const inviteDoc = snap.docs[0];
            const inviteData = inviteDoc.data();
            showInviteModal(inviteDoc.id, inviteData);
        }
    } catch (e) { logError("CheckInvites", e); }
}

function showInviteModal(inviteId, data) {
    // Prevent duplicates
    if (document.getElementById('invite-modal')) return;

    const modal = createElement('div', { id: 'invite-modal', className: 'modal-overlay active' }, [
        createElement('div', { className: 'modal-box' }, [
            createElement('span', { className: 'material-symbols-outlined modal-icon icon-accent-purple', textContent: 'mail' }),
            createElement('h3', { className: 'modal-title', textContent: t('invite_received_title') || 'Nuovo Invito' }),
            createElement('p', { className: 'modal-text', textContent: `${data.senderEmail} ${t('invite_received_msg') || 'ha condiviso un account con te:'}` }),
            createElement('p', { className: 'text-sm font-bold text-white mt-2 mb-4', textContent: data.accountName }),
            createElement('div', { className: 'modal-actions' }, [
                createElement('button', {
                    className: 'btn-modal btn-secondary',
                    textContent: t('invite_reject') || 'Rifiuta',
                    onclick: () => handleInviteResponse(inviteId, 'rejected')
                }),
                createElement('button', {
                    className: 'btn-modal btn-primary',
                    textContent: t('invite_accept') || 'Accetta',
                    onclick: () => handleInviteResponse(inviteId, 'accepted')
                })
            ])
        ])
    ]);
    document.body.appendChild(modal);
}

async function handleInviteResponse(inviteId, status) {
    const modal = document.getElementById('invite-modal');
    if (modal) modal.remove();

    try {
        await updateDoc(doc(db, "invites", inviteId), { status: status, respondedAt: new Date().toISOString() });
        showToast(status === 'accepted' ? "Invito accettato!" : "Invito rifiutato", status === 'accepted' ? 'success' : 'info');

        if (status === 'accepted') {
            setTimeout(() => window.location.reload(), 1000); // Reload to show new data
        }
    } catch (e) { logError("InviteResponse", e); showToast(t('error_generic'), 'error'); }
}
