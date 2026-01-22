
import { auth, db } from './firebase-config.js';
import { getContacts, addContact } from './db.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.1.0/firebase-auth.js";
import {
    doc,
    getDoc,
    collection,
    getDocs,
    query,
    orderBy,
    limit,
    where,
    deleteDoc
} from "https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore.js";

// --- DOM ELEMENTS ---
const topAccountsList = document.getElementById('top-accounts-list');
const rubricaList = document.getElementById('contacts-list');
const rubricaCounter = document.getElementById('rubrica-counter');

// --- STATE ---
let editingContactId = null;

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = 'index.html';
        return;
    }

    loadCounters(user.uid, user.email);
    // Inject custom Titanium Metallic Styles
    function injectMetallicStyles() {
        if (document.getElementById('metallic-styles')) return;
        const style = document.createElement('style');
        style.id = 'metallic-styles';
        style.innerHTML = `
            .metallic-card-titanium {
                position: relative;
                /* Arrotondamento gestito via Tailwind utility ma forzato qui per coerenza interna */
                border-radius: 0.75rem; 
                overflow: hidden;
                background: 
                    /* Punto luce centrale (Ridotto spread del 7%) */
                    radial-gradient(ellipse 55% 95% at 50% 40%, rgba(255,255,255,0.5) 0%, rgba(255,255,255,0.2) 45%, rgba(255,255,255,0) 75%),
                    /* Riflesso diagonale (Saetta) */
                    linear-gradient(110deg, transparent 42%, rgba(255,255,255,0.06) 49%, rgba(255,255,255,0.12) 50%, rgba(255,255,255,0.06) 51%, transparent 58%),
                    /* Gradiente base Titanio */
                    linear-gradient(135deg, #334155 0%, #1e293b 100%);
            }
            .metallic-card-titanium::after {
                content: "";
                position: absolute;
                inset: 0;
                border-radius: inherit;
                padding: 1px; /* Spessore bordo */
                background: linear-gradient(90deg, rgba(255,255,255,0.3) 0%, rgba(255,255,255,0.05) 50%, rgba(255,255,255,0.3) 100%);
                -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                -webkit-mask-composite: xor;
                mask-composite: exclude;
                pointer-events: none;
                z-index: 20;
            }
        `;
        document.head.appendChild(style);
    }
    injectMetallicStyles();

    loadTopAccounts(user.uid);
    loadRubrica(user.uid);
});

async function loadCounters(uid, email) {
    try {
        const accountsRef = collection(db, "users", uid, "accounts");
        const allSnap = await getDocs(accountsRef);

        let counts = { standard: 0, memo: 0, shared: 0, sharedMemo: 0 };
        let ownSharedStandard = 0;
        let ownSharedMemo = 0;

        allSnap.forEach(doc => {
            const d = doc.data();
            if (d.isArchived) return;
            if (d.ownerId && d.ownerId !== uid) return; // Ghost copy

            const isShared = !!d.shared || !!d.isMemoShared;
            const isMemo = !!d.hasMemo || !!d.isMemoShared || d.type === 'memorandum' || d.category === 'memorandum';

            if (isShared) {
                if (isMemo) ownSharedMemo++;
                else ownSharedStandard++;
            } else if (isMemo) {
                counts.memo++;
            } else {
                counts.standard++;
            }
        });

        // Load Shared WITH me
        const invitesSnap = await getDocs(query(
            collection(db, "invites"),
            where("recipientEmail", "==", email),
            where("status", "==", "accepted")
        ));

        let receivedStandard = 0;
        let receivedMemo = 0;

        for (const invDoc of invitesSnap.docs) {
            const inv = invDoc.data();
            try {
                let accRef = inv.aziendaId
                    ? doc(db, "users", inv.ownerId, "aziende", inv.aziendaId, "accounts", inv.accountId)
                    : doc(db, "users", inv.ownerId, "accounts", inv.accountId);

                const accSnap = await getDoc(accRef);
                if (accSnap.exists() && !accSnap.data().isArchived) {
                    const d = accSnap.data();
                    const isMemo = !!d.hasMemo || !!d.isMemoShared || d.type === 'memorandum' || d.category === 'memorandum';
                    if (isMemo) receivedMemo++;
                    else receivedStandard++;
                }
            } catch (e) { }
        }

        counts.shared = ownSharedStandard + receivedStandard;
        counts.sharedMemo = ownSharedMemo + receivedMemo;

        updateBadge('count-standard', counts.standard, 'Account');
        updateBadge('count-memo', counts.memo, 'Memorandum');
        updateBadge('count-shared', counts.shared, 'Account condivisi');
        updateBadge('count-shared-memo', counts.sharedMemo, 'Memo condivisi');

    } catch (e) { console.error(e); }
}

function updateBadge(id, count, label) {
    const el = document.getElementById(id);
    if (el) el.textContent = `${label} (${count})`;
}

async function loadTopAccounts(uid) {
    if (!topAccountsList) return;
    try {
        const q = query(collection(db, "users", uid, "accounts"), orderBy("views", "desc"), limit(10));
        const snap = await getDocs(q);
        topAccountsList.innerHTML = '';

        if (snap.empty) {
            topAccountsList.innerHTML = '<p class="text-xs text-gray-400 text-center py-4">Nessun account recente.</p>';
            return;
        }

        snap.forEach(doc => {
            const acc = doc.data();
            const div = document.createElement('a');
            div.href = `dettaglio_account_privato.html?id=${doc.id}`;

            // Apply Homepage "Urgenze/Scadenze" Button Effect
            // Base Gradient: Dark Slate (Neutral Premium) - linear-gradient(135deg, #334155 0%, #0f172a 100%)
            const cardGradient = 'linear-gradient(135deg, #334155 0%, #0f172a 100%)';

            div.setAttribute('style', `background: ${cardGradient};`);

            div.className = "group flex items-center justify-between p-3 rounded-lg border-glow border-0 backdrop-blur-[10px] relative overflow-hidden shadow-lg shadow-black/20 transition-all hover:scale-[1.02]";

            const logo = acc.logo || acc.avatar;
            const iconHtml = logo
                ? `<img class="h-9 w-9 rounded-full object-cover bg-white/10" src="${logo}">`
                : `<div class="h-9 w-9 rounded-full bg-white/5 text-white flex items-center justify-center font-bold text-xs capitalize border border-white/20 shadow-inner">${(acc.nomeAccount || '?').charAt(0)}</div>`;

            div.innerHTML = `
                <div class="relative z-10 flex items-center gap-3">
                    ${iconHtml}
                    <div>
                        <p class="text-sm font-bold text-white drop-shadow-sm">${acc.nomeAccount || 'Senza Nome'}</p>
                        <p class="text-[10px] text-slate-300 flex items-center gap-1"><span class="material-symbols-outlined text-[12px]">visibility</span> ${acc.views || 0} visite</p>
                    </div>
                </div>
                <span class="relative z-10 material-symbols-outlined text-slate-400 group-hover:text-white transition-colors text-sm">chevron_right</span>
            `;
            topAccountsList.appendChild(div);
        });
    } catch (e) { topAccountsList.innerHTML = 'Errore'; }
}

// --- RUBRICA ---
window.toggleRubrica = () => {
    const content = document.getElementById('rubrica-content');
    const chevron = document.getElementById('rubrica-chevron');
    content.classList.toggle('hidden');
    chevron.style.transform = content.classList.contains('hidden') ? 'rotate(180deg)' : 'rotate(0deg)';
};

window.toggleAddContactForm = () => {
    document.getElementById('add-contact-form').classList.toggle('hidden');
};

async function loadRubrica(uid) {
    if (!rubricaList) return;
    try {
        const contacts = await getContacts(uid);
        renderContacts(contacts, uid);
    } catch (e) { console.error(e); }
}

function renderContacts(list, uid) {
    rubricaCounter.textContent = `(${list.length})`;
    rubricaList.innerHTML = list.length === 0 ? '<p class="text-xs text-gray-400 text-center py-4">Nessun contatto</p>' : '';

    list.sort((a, b) => (a.nome || '').localeCompare(b.nome || ''));
    list.forEach(c => {
        const div = document.createElement('div');
        // Use injected metallic class
        div.className = "metallic-card-titanium group flex items-center justify-between p-2 shadow-sm transition-all hover:bg-white/5 border-0";

        div.innerHTML = `
            <div class="relative z-10 flex items-center gap-3 min-w-0">
                <div class="w-8 h-8 rounded-full bg-white/5 text-white border border-white/10 flex items-center justify-center font-bold text-xs uppercase shrink-0">${(c.nome || '?').charAt(0)}</div>
                <div class="min-w-0">
                    <p class="text-sm font-bold text-white truncate">${c.nome} ${c.cognome || ''}</p>
                    <p class="text-[11px] text-gray-400 truncate">${c.email}</p>
                </div>
            </div>
            <div class="relative z-10 flex items-center gap-1">
                <button class="p-1.5 text-primary hover:text-white hover:bg-white/10 rounded-full transition-colors" onclick="window.location.href='mailto:${c.email}'"><span class="material-symbols-outlined text-lg">mail</span></button>
                <button class="p-1.5 text-gray-500 hover:text-white hover:bg-white/10 rounded-full transition-colors" onclick="openEditContact('${c.id}', '${c.nome}', '${c.cognome}', '${c.email}')"><span class="material-symbols-outlined text-lg">edit</span></button>
                <button class="p-1.5 text-gray-500 hover:text-red-500 hover:bg-white/10 rounded-full transition-colors" onclick="removeContact('${uid}', '${c.id}')"><span class="material-symbols-outlined text-lg">delete</span></button>
            </div>
        `;
        rubricaList.appendChild(div);
    });
}

window.openEditContact = (id, n, c, e) => {
    editingContactId = id;
    document.getElementById('contact-nome').value = n;
    document.getElementById('contact-cognome').value = c;
    document.getElementById('contact-email').value = e;
    document.getElementById('add-contact-form').classList.remove('hidden');
    document.getElementById('btn-add-contact').textContent = "Aggiorna";
};

window.removeContact = async (uid, id) => {
    if (confirm("Eliminare?")) {
        await deleteDoc(doc(db, "users", uid, "contacts", id));
        loadRubrica(uid);
    }
};

const btnAdd = document.getElementById('btn-add-contact');
if (btnAdd) {
    btnAdd.onclick = async () => {
        const n = document.getElementById('contact-nome').value.trim();
        const c = document.getElementById('contact-cognome').value.trim();
        const e = document.getElementById('contact-email').value.trim();
        const user = auth.currentUser;
        if (!user || !e) return;

        try {
            if (editingContactId) {
                await deleteDoc(doc(db, "users", user.uid, "contacts", editingContactId));
            }
            await addContact(user.uid, { nome: n, cognome: c, email: e, createdAt: new Date().toISOString() });

            document.getElementById('contact-nome').value = '';
            document.getElementById('contact-cognome').value = '';
            document.getElementById('contact-email').value = '';
            editingContactId = null;
            btnAdd.textContent = "Salva";
            document.getElementById('add-contact-form').classList.add('hidden');
            loadRubrica(user.uid);
        } catch (err) { console.error(err); }
    };
}
