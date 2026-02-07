import { auth, db } from './firebase-config.js';
import { getContacts, addContact } from './db.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';
import { showToast } from './ui-core.js';

// --- INITIALIZATION ---
import { initComponents } from './components.js';
import { t } from './translations.js';

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    // 1. Inizializzazione Componenti (Header/Footer Protocol V3.0)
    await initProtocolUI();

    // 2. Load Data
    loadCounters(user.uid, user.email);
    loadTopAccounts(user.uid);
    loadRubrica(user.uid);
});

/**
 * PROTOCOLLO UI: Gestione Header Balanced e Footer Placeholder
 */
async function initProtocolUI() {
    await initComponents();

    const hLeft = document.getElementById('header-left');
    const hCenter = document.getElementById('header-center');
    const hRight = document.getElementById('header-right');

    if (hLeft) {
        hLeft.innerHTML = `
            <button id="btn-back" class="btn-icon-header">
                <span class="material-symbols-outlined">arrow_back</span>
            </button>
        `;
        document.getElementById('btn-back').addEventListener('click', () => window.location.href = 'home_page.html');
    }

    if (hCenter) {
        hCenter.innerHTML = `
            <h2 class="header-title" data-t="area_privata_title">${t('area_privata_title')}</h2>
        `;
    }

    if (hRight) {
        hRight.innerHTML = `
            <a href="home_page.html" class="btn-icon-header">
                <span class="material-symbols-outlined">home</span>
            </a>
        `;
    }

    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        fCenter.innerHTML = `
            <button id="btn-scroll-rubrica" class="btn-icon-header" title="Rubrica">
                <span class="material-symbols-outlined">group</span>
            </button>
        `;
        document.getElementById('btn-scroll-rubrica').addEventListener('click', () => {
            document.getElementById('rubrica-toggle-btn').scrollIntoView({ behavior: 'smooth' });
        });
    }
}

/**
 * COUNTERS ENGINE: Sincronizza i badge delle card Matrix
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

        try {
            const invitesQ = query(collection(db, "invites"),
                where("recipientEmail", "==", email),
                where("status", "==", "accepted")
            );
            const invitesSnap = await getDocs(invitesQ);
            invitesSnap.forEach(invDoc => {
                const inv = invDoc.data();
                if (inv.type === 'privato') {
                    counts.shared++;
                }
            });
        } catch (e) { console.warn("Counters (Invites) error", e); }

        if (document.getElementById('count-standard')) document.getElementById('count-standard').textContent = `(${counts.standard})`;
        if (document.getElementById('count-memo')) document.getElementById('count-memo').textContent = `(${counts.memo})`;
        if (document.getElementById('count-shared')) document.getElementById('count-shared').textContent = `(${counts.shared})`;
        if (document.getElementById('count-shared-memo')) document.getElementById('count-shared-memo').textContent = `(${counts.sharedMemo})`;

    } catch (e) { logError("Counters", e); }
}

/**
 * TOP ACCOUNTS WIDGET
 */
async function loadTopAccounts(uid) {
    const list = document.getElementById('top-accounts-list');
    if (!list) return;

    try {
        let snap;
        try {
            const q = query(collection(db, "users", uid, "accounts"), orderBy("views", "desc"), limit(10));
            snap = await getDocs(q);
        } catch (err) {
            const qFallback = query(collection(db, "users", uid, "accounts"), limit(20));
            snap = await getDocs(qFallback);
        }

        list.innerHTML = '';

        if (!snap || snap.empty) {
            list.innerHTML = `<p class="text-[10px] text-white/20 text-center py-6 font-bold uppercase tracking-widest">${t('no_active_data')}</p>`;
            return;
        }

        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.views || 0) - (a.views || 0));
        const top10 = docs.slice(0, 10);

        top10.forEach((acc) => {
            const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';
            const isMemo = !!acc.hasMemo || acc.type === 'memorandum';
            const isShared = !!acc.shared || !!acc.isMemoShared;

            let badgeClass = '';
            let textAccentClass = 'text-accent-blue';

            if (isShared && isMemo) {
                badgeClass = 'badge-shared-memo';
                textAccentClass = 'text-accent-green';
            } else if (isShared) {
                badgeClass = 'badge-shared';
                textAccentClass = 'text-accent-purple';
            } else if (isMemo) {
                badgeClass = 'badge-memo';
                textAccentClass = 'text-accent-orange';
            }

            const dots = '••••••••';
            const card = document.createElement('div');
            card.className = "micro-account-card cursor-pointer hover:bg-white/5 transition-all active:scale-95";
            card.setAttribute('data-action', 'navigate');
            card.setAttribute('data-id', acc.id);
            card.setAttribute('data-href', `dettaglio_account_privato.html?id=${acc.id}`);

            card.innerHTML = `
              <div class="swipe-content">
                <div class="micro-account-content">
                    <div class="micro-account-avatar-box">
                        <img class="micro-account-avatar" src="${avatar}" alt="">
                        <div class="micro-item-badge-dot ${badgeClass}"></div>
                    </div>

                    <div class="micro-account-info" data-id="${acc.id}">
                        <h3 class="micro-account-name">${acc.nomeAccount || t('without_name')}</h3>
                         <div class="micro-account-subtitle">
                            <span>${t('views')}: ${acc.views || 0}</span>
                        </div>
                    </div>

                     <div class="micro-account-top-actions">
                        ${acc.password ? `
                        <button class="micro-btn-utility btn-toggle-visibility relative z-10 ${textAccentClass}" data-action="toggle-visibility" data-stop-propagation="true">
                            <span class="material-symbols-outlined">visibility</span>
                        </button>` : ''}
                    </div>
                </div>

                <div class="micro-data-display">
                    ${acc.username ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_user')}:</span>
                        <span class="micro-data-value">${acc.username}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline relative z-10" 
                                data-action="copy-text" data-text="${acc.username.replace(/"/g, '&quot;')}" title="${t('copy_username')}" data-stop-propagation="true">
                            <span class="material-symbols-outlined">content_copy</span>
                        </button>
                    </div>` : ''}
                    
                    ${acc.account ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_account')}:</span>
                        <span class="micro-data-value">${acc.account}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline relative z-10" 
                                data-action="copy-text" data-text="${acc.account.replace(/"/g, '&quot;')}" title="${t('copy_account')}" data-stop-propagation="true">
                            <span class="material-symbols-outlined">content_copy</span>
                        </button>
                    </div>` : ''}
                    
                    ${acc.password ? `
                    <div class="micro-data-row">
                        <span class="micro-data-label">${t('label_password')}:</span>
                        <span class="micro-data-value" id="pass-text-${acc.id}">${dots}</span>
                        <button class="copy-btn-dynamic micro-btn-copy-inline relative z-10" 
                                data-action="copy-text" data-text="${acc.password.replace(/"/g, '&quot;')}" title="${t('copy_password')}" data-stop-propagation="true">
                            <span class="material-symbols-outlined">content_copy</span>
                        </button>
                    </div>` : ''}
                </div>
              </div>
            `;

            list.appendChild(card);
        });
    } catch (e) {
        logError("Top Accounts", e);
        list.innerHTML = '<p class="text-[10px] text-red-400/30 text-center py-6">Errore caricamento</p>';
    }
}

/**
 * RUBRICA ENGINE
 */
const rubricaContent = document.getElementById('rubrica-content');
const rubricaChevron = document.getElementById('rubrica-chevron');
const rubricaList = document.getElementById('contacts-list');

if (document.getElementById('rubrica-toggle-btn')) {
    document.getElementById('rubrica-toggle-btn').onclick = () => {
        const isHidden = rubricaContent.classList.toggle('hidden');
        if (rubricaChevron) {
            rubricaChevron.classList.toggle('rotate-180', !isHidden);
        }
    };
}

if (document.getElementById('add-contact-btn')) {
    document.getElementById('add-contact-btn').onclick = (e) => {
        e.stopPropagation();
        document.getElementById('add-contact-form').classList.toggle('hidden');
    };
}

async function loadRubrica(uid) {
    if (!rubricaList) return;
    try {
        const list = await getContacts(uid);
        if (document.getElementById('rubrica-counter')) {
            document.getElementById('rubrica-counter').textContent = `(${list.length})`;
        }
        rubricaList.innerHTML = list.length === 0 ? `<p class="text-xs text-white/10 py-10 text-center">${t('empty_contacts')}</p>` : '';

        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        list.forEach(c => {
            const div = document.createElement('div');
            div.className = "rubrica-list-item";
            div.innerHTML = `
                <div class="rubrica-item-info-row">
                    <div class="rubrica-item-avatar">${(c.nome || '?').charAt(0)}</div>
                    <div class="rubrica-item-info">
                        <p class="truncate m-0 rubrica-item-name">${c.nome} ${c.cognome || ''}</p>
                        <p class="truncate m-0 tracking-tighter max-w-100 rubrica-item-email">${c.email}</p>
                    </div>
                </div>
                <div class="rubrica-item-actions">
                    <button class="btn-delete-contact rubrica-item-action" data-id="${c.id}">
                        <span class="material-symbols-outlined">delete</span>
                    </button>
                </div>
            `;
            rubricaList.appendChild(div);
        });

        rubricaList.querySelectorAll('.btn-delete-contact').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.getAttribute('data-id');
                window.deleteContact(uid, id);
            });
        });
    } catch (e) { logError("Rubrica Engine", e); }
}

window.deleteContact = async (uid, id) => {
    const confirmed = await window.showConfirmModal(
        "ELIMINAZIONE CONTATTO",
        "Rimuovere definitivamente questo contatto dalla rubrica?",
        "ELIMINA",
        "ANNULLA"
    );

    if (confirmed) {
        try {
            await deleteDoc(doc(db, "users", uid, "contacts", id));
            showToast(t('contact_removed'), "success");
            loadRubrica(uid);
        } catch (e) { logError("Rubrica Delete", e); }
    }
};

if (document.getElementById('btn-add-contact')) {
    document.getElementById('btn-add-contact').onclick = async () => {
        const nome = document.getElementById('contact-nome').value.trim();
        const cognome = document.getElementById('contact-cognome').value.trim();
        const email = document.getElementById('contact-email').value.trim();
        const user = auth.currentUser;
        if (!user || !email) return;

        try {
            await addContact(user.uid, { nome, cognome, email, createdAt: new Date().toISOString() });
            showToast(t('identity_registered'), "success");
            document.querySelectorAll('#add-contact-form input').forEach(i => i.value = '');
            document.getElementById('add-contact-form').classList.add('hidden');
            loadRubrica(user.uid);
        } catch (e) { logError("Rubrica Add", e); }
    };
}
