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

    // Iniezione Footer Protocol
    const footerStack = document.getElementById('footer-placeholder');
    if (footerStack) {
        footerStack.innerHTML = `
            <footer class="titanium-footer">
                <div class="header-balanced-container" style="justify-content: center; width: 100%;">
                    <span class="text-[9px] font-bold uppercase tracking-[0.4em] opacity-30">${t('version')}</span>
                </div>
            </footer>
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
        if (document.getElementById('count-standard')) document.getElementById('count-standard').textContent = `Account (${counts.standard})`;
        if (document.getElementById('count-memo')) document.getElementById('count-memo').textContent = `Note (${counts.memo})`;
        if (document.getElementById('count-shared')) document.getElementById('count-shared').textContent = `Invitati (${counts.shared})`;
        if (document.getElementById('count-shared-memo')) document.getElementById('count-shared-memo').textContent = `Memo Team (${counts.sharedMemo})`;

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
            const q = query(collection(db, "users", uid, "accounts"), orderBy("views", "desc"), limit(4));
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
        const top4 = docs.slice(0, 4);

        top4.forEach(acc => {
            const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';

            const card = document.createElement('a');
            card.href = `dettaglio_account_privato.html?id=${acc.id}`;
            card.className = "flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group shadow-sm mb-1";
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${avatar}" class="size-9 rounded-lg object-cover bg-slate-900/10 opacity-70 group-hover:opacity-100 transition-opacity">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-slate-800 group-hover:text-slate-900">${acc.nomeAccount || 'Progetto'}</span>
                        <span class="text-[9px] text-slate-400 font-bold uppercase tracking-widest">${acc.views || 0} Visioni</span>
                    </div>
                </div>
                <span class="material-symbols-outlined text-slate-300 group-hover:text-blue-600 text-sm transition-all group-hover:translate-x-1">chevron_right</span>
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
            div.className = "flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group";
            div.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <div class="size-8 rounded-lg bg-blue-500/10 text-blue-600 border border-blue-500/20 flex items-center justify-center font-black text-xs uppercase shrink-0">${(c.nome || '?').charAt(0)}</div>
                    <div class="min-w-0">
                        <p class="text-xs font-black text-slate-800 truncate">${c.nome} ${c.cognome || ''}</p>
                        <p class="text-[9px] text-slate-400 font-bold truncate">${c.email}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1 opacity-40 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.location.href='mailto:${c.email}'" class="p-2 text-slate-400 hover:text-blue-600 transition-colors"><span class="material-symbols-outlined text-lg">mail</span></button>
                    <button onclick="deleteContact('${uid}', '${c.id}')" class="p-2 text-slate-400 hover:text-red-600 transition-colors"><span class="material-symbols-outlined text-lg">delete</span></button>
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
