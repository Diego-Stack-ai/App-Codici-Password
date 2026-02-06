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
    // Carichiamo i componenti base (se necessario)
    await initComponents();

    // Iniezione Header Balanced (3 Zone)
    const hLeft = document.getElementById('header-left');
    const hCenter = document.getElementById('header-center');
    const hRight = document.getElementById('header-right');

    if (hLeft) {
        hLeft.innerHTML = `
            <button onclick="history.back()" class="btn-icon-header">
                <span class="material-symbols-outlined">arrow_back</span>
            </button>
        `;
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

    // Iniezione Shortcut Rubrica in Footer (Centro)
    const fCenter = document.getElementById('footer-center-actions');
    if (fCenter) {
        fCenter.innerHTML = `
            <button onclick="document.getElementById('rubrica-toggle-btn').scrollIntoView({behavior: 'smooth'})" class="btn-icon-header" title="Rubrica">
                <span class="material-symbols-outlined">group</span>
            </button>
        `;
    }
}

/**
 * COUNTERS ENGINE: Sincronizza i badge delle card Matrix
 */
async function loadCounters(uid, email) {
    try {
        // 1. Own Accounts
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

        // 2. Add counts of accounts shared WITH me (Accepted Invites)
        try {
            const invitesQ = query(collection(db, "invites"),
                where("recipientEmail", "==", email),
                where("status", "==", "accepted")
            );
            const invitesSnap = await getDocs(invitesQ);
            invitesSnap.forEach(invDoc => {
                const inv = invDoc.data();
                if (inv.type === 'privato') {
                    // Usually shared accounts are either standard shared or memo shared
                    // For now, let's treat all as 'shared' unless we fetch the account to know
                    counts.shared++;
                }
            });
        } catch (e) { console.warn("Counters (Invites) error", e); }

        // Update UI (Localized format with requested parentheses)
        // Spacing is now handled by CSS class .gap-2 in the HTML container
        if (document.getElementById('count-standard')) document.getElementById('count-standard').textContent = `(${counts.standard})`;
        if (document.getElementById('count-memo')) document.getElementById('count-memo').textContent = `(${counts.memo})`;
        if (document.getElementById('count-shared')) document.getElementById('count-shared').textContent = `(${counts.shared})`;
        if (document.getElementById('count-shared-memo')) document.getElementById('count-shared-memo').textContent = `(${counts.sharedMemo})`;

    } catch (e) { logError("Counters", e); }
}

/**
 * TOP ACCOUNTS WIDGET: Rendering degli ultimi protocolli usati
 */
async function loadTopAccounts(uid) {
    const list = document.getElementById('top-accounts-list');
    if (!list) return;

    try {
        // Try with ordering (needs index)
        let snap;
        try {
            const q = query(collection(db, "users", uid, "accounts"), orderBy("views", "desc"), limit(10));
            snap = await getDocs(q);
        } catch (err) {
            console.warn("Top Accounts: Index for 'views' might be missing, falling back to unordered.", err);
            const qFallback = query(collection(db, "users", uid, "accounts"), limit(20));
            snap = await getDocs(qFallback);
        }

        list.innerHTML = '';

        if (!snap || snap.empty) {
            list.innerHTML = `<p class="text-[10px] text-white/20 text-center py-6 font-bold uppercase tracking-widest">${t('no_active_data')}</p>`;
            return;
        }

        // Sort in memory if we used fallback
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        docs.sort((a, b) => (b.views || 0) - (a.views || 0));
        const top10 = docs.slice(0, 10);

        // Update UI
        top10.forEach((acc) => {
            const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';

            const card = document.createElement('a');
            card.href = `dettaglio_account_privato.html?id=${acc.id}`;
            card.className = "micro-list-item border-glow";
            card.innerHTML = `
                <div class="micro-item-content">
                    <div class="micro-item-icon-box">
                        <img src="${avatar}" alt="${acc.nomeAccount || 'Account'}">
                    </div>
                    <span class="micro-item-title">${acc.nomeAccount || 'Progetto'}</span>
                </div>
                <div class="micro-item-badge-container">
                    <span class="micro-item-badge">${acc.views || 0}</span>
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
 * RUBRICA ENGINE: Accordion, Form, List
 */
const rubricaContent = document.getElementById('rubrica-content');
const rubricaChevron = document.getElementById('rubrica-chevron');
const rubricaList = document.getElementById('contacts-list');

document.getElementById('rubrica-toggle-btn').onclick = () => {
    const isHidden = rubricaContent.classList.toggle('hidden');
    rubricaChevron.style.transform = isHidden ? 'rotate(0deg)' : 'rotate(180deg)';
};

document.getElementById('add-contact-btn').onclick = (e) => {
    e.stopPropagation();
    document.getElementById('add-contact-form').classList.toggle('hidden');
};

async function loadRubrica(uid) {
    if (!rubricaList) return;
    try {
        const list = await getContacts(uid);
        document.getElementById('rubrica-counter').textContent = `(${list.length})`;
        rubricaList.innerHTML = list.length === 0 ? `<p class="text-xs text-white/10 py-10 text-center">${t('empty_contacts')}</p>` : '';

        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        list.forEach(c => {
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-2 rounded-xl transition-all group overflow-hidden w-full rubrica-list-item";
            div.style.marginBottom = "4px"; // Manteniamo solo il margine dinamico se necessario, o spostiamo a CSS
            div.innerHTML = `
                <div class="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                    <div class="size-6 rounded bg-orange-500/20 text-orange-500 border border-orange-500/30 flex items-center justify-center font-black text-[8px] uppercase shrink-0">${(c.nome || '?').charAt(0)}</div>
                    <div class="min-w-0 flex-1 overflow-hidden">
                        <p class="truncate m-0 rubrica-item-name">${c.nome} ${c.cognome || ''}</p>
                        <p class="truncate m-0 uppercase tracking-tighter max-w-100 rubrica-item-email">${c.email}</p>
                    </div>
                </div>
                <div class="flex items-center gap-0 shrink-0 ml-1 opacity-60 group-hover:opacity-100 transition-opacity">
                    <button onclick="deleteContact('${uid}', '${c.id}')" class="p-1.5 rounded-md border-none cursor-pointer flex items-center justify-center rubrica-item-action hover:text-red-400 transition-colors">
                        <span class="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                </div>
            `;
            rubricaList.appendChild(div);
        });
    } catch (e) { logError("Rubrica Engine", e); }
}

window.deleteContact = async (uid, id) => {
    // V3.5: Use Premium Confirm
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
