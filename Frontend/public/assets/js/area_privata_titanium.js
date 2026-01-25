import { auth, db } from './firebase-config.js';
import { getContacts, addContact } from './db.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, orderBy, limit, where, deleteDoc } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";
import { logError } from './utils.js';
import { showToast } from './ui-core.js';
import { initComponents } from './components.js';

// --- INITIALIZATION ---
initComponents();

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }
    loadCounters(user.uid, user.email);
    loadTopAccounts(user.uid);
    loadRubrica(user.uid);
});

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
            const isMemo = !!d.isMemo || d.type === 'memorandum';

            if (isShared) {
                if (isMemo) counts.sharedMemo++;
                else counts.shared++;
            } else if (isMemo) {
                counts.memo++;
            } else {
                counts.standard++;
            }
        });

        // Update UI
        document.getElementById('count-standard').textContent = `Account (${counts.standard})`;
        document.getElementById('count-memo').textContent = `Memo (${counts.memo})`;
        document.getElementById('count-shared').textContent = `Invitati (${counts.shared})`;
        document.getElementById('count-shared-memo').textContent = `Memo Team (${counts.sharedMemo})`;

    } catch (e) { logError("Counters", e); }
}

/**
 * TOP ACCOUNTS WIDGET: Rendering degli ultimi protocolli usati
 */
async function loadTopAccounts(uid) {
    const list = document.getElementById('top-accounts-list');
    if (!list) return;

    try {
        const q = query(collection(db, "users", uid, "accounts"), orderBy("views", "desc"), limit(4));
        const snap = await getDocs(q);
        list.innerHTML = '';

        if (snap.empty) {
            list.innerHTML = '<p class="text-[10px] text-white/20 text-center py-6 font-bold uppercase tracking-widest">Nessun dato attivo</p>';
            return;
        }

        snap.forEach(doc => {
            const acc = doc.data();
            const avatar = acc.logo || acc.avatar || 'assets/images/google-avatar.png';

            const card = document.createElement('a');
            card.href = `dettaglio_account_privato.html?id=${doc.id}`;
            card.className = "flex items-center justify-between p-3 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all group";
            card.innerHTML = `
                <div class="flex items-center gap-3">
                    <img src="${avatar}" class="size-9 rounded-lg object-cover bg-white/10 opacity-70 group-hover:opacity-100 transition-opacity">
                    <div class="flex flex-col">
                        <span class="text-sm font-bold text-white/80 group-hover:text-white">${acc.nomeAccount || 'Progetto'}</span>
                        <span class="text-[9px] text-white/20 font-bold uppercase tracking-widest">${acc.views || 0} Visioni</span>
                    </div>
                </div>
                <span class="material-symbols-outlined text-white/10 group-hover:text-blue-400 text-sm transition-all group-hover:translate-x-1">chevron_right</span>
            `;
            list.appendChild(card);
        });
    } catch (e) { logError("Top Accounts", e); }
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
        rubricaList.innerHTML = list.length === 0 ? '<p class="text-xs text-white/10 py-10 text-center">Protocollo rubrica vuoto</p>' : '';

        list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
        list.forEach(c => {
            const div = document.createElement('div');
            div.className = "flex items-center justify-between p-3 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-colors group";
            div.innerHTML = `
                <div class="flex items-center gap-3 min-w-0">
                    <div class="size-8 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center justify-center font-black text-xs uppercase shrink-0">${(c.nome || '?').charAt(0)}</div>
                    <div class="min-w-0">
                        <p class="text-xs font-black text-white/80 truncate">${c.nome} ${c.cognome || ''}</p>
                        <p class="text-[9px] text-white/20 font-bold truncate">${c.email}</p>
                    </div>
                </div>
                <div class="flex items-center gap-1 opacity-20 group-hover:opacity-100 transition-opacity">
                    <button onclick="window.location.href='mailto:${c.email}'" class="p-2 text-white/40 hover:text-blue-400 transition-colors"><span class="material-symbols-outlined text-lg">mail</span></button>
                    <button onclick="deleteContact('${uid}', '${c.id}')" class="p-2 text-white/40 hover:text-red-500 transition-colors"><span class="material-symbols-outlined text-lg">delete</span></button>
                </div>
            `;
            rubricaList.appendChild(div);
        });
    } catch (e) { logError("Rubrica Engine", e); }
}

window.deleteContact = async (uid, id) => {
    if (confirm("Rimuovere il contatto dal protocollo?")) {
        try {
            await deleteDoc(doc(db, "users", uid, "contacts", id));
            showToast("Contatto rimosso", "success");
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
        showToast("Identità registrata", "success");
        document.querySelectorAll('#add-contact-form input').forEach(i => i.value = '');
        document.getElementById('add-contact-form').classList.add('hidden');
        loadRubrica(user.uid);
    } catch (e) { logError("Rubrica Add", e); }
};
